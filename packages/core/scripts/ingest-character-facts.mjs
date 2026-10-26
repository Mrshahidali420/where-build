#!/usr/bin/env node
/**
 * CHARACTER FACTS WALK. Gender, age, birthday, blood type, height,
 * favourites and a short bio for every character a cast table of the site
 * named by SITE_CONFIG can show (its owned titles: the credits walk's cast
 * rows, else the catalog's own list). They fill the characters pages
 * (/anime/<slug>/characters, src/where/characters.mjs).
 *
 * Not scripts/ingest-characters.mjs: that one is the home site's walk over
 * the whole character id space, with its own catalog files.
 *
 * Writes packages/core/data/sister/characters.json, and, with PUSH=1, the same
 * file plus meta.json to R2 sister-data/latest/ (scripts/sister-data-io.mjs).
 * Reads the shared catalog's anime.json and credits.json read only.
 *
 * Which ids: never fetched first, then the ones checked more than 90 days
 * ago. A row fetched within 90 days is never asked for again
 * (scripts/sister-characters.mjs selectToFetch). So the first runs fill the
 * file and every later run only asks for new and stale ids.
 *
 * AniList sometimes answers 403 for hours. gql() already retries each call;
 * after two batches in a row fail anyway, the run stops, saves what it got
 * and pushes it, and the next run carries on.
 *
 *   MAX_CALLS=n   hard ceiling on API calls this run (default 300)
 *   LIMIT=n / IDS=1,2,3   as every sister script (scripts/sister-cli.mjs)
 *   ANIME_FILE=path       a local anime.json to read when there are no R2
 *                         credentials (a local test run)
 *
 *   SITE_CONFIG=../../sites/<site>/site.config.mjs node scripts/ingest-character-facts.mjs
 *   PUSH=1 SITE_CONFIG=... node scripts/ingest-character-facts.mjs
 */
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'
import { gunzipSync } from 'node:zlib'
import { gql, sleep, REQUEST_DELAY_MS, IDS_PER_CALL, writeJsonAtomic } from './anilist-core.mjs'
import { CHARACTER_FACTS_QUERY, shapeFacts, ownedCharacterIds, selectToFetch, mergeFacts, FRESH_DAYS } from './sister-characters.mjs'
import { pullObject, pullSisterFile, pushSisterFiles, haveCredentials, CATALOG_BUCKET, DATA_BUCKET } from './sister-data-io.mjs'
import { readOptions } from './sister-cli.mjs'
import config from '../src/lib/site.mjs'

const CORE_ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..')
const OUT_DIR = join(CORE_ROOT, 'data', 'sister')
const FACTS_FILE = join(OUT_DIR, 'characters.json')
const CREDITS_FILE = join(OUT_DIR, 'credits.json')

const opts = readOptions(process.argv.slice(2), process.env)
const MAX_CALLS = Number(process.env.MAX_CALLS) || 300
/** Batches in a row that may fail before the run stops (AniList's long 403 spells). */
const MAX_FAILED_IN_A_ROW = 2

function readJsonOr(file, fallback) {
  if (!existsSync(file)) return fallback
  try {
    return JSON.parse(readFileSync(file, 'utf8'))
  } catch {
    return fallback
  }
}

