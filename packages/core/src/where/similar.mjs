/**
 * "You may also like" on every title page, and the "Anime like X" pages of
 * the famous few, worked out once at build time from the titles that have a
 * page, so the Worker never searches.
 *
 *   similarAll   id -> the closest anime by shared genres and tags
 *   likeListOf   one famous title's like list: AniList members' own
 *                recommendations first (a human vote), then the closest
 *                genre and tag matches, each with the reason it is there
 *   likePagesOf  which titles get a like page (the gate) and their lists
 *
 * Only titles that share at least two genres, or one genre and two tags, are
 * ever called similar: a loose match on "Action" alone is not an answer.
 *
 * Pure.
 */

/**
 * The candidates of each genre: its most watched titles, and as many again
 * and more drawn from the rest of the genre by each title's fixed spot
 * (link-spread.mjs spotOf), so a show outside the top few hundred can be
 * somebody's pick too.
 */
const POOL_TOP = 300
const POOL_REST = 700
/** How many matches a title keeps: the like page shows LIKE_MAX, the title page needs spares for its cap. */
export const SIMILAR_KEPT = 24
/** How many tags of a title count: AniList lists the strongest first. */
const TAGS_COUNTED = 8
export const SIMILAR_MAX = 6
export const LIKE_MAX = 16

import { spotOf, spreadDraw } from './link-spread.mjs'

const byPopularity = (a, b) => (b.popularity || 0) - (a.popularity || 0) || a.id - b.id

/** Shared genres and tags of two titles, and the score they make. */
export function closeness(a, b) {
  const genres = (a.genres || []).filter((g) => (b.genres || []).includes(g))
  const theirTags = new Set((b.tags || []).slice(0, TAGS_COUNTED))
  const tags = (a.tags || []).slice(0, TAGS_COUNTED).filter((t) => theirTags.has(t))
  const close = genres.length >= 2 || (genres.length >= 1 && tags.length >= 2)
  return { genres, tags, score: close ? genres.length * 2 + tags.length : 0 }
}

/**
 * items: the titles with a page. Returns id -> [{ id, genres, tags, score }],
 * best first, at most `max`, never the title itself. Closest first; among
 * equally close shows each title draws its own order (link-spread.mjs
 * spreadDraw), so the same famous few do not fill every page.
 */
export function similarAll(items, max = SIMILAR_KEPT) {
  const byGenre = new Map()
  for (const item of [...items].sort(byPopularity)) {
    for (const genre of item.genres || []) {
      if (!byGenre.has(genre)) byGenre.set(genre, [])
      byGenre.get(genre).push(item)
    }
  }
  const pools = new Map()
  for (const [genre, list] of byGenre) {
    const rest = list.slice(POOL_TOP).sort((a, b) => spotOf(a.id) - spotOf(b.id) || a.id - b.id).slice(0, POOL_REST)
    pools.set(genre, [...list.slice(0, POOL_TOP), ...rest])
  }
  const out = new Map()
  for (const item of items) {
    const seen = new Set([item.id])
    const found = []
    for (const genre of item.genres || []) {
      for (const other of pools.get(genre) || []) {
        if (seen.has(other.id)) continue
        seen.add(other.id)
        const c = closeness(item, other)
        if (c.score > 0) found.push({ id: other.id, genres: c.genres, tags: c.tags, score: c.score, draw: spreadDraw(item.id, other) })
      }
    }
    found.sort((a, b) => b.score - a.score || b.draw - a.draw || a.id - b.id)
    out.set(item.id, found.slice(0, max).map(({ draw: _d, ...row }) => row))
  }
  return out
}

/**
 * One title's like list: its AniList recommendations that have a page here,
 * best rated first, then the closest matches not already in it. Each row says
 * why it is there: { id, why: 'rec' | 'match', genres, tags }.
 */
export function likeListOf(item, similar, hasPage, max = LIKE_MAX) {
  const rows = []
  const seen = new Set([item.id])
  const recs = [...(item.recIds || [])].sort((a, b) => (b.rating || 0) - (a.rating || 0))
  for (const rec of recs) {
    if (rows.length >= max) break
    if (seen.has(rec.id) || !hasPage(rec.id)) continue
    seen.add(rec.id)
    rows.push({ id: rec.id, why: 'rec', genres: [], tags: [] })
  }
  for (const match of similar || []) {
    if (rows.length >= max) break
    if (seen.has(match.id)) continue
    seen.add(match.id)
    rows.push({ id: match.id, why: 'match', genres: match.genres, tags: match.tags })
  }
  return rows
}

/**
 * The like pages: only the `top` most popular titles, and of those only the
 * ones whose list reaches `min` anime. The long tail gets none, so no thin
 * page is ever built. Returns id -> like list.
 */
export function likePagesOf(items, similar, gate) {
  const ids = new Set(items.map((item) => item.id))
  const hasPage = (id) => ids.has(id)
  const out = new Map()
  for (const item of [...items].sort(byPopularity).slice(0, gate.top)) {
    const list = likeListOf(item, similar.get(item.id), hasPage)
    if (list.length >= gate.min) out.set(item.id, list)
  }
  return out
}
