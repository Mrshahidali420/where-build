/**
 * Spreading internal links across the catalog.
 *
 * "You may also like" used to rank its candidates "most watched first" for
 * every page alike, from the 300 most watched shows of each genre. Measured
 * on 11 Oct 2026: one show sat in the block of 1,220 pages while 16,184 of
 * 18,610 titles were in nobody's.
 *
 * Two rules fix both ends. Both are pure, need no clock and no random
 * numbers, and give the same answer on every build for the same catalog, so
 * a page's picks do not reshuffle between builds.
 *
 *   spreadDraw  among candidates that are equally close to a page, each page
 *               draws its own order from a fixed number worked out from the
 *               two ids, weighted so a well watched show still comes up more
 *   capPicks    no show fills a place on more than SIMILAR_CAP pages: once it
 *               has, the place goes to the next candidate. A page never shows
 *               fewer picks than it has candidates for.
 */

export const SIMILAR_CAP = 300

/** A fixed number in [0, 1) for a pair of ids. The same pair, the same number. */
export function pairChance(a, b) {
  let h = (Math.imul(Number(a) | 0, 0x9e3779b1) ^ Math.imul(Number(b) | 0, 0x85ebca6b)) >>> 0
  h = Math.imul(h ^ (h >>> 16), 0x7feb352d) >>> 0
  h = Math.imul(h ^ (h >>> 15), 0x846ca68b) >>> 0
  h = (h ^ (h >>> 16)) >>> 0
  return h / 4294967296
}

const SPOT_SEED = 0x5bd1e995
/** A title's fixed spot on a ring, from its id alone. */
export const spotOf = (id) => pairChance(id, SPOT_SEED)

/**
 * This page's draw for one candidate, in (0, 1]. Higher comes first. A fixed
 * number per pair, pulled towards 1 for a well watched show, so across many
 * pages a show turns up more often the more viewers it has.
 */
export function spreadDraw(itemId, candidate) {
  const weight = Math.sqrt((candidate.popularity || 0) + 1)
  return Math.pow(pairChance(itemId, candidate.id) || Number.MIN_VALUE, 1 / weight)
}

/**
 * The picks one page shows, from its ranked candidates (each with an `id`).
 * `usedOf(id)` is how many pages already show the candidate. A candidate at
 * the cap is passed over, unless there are not enough others to fill the
 * block. Rank order is kept. The caller counts the picks it is given.
 */
export function capPicks(ranked, { usedOf, shown, cap = SIMILAR_CAP }) {
  const kept = new Set()
  const passed = []
  for (const row of ranked) {
    if (kept.size >= shown) break
    if (usedOf(row.id) < cap) kept.add(row)
    else passed.push(row)
  }
  for (const row of passed) {
    if (kept.size >= shown) break
    kept.add(row)
  }
  return ranked.filter((row) => kept.has(row))
}
