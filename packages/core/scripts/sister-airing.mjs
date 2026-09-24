/**
 * Pure parts of the airing walk (scripts/ingest-airing.mjs): the two
 * queries, shaping their rows, deciding which anime earn a per-title episode
 * history, and merging fetched history into what is already on disk. Kept
 * apart from the script the same way scripts/sister-credits.mjs is.
 *
 * docs/PLAN.md section 2.0: a rolling +/-60 day window of every episode
 * airing anywhere (cheap, everyone gets it), plus a per-anime full episode
 * history for shows worth naming an air date for on their own page.
 *
 * The plan estimated the per-anime history at "about 1,500 to 2,000 calls
 * once", one call per anime. Probed against the live API on 24 Sep 2026,
 * `Page(perPage: 50) { media(id_in: [...], type: ANIME) { airingSchedule
 * (perPage: 200) { ... } } }` returned 200 with no complexity error at the
 * full 50-id batch, so the history walk goes through IDS_PER_CALL like every
 * other AniList walk in this repo: the same ~1,500-2,000 eligible anime cost
 * roughly 30-40 calls, not 1,500-2,000. See docs/ingest.md for the corrected
 * estimate. `airingSchedule(perPage: 200)` on Media covers the gate's whole
 * 200-episode ceiling in one page; the rare show that still has a next page
 * is a follow-up single-id call the script makes on its own (not part of the
 * pure batch here).
 */
import { IDS_PER_CALL } from './anilist-core.mjs'

// Two episode-months either side of "now": enough for "airs in 3 days" and
// "aired 6 weeks ago" without hauling in a whole franchise's back catalog.
export const WINDOW_DAYS = 60
// AniList clamps a schedule connection's own page count, and 200 already
// covers the gate's episode ceiling below, so a longer runner is left to the
// script's single-id follow-up rather than a bigger page here.
export const HISTORY_PER_PAGE = 200
// The gate from docs/PLAN.md section 2.0: RELEASING or finished within three
// years, and under this many episodes either way. A finished long-runner
// (say, a 900-episode classic) is not worth an hour of episode dates no
// reader is looking for; a RELEASING one this long is rare enough that the
// cap simply defers it to the next full-refresh cycle instead of one giant call.
export const MAX_HISTORY_EPISODES = 200
export const RECENT_FINISHED_YEARS = 3

export const WINDOW_QUERY = `query ($page: Int, $from: Int, $to: Int) {
  Page(page: $page, perPage: ${IDS_PER_CALL}) {
    pageInfo { hasNextPage }
    airingSchedules(airingAt_greater: $from, airingAt_lesser: $to, sort: TIME) {
      airingAt episode mediaId
    }
  }
}`

export const HISTORY_QUERY = `query ($ids: [Int]) {
  Page(page: 1, perPage: ${IDS_PER_CALL}) {
    media(id_in: $ids, type: ANIME) {
      id
      airingSchedule(perPage: ${HISTORY_PER_PAGE}) {
        pageInfo { hasNextPage }
        nodes { airingAt episode }
      }
    }
  }
}`

/** One page's `airingSchedule` -> the sorted rows a title's history holds. */
export function shapeHistoryRows(nodes) {
  return (nodes || [])
    .map((n) => ({ at: n.airingAt, episode: n.episode ?? null }))
    .filter((r) => Number.isInteger(r.at))
    .sort((a, b) => a.at - b.at)
}

/** One row of the +/-60 day window listing. */
export function shapeWindowRow(row) {
  return { at: row.airingAt, episode: row.episode ?? null, mediaId: row.mediaId }
}

/** Window rows, deduplicated (AniList can repeat a row across pages) and sorted by time. */
export function sortWindow(rows) {
  const byKey = new Map()
  for (const row of rows) byKey.set(`${row.mediaId}|${row.episode}|${row.at}`, row)
  return [...byKey.values()].sort((a, b) => a.at - b.at || a.mediaId - b.mediaId)
}

/** `{ from, to }`, unix seconds, `days` either side of `nowMs`. */
export function windowRange(nowMs, days = WINDOW_DAYS) {
  const now = Math.floor(nowMs / 1000)
  return { from: now - days * 86400, to: now + days * 86400 }
}

/** True for a currently-airing anime: history is refetched for these every night. */
export const isReleasing = (anime) => anime.kind === 'anime' && anime.status === 'RELEASING'

/**
 * True when a finished anime is still worth a history page: it ended within
 * `RECENT_FINISHED_YEARS` and never ran past `MAX_HISTORY_EPISODES`.
 */
export function isRecentFinished(anime, nowYear, { years = RECENT_FINISHED_YEARS, maxEpisodes = MAX_HISTORY_EPISODES } = {}) {
  if (anime.kind !== 'anime' || anime.status !== 'FINISHED') return false
  if (!Number.isInteger(anime.endYear) || anime.endYear < nowYear - years) return false
  return Number.isInteger(anime.episodes) && anime.episodes > 0 && anime.episodes <= maxEpisodes
}

/**
 * True when `anime` earns a history page at all: RELEASING (under the
 * episode cap, when the episode count is even known yet), or a recent finish
 * under the cap. Anything NOT_YET_RELEASED, CANCELLED or HIATUS is left out,
 * matching docs/PLAN.md section 2.0's "RELEASING or finished" wording.
 */
export function eligibleForHistory(anime, nowYear, opts = {}) {
  const maxEpisodes = opts.maxEpisodes ?? MAX_HISTORY_EPISODES
  if (isReleasing(anime)) return !Number.isInteger(anime.episodes) || anime.episodes <= maxEpisodes
  return isRecentFinished(anime, nowYear, opts)
}

/** A new airing.json byId history map: `existing` with the freshly fetched rows applied. */
export function mergeHistory(existing, fetchedById) {
  const merged = { ...existing }
  for (const [id, rows] of fetchedById) merged[id] = rows
  return merged
}
