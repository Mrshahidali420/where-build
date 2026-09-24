/**
 * "Manhwa with an anime: where to watch every one."
 *
 * People type "where to watch manhwa anime", and Search Console showed the
 * /anime hub answering it from position 8, because no page said it outright.
 * The answer was already in the catalog. A comic record names the anime this
 * index holds for it (animeInIndex), its AniList relations say which of those
 * are real adaptations, and each anime record names the services licensed to
 * stream it (watchLinks). These lists join the three, one row per comic.
 *
 * One list per section where the answer is a list worth reading:
 * - manhwa: Korean comics that got an anime;
 * - manhua: Chinese comics that got an anime (a donghua, mostly);
 * - novel: light novels and web novels that got an anime.
 * Manga is left out on purpose. Most anime come from a manga, so that list
 * would be the anime catalog again in another order (4,425 rows on 24 Sep
 * 2026, over a hundred pages), and each anime page already names its manga.
 *
 * Pure: no catalog, no JSON, no fetch. The pages hand it the build's records
 * (src/lib/watch-list-data.js); a check script can hand it the live shards,
 * and both then count the same rows. tests/watch-lists.test.js covers it.
 */
import { sectionOf } from './section.mjs'
import { rankedRows } from './answers.mjs'

// Rows per page. Every page on the site carries a shell of about 115 KB
// (mostly the inlined stylesheet), and a row costs about 0.8 KB with its
// JSON-LD entry, so 40 rows keep a page near 150 KB. On 24 Sep 2026 that was
// 2 pages of manhwa (78 rows), 8 of manhua (307) and 23 of novels (894).
export const WATCH_PER_PAGE = 40

// A row names this many services and counts the rest ("+3 more").
export const PLATFORMS_SHOWN = 4

/**
 * Every list, by URL word. The URL word is the section's own folder name
 * (/manhwa, /manhua, /novel), so /where-to-watch/manhwa reads as the search
 * does. `many` is the plural a sentence uses, `short` the word in a heading.
 */
export const WATCH_LISTS = {
  manhwa: {
    section: 'manhwa',
    short: 'Manhwa',
    many: 'manhwa',
    one: 'manhwa',
    origin: 'Korean comics, most of them webtoons',
    title: 'Manhwa With an Anime: Where to Watch Every One Legally',
  },
  manhua: {
    section: 'manhua',
    short: 'Manhua',
    many: 'manhua',
    one: 'manhua',
    origin: 'Chinese comics, whose anime is often called a donghua',
    title: 'Manhua With an Anime: Where to Watch Every One Legally',
  },
  novel: {
    section: 'novel',
    short: 'Light novels',
    many: 'light novels',
    one: 'light novel',
    origin: 'light novels and web novels',
    title: 'Light Novels With an Anime: Where to Watch Every One Legally',
  },
}

export const WATCH_LIST_KEYS = Object.keys(WATCH_LISTS)

/** The public path of one list page. Page 1 has no /1 twin. */
export const watchListPath = (key, page = 1) =>
  page > 1 ? `/where-to-watch/${key}/${page}` : `/where-to-watch/${key}`

/**
 * AniList keeps each cover in three folders under one file name. The rows
 * show a thumbnail, so they take the 230-pixel copy, not the 460 one. Only
 * the folder changes: the file name is the same in all three.
 */
export const smallCover = (url) =>
  url && url.includes('/cover/large/') ? url.replace('/cover/large/', '/cover/medium/') : url || ''

/** The service names for one anime, cheapest for the viewer first, each once. */
export const platformNames = (show) => rankedRows(show?.watchLinks || []).map((row) => row.link.site)

/**
 * The AniList relations that make an anime "the anime of" a comic. ADAPTATION
 * is the plain case. ALTERNATIVE is the same story told again, and it is how
 * AniList files most webtoon anime: the manhwa and the anime both adapt one
 * web novel (Overgeared, A Returner's Magic Should Be Special, Who Made Me a
 * Princess). A shared character, a spin-off, a prequel film or a side story
 * is a different story, so those never count.
 */
export const SAME_STORY_ANIME = ['ADAPTATION', 'ALTERNATIVE']

