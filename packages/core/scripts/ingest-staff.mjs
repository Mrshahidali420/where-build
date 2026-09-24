#!/usr/bin/env node
/**
 * STAFF WALK. Every person credits.json points at -- crew and voice actors
 * both, AniList's Staff type covers them the same way (docs/PLAN.md section
 * 2.0). Shared across all four sister sites, so it runs from packages/core,
 * not from a site's folder.
 *
 * Writes packages/core/data/sister/{staff.json,staff-refresh-walk.json}, and,
 * with PUSH=1, the same two files plus meta.json to R2 sister-data/latest/.
 * Reads credits.json (pulled read only, or the local copy
 * scripts/ingest-credits.mjs already wrote) to know which ids exist; never
 * writes it.
 *
 * Modes (see scripts/sister-cli.mjs for how they are read):
 *   delta          (default; runs inside the nightly credits job) every
 *                  staff id credits.json points at that staff.json does not
 *                  hold yet. A person already on file is not touched: there
 *                  is no per-person updatedAt to compare against, so freshness
 *                  is full-refresh's job.
 *   full-refresh   (the weekly job) a slice of every id credits.json has ever
 *                  pointed at, walked forward every run so a changed bio,
 *                  photo or work list eventually reaches staff.json even
 *                  though nothing tells this script it changed. Position kept
 *                  in staff-refresh-walk.json.
 *
 *   MAX_CALLS=n   hard ceiling on API calls this run
 *                 (default 300 for delta, 1000 for full-refresh)
 *
 * SITE_CONFIG must name any one site's site.config.mjs (see src/lib/site.mjs
 * and scripts/ingest-credits.mjs's own note on this).
 *
 *   SITE_CONFIG=../../sites/anime/site.config.mjs node scripts/ingest-staff.mjs
 *   PUSH=1 SITE_CONFIG=../../sites/anime/site.config.mjs node scripts/ingest-staff.mjs
 *   SITE_CONFIG=../../sites/anime/site.config.mjs node scripts/ingest-staff.mjs --limit=100
 *   MODE=full-refresh SITE_CONFIG=../../sites/anime/site.config.mjs node scripts/ingest-staff.mjs
 */
