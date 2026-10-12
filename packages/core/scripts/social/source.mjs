/**
 * The site's anime for the Facebook Page poster.
 *
 * Data source (decided 12 Oct 2026): three R2 objects the nightly deploy
 * already reads or writes, pulled with the same read-only Cloudflare token
 * (wrangler, packages/core/scripts/sister-data-io.mjs). The runner never loads
 * the live site and never calls AniList.
 *
 *   <catalog bucket>/latest/anime.json.gz     the anime records
 *   <data bucket>/<state>/where-links.json    id -> slug of every anime page in
 *                                              the last deploy's sitemap: live
 *                                              and indexable (noindexed pages
 *                                              leave the sitemap)
 *   <data bucket>/latest/airing.json           the episode schedule (the
 *                                              /schedule page's data)
 *
 * Without Cloudflare credentials (a local run) it reads sites/anime/data/
 * instead, when those files are there.
 *
 * Promoted: an anime with a live, indexable page, a cover and at least one
 * official English or worldwide streaming site; never adult, never a record
 * carrying a BLOCKED_TAGS tag or genre (Facebook bans adult content).
 */
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { gunzipSync } from 'node:zlib'
import { freeSplit } from '../../src/lib/answers.mjs'
import { BLOCKED_TAGS } from '../../src/lib/prose.mjs'
import { dayOf } from './ledger.mjs'
import { storyOf } from './story.mjs'

export { BLOCKED_TAGS }

const DAY_MS = 86_400_000
/** A NEW "airing" item: an episode in the next this-many hours. */
export const AIRING_HOURS = 30
/** A NEW "running" item: AniList touched it in the last this-many days. */
export const RUNNING_DAYS = 3
/** Floors that keep obscure titles off the Page. */
export const MIN_POPULARITY = { airing: 3000, running: 8000, old: 15000 }
const OLD_POOL = 1500

const SHOW = { TV: 'TV anime', TV_SHORT: 'short anime', MOVIE: 'anime film', ONA: 'web anime', OVA: 'OVA', SPECIAL: 'anime special' }

export const isBlocked = (name) => BLOCKED_TAGS.has(name) || /boys' love|girls' love/i.test(name || '')

/** Official sites an English-speaking viewer can use, one per site name. */
export function platformsOf(links = []) {
  const seen = new Set()
  const out = []
  for (const link of links) {
    if (!link?.site || !link.url) continue
    if (link.language && !/english/i.test(link.language)) continue
    if (seen.has(link.site)) continue
    seen.add(link.site)
    out.push(link.site)
  }
  return out
}

/**
 * Every official site the title page lists, one per site name, the ones an
 * English speaker can use first: [{ site, language, free }]. `free` is the
 * site's own "free to start" fact (src/lib/answers.mjs freeSplit).
 */
export function placesOf(links = []) {
  const usable = links.filter((link) => link?.site && link.url)
  const free = new Set(freeSplit(usable).free.map((row) => row.link.site))
  const english = (link) => !link.language || /english/i.test(link.language)
  const bySite = new Map()
  for (const link of [...usable.filter(english), ...usable.filter((l) => !english(l))]) {
    if (!bySite.has(link.site)) bySite.set(link.site, { site: link.site, language: english(link) ? null : link.language, free: free.has(link.site) })
  }
  return [...bySite.values()]
}

export const isSafe = (item) =>
  !item.isAdult && ![...(item.genres || []), ...(item.tags || [])].some((t) => isBlocked(typeof t === 'string' ? t : t?.name))

/**
 * The next episode per AniList id from the schedule: the earliest row still
 * to come. Returns Map(id -> { number, at(ms) }).
 */
export function nextEpisodes(schedule = [], now) {
  const next = new Map()
  for (const row of schedule) {
    const at = row.at * 1000
    if (!row.mediaId || !row.episode || at <= now) continue
    const seen = next.get(row.mediaId)
    if (!seen || at < seen.at) next.set(row.mediaId, { number: row.episode, at })
  }
  return next
}

/**
 * One catalog record as a candidate, or null when it may not be promoted.
 * @param slugs Map/object AniList id -> live page slug (where-links.json)
 * @param upcoming Map from nextEpisodes()
 */
export function toCandidate(item, slugs, upcoming = new Map(), shopFor = null) {
  const entry = toEntry(item, slugs, upcoming, shopFor)
  return entry && entry.platforms.length ? entry : null
}

