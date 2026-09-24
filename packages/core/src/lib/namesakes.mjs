/**
 * Characters who share one name.
 *
 * The short address goes to whichever character got the name first, not to
 * the famous one. So /character/percival is a Fate side character with ten
 * favourites, while the Seven Deadly Sins Percival (168 favourites) sits on
 * /character/percival-seven-deadly-sins, and Google shows the wrong one to a
 * reader who searched for the right one. Search Console showed the same for
 * Migi, Aldebaran and Asa (tasks/gsc-internal-links.md, Table B).
 *
 * Every page in such a group lists the others as "Percival from The Seven
 * Deadly Sins", most-loved first. That is the exact search people type, and a
 * real link to the page they wanted. On a page whose character is NOT the
 * best known of the name, the list moves up under the title, so a reader who
 * landed on the wrong Percival finds the right one before scrolling.
 *
 * It needs every character page at once, which the Worker never has, so
 * scripts/make-shards.mjs works it out and stores it in each record.
 */

// Six is enough to find the one you meant. A name like "Luna" has dozens of
// owners, and past the first few the rest are faces nobody searched for.
export const NAMESAKES_MAX = 6

/**
 * The name with case, accents, punctuation and spacing folded away, so
 * "Jin-Woo", "jin woo" and "Jin  Woo" are one name.
 */
export const nameKey = (name) =>
  String(name || '')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()

// "Less known" needs a real gap, not 3 favourites against 2: the note under
// the title pushes the page's own facts down, so it is kept for pages whose
// name clearly belongs to someone else. At least twice the favourites AND ten
// more. Migi 6 vs 2,969, Percival 10 vs 168, Asa 24 vs 233 all pass.
const FAME_RATIO = 2
const FAME_MARGIN = 10
export const isLessKnown = (own, top) => top >= own * FAME_RATIO && top - own >= FAME_MARGIN

/**
 * The part of a story's name people type: "The Seven Deadly Sins" for "The
 * Seven Deadly Sins: Four Knights of the Apocalypse", "Re:ZERO" for "Re:ZERO
 * -Starting Life in Another World- Ex". The name up to its first subtitle.
 */
export function storyName(title) {
  const full = String(title || '').trim()
  return full.split(/\s[-–—~]\s?|:\s/)[0].trim() || full
}

const favesOf = (person) => person.favourites || 0
const appearancesOf = (person) => (person.appearsIn || []).length

/** Most-loved first, then most appearances, then by address so the order never flickers. */
export function byFame(a, b) {
  return (
    favesOf(b) - favesOf(a) ||
    appearancesOf(b) - appearancesOf(a) ||
    (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0)
  )
}

/**
 * The namesake list of every character page that has one.
 *
 * `nameOf(person)` gives the name the page leads with, `cardOf(person, name)`
 * the small card stored for each namesake. Returns a Map of slug to
 * `{ namesakes, lessKnown }`. `lessKnown` is true when the best-known owner of
 * the name is clearly better known than this one (isLessKnown): the page
 * tells the reader so, near the top. Two unknown namesakes both keep the list
 * down the page.
 *
 * Pure: the records are read, never changed.
 */
export function groupNamesakes(pages, { nameOf, cardOf, max = NAMESAKES_MAX }) {
  const groups = new Map()
  for (const person of pages) {
    const name = nameOf(person)
    const key = nameKey(name)
    if (!key) continue
    const group = groups.get(key) || []
    if (!groups.has(key)) groups.set(key, group)
    group.push({ person, name })
  }

  const result = new Map()
  for (const group of groups.values()) {
    if (group.length < 2) continue
    const sorted = [...group].sort((a, b) => byFame(a.person, b.person))
    // One card per address: a duplicate record on the same slug is one page.
    const seen = new Set()
    const unique = sorted.filter(({ person }) => !seen.has(person.slug) && seen.add(person.slug))
    if (unique.length < 2) continue
    const cards = unique.map(({ person, name }) => ({ slug: person.slug, card: cardOf(person, name) }))
    const topFaves = favesOf(unique[0].person)
    for (const { person } of unique) {
      const namesakes = cards.filter((c) => c.slug !== person.slug).slice(0, max).map((c) => c.card)
      result.set(person.slug, { namesakes, lessKnown: isLessKnown(favesOf(person), topFaves) })
    }
  }
  return result
}

/**
 * The link text: "Percival from The Seven Deadly Sins", the search itself.
 * A namesake with no known story is just its name.
 */
export const namesakeLabel = (card) => (card.series ? `${card.name} from ${card.series}` : card.name)
