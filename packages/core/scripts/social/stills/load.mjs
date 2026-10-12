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
/** A census also counts less-followed shows, to show how far the sources reach. */
export const CENSUS_MIN_POPULARITY = 5_000
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
  const popular = titles.filter((t) => t.popularity >= (census ? CENSUS_MIN_POPULARITY : MIN_POPULARITY))
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

const lastOf = (numbers) => numbers.at(-1)

/**
 * Where to take the stills: { season, numbers, offset }. A finished show: its
 * first episodes. An airing one: the last aired. A whole-show match (a long
 * runner) takes the season airing now, and `offset` turns TMDB's episode in
 * that season into the catalog's episode count; without a coming episode to
 * count from it is skipped.
 */
async function episodesOf(get, show, title) {
  // A finished whole-show match may be a sequel inside an earlier season: its first episodes are not known.
  if (title.status === 'FINISHED') return show.whole ? { season: 0, numbers: [], offset: 0 } : { season: show.season, numbers: range(1, PER_SHOW), offset: 0 }
  const details = await get(`/tv/${show.id}`)
  const aired = details?.last_episode_to_air
  if (show.whole) {
    if (!aired || !title.nextEpisode) return { season: 0, numbers: [], offset: 0 }
    const offset = title.nextEpisode.number - 1 - aired.episode_number
    // Only episodes that are this title's own (a sequel filed inside an earlier season starts part way).
    return { season: aired.season_number, numbers: range(Math.max(1, aired.episode_number - PER_SHOW + 1, 1 - offset), aired.episode_number), offset }
  }
  const last = lastAired(details, show.season) ?? (title.nextEpisode ? title.nextEpisode.number - 1 : 0)
  return { season: show.season, numbers: range(Math.max(1, last - PER_SHOW + 1), last), offset: 0 }
}

/** TMDB's stills of a title, matching it first unless the ledger already knows it. */
async function fromTmdb(get, title, { cache, found, now, note }) {
  let show = cachedMatch(cache, title, now)
  if (show === 'miss') return note('no TMDB match (kept)'), []
  if (show === undefined) {
    show = await findShow(get, title, note)
    found[title.id] = show ? { ...show, at: now } : { miss: true, at: now }
    if (!show) return []
  }
  const { season, numbers, offset } = await episodesOf(get, show, title)
  if (!numbers.length) return note(`TMDB ${show.id}: no aired episode to take`), []
  const stills = await episodeStills(get, { id: show.id, season }, numbers)
  if (!stills.length) note(`TMDB ${show.id} season ${season}: no wide still for episodes ${numbers[0]} to ${lastOf(numbers)}`)
  return stills.map((still) => ({ ...still, number: still.number + offset }))
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
  const notes = []
  const note = (text) => notes.push(text)
  if (get) {
    try {
      const listed = await fromTmdb(get, title, { cache, found, now, note })
      const stills = await checkAll(listed, tools)
      if (listed.length && !stills.length) note(`${listed.length} TMDB stills failed the picture checks`)
      if (stills.length) return { source: 'TMDB', stills, notes }
    } catch (error) {
      say(`TMDB stills for ${title.title} could not be read (${error.message}).`)
    }
  }
  if (!title.malId) return { source: null, stills: [], notes }
  try {
    return { source: 'Kitsu', stills: await checkAll(await fromKitsu(title, { fetch }), tools), notes }
  } catch (error) {
    say(`Stills for ${title.title} could not be read (${error.message}).`)
    return { source: null, stills: [], notes }
  }
}

function sayCensus(rows, say) {
  for (const { title, source, stills, notes } of rows) {
    const what = stills.length ? ` from ${source}, episodes ${stills[0].number} to ${stills.at(-1).number}: ${stills.map((s) => s.url.split('/').pop()).join(' ')}` : ''
    say(`  ${title.title} [${title.popularity}]: ${stills.length} stills${what}${notes?.length ? ` (${notes.join('; ')})` : ''}`)
  }
  const line = (list, label) => {
    const count = (n) => list.filter((r) => r.stills.length >= n).length
    const from = (name) => list.filter((r) => r.source === name && r.stills.length).length
    return `${label}: ${list.length} shows; 1+ still ${count(1)}, 2+ (scenes) ${count(2)}, 5+ (collage) ${count(5)}, 8+ (grid) ${count(8)}; from TMDB ${from('TMDB')}, from Kitsu ${from('Kitsu')}`
  }
  say(`Stills census. ${line(rows, 'Airing or premiering')}. ${line(rows.filter((r) => r.title.popularity >= MIN_POPULARITY), `Popular enough to post (${MIN_POPULARITY}+)`)}.`)
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
  // A census looks wider than the posts go: only shows popular enough are offered to them.
  const out = rows.filter((r) => r.stills.length && r.title.popularity >= MIN_POPULARITY).map(({ title, source, stills }) => ({ titleId: title.id, finished: title.status === 'FINISHED', source, stills }))
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
