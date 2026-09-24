/**
 * The small files a Where build writes beside its shards, all from the same
 * resolved records, so a hub, a search row and a sitemap line exist exactly
 * when the page they name does:
 *
 *   hubsOf       data/where-hubs.json   the directories, the years, the home page lists
 *   searchRowsOf data/search-rows.json  the header search's rows (src/lib/search-shards.js)
 *   pageUrlsOf   data/page-urls.json    the sitemap (src/lib/where-sitemap.js)
 *
 * Pure.
 */
import { record as searchRecord } from '../lib/search-shards.js'
import { directory, hubPaths } from './hubs.mjs'
import { formatWord, seasonWord } from './words.mjs'

const HOME_TITLES = 18
const HOME_ROWS = 12

const byPopularity = (a, b) => (b.popularity || 0) - (a.popularity || 0) || a.id - b.id

/**
 * titles: the title records; people/studios/artists/watch: their records.
 * Every row names a page that exists: each list holds only records with a page.
 */
export function hubsOf({ titles, people, studios, artists, watch }) {
  const voice = people.filter((p) => p.voicePage)
  const crew = people.filter((p) => p.staffPage)
  const groups = {
    'voice-actors': directory(voice.map((p) => [p.name, p.voiceHref, p.counts.roles])),
    staff: directory(crew.map((p) => [p.name, p.staffHref, p.counts.shows])),
    studios: directory(studios.map((s) => [s.name, `/studio/${s.slug}`, s.works.length])),
    artists: directory(artists.map((a) => [a.name, `/artist/${a.slug}`, a.songs.length])),
    'watch-orders': directory(watch.map((w) => [w.name, `/watch-order/${w.slug}`, w.entries.length])),
  }
  const years = {}
  for (const t of [...titles].sort(byPopularity)) {
    if (!t.startYear) continue
    ;(years[t.startYear] ||= []).push([t.title, `/anime/${t.slug}`, t.cover, formatWord(t.format), t.episodes || 0, seasonWord(t.season, t.seasonYear)])
  }
  const home = {
    titles: [...titles].sort(byPopularity).slice(0, HOME_TITLES).map((t) => [t.title, `/anime/${t.slug}`, t.cover, formatWord(t.format), t.startYear || 0]),
    voice: groups['voice-actors'].top.slice(0, HOME_ROWS),
    studios: groups.studios.top.slice(0, HOME_ROWS),
    watch: groups['watch-orders'].top.slice(0, HOME_ROWS),
    years: Object.keys(years).map(Number).sort((a, b) => b - a),
    counts: { titles: titles.length, voice: voice.length, staff: crew.length, studios: studios.length, artists: artists.length, watch: watch.length },
  }
  return { groups, years, home }
}

/** The header search's rows, most popular first: titles only, the one thing people type into it. */
export function searchRowsOf(titles) {
  return [...titles].sort(byPopularity).map((t) => searchRecord({ ...t, titleRomaji: t.romaji }, 'anime'))
}

const portrait = (image, name) => (image ? { image, caption: `${name} portrait` } : {})

/** The sitemap: one group per page type, in crawl order. */
export function pageUrlsOf({ titles, people, studios, artists, watch, hubs, extra = [] }) {
  const group = (name, priority, urls) => ({ name, priority, urls })
  return {
    groups: [
      group('core', '0.9', [{ path: '/' }, ...extra.map((path) => ({ path }))]),
      group('hubs', '0.5', hubPaths(hubs).map(({ path }) => ({ path }))),
      group('anime', '0.8', titles.map((t) => ({ path: `/anime/${t.slug}`, image: t.cover, caption: `Cover of ${t.title}` }))),
      group('episodes', '0.6', titles.filter((t) => t.episodesPage).map((t) => ({ path: `/anime/${t.slug}/episodes` }))),
      group('voice-actors', '0.7', people.filter((p) => p.voicePage).map((p) => ({ path: p.voiceHref, ...portrait(p.image, p.name) }))),
      group('staff', '0.6', people.filter((p) => p.staffPage).map((p) => ({ path: p.staffHref, ...portrait(p.image, p.name) }))),
      group('studios', '0.7', studios.map((s) => ({ path: `/studio/${s.slug}` }))),
      group('artists', '0.6', artists.map((a) => ({ path: `/artist/${a.slug}` }))),
      group('watch-orders', '0.7', watch.map((w) => ({ path: `/watch-order/${w.slug}` }))),
    ],
  }
}
