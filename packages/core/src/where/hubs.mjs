/**
 * A Where site's hubs: the A to Z directories of its entity pages and the
 * anime-by-year lists, the pages that put every entity page within a few
 * clicks of the front door.
 *
 * The build writes the lists to data/where-hubs.json; the hub pages are
 * prerendered from that file, and the sitemap lists hubPaths() of the same
 * file. One function decides which hub pages exist, so the sitemap and the
 * pages cannot disagree.
 *
 * A row is an array, not an object: [name, href, count] for a directory,
 * [title, href, cover, format, episodes, season] for a year.
 *
 * Pure.
 */

export const PER_LETTER_PAGE = 200
export const PER_YEAR_PAGE = 60

/** The directories, by their URL folder under /directory. */
export const GROUPS = {
  'voice-actors': { label: 'Voice actors', noun: 'voice actor', many: 'voice actors', count: 'role' },
  staff: { label: 'Staff', noun: 'person', many: 'people', count: 'show' },
  studios: { label: 'Studios', noun: 'studio', many: 'studios', count: 'show' },
  artists: { label: 'Song artists', noun: 'artist', many: 'artists', count: 'song' },
  'watch-orders': { label: 'Watch orders', noun: 'franchise', many: 'franchises', count: 'entry' },
}

/** '0' holds every name that does not start with a Latin letter. */
export const LETTERS = ['0', ...'abcdefghijklmnopqrstuvwxyz']

export function letterOf(name) {
  const first = String(name || '')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .match(/[a-z0-9]/)?.[0]
  return first && first >= 'a' && first <= 'z' ? first : '0'
}

const byName = (a, b) => a[0].localeCompare(b[0], 'en', { sensitivity: 'base' }) || a[1].localeCompare(b[1])

/** rows [name, href, count] -> { top: the busiest `top`, letters: { letter: rows by name } }. */
export function directory(rows, top = 60) {
  const letters = {}
  for (const row of rows) (letters[letterOf(row[0])] ||= []).push(row)
  for (const list of Object.values(letters)) list.sort(byName)
  const busiest = [...rows].sort((a, b) => b[2] - a[2] || byName(a, b)).slice(0, top)
  return { top: busiest, letters }
}

const pagesOf = (count, per) => Math.max(1, Math.ceil(count / per))

/** Every hub page a set of hubs builds: [{ path, ...params }]. */
export function hubPaths(hubs) {
  const paths = []
  for (const [group, dir] of Object.entries(hubs.groups)) {
    paths.push({ path: `/directory/${group}`, group })
    for (const [letter, rows] of Object.entries(dir.letters)) {
      const pages = pagesOf(rows.length, PER_LETTER_PAGE)
      for (let page = 1; page <= pages; page++) {
        paths.push({ path: `/directory/${group}/${letter}${page > 1 ? `/${page}` : ''}`, group, letter, page, pages })
      }
    }
  }
  if (Object.keys(hubs.years).length) paths.push({ path: '/year' })
  for (const [year, rows] of Object.entries(hubs.years)) {
    const pages = pagesOf(rows.length, PER_YEAR_PAGE)
    for (let page = 1; page <= pages; page++) {
      paths.push({ path: `/year/${year}${page > 1 ? `/${page}` : ''}`, year, page, pages })
    }
  }
  paths.push({ path: '/anime' })
  if (hubs.schedule) paths.push({ path: '/schedule' })
  const seasons = hubs.seasonIndex || []
  if (seasons.length) paths.push({ path: '/season' })
  for (const s of seasons) paths.push({ path: s.path, key: s.key })
  const genres = hubs.genreIndex || []
  if (genres.length) paths.push({ path: '/genre' })
  for (const g of genres) {
    for (let page = 1; page <= g.pages; page++) {
      paths.push({ path: `/genre/${g.slug}${page > 1 ? `/${page}` : ''}`, slug: g.slug, page, pages: g.pages })
    }
  }
  return paths
}

/** The hub pages of one kind, for a page's getStaticPaths: 'season' | 'genre'. */
export const hubPathsOf = (hubs, prefix) => hubPaths(hubs).filter((p) => p.path.startsWith(`/${prefix}/`))

/** One page's slice of a list. */
export const pageSlice = (rows, page, per) => rows.slice((page - 1) * per, page * per)
