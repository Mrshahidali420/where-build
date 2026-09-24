/**
 * The drawing helpers behind /my-admin: small charts, change arrows, flags,
 * and folding repeated rows together.
 *
 * Everything here is plain numbers in, plain strings out. No database, no
 * page, no chart library: the charts are inline SVG drawn on the server, so
 * the dashboard makes no outside request and the CSP stays as it is. Tested
 * in tests/admin-chart.test.js.
 */

/** A number with one decimal at most, for SVG coordinates. */
const r1 = (n) => Math.round(n * 10) / 10

/** Every value as a number, never below zero. */
const clean = (values) => (values || []).map((v) => Math.max(0, Number(v) || 0))

/**
 * A line and the area under it, for a small trend chart.
 *
 * values: one number per day (or hour). w, h: the drawing size. pad keeps the
 * line off the top and bottom edge so it is never cut in half.
 * Returns { line, area, points, max }. With no values both paths are ''.
 */
export function sparkPath(values, w = 120, h = 32, pad = 2) {
  const list = clean(values)
  if (list.length === 0) return { line: '', area: '', points: [], max: 0 }
  const max = Math.max(...list)
  const inner = h - pad * 2
  const step = list.length > 1 ? w / (list.length - 1) : 0
  const points = list.map((v, i) => ({
    x: list.length > 1 ? r1(i * step) : r1(w / 2),
    y: r1(pad + inner - (max ? (v / max) * inner : 0)),
  }))
  const line = points.map((p, i) => `${i ? 'L' : 'M'}${p.x} ${p.y}`).join(' ')
  const area = `${line} L${points[points.length - 1].x} ${h} L${points[0].x} ${h} Z`
  return { line, area, points, max }
}

/**
 * Columns for a bar chart: one { x, y, w, h, value } per value, bottom-aligned.
 * A value above zero always gets at least 1 unit of height, so a small day is
 * still seen as "something happened".
 */
export function barRects(values, w = 240, h = 60, gap = 2) {
  const list = clean(values)
  if (list.length === 0) return []
  const max = Math.max(...list)
  const slot = w / list.length
  const bw = Math.max(1, slot - gap)
  return list.map((value, i) => {
    const bh = max ? Math.max(value > 0 ? 1 : 0, (value / max) * h) : 0
    return { x: r1(i * slot + (slot - bw) / 2), y: r1(h - bh), w: r1(bw), h: r1(bh), value }
  })
}

/**
 * Stacked columns: each column is a list of parts (numbers), drawn bottom up.
 * Returns one list of { x, y, w, h, value, part } per column, plus the tallest
 * column's total as `max`. Every column shares one scale.
 */
export function stackRects(columns, w = 240, h = 60, gap = 2) {
  const cols = (columns || []).map((parts) => clean(parts))
  if (cols.length === 0) return { max: 0, columns: [] }
  const max = Math.max(...cols.map((parts) => parts.reduce((n, v) => n + v, 0)))
  const slot = w / cols.length
  const bw = Math.max(1, slot - gap)
  const out = cols.map((parts, i) => {
    let base = h
    return parts.map((value, part) => {
      const bh = max ? (value / max) * h : 0
      base -= bh
      return { x: r1(i * slot + (slot - bw) / 2), y: r1(base), w: r1(bw), h: r1(bh), value, part }
    })
  })
  return { max, columns: out }
}

/** How wide a row's bar is, as a percent of the biggest row. 0 stays 0. */
export function share(value, max) {
  const v = Number(value) || 0
  const m = Number(max) || 0
  if (v <= 0 || m <= 0) return 0
  return Math.min(100, Math.max(2, Math.round((v / m) * 1000) / 10))
}

/**
 * A change between two numbers, for the arrows next to a big number.
 * { pct, dir, arrow, words } where dir is 'up', 'down' or 'flat', and words
 * says it without the colour: "up 12%". pct is null when there is nothing to
 * compare with, and then words is ''.
 */
export function deltaOf(now, before) {
  const a = Number(now) || 0
  const b = Number(before) || 0
  if (!b) return { pct: null, dir: 'flat', arrow: '', words: '' }
  const pct = Math.round(((a - b) / b) * 100)
  if (pct === 0) return { pct, dir: 'flat', arrow: '→', words: 'no change' }
  const dir = pct > 0 ? 'up' : 'down'
  return { pct, dir, arrow: dir === 'up' ? '▲' : '▼', words: `${dir} ${Math.abs(pct)}%` }
}

/**
 * A two-letter country code as its flag. Phones draw the flag; a desktop
 * without flag glyphs shows the two letters, which still reads fine.
 * Codes Cloudflare uses for "not a country" (XX, T1) give ''.
 */
export function flagOf(code) {
  const c = String(code || '').trim().toUpperCase()
  if (!/^[A-Z]{2}$/.test(c) || c === 'XX' || c === 'T1') return ''
  return String.fromCodePoint(...[...c].map((ch) => 0x1f1e6 + ch.charCodeAt(0) - 65))
}

/**
 * Fold rows that repeat one after another into one row with a count. A reader
 * who taps the same link twice in the same minute is one line "×2", not two.
 * keyOf says what makes two rows the same. Order is kept; each row gets
 * `count`.
 */
export function groupRepeats(rows, keyOf) {
  const out = []
  for (const row of rows || []) {
    const key = keyOf(row)
    const last = out[out.length - 1]
    if (last && last.key === key) {
      last.row = { ...last.row, count: last.row.count + 1 }
      continue
    }
    out.push({ key, row: { ...row, count: 1 } })
  }
  return out.map((entry) => entry.row)
}

/** The key that makes two clicks "the same click": link, page, kind, minute. */
export const clickKey = (row) =>
  [row.kind, row.platform || row.name, row.path, Math.floor((Number(row.ts) || 0) / 60000)].join('|')

/** Every day from `from` to `to`, both included, as 'YYYY-MM-DD'. */
export function daysBetween(from, to) {
  const out = []
  let t = Date.parse(`${from}T00:00:00Z`)
  const end = Date.parse(`${to}T00:00:00Z`)
  if (!Number.isFinite(t) || !Number.isFinite(end)) return out
  while (t <= end && out.length < 400) {
    out.push(new Date(t).toISOString().slice(0, 10))
    t += 86400000
  }
  return out
}

/**
 * One row per day from `from` to `to`, with zeros for the days that have no
 * row (a quiet day has no row at all in the nightly tables).
 */
export function fillDays(rows, from, to, fields) {
  const byDay = new Map((rows || []).map((row) => [row.day, row]))
  return daysBetween(from, to).map((day) => {
    const found = byDay.get(day) || {}
    const out = { day }
    for (const f of fields) out[f] = Number(found[f]) || 0
    return out
  })
}

/**
 * Today's point on a trend, without asking the database again. The page
 * already has the whole range's totals (closed days plus today) and the
 * closed days one by one, so today is the difference.
 */
export function withToday(series, totals, today, fields) {
  const point = { day: today }
  for (const f of fields) {
    const closed = series.reduce((n, row) => n + (Number(row[f]) || 0), 0)
    point[f] = Math.max(0, (Number(totals?.[f]) || 0) - closed)
  }
  return [...series.filter((row) => row.day !== today), point]
}

/** "Mon 22" for an axis label. */
export function shortDay(day) {
  const t = Date.parse(`${day}T00:00:00Z`)
  if (!Number.isFinite(t)) return ''
  const d = new Date(t)
  return `${['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.getUTCDay()]} ${d.getUTCDate()}`
}