import { existsSync, mkdirSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'
import { gql, sleep, REQUEST_DELAY_MS, IDS_PER_CALL, writeJsonAtomic } from './anilist-core.mjs'
import { STAFF_QUERY, shapeStaff, referencedStaffIds, selectNew, mergeStaff } from './sister-staff.mjs'
import { nextSlice, loadWalkState, advanceWalkState } from './sister-walk.mjs'
import { staffHealth, checkCoverage } from './sister-health.mjs'
import { pullSisterFile, pushSisterFiles, haveCredentials, DATA_BUCKET } from './sister-data-io.mjs'
import { readOptions } from './sister-cli.mjs'

const CORE_ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..')
const OUT_DIR = join(CORE_ROOT, 'data', 'sister')
const CREDITS_FILE = join(OUT_DIR, 'credits.json')
const STAFF_FILE = join(OUT_DIR, 'staff.json')
const WALK_FILE = join(OUT_DIR, 'staff-refresh-walk.json')

const opts = readOptions(process.argv.slice(2), process.env)
const MAX_CALLS = Number(process.env.MAX_CALLS) || (opts.mode === 'full-refresh' ? 1000 : 300)

function readJsonOr(file, fallback) {
  if (!existsSync(file)) return fallback
  try {
    return JSON.parse(readFileSync(file, 'utf8'))
  } catch {
    return fallback
  }
}

async function fetchStaff(ids) {
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
      data = await gql(STAFF_QUERY, { ids: batch })
    } catch (error) {
      console.warn(`  batch at ${i} failed (${error.message}). skipping it.`)
      await sleep(REQUEST_DELAY_MS)
      continue
    }
    calls++
    for (const node of data?.Page?.staff || []) byId.set(node.id, shapeStaff(node))
    const done = Math.min(i + IDS_PER_CALL, ids.length)
    if (done % 500 === 0 || done === ids.length) console.log(`  ${done}/${ids.length}`)
    await sleep(REQUEST_DELAY_MS)
  }
  return { byId, calls }
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true })

  let creditsById = readJsonOr(CREDITS_FILE, {})
  let existing = readJsonOr(STAFF_FILE, {})
  let walkRaw = readJsonOr(WALK_FILE, null)
  let prevMeta = null
  if (haveCredentials()) {
    console.log('Pulling the existing sister-data snapshot (read only)...')
    prevMeta = await pullSisterFile('meta.json', OUT_DIR)
    const files = prevMeta?.files || []
    if (files.includes('credits.json')) creditsById = (await pullSisterFile('credits.json', OUT_DIR)) ?? creditsById
    if (files.includes('staff.json')) existing = (await pullSisterFile('staff.json', OUT_DIR)) ?? existing
    if (files.includes('staff-refresh-walk.json')) walkRaw = (await pullSisterFile('staff-refresh-walk.json', OUT_DIR)) ?? walkRaw
  } else {
    console.log('No CLOUDFLARE_API_TOKEN/CLOUDFLARE_ACCOUNT_ID: starting from the local copy only.')
  }
  const referenced = referencedStaffIds(creditsById)
  console.log(`credits.json points at ${referenced.size} staff/voice-actor id(s).`)

  let ids
  let walkState = loadWalkState(walkRaw)
  if (opts.ids) {
    ids = opts.ids
    console.log(`Explicit ids: ${ids.length}.`)
  } else if (opts.mode === 'full-refresh') {
    const sortedIds = [...referenced].sort((a, b) => a - b)
    const slice = nextSlice(sortedIds, walkState.next, MAX_CALLS * IDS_PER_CALL)
    ids = slice.ids
    walkState = advanceWalkState(walkState, slice)
    console.log(`full-refresh slice: ${ids.length} id(s), next run resumes at ${walkState.next}${slice.wrapped ? ' (cycle wrapped)' : ''}.`)
  } else {
    ids = selectNew(referenced, existing)
    console.log(`delta: ${ids.length} id(s) referenced but not yet on file.`)
  }
  if (opts.limit) ids = ids.slice(0, opts.limit)

  const startedAt = Date.now()
  const { byId, calls } = ids.length ? await fetchStaff(ids) : { byId: new Map(), calls: 0 }
  const seconds = Math.round((Date.now() - startedAt) / 1000)

  const nextStaff = mergeStaff(existing, byId)
  writeJsonAtomic(STAFF_FILE, nextStaff)
  writeJsonAtomic(WALK_FILE, walkState)

  const health = staffHealth(nextStaff, referenced)
  console.log(
    `staff.json: ${health.count} people, ${(health.coverage * 100).toFixed(1)}% of the ids credits.json points at. ` +
      `${byId.size} fetched, ${calls} calls, ${seconds}s.`
  )

  if (!opts.push) {
    console.log('PUSH is not 1: wrote local files only, nothing sent to R2.')
    return
  }
  if (!haveCredentials()) throw new Error('PUSH=1 but CLOUDFLARE_API_TOKEN/CLOUDFLARE_ACCOUNT_ID are not set.')

  const problems = checkCoverage('staff.json', 'coverage', health, prevMeta?.health?.['staff.json'] || null)
  if (problems.length) throw new Error(`PUSH REFUSED, nothing uploaded:\n  - ${problems.join('\n  - ')}`)

  const meta = {
    savedAt: new Date().toISOString(),
    runId: process.env.GITHUB_RUN_ID || 'local',
    workflow: process.env.GITHUB_WORKFLOW || 'local',
    mode: opts.mode,
    files: [...new Set([...(prevMeta?.files || []), 'staff.json', 'staff-refresh-walk.json'])],
    health: { ...(prevMeta?.health || {}), 'staff.json': health },
  }
  pushSisterFiles(OUT_DIR, { 'staff.json': nextStaff, 'staff-refresh-walk.json': walkState }, meta)
  console.log(`Pushed to ${DATA_BUCKET}/latest/.`)
}

main().catch((error) => {
  console.error('INGEST STAFF FAILED:', error.message)
  process.exit(1)
})
