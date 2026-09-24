#!/usr/bin/env node
/**
 * AIRING WALK. When an episode airs, for every anime in the shared catalog
 * (docs/PLAN.md section 2.0). Shared across all four sister sites, so it
 * runs from packages/core, not from a site's folder.
 *
 * Two things live in airing.json:
 *   schedule   every episode airing +/-60 days of now, across all of AniList
 *              (the countdown strip, the this-week view). Refetched whole,
 *              every run: it is a rolling window, not an archive, so there is
 *              nothing to merge it with.
 *   history    the full dated episode list for anime worth a page for it:
 *              RELEASING (refreshed every night), or FINISHED within three
 *              years and under 200 episodes either way
 *              (scripts/sister-airing.mjs's eligibleForHistory). Merged: a
 *              title's rows stay once fetched and are only replaced, never
 *              dropped.
 *
 * Writes packages/core/data/sister/{airing.json,airing-refresh-walk.json},
 * and, with PUSH=1, the same two files plus meta.json to R2
 * sister-data/latest/.
 *
 * Modes (see scripts/sister-cli.mjs for how they are read):
 *   delta          (default; the nightly job) the window, RELEASING history,
 *                  and a small trickle backfill (AIRING_BACKFILL ids, default
 *                  200) of eligible titles history has never covered -- so
 *                  the one-time finished-anime backfill completes over the
 *                  first several nights without its own workflow.
 *   full-refresh   a slice of every eligible id, walked forward every run
 *                  regardless of what history already holds. Position kept in
 *                  airing-refresh-walk.json.
 *
 * A title whose airingSchedule runs past HISTORY_PER_PAGE (200) rows -- rare,
 * since the 200-episode gate already excludes most of them -- gets a small
 * number of follow-up single-id calls for the rest, outside the main batch.
 *
 *   MAX_CALLS=n   hard ceiling on history-fetch API calls this run, on top of
 *                 the window fetch (default 200 for delta, 800 for full-refresh)
 *   AIRING_BACKFILL=n   the delta trickle size (default 200)
 *
 * SITE_CONFIG must name any one site's site.config.mjs (see src/lib/site.mjs
 * and scripts/ingest-credits.mjs's own note on this).
 *
 *   SITE_CONFIG=../../sites/anime/site.config.mjs node scripts/ingest-airing.mjs
 *   PUSH=1 SITE_CONFIG=../../sites/anime/site.config.mjs node scripts/ingest-airing.mjs
 *   SITE_CONFIG=../../sites/anime/site.config.mjs node scripts/ingest-airing.mjs --limit=50
 *   MODE=full-refresh SITE_CONFIG=../../sites/anime/site.config.mjs node scripts/ingest-airing.mjs
 */
