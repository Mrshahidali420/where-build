// The anime-intent hubs and the rules added with them: the tightened staff
// gate (src/where/people.mjs countsOf, gates.mjs), the week's schedule,
// seasons and genres (src/where/anime-hubs.mjs), the title page's questions
// (src/where/faq.mjs), the character link rule (src/where/cross.mjs,
// src/where/slim.mjs) and the family mark (src/lib/brand.mjs).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildPeople } from '../src/where/people.mjs'
import { passesStaff, WHERE_GATE_DEFAULTS } from '../src/where/gates.mjs'
import { isCountedCrew } from '../src/where/roles.mjs'
import { buildGenres, buildSchedule, buildSeasons, dayOf, genreSlug, seasonAt, shiftSeason, upcomingEpisodes } from '../src/where/anime-hubs.mjs'
import { hubPaths } from '../src/where/hubs.mjs'
import { faqOf, listWords } from '../src/where/faq.mjs'
import { characterUrl } from '../src/where/cross.mjs'
import { homeHasCharacterPage, slimCast } from '../src/where/slim.mjs'
import { recsOf, relatedOf, trailerOf, watchOnOf } from '../src/where/record-title.mjs'
import { FAMILY_SYMBOLS, familyMark, tileSvg } from '../src/lib/brand.mjs'

const staffGate = WHERE_GATE_DEFAULTS.staff

test('staff gate: song performances and producer seats never make a staff page', () => {
  const titles = [1, 2, 3, 4].map((id) => ({ id }))
  const credits = {
    1: { staff: [{ id: 10, role: 'Theme Song Performance (OP)' }, { id: 20, role: 'Key Animation (eps 3)' }, { id: 30, role: 'Director' }, { id: 40, role: 'Producer' }] },
    2: { staff: [{ id: 10, role: 'Theme Song Performance (ED)' }, { id: 20, role: 'Key Animation' }, { id: 30, role: 'Series Composition' }, { id: 40, role: 'Producer' }] },
    3: { staff: [{ id: 10, role: 'Insert Song Performance' }, { id: 20, role: 'Storyboard (ep 1)' }, { id: 40, role: 'Executive Producer' }] },
    4: { staff: [{ id: 40, role: 'Planning' }, { id: 50, role: 'Director (ep 4)' }] },
  }
  const staff = { 10: { name: 'Singer' }, 20: { name: 'Animator' }, 30: { name: 'Director' }, 40: { name: 'Producer' }, 50: { name: 'Episode director' } }
  const people = buildPeople(titles, credits, staff)
  const passes = (id) => passesStaff(people.get(id), staffGate)
  assert.equal(people.get(10).staffWorkCount, 3)
  assert.equal(people.get(10).crewShowCount, 0)
  assert.equal(passes(10), false, 'a singer with three songs has an artist page, not a staff page')
  assert.equal(passes(20), true, 'real crew work on three shows')
  assert.equal(people.get(30).keyShowCount, 2)
  assert.equal(passes(30), true, 'a key credit on two shows')
  assert.equal(passes(40), false, 'producer seats on four shows')
  assert.equal(passes(50), false, 'one episode credit')
  assert.equal(isCountedCrew('Music'), true)
  assert.equal(isCountedCrew('Music Performance'), false)
})

test('seasons: AniList quarters, stepping across the year, gated and newest first', () => {
  assert.deepEqual(seasonAt(Date.UTC(2026, 8, 25) / 1000), { season: 'SUMMER', year: 2026 })
  assert.deepEqual(seasonAt(Date.UTC(2026, 0, 1) / 1000), { season: 'WINTER', year: 2026 })
  assert.deepEqual(shiftSeason({ season: 'FALL', year: 2026 }, 1), { season: 'WINTER', year: 2027 })
  assert.deepEqual(shiftSeason({ season: 'WINTER', year: 2026 }, -1), { season: 'FALL', year: 2025 })
  const titles = [
    ...[1, 2, 3].map((id) => ({ id, season: 'FALL', seasonYear: 2026, popularity: id })),
    ...[4, 5].map((id) => ({ id, season: 'SPRING', seasonYear: 2026, popularity: id })),
    { id: 6, season: null, seasonYear: 2026 },
    { id: 7, season: 'WINTER', seasonYear: 2027, popularity: 1 },
    { id: 8, season: 'WINTER', seasonYear: 2027, popularity: 2 },
  ]
  const seasons = buildSeasons(titles, { min: 2 })
  assert.deepEqual(
    seasons.map((s) => s.path),
    ['/season/2027/winter', '/season/2026/fall', '/season/2026/spring'],
  )
  assert.deepEqual(
    seasons[1].items.map((t) => t.id),
    [3, 2, 1],
  )
  assert.equal(buildSeasons(titles, { min: 3 }).length, 1)
})

