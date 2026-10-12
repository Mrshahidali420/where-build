/**
 * The episode stills the scene, collage and still posts can use this hour
 * (types/scenes.mjs, types/collage.mjs, types/stills.mjs).
 *
 * A few popular shows are looked at each hour, in turns: the ones with an
 * episode today or tomorrow first, then the rest that are still airing.
 * For each, Kitsu's stills of the last episodes are fetched and checked
 * (stills/quality.mjs): too small, too dark, letterboxed, soft or a twin
 * of another frame, and it is left out. A source that fails gives no stills
 * this hour and nothing else.
 */
import { firstStills, kitsuIdOf, latestStills } from './kitsu.mjs'
import { distinct, judgeStill } from './quality.mjs'

/** Shows looked at each hour. */
export const PER_HOUR = 3
/** Stills fetched per show: the collage needs five, a few spare for the checks. */
export const PER_SHOW = 8
/** Only shows this many AniList users follow; a finished show needs more. */
export const MIN_POPULARITY = 30_000
export const MIN_POPULARITY_FINISHED = 150_000
const HOUR_MS = 3_600_000
const FETCH_TIMEOUT_MS = 20_000

/**
 * The shows whose turn it is: soon-airing first, then the rest still airing,
 * then the best-known finished ones, most popular first in each group.
 */
export function showsFor(titles, now, perHour = PER_HOUR) {
  const soon = (t) => t.nextEpisode && t.nextEpisode.at > now && t.nextEpisode.at <= now + 30 * HOUR_MS
  const airing = titles.filter((t) => t.malId && t.popularity >= MIN_POPULARITY && (soon(t) || t.status === 'RELEASING'))
  const finished = titles.filter((t) => t.malId && t.status === 'FINISHED' && t.popularity >= MIN_POPULARITY_FINISHED && (t.episodes || 0) > 1)
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

/**
 * The stills of this hour: [{ titleId, stills: [{ id, number, url, ratio, hash }] }], oldest episode first.
 * @param titles the site's titles, most popular first
 */
export async function loadStills({ now, titles, fetch = globalThis.fetch, say = () => {}, sharp = null }) {
  const tools = sharp || (await import('sharp')).default
  const out = []
  for (const title of showsFor(titles, now)) {
    try {
      const kitsu = await kitsuIdOf(title.malId, { fetch })
      if (!kitsu) continue
      const found = []
      // A finished show is shown from its first episodes, so a post never gives its ending away.
      const list = title.status === 'FINISHED' ? await firstStills(kitsu.id, { count: PER_SHOW, fetch }) : await latestStills(kitsu.id, { count: PER_SHOW, fetch })
      for (const still of list) {
        const good = await checked(still, { fetch, sharp: tools })
        if (good) found.push(good)
      }
      const stills = distinct(found)
      if (stills.length) out.push({ titleId: title.id, finished: title.status === 'FINISHED', stills })
    } catch (error) {
      say(`Stills for ${title.title} could not be read (${error.message}).`)
    }
  }
  say(`Stills this hour: ${out.map((s) => s.stills.length).reduce((a, b) => a + b, 0)} from ${out.length} shows (checked for size, darkness, black bars, softness and twins).`)
  return out
}

/** The extra every stills type carries (extras.mjs): one search, shared by the three. */
export const stillsExtra = {
  name: 'stills',
  load: ({ now, data, fetch, say }) => loadStills({ now, titles: [...(data.titles || [])].sort((x, y) => y.popularity - x.popularity), fetch, say }),
}

/** The stills of one title, and the title, for a type's find(). */
export const stillsOf = (data) => (data.stills || []).map((s) => ({ title: data.byId?.get(s.titleId), finished: Boolean(s.finished), stills: s.stills })).filter((s) => s.title)
