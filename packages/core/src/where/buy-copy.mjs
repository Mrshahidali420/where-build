/**
 * The words at the top of the buy box on a Where anime title page.
 *
 * The box sits right under the page intro, so its heading has to give this
 * reader a reason to own something from this show. An anime's reason is the
 * disc: keep it without a subscription. Whether the show is finished, still
 * airing or not out yet changes what a disc search can honestly promise.
 *
 * Every sentence comes from the record and the rows the box really holds.
 * Nothing here invents a price, a stock level or a disc release.
 *
 * Pure: no config, no network. The site name is handed in.
 */

/**
 * One calm line inside the box. It tells the reader the honest trade: the site
 * stays free because some readers buy through it. The formal Amazon Associates
 * sentence stays in the footer and on /privacy, never here.
 */
export const supportLine = (siteName) =>
  `Buying through these links helps keep ${siteName} free, at no extra cost to you.`

const lowerFirst = (text) => text.charAt(0).toLowerCase() + text.slice(1)

/**
 * What sits beside the discs, named from the rows the box really holds, so
 * the words never promise a manga row that was dropped.
 */
function extrasOf(rows) {
  const source = rows.find((row) => row.kind === 'books' || row.kind === 'games')
  return source ? `Figures, posters and ${lowerFirst(source.label)}` : 'Figures and posters'
}

/** Heading and sub for the buy box of one anime title record. */
export function animeBuyCopy(r, rows = []) {
  const heading = `Keep ${r.title} on your shelf`
  const extras = extrasOf(rows)
  if (r.status === 'RELEASING') {
    return {
      heading,
      sub: `It is still airing, so any disc release may only cover the early episodes for now. ${extras} are here too.`,
    }
  }
  if (r.status === 'NOT_YET_RELEASED') {
    return {
      heading,
      sub: `Discs come after the broadcast. Until then, ${lowerFirst(extras)} are the way to own a piece of it.`,
    }
  }
  return {
    heading,
    sub: `A Blu-ray or DVD lets you rewatch it with no subscription, where a disc release was made. ${extras} sit alongside.`,
  }
}