test('genres: gated by size, most watched first, capped at maxPages pages', () => {
  assert.equal(genreSlug('Slice of Life'), 'slice-of-life')
  assert.equal(genreSlug('Sci-Fi'), 'sci-fi')
  const titles = Array.from({ length: 25 }, (_, i) => ({ id: i + 1, popularity: i, genres: i < 5 ? ['Horror', 'Action'] : ['Action'] }))
  const genres = buildGenres(titles, { min: 10, per: 4, maxPages: 3 })
  assert.deepEqual(
    genres.map((g) => g.name),
    ['Action'],
  )
  const [action] = genres
  assert.equal(action.total, 25)
  assert.equal(action.items.length, 12)
  assert.equal(action.pages, 3)
  assert.equal(action.items[0].id, 25)
  const paths = hubPaths({ groups: {}, years: {}, genreIndex: [{ slug: 'action', pages: 3 }], seasonIndex: [], schedule: null })
  assert.deepEqual(
    paths.filter((p) => p.path.startsWith('/genre')).map((p) => p.path),
    ['/genre', '/genre/action', '/genre/action/2', '/genre/action/3'],
  )
  assert.equal(paths.some((p) => p.path === '/schedule'), false)
})

test('schedule: the coming week by UTC day, each episode once, only shows with a page', () => {
  const now = Date.UTC(2026, 8, 25, 10) / 1000
  const at = (day, hour) => Date.UTC(2026, 8, 25 + day, hour) / 1000
  const schedule = [
    { mediaId: 1, episode: 5, at: at(0, 15) },
    { mediaId: 1, episode: 5, at: at(0, 16) }, // a second broadcast of the same episode
    { mediaId: 2, episode: 1, at: at(2, 1) },
    { mediaId: 3, episode: 9, at: at(1, 1) }, // no page on this site
    { mediaId: 1, episode: 4, at: at(-1, 15) }, // before today
    { mediaId: 2, episode: 2, at: at(7, 1) }, // past the week
    { mediaId: 1, episode: 5.5, at: at(0, 2) }, // earlier today: still in today's list
  ]
  const hasPage = (id) => id !== 3
  const week = buildSchedule(schedule, hasPage, now, { min: 2 })
  assert.equal(week.days.length, 7)
  assert.equal(week.days[0].day, '2026-09-25')
  assert.equal(week.total, 3)
  assert.deepEqual(
    week.days[0].rows.map((r) => [r.id, r.episode, dayOf(r.at)]),
    [
      [1, 5.5, '2026-09-25'],
      [1, 5, '2026-09-25'],
    ],
  )
  assert.equal(week.days[0].rows[1].at, at(0, 15), 'the first broadcast wins')
  assert.deepEqual(
    week.days[2].rows.map((r) => r.id),
    [2],
  )
  assert.equal(buildSchedule(schedule, hasPage, now, { min: 4 }), null, 'a thin week gets no page')
  assert.deepEqual(
    upcomingEpisodes(schedule, hasPage, now, 2).map((r) => r.episode),
    [5, 1],
  )
})

const record = (extra = {}) => ({
  title: 'Show',
  status: 'FINISHED',
  episodes: 12,
  startDate: [2020, 4, 5],
  endYear: 2020,
  rows: [],
  nextEpisode: null,
  cast: [
    { name: 'Hero', role: 'MAIN', voices: [{ name: 'Aoi', language: 'Japanese' }, { name: 'Ann', language: 'English' }] },
    { name: 'Friend', role: 'SUPPORTING', voices: [{ name: 'Ben', language: 'Japanese' }] },
  ],
  studios: [{ name: 'Studio A' }],
  key: [{ label: 'Director', people: [{ name: 'Dee' }] }],
  songs: [{ type: 'OP', title: 'Blue', artists: [{ name: 'Band' }] }],
  watch: null,
  watchOn: [],
  ...extra,
})

test('faq: every answer comes from the record, and a question without data is left out', () => {
  assert.equal(listWords(['A', 'B', 'C']), 'A, B and C')
  const faq = faqOf(record(), 0)
  assert.deepEqual(
    faq.map((f) => f.q),
    ['How many episodes does Show have?', 'Who voices Hero in Show?', 'Who made Show?', 'What is the opening song of Show?'],
  )
  assert.match(faq[0].a, /12 episodes/)
  assert.equal(faq[1].a, 'Hero is voiced by Aoi in Japanese and by Ann in the English dub.')
  assert.equal(faq[2].a, 'Show was animated by Studio A and directed by Dee.')
  const airing = faqOf(record({ status: 'RELEASING', episodes: null, nextEpisode: { number: 8, at: 2000 }, rows: [[1, '', 500], [2, '', 900], [3, '', 3000]] }), 1000)
  assert.equal(airing[0].a, 'Show is still airing. 2 episodes have aired so far.')
  assert.match(airing[1].q, /episode 8/)
  const bare = faqOf(record({ cast: [], studios: [], key: [], songs: [], episodes: null, status: 'CANCELLED' }), 0)
  assert.deepEqual(bare, [])
})