const startOf = (item) =>
  Array.isArray(item.startDate) && item.startDate[0] ? { year: item.startDate[0], month: item.startDate[1] || null, day: item.startDate[2] || null, precision: item.startPrecision || null } : null

/** The main cast with a real picture (the template posts draw them). */
const castOf = (item) =>
  (item.characters || [])
    .filter((c) => c?.role === 'MAIN' && c.name && c.image && !/\/default\./.test(c.image))
    .map((c) => ({ id: c.id, name: c.name, image: c.image, voice: c.voice || null, voiceEn: c.voiceEn || null }))

/**
 * One catalog record with a live, safe page, whether or not it streams
 * anywhere yet. The template posts (types/) read these: an anime that has
 * not started has a page and a date long before it has a streaming site.
 * toCandidate() is the same record held to the streaming rule.
 */
export function toEntry(item, slugs, upcoming = new Map(), shopFor = null) {
  const slug = slugs?.[item?.id] ?? slugs?.[String(item?.id)]
  if (!slug || item.kind !== 'anime' || !item.title || !item.cover || !isSafe(item)) return null
  const platforms = platformsOf(item.watchLinks)
  const fromRecord = item.nextEpisode?.at && item.nextEpisode?.number ? { number: item.nextEpisode.number, at: item.nextEpisode.at * 1000 } : null
  return {
    // Rating, another name, a short synopsis (story.mjs) and the site's shop pick (shop.mjs).
    ...storyOf(item),
    shop: shopFor ? shopFor(item) : null,
    format: item.format || null,
    source: item.source || null,
    start: startOf(item),
    season: item.season && item.seasonYear ? { name: item.season, year: item.seasonYear } : null,
    planning: item.readers?.planning || 0,
    ranks: (item.ranks || []).filter((r) => r?.allTime && r.rank > 0).map((r) => ({ rank: r.rank, type: r.type })),
    cast: castOf(item),
    id: item.id,
    // MyAnimeList's id: Kitsu's stills are found by it (stills/kitsu.mjs).
    malId: item.malId || null,
    slug,
    title: item.title,
    path: `/anime/${slug}`,
    image: item.cover,
    // Wide key art, when the record has it (the airing time card).
    banner: item.banner || null,
    section: 'anime',
    verb: 'watch',
    noun: SHOW[item.format] || 'anime',
    year: item.startYear || null,
    endYear: item.endYear || null,
    status: item.status || null,
    chapters: null,
    episodes: item.episodes || null,
    score: item.score || null,
    genres: (item.genres || []).filter((g) => !isBlocked(g)),
    platforms,
    places: placesOf(item.watchLinks),
    studio: String(item.studios?.[0] || '').trim() || null,
    nextEpisode: upcoming.get(item.id) || fromRecord,
    popularity: item.popularity || 0,
    updatedAt: (item.updatedAt || 0) * 1000,
    recIds: (item.recIds || []).map((r) => r.id),
    recs: [],
  }
}

/** Turns between two lists, so episode news and running series share the NEW slots. */
export function alternate(a, b) {
  const out = []
  for (let i = 0; i < Math.max(a.length, b.length); i += 1) {
    if (i < a.length) out.push(a[i])
    if (i < b.length) out.push(b[i])
  }
  return out
}

function attachRecs(candidate, byId) {
  const own = candidate.title.toLowerCase()
  const recs = []
  for (const id of candidate.recIds) {
    const rec = byId.get(id)
    if (!rec) continue
    const t = rec.title.toLowerCase()
    if (t.includes(own) || own.includes(t)) continue
    recs.push({ title: rec.title })
    if (recs.length === 3) break
  }
  return { ...candidate, recs }
}

/**
 * NEW: episodes airing in the next AIRING_HOURS (most popular first), then
 * series still airing that AniList updated in the last RUNNING_DAYS.
 * OLD: the most popular anime.
 * TODAY: the episodes still to air on this posting day, most popular first;
 * the picker puts them before everything else when the day is short of room.
 */
export const buildPools = (items, now, slugs, schedule = [], shopFor = null) => poolsOf(buildData(items, now, slugs, schedule, shopFor), now)

/**
 * What the template posts read: every safe title with a live page (streaming
 * or not), the same list by AniList id, and the airing schedule.
 */
export function buildData(items, now, slugs, schedule = [], shopFor = null) {
  const upcoming = nextEpisodes(schedule, now)
  const titles = items.map((item) => toEntry(item, slugs, upcoming, shopFor)).filter(Boolean)
  return { now, titles, byId: new Map(titles.map((t) => [t.id, t])), schedule }
}

