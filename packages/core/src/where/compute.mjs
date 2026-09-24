/**
 * Which pages a Where anime site has, worked out from its data: every title
 * the site owns, run through its gate, then the people, studios, song artists
 * and franchises of the titles that passed, each run through its own gate.
 *
 * scripts/make-where.mjs builds from this, and scripts/count-pages.mjs counts
 * from it, so the counts printed are exactly the pages built.
 *
 *   data: { anime, credits, staff, airing, themes }   (the files in data/,
 *         scripts/where-data.mjs; blocked titles already out)
 *
 * Pure.
 */
import { ownedOnly } from '../lib/owned.mjs'
import { buildEpisodes, datedCount, windowById } from './episodes.mjs'
import { buildPeople } from './people.mjs'
import { buildStudios } from './studios.mjs'
import { buildArtists } from './artists.mjs'
import { buildFranchises } from './franchises.mjs'
import { buildSchedule, buildSeasons, buildGenres } from './anime-hubs.mjs'
import {
  gatesOf,
  passesTitle,
  passesEpisodes,
  passesVoiceActor,
  passesStaff,
  passesStudio,
  passesArtist,
  passesWatchOrder,
} from './gates.mjs'

/** How many credits a title carries: named crew roles, and cast rows with a voice. */
export function creditCount(row) {
  if (!row) return 0
  const crew = (row.staff || []).filter((c) => c?.id && c.role).length
  const voiced = (row.characters || []).filter((c) => (c?.voiceActors || []).length > 0).length
  return crew + voiced
}

/** Every owned title with its episode rows, and whether it passed its gate. */
export function gateTitles(site, data, gates = gatesOf(site)) {
  const window = windowById(data.airing?.schedule)
  const titles = []
  for (const item of ownedOnly(site, data.anime)) {
    const rows = buildEpisodes(item, data.airing?.history?.[String(item.id)] || [], window.get(item.id) || [])
    const dated = datedCount(rows)
    const facts = { episodes: item.episodes > 0 || rows.length > 0, airing: dated > 0, credits: creditCount(data.credits[String(item.id)]) }
    if (!passesTitle(item, facts, gates.title)) continue
    titles.push({ item, rows, dated, episodesPage: passesEpisodes(dated, gates.episodes) })
  }
  return titles
}

const idsWhere = (map, test) => new Set([...map.values()].filter(test).map((entry) => entry.id ?? entry.key ?? entry.anchorId))

/**
 * now: unix seconds, the moment the build stands at (the schedule's week).
 */
export function computeWhere(site, data, { now = Math.floor(Date.now() / 1000) } = {}) {
  const gates = gatesOf(site)
  const titles = gateTitles(site, data, gates)
  const items = titles.map((t) => t.item)
  const titleIds = new Set(items.map((item) => item.id))
  const schedule = buildSchedule(data.airing?.schedule, (id) => titleIds.has(id), now, gates.schedule)
  const seasons = buildSeasons(items, gates.season)
  const genres = buildGenres(items, gates.genre)
  const people = buildPeople(items, data.credits, data.staff)
  const studios = buildStudios(items, data.credits)
  const artists = buildArtists(items, data.themes)
  const franchises = buildFranchises(items)

  const pages = {
    voice: idsWhere(people, (p) => passesVoiceActor(p, gates.voiceActor)),
    staff: idsWhere(people, (p) => passesStaff(p, gates.staff)),
    studio: idsWhere(studios, (s) => passesStudio(s, gates.studio)),
    artist: new Set([...artists.values()].filter((a) => passesArtist(a, gates.artist)).map((a) => a.key)),
    watch: new Set([...franchises.values()].filter((f) => passesWatchOrder(f, gates.watchOrder)).map((f) => f.anchorId)),
  }
  const counts = {
    title: titles.length,
    episodes: titles.filter((t) => t.episodesPage).length,
    voiceActor: pages.voice.size,
    staff: pages.staff.size,
    studio: pages.studio.size,
    artist: pages.artist.size,
    watchOrder: pages.watch.size,
    schedule: schedule ? 1 : 0,
    season: seasons.length,
    genre: genres.reduce((n, g) => n + g.pages, 0),
  }
  return { gates, titles, people, studios, artists, franchises, pages, counts, now, schedule, seasons, genres }
}
