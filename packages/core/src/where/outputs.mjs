/**
 * The small files a Where build writes beside its shards, all from the same
 * resolved records, so a hub, a search row and a sitemap line exist exactly
 * when the page they name does:
 *
 *   hubsOf       data/where-hubs.json   the directories, years, seasons, genres,
 *                                       the week's schedule and the front page lists
 *   searchRowsOf data/search-rows.json  the header search's rows (src/lib/search-shards.js)
 *   pageUrlsOf   data/page-urls.json    the sitemap (src/lib/where-sitemap.js)
 *
 * Pure.
 */
import { record as searchRecord } from '../lib/search-shards.js'
import { GROUPS, directory, hubPaths, yearPlan } from './hubs.mjs'
import { artistCard, staffCard, studioCard, voiceCard, watchCard } from './hub-cards.mjs'
import { genreNote } from './genre-notes.mjs'
import { formatWord, seasonWord } from './words.mjs'
import { seasonAt, shiftSeason, upcomingEpisodes } from './anime-hubs.mjs'
import { shopOf } from './shop.mjs'
import { likeHubs, moodHubs } from './hub-extras.mjs'

const HOME_ROWS = 16
const HOME_AIRING = 10
const HOME_WATCH = 8

const byPopularity = (a, b) => (b.popularity || 0) - (a.popularity || 0) || a.id - b.id

/** A title as a grid card: [title, href, cover, format, episodes, season, studio]. */
const cardRow = (t) => [t.title, `/anime/${t.slug}`, t.cover, formatWord(t.format), t.episodes || 0, seasonWord(t.season, t.seasonYear), t.studios[0]?.name || '']

/** The season hubs, keyed "2026/summer", and a small index of them. */
function seasonHubs(seasons, recordOf) {
  const lists = {}
  const index = []
  for (const s of seasons) {
    const rows = s.items.map((item) => recordOf.get(item.id)).filter(Boolean).map(cardRow)
    const key = s.path.slice('/season/'.length)
    lists[key] = { year: s.year, season: s.season, label: seasonWord(s.season, s.year), rows }
    index.push({
      key,
      path: s.path,
      year: s.year,
      season: s.season,
      label: seasonWord(s.season, s.year),
      count: rows.length,
      cover: rows[0]?.[2] || '',
      covers: rows.slice(0, 3).map((r) => r[2]),
      top: rows[0]?.[0] || '',
    })
  }
  return { lists, index }
}

function genreHubs(genres, recordOf) {
  const lists = {}
  const index = []
  for (const g of genres) {
    const rows = g.items.map((item) => recordOf.get(item.id)).filter(Boolean).map(cardRow)
    lists[g.slug] = { name: g.name, total: g.total, per: g.per, rows }
    index.push({ slug: g.slug, name: g.name, total: g.total, pages: g.pages, covers: rows.slice(0, 3).map((r) => r[2]), note: genreNote(g.name), top: rows[0]?.[0] || '' })
  }
  return { lists, index }
}

/**
 * The year hubs: a page per year with enough shows, the thin years at either
 * end folded into one page each (hubs.mjs yearPlan). Rows most watched first;
 * the index newest first, with each page's three top covers.
 */
function yearHubs(titles, now) {
  const byYear = {}
  for (const t of [...titles].sort(byPopularity)) {
    if (t.startYear) (byYear[t.startYear] ||= []).push(t)
  }
  const plan = yearPlan(Object.fromEntries(Object.entries(byYear).map(([y, list]) => [y, list.length])), { current: new Date(now * 1000).getUTCFullYear() })
  const years = {}
  const yearIndex = []
  const add = (key, label, list, from, to) => {
    const rows = list.map(cardRow)
    years[key] = rows
    yearIndex.push({ key, label, from, to, count: rows.length, covers: rows.slice(0, 3).map((r) => r[2]), top: rows[0]?.[0] || '' })
  }
  const merged = (bucket) => bucket.years.flatMap((y) => byYear[y]).sort(byPopularity)
  if (plan.late) add(plan.late.key, plan.late.label, merged(plan.late), plan.late.years[0], plan.late.years.at(-1))
  for (const y of plan.own) add(String(y), String(y), byYear[y], y, y)
  if (plan.early) add(plan.early.key, plan.early.label, merged(plan.early), plan.early.years[0], plan.early.years.at(-1))
  return { years, yearIndex }
}

/** A schedule row: [title, href, cover, episode, at, planned episodes]. */
const airingRow = (recordOf) => (row) => {
  const t = recordOf.get(row.id)
  return [t.title, `/anime/${t.slug}`, t.cover, row.episode, row.at, t.episodes || 0]
}

