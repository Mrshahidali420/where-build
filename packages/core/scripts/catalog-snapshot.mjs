#!/usr/bin/env node
/**
 * A second home for the catalog, in Cloudflare R2.
 *
 *   node scripts/catalog-snapshot.mjs push   copy data/ up to R2
 *   node scripts/catalog-snapshot.mjs pull   bring back anything R2 has that
 *                                           this runner is missing
 *
 * Why. The catalog lives only in the GitHub Actions cache, and a cache entry
 * is deleted after 7 days without use or evicted early when the repo passes
 * 10 GB. Twice a lost cache sent a build back to the small seed copy. R2
 * keeps a copy that does not expire, plus one per day for a week.
 *
 * Layout in the bucket (R2_BUCKET, default the site's r2.catalogBucket):
 *   latest/<file>.gz              the newest copy of each file
 *   latest/meta.json              written LAST: counts, health, run id, files
 *   daily/YYYY-MM-DD/<file>.gz    one copy per day, kept 8 days
 *   weekly/YYYY-Www/<file>.gz     the first fully passing push of each ISO
 *                                 week, kept 4 weeks
 *
 * Files: comics.json, anime.json, characters.json (the catalog), and the
 * state that is expensive to lose: characters-walk.json, novels-walk.json,
 * slug-registry.json and themes.json.
 *
 * Rules (the checks themselves live in scripts/snapshot-health.mjs):
 *   - Corrupt data is never uploaded. Every catalog file must have 99% of
 *     records with an id, slug and name, under 0.5% repeated ids or slugs, and
 *     its link/page share may not fall more than 5 points (or a fifth of
 *     itself) against the health recorded in meta.json. One failing catalog
 *     file refuses the WHOLE push: nothing uploaded, nothing deleted.
 *     ALLOW_HEALTH_DROP=1 lets a share fall on purpose; the floors stay.
 *   - push refuses to overwrite latest/ with a catalog clearly smaller than
 *     the one already there (a seed fallback), unless ALLOW_SHRINK is set.
 *   - The slug registry is append-only: fewer entries than R2 records refuses
 *     the whole push. Only ALLOW_REGISTRY_SHRINK=1 overrides that.
 *   - themes.json below 90% of its last count, or a walk file without a
 *     numeric `next`, is skipped alone; R2 keeps its last good copy.
 *   - push skips the slug registry while data/slug-registry.recovered exists:
 *     a stand-in must never replace the real one.
 *   - Old daily/weekly copies are deleted only after a push that passed every
 *     check, and never below the 3 newest daily copies.
 *   - The bucket stays under 9 GB (R2's free tier is 10). Before uploading, the
 *     bucket is listed and summed; a push that would cross 9 GB still replaces
 *     latest/ but adds no daily or weekly copy.
 *   - pull never makes anything smaller. A catalog file is replaced only when
 *     R2 holds MORE records than the local copy, or the local copy is missing
 *     or unreadable, and only when the file that arrived passes the same
 *     checks. State files are fetched only when missing or unreadable.
 *   - R2 is not required. Any failure (no token, R2 not enabled, no bucket,
 *     a network error, a refused push) is a warning or error annotation and a
 *     line in the job summary, and the script exits 0, so the deploy carries
 *     on. R2_REQUIRED=1 turns failures into a real error.
 *
 * Read-only sites. One site owns the catalog: it walks AniList and pushes.
 * Every other site only reads it (r2.catalogWrite false in its config): push
 * is refused before anything is sent, and pull skips the walk files that only
 * the ingest uses. Such a site's token needs R2 read rights on the catalog
 * bucket and nothing more, so a sister job can never write the catalog.
 *
 * Needs CLOUDFLARE_API_TOKEN (with R2 edit rights, or read rights on a
 * read-only site) and CLOUDFLARE_ACCOUNT_ID in the environment. It drives the
 * wrangler that npm installed, the same one the deploy uses.
 */
