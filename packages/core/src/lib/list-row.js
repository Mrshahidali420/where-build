// The shape of one "My list" row and of one "For you" pool entry, shared by
// the build (scripts/make-shards.mjs writes them) and the browser (list-data.js,
// my-list.js and feed-core.js read them). Both sides must agree on every
// position, so the positions live here and nowhere else.
//
// Rows are arrays, not objects, for the same reason the search slices are:
// at ~107,000 titles the repeated key names would weigh more than the data.

/**
 * One row of /d/l/<n>.json, keyed by AniList id:
 *
 *   [ ns, slug, status, nextAt, nextNum, count, [sites], popularity,
 *     srcId, [adaptIds], [recIds] ]
 *
 *   ns        the site section: manhwa, manga, manhua, novel or anime
 *   status    AniList's own word: RELEASING, FINISHED, HIATUS, ...
 *   nextAt    unix seconds of the next episode, 0 when none is known
 *   nextNum   that episode's number, 0 when none
 *   count     chapters for a comic, episodes for an anime, 0 when unknown
 *   sites     up to four official platforms, by name
 *   srcId     for an anime, the comic it was made from (0 when none held)
 *   adaptIds  for a comic, up to two anime made from it
 *   recIds    up to four AniList reader picks that we also hold
 */
export const ROW = Object.freeze({
  NS: 0,
  SLUG: 1,
  STATUS: 2,
  NEXT_AT: 3,
  NEXT_NUM: 4,
  COUNT: 5,
  SITES: 6,
  POP: 7,
  SRC: 8,
  ADAPT: 9,
  RECS: 10,
})

export const ROW_SITES_MAX = 4
export const ROW_ADAPT_MAX = 2
export const ROW_RECS_MAX = 4

/**
 * One entry of the pool in /d/feed.v1.json:
 *
 *   [ id, nsIndex, slug, title, cover, score, popularity,
 *     [genreIndex], [tagIndex], [relIds] ]
 *
 * nsIndex points into SECTIONS order (section.mjs), genre and tag indexes
 * into the pool's own `genres` and `tags` arrays. The cover is only the file
 * name when it lives on AniList's CDN (see coverFileOf below).
 */
export const POOL = Object.freeze({
  ID: 0,
  NS: 1,
  SLUG: 2,
  TITLE: 3,
  COVER: 4,
  SCORE: 5,
  POP: 6,
  GENRES: 7,
  TAGS: 8,
  REL: 9,
})

// Every AniList cover shares one long address; only the file name differs.
// The same trick the search slices use (src/lib/search-shards.js).
const COVER_HEAD = /^https:\/\/s4\.anilist\.co\/file\/anilistcdn\/media\/(?:manga|anime)\/cover\/(?:large|medium|small)\//
const COVER_BASE = 'https://s4.anilist.co/file/anilistcdn/media/'

/** The bare file name of an AniList cover, or the whole URL for any other. */
export function coverFileOf(url) {
  const text = String(url || '')
  return COVER_HEAD.test(text) ? text.replace(COVER_HEAD, '') : text
}

/**
 * The full cover address back from what coverFileOf() kept. `size` picks
 * AniList's folder: medium is 230 px wide, which is what a card shows.
 */
export function coverFrom(ns, file, size = 'medium') {
  const text = String(file || '')
  if (!text) return ''
  if (/^https:\/\//.test(text)) return text
  return `${COVER_BASE}${ns === 'anime' ? 'anime' : 'manga'}/cover/${size}/${text}`
}

/** The lighter "medium" copy of a full AniList cover URL. Other URLs pass. */
export const mediumCover = (url) =>
  String(url || '').replace(/\/cover\/(?:large|small)\//, '/cover/medium/')
