// The "For you" feed, "Your list this week" and the My list alerts.
//
// Pure: plain data in, plain data out, no window and no fetch, so it runs in
// node for the tests and in the browser for the homepage and /my-list.
//
// The engine is the one the roadmap asked for (docs/ROADMAP-personalised.md):
// read the genres and tags of what the reader saved, weigh each by what they
// did with it, and score every title in the pool against that profile. No
// model and no guessing, so every pick can say in plain words why it is
// there. "Because you saved Solo Leveling" beats "the model says so".

import { POOL, ROW } from './list-row.js'

/** How much each list status says about taste. Dropping a story counts against it. */
export const STATUS_WEIGHT = Object.freeze({
  CURRENT: 1.5,
  REPEATING: 1.5,
  COMPLETED: 1.25,
  PLANNING: 1.0,
  PAUSED: 0.6,
  DROPPED: -0.5,
})

// A title tied to one the reader saved (its anime, its source comic, or a
// pick AniList readers made after it) is the strongest signal there is.
const RELATED_BONUS = 2.0
// Tied only to a story they dropped: probably more of what they did not like.
const DROPPED_RELATION = -1.0
// Tags are finer than genres but noisier, so they count a little less.
const TAG_WEIGHT = 0.8
// Popularity and score only break ties between titles that fit about as well.
const POP_WEIGHT = 0.3
const SCORE_WEIGHT = 0.2

export const FEED_SIZE = 12
export const PER_SECTION = 4
export const WEEK_MAX = 6

export const DAY = 86400
/** An alert about a saved title stays up this long, then quietly goes. */
export const ALERT_DAYS = 7
/** "Episode soon" means within this many seconds. */
export const SOON = 2 * DAY

const SECTION_WORD = { manhwa: 'manhwa', manga: 'manga', manhua: 'manhua', novel: 'novels', anime: 'anime' }

const weightOf = (entry) => STATUS_WEIGHT[entry.status] ?? 1

/** Scale a vector so its largest value is 1 (or -1). An empty one stays empty. */
function normalise(map) {
  let top = 0
  for (const value of map.values()) top = Math.max(top, Math.abs(value))
  if (!top) return map
  return new Map([...map].map(([key, value]) => [key, value / top]))
}

/**
 * What the list says about the reader: a genre vector, a tag vector, and
 * which pool titles are tied to which saved title.
 */
export function buildProfile(entries) {
  const genre = new Map()
  const tag = new Map()
  const ids = new Set()
  // candidate id -> the saved entry it is tied to (the strongest one wins)
  const related = new Map()
  const droppedRel = new Set()

  for (const entry of entries) {
    ids.add(entry.id)
    const w = weightOf(entry)
    for (const g of entry.genres || []) genre.set(g, (genre.get(g) || 0) + w)
    for (const t of entry.tags || []) tag.set(t, (tag.get(t) || 0) + w)
    for (const id of entry.rel || []) {
      if (entry.status === 'DROPPED') {
        droppedRel.add(id)
        continue
      }
      const held = related.get(id)
      if (!held || weightOf(held) < w) related.set(id, entry)
    }
  }
  const kept = entries.filter((e) => e.status !== 'DROPPED')
  return {
    genre: normalise(genre),
    tag: normalise(tag),
    ids,
    related,
    droppedRel,
    droppedIds: new Set(entries.filter((e) => e.status === 'DROPPED').map((e) => e.id)),
    kept,
    keptById: new Map(kept.map((e) => [e.id, e])),
    size: entries.length,
  }
}

/**
 * How well one title's genres and tags fit the profile. Divided by the square
 * root of how many it has, so a title with nine genres does not win on count
 * alone, and a title with one perfect genre is not drowned either.
 */
function affinity(profile, genres, tags) {
  const parts = []
  let g = 0
  for (const name of genres) {
    const value = profile.genre.get(name) || 0
    g += value
    parts.push([name, value])
  }
  let t = 0
  for (const name of tags) {
    const value = profile.tag.get(name) || 0
    t += value
    parts.push([name, value * TAG_WEIGHT])
  }
  const value =
    (genres.length ? g / Math.sqrt(genres.length) : 0) + (tags.length ? (t / Math.sqrt(tags.length)) * TAG_WEIGHT : 0)
  const top = parts
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([name]) => name)
  return { value, top }
}

