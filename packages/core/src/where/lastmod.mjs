/**
 * A page's real last-changed date for the sitemap. Each build stamps every
 * page with a short hash of what the page prints; the stamp and the day it
 * last moved are kept in data/lastmod.json, carried from build to build in
 * R2 with the rest of the site's state (scripts/where-data.mjs).
 *
 *   a page whose stamp did not move   keeps its date
 *   a page whose stamp moved          gets today
 *   a page never seen before          gets no date: nobody knows when it last
 *                                     changed, and the sitemap leaves the
 *                                     <lastmod> out rather than guess
 *
 * The numbers that move every night without the page changing (how many
 * people are watching, scores, chart places, the picks of other pages) are
 * left out of the stamp.
 *
 * Pure: the hash function is handed in.
 */

/** Record fields that are not the page's own content. */
export const VOLATILE = ['popularity', 'favourites', 'watching', 'completed', 'score', 'chart', 'recs', 'similar', 'nextEpisode', 'costars']

/** The text a record is stamped from: its JSON without the volatile fields. */
export function stampText(record, skip = VOLATILE) {
  const out = {}
  for (const key of Object.keys(record)) if (!skip.includes(key)) out[key] = record[key]
  return JSON.stringify(out)
}

/**
 * prev   { path: [stamp, date] } from the last build ({} on the first)
 * pages  [[path, stamp]] of this build
 * today  'YYYY-MM-DD'
 * Returns the new state in the same shape; a path gone from `pages` is dropped.
 */
export function nextLastmod(prev, pages, today) {
  const state = {}
  for (const [path, stamp] of pages) {
    const before = prev?.[path]
    if (!before) state[path] = [stamp, '']
    else if (before[0] === stamp) state[path] = [stamp, before[1] || '']
    else state[path] = [stamp, today]
  }
  return state
}

/** The date of one path in a state, or '' when it is not known. */
export const lastmodOf = (state, path) => state?.[path]?.[1] || ''
