/**
 * The Search tab's two newer lists: titles people are finding more often on
 * Google and the other search engines, and the titles people look up with our
 * own search box. Closed days only for the engines (the night job's
 * daily_search_arrivals), so the list reads what the homepage planner reads.
 */
import { ask, dayKey } from './admin.js'
import { titlePagePath, ENGINE_NAMES } from './search-signals.js'

const DAY_MS = 86400000
const daysBetween = (from, to) => Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS)

// A thin week is pulled toward the usual, so three arrivals on a page nobody
// visited before do not read as a huge rise.
const SHRINK7 = 5

/** The days the 30-day window really holds when the table is younger than that. */
function baseDaysOf(historyStart, night) {
  const at = Date.parse(`${night}T12:00:00Z`)
  if (!historyStart || historyStart <= dayKey(30, at)) return 30
  return Math.max(1, Math.min(30, daysBetween(historyStart, dayKey(1, at)) + 1))
}

/** This week's search arrivals against the usual week. */
function searchLift(s, baseDays = 30) {
  const r30 = (s.g30 || 0) / Math.max(baseDays, 1)
  return ((s.g7 || 0) + SHRINK7) / (7 * r30 + SHRINK7)
}

// A page found fewer times than this in a week is not a trend worth a line.
export const RISING_MIN_WEEK = 3

/**
 * Titles found through a search engine in the last 7 closed days, with the
 * week against the usual (over the days the table holds) and the engines
 * that sent them. Answer pages count for their title. Sorted by rise, then
 * by size.
 */
export function risingArrivals(rows, { night, historyStart, labels = new Map() } = {}) {
  const last = dayKey(1, Date.parse(`${night}T12:00:00Z`))
  const from7 = dayKey(7, Date.parse(`${night}T12:00:00Z`))
  const baseDays = baseDaysOf(historyStart, night)
  const byPage = new Map()
  for (const r of rows || []) {
    const page = titlePagePath(r.path)
    const s = byPage.get(page) || { page, g7: 0, g30: 0, people7: 0, engines: {} }
    const views = Number(r.views) || 0
    s.g30 += views
    if (r.day >= from7 && r.day <= last) {
      s.g7 += views
      s.people7 += Number(r.people) || 0
      s.engines[r.engine] = (s.engines[r.engine] || 0) + views
    }
    byPage.set(page, s)
  }
  return [...byPage.values()]
    .filter((s) => s.g7 >= RISING_MIN_WEEK)
    .map((s) => ({ ...s, lift: searchLift(s, baseDays), label: labels.get(s.page) || '' }))
    .sort((a, b) => b.lift - a.lift || b.g7 - a.g7 || (a.page < b.page ? -1 : 1))
}

/** "Google 12, Bing 2": the engines of one row, biggest first. */
export const enginesLine = (engines) =>
  Object.entries(engines || {})
    .sort((a, b) => b[1] - a[1])
    .map(([e, n]) => `${ENGINE_NAMES[e] || e} ${n}`)
    .join(', ')

/** The rows and labels risingArrivals() needs, from D1. */
export async function searchArrivalsFor(db, now = Date.now()) {
  const night = dayKey(0, now)
  const [rows, first] = await Promise.all([
    ask(
      db,
      'SELECT day, path, engine, views, people FROM daily_search_arrivals WHERE day >= ? AND day <= ?',
      dayKey(30, now),
      dayKey(1, now)
    ),
    ask(db, 'SELECT MIN(day) AS day FROM daily_search_arrivals'),
  ])
  const list = risingArrivals(rows, { night, historyStart: first[0]?.day || null })
  const top = list.slice(0, 15)
  const paths = top.map((r) => r.page)
  const labelRows = paths.length
    ? await ask(db, `SELECT path, label FROM total_pages WHERE path IN (${paths.map(() => '?').join(',')})`, ...paths)
    : []
  const labels = new Map(labelRows.map((r) => [r.path, r.label]))
  return top.map((r) => ({ ...r, label: labels.get(r.page) || '' }))
}

/** Search picks folded into their title: { key: page, n, people, label }. */
export function searchedTitles(picks) {
  const out = new Map()
  for (const row of picks || []) {
    const key = titlePagePath(row.item)
    const found = out.get(key) || { key, n: 0, people: 0, label: '' }
    found.n += row.n || 0
    found.people += row.people || 0
    if (!found.label && row.label) found.label = row.label
    out.set(key, found)
  }
  return [...out.values()].sort((a, b) => b.people - a.people || b.n - a.n)
}
