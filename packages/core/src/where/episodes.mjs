/**
 * One anime's episode list: every episode number with its title and the date
 * it aired (or will air), from three sources that each know part of it.
 *
 *   airing.json history   every dated episode of a show AniList schedules
 *                         (RELEASING, or finished in the last three years)
 *   airing.json schedule  the rolling +/-60 day window, for the rest
 *   the catalog record    streamingEpisodes ("Episode 4 - The Promise"), and
 *                         nextEpisode, the next one due
 *
 * A number that appears twice (a rerun, a delayed regional broadcast) keeps
 * its FIRST air date: that is the date people ask about. A finished show
 * never lists a number past its own episode count.
 *
 * Pure: records in, rows out. A row is [number, title, airedAt] with '' and 0
 * for what is not known, the shape the shard stores.
 */

/** "Episode 12 - The Promise" -> { number: 12, title: 'The Promise' }; null when it names no number. */
export function parseStreamingTitle(text) {
  const match = /^\s*Episode\s+(\d+)\s*(?:[-–—:]\s*(.*))?$/i.exec(String(text || ''))
  if (!match) return null
  return { number: Number(match[1]), title: (match[2] || '').trim() }
}

/** The first air date of every episode number, from every dated source. */
function datesOf(item, history, window) {
  const dates = new Map()
  const keep = (number, at) => {
    if (!Number.isInteger(number) || number < 1 || !at) return
    const known = dates.get(number)
    if (!known || at < known) dates.set(number, at)
  }
  for (const row of history || []) keep(row.episode, row.at)
  for (const row of window || []) keep(row.episode, row.at)
  if (item.nextEpisode) keep(item.nextEpisode.number, item.nextEpisode.at)
  return dates
}

function titlesOf(item) {
  const titles = new Map()
  for (const stream of item.streamingEpisodes || []) {
    const parsed = parseStreamingTitle(stream.title)
    if (parsed && parsed.title && !titles.has(parsed.number)) titles.set(parsed.number, parsed.title)
  }
  return titles
}

/**
 * Every episode the sources know something about, in order.
 * `history` is airing.json's history for this id, `window` its schedule rows
 * for this id.
 */
export function buildEpisodes(item, history = [], window = []) {
  const dates = datesOf(item, history, window)
  const titles = titlesOf(item)
  const numbers = new Set([...dates.keys(), ...titles.keys()])
  // A finished show's own count is the truth; anything past it is a rerun
  // numbering or a data slip. A show still airing may run past its planned count.
  const cap = item.status === 'FINISHED' && item.episodes > 0 ? item.episodes : Infinity
  return [...numbers]
    .filter((n) => n <= cap)
    .sort((a, b) => a - b)
    .map((n) => [n, titles.get(n) || '', dates.get(n) || 0])
}

/** How many rows carry an air date. */
export const datedCount = (rows) => rows.filter((row) => row[2] > 0).length

/** The schedule window's rows, grouped by anime id: { id: [{ at, episode }] }. */
export function windowById(schedule) {
  const byId = new Map()
  for (const row of schedule || []) {
    if (!byId.has(row.mediaId)) byId.set(row.mediaId, [])
    byId.get(row.mediaId).push(row)
  }
  return byId
}
