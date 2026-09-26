/**
 * The pure half of the Amazon products (src/lib/picks.js): the rules, with the
 * data files handed in. picks.js binds them to the site's own data/picks.json
 * for the pages; a build script (scripts/make-where.mjs) reads picks.json and
 * product-picks.json itself and calls these directly, so both agree on every
 * rule.
 *
 * Two files, one shape:
 *   picks.json          chosen by hand (scripts/build-picks.mjs). Always wins.
 *   product-picks.json  matched from publisher records by
 *                       scripts/picks-from-products.mjs, for the titles nobody
 *                       picked by hand. It also lists `noEnglishBooks`: titles
 *                       that were checked and have no English print at all.
 *
 * data: { titles: { "<anilist id>": [pick] }, characters?: { ... }, noEnglishBooks?: [id] }
 * pick: { a: ASIN, n: short name, t: book | disc | figure | plush | poster | apparel | merch }
 */

export const US_HOST = 'www.amazon.com'

// The relations that are the same story in another form, or the next part of
// it. A reader on the manga page of a series wants the same volume 1 as a
// reader on its anime page. Checked in this order, so the closest one wins.
export const SAME_STORY = ['ADAPTATION', 'SOURCE', 'PARENT', 'PREQUEL', 'SEQUEL']

// What each type is called on the card.
export const PICK_LABELS = {
  book: 'Book',
  disc: 'Blu-ray / DVD',
  figure: 'Figure',
  plush: 'Plush',
  poster: 'Poster',
  apparel: 'Apparel',
  merch: 'Merch',
}

/**
 * The product page of one pick on amazon.com. The picks were made there, so
 * they always go to the US store, with the US tag when the site has one and
 * with no tag parameter at all when it does not (never an empty `tag=`).
 */
export function pickUrlFor(asin, tag) {
  const url = `https://${US_HOST}/dp/${encodeURIComponent(String(asin || ''))}`
  return tag ? `${url}?tag=${encodeURIComponent(tag)}` : url
}

const listIn = (data, id) => data?.titles?.[String(id)] || null

// The picks in one file for this title, or else for the same story in
// another form, with `from` naming that other title.
function storyPicksIn(data, item) {
  const own = listIn(data, item.id)
  if (own) return { picks: own, from: null }
  for (const relation of SAME_STORY) {
    const rel = (item.relations || []).find((r) => r.relation === relation && listIn(data, r.id))
    if (rel) return { picks: listIn(data, rel.id), from: rel.title || null }
  }
  return null
}

/**
 * The picks for one title, and which title they were picked for.
 *
 * `from` is null when the picks are the title's own. When they belong to the
 * same story in another form (the manga of this anime, the first season of
 * this sequel), `from` names that title, so a heading can say so instead of
 * pretending they were chosen for this exact page.
 *
 * The hand picks are searched first across the whole story, and only then the
 * matched ones. So a page that showed hand picks before still shows the same
 * ones: the manga of a hand-picked anime keeps the anime's picks rather than
 * its own single matched volume. `byHand` says which file they came from,
 * because the card must not claim a person chose what a script matched.
 */
export function picksForTitleIn(hand, item, products) {
  if (!item) return null
  const chosen = storyPicksIn(hand, item)
  if (chosen) return { ...chosen, byHand: true }
  const matched = storyPicksIn(products, item)
  return matched ? { ...matched, byHand: false } : null
}

// The "no English books" list as a Set, built once per data file.
const emptySets = new WeakMap()
function noBooksSet(products) {
  if (!products) return new Set()
  if (!emptySets.has(products)) emptySets.set(products, new Set((products.noEnglishBooks || []).map(Number)))
  return emptySets.get(products)
}

const hasBookPick = (hand, products, id) =>
  [hand, products].some((data) => (listIn(data, id) || []).some((pick) => pick.t === 'book'))

/**
 * Whether a "Shop books" search row is worth showing for this title.
 *
 * Most Amazon clicks that earned nothing were book searches for stories that
 * were never printed in English: the reader landed on a page of unrelated
 * books. So a title that was checked and has no English print loses the row.
 *
 * True when we know of a book for the title or for the same story in another
 * form (the manga behind an anime), and also when the title was never checked
 * at all: unknown is not the same as none, so those keep today's row.
 */
export function booksKnownIn(hand, item, products) {
  if (!item) return true
  if (!noBooksSet(products).has(Number(item.id))) return true
  if (hasBookPick(hand, products, item.id)) return true
  return (item.relations || []).some(
    (rel) => SAME_STORY.includes(rel.relation) && hasBookPick(hand, products, rel.id)
  )
}
