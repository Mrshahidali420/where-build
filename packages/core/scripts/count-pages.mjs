#!/usr/bin/env node
/**
 * How many pages each site would build: every gate in every sites/<site>
 * config, counted against the shared catalog. The numbers replace the
 * estimates in docs/PLAN.md section 2.
 *
 *   npm run count-pages                  every site, catalog from R2
 *   npm run count-pages -- anime manga   named sites only
 *   npm run count-pages -- --seed        the small seed catalog, no R2
 *
 * The catalog is read from R2, read only: `wrangler r2 object get` of
 * latest/comics.json.gz, anime.json.gz and themes.json.gz from the first
 * site's r2.catalogBucket, into a temporary folder. Nothing is written to any
 * bucket. When R2 cannot be read (no login, no network) the seed in
 * packages/core/seed is counted instead, and every line says SEED ONLY: the
 * seed holds a few thousand of the catalog's hundred thousand records.
 *
 * Gates that need data the catalog does not hold yet print "Phase 1": credits
 * and staff (voice actors, staff) do not exist until the shared ingest runs.
 * A title gate counts only the facts the catalog can prove, so it is a floor.
 */
import { execFileSync, spawn } from 'node:child_process'
import { existsSync, mkdirSync, readdirSync, readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { gunzipSync } from 'node:zlib'
import { ownsTitle } from '../src/lib/owned.mjs'
import { countGate } from '../src/lib/page-counts.mjs'

const CORE = fileURLToPath(new URL('..', import.meta.url))
const SITES = join(CORE, '..', '..', 'sites')
const SEED = join(CORE, 'seed')
const WRANGLER = join(dirname(createRequire(import.meta.url).resolve('wrangler/package.json')), 'bin', 'wrangler.js')
const PULL_MINUTES = 10

const args = process.argv.slice(2)
const useSeed = args.includes('--seed')
const named = args.filter((arg) => !arg.startsWith('--'))

async function loadSites() {
  const names = named.length ? named : readdirSync(SITES).filter((name) => existsSync(join(SITES, name, 'site.config.mjs')))
  const sites = []
  for (const name of names) {
    const { default: site } = await import(pathToFileURL(join(SITES, name, 'site.config.mjs')).href)
    sites.push(site)
  }
  return sites
}

const readGz = (file) => JSON.parse(gunzipSync(readFileSync(file)).toString('utf8'))

/** Stop a process and everything it started. */
function stopTree(pid) {
  try {
    if (process.platform === 'win32') execFileSync('taskkill', ['/PID', String(pid), '/T', '/F'], { stdio: 'ignore' })
    else process.kill(pid)
  } catch {
    // Already gone.
  }
}

/**
 * latest/<name> from the bucket into dir. Read only. wrangler 4 can stay
 * alive after it has written the file, so the download counts as done when
 * it says so, and the process is stopped then.
 */
function pull(bucket, name, dir) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [WRANGLER, 'r2', 'object', 'get', `${bucket}/latest/${name}`, '--remote', '--file', join(dir, name)], {
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
    const timer = setTimeout(() => finish(new Error(`${name}: no answer from R2 in ${PULL_MINUTES} minutes`)), PULL_MINUTES * 60000)
    const listen = (chunk) => {
      said += chunk
      if (said.includes('Download complete')) finish()
    }
    child.stdout.on('data', listen)
    child.stderr.on('data', listen)
    child.on('exit', (code) => finish(code === 0 ? null : new Error(said.trim().split('\n').pop() || `exit ${code}`)))
  })
}

async function loadCatalog(bucket) {
  if (!useSeed) {
    const dir = join(tmpdir(), `count-pages-${bucket}`)
    mkdirSync(dir, { recursive: true })
    try {
      for (const name of ['meta.json', 'comics.json.gz', 'anime.json.gz', 'themes.json.gz']) await pull(bucket, name, dir)
      const meta = JSON.parse(readFileSync(join(dir, 'meta.json'), 'utf8'))
      return {
        source: `R2 ${bucket}/latest (saved ${meta.savedAt || 'at an unknown time'})`,
        records: [...readGz(join(dir, 'comics.json.gz')), ...readGz(join(dir, 'anime.json.gz'))],
        themes: readGz(join(dir, 'themes.json.gz')).byAnilistId || null,
      }
    } catch (error) {
      console.log(`R2 could not be read (${String(error.message).trim().split('\n').pop()}); counting the seed.`)
    }
  }
  return {
    source: 'SEED ONLY (packages/core/seed), not the real catalog',
    records: [...readGz(join(SEED, 'comics.json.gz')), ...readGz(join(SEED, 'anime.json.gz'))],
    themes: null,
  }
}

const sites = await loadSites()
if (!sites.length) {
  console.error('No site to count.')
  process.exit(1)
}
const catalog = await loadCatalog(sites[0].r2.catalogBucket)
const label = catalog.source.startsWith('SEED') ? ' [SEED ONLY]' : ''
console.log(`Catalog: ${catalog.source}, ${catalog.records.length.toLocaleString('en-US')} titles.\n`)

for (const site of sites) {
  const owned = catalog.records.filter((record) => ownsTitle(site, record))
  console.log(`${site.name} (${site.devHost}): owns ${owned.length.toLocaleString('en-US')} titles${label}`)
  let total = 0
  for (const gate of site.gates) {
    const count = countGate(gate, owned, { themes: catalog.themes })
    if (count !== null) total += count
    const shown = count === null ? (gate.count === 'credits' ? 'Phase 1 (needs credits.json)' : 'n/a (no themes.json)') : count.toLocaleString('en-US')
    console.log(`  ${gate.page.padEnd(40)} ${shown}`)
  }
  console.log(`  ${'counted so far'.padEnd(40)} ${total.toLocaleString('en-US')}${label}\n`)
}
