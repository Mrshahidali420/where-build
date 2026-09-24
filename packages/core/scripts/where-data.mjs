#!/usr/bin/env node
/**
 * A Where site's data, from R2 and back.
 *
 *   node scripts/where-data.mjs pull   (from a site's folder, before the build)
 *   PUSH=1 node scripts/where-data.mjs push   (CI only, after a deploy)
 *
 * pull reads three places, never writing any of them:
 *   1. the shared catalog, r2.catalogBucket/latest/ (read only: the site that
 *      owns it is the only writer). meta.json is read first; the bucket
 *      writes it last, so a half-finished push is never trusted.
 *   2. the sister data, r2.dataBucket/latest/: credits.json, staff.json and
 *      airing.json (docs/ingest.md). A missing file is an empty one: every
 *      page gates on the data it needs, so less data means fewer pages, never
 *      a broken one.
 *   3. this site's own state, r2.dataBucket/<r2.statePrefix>/: the frozen slug
 *      registry and the manifest of the last deploy.
 * and writes the site's data/ folder, cut down to what the build reads
 * (src/where/slim.mjs), one file at a time so the full comics and character
 * files are never held together.
 *
 * push writes back only this site's own state: data/slug-registry.json and
 * public/d/manifest.json (as live-manifest.json). It refuses a registry with
 * fewer entries than the one pulled, because the registry is append-only: a
 * smaller one would hand old addresses to new pages.
 *
 * The registry guard. When the last deploy's manifest says it shipped with a
 * registry and R2 has none now, the registry was lost; pull stops rather than
 * work out fresh addresses that would move live pages. ACCEPT_REGISTRY=1
 * starts a new one on purpose.
 */
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { gunzipSync } from 'node:zlib'
import { pullObject, putObject } from './sister-data-io.mjs'
import { writeFileAtomic } from '../src/lib/write-atomic.mjs'
import { registrySize } from '../src/lib/slug-registry.mjs'
import {
  sourceIdsOf,
  slimComics,
  slimCredits,
  namedIn,
  slimStaff,
  slimCast,
  slimHomeRegistry,
} from '../src/where/slim.mjs'
import config from '../src/lib/site.mjs'

const DATA = join(process.cwd(), 'data')
const MANIFEST = join(process.cwd(), 'public', 'd', 'manifest.json')
const PULLED = join(DATA, 'state-pulled.json')
const STATE = `${config.r2.statePrefix}/`
const IN_CI = !!process.env.GITHUB_ACTIONS

function fail(message) {
  console.error(IN_CI ? `::error::${message}` : `ERROR: ${message}`)
  process.exit(1)
}

const writeJson = (name, value) => writeFileAtomic(join(DATA, name), JSON.stringify(value))
const readJson = (file) => JSON.parse(readFileSync(file, 'utf8'))
const readGz = (file) => JSON.parse(gunzipSync(readFileSync(file)).toString('utf8'))

