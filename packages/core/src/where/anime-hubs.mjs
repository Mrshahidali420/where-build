/**
 * The anime-intent hubs of a Where anime site: the airing schedule of the
 * coming week, the season pages and the genre pages. Each is gated like every
 * other page (src/where/gates.mjs): a season with too few shows, a genre with
 * too few titles or a week with too few dated episodes gets no page, so no hub
 * is ever a thin list.
 *
 * compute.mjs counts from these and outputs.mjs builds the hub lists from
 * them, so the counts printed and the pages built always agree.
 *
 * Pure: `now` (unix seconds) is always handed in.
 */

export const SEASONS = ['WINTER', 'SPRING', 'SUMMER', 'FALL']
const DAY = 86400

/** The anime season a moment falls in, the way AniList files them (Winter = Jan to Mar). */
export function seasonAt(now) {
  const d = new Date(now * 1000)
  return { season: SEASONS[Math.floor(d.getUTCMonth() / 3)], year: d.getUTCFullYear() }
}

/** The season `by` steps after (or before, when negative) this one. */
export function shiftSeason({ season, year }, by) {
  const at = SEASONS.indexOf(season) + by
  return { season: SEASONS[((at % 4) + 4) % 4], year: year + Math.floor(at / 4) }
}

export const seasonPath = (year, season) => `/season/${year}/${String(season).toLowerCase()}`

/** "Slice of Life" -> "slice-of-life", "Sci-Fi" -> "sci-fi". */
export const genreSlug = (name) =>
  String(name || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')

const byPopularity = (a, b) => (b.popularity || 0) - (a.popularity || 0) || a.id - b.id

/**
 * The seasons with a page, newest first: [{ year, season, path, items }].
 * titles: anything with { id, season, seasonYear, popularity }.
 */
export function buildSeasons(titles, gate) {
  const groups = new Map()
  for (const t of titles) {
    if (!SEASONS.includes(t.season) || !t.seasonYear) continue
    const key = `${t.seasonYear}:${t.season}`
    if (!groups.has(key)) groups.set(key, { year: t.seasonYear, season: t.season, path: seasonPath(t.seasonYear, t.season), items: [] })
    groups.get(key).items.push(t)
  }
  return [...groups.values()]
    .filter((g) => g.items.length >= gate.min)
    .map((g) => ({ ...g, items: [...g.items].sort(byPopularity) }))
    .sort((a, b) => b.year - a.year || SEASONS.indexOf(b.season) - SEASONS.indexOf(a.season))
}

/**
 * The genres with a page, biggest first: [{ name, slug, total, pages, items }].
 * A genre lists its most watched titles only, `per` a page and at most
 * `maxPages` pages: past that a list stops helping anyone choose, and every
 * title is still reachable from its year.
 */
export function buildGenres(titles, gate) {
  const groups = new Map()
  for (const t of titles) {
    for (const name of t.genres || []) {
      if (!groups.has(name)) groups.set(name, [])
      groups.get(name).push(t)
    }
  }
  return [...groups]
    .filter(([, items]) => items.length >= gate.min)
    .map(([name, items]) => {
      const kept = [...items].sort(byPopularity).slice(0, gate.per * gate.maxPages)
      return { name, slug: genreSlug(name), total: items.length, per: gate.per, pages: Math.ceil(kept.length / gate.per), items: kept }
    })
    .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name))
}

/** Schedule rows of titles with a page, each (show, episode) once at its first date, in time order. */
function airingRows(schedule, hasPage, from, to) {
  const first = new Map()
  for (const row of schedule || []) {
    if (!row || !(row.at >= from && row.at < to) || !hasPage(row.mediaId)) continue
    const key = `${row.mediaId}:${row.episode}`
    const known = first.get(key)
    if (!known || row.at < known.at) first.set(key, { id: row.mediaId, episode: row.episode, at: row.at })
  }
  return [...first.values()].sort((a, b) => a.at - b.at || a.id - b.id)
}

/** "2026-09-25" for a unix time, the UTC day it falls on. */
export const dayOf = (at) => new Date(at * 1000).toISOString().slice(0, 10)

/**
 * The coming week, day by day (UTC), from the start of `now`'s day: every
 * episode of a show with a page that is due in it. Null when the week holds
 * fewer than gate.min episodes: then there is no schedule page.
 *   { from, days: [{ day: '2026-09-25', rows: [{ id, episode, at }] }], total }
 */
export function buildSchedule(schedule, hasPage, now, gate, days = 7) {
  const from = Math.floor(now / DAY) * DAY
  const rows = airingRows(schedule, hasPage, from, from + days * DAY)
  if (rows.length < gate.min) return null
  const byDay = []
  for (let i = 0; i < days; i++) {
    const day = dayOf(from + i * DAY)
    byDay.push({ day, rows: rows.filter((row) => dayOf(row.at) === day) })
  }
  return { from, days: byDay, total: rows.length }
}

/** The next `max` episodes due after `now`, for the front page. */
export const upcomingEpisodes = (schedule, hasPage, now, max) => airingRows(schedule, hasPage, now, Infinity).slice(0, max)