import { existsSync, mkdirSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'
import { gql, sleep, REQUEST_DELAY_MS, IDS_PER_CALL, writeJsonAtomic } from './anilist-core.mjs'
import {
  WINDOW_QUERY, HISTORY_QUERY, HISTORY_PER_PAGE,
  shapeWindowRow, sortWindow, shapeHistoryRows, windowRange,
  isReleasing, eligibleForHistory, mergeHistory, mergeIncomplete, selectDeltaIds,
} from './sister-airing.mjs'
import { nextSlice, loadWalkState, advanceWalkState } from './sister-walk.mjs'
import { airingHealth, checkCoverage, checkIncomplete } from './sister-health.mjs'
import { pullCatalogTitles, pullSisterFile, pushSisterFiles, haveCredentials, DATA_BUCKET } from './sister-data-io.mjs'
import { readOptions } from './sister-cli.mjs'

const CORE_ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..')
const OUT_DIR = join(CORE_ROOT, 'data', 'sister')
const AIRING_FILE = join(OUT_DIR, 'airing.json')
const WALK_FILE = join(OUT_DIR, 'airing-refresh-walk.json')

const opts = readOptions(process.argv.slice(2), process.env)
const MAX_CALLS = Number(process.env.MAX_CALLS) || (opts.mode === 'full-refresh' ? 800 : 200)
const BACKFILL_SIZE = Number(process.env.AIRING_BACKFILL) || 200
const WINDOW_MAX_PAGES = 100

// A rare title runs past HISTORY_PER_PAGE rows in the batched query; the
// follow-up asks for it alone, page by page.
const PER_ID_HISTORY_QUERY = `query ($id: Int, $page: Int) {
  Media(id: $id, type: ANIME) {
    airingSchedule(page: $page, perPage: ${HISTORY_PER_PAGE}) {
      pageInfo { hasNextPage }
      nodes { airingAt episode }
    }
  }
}`

function readJsonOr(file, fallback) {
  if (!existsSync(file)) return fallback
  try {
    return JSON.parse(readFileSync(file, 'utf8'))
  } catch {
    return fallback
  }
}

/** The +/-60 day window, paged until AniList says there is no more. */
async function fetchWindow() {
  const { from, to } = windowRange(Date.now())
  const rows = []
  let calls = 0
  for (let page = 1; page <= WINDOW_MAX_PAGES; page++) {
    let data
    try {
      data = await gql(WINDOW_QUERY, { page, from, to })
    } catch (error) {
      console.warn(`  window page ${page} failed: ${error.message}. stopping this sweep.`)
      break
    }
    calls++
    const chunk = data?.Page?.airingSchedules || []
    rows.push(...chunk.map(shapeWindowRow))
    const hasNext = data?.Page?.pageInfo?.hasNextPage
    if (page % 10 === 0 || !hasNext) console.log(`  window page ${page}: ${chunk.length} rows`)
    if (!hasNext) break
    await sleep(REQUEST_DELAY_MS)
  }
  return { rows: sortWindow(rows), from, to, calls }
}

/** Per-anime episode history for `ids`, batched like every other AniList walk here. */
async function fetchHistory(ids, budget) {
  const byId = new Map()
  const overflow = []
  let calls = 0
  for (let i = 0; i < ids.length; i += IDS_PER_CALL) {
    if (calls >= budget) {
      console.log(`  history: call budget (${budget}) used up at ${i}/${ids.length}; the rest waits for the next run.`)
      break
    }
    const batch = ids.slice(i, i + IDS_PER_CALL)
    let data
    try {
      data = await gql(HISTORY_QUERY, { ids: batch })
    } catch (error) {
      console.warn(`  history batch at ${i} failed (${error.message}). skipping it.`)
      await sleep(REQUEST_DELAY_MS)
      continue
    }
    calls++
    for (const media of data?.Page?.media || []) {
      const connection = media.airingSchedule
      byId.set(media.id, shapeHistoryRows(connection?.nodes))
      if (connection?.pageInfo?.hasNextPage) overflow.push(media.id)
    }
    const done = Math.min(i + IDS_PER_CALL, ids.length)
    if (done % 500 === 0 || done === ids.length) console.log(`  history ${done}/${ids.length}`)
    await sleep(REQUEST_DELAY_MS)
  }
  return { byId, overflow, calls }
}

/**
 * The rest of a title's schedule past HISTORY_PER_PAGE rows, one id at a
 * time. Returns { calls, incompleteIds }: an id lands in `incompleteIds`
 * when its paging did not reach the end this run -- a failed page, or the
 * call budget running out before or during its turn -- so `byId` is left
 * holding a truncated history for it and the caller must not record it as
 * complete (see sister-airing.mjs's mergeIncomplete).
 */
async function fetchOverflow(ids, byId, budget, spent) {
  let calls = spent
  const incompleteIds = []
  for (let i = 0; i < ids.length; i++) {
    const id = ids[i]
    if (calls >= budget) {
      // Budget is gone: this id and every one after it stays truncated.
      incompleteIds.push(...ids.slice(i))
      break
    }
    let rows = byId.get(id) || []
    let complete = false
    for (let page = 2; ; page++) {
      if (calls >= budget) break
      let data
      try {
        data = await gql(PER_ID_HISTORY_QUERY, { id, page })
      } catch (error) {
        console.warn(`  overflow id ${id} page ${page} failed (${error.message}). stopping there.`)
        break
      }
      calls++
      const connection = data?.Media?.airingSchedule
      rows = rows.concat(shapeHistoryRows(connection?.nodes))
      await sleep(REQUEST_DELAY_MS)
      if (!connection?.pageInfo?.hasNextPage) {
        complete = true
        break
      }
    }
    byId.set(id, [...rows].sort((a, b) => a.at - b.at))
    if (!complete) incompleteIds.push(id)
  }
  return { calls, incompleteIds }
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true })

  console.log('Pulling the shared catalog (read only)...')
  const catalog = await pullCatalogTitles()
  const anime = catalog.filter((r) => r.kind === 'anime')
  console.log(`  ${catalog.length} titles, ${anime.length} anime.`)

  const nowYear = new Date().getFullYear()
  const eligibleIds = anime.filter((a) => eligibleForHistory(a, nowYear)).map((a) => a.id)
  const releasingIds = anime.filter(isReleasing).map((a) => a.id)
  console.log(`${eligibleIds.length} anime earn a history page (${releasingIds.length} RELEASING).`)

  let existing = readJsonOr(AIRING_FILE, { schedule: [], history: {}, incomplete: {} })
  let walkRaw = readJsonOr(WALK_FILE, null)
  let prevMeta = null
  if (haveCredentials()) {
    console.log('Pulling the existing sister-data snapshot (read only)...')
    prevMeta = await pullSisterFile('meta.json', OUT_DIR)
    const files = prevMeta?.files || []
    if (files.includes('airing.json')) existing = (await pullSisterFile('airing.json', OUT_DIR)) ?? existing
    if (files.includes('airing-refresh-walk.json')) walkRaw = (await pullSisterFile('airing-refresh-walk.json', OUT_DIR)) ?? walkRaw
  } else {
    console.log('No CLOUDFLARE_API_TOKEN/CLOUDFLARE_ACCOUNT_ID: starting from the local copy only.')
  }
  const existingHistory = existing.history || {}
  const existingIncomplete = existing.incomplete || {}

  let ids
  let walkState = loadWalkState(walkRaw)
  if (opts.ids) {
    ids = opts.ids
    console.log(`Explicit ids: ${ids.length}.`)
  } else if (opts.mode === 'full-refresh') {
    const sortedIds = [...eligibleIds].sort((a, b) => a - b)
    const slice = nextSlice(sortedIds, walkState.next, MAX_CALLS * IDS_PER_CALL)
    ids = slice.ids
    walkState = advanceWalkState(walkState, slice)
    console.log(`full-refresh slice: ${ids.length} id(s), next run resumes at ${walkState.next}${slice.wrapped ? ' (cycle wrapped)' : ''}.`)
  } else {
    const selection = selectDeltaIds(eligibleIds, releasingIds, existingHistory, existingIncomplete, BACKFILL_SIZE)
    ids = selection.ids
    console.log(
      `delta: ${releasingIds.length} RELEASING + a trickle of up to ${BACKFILL_SIZE} ` +
        `of ${selection.missingCount} still missing or incomplete.`
    )
  }
  if (opts.limit) ids = ids.slice(0, opts.limit)

  const startedAt = Date.now()
  const window = await fetchWindow()
  const { byId: historyById, overflow, calls: historyCalls } = ids.length
    ? await fetchHistory(ids, MAX_CALLS)
    : { byId: new Map(), overflow: [], calls: 0 }
  let totalCalls = window.calls + historyCalls
  let overflowIncompleteIds = []
  if (overflow.length) {
    console.log(`  ${overflow.length} title(s) ran past ${HISTORY_PER_PAGE} rows; fetching the rest one at a time.`)
    const result = await fetchOverflow(overflow, historyById, MAX_CALLS, historyCalls)
    totalCalls = result.calls + window.calls
    overflowIncompleteIds = result.incompleteIds
    if (overflowIncompleteIds.length) {
      console.log(`  ${overflowIncompleteIds.length} of those stayed truncated (a failed page or the call budget ran out).`)
    }
  }
  const seconds = Math.round((Date.now() - startedAt) / 1000)

  const nextHistory = mergeHistory(existingHistory, historyById)
  const nextIncomplete = mergeIncomplete(existingIncomplete, [...historyById.keys()], overflowIncompleteIds)
  const nextAiring = {
    window: { from: window.from, to: window.to },
    schedule: window.rows,
    history: nextHistory,
    incomplete: nextIncomplete,
  }

  writeJsonAtomic(AIRING_FILE, nextAiring)
  writeJsonAtomic(WALK_FILE, walkState)

  const health = airingHealth(nextHistory, releasingIds, nextIncomplete)
  console.log(
    `airing.json: ${window.rows.length} schedule row(s), ${health.count} title(s) with history ` +
      `(${health.incompleteCount} incomplete, ${(health.incompleteShare * 100).toFixed(1)}%), ` +
      `${(health.releasingCoverage * 100).toFixed(1)}% of RELEASING anime covered. ${historyById.size} fetched, ${totalCalls} calls, ${seconds}s.`
  )

  if (!opts.push) {
    console.log('PUSH is not 1: wrote local files only, nothing sent to R2.')
    return
  }
  if (!haveCredentials()) throw new Error('PUSH=1 but CLOUDFLARE_API_TOKEN/CLOUDFLARE_ACCOUNT_ID are not set.')

  const problems = [
    ...checkCoverage('airing.json', 'releasingCoverage', health, prevMeta?.health?.['airing.json'] || null),
    ...checkIncomplete('airing.json', health),
  ]
  if (problems.length) throw new Error(`PUSH REFUSED, nothing uploaded:\n  - ${problems.join('\n  - ')}`)

  const meta = {
    savedAt: new Date().toISOString(),
    runId: process.env.GITHUB_RUN_ID || 'local',
    workflow: process.env.GITHUB_WORKFLOW || 'local',
    mode: opts.mode,
    files: [...new Set([...(prevMeta?.files || []), 'airing.json', 'airing-refresh-walk.json'])],
    health: { ...(prevMeta?.health || {}), 'airing.json': health },
  }
  pushSisterFiles(OUT_DIR, { 'airing.json': nextAiring, 'airing-refresh-walk.json': walkState }, meta)
  console.log(`Pushed to ${DATA_BUCKET}/latest/.`)
}

main().catch((error) => {
  console.error('INGEST AIRING FAILED:', error.message)
  process.exit(1)
})