/** The current season's list, or the newest one with a page before it. */
function currentSeason(index, now) {
  const here = seasonAt(now)
  const at = index.findIndex((s) => s.year < here.year || (s.year === here.year && seasonOrder(s.season) <= seasonOrder(here.season)))
  const next = shiftSeason(here, 1)
  return {
    current: at >= 0 ? index[at] : null,
    next: index.find((s) => s.year === next.year && s.season === next.season) || null,
  }
}
const seasonOrder = (season) => ['WINTER', 'SPRING', 'SUMMER', 'FALL'].indexOf(season)

/** Franchises to start: the most watched ones, each with the entry to begin at. */
function watchStarters(watch, popularityOf) {
  return watch
    .map((w) => {
      const main = w.entries.filter((e) => e.main)
      const first = (main.length ? main : w.entries)[0]
      const pop = Math.max(0, ...w.entries.map((e) => popularityOf.get(e.href) || 0))
      return { name: w.name, href: `/watch-order/${w.slug}`, count: w.entries.length, first: first?.title || '', cover: first?.cover || '', pop }
    })
    .sort((a, b) => b.pop - a.pop || a.name.localeCompare(b.name))
    .slice(0, HOME_WATCH)
    .map(({ pop: _pop, ...row }) => row)
}

/**
 * titles: the title records; people/studios/artists/watch: their records.
 * where: computeWhere's { schedule, seasons, genres, now }.
 * Every row names a page that exists: each list holds only records with a page.
 */
export function hubsOf({ titles, people, studios, artists, watch, where = {}, airing = [] }) {
  const now = where.now || Math.floor(Date.now() / 1000)
  const recordOf = new Map(titles.map((t) => [t.id, t]))
  const popularityOf = new Map(titles.map((t) => [`/anime/${t.slug}`, t.popularity || 0]))
  const voice = people.filter((p) => p.voicePage)
  const crew = people.filter((p) => p.staffPage)
  const popOf = (href) => popularityOf.get(href) || 0
  const dir = (group, rows) => directory(rows, Object.keys(GROUPS[group].sorts))
  const groups = {
    'voice-actors': dir('voice-actors', voice.map((p) => voiceCard(p, popOf))),
    staff: dir('staff', crew.map((p) => staffCard(p, popOf))),
    studios: dir('studios', studios.map((s) => studioCard(s, popOf))),
    artists: dir('artists', artists.map((a) => artistCard(a, popOf))),
    'watch-orders': dir('watch-orders', watch.map((w) => watchCard(w, popOf))),
  }
  const { years, yearIndex } = yearHubs(titles, now)
  const seasons = seasonHubs(where.seasons || [], recordOf)
  const genres = genreHubs(where.genres || [], recordOf)
  const schedule = where.schedule
    ? { from: where.schedule.from, total: where.schedule.total, days: where.schedule.days.map((d) => ({ day: d.day, rows: d.rows.map(airingRow(recordOf)) })) }
    : null
  const { current, next } = currentSeason(seasons.index, now)
  const topVoices = [...voice].sort((a, b) => b.counts.roles - a.counts.roles || a.id - b.id).slice(0, HOME_ROWS)
  const topStudios = [...studios].sort((a, b) => b.works.length - a.works.length || a.id - b.id).slice(0, HOME_ROWS)

  const home = {
    titles: [...titles].sort(byPopularity).slice(0, HOME_ROWS).map(cardRow),
    airing: upcomingEpisodes(airing, (id) => recordOf.has(id), now, HOME_AIRING).map(airingRow(recordOf)),
    season: current ? { ...current, rows: seasons.lists[current.key].rows.slice(0, HOME_ROWS) } : null,
    nextSeason: next,
    voice: topVoices.map((p) => [p.name, p.voiceHref, p.counts.roles, p.image || '']),
    studios: topStudios.map((s) => [
      s.name,
      `/studio/${s.slug}`,
      s.works.length,
      [...s.works].sort((a, b) => (popularityOf.get(b.href) || 0) - (popularityOf.get(a.href) || 0)).slice(0, 2).map((w) => w.title),
    ]),
    watch: watchStarters(watch, popularityOf),
    years: yearIndex.filter((y) => /^\d+$/.test(y.key)).map((y) => Number(y.key)),
    counts: {
      titles: titles.length,
      voice: voice.length,
      staff: crew.length,
      studios: studios.length,
      artists: artists.length,
      watch: watch.length,
      seasons: seasons.index.length,
      genres: genres.index.length,
      airing: schedule?.total || 0,
    },
  }
  return {
    groups,
    years,
    yearIndex,
    seasons: seasons.lists,
    seasonIndex: seasons.index,
    genres: genres.lists,
    genreIndex: genres.index,
    schedule,
    builtAt: now,
    home,
    // Built only when their gates passed (computeWhere's counts), so a hub a
    // gate kept out has no page, no menu link and no sitemap line.
    shop: where.counts?.shop ? shopOf(titles) : null,
    ...moodHubs(where.moods || [], recordOf, cardRow),
    like: likeHubs(where.likes || new Map(), recordOf, cardRow),
  }
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