function poolsOf(data, now) {
  const all = data.titles.filter((t) => t.platforms.length)
  const byId = new Map(all.map((c) => [c.id, c]))
  const withRecs = all.map((c) => attachRecs(c, byId))
  const byPop = (x, y) => y.popularity - x.popularity

  const airing = withRecs
    .filter((c) => c.nextEpisode && c.nextEpisode.at > now && c.nextEpisode.at <= now + AIRING_HOURS * 3_600_000 && c.popularity >= MIN_POPULARITY.airing)
    .sort(byPop)
  const airingIds = new Set(airing.map((c) => c.id))
  const running = withRecs
    .filter((c) => !airingIds.has(c.id) && c.status === 'RELEASING' && c.updatedAt >= now - RUNNING_DAYS * DAY_MS && c.popularity >= MIN_POPULARITY.running)
    .sort(byPop)
  const old = withRecs.filter((c) => c.popularity >= MIN_POPULARITY.old).sort(byPop).slice(0, OLD_POOL)
  const day = dayOf(now)
  const today = airing.filter((c) => dayOf(c.nextEpisode.at) === day)
  return { new: alternate(airing, running), old, today }
}

const readJsonFile = (file) => JSON.parse(readFileSync(file, 'utf8'))

/** The three objects from R2 (CI), or the site's data folder (local). */
async function readData() {
  const { haveCredentials, pullObject, CATALOG_BUCKET, DATA_BUCKET } = await import('../sister-data-io.mjs')
  const { default: config } = await import('../../src/lib/site.mjs')
  if (!haveCredentials()) {
    const dir = join(process.cwd(), 'data')
    if (!existsSync(join(dir, 'anime.json'))) throw new Error('no Cloudflare credentials and no local data/anime.json')
    const where = join(dir, 'where-links.json')
    const airing = join(dir, 'airing.json')
    return {
      items: readJsonFile(join(dir, 'anime.json')),
      slugs: existsSync(where) ? readJsonFile(where).anime : await localSlugs(dir),
      schedule: existsSync(airing) ? readJsonFile(airing).schedule || [] : [],
      from: 'local data/ folder',
    }
  }
  const tmp = mkdtempSync(join(tmpdir(), 'fb-post-'))
  try {
    const get = async (bucket, key) => {
      const file = join(tmp, key.replace(/\//g, '_'))
      await pullObject(bucket, key, file)
      return file
    }
    const items = JSON.parse(gunzipSync(readFileSync(await get(CATALOG_BUCKET, 'latest/anime.json.gz'))).toString('utf8'))
    const slugs = readJsonFile(await get(DATA_BUCKET, `${config.r2.statePrefix}/where-links.json`)).anime || {}
    let schedule = []
    try {
      schedule = readJsonFile(await get(DATA_BUCKET, 'latest/airing.json')).schedule || []
    } catch {
      schedule = []
    }
    return { items, slugs, schedule, from: 'R2 (catalog, live page list, airing schedule)' }
  } finally {
    rmSync(tmp, { recursive: true, force: true })
  }
}

/** Local fallback: the live page list from the last build's sitemap data. */
async function localSlugs(dir) {
  const urls = join(dir, 'page-urls.json')
  const registry = join(dir, 'slug-registry.json')
  if (!existsSync(urls) || !existsSync(registry)) return {}
  const { whereLinksOf } = await import('../../src/where/where-links.mjs')
  return whereLinksOf({ registry: readJsonFile(registry), pageUrls: readJsonFile(urls), staff: {}, builtAt: 0 }).anime
}

/** The site's shop picks; a site without the files simply has no Amazon line. */
async function siteShop() {
  try {
    return (await import('./shop.mjs')).shopFinder()
  } catch {
    return null
  }
}

/** The data read once, as a function of the day it is looked at from (samples.mjs). */
export async function dataLoader() {
  const { items, slugs, schedule } = await readData()
  const shopFor = await siteShop()
  return (now) => buildData(items, now, slugs, schedule, shopFor)
}

/** The pools, and a line saying where they came from. */
export async function loadPools({ now = Date.now() } = {}) {
  const { items, slugs, schedule, from } = await readData()
  const data = buildData(items, now, slugs, schedule, await siteShop())
  return { pools: poolsOf(data, now), data, source: `${from}: ${items.length} anime, ${Object.keys(slugs).length} live pages, ${schedule.length} schedule rows` }
}