import {
  existsSync,
  readFileSync,
  statSync,
  mkdtempSync,
  rmSync,
  renameSync,
  appendFileSync,
  createReadStream,
  createWriteStream,
} from 'node:fs'
import { pipeline } from 'node:stream/promises'
import { createGzip, createGunzip } from 'node:zlib'
import { execFileSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { createRequire } from 'node:module'
import { writeFileAtomic } from '../src/lib/write-atomic.mjs'
import config from '../src/lib/site.mjs'
import {
  catalogHealth,
  checkCatalog,
  checkState,
  judgeFiles,
  dayOf,
  isoWeek,
  planRetention,
  projectSize,
  parseHumanSize,
  CATALOG_FILES,
  STATE_FILES,
  SIZE_CAP_BYTES,
  KEEP_DAYS,
} from './snapshot-health.mjs'

// The site being built is the working directory (scripts/build-site.mjs), so
// its data/ is found from there, not from this file.
const ROOT = process.cwd()
const DATA = join(ROOT, 'data')
const BUCKET = process.env.R2_BUCKET || config.r2.catalogBucket
// Only the site that owns the catalog may write it.
const READ_ONLY = !config.r2.catalogWrite
const REQUIRED = process.env.R2_REQUIRED === '1'
const IN_CI = !!process.env.GITHUB_ACTIONS

const CATALOG = CATALOG_FILES
// themes.json is the song list (scripts/sync-animethemes.mjs). That script
// has its own 90% guard; the push checks the same floor against R2's count.
// A read-only site never needs the ingest's walk positions.
const STATE = READ_ONLY ? STATE_FILES.filter((name) => !name.endsWith('-walk.json')) : STATE_FILES
const RECOVERED_MARKER = join(DATA, 'slug-registry.recovered')

// SNAPSHOT_ONLY=a.json,b.json limits a push or pull to those files, so a job
// that owns one small file (the weekly song sync) never moves the 140 MB
// catalog. Files left out keep their copy and their count in R2.
const ONLY = new Set((process.env.SNAPSHOT_ONLY || '').split(',').map((s) => s.trim()).filter(Boolean))
const wanted = (name) => ONLY.size === 0 || ONLY.has(name)

// A 140 MB upload on a slow runner link. Generous, but never forever.
const WRANGLER_TIMEOUT_MS = 15 * 60 * 1000
const LIST_TIMEOUT_MS = 60 * 1000
// 1000 keys a page; the bucket holds a few dozen. A runaway loop stops here.
const LIST_MAX_PAGES = 50
const GB = 1e9

class SnapshotError extends Error {}
// A push that found bad data. Nothing was uploaded and nothing was deleted.
class Refused extends SnapshotError {}

const keyOfCatalog = (name) => name.replace(/\.json$/, '')
const gb = (bytes) => `${(bytes / GB).toFixed(2)} GB`

function summary(line) {
  if (!process.env.GITHUB_STEP_SUMMARY) return
  try {
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, line + '\n')
  } catch {
    // The summary is a courtesy; failing to write it must not fail the step.
  }
}

function warn(message) {
  console.log(`${IN_CI ? '::warning::' : 'WARNING: '}R2 snapshot: ${message}`)
  summary(`- :warning: R2 snapshot: ${message}`)
}

/** Louder than warn: a red annotation. Still does not fail the step by itself. */
function alarm(message) {
  // An annotation is one line; %0A is how GitHub keeps the rest of it.
  console.log(IN_CI ? `::error::R2 snapshot: ${message.replace(/\n/g, '%0A')}` : `ERROR: R2 snapshot: ${message}`)
  summary(`- :x: R2 snapshot: ${message}`)
}

// ---- wrangler ---------------------------------------------------------------

const WRANGLER_BIN = join(dirname(createRequire(import.meta.url).resolve('wrangler/package.json')), 'bin', 'wrangler.js')

/**
 * Run the installed wrangler with node directly. `npx wrangler` resolves to
 * this same file; calling it through node avoids npx.cmd on Windows, which
 * Node refuses to spawn without a shell.
 */
