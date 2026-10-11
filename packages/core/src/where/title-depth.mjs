/**
 * How much a title page really holds, counted in data blocks, and what a
 * near-empty page leaves out.
 *
 * Pure.
 */

/** The blocks a title page can hold, each a test on its record. */
export const BLOCKS = {
  cast: (r) => (r.cast || []).some((c) => (c.voices || []).length > 0),
  songs: (r) => (r.songs || []).length > 0,
  streams: (r) => (r.watchOn || []).length > 0,
  story: (r) => String(r.description || '').split(/\s+/).filter(Boolean).length >= 40,
  episodes: (r) => (r.dated || 0) > 0,
  order: (r) => !!r.watch,
  staff: (r) => (r.key || []).length > 0,
}

/** How many of the seven blocks this record has. */
export const dataBlocks = (r) => Object.values(BLOCKS).filter((has) => has(r)).length

/** A page with fewer blocks than this is near-empty. */
export const NEAR_EMPTY_BELOW = 2

/**
 * Whether a title page draws its Amazon search box. A near-empty page (a
 * music video with a cover and one line) does not: the box would be most of
 * the page. Real products picked for the show still earn it.
 */
export function showsBuyBox(r) {
  if (r.picks) return true
  return r.format !== 'MUSIC' && dataBlocks(r) >= NEAR_EMPTY_BELOW
}
