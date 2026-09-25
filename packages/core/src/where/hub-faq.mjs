/**
 * The questions a hub page answers (a genre, a season, a year, a mood), each
 * built from the rows the page itself lists: its leading shows, how many
 * there are and in what formats, and the studio behind most of them. The
 * page folds them under its list and puts the same words in its FAQPage
 * structured data (src/where/jsonld.mjs faqJsonld), so the two never
 * disagree. A question the rows cannot answer is left out, never padded.
 *
 * Pure: card rows in ([title, href, cover, format, episodes, season, studio],
 * src/where/outputs.mjs cardRow), [{ q, a }] out.
 */
import { plural } from './words.mjs'
import { listWords } from './hub-extras.mjs'

// A format word (words.mjs formatWord) inside a sentence, one and many.
const FORMAT_ONE = { Movie: 'movie', Special: 'special', 'Music video': 'music video', Anime: 'other' }
const FORMAT_MANY = { 'TV series': 'TV series', 'TV short': 'TV shorts', Movie: 'movies', Special: 'specials', OVA: 'OVAs', ONA: 'ONAs', 'Music video': 'music videos', Anime: 'others' }

/** "B comes next.", "B and C come next." */
const next = (names) => `${listWords(names)} ${names.length === 1 ? 'comes' : 'come'} next.`

/** The studios behind the most rows, most first: [[name, shows]], each with at least `min`. */
export function topStudios(rows, { max = 3, min = 2 } = {}) {
  const counts = new Map()
  for (const row of rows) if (row[6]) counts.set(row[6], (counts.get(row[6]) || 0) + 1)
  return [...counts]
    .filter(([, n]) => n >= min)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, max)
}

/** How the rows split by format, biggest first: "40 TV series, 8 movies and 3 ONAs", or '' when all are one format. */
export function formatSplit(rows) {
  const counts = new Map()
  for (const row of rows) if (row[3]) counts.set(row[3], (counts.get(row[3]) || 0) + 1)
  if (counts.size < 2) return ''
  const parts = [...counts]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([word, n]) => plural(n, FORMAT_ONE[word] || word, FORMAT_MANY[word] || `${word}s`))
  return listWords(parts)
}

/**
 * subject  how a question names the page's shows: "action anime",
 *          "Fall 2024 anime", "anime from 2019"
 * rows     the shows the page lists
 * total    how many the site holds under that subject (a genre lists only
 *          its most watched, so it can be more than rows.length)
 * order    'watched' when the rows are most watched first, 'fit' when they
 *          are best fit first (a mood)
 * site     the site's name
 * count    false when the page lists only a capped slice and the site holds
 *          no honest total (a mood): then "how many" is not asked
 */
export function hubFaq({ subject, rows, total = rows.length, order = 'watched', site, count = true }) {
  if (!rows.length) return []
  const out = []
  const lead = rows.slice(0, 3).map((row) => row[0])
  if (order === 'watched') {
    out.push({
      q: `What is the most watched ${subject}?`,
      a: `${lead[0]} is the most watched, going by how many AniList members have it on their list.${lead.length > 1 ? ` ${next(lead.slice(1))}` : ''}`,
    })
  } else {
    out.push({
      q: `Which ${subject} should I start with?`,
      a: `${listWords(lead)}: of the ${plural(rows.length, 'show')} on this list, ${lead.length === 1 ? 'it fits' : 'they fit'} best.`,
    })
  }

  const ranked = total > rows.length
  const split = formatSplit(rows)
  if (count) {
    out.push({
      q: `How many ${subject} are there?`,
      a:
        `${site} lists ${plural(total, 'show')}${ranked ? `, and this page ranks the ${rows.length.toLocaleString('en-US')} most watched` : ''}.` +
        (split ? ` ${ranked ? 'Those ranked are' : 'They are'} ${split}.` : ''),
    })
  }

  const studios = topStudios(rows)
  if (studios.length) {
    const most = studios[0][1]
    // A tie at the top is said as one: "A and B, with 39 shows each".
    const leaders = studios.filter(([, n]) => n === most).map(([name]) => name)
    const rest = studios.filter(([, n]) => n < most)
    const among = ranked ? ` of the ${rows.length.toLocaleString('en-US')} most watched` : ''
    out.push({
      q: `Which studio made the most ${subject}?`,
      a: `${listWords(leaders)}, with ${plural(most, 'show')}${leaders.length > 1 ? ' each' : ''}${among}.${rest.length ? ` ${next(rest.map(([s, m]) => `${s} (${m})`))}` : ''}`,
    })
  }
  return out
}
