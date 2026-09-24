/**
 * Which catalog records a site owns: its config's `ownedKinds`.
 *
 * Every site reads the one shared catalog, and each record belongs to one
 * site's pages. A rule names a record kind ('comic', 'novel' or 'anime') and
 * may narrow it by country of origin:
 *   { kind: 'anime', notFrom: ['CN', 'TW'] }   anime from anywhere but China and Taiwan
 *   { kind: 'comic', from: ['CN', 'TW'] }      Chinese and Taiwanese comics only
 * A record is owned when any one rule takes it.
 *
 * Pure, so scripts/count-pages.mjs and the build read it the same way.
 */

/** True when this rule takes the record. */
export function ruleTakes(rule, record) {
  if (rule.kind !== record.kind) return false
  if (rule.from && !rule.from.includes(record.country)) return false
  return !(rule.notFrom || []).includes(record.country)
}

/** True when the site owns the record. */
export function ownsTitle(site, record) {
  return site.ownedKinds.some((rule) => ruleTakes(rule, record))
}
