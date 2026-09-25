/**
 * The pure half of the hand-picked Amazon products (src/lib/picks.js): the
 * rules, with the picks file handed in. picks.js binds them to the site's own
 * data/picks.json for the pages; a build script (scripts/make-where.mjs) reads
 * the same file itself and calls these directly, so both agree on every rule.
 *
 * data: { titles: { "<anilist id>": [pick] }, characters: { ... } }
 * pick: { a: ASIN, n: short name, t: book | figure | plush | poster | apparel | merch }
 */

export const US_HOST = 'www.amazon.com'

// The relations that are the same story in another form, or the next part of
// it. A reader on the manga page of a series wants the same volume 1 as a
// reader on its anime page. Checked in this order, so the closest one wins.
export const SAME_STORY = ['ADAPTATION', 'SOURCE', 'PARENT', 'PREQUEL', 'SEQUEL']

// What each type is called on the card.
export const PICK_LABELS = {
  book: 'Book',
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

const titlePicksIn = (data, id) => data?.titles?.[String(id)] || null

/**
 * The picks for one title, and which title they were picked for.
 *
 * `from` is null when the picks are the title's own. When they belong to the
 * same story in another form (the manga of this anime, the first season of
 * this sequel), `from` names that title, so a heading can say so instead of
 * pretending they were chosen for this exact page.
 */
export function picksForTitleIn(data, item) {
  if (!item) return null
  const own = titlePicksIn(data, item.id)
  if (own) return { picks: own, from: null }
  for (const relation of SAME_STORY) {
    const rel = (item.relations || []).find((r) => r.relation === relation && titlePicksIn(data, r.id))
    if (rel) return { picks: titlePicksIn(data, rel.id), from: rel.title || null }
  }
  return null
}