/** The saved, not-dropped title that shares the most of these names. */
function closestSaved(profile, names) {
  let best = null
  let bestHits = 0
  for (const entry of profile.kept) {
    const mine = new Set([...(entry.genres || []), ...(entry.tags || [])])
    const hits = names.filter((n) => mine.has(n)).length
    if (!hits) continue
    if (hits > bestHits || (hits === bestHits && weightOf(entry) > weightOf(best))) {
      best = entry
      bestHits = hits
    }
  }
  return best
}

const andWords = (names) => (names.length > 1 ? `${names[0]} and ${names[1]}` : names[0])

/** One pool entry as the object the page draws. */
function unpack(pool, row) {
  return {
    id: row[POOL.ID],
    ns: pool.sections[row[POOL.NS]],
    slug: row[POOL.SLUG],
    title: row[POOL.TITLE],
    cover: row[POOL.COVER],
    score: row[POOL.SCORE] || 0,
    popularity: row[POOL.POP] || 0,
    genres: (row[POOL.GENRES] || []).map((i) => pool.genres[i]).filter(Boolean),
    tags: (row[POOL.TAGS] || []).map((i) => pool.tags[i]).filter(Boolean),
    rel: row[POOL.REL] || [],
  }
}

/**
 * Score every pool title against the list. Titles already on the list, in
 * any status, are never recommended back.
 */
export function rankPool(entries, pool) {
  const profile = buildProfile(entries)
  const items = (pool.items || []).map((row) => unpack(pool, row)).filter((item) => item.ns && !profile.ids.has(item.id))
  const maxPop = Math.log1p(items.reduce((m, item) => Math.max(m, item.popularity), 0)) || 1

  return items.map((item) => {
    const fit = affinity(profile, item.genres, item.tags)
    // Tied to a saved title either way round: the saved title names it, or
    // it names the saved title.
    let from = profile.related.get(item.id) || null
    if (!from) {
      const id = item.rel.find((n) => profile.keptById.has(n))
      from = id ? profile.keptById.get(id) : null
    }
    const droppedTie =
      !from && (profile.droppedRel.has(item.id) || item.rel.some((id) => profile.droppedIds.has(id)))

    let score = fit.value
    if (from) score += RELATED_BONUS
    else if (droppedTie) score += DROPPED_RELATION
    score += POP_WEIGHT * (Math.log1p(item.popularity) / maxPop) + SCORE_WEIGHT * (item.score / 100)

    let reason
    if (from) {
      reason = `Because you saved ${from.title}`
    } else if (fit.value > 0 && fit.top.length) {
      const names = fit.top.slice(0, 2)
      const like = closestSaved(profile, names)
      reason = like ? `More ${andWords(names)}, like ${like.title}` : `More ${andWords(names)}`
    } else {
      reason = `Popular in ${SECTION_WORD[item.ns] || item.ns} right now`
    }
    return { ...item, rank: score, reason, related: Boolean(from) }
  })
}

/**
 * The picks: best first, dealt round-robin across the sections so one busy
 * section cannot fill the whole row, and never more than `perSection` from
 * any one. The section with the strongest pick deals first.
 */
export function pickFeed(entries, pool, size = FEED_SIZE, perSection = PER_SECTION) {
  const ranked = rankPool(entries, pool).sort((a, b) => b.rank - a.rank || b.popularity - a.popularity)
  const queues = new Map()
  for (const item of ranked) {
    if (!queues.has(item.ns)) queues.set(item.ns, [])
    queues.get(item.ns).push(item)
  }
  // Map keeps insertion order, and `ranked` is best first, so the sections
  // come out ordered by their best pick.
  const order = [...queues.keys()]
  const taken = new Map(order.map((ns) => [ns, 0]))
  const picks = []
  let moved = true
  while (picks.length < size && moved) {
    moved = false
    for (const ns of order) {
      if (picks.length >= size) break
      const queue = queues.get(ns)
      if (!queue.length || taken.get(ns) >= perSection) continue
      picks.push(queue.shift())
      taken.set(ns, taken.get(ns) + 1)
      moved = true
    }
  }
  return picks
}

