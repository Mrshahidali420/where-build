/**
 * The rest of /schedule, beside the week: where each show streams, the most
 * watched shows airing now and the anime announced but not started. Built from
 * the title records, so every row names a page that exists; the picking is
 * src/lib/schedule.mjs, the same rules the manga index uses.
 *
 * Rows are arrays, like the rest of data/where-hubs.json, to keep it small.
 *
 * Pure: `now` (unix seconds) is always handed in.
 */
import { airingNow, upcomingAnime, upcomingRow, smallCover } from '../lib/schedule.mjs'

/** How many official platforms a row names. */
const MAX_SITES = 4

/** How many shows "airing now" lists, and the fewest worth a section. */
const POPULAR = { max: 12, min: 3 }

/**
 * The upcoming lists, in page order, each cut to `max` rows. A list with
 * fewer than `min` rows is dropped: no section is a thin list.
 */
export const UPCOMING = [
  { key: 'anticipated', max: 12, min: 3 },
  { key: 'big', max: 12, min: 3 },
  { key: 'soon', max: 24, min: 3 },
  { key: 'movies', max: 12, min: 2 },
]

/** The official platforms of a title record, once each: ['Crunchyroll', 'Netflix']. */
export const platformsOf = (t) => [...new Set((t?.watchOn || []).map((w) => w.site).filter(Boolean))].slice(0, MAX_SITES)

/**
 * The most watched shows still airing: [title, href, cover, episode, at, platforms].
 * episode and at are 0 when the calendar has no next episode. Empty when too few.
 */
export function popularAiring(titles, now) {
  const rows = airingNow(titles, now, POPULAR.max).map(({ show, slot }) => {
    // nextSlot rolls a passed episode on a week; past the planned count there is no next one.
    const next = slot && !(show.episodes && slot.number > show.episodes) ? slot : null
    return [show.title, `/anime/${show.slug}`, smallCover(show.cover) || '', next?.number || 0, next?.at || 0, platformsOf(show)]
  })
  return rows.length >= POPULAR.min ? rows : []
}

/**
 * The announced lists that pass their minimum: [{ key, rows }], each row
 * [title, href, cover, format, when, at]. `when` is the start in the finest
 * words AniList gives ("12 Jan 2027", "Winter 2027"); `at` is 0 unless the day is known.
 */
export function upcomingLists(titles, now) {
  // The lists print as a grid of covers, so a title with no cover sits out.
  const lists = upcomingAnime(titles.filter((t) => t.cover), now)
  return UPCOMING.map(({ key, max, min }) => ({ key, min, rows: lists[key].slice(0, max) }))
    .filter(({ rows, min }) => rows.length >= min)
    .map(({ key, rows }) => ({
      key,
      rows: rows.map(upcomingRow).map((r) => [r.title, `/anime/${r.slug}`, r.cover || '', r.format || '', r.when || '', r.at || 0]),
    }))
}
