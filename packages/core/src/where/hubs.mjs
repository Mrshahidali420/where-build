/**
 * A Where site's hubs: the directories of its entity pages (ranked lists and
 * an A to Z) and the anime-by-year lists, the pages that put every entity
 * page within a few clicks of the front door.
 *
 * The build writes the lists to data/where-hubs.json; the hub pages are
 * prerendered from that file, and the sitemap lists hubPaths() of the same
 * file. One function decides which hub pages exist, so the sitemap and the
 * pages cannot disagree.
 *
 * A row is an array, not an object. A directory card is
 * [name, href, count, image, line, pop, year, span] (src/where/hub-cards.mjs);
 * a title card is [title, href, cover, format, episodes, season, studio].
 *
 * Pure.
 */

/** Cards on one page of a letter, and of a ranked list. */
export const PER_LETTER_PAGE = 96
export const PER_RANK_PAGE = 48
/** A ranked list stops here; the A to Z holds everyone. */
export const RANK_MAX = 480
/** A letter with fewer names than this is folded into the "#" page. */
export const MIN_LETTER = 12
export const PER_YEAR_PAGE = 60
/** A year with fewer shows than this is folded into an "earlier years" page. */
export const MIN_YEAR = 12

/** The sort a directory's front page shows. */
export const DEFAULT_SORT = 'popular'
/** Which card field a sort orders by (hub-cards.mjs): the count unless named here. */
const SORT_FIELD = { popular: 5, newest: 6, english: 5 }
/**
 * A sort that lists only some cards: "English dub" keeps the voice actors
 * whose roles are mostly in English (hub-cards.mjs voiceCard's ninth field),
 * most popular first.
 */
const SORT_KEEP = { english: (row) => row[8] === 'English' }

/**
 * The directories, by their URL folder under /directory. `sorts` are the
 * ranked lists each one offers, in tab order, the first the front page.
 */
export const GROUPS = {
  'voice-actors': {
    label: 'Voice actors',
    noun: 'voice actor',
    many: 'voice actors',
    count: 'role',
    lede: 'Every voice actor with a page here, with the role each is best known for and every character they voiced.',
    sorts: { popular: 'Most popular', roles: 'Most roles', english: 'English dub' },
    // A sort whose list is its own subject gets its own opening words.
    ledes: { english: 'The voices of English dubs: voice actors whose roles here are mostly in English, the most popular first, each with the character they are best known for.' },
  },
  staff: {
    label: 'Directors and staff',
    noun: 'person',
    many: 'people',
    count: 'show',
    lede: 'The directors, writers, designers, composers and animators behind the shows, each with the work they are best known for.',
    sorts: { popular: 'Most popular', shows: 'Most shows' },
  },
  studios: {
    label: 'Studios',
    noun: 'studio',
    many: 'studios',
    count: 'show',
    lede: 'Every animation studio with a page here, with the years it has been making anime and its best-known show.',
    sorts: { popular: 'Most watched', shows: 'Most shows', newest: 'Newest work' },
  },
  artists: {
    label: 'Song artists',
    noun: 'artist',
    many: 'artists',
    count: 'song',
    lede: 'The singers and bands behind anime openings and endings, each with their best-known song.',
    sorts: { popular: 'Most popular', songs: 'Most songs' },
  },
  'watch-orders': {
    label: 'Watch orders',
    noun: 'franchise',
    many: 'franchises',
    count: 'entry',
    lede: 'Every franchise with more than a couple of entries, in the order to watch it, with the years it spans and where to start.',
    sorts: { popular: 'Most watched', longest: 'Longest', newest: 'Newest entry' },
  },
}

/** '0' holds every name that does not start with a Latin letter, and the letters too thin for a page. */
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

/**
 * One directory from its cards:
 *   rows     every card, by name
 *   letters  { letter: [row index] }, a letter under `minLetter` folded into '0'
 *   merged   the letters folded into '0', so the A to Z can point them there
 *   sorts    { sort: [row index] }, best first, at most `rankMax`
 */
