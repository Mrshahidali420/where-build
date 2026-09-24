/**
 * R2 IO for the shared sister ingest (scripts/ingest-credits.mjs,
 * ingest-staff.mjs, ingest-airing.mjs): a read-only pull of the shared
 * catalog from the site that owns it (config.r2.catalogBucket, the same
 * read-only approach scripts/count-pages.mjs uses), and push/pull of this
 * ingest's own files in config.r2.dataBucket/latest/.
 *
 * Every site's config points both buckets at the same two names (see
 * sites/family.mjs), so any one site's site.config.mjs -- set with
 * SITE_CONFIG, exactly as scripts/catalog-snapshot.mjs reads it -- works for
 * this shared ingest; it is never scoped to the site that happens to be named.
 *
 * Deliberately not scripts/catalog-snapshot.mjs: that script owns the
 * catalog bucket's daily/weekly retention, its size cap and its checks for
 * comics/anime/characters specifically, and a sister job must never be able
 * to write that bucket at all (its token only has R2 read there -- see
 * docs/ingest.md). credits.json, staff.json and airing.json are not gzipped
 * here: unlike the 141 MB catalog, the whole sister-data bucket is expected
 * to stay under 1 GB (docs/PLAN.md section 5), so plain JSON keeps this file
 * simpler and the objects readable straight from the R2 console. There is
 * also no daily/weekly retention: sister-data only ever holds `latest/`.
 *
 * meta.json is written LAST by pushSisterFiles, same rule as
 * catalog-snapshot.mjs: a run that dies partway through never leaves a
 * reader trusting a half push, because meta.json (and its `files` list) is
 * the only thing a caller trusts before reading a data file.
 */
import { execFileSync, spawn } from 'node:child_process'
import { existsSync, readFileSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { gunzipSync } from 'node:zlib'
import { writeFileAtomic } from '../src/lib/write-atomic.mjs'
import config from '../src/lib/site.mjs'

export const CATALOG_BUCKET = process.env.CATALOG_R2_BUCKET || config.r2.catalogBucket
export const DATA_BUCKET = process.env.SISTER_R2_BUCKET || config.r2.dataBucket

const WRANGLER_BIN = join(dirname(createRequire(import.meta.url).resolve('wrangler/package.json')), 'bin', 'wrangler.js')
const PUT_TIMEOUT_MS = 5 * 60 * 1000
const PULL_MINUTES = 10

export const haveCredentials = () => !!(process.env.CLOUDFLARE_API_TOKEN && process.env.CLOUDFLARE_ACCOUNT_ID)

export class SisterDataError extends Error {}

/**
 * Run the installed wrangler with node directly (as catalog-snapshot.mjs
 * does): `npx wrangler` resolves to this same file, and calling it through
 * node avoids npx.cmd on Windows, which Node refuses to spawn without a shell.
 */
function wrangler(args) {
  if (!existsSync(WRANGLER_BIN)) throw new SisterDataError('wrangler is not installed (run npm install)')
  try {
    return execFileSync(process.execPath, [WRANGLER_BIN, ...args], {
      env: { ...process.env, WRANGLER_SEND_METRICS: 'false' },
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: PUT_TIMEOUT_MS,
      maxBuffer: 64 * 1024 * 1024,
    }).toString()
  } catch (error) {
    const out = `${error.stderr || ''}\n${error.stdout || ''}`
    const lines = out.replace(/\x1b\[[0-9;]*m/g, '').split('\n').map((l) => l.trim()).filter(Boolean)
    const errors = lines.filter((l) => /✘|\berror\b|\[code: \d+\]|does not exist/i.test(l))
    const detail = (errors.length ? errors.slice(-3) : lines.slice(-4)).join(' | ')
    const failure = new SisterDataError(`wrangler ${args.slice(0, 4).join(' ')} failed: ${detail || error.message}`)
    failure.missing = /specified key does not exist|NoSuchKey|\b10007\b/i.test(out)
    throw failure
  }
}

/** Stop a process and everything it started. Windows needs /T to reach children. */
function stopTree(pid) {
  try {
    if (process.platform === 'win32') execFileSync('taskkill', ['/PID', String(pid), '/T', '/F'], { stdio: 'ignore' })
    else process.kill(pid)
  } catch {
    // Already gone.
  }
}

/**
 * `bucket/key` into `file`. The same spawn-and-wait-for-"Download complete"
 * approach scripts/count-pages.mjs uses for its own read-only catalog pull:
 * wrangler 4 can stay alive after writing the file, so this counts the
 * download done as soon as it says so and stops the process itself, which
 * matters on Windows where a lingering wrangler process outlives the job.
 */
function pull(bucket, key, file) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [WRANGLER_BIN, 'r2', 'object', 'get', `${bucket}/${key}`, '--remote', '--file', file], {
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, CI: '1', WRANGLER_SEND_METRICS: 'false' },
    })
    let said = ''
    let settled = false
    const finish = (error) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      stopTree(child.pid)
      error ? reject(error) : resolve()
    }
    const timer = setTimeout(() => finish(new Error(`${key}: no answer from R2 in ${PULL_MINUTES} minutes`)), PULL_MINUTES * 60000)
    const listen = (chunk) => {
      said += chunk
      if (said.includes('Download complete')) finish()
    }
    child.stdout.on('data', listen)
    child.stderr.on('data', listen)
    child.on('exit', (code) => {
      if (code === 0) return finish()
      const error = new SisterDataError(said.trim().split('\n').pop() || `exit ${code}`)
      error.missing = /specified key does not exist|NoSuchKey|\b10007\b/i.test(said)
      finish(error)
    })
  })
}