/**
 * "Your list this week": saved anime with an episode due in the next seven
 * days, soonest first. `airing` is the pool's [id, at, number] list and `now`
 * is in seconds. A dropped show is left out; the reader said they stopped.
 */
export function thisWeek(entries, airing, now, days = 7, max = WEEK_MAX) {
  const byId = new Map(entries.map((e) => [e.id, e]))
  const until = now + days * DAY
  const out = []
  const seen = new Set()
  for (const [id, at, num] of airing || []) {
    const entry = byId.get(id)
    if (!entry || entry.status === 'DROPPED' || seen.has(id)) continue
    if (at <= now || at > until) continue
    seen.add(id)
    out.push({ entry, at, num })
  }
  // Sort first, then cut: the caller may pass rows in any order (the list
  // page passes them in shard-load order), and the soonest six must win.
  return out.sort((a, b) => a.at - b.at).slice(0, max)
}

// ---------------------------------------------------------------------------
// Alerts on /my-list. Each saved title remembers what it looked like the last
// time the reader was shown it (`seen`); a change since then is news. Times
// here are unix seconds, like the rows.
// ---------------------------------------------------------------------------

/** The facts an alert can be about, from one list row. */
export function snapOf(row) {
  return {
    status: row[ROW.STATUS] || '',
    sites: row[ROW.SITES] || [],
    nextAt: row[ROW.NEXT_AT] || 0,
    count: row[ROW.COUNT] || 0,
  }
}

const sameSnap = (seen, snap) =>
  seen.status === snap.status &&
  seen.nextAt === snap.nextAt &&
  seen.count === snap.count &&
  seen.sites.length === snap.sites.length &&
  seen.sites.every((s, i) => s === snap.sites[i])

/** What changed between the snapshot the reader saw and the row now. */
export function diffAlerts(seen, snap) {
  const out = []
  if (seen.status && seen.status !== 'FINISHED' && snap.status === 'FINISHED') {
    out.push({ kind: 'finished' })
  }
  const fresh = snap.sites.filter((s) => !seen.sites.includes(s))
  if (fresh.length) out.push({ kind: 'platform', sites: fresh })
  return out
}

/**
 * The alerts to show for one title, and the snapshot to store back.
 *
 * A change is shown from the moment it is first noticed (`flagAt`) for
 * ALERT_DAYS, then the snapshot rolls forward and the alert goes. "Episode
 * soon" is not a change, it is read straight off the row every time.
 */
export function reconcile(seen, row, now) {
  const snap = snapOf(row)
  const soon =
    snap.nextAt > now && snap.nextAt - now <= SOON ? [{ kind: 'soon', at: snap.nextAt, num: row[ROW.NEXT_NUM] || 0 }] : []
  if (!seen) return { seen: { ...snap, at: now }, alerts: soon, changed: true }

  const diffs = diffAlerts(seen, snap)
  if (!diffs.length) {
    if (sameSnap(seen, snap) && !seen.flagAt) return { seen, alerts: soon, changed: false }
    return { seen: { ...snap, at: now }, alerts: soon, changed: true }
  }
  const flagAt = seen.flagAt || now
  if (now - flagAt > ALERT_DAYS * DAY) return { seen: { ...snap, at: now }, alerts: soon, changed: true }
  return { seen: { ...seen, flagAt }, alerts: [...diffs, ...soon], changed: !seen.flagAt }
}

/** An alert in words. */
export function alertText(alert, entry, phrase) {
  if (alert.kind === 'finished') return `${entry.title} has finished.`
  if (alert.kind === 'platform') {
    const names = alert.sites
    return `${entry.title} is now on ${names.length > 1 ? `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}` : names[0]}.`
  }
  if (alert.kind === 'soon') {
    const ep = alert.num ? `Episode ${alert.num}` : 'A new episode'
    return `${ep} of ${entry.title} airs ${phrase ? phrase(alert.at - Math.floor(Date.now() / 1000)) : 'soon'}.`
  }
  return ''
}
