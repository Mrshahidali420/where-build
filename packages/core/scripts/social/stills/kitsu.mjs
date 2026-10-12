/**
 * Kitsu (kitsu.io): the episode stills of an anime, through its public JSON
 * API. No key. Kitsu keeps one still per episode (a frame of the episode
 * itself), usually 1920x1080, for most shows soon after an episode airs.
 *
 *   GET /mappings?filter[externalSite]=myanimelist/anime&filter[externalId]=<MAL id>&include=item
 *       the Kitsu id of an anime from its MyAnimeList id (the catalog holds that)
 *   GET /anime/<id>/episodes?page[limit]=20&page[offset]=<n>
 *       its episodes, with each one's still (thumbnail.original)
 *
 * A still is rated like the episode it comes from (broadcast television), so
 * Kitsu gives no rating of its own; stills/quality.mjs checks each picture.
 */
export const HOST = 'https://kitsu.io/api/edge'
const TIMEOUT_MS = 15_000
const HEADERS = { accept: 'application/vnd.api+json', 'user-agent': 'page-poster/1.0 (Facebook Page of an anime site)' }
const PAGE = 20

async function get(path, { fetch = globalThis.fetch } = {}) {
  const res = await fetch(`${HOST}${path}`, { headers: HEADERS, signal: AbortSignal.timeout(TIMEOUT_MS) })
  if (!res.ok) throw new Error(`Kitsu answered ${res.status}`)
  return res.json()
}

/** The Kitsu id of an anime by its MyAnimeList id, or null. */
export async function kitsuIdOf(malId, options = {}) {
  if (!malId) return null
  const json = await get(`/mappings?filter[externalSite]=myanimelist/anime&filter[externalId]=${malId}&include=item`, options)
  const item = (json.included || []).find((i) => i.type === 'anime')
  return item ? { id: item.id, episodes: item.attributes?.episodeCount || null } : null
}

/** One Kitsu episode as a still, or null when it has none. */
export function toStill(episode) {
  const a = episode?.attributes || {}
  const url = a.thumbnail?.original
  if (!url || !a.number) return null
  return { id: `kitsu:${episode.id}`, number: a.number, url, title: a.canonicalTitle || null, airdate: a.airdate || null }
}

/** Pages looked at, from the end, before giving up on a long show whose last episodes have no still yet. */
const MAX_PAGES = 3

/**
 * The stills of the last `count` episodes that have one, oldest first.
 * The last page is found from the first answer's count; a show whose
 * listed future episodes have no still yet is read a page further back.
 */
export async function latestStills(kitsuId, { count = 8, ...options } = {}) {
  const first = await get(`/anime/${kitsuId}/episodes?page[limit]=${PAGE}`, options)
  const total = first.meta?.count || 0
  const found = []
  for (let page = 0, offset = total - PAGE; page < MAX_PAGES && found.length < count; page += 1, offset -= PAGE) {
    const answer = offset > 0 ? await get(`/anime/${kitsuId}/episodes?page[limit]=${PAGE}&page[offset]=${offset}`, options) : first
    found.push(...(answer.data || []).map(toStill).filter(Boolean))
    if (offset <= 0) break
  }
  return found.sort((x, y) => x.number - y.number).slice(-count)
}

/** The stills of the first `count` episodes (a finished show: no spoilers of how it ends). */
export async function firstStills(kitsuId, { count = 8, ...options } = {}) {
  const first = await get(`/anime/${kitsuId}/episodes?page[limit]=${PAGE}`, options)
  return (first.data || []).map(toStill).filter(Boolean).sort((x, y) => x.number - y.number).slice(0, count)
}
