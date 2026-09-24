/**
 * "Readers also look for": a few links from a page Google already ranks well
 * to a related page it nearly ranks (position 8 to 20).
 *
 * data/boost-links.json is written once a month by scripts/build-boost-links.mjs
 * from Search Console data, and only for pairs the catalog proves are related
 * (same story, the story's cast, an adaptation). It is tiny, so it is imported
 * at build time like data/picks.json: no fetch, no KV read, no Worker CPU to
 * speak of. See docs/boost-links.md for the monthly refresh.
 */
import data from '@site/data/boost-links.json'
import { cleanPath } from './boost-core.mjs'

// The script keeps three at most; the page never shows more even if the file
// is edited by hand.
export const BOOST_MAX = 3

/** The links for one page, or an empty list. Never a link back to the page itself. */
export function boostLinksFor(path, links = data.links) {
  const here = cleanPath(path)
  const rows = (links && links[here]) || []
  return rows
    .filter((row) => row && row.path && row.anchor && cleanPath(row.path) !== here)
    .slice(0, BOOST_MAX)
}
