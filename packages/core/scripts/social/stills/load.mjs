/**
 * The episode stills the scene, collage and still posts can use this hour
 * (types/scenes.mjs, types/collage.mjs, types/stills.mjs).
 *
 * A few popular shows are looked at each hour, in turns: the ones with an
 * episode today or tomorrow first, then the rest that are still airing,
 * then the best-known finished ones. For each, the stills of the last
 * episodes (the first ones of a finished show) come from TMDB when the key
 * is set and the show is matched (stills/match.mjs), else from Kitsu. Each
 * still is checked (stills/quality.mjs): too small, too dark, letterboxed,
 * soft or a twin of another frame, and it is left out. A source that fails
 * gives no stills for that show and nothing else.
 *
 * A census (STILLS_CENSUS=1, a hand dry run only) looks at every airing and
 * soon-premiering show instead of a few, and says how many have enough.
 */
import { firstStills, kitsuIdOf, latestStills } from './kitsu.mjs'
import { cachedMatch, findShow, keepMatches, lastAired } from './match.mjs'
import { distinct, judgeStill } from './quality.mjs'
import { episodeStills, tmdbClient } from './tmdb.mjs'

/** Shows looked at each hour. */
export const PER_HOUR = 3
/** Stills fetched per show: the grid collage needs eight. */
export const PER_SHOW = 8
/** Only shows this many AniList users follow; a finished show needs more. */
export const MIN_POPULARITY = 30_000
export const MIN_POPULARITY_FINISHED = 150_000
const HOUR_MS = 3_600_000
const SOON_MS = 30 * HOUR_MS
/** A census also counts shows that premiere within this long. */
const PREMIERE_MS = 7 * 24 * HOUR_MS
const FETCH_TIMEOUT_MS = 20_000

const soonOf = (now, within) => (t) => t.nextEpisode && t.nextEpisode.at > now && t.nextEpisode.at <= now + within

/**
 * The shows whose turn it is: soon-airing first, then the rest still airing,
 * then the best-known finished ones, most popular first in each group.
 * A census takes every airing and soon-premiering show, and no finished one.
 */
export function showsFor(titles, now, perHour = PER_HOUR, { census = false } = {}) {
  const soon = soonOf(now, SOON_MS)
  const popular = titles.filter((t) => t.popularity >= MIN_POPULARITY)
  const airing = popular.filter((t) => soon(t) || t.status === 'RELEASING')
  if (census) return [...airing, ...popular.filter((t) => t.status === 'NOT_YET_RELEASED' && soonOf(now, PREMIERE_MS)(t) && !airing.includes(t))]
  const finished = titles.filter((t) => t.status === 'FINISHED' && t.popularity >= MIN_POPULARITY_FINISHED && (t.episodes || 0) > 1)
  const ordered = [...airing.filter(soon), ...airing.filter((t) => !soon(t)), ...finished]
  if (!ordered.length) return []
  const start = (Math.floor(now / HOUR_MS) * perHour) % ordered.length
  return Array.from({ length: Math.min(perHour, ordered.length) }, (_, i) => ordered[(start + i) % ordered.length])
}

async function checked(still, { fetch, sharp }) {
  try {
    const res = await fetch(still.url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) })
    if (!res.ok) return null
    const verdict = await judgeStill(Buffer.from(await res.arrayBuffer()), sharp)
    return verdict.reason ? null : { ...still, ratio: verdict.ratio, hash: verdict.hash }
  } catch {
    return null
  }
}

async function checkAll(list, tools) {
  const found = []
  for (const still of list) {
    const good = await checked(still, tools)
    if (good) found.push(good)
  }
  return distinct(found)
}

const range = (from, to) => Array.from({ length: Math.max(0, to - from + 1) }, (_, i) => from + i)

/** The episodes to take: the first ones of a finished show, else the last aired ones. */
async function episodesOf(get, show, title) {
  if (title.status === 'FINISHED') return range(1, PER_SHOW)
  const last = lastAired(await get(`/tv/${show.id}`), show.season) ?? (title.nextEpisode ? title.nextEpisode.number - 1 : 0)
  return range(Math.max(1, last - PER_SHOW + 1), last)
}

/** TMDB's stills of a title, matching it first unless the ledger already knows it. */
async function fromTmdb(get, title, { cache, found, now }) {
  let show = cachedMatch(cache, title, now)
  if (show === 'miss') return []
  if (show === undefined) {
    show = await findShow(get, title)
    found[title.id] = show ? { ...show, at: now } : { miss: true, at: now }
    if (!show) return []
  }
  return episodeStills(get, show, await episodesOf(get, show, title))
}