const put = (bucket, key, file, contentType = 'application/json') =>
  wrangler(['r2', 'object', 'put', `${bucket}/${key}`, '--remote', '--file', file, '--content-type', contentType])

/**
 * comics.json + anime.json from the catalog bucket's latest/, read only.
 * Never writes that bucket. Returns the combined array of shaped catalog
 * records (scripts/anilist-core.mjs's `shape()` output: id, kind, country,
 * updatedAt, status, episodes, startYear, endYear, ...).
 */
export async function pullCatalogTitles() {
  const dir = mkdtempSync(join(tmpdir(), 'sister-catalog-'))
  try {
    const comicsFile = join(dir, 'comics.json.gz')
    const animeFile = join(dir, 'anime.json.gz')
    await pull(CATALOG_BUCKET, 'latest/comics.json.gz', comicsFile)
    await pull(CATALOG_BUCKET, 'latest/anime.json.gz', animeFile)
    const comics = JSON.parse(gunzipSync(readFileSync(comicsFile)).toString('utf8'))
    const anime = JSON.parse(gunzipSync(readFileSync(animeFile)).toString('utf8'))
    return [...comics, ...anime]
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

/** `name` from sister-data/latest into `dir`, parsed as JSON, or null when it does not exist yet. */
export async function pullSisterFile(name, dir) {
  const file = join(dir, name)
  try {
    await pull(DATA_BUCKET, `latest/${name}`, file)
  } catch (error) {
    if (error.missing) return null
    throw error
  }
  try {
    return JSON.parse(readFileSync(file, 'utf8'))
  } catch (error) {
    throw new SisterDataError(`sister-data latest/${name} is not valid JSON: ${error.message}`)
  }
}

/**
 * Write `files` ({ name: value }, only the files this run changed) to
 * sister-data/latest, then `meta` as latest/meta.json, last. The caller
 * builds `meta` already merged with whatever the previous meta.json held for
 * files this run did not touch (see ingest-credits.mjs and friends): this
 * function does not know about any run but the current one.
 */
export function pushSisterFiles(dir, files, meta) {
  for (const [name, value] of Object.entries(files)) {
    const file = join(dir, name)
    writeFileAtomic(file, JSON.stringify(value))
    put(DATA_BUCKET, `latest/${name}`, file)
  }
  const metaFile = join(dir, 'meta.json')
  writeFileAtomic(metaFile, JSON.stringify(meta, null, 2))
  put(DATA_BUCKET, 'latest/meta.json', metaFile, 'application/json')
}
