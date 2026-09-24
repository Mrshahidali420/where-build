/**
 * Health checks for the shared sister data (credits.json, staff.json,
 * airing.json): pure, so they can be tested without R2 or AniList, the same
 * way scripts/snapshot-health.mjs checks the main catalog before
 * scripts/catalog-snapshot.mjs pushes it.
 *
 * The floors below come from docs/PLAN.md section 8, Phase 1:
 *   - credits.json covers 99% of catalog ids
 *   - staff.json covers 99% of ids referenced by credits
 *   - airing.json has a row for every RELEASING anime with nextAiringEpisode
 *
 * A brand new file (no `prev` meta yet) is never held to a floor: Phase 1
 * starts from an empty bucket and grows one delta and one full-refresh slice
 * at a time, so the very first pushes are partial on purpose. Once a push HAS
 * reached a floor, a later push may not fall back under it, or drop more than
 * the share/relative guard allows -- the same shrink-guard shape
 * snapshot-health.mjs uses for the main catalog's link and page shares.
 */
export const COVERAGE_FLOOR = 0.99
export const MAX_SHARE_DROP = 0.05
export const MAX_RELATIVE_DROP = 0.2
// A failed overflow follow-up (scripts/ingest-airing.mjs's fetchOverflow)
// leaves a title's history truncated rather than absent; this is the ceiling
// on how much of airing.json's history may be in that state before a push is
// refused -- an absolute floor, not a shrink guard, so it applies from the
// very first push too.
export const MAX_INCOMPLETE_SHARE = 0.05

const round = (n) => Math.round(n * 10000) / 10000
const share = (n, of) => (of ? round(n / of) : 0)
const pct = (n) => `${(n * 100).toFixed(1)}%`

/** { count, coverage } for credits.json against the full catalog id list. */
export function creditsHealth(byId, catalogIds) {
  const ids = new Set(catalogIds)
  const have = [...ids].filter((id) => Object.hasOwn(byId, id)).length
  return { count: Object.keys(byId).length, coverage: share(have, ids.size) }
}

/** { count, coverage } for staff.json against every id credits.json points at. */
export function staffHealth(byId, referencedIds) {
  const ids = new Set(referencedIds)
  const have = [...ids].filter((id) => Object.hasOwn(byId, id)).length
  return { count: Object.keys(byId).length, coverage: share(have, ids.size) }
}

/**
 * { count, releasingCoverage, incompleteCount, incompleteShare } for
 * airing.json's per-anime history against anime that are RELEASING with a
 * next episode (the one coverage floor the plan names for airing.json), plus
 * how much of that history is known truncated by a failed overflow
 * follow-up. `history` is airing.json's `byId` map; `incomplete` is
 * airing.json's `{ "<id>": true }` map (scripts/sister-airing.mjs's
 * mergeIncomplete).
 */
export function airingHealth(history, releasingIds, incomplete = {}) {
  const ids = new Set(releasingIds)
  const have = [...ids].filter((id) => (history[id] || []).length > 0).length
  const count = Object.keys(history).length
  const incompleteCount = Object.keys(incomplete).filter((id) => incomplete[id]).length
  return {
    count,
    releasingCoverage: share(have, ids.size),
    incompleteCount,
    incompleteShare: share(incompleteCount, count),
  }
}

/**
 * Problems with one coverage share, as plain sentences. `prev` is the
 * matching health object recorded in the last push's meta.json, or null on
 * the first ever push. Returns [] when the push may go ahead.
 */
export function checkCoverage(name, key, health, prev, { floor = COVERAGE_FLOOR, allowDrop = false } = {}) {
  const now = health[key]
  if (typeof now !== 'number') return [`${name}: ${key} is not a number`]
  if (!prev) {
    // Bootstrap: nothing recorded yet, so there is nothing to protect against
    // -- except a run that fetched and merged nothing at all.
    return health.count ? [] : [`${name} has no records`]
  }
  const before = prev[key]
  if (typeof before !== 'number' || allowDrop) return []
  // A push that was never mature is not held to the floor either; only a push
  // that already reached it is defended from falling back under it.
  if (before < floor) return []
  const drop = before - now
  if (now >= floor && drop <= MAX_SHARE_DROP && (before === 0 || drop / before <= MAX_RELATIVE_DROP)) return []
  return [
    `${name}: ${key} fell from ${pct(before)} to ${pct(now)} ` +
      `(floor ${pct(floor)}, limit ${MAX_SHARE_DROP * 100} points or ${MAX_RELATIVE_DROP * 100}% of itself)`,
  ]
}

/**
 * Problems with airing.json's incomplete share, as plain sentences. Unlike
 * checkCoverage this is an absolute ceiling, not a regression guard against a
 * previous push: a run that leaves too much of its own history truncated is
 * refused even on the very first push, because there is nothing earlier to
 * compare it against and no reason to trust a bad batch just because it is
 * new.
 */
export function checkIncomplete(name, health, { maxShare = MAX_INCOMPLETE_SHARE } = {}) {
  const now = health.incompleteShare ?? 0
  if (now > maxShare) {
    return [`${name}: ${pct(now)} of titles with history are incomplete (limit ${pct(maxShare)})`]
  }
  return []
}
