/**
 * Studios, from the studio ids in credits.json.
 *
 * AniList lists every company on a show: the animation studio (isMain) and the
 * producers, broadcasters and record labels behind it. A studio page answers
 * "anime by studio Z", so only the animation studio's own work counts; a
 * producer credit would fill Aniplex's page with three hundred shows it did
 * not animate.
 *
 * Pure.
 */
import { baseRole } from './roles.mjs'

/** Map(studioId -> { id, name, titleIds }) over the titles that have a page. */
export function buildStudios(titles, credits) {
  const studios = new Map()
  for (const title of titles) {
    for (const studio of credits[String(title.id)]?.studios || []) {
      if (!studio?.id || !studio.isMain || !studio.name) continue
      let entry = studios.get(studio.id)
      if (!entry) studios.set(studio.id, (entry = { id: studio.id, name: studio.name, titleIds: [] }))
      if (!entry.titleIds.includes(title.id)) entry.titleIds.push(title.id)
    }
  }
  return studios
}

/** The main studios of one title, as { id, name }. */
export function studiosOfTitle(credits, titleId) {
  return (credits[String(titleId)]?.studios || []).filter((s) => s?.id && s.isMain && s.name).map((s) => ({ id: s.id, name: s.name }))
}

/**
 * The people a studio keeps coming back to in one role (its directors, its
 * composers): everyone credited in `roles` on at least `min` of its shows,
 * most shows first.
 */
export function regularsOf(studio, credits, roles, { min = 2, max = 8 } = {}) {
  const counts = new Map()
  for (const titleId of studio.titleIds) {
    const ids = new Set()
    for (const credit of credits[String(titleId)]?.staff || []) {
      if (credit?.id && roles.includes(baseRole(credit.role))) ids.add(credit.id)
    }
    for (const id of ids) counts.set(id, (counts.get(id) || 0) + 1)
  }
  return [...counts]
    .filter(([, count]) => count >= min)
    .sort((a, b) => b[1] - a[1] || a[0] - b[0])
    .slice(0, max)
    .map(([id, count]) => ({ id, count }))
}