/** The anime a comic's row can name: the ones this index holds for it that tell its story. */
export function adaptationsOf(item, animeBySlug) {
  const adapted = new Set(
    (item?.relations || [])
      .filter((r) => r.type === 'ANIME' && SAME_STORY_ANIME.includes(r.relation))
      .map((r) => r.id)
  )
  const seen = new Set()
  const shows = []
  for (const rel of item?.animeInIndex || []) {
    const show = rel && animeBySlug.get(rel.slug)
    if (!show || seen.has(show.slug) || !adapted.has(show.id)) continue
    seen.add(show.slug)
    shows.push(show)
  }
  return shows
}

const upcoming = (show) => show?.status === 'NOT_YET_RELEASED'

/**
 * The one anime a row leads with: one that streams somewhere before one that
 * does not, one already out before one still announced, then the one most
 * people have watched (usually the first season), then by address so the
 * choice never flickers between builds.
 */
export function mainAdaptation(shows) {
  const streams = (show) => ((show.watchLinks || []).length > 0 ? 1 : 0)
  return (
    [...shows].sort(
      (a, b) =>
        streams(b) - streams(a) ||
        Number(upcoming(a)) - Number(upcoming(b)) ||
        (b.popularity || 0) - (a.popularity || 0) ||
        (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0)
    )[0] || null
  )
}

/** One row: the comic, the anime it leads with, and where that anime streams. */
export function watchRow(item, shows) {
  const main = mainAdaptation(shows)
  if (!main) return null
  return {
    id: item.id,
    title: item.title,
    path: `/${sectionOf(item)}/${item.slug}`,
    cover: smallCover(item.cover),
    popularity: item.popularity || 0,
    anime: {
      title: main.title,
      path: `/anime/${main.slug}`,
      // The anime page's "Watch it on" table carries this id.
      watchPath: `/anime/${main.slug}#watch`,
      year: main.startYear || main.seasonYear || null,
      // Announced, not aired yet: the row says so rather than implying it plays today.
      upcoming: upcoming(main),
      // Every service, in order. The row prints PLATFORMS_SHOWN of them.
      platforms: platformNames(main),
    },
    moreAnime: shows.length - 1,
  }
}

/**
 * Every list at once, in one pass over the titles: { manhwa: [rows], ... },
 * each most popular first. `titles` is every comic and novel; `anime` every
 * anime record. An anime this build does not hold (blocked, or dropped) is
 * never named, so a row can never link to a page that is not there.
 */
export function buildWatchLists(titles, anime) {
  const animeBySlug = new Map()
  for (const show of anime || []) if (show && show.slug) animeBySlug.set(show.slug, show)
  const lists = Object.fromEntries(WATCH_LIST_KEYS.map((key) => [key, []]))
  for (const item of titles || []) {
    if (!item || item.kind === 'anime' || !(item.animeInIndex || []).length) continue
    const key = WATCH_LIST_KEYS.find((k) => WATCH_LISTS[k].section === sectionOf(item))
    if (!key) continue
    const row = watchRow(item, adaptationsOf(item, animeBySlug))
    if (row) lists[key].push(row)
  }
  for (const key of WATCH_LIST_KEYS) {
    lists[key].sort((a, b) => b.popularity - a.popularity || (a.path < b.path ? -1 : a.path > b.path ? 1 : 0))
  }
  return lists
}

/** How many pages a list needs. An empty list still has its first page. */
export const watchPageCount = (rows, perPage = WATCH_PER_PAGE) =>
  Math.max(1, Math.ceil((rows?.length || 0) / perPage))

/** The rows on one page, 1-based. */
export const watchPage = (rows, page, perPage = WATCH_PER_PAGE) =>
  (rows || []).slice((page - 1) * perPage, page * perPage)

/** Rows whose anime names at least one official service. */
export const streamingCount = (rows) => (rows || []).filter((row) => row.anime.platforms.length > 0).length

/**
 * The services that come up most across a list, most first: the one-line
 * answer to "where do most of these stream". Counts one per row.
 */
export function topServices(rows, limit = 4) {
  const tally = new Map()
  for (const row of rows || []) {
    for (const name of row.anime.platforms) tally.set(name, (tally.get(name) || 0) + 1)
  }
  return [...tally.entries()]
    .sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))
    .slice(0, limit)
    .map(([name, count]) => ({ name, count }))
}
