#!/usr/bin/env node
/**
 * CREDITS WALK. Every title's staff, studios and cast, ids only
 * (docs/PLAN.md section 2.0). Shared across all four sister sites; nothing
 * here is scoped to one of them, so it runs from packages/core, not from a
 * site's folder.
 *
 * Writes packages/core/data/sister/{credits.json,credits-seen.json,
 * credits-refresh-walk.json}, and, with PUSH=1, the same three files plus
 * meta.json to R2 sister-data/latest/. Never writes the shared catalog's own
 * bucket: that one is pulled read only (scripts/sister-data-io.mjs).
 *
 * Modes (see scripts/sister-cli.mjs for how they are read):
 *   delta          (default; the nightly job) every id whose catalog
 *                  `updatedAt` moved since credits-seen.json last recorded
 *                  it, or that credits-seen.json has never seen. Costs no
 *                  AniList probe call: the pulled catalog already carries
 *                  `updatedAt` for every id (scripts/sister-credits.mjs).
 *   full-refresh   (the weekly job) a slice of the WHOLE catalog id space,
 *                  walked forward every run regardless of updatedAt --
 *                  insurance against a credit changing without updatedAt
 *                  moving. Position kept in credits-refresh-walk.json.
 *
 *   MAX_CALLS=n   hard ceiling on API calls this run
 *                 (default 300 for delta, 1200 for full-refresh)
 *
 * SITE_CONFIG must name any one site's site.config.mjs (see src/lib/site.mjs):
 * every site's r2.catalogBucket and r2.dataBucket point at the same two
 * buckets (sites/family.mjs), so which one is named does not matter, but one
 * must be named for this script to know which buckets to use.
 *
 *   SITE_CONFIG=../../sites/anime/site.config.mjs node scripts/ingest-credits.mjs
 *   PUSH=1 SITE_CONFIG=../../sites/anime/site.config.mjs node scripts/ingest-credits.mjs
 *   SITE_CONFIG=../../sites/anime/site.config.mjs node scripts/ingest-credits.mjs --limit=100
 *   MODE=full-refresh SITE_CONFIG=../../sites/anime/site.config.mjs node scripts/ingest-credits.mjs
 */