function wrangler(args) {
  if (!existsSync(WRANGLER_BIN)) throw new SnapshotError('wrangler is not installed (run npm install)')
  try {
    return execFileSync(process.execPath, [WRANGLER_BIN, ...args], {
      cwd: ROOT,
      env: { ...process.env, WRANGLER_SEND_METRICS: 'false' },
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: WRANGLER_TIMEOUT_MS,
      maxBuffer: 64 * 1024 * 1024,
    }).toString()
  } catch (error) {
    const out = `${error.stderr || ''}\n${error.stdout || ''}`
    // Wrangler prints a banner and hints around the one line that matters;
    // show the error lines when there are any, else the tail.
    const lines = out
      .replace(/\x1b\[[0-9;]*m/g, '')
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)
    const errors = lines.filter((l) => /✘|\berror\b|\[code: \d+\]|does not exist/i.test(l))
    const detail = (errors.length ? errors.slice(-3) : lines.slice(-4)).join(' | ')
    const failure = new SnapshotError(`wrangler ${args.slice(0, 4).join(' ')} failed: ${detail || error.message}`)
    failure.missing = /specified key does not exist|NoSuchKey|\b10007\b/i.test(out)
    throw failure
  }
}

const put = (key, file, contentType) =>
  wrangler(['r2', 'object', 'put', `${BUCKET}/${key}`, '--remote', '--file', file, '--content-type', contentType])
const get = (key, file) => wrangler(['r2', 'object', 'get', `${BUCKET}/${key}`, '--remote', '--file', file])
const del = (key) => wrangler(['r2', 'object', 'delete', `${BUCKET}/${key}`, '--remote'])

/** latest/meta.json from R2, or null when there is no snapshot yet. */
function readRemoteMeta(tmp) {
  const file = join(tmp, 'meta.json')
  try {
    get('latest/meta.json', file)
  } catch (error) {
    if (error.missing) return null
    throw error
  }
  try {
    return JSON.parse(readFileSync(file, 'utf8'))
  } catch (error) {
    throw new SnapshotError(`latest/meta.json in R2 is not valid JSON: ${error.message}`)
  }
}

// ---- bucket listing ---------------------------------------------------------------

/**
 * Every object in the bucket as Map(key -> bytes), through the Cloudflare REST
 * API (wrangler has no list command). Returns null, with a warning, when the
 * listing fails; the push then adds no daily or weekly copy and deletes nothing.
 */
async function listBucket() {
  const account = process.env.CLOUDFLARE_ACCOUNT_ID
  const base = `https://api.cloudflare.com/client/v4/accounts/${account}/r2/buckets/${BUCKET}/objects`
  const objects = new Map()
  let cursor = ''
  try {
    for (let page = 0; page < LIST_MAX_PAGES; page++) {
      const url = `${base}?per_page=1000${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${process.env.CLOUDFLARE_API_TOKEN}` },
        signal: AbortSignal.timeout(LIST_TIMEOUT_MS),
      })
      const body = await response.json().catch(() => null)
      if (!response.ok || !body?.success || !Array.isArray(body.result)) {
        const why = body?.errors?.map((e) => `${e.code} ${e.message}`).join('; ') || `HTTP ${response.status}`
        throw new Error(why)
      }
      for (const object of body.result) objects.set(object.key, Number(object.size) || 0)
      cursor = body.result_info?.is_truncated ? body.result_info.cursor : ''
      if (!cursor) return objects
    }
    throw new Error(`more than ${LIST_MAX_PAGES} pages of objects`)
  } catch (error) {
    warn(`could not list bucket ${BUCKET} (${error.message}); the token needs R2 read rights`)
    return null
  }
}