/** The catalog's anime.json, read only (only the anime file: comics are not needed). */
async function pullCatalogAnime() {
  const dir = mkdtempSync(join(tmpdir(), 'char-facts-'))
  try {
    const file = join(dir, 'anime.json.gz')
    await pullObject(CATALOG_BUCKET, 'latest/anime.json.gz', file)
    return JSON.parse(gunzipSync(readFileSync(file)).toString('utf8'))
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

/**
 * The facts for `ids`, 50 per call. Returns the rows by id, the ids of the
 * calls that worked (only those may be marked as checked), the call count and
 * why it stopped early, if it did.
 */
async function fetchFacts(ids, today) {
  const byId = new Map()
  const asked = []
  let calls = 0
  let failedInARow = 0
  let stopped = ''
  for (let i = 0; i < ids.length; i += IDS_PER_CALL) {
    if (calls >= MAX_CALLS) {
      stopped = `call budget (${MAX_CALLS}) used up at ${i}/${ids.length}; the rest waits for the next run`
      break
    }
    const batch = ids.slice(i, i + IDS_PER_CALL)
    calls++
    let data
    try {
      data = await gql(CHARACTER_FACTS_QUERY, { ids: batch })
    } catch (error) {
      failedInARow++
      console.warn(`  batch at ${i} failed (${error.message}).`)
      if (failedInARow >= MAX_FAILED_IN_A_ROW) {
        stopped = `${failedInARow} batches in a row failed; stopping cleanly, the next run carries on`
        break
      }
      await sleep(REQUEST_DELAY_MS)
      continue
    }
    failedInARow = 0
    asked.push(...batch)
    for (const node of data?.Page?.characters || []) byId.set(node.id, shapeFacts(node, today))
    const done = Math.min(i + IDS_PER_CALL, ids.length)
    if (done % 2500 === 0 || done === ids.length) console.log(`  ${done}/${ids.length}`)
    await sleep(REQUEST_DELAY_MS)
  }
  return { byId, asked, calls, stopped }
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true })
  const today = new Date().toISOString().slice(0, 10)

  let anime
  let creditsById = readJsonOr(CREDITS_FILE, {})
  let existing = readJsonOr(FACTS_FILE, {})
  if (haveCredentials()) {
    console.log('Pulling the catalog anime, credits.json and characters.json (read only)...')
    anime = await pullCatalogAnime()
    const meta = await pullSisterFile('meta.json', OUT_DIR)
    if (meta?.files?.includes('credits.json')) creditsById = (await pullSisterFile('credits.json', OUT_DIR)) ?? creditsById
    // A failed pull throws, so a run never pushes a fresh file over a full one it could not read.
    existing = (await pullSisterFile('characters.json', OUT_DIR)) ?? {}
  } else {
    if (!process.env.ANIME_FILE) throw new Error('No CLOUDFLARE_API_TOKEN/CLOUDFLARE_ACCOUNT_ID: set ANIME_FILE to a local anime.json.')
    console.log('No R2 credentials: reading ANIME_FILE and the local copies only.')
    anime = JSON.parse(readFileSync(process.env.ANIME_FILE, 'utf8'))
  }

  const wanted = ownedCharacterIds(config, anime, creditsById)
  const pick = selectToFetch(wanted, existing, today)
  let ids = opts.ids || pick.ids
  if (opts.limit) ids = ids.slice(0, opts.limit)
  console.log(
    `${wanted.length} characters in the cast tables; ${pick.missing.length} never fetched, ` +
      `${pick.stale.length} older than ${FRESH_DAYS} days. Asking for ${ids.length} (at most ${MAX_CALLS} calls).`,
  )

  const startedAt = Date.now()
  const { byId, asked, calls, stopped } = ids.length ? await fetchFacts(ids, today) : { byId: new Map(), asked: [], calls: 0, stopped: '' }
  if (stopped) console.log(`  ${stopped}.`)
  const seconds = Math.round((Date.now() - startedAt) / 1000)

  const next = mergeFacts(existing, byId, asked, today)
  writeJsonAtomic(FACTS_FILE, next)

  const stillMissing = selectToFetch(wanted, next, today)
  console.log(
    `characters.json: ${Object.keys(next).length} rows. Asked ${ids.length}, gained ${byId.size} ` +
      `(${calls} calls, ${seconds}s). Still missing ${stillMissing.missing.length}, stale ${stillMissing.stale.length}.`,
  )

  if (!opts.push) {
    console.log('PUSH is not 1: wrote the local file only, nothing sent to R2.')
    return
  }
  if (!haveCredentials()) throw new Error('PUSH=1 but CLOUDFLARE_API_TOKEN/CLOUDFLARE_ACCOUNT_ID are not set.')
  if (Object.keys(next).length < Object.keys(existing).length) throw new Error('PUSH REFUSED: characters.json would shrink.')

  // meta.json is read again right before writing it, so a credits or staff
  // run that pushed while this one was walking keeps its own entry.
  const prevMeta = await pullSisterFile('meta.json', OUT_DIR)
  const meta = {
    ...(prevMeta || {}),
    savedAt: new Date().toISOString(),
    runId: process.env.GITHUB_RUN_ID || 'local',
    workflow: process.env.GITHUB_WORKFLOW || 'local',
    mode: 'characters',
    files: [...new Set([...(prevMeta?.files || []), 'characters.json'])],
    health: { ...(prevMeta?.health || {}), 'characters.json': { count: Object.keys(next).length, missing: stillMissing.missing.length } },
  }
  pushSisterFiles(OUT_DIR, { 'characters.json': next }, meta)
  console.log(`Pushed to ${DATA_BUCKET}/latest/.`)
}

main().catch((error) => {
  console.error('INGEST CHARACTER FACTS FAILED:', error.message)
  process.exit(1)
})
