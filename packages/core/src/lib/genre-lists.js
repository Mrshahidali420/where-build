// BUILD TIME ONLY (imports catalog.js).
//
// The one place that decides what a genre holds, in what order, and which
// deeper genre pages exist. The genre routes and the sitemap both read it,
// so a sitemap row can never point at a page the build did not make.
//
// Order matters here. catalog.js keeps titles in file order, and file order
// is AniList id order, so a genre page built from ofGenre() opened on old,
// forgotten titles under a heading that said "most-read first". Every list
// below is cut from the popularity-sorted shelves instead.
import { comicsByPopularity, novelsByPopularity, animeByPopularity, genres } from './catalog.js'
import { FILTERS } from './filters.js'
import { sectionOf } from './section.mjs'
import { formatWord } from './format.js'

/** Titles per page on a genre listing, the same as every other listing. */
export const GENRE_PER_PAGE = 60

/**
 * Pages per kind per genre. Ten pages is the 600 most-read titles, which is
 * deeper than a reader goes, and it keeps the static file count bounded:
 * at most 18 genres x 5 kinds x 10 pages = 900 files, about 800 in practice.
 * Cloudflare's free plan allows ~20,000 static files per deploy.
 */
export const GENRE_MAX_PAGES = 10

/** How many covers each kind shows on the genre page itself. */
export const GENRE_SHOWN = 18

/** A kind gets its own listing only when it holds more than the genre page shows. */
const hasListing = (items) => items.length > GENRE_SHOWN

export const GENRE_KINDS = ['manhwa', 'manga', 'manhua', 'novel', 'anime']

export const KIND_LABEL = { manhwa: 'manhwa', manga: 'manga', manhua: 'manhua', novel: 'novels', anime: 'anime' }

/** How many of the most-read titles the "top rated" shelf picks from. */
const TOP_RATED_POOL = 500

/** A shelf page is built only when it has at least this many titles. */
export const SHELF_MINIMUM = 12

/** Titles on a shelf page. One page, no pagination: a shelf is a pick. */
export const SHELF_SIZE = 60

const linkKind = (item) => (item.kind === 'anime' ? 'anime' : sectionOf(item))

/**
 * The shelves drawn from a genre's read titles (comics and novels). Every
 * test except top-rated is the same one the /<kind>/only/<filter> pages use.
 */
export const SHELVES = {
  'top-rated': {
    heading: (name) => `Top rated ${name.toLowerCase()} comics`,
    label: 'Top rated',
    pick: (read) =>
      read
        .slice(0, TOP_RATED_POOL)
        .filter((item) => item.score)
        .sort((a, b) => b.score - a.score || b.popularity - a.popularity),
    blurb: (lower) =>
      `The highest AniList scores among the ${TOP_RATED_POOL} most-read ${lower} comics and novels.`,
  },
  completed: {
    heading: (name) => `Completed ${name.toLowerCase()} comics to binge`,
    label: 'Completed',
    pick: (read) => read.filter((item) => FILTERS.completed.keep(item, linkKind(item))),
    blurb: (lower) => `Finished ${lower} stories, most-read first. Start one and read it to the end.`,
  },
  ongoing: {
    heading: (name) => `Ongoing ${name.toLowerCase()} comics`,
    label: 'Ongoing',
    pick: (read) => read.filter((item) => FILTERS.ongoing.keep(item, linkKind(item))),
    blurb: (lower) => `${lower[0].toUpperCase()}${lower.slice(1)} series still releasing, most-read first.`,
  },
  free: {
    heading: (name) => `${name} comics free to start`,
    label: 'Free to start',
    pick: (read) => read.filter((item) => FILTERS.free.keep(item, linkKind(item))),
    blurb: (lower) =>
      `${lower[0].toUpperCase()}${lower.slice(1)} titles on at least one official platform with a free tier or free chapters.`,
  },
}

/**
 * A mixed grid works out each card's address from the record. Comics from a
 * country outside KR/JP/CN/TW live under /manga, but the card would link them
 * under /comic, so mixed shelves leave them out rather than print a dead link.
 */
const safeInMixedGrid = (item) => item.kind === 'anime' || formatWord(item) === sectionOf(item)

let cache = null

/** One pass over the catalog: genre name -> kind -> titles, most-read first. */
function build() {
  const map = new Map()
  const add = (item, kind) => {
    for (const name of item.genres || []) {
      let row = map.get(name)
      if (!row) {
        row = { manhwa: [], manga: [], manhua: [], novel: [], anime: [], read: [] }
        map.set(name, row)
      }
      row[kind].push(item)
    }
  }
  for (const item of comicsByPopularity) add(item, sectionOf(item))
  for (const item of novelsByPopularity) add(item, 'novel')
  for (const item of animeByPopularity) add(item, 'anime')

  // The read list merges the kinds back into one popularity order for the
  // shelves, which cut across manhwa, manga, manhua and novels.
  for (const row of map.values()) {
    row.read = [...row.manhwa, ...row.manga, ...row.manhua, ...row.novel]
      .filter(safeInMixedGrid)
      .sort((a, b) => b.popularity - a.popularity)
  }
  return map
}

/** Everything in one genre, split by kind, most-read first. */
export function genreLists(name) {
  if (!cache) cache = build()
  return cache.get(name) || { manhwa: [], manga: [], manhua: [], novel: [], anime: [], read: [] }
}

/** Pages of the /genre/<slug>/<kind> listing; 0 when the kind gets none. */
export const kindPageCount = (items) =>
  hasListing(items) ? Math.min(GENRE_MAX_PAGES, Math.ceil(items.length / GENRE_PER_PAGE)) : 0

/** The shelf's titles for one genre, capped at one page. */
export const shelfItems = (name, shelf) => SHELVES[shelf].pick(genreLists(name).read).slice(0, SHELF_SIZE)

/**
 * Every deeper genre page the build makes, as paths. The sitemap lists
 * exactly these, and the routes build exactly these.
 */
export function genreDeepPaths() {
  const out = []
  for (const g of genres) {
    const lists = genreLists(g.name)
    for (const kind of GENRE_KINDS) {
      const count = kindPageCount(lists[kind])
      for (let page = 1; page <= count; page++) {
        out.push({ path: page === 1 ? `/genre/${g.slug}/${kind}` : `/genre/${g.slug}/${kind}/${page}`, page })
      }
    }
    for (const shelf of Object.keys(SHELVES)) {
      if (shelfItems(g.name, shelf).length >= SHELF_MINIMUM) {
        out.push({ path: `/genre/${g.slug}/only/${shelf}`, page: 1 })
      }
    }
  }
  return out
}