test('title extras: official streams once per service, a real trailer id, related and recommended only with a page', () => {
  assert.deepEqual(
    watchOnOf({ watchLinks: [{ site: 'Crunchyroll', url: 'https://cr.example/a' }, { site: 'Crunchyroll', url: 'https://cr.example/b' }, { site: 'Bad', url: 'javascript:x' }] }),
    [{ site: 'Crunchyroll', url: 'https://cr.example/a' }],
  )
  assert.equal(trailerOf({ trailer: { id: 'OhNwckCLzis', thumb: '' } }).thumb, 'https://i.ytimg.com/vi/OhNwckCLzis/hqdefault.jpg')
  assert.equal(trailerOf({ trailer: { id: '<script>' } }), null)
  const titleById = new Map([2, 3, 4].map((id) => [id, { title: `T${id}`, cover: 'c', startYear: 2000 + id, format: 'TV' }]))
  const ctx = { titleById, link: { title: (id) => (id === 4 ? null : `/anime/t${id}`) } }
  const item = {
    id: 1,
    relations: [
      { id: 3, type: 'ANIME', relation: 'SIDE_STORY' },
      { id: 2, type: 'ANIME', relation: 'SEQUEL' },
      { id: 4, type: 'ANIME', relation: 'PREQUEL' },
      { id: 9, type: 'MANGA', relation: 'ADAPTATION' },
    ],
    recIds: [
      { id: 2, rating: 90 },
      { id: 3, rating: 10 },
      { id: 4, rating: 50 },
      { id: 1, rating: 99 },
    ],
  }
  const related = relatedOf(item, ctx)
  assert.deepEqual(
    related.map((r) => [r.href, r.relation]),
    [
      ['/anime/t2', 'Sequel'],
      ['/anime/t3', 'Side story'],
    ],
  )
  assert.deepEqual(recsOf(item, ctx, related), [], 'a recommendation already related is not repeated, and one without a page never shows')
  assert.deepEqual(
    recsOf(item, ctx).map((r) => r.href),
    ['/anime/t2', '/anime/t3'],
  )
})

test('characters: a cast name links to the home site only when that page exists there', () => {
  const BASE = 'https://home.example'
  // What the home site's own rule says (a face and at least one story).
  assert.equal(homeHasCharacterPage({ image: 'a.jpg', appearsIn: [{ id: 1 }] }), true)
  assert.equal(homeHasCharacterPage({ image: '', appearsIn: [{ id: 1 }] }), false)
  assert.equal(homeHasCharacterPage({ image: 'a.jpg', appearsIn: [] }), false)
  const cast = slimCast(
    [
      { id: 1, name: 'Paged', image: 'a.jpg', appearsIn: [{ id: 5 }] },
      { id: 2, name: 'No story', image: 'b.jpg', appearsIn: [] },
      { id: 3, name: 'No slug', image: 'c.jpg', appearsIn: [{ id: 5 }] },
    ],
    new Set([1, 2, 3]),
  )
  const home = { c: { 1: 'paged-1', 2: 'no-story-2' } }
  assert.equal(characterUrl(1, { base: BASE, home, cast }), `${BASE}/character/paged-1`)
  assert.equal(characterUrl(2, { base: BASE, home, cast }), null, 'no page at home: no link')
  assert.equal(characterUrl(3, { base: BASE, home, cast }), null, 'no address in the home registry: no link')
  assert.equal(characterUrl(1, { base: 'https://home.dev.workers.dev', home, cast }), null)
})

test('family mark: one pin, a symbol cut out per site, a tile for the icons', () => {
  for (const symbol of Object.keys(FAMILY_SYMBOLS)) {
    const mark = familyMark(symbol)
    assert.match(mark, /fill-rule="evenodd"/)
    assert.match(mark, /fill="currentColor"/)
  }
  assert.notEqual(familyMark('play'), familyMark('book'))
  assert.throws(() => familyMark('nope'), /no symbol/)
  const tile = tileSvg(familyMark('play'), { size: 48, ground: '#000000', ink: '#ffffff' })
  assert.match(tile, /width="48"/)
  assert.match(tile, /fill="#000000"/)
  assert.match(tile, /color="#ffffff"/)
})

test('family mark: the screen shape moves every part of a symbol into the screen', async () => {
  const { SCREEN_PATH, shapeOf } = await import('../src/lib/brand.mjs')
  const screen = familyMark('lines', 'screen')
  assert.ok(screen.includes(SCREEN_PATH))
  assert.equal(shapeOf(screen), 'screen')
  assert.equal(shapeOf(familyMark('lines')), 'pin')
  // every bar of the text lines moves, not only the first
  assert.match(screen, /M9\.5 10h12v2\.2H9\.5ZM9\.5 13\.4h12v2\.2H9\.5ZM9\.5 16\.8h7\.5V19H9\.5Z/)
  assert.throws(() => familyMark('play', 'star'), /no shape/)
})