async function fromKitsu(title, { fetch }) {
  const kitsu = await kitsuIdOf(title.malId, { fetch })
  if (!kitsu) return []
  // A finished show is shown from its first episodes, so a post never gives its ending away.
  return title.status === 'FINISHED' ? firstStills(kitsu.id, { count: PER_SHOW, fetch }) : latestStills(kitsu.id, { count: PER_SHOW, fetch })
}

async function cacheOf(book) {
  try {
    return (await book?.read())?.data?.tmdbIds || {}
  } catch {
    return {}
  }
}

/** The stills of one show: TMDB first, Kitsu when TMDB has none. */
async function stillsOfShow(title, { get, cache, found, now, fetch, tools, say }) {
  if (get) {
    try {
      const stills = await checkAll(await fromTmdb(get, title, { cache, found, now }), tools)
      if (stills.length) return { source: 'TMDB', stills }
    } catch (error) {
      say(`TMDB stills for ${title.title} could not be read (${error.message}).`)
    }
  }
  if (!title.malId) return { source: null, stills: [] }
  try {
    return { source: 'Kitsu', stills: await checkAll(await fromKitsu(title, { fetch }), tools) }
  } catch (error) {
    say(`Stills for ${title.title} could not be read (${error.message}).`)
    return { source: null, stills: [] }
  }
}

function sayCensus(rows, say) {
  for (const { title, source, stills } of rows) say(`  ${title.title}: ${stills.length} stills${source ? ` from ${source}` : ''}${stills.length ? `, episodes ${stills[0].number} to ${stills.at(-1).number}: ${stills.map((s) => s.url.split('/').pop()).join(' ')}` : ''}`)
  const count = (n) => rows.filter((r) => r.stills.length >= n).length
  const from = (name) => rows.filter((r) => r.source === name && r.stills.length).length
  say(`Stills census: ${rows.length} airing or premiering shows; 1+ still ${count(1)}, 2+ (scenes) ${count(2)}, 5+ (collage) ${count(5)}, 8+ (grid) ${count(8)}; from TMDB ${from('TMDB')}, from Kitsu ${from('Kitsu')}.`)
}

/**
 * The stills of this hour: [{ titleId, finished, source, stills: [{ id, number, url, ratio, hash }] }], oldest episode first.
 * @param titles the site's titles, most popular first
 * @param key the TMDB key, or null to use Kitsu alone
 */
export async function loadStills({ now, titles, fetch = globalThis.fetch, say = () => {}, sharp = null, key = null, book = null, census = false, wait }) {
  const tools = { fetch, sharp: sharp || (await import('sharp')).default }
  const get = key ? tmdbClient(key, { fetch, wait }) : null
  const cache = get ? await cacheOf(book) : {}
  const found = {}
  const rows = []
  for (const title of showsFor(titles, now, PER_HOUR, { census })) rows.push({ title, ...(await stillsOfShow(title, { get, cache, found, now, fetch, tools, say })) })
  await keepMatches(book, found).catch((error) => say(`The TMDB ids could not be kept (${error.message}).`))
  if (census) sayCensus(rows, say)
  const out = rows.filter((r) => r.stills.length).map(({ title, source, stills }) => ({ titleId: title.id, finished: title.status === 'FINISHED', source, stills }))
  say(`Stills this hour: ${out.map((s) => s.stills.length).reduce((a, b) => a + b, 0)} from ${out.length} shows (${get ? 'TMDB, then Kitsu' : 'Kitsu; no TMDB key'}; checked for size, darkness, black bars, softness and twins).`)
  return out
}

/** The extra every stills type carries (extras.mjs): one search, shared by the three. */
export const stillsExtra = {
  name: 'stills',
  load: ({ book, now, data, fetch, say }) =>
    loadStills({ now, book, fetch, say, key: process.env.TMDB_API_KEY || null, census: process.env.STILLS_CENSUS === '1', titles: [...(data.titles || [])].sort((x, y) => y.popularity - x.popularity) }),
}

/** The stills of one title, and the title, for a type's find(). */
export const stillsOf = (data) => (data.stills || []).map((s) => ({ title: data.byId?.get(s.titleId), finished: Boolean(s.finished), stills: s.stills })).filter((s) => s.title)
