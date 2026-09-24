// Season names and addresses, shared by the season hubs (built as files), the
// shard builder (which tells each anime record whether its season has a hub)
// and the title page (rendered by the Worker). Pure and import-free on purpose,
// so the Worker can load it without pulling in the catalog.

/** AniList's order inside one year. */
export const SEASON_ORDER = ['WINTER', 'SPRING', 'SUMMER', 'FALL']

/** A season earns its own page only with enough titles to be worth a visit. */
export const SEASON_MIN_TITLES = 6

/** "FALL" -> "fall", the form used in addresses. */
export const seasonSlug = (season) => String(season || '').toLowerCase()

/** "FALL" -> "Fall". */
export const seasonLabel = (season) => {
  const s = seasonSlug(season)
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : ''
}

/** The hub address for one season, e.g. /anime/season/2025/fall. */
export const seasonPath = (year, season) => `/anime/season/${year}/${seasonSlug(season)}`

/** The key both sides count seasons by. */
export const seasonKey = (year, season) => `${year}-${String(season || '').toUpperCase()}`

/**
 * The season a date falls in, by AniList's months: winter Jan-Mar, spring
 * Apr-Jun, summer Jul-Sep, fall Oct-Dec. UTC, so the build and the Worker agree.
 */
export function currentSeason(now = new Date()) {
  return { year: now.getUTCFullYear(), season: SEASON_ORDER[Math.floor(now.getUTCMonth() / 3)] }
}

/**
 * Where a season sits relative to today: -1 before, 0 this season, 1 ahead.
 * AniList files announced shows under seasons still to come, so copy that
 * says "aired" has to check this first.
 */
export function seasonWhen(year, season, now = currentSeason()) {
  const at = (y, s) => y * 4 + SEASON_ORDER.indexOf(s)
  return Math.sign(at(year, String(season || '').toUpperCase()) - at(now.year, now.season))
}

/** The season key of one anime record, or null when AniList gave it none. */
export const seasonKeyOf = (item) =>
  item && item.seasonYear && SEASON_ORDER.includes(item.season)
    ? seasonKey(item.seasonYear, item.season)
    : null

/**
 * The seasons that earn a hub, as a Set of keys. The one counting rule: the
 * hub builder and the shard builder both call this, so a title page never
 * links to a hub that was not built.
 */
export function hubSeasonKeys(anime) {
  const counts = new Map()
  for (const item of anime) {
    const key = seasonKeyOf(item)
    if (key) counts.set(key, (counts.get(key) || 0) + 1)
  }
  return new Set([...counts].filter(([, n]) => n >= SEASON_MIN_TITLES).map(([key]) => key))
}