import { existsSync, mkdirSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'
import { gql, sleep, REQUEST_DELAY_MS, IDS_PER_CALL, writeJsonAtomic } from './anilist-core.mjs'
import { CREDITS_QUERY, shapeCredits, selectDelta, mergeSeen, mergeCredits } from './sister-credits.mjs'
import { nextSlice, loadWalkState, advanceWalkState } from './sister-walk.mjs'
import { creditsHealth, checkCoverage } from './sister-health.mjs'
import { pullCatalogTitles, pullSisterFile, pushSisterFiles, haveCredentials, DATA_BUCKET } from './sister-data-io.mjs'
import { readOptions } from './sister-cli.mjs'

// This script is shared and is not built from any site's folder, so its
// output lives next to it rather than in a per-site data/ (see anilist-core.mjs).
const CORE_ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..')
const OUT_DIR = join(CORE_ROOT, 'data', 'sister')
const CREDITS_FILE = join(OUT_DIR, 'credits.json')
const SEEN_FILE = join(OUT_DIR, 'credits-seen.json')
const WALK_FILE = join(OUT_DIR, 'credits-refresh-walk.json')

const opts = readOptions(process.argv.slice(2), process.env)
const MAX_CALLS = Number(process.env.MAX_CALLS) || (opts.mode === 'full-refresh' ? 1200 : 300)

function readJsonOr(file, fallback) {
  if (!existsSync(file)) return fallback
  try {
    return JSON.parse(readFileSync(file, 'utf8'))
  } catch {
    return fallback
  }
}

/** Fetch credits for `ids`, 50 at a time, paced and retried like every other AniList walk here. */
async function fetchCredits(ids) {
  const byId = new Map()
  let calls = 0
  for (let i = 0; i < ids.length; i += IDS_PER_CALL) {
    if (calls >= MAX_CALLS) {
      console.log(`  call budget (${MAX_CALLS}) used up at ${i}/${ids.length}; the rest waits for the next run.`)
      break
    }
    const batch = ids.slice(i, i + IDS_PER_CALL)
    let data
    try {
      data = await gql(CREDITS_QUERY, { ids: batch })
    } catch (error) {
      console.warn(`  batch at ${i} failed (${error.message}). skipping it.`)
      await sleep(REQUEST_DELAY_MS)
      continue
    }
    calls++
    for (const media of data?.Page?.media || []) byId.set(media.id, shapeCredits(media))
    const done = Math.min(i + IDS_PER_CALL, ids.length)
    if (done % 500 === 0 || done === ids.length) console.log(`  ${done}/${ids.length}`)
    await sleep(REQUEST_DELAY_MS)
  }
  return { byId, calls }
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true })

  console.log('Pulling the shared catalog (read only)...')
  const catalog = await pullCatalogTitles()
  const catalogById = new Map(catalog.map((r) => [r.id, r]))
  console.log(`  ${catalog.length} titles.`)

  let existing = readJsonOr(CREDITS_FILE, {})
  let seenRaw = readJsonOr(SEEN_FILE, {})
  let walkRaw = readJsonOr(WALK_FILE, null)
  let prevMeta = null
  if (haveCredentials()) {
    console.log('Pulling the existing sister-data snapshot (read only)...')
    prevMeta = await pullSisterFile('meta.json', OUT_DIR)
    const files = prevMeta?.files || []
    if (files.includes('credits.json')) existing = (await pullSisterFile('credits.json', OUT_DIR)) ?? existing
    if (files.includes('credits-seen.json')) seenRaw = (await pullSisterFile('credits-seen.json', OUT_DIR)) ?? seenRaw
    if (files.includes('credits-refresh-walk.json')) walkRaw = (await pullSisterFile('credits-refresh-walk.json', OUT_DIR)) ?? walkRaw
  } else {
    console.log('No CLOUDFLARE_API_TOKEN/CLOUDFLARE_ACCOUNT_ID: starting from the local copy only.')
  }
  const seen = new Map(Object.entries(seenRaw).map(([id, at]) => [Number(id), at]))

  let ids
  let walkState = loadWalkState(walkRaw)
  if (opts.ids) {
    ids = opts.ids
    console.log(`Explicit ids: ${ids.length}.`)
  } else if (opts.mode === 'full-refresh') {
    const sortedIds = [...catalogById.keys()].sort((a, b) => a - b)
    const slice = nextSlice(sortedIds, walkState.next, MAX_CALLS * IDS_PER_CALL)
    ids = slice.ids
    walkState = advanceWalkState(walkState, slice)
    console.log(`full-refresh slice: ${ids.length} id(s), next run resumes at ${walkState.next}${slice.wrapped ? ' (cycle wrapped)' : ''}.`)
  } else {
    ids = selectDelta(catalog, seen)
    console.log(`delta: ${ids.length} id(s) new or changed since credits-seen.json.`)
  }
  if (opts.limit) ids = ids.slice(0, opts.limit)

  const startedAt = Date.now()
  const { byId, calls } = ids.length ? await fetchCredits(ids) : { byId: new Map(), calls: 0 }
  const seconds = Math.round((Date.now() - startedAt) / 1000)

  const nextCredits = mergeCredits(existing, byId)
  const nextSeen = mergeSeen(seen, catalogById, byId.keys())
  const nextSeenRaw = Object.fromEntries(nextSeen)

  writeJsonAtomic(CREDITS_FILE, nextCredits)
  writeJsonAtomic(SEEN_FILE, nextSeenRaw)
  writeJsonAtomic(WALK_FILE, walkState)

  const health = creditsHealth(nextCredits, [...catalogById.keys()])
  console.log(
    `credits.json: ${health.count} titles, ${(health.coverage * 100).toFixed(1)}% of the catalog. ` +
      `${byId.size} fetched, ${calls} calls, ${seconds}s.`
  )

  if (!opts.push) {
    console.log('PUSH is not 1: wrote local files only, nothing sent to R2.')
    return
  }
  if (!haveCredentials()) throw new Error('PUSH=1 but CLOUDFLARE_API_TOKEN/CLOUDFLARE_ACCOUNT_ID are not set.')

  const problems = checkCoverage('credits.json', 'coverage', health, prevMeta?.health?.['credits.json'] || null)
  if (problems.length) throw new Error(`PUSH REFUSED, nothing uploaded:\n  - ${problems.join('\n  - ')}`)

  const meta = {
    savedAt: new Date().toISOString(),
    runId: process.env.GITHUB_RUN_ID || 'local',
    workflow: process.env.GITHUB_WORKFLOW || 'local',
    mode: opts.mode,
    files: [...new Set([...(prevMeta?.files || []), 'credits.json', 'credits-seen.json', 'credits-refresh-walk.json'])],
    health: { ...(prevMeta?.health || {}), 'credits.json': health },
  }
  pushSisterFiles(OUT_DIR, { 'credits.json': nextCredits, 'credits-seen.json': nextSeenRaw, 'credits-refresh-walk.json': walkState }, meta)
  console.log(`Pushed to ${DATA_BUCKET}/latest/.`)
}

main().catch((error) => {
  console.error('INGEST CREDITS FAILED:', error.message)
  process.exit(1)
})