/** One object into tmp, or null when the key does not exist. Any other failure throws. */
async function fetchOptional(bucket, key, tmp) {
  const file = join(tmp, key.replace(/\//g, '_'))
  try {
    await pullObject(bucket, key, file)
    return file
  } catch (error) {
    if (error.missing) return null
    throw error
  }
}

async function pullCatalog(tmp) {
  const bucket = config.r2.catalogBucket
  const metaFile = await fetchOptional(bucket, 'latest/meta.json', tmp)
  if (!metaFile) fail(`${bucket}/latest/meta.json is missing: the catalog was never pushed`)
  const meta = readJson(metaFile)
  console.log(`catalog: ${bucket}/latest, saved ${meta.savedAt} (run ${meta.runId})`)

  const get = async (name) => {
    const file = await fetchOptional(bucket, `latest/${name}`, tmp)
    if (!file) fail(`${bucket}/latest/${name} is missing`)
    const value = readGz(file)
    rmSync(file, { force: true })
    return value
  }

  const anime = await get('anime.json.gz')
  writeJson('anime.json', anime)
  const themes = await get('themes.json.gz')
  writeJson('themes.json', { byAnilistId: themes.byAnilistId || {} })
  console.log(`  anime.json ${anime.length} records, themes for ${Object.keys(themes.byAnilistId || {}).length} anime`)

  const sources = sourceIdsOf(anime)
  const comics = slimComics(await get('comics.json.gz'), sources)
  writeJson('linked-comics.json', comics)
  console.log(`  linked-comics.json ${comics.length} source works`)
  return { anime, sources, get }
}

async function pullSister(tmp, animeIds) {
  const bucket = config.r2.dataBucket
  const optional = async (name, empty) => {
    const file = await fetchOptional(bucket, `latest/${name}`, tmp)
    if (!file) {
      console.log(`  ${bucket}/latest/${name} is missing; building without it`)
      return empty
    }
    return readJson(file)
  }
  const credits = slimCredits(await optional('credits.json', {}), animeIds)
  writeJson('credits.json', credits)
  const named = namedIn(credits)
  const staff = slimStaff(await optional('staff.json', {}), named.people)
  writeJson('staff.json', staff)
  const airing = await optional('airing.json', { schedule: [], history: {}, incomplete: {} })
  writeJson('airing.json', airing)
  console.log(
    `sister data: credits for ${Object.keys(credits).length} anime, ${Object.keys(staff).length} of ` +
      `${named.people.size} named people, airing history for ${Object.keys(airing.history || {}).length} anime`,
  )
  return named
}

async function pullState(tmp) {
  const bucket = config.r2.dataBucket
  const registryFile = await fetchOptional(bucket, `${STATE}slug-registry.json`, tmp)
  const manifestFile = await fetchOptional(bucket, `${STATE}live-manifest.json`, tmp)
  const live = manifestFile ? readJson(manifestFile) : null
  if (live) writeJson('live-manifest.json', live)

  if (registryFile) {
    const registry = readJson(registryFile)
    writeJson('slug-registry.json', registry)
    writeJson('state-pulled.json', { registryEntries: registrySize(registry) })
    console.log(`site state: registry with ${registrySize(registry)} entries`)
    return
  }
  if (live?.slugs?.entries && process.env.ACCEPT_REGISTRY !== '1') {
    fail(
      `The slug registry is LOST: the live site was built from one with ${live.slugs.entries} entries, ` +
        `and ${bucket}/${STATE}slug-registry.json is gone. Nothing was built. Restore it, or run with ` +
        'ACCEPT_REGISTRY=1 to start a new one on purpose.',
    )
  }
  // A local registry is kept only when R2 has never held one (a first build
  // on this machine, before any deploy). CI never has a local one.
  const local = existsSync(join(DATA, 'slug-registry.json'))
  writeJson('state-pulled.json', { registryEntries: 0 })
  console.log(`site state: no registry in R2${local ? '; keeping the local one' : '; the build starts a new one'}`)
}

async function pull() {
  mkdirSync(DATA, { recursive: true })
  const tmp = mkdtempSync(join(tmpdir(), 'where-data-'))
  try {
    const { anime, sources, get } = await pullCatalog(tmp)
    const animeIds = anime.map((item) => item.id)
    const named = await pullSister(tmp, animeIds)

    const cast = slimCast(await get('characters.json.gz'), named.characters)
    writeJson('cast.json', cast)
    const home = slimHomeRegistry(await get('slug-registry.json.gz'), [...animeIds, ...sources], named.characters)
    writeJson('home-registry.json', home)
    console.log(`  cast.json ${Object.keys(cast).length} characters; home addresses for ${Object.keys(home.t).length} titles, ${Object.keys(home.c).length} characters`)

    await pullState(tmp)
  } finally {
    rmSync(tmp, { recursive: true, force: true })
  }
}

function push() {
  if (process.env.PUSH !== '1') fail('push writes R2; set PUSH=1 (CI does, after a deploy)')
  const registryFile = join(DATA, 'slug-registry.json')
  if (!existsSync(registryFile) || !existsSync(MANIFEST)) fail('nothing to push: build the site first')
  const entries = registrySize(readJson(registryFile))
  const pulled = existsSync(PULLED) ? readJson(PULLED).registryEntries : 0
  if (entries < pulled) fail(`refusing to push a registry of ${entries} entries over R2's ${pulled}: it only ever grows`)
  putObject(config.r2.dataBucket, `${STATE}slug-registry.json`, registryFile)
  putObject(config.r2.dataBucket, `${STATE}live-manifest.json`, MANIFEST)
  console.log(`pushed ${config.r2.dataBucket}/${STATE}: registry (${entries} entries) and live-manifest.json`)
}

const mode = process.argv[2]
if (!config.r2.dataBucket || !config.r2.statePrefix) fail('site.config needs r2.dataBucket and r2.statePrefix')
if (mode === 'pull') {
  pull().catch((error) => fail(`pull failed: ${error.message}`))
} else if (mode === 'push') {
  push()
} else {
  fail('usage: node scripts/where-data.mjs pull|push')
}
