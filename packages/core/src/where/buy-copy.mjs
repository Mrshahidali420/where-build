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

import { listWords } from './hub-extras.mjs'
import { plural } from './words.mjs'

const lowerFirst = (text) => text.charAt(0).toLowerCase() + text.slice(1)
const upperFirst = (text) => text.charAt(0).toUpperCase() + text.slice(1)

/** How each row is named inside a sentence; a source row keeps its own label. */
const ROW_WORDS = { music: 'the soundtrack', merch: 'figures', prints: 'posters' }

/**
 * What sits beside the discs, named from the rows the box really holds, so
 * the words never promise a manga row or a figure row that was dropped.
 */
function extrasOf(rows) {
  return rows.filter((row) => row.kind !== 'discs').map((row) => ROW_WORDS[row.kind] || lowerFirst(row.label || ''))
    .filter(Boolean)
}

/** What a disc of this show can honestly promise, from its format, status and episode count. */
function discLine(r) {
  if (r.format === 'MOVIE') return `A film${r.startYear ? ` from ${r.startYear}` : ''} fits on one disc, yours to rewatch with no subscription, where a release was made.`
  if (r.status === 'RELEASING') return 'It is still airing, so any disc release may only cover the early episodes for now.'
  if (r.status === 'FINISHED' && r.episodes > 1) {
    return `${upperFirst(plural(r.episodes, 'episode'))} finished${r.endYear ? ` in ${r.endYear}` : ''}, so a Blu-ray or DVD set can hold the whole run, where one was made.`
  }
  return 'A Blu-ray or DVD lets you rewatch it with no subscription, where a disc release was made.'
}

/**
 * Heading and sub for the buy box of one anime title record. `rows` are the
 * rows the box holds (src/where/shop.mjs animeShopRows): the heading only
 * talks about a shelf when there is a disc row to put on it.
 */
export function animeBuyCopy(r, rows = []) {
  const discs = rows.some((row) => row.kind === 'discs')
  const extras = extrasOf(rows)
  const list = listWords(extras)
  if (!discs) {
    const heading = `Own a piece of ${r.title}`
    const unaired = r.status === 'NOT_YET_RELEASED'
    if (!list) return { heading, sub: unaired ? 'Discs come after the broadcast.' : '' }
    return { heading, sub: unaired ? `Discs come after the broadcast. Until then, this box points at ${list}.` : `This box points at ${list}.` }
  }
  const also = list ? ` This box also holds ${list}.` : ''
  return { heading: `Keep ${r.title} on your shelf`, sub: `${discLine(r)}${also}` }
}