/** Bucket size from `wrangler r2 bucket info`, when the listing failed. */
function bucketSizeFallback() {
  try {
    const info = JSON.parse(wrangler(['r2', 'bucket', 'info', BUCKET, '--json']).replace(/^[^{]*/, ''))
    return parseHumanSize(info.bucket_size)
  } catch (error) {
    warn(`could not read the bucket size either (${error.message})`)
    return null
  }
}

// ---- local files --------------------------------------------------------------

/** { state: 'missing' | 'corrupt' | 'ok', count, value } for a local JSON file. */
function load(file) {
  if (!existsSync(file)) return { state: 'missing', count: 0, value: null }
  let value
  try {
    value = JSON.parse(readFileSync(file, 'utf8'))
  } catch {
    return { state: 'corrupt', count: 0, value: null }
  }
  if (Array.isArray(value)) return { state: value.length ? 'ok' : 'missing', count: value.length, value }
  if (value && typeof value === 'object') {
    // The registry reports its entries; a walk file just has to parse.
    const count = value.entries && typeof value.entries === 'object' ? Object.keys(value.entries).length : 1
    return { state: 'ok', count, value }
  }
  return { state: 'corrupt', count: 0, value: null }
}

// ---- push ---------------------------------------------------------------------

/**
 * Judge every file before anything moves (scripts/snapshot-health.mjs does the
 * judging). Returns what may go up, or throws Refused when the catalog or the
 * registry is bad.
 */
function judgeLocalFiles(prev) {
  const verdict = judgeFiles((name) => load(join(DATA, name)), prev, {
    wanted,
    partial: ONLY.size > 0,
    allowShrink: !!process.env.ALLOW_SHRINK,
    allowHealthDrop: process.env.ALLOW_HEALTH_DROP === '1',
    allowRegistryShrink: process.env.ALLOW_REGISTRY_SHRINK === '1',
    registryRecovered: existsSync(RECOVERED_MARKER),
    registryNotLive: process.env.REGISTRY_NOT_LIVE === '1',
  })
  for (const note of verdict.notes) console.log(`  ${note}`)
  for (const warning of verdict.warnings) warn(warning)
  if (verdict.refusals.length) {
    throw new Refused(`push refused, nothing uploaded or deleted:\n  - ${verdict.refusals.join('\n  - ')}`)
  }
  return verdict
}

/**
 * Which copies this push may add without crossing SIZE_CAP_BYTES.
 * latest/ is always replaced; it barely grows the bucket.
 */
function planCopies(listing, sizes, { today, week, fullyPassing }) {
  const writes = (prefix) => [...sizes].map(([name, size]) => ({ key: `${prefix}/${name}.gz`, size }))
  const latest = writes('latest')
  const daily = writes(`daily/${today}`)
  const weekly = writes(`weekly/${week}`)
  let wantWeekly = fullyPassing && !!listing && !listing.has(`weekly/${week}/meta.json`)

  let current
  let project
  if (listing) {
    current = projectSize(listing, [])
    project = (extra) => projectSize(listing, [...latest, ...extra])
  } else {
    current = bucketSizeFallback()
    if (current == null) {
      alarm('bucket size unknown: latest/ is replaced, but no daily or weekly copy is added')
      return { daily: false, weekly: false, current: null }
    }
    // Without keys, assume every write is new: the cautious sum.
    const add = (list) => list.reduce((sum, w) => sum + w.size, 0)
    project = (extra) => current + add(latest) + add(extra)
  }
  console.log(`  bucket holds ${gb(current)} now (cap ${gb(SIZE_CAP_BYTES)})`)
  if (wantWeekly && project([...daily, ...weekly]) > SIZE_CAP_BYTES) {
    alarm(`a weekly copy would take the bucket to ${gb(project([...daily, ...weekly]))}; not written`)
    wantWeekly = false
  }
  let wantDaily = true
  if (project(daily) > SIZE_CAP_BYTES) {
    alarm(`a daily copy would take the bucket to ${gb(project(daily))}, over ${gb(SIZE_CAP_BYTES)}; only latest/ is replaced`)
    wantDaily = false
  }
  return { daily: wantDaily, weekly: wantWeekly, current }
}

async function push(tmp) {
  const prev = readRemoteMeta(tmp)
  const now = Date.now()
  const today = dayOf(now)
  const week = isoWeek(now)

  const { upload, counts, health, registryEntries, fullyPassing } = judgeLocalFiles(prev)
  if (!upload.length) {
    warn('nothing to upload')
    return
  }

  const sizes = new Map()
  for (const name of upload) {
    const gz = join(tmp, `${name}.gz`)
    await pipeline(createReadStream(join(DATA, name)), createGzip({ level: 9 }), createWriteStream(gz))
    sizes.set(name, statSync(gz).size)
  }

  const listing = await listBucket()
  const copies = planCopies(listing, sizes, { today, week, fullyPassing })

  for (const name of upload) {
    const gz = join(tmp, `${name}.gz`)
    if (copies.daily) put(`daily/${today}/${name}.gz`, gz, 'application/gzip')
    if (copies.weekly) put(`weekly/${week}/${name}.gz`, gz, 'application/gzip')
    put(`latest/${name}.gz`, gz, 'application/gzip')
    console.log(`  uploaded ${name} (${(sizes.get(name) / 1e6).toFixed(1)} MB gz)`)
  }

  // A file this run did not have (a push-only deploy has no walk files) is
  // still in latest/ from an earlier run, so it stays listed, and so do its
  // count and its health.
  const files = [...new Set([...upload, ...(prev?.files || [])])]
  for (const name of CATALOG) {
    const key = keyOfCatalog(name)
    if (counts[key] == null && prev?.counts?.[key] != null) counts[key] = prev.counts[key]
  }
  const meta = {
    savedAt: new Date().toISOString(),
    runId: process.env.GITHUB_RUN_ID || 'local',
    workflow: process.env.GITHUB_WORKFLOW || 'local',
    counts,
    registryEntries,
    health: { ...(prev?.health || {}), ...health },
    files,
    fullyPassing,
  }
  const metaFile = join(tmp, 'meta-out.json')
  writeFileAtomic(metaFile, JSON.stringify(meta, null, 2))
  if (copies.daily) put(`daily/${today}/meta.json`, metaFile, 'application/json')
  if (copies.weekly) put(`weekly/${week}/meta.json`, metaFile, 'application/json')
  // The commit marker. A pull trusts latest/ only through this file, so it
  // goes up after every file it describes.
  put('latest/meta.json', metaFile, 'application/json')

  deleteOldCopies(listing, now, { fullyPassing, today: copies.daily ? today : null, week: copies.weekly ? week : null })

  const extra = [copies.daily && `daily/${today}`, copies.weekly && `weekly/${week}`].filter(Boolean).join(' + ')
  const line = `pushed ${upload.join(', ')} to latest/${extra ? ` + ${extra}` : ''} (${Object.entries(counts).map(([k, v]) => `${k} ${v}`).join(', ')})`
  console.log(`R2 snapshot: ${line}`)
  summary(`- R2 snapshot: ${line}`)
}

/**
 * Old daily and weekly copies. Only after a push that passed every check, and
 * only from a real listing: the newest 3 daily copies are never touched.
 * Best effort: a failed delete costs a little storage.
 */
function deleteOldCopies(listing, now, { fullyPassing, today, week }) {
  if (!fullyPassing) {
    console.log('  old copies kept: this push did not carry every file, or skipped one')
    return
  }
  if (!listing) {
    warn('old copies kept: the bucket could not be listed')
    return
  }
  // The copies this push just wrote count as present.
  const keys = [...listing.keys()]
  if (today) keys.push(`daily/${today}/meta.json`)
  if (week) keys.push(`weekly/${week}/meta.json`)
  const doomed = planRetention(keys, now, { keepDays: KEEP_DAYS }).filter((key) => listing.has(key))
  for (const key of doomed) {
    try {
      del(key)
    } catch (error) {
      warn(`could not delete ${key}: ${error.message}`)
    }
  }
  if (doomed.length) console.log(`  deleted ${doomed.length} old objects`)
}

// ---- pull ---------------------------------------------------------------------

/** Download latest/<name>.gz and unpack it next to its final place in data/. */
async function fetchTo(name, tmp) {
  const gz = join(tmp, `${name}.gz`)
  get(`latest/${name}.gz`, gz)
  // Unpacked in data/ itself, so the final rename stays on one disk and is
  // atomic: the real file is either the old one or the whole new one.
  const out = join(DATA, `${name}.${process.pid}.r2`)
  try {
    await pipeline(createReadStream(gz), createGunzip(), createWriteStream(out))
  } catch (error) {
    rmSync(out, { force: true })
    throw new SnapshotError(`latest/${name}.gz could not be unpacked: ${error.message}`)
  }
  return out
}

async function pull(tmp) {
  const meta = readRemoteMeta(tmp)
  if (!meta) {
    warn(`no snapshot in bucket ${BUCKET} yet (latest/meta.json not found)`)
    return
  }
  const listed = new Set(meta.files || [])
  const done = []

  for (const name of CATALOG) {
    if (!listed.has(name) || !wanted(name)) continue
    if (meta.health?.[name]?.ok === false) {
      alarm(`meta.json marks latest/${name}.gz as failing its checks; not restored`)
      continue
    }
    const target = join(DATA, name)
    const local = load(target)
    const remote = meta.counts?.[keyOfCatalog(name)] || 0
    if (local.state === 'ok' && remote <= local.count) {
      console.log(`  ${name}: local ${local.count} >= R2 ${remote}, kept`)
      continue
    }
    const localCount = local.count
    const localState = local.state
    local.value = null
    const out = await fetchTo(name, tmp)
    const got = load(out)
    // Judge the file that arrived, not the meta: never replace with less,
    // never with a file that fails the push-side checks. The health recorded
    // at push time describes this very file, so it must match too.
    const problems = got.state === 'ok' ? checkCatalog(name, catalogHealth(name, got.value), meta.health?.[name] || null) : []
    got.value = null
    if (got.state !== 'ok' || problems.length || (localState === 'ok' && got.count <= localCount)) {
      rmSync(out, { force: true })
      const why = problems.length ? problems.join('; ') : `${got.state} with ${got.count} records`
      warn(`latest/${name}.gz is ${why}; local copy kept`)
      continue
    }
    renameSync(out, target)
    done.push(`${name} ${localState === 'ok' ? localCount : localState} -> ${got.count}`)
  }

  for (const name of STATE) {
    if (!listed.has(name) || !wanted(name)) continue
    if (meta.health?.[name]?.ok === false) {
      alarm(`meta.json marks latest/${name}.gz as failing its checks; not restored`)
      continue
    }
    const target = join(DATA, name)
    if (load(target).state === 'ok') continue
    const out = await fetchTo(name, tmp)
    const got = load(out)
    // Shape only: with no previous meta there is nothing to compare against.
    const problems = got.state === 'ok' ? checkState(name, got.value, null).problems : ['not valid JSON']
    if (problems.length) {
      rmSync(out, { force: true })
      warn(`latest/${name}.gz fails its checks (${problems.join('; ')}); skipped`)
      continue
    }
    renameSync(out, target)
    done.push(`${name} restored`)
  }

  const line = done.length
    ? `pulled from the snapshot of ${meta.savedAt} (run ${meta.runId}): ${done.join('; ')}`
    : `nothing to pull; local files are as large as the snapshot of ${meta.savedAt}`
  console.log(`R2 snapshot: ${line}`)
  summary(`- R2 snapshot: ${line}`)
}

// ---- main -----------------------------------------------------------------------

async function main() {
  const mode = process.argv[2]
  if (mode !== 'push' && mode !== 'pull') {
    console.error('usage: node scripts/catalog-snapshot.mjs push|pull')
    process.exit(2)
  }
  if (mode === 'push' && READ_ONLY) {
    throw new Refused(`${config.key} only reads ${BUCKET}; push refused, nothing sent`)
  }
  if (!process.env.CLOUDFLARE_API_TOKEN || !process.env.CLOUDFLARE_ACCOUNT_ID) {
    throw new SnapshotError(`CLOUDFLARE_API_TOKEN or CLOUDFLARE_ACCOUNT_ID is not set; ${mode} skipped`)
  }
  const tmp = mkdtempSync(join(tmpdir(), 'catalog-snapshot-'))
  try {
    if (mode === 'push') await push(tmp)
    else await pull(tmp)
  } finally {
    rmSync(tmp, { recursive: true, force: true })
  }
}

main().catch((error) => {
  // A refusal is the guard working, but it means no backup was taken today:
  // make it the loudest line in the log. Exit code as for any other failure.
  if (error instanceof Refused) alarm(error.message)
  else warn(error instanceof SnapshotError ? error.message : `unexpected error: ${error.stack || error.message}`)
  process.exit(REQUIRED ? 1 : 0)
})
