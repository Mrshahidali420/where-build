import { platform } from './catalog.js'

// Browse-page filters. Every one is honest: it only narrows what the
// index already knows, it never promises data we do not have.
const linksOf = (item, kind) => (kind === 'anime' ? item.watchLinks : item.readLinks) || []

const hasFreeLink = (item, kind) =>
  linksOf(item, kind).some((l) => (platform(l.site).note || '').toLowerCase().includes('free'))

export const FILTERS = {
  official: {
    label: 'With official links',
    blurb: (word) => `Every ${word} here has at least one official platform you can open right now.`,
    keep: (item, kind) => linksOf(item, kind).length > 0,
  },
  free: {
    label: 'Free to start',
    blurb: (word) => `Every ${word} here is on at least one platform with a free tier or free chapters.`,
    keep: hasFreeLink,
  },
  completed: {
    label: 'Completed',
    blurb: (word) => `Finished stories only — start any ${word} here and read it to the end.`,
    keep: (item) => item.status === 'FINISHED',
  },
  ongoing: {
    label: 'Ongoing',
    blurb: (word) => `Still releasing. New chapters or episodes are coming for every ${word} here.`,
    keep: (item) => item.status === 'RELEASING',
  },
  movies: {
    label: 'Movies',
    blurb: (word) => `Feature films only — every ${word} here is an anime movie.`,
    keep: (item) => item.format === 'MOVIE',
    // Comics, novels and characters have no movie format, so this filter
    // only ever applies to the anime kind. Every place that loops over
    // FILTERS must skip a filter for a kind not listed here, instead of
    // relying on keep() to quietly return nothing.
    kinds: ['anime'],
  },
}

// The single place that honours a filter's `kinds` restriction. Every site
// that loops over FILTERS for a given kind should filter through this first,
// rather than re-checking `def.kinds` inline at each call site.
export const filtersFor = (kind) =>
  Object.entries(FILTERS).filter(([, def]) => !def.kinds || def.kinds.includes(kind))

// The filter listings keep a cap of 100 pages, and the main listings no longer
// do. The reason is duplication: /manhwa/only/free is a slice of the same
// titles /manhwa already lists in full, so a deep filter page adds a file
// without adding a title. The main listing is the path that has to reach
// everything, and now it does.
export const FILTER_MAX_PAGES = 100
