// Query building, shaping, eligibility and merging for scripts/ingest-airing.mjs.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  WINDOW_QUERY, HISTORY_QUERY,
  shapeHistoryRows, shapeWindowRow, sortWindow, windowRange,
  isReleasing, isRecentFinished, eligibleForHistory, mergeHistory,
} from '../scripts/sister-airing.mjs'

test('WINDOW_QUERY pages airingSchedules by a time range', () => {
  assert.match(WINDOW_QUERY, /airingSchedules\(airingAt_greater: \$from, airingAt_lesser: \$to, sort: TIME\)/)
})

test('HISTORY_QUERY batches media(id_in) with a paginated airingSchedule, not one call per anime', () => {
  assert.match(HISTORY_QUERY, /media\(id_in: \$ids, type: ANIME\)/)
  assert.match(HISTORY_QUERY, /airingSchedule\(perPage: 200\)/)
})

test('shapeHistoryRows drops rows with no air date and sorts by time', () => {
  const nodes = [{ airingAt: 300, episode: 3 }, { airingAt: 100, episode: 1 }, { airingAt: null, episode: 2 }]
  assert.deepEqual(shapeHistoryRows(nodes), [{ at: 100, episode: 1 }, { at: 300, episode: 3 }])
})

test('shapeWindowRow and sortWindow order by time and dedupe repeated rows', () => {
  const rows = [
    shapeWindowRow({ airingAt: 200, episode: 2, mediaId: 1 }),
    shapeWindowRow({ airingAt: 100, episode: 1, mediaId: 1 }),
    shapeWindowRow({ airingAt: 200, episode: 2, mediaId: 1 }), // repeated across a page boundary
  ]
  assert.deepEqual(sortWindow(rows), [
    { at: 100, episode: 1, mediaId: 1 },
    { at: 200, episode: 2, mediaId: 1 },
  ])
})

test('windowRange is 60 days either side of now by default', () => {
  const now = Date.UTC(2026, 0, 61) // 61 days into the year, comfortably past day 60
  const { from, to } = windowRange(now)
  assert.equal(to - from, 120 * 86400)
  assert.equal(Math.round(now / 1000) - from, 60 * 86400)
})

test('isReleasing is true only for a RELEASING anime record', () => {
  assert.equal(isReleasing({ kind: 'anime', status: 'RELEASING' }), true)
  assert.equal(isReleasing({ kind: 'anime', status: 'FINISHED' }), false)
  assert.equal(isReleasing({ kind: 'comic', status: 'RELEASING' }), false)
})

test('isRecentFinished needs an end year inside the window and an episode count under the cap', () => {
  const now = 2026
  assert.equal(isRecentFinished({ kind: 'anime', status: 'FINISHED', endYear: 2024, episodes: 12 }, now), true)
  assert.equal(isRecentFinished({ kind: 'anime', status: 'FINISHED', endYear: 2020, episodes: 12 }, now), false)
  assert.equal(isRecentFinished({ kind: 'anime', status: 'FINISHED', endYear: 2026, episodes: 900 }, now), false)
  assert.equal(isRecentFinished({ kind: 'anime', status: 'RELEASING', endYear: 2026, episodes: 12 }, now), false)
})

test('eligibleForHistory takes RELEASING under the cap or an unknown episode count', () => {
  const now = 2026
  assert.equal(eligibleForHistory({ kind: 'anime', status: 'RELEASING', episodes: null }, now), true)
  assert.equal(eligibleForHistory({ kind: 'anime', status: 'RELEASING', episodes: 900 }, now), false)
  assert.equal(eligibleForHistory({ kind: 'anime', status: 'FINISHED', endYear: 2025, episodes: 24 }, now), true)
  assert.equal(eligibleForHistory({ kind: 'anime', status: 'NOT_YET_RELEASED' }, now), false)
  assert.equal(eligibleForHistory({ kind: 'anime', status: 'CANCELLED', endYear: 2025, episodes: 5 }, now), false)
})

test('mergeHistory overwrites only the fetched ids and keeps the rest', () => {
  const existing = { 1: [{ at: 1, episode: 1 }], 2: [{ at: 2, episode: 1 }] }
  const fetched = new Map([[2, [{ at: 2, episode: 1 }, { at: 3, episode: 2 }]]])
  assert.deepEqual(mergeHistory(existing, fetched), {
    1: [{ at: 1, episode: 1 }],
    2: [{ at: 2, episode: 1 }, { at: 3, episode: 2 }],
  })
})