export function directory(rows, sorts = [DEFAULT_SORT], { minLetter = MIN_LETTER, rankMax = RANK_MAX } = {}) {
  const sorted = [...rows].sort(byName)
  const letters = {}
  sorted.forEach((row, i) => (letters[letterOf(row[0])] ||= []).push(i))
  const merged = []
  for (const letter of Object.keys(letters).sort()) {
    if (letter === '0' || letters[letter].length >= minLetter) continue
    merged.push(letter)
    ;(letters['0'] ||= []).push(...letters[letter])
    delete letters[letter]
  }
  letters['0']?.sort((a, b) => a - b)
  const ranked = {}
  for (const sort of sorts) {
    const field = SORT_FIELD[sort] ?? 2
    const keep = SORT_KEEP[sort] || (() => true)
    ranked[sort] = sorted
      .map((_, i) => i)
      .filter((i) => keep(sorted[i]))
      .sort((a, b) => (sorted[b][field] || 0) - (sorted[a][field] || 0) || (sorted[b][2] || 0) - (sorted[a][2] || 0) || a - b)
      .slice(0, rankMax)
  }
  return { total: rows.length, rows: sorted, letters, merged, sorts: ranked }
}

const pagesOf = (count, per) => Math.max(1, Math.ceil(count / per))

/**
 * The address of one page of a ranked list. The default sort's first page is
 * the directory's front, so it has no second address.
 */
export function sortPath(group, sort, page = 1) {
  if (sort === DEFAULT_SORT) return page > 1 ? `/directory/${group}/by/${sort}/${page}` : `/directory/${group}`
  return `/directory/${group}/by/${sort}${page > 1 ? `/${page}` : ''}`
}

/** The address of the letter page a letter's names are on: its own, or '#' when it was folded. */
export function letterPath(group, dir, letter) {
  if (dir.letters[letter]?.length) return `/directory/${group}/${letter}`
  if (dir.merged?.includes(letter) && dir.letters['0']?.length) return `/directory/${group}/0`
  return null
}

/**
 * Which years get a page of their own. Walking out from the current year, a
 * year keeps its page while it has at least `min` shows; the thin years
 * before that point share one "earlier" page, and those after it one "later"
 * page, each built only when it holds `min` shows itself.
 *   counts { year: shows }
 * Returns { own: [year], early: { key, label, years } | null, late: ... | null }.
 */
export function yearPlan(counts, { min = MIN_YEAR, current }) {
  const years = Object.keys(counts)
    .map(Number)
    .filter((y) => counts[y] > 0)
    .sort((a, b) => a - b)
  const own = []
  let floor = -Infinity
  for (const y of years.filter((y) => y <= current).reverse()) {
    if (counts[y] < min) {
      floor = y
      break
    }
    own.push(y)
  }
  let ceiling = Infinity
  for (const y of years.filter((y) => y > current)) {
    if (counts[y] < min) {
      ceiling = y
      break
    }
    own.push(y)
  }
  const bucket = (list, key, label) => (list.reduce((n, y) => n + counts[y], 0) >= min ? { key, label, years: list } : null)
  const earlyYears = years.filter((y) => y <= floor)
  const lateYears = years.filter((y) => y >= ceiling)
  return {
    own: own.sort((a, b) => b - a),
    early: earlyYears.length ? bucket(earlyYears, `before-${floor + 1}`, `Before ${floor + 1}`) : null,
    late: lateYears.length ? bucket(lateYears, `from-${ceiling}`, `${ceiling} and later`) : null,
  }
}

/** Every hub page a set of hubs builds: [{ path, ...params }]. */
export function hubPaths(hubs) {
  const paths = []
  for (const [group, dir] of Object.entries(hubs.groups)) {
    for (const [sort, list] of Object.entries(dir.sorts || { [DEFAULT_SORT]: [] })) {
      // A filtered list with nobody in it (no English voices yet) is no page.
      if (sort !== DEFAULT_SORT && !list.length) continue
      const pages = pagesOf(list.length, PER_RANK_PAGE)
      for (let page = 1; page <= pages; page++) paths.push({ path: sortPath(group, sort, page), group, sort, page, pages })
    }
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
  // The shop, the streaming services, the moods and the like pages: each only when its gate built it.
  if (hubs.shop) paths.push({ path: '/shop' })
  if (hubs.platforms) paths.push({ path: '/where-to-watch' })
  const moods = hubs.moodIndex || []
  if (moods.length) paths.push({ path: '/mood' })
  for (const m of moods) paths.push({ path: `/mood/${m.slug}`, slug: m.slug })
  for (const slug of Object.keys(hubs.like || {})) paths.push({ path: `/anime/${slug}/like`, slug })
  return paths
}

/** The hub pages of one kind, for a page's getStaticPaths: 'season' | 'genre'. */
export const hubPathsOf = (hubs, prefix) => hubPaths(hubs).filter((p) => p.path.startsWith(`/${prefix}/`))

/** One page's slice of a list. */
export const pageSlice = (rows, page, per) => rows.slice((page - 1) * per, page * per)
