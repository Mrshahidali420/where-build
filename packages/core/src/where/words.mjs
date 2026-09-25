/**
 * AniList's enum values as a reader says them, and the few date and number
 * phrases every Where page shares. Pure: the build and the Worker both load it.
 */

const FORMATS = {
  TV: 'TV series',
  TV_SHORT: 'TV short',
  MOVIE: 'Movie',
  SPECIAL: 'Special',
  OVA: 'OVA',
  ONA: 'ONA',
  MUSIC: 'Music video',
}
export const formatWord = (format) => FORMATS[format] || 'Anime'
/** The format inside a sentence: 'TV series', 'OVA' and 'ONA' keep their capitals, 'movie' does not. */
export const formatInSentence = (format) => formatWord(format).replace(/^(Movie|Special|Anime|Music video)$/, (word) => word.toLowerCase())

const STATUSES = {
  FINISHED: 'Finished',
  RELEASING: 'Airing',
  NOT_YET_RELEASED: 'Not yet aired',
  CANCELLED: 'Cancelled',
  HIATUS: 'On hiatus',
}
export const statusWord = (status) => STATUSES[status] || 'Unknown'

const SEASONS = { WINTER: 'Winter', SPRING: 'Spring', SUMMER: 'Summer', FALL: 'Fall' }
export const seasonWord = (season, year) => (SEASONS[season] && year ? `${SEASONS[season]} ${year}` : year ? String(year) : '')

const SOURCES = {
  ORIGINAL: 'Original',
  MANGA: 'Manga',
  LIGHT_NOVEL: 'Light novel',
  VISUAL_NOVEL: 'Visual novel',
  VIDEO_GAME: 'Video game',
  NOVEL: 'Novel',
  WEB_NOVEL: 'Web novel',
  DOUJINSHI: 'Doujinshi',
  ANIME: 'Anime',
  COMIC: 'Comic',
  LIVE_ACTION: 'Live action',
  GAME: 'Game',
  MULTIMEDIA_PROJECT: 'Multimedia project',
  PICTURE_BOOK: 'Picture book',
  OTHER: 'Other',
}
export const sourceWord = (source) => SOURCES[source] || ''

const ROLES = { MAIN: 'Main', SUPPORTING: 'Supporting', BACKGROUND: 'Background' }
export const castRoleWord = (role) => ROLES[role] || ''

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** Unix seconds -> "7 Apr 2013" (UTC, so a cached page says the same to everyone). */
export function airDate(at) {
  if (!at) return ''
  const d = new Date(at * 1000)
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`
}

/** Unix seconds -> "2013-04-07", for <time datetime>. */
export const isoDate = (at) => (at ? new Date(at * 1000).toISOString().slice(0, 10) : '')

/** [2013, 4, 7] -> "7 Apr 2013"; [2013, 4] -> "Apr 2013"; [2013] -> "2013". */
export function partialDate(parts) {
  const [y, m, d] = Array.isArray(parts) ? parts : []
  if (!y) return ''
  if (!m) return String(y)
  return d ? `${d} ${MONTHS[m - 1]} ${y}` : `${MONTHS[m - 1]} ${y}`
}

/** A staff.json date { year, month, day } -> "9 Feb 1973", whatever parts are known. */
export function birthWords(date) {
  if (!date) return ''
  const { year, month, day } = date
  if (month && day) return year ? `${day} ${MONTHS[month - 1]} ${year}` : `${day} ${MONTHS[month - 1]}`
  return year ? String(year) : ''
}

/** A catalog synopsis (plain text, blank lines between paragraphs) as paragraphs. */
export const paragraphs = (text) =>
  String(text || '')
    .split(/\n\s*\n/)
    .map((part) => part.replace(/\s+/g, ' ').trim())
    .filter(Boolean)

export const plural = (n, word, many = `${word}s`) => `${Number(n).toLocaleString('en-US')} ${n === 1 ? word : many}`
