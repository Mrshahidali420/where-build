// BUILD TIME ONLY: imports the catalog. The season hubs are built as files,
// so the Worker never loads this. Names, addresses and the counting rule live
// in season-core.mjs, which the Worker and the shard builder share.
import { animeByPopularity } from './catalog.js'
import {
  SEASON_ORDER,
  seasonKey,
  seasonKeyOf,
  seasonLabel,
  seasonPath,
  seasonSlug,
  hubSeasonKeys,
  seasonWhen,
} from './season-core.mjs'

/** Titles per hub page, the same as every other listing on the site. */
export const SEASON_PER_PAGE = 60

const hubKeys = hubSeasonKeys(animeByPopularity)

// A hub can be ahead of today (see seasonWhen), and its copy must not say
// those shows have aired. The site rebuilds daily, so build time is fresh enough.
const whenOf = (year, season) => ['past', 'now', 'future'][seasonWhen(year, season) + 1]

/**
 * Every season that earns a hub, newest first. animeByPopularity is already
 * sorted most-watched first, so each season's list keeps that order.
 */
export const seasonHubs = (() => {
  const byKey = new Map()
  for (const item of animeByPopularity) {
    const key = seasonKeyOf(item)
    if (!key || !hubKeys.has(key)) continue
    if (!byKey.has(key)) {
      byKey.set(key, { key, year: item.seasonYear, season: item.season, items: [] })
    }
    byKey.get(key).items.push(item)
  }
  return [...byKey.values()]
    .map((hub) => ({
      ...hub,
      label: `${seasonLabel(hub.season)} ${hub.year}`,
      path: seasonPath(hub.year, hub.season),
      pages: Math.ceil(hub.items.length / SEASON_PER_PAGE),
      when: whenOf(hub.year, hub.season),
      // Titles that name at least one licensed streaming service.
      streaming: hub.items.filter((item) => (item.watchLinks || []).length > 0).length,
    }))
    .sort((a, b) => b.year - a.year || SEASON_ORDER.indexOf(b.season) - SEASON_ORDER.indexOf(a.season))
})()

/** Year -> its hubs in calendar order (winter first), years newest first. */
export const seasonYears = (() => {
  const years = new Map()
  for (const hub of seasonHubs) {
    if (!years.has(hub.year)) years.set(hub.year, [])
    years.get(hub.year).push(hub)
  }
  return [...years].map(([year, hubs]) => ({
    year,
    hubs: [...hubs].sort((a, b) => SEASON_ORDER.indexOf(a.season) - SEASON_ORDER.indexOf(b.season)),
  }))
})()

/** The hub before and after this one in time, skipping seasons with no hub. */
export function seasonNeighbours(key) {
  const i = seasonHubs.findIndex((hub) => hub.key === key)
  if (i < 0) return { prev: null, next: null }
  // seasonHubs runs newest first, so "next" in time is one step back.
  return { prev: seasonHubs[i + 1] || null, next: seasonHubs[i - 1] || null }
}

/** The hub for one season, or null when that season has none. */
export const seasonHubOf = (year, season) =>
  seasonHubs.find((hub) => hub.key === seasonKey(year, season)) || null

/** One page's slice of a hub. Page numbers start at 1. */
export const seasonPage = (hub, page) =>
  hub.items.slice((page - 1) * SEASON_PER_PAGE, page * SEASON_PER_PAGE)

/** Static paths for page 1 of every hub. */
export const seasonFirstPaths = () =>
  seasonHubs.map((hub) => ({
    params: { year: String(hub.year), season: seasonSlug(hub.season) },
    props: { hub, current: 1 },
  }))

/** Static paths for page 2 onward of every hub. */
export const seasonDeeperPaths = () =>
  seasonHubs.flatMap((hub) =>
    Array.from({ length: Math.max(0, hub.pages - 1) }, (_, i) => ({
      params: { year: String(hub.year), season: seasonSlug(hub.season), page: String(i + 2) },
      props: { hub, current: i + 2 },
    })),
  )
