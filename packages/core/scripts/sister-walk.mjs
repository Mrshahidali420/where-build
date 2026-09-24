/**
 * The full-refresh slice: a persisted cursor that walks a fixed set of ids
 * forever, a bounded slice per run, wrapping back to the start once it passes
 * the end. Shared by the credits, staff and airing full-refresh modes.
 *
 * Why a slice walk exists at all, next to the delta mode: delta trusts that
 * any change to a title's credits, a person's bio or an anime's schedule
 * bumps AniList's `updatedAt` (or, for airing, that RELEASING status is the
 * whole story). A slice walk is the hedge against that assumption being
 * wrong somewhere: every id is revisited on its own schedule regardless of
 * what delta thinks changed, the same insurance scripts/ingest-characters.mjs
 * gets by walking the id space instead of only following the daily probe.
 *
 * Unlike scripts/ingest-characters.mjs's characters-walk.json, this walk
 * never finishes: `next` wraps to the first id again once the slice runs past
 * the last one, so `sortedIds` may grow or shrink between runs (new titles
 * arrive, a person drops out of every credit list) without the cursor ever
 * pointing nowhere. Resuming by id value, not by index, means an id added
 * behind the cursor is not skipped and one removed ahead of it does not
 * repeat its neighbour.
 */

/**
 * `size` ids starting at the first one >= `cursor`, wrapping to the start of
 * `sortedIds` (ascending) when the walk runs past the end. Returns
 * { ids, next, wrapped }: `next` is where the following run should resume,
 * `wrapped` is true when this slice crossed the end of the list.
 */
export function nextSlice(sortedIds, cursor, size) {
  if (!sortedIds.length || size <= 0) return { ids: [], next: cursor, wrapped: false }
  let start = sortedIds.findIndex((id) => id >= cursor)
  const wrappedAtStart = start === -1
  if (wrappedAtStart) start = 0
  const take = Math.min(size, sortedIds.length)
  const ids = []
  for (let n = 0; n < take; n++) ids.push(sortedIds[(start + n) % sortedIds.length])
  const nextIndex = (start + take) % sortedIds.length
  const next = take < sortedIds.length ? sortedIds[nextIndex] : sortedIds[0]
  return { ids, next, wrapped: wrappedAtStart || start + take > sortedIds.length }
}

/** Where a walk stands: `{ next, cycles }`. A missing or corrupt state starts fresh. */
export function loadWalkState(raw) {
  const next = Number(raw?.next)
  const cycles = Number(raw?.cycles)
  return {
    next: Number.isInteger(next) && next >= 0 ? next : 0,
    cycles: Number.isInteger(cycles) && cycles >= 0 ? cycles : 0,
  }
}

/** The next state to save after a slice, bumping `cycles` when the slice wrapped. */
export function advanceWalkState(state, slice) {
  return { next: slice.next, cycles: state.cycles + (slice.wrapped ? 1 : 0) }
}
