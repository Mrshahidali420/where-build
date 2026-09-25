// The directory and year hubs (src/where/hubs.mjs, src/where/hub-cards.mjs):
// ranked lists, the A to Z with thin letters folded into '#', the year plan
// that folds thin years together, the pages each one builds, and the facts on
// every card.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { directory, hubPaths, letterPath, pageSlice, sortPath, yearPlan, PER_LETTER_PAGE, PER_RANK_PAGE } from '../src/where/hubs.mjs'
import { artistCard, formatGroups, mainLanguage, newestRows, pictureOf, roleWords, spanOf, staffCard, studioCard, voiceCard, watchCard } from '../src/where/hub-cards.mjs'

// [name, href, count, image, line, pop, year, span]
const card = (name, count, pop = 0, year = 0) => [name, `/x/${name.toLowerCase()}`, count, '', '', pop, year, '']

test('directory: rows by name, ranked lists best first with ties by count then name', () => {
  const rows = [card('Cara', 5, 10, 2001), card('Abe', 9, 10, 2020), card('Bea', 1, 99, 1999)]
  const dir = directory(rows, ['popular', 'roles', 'newest'], { minLetter: 1 })
  assert.deepEqual(
    dir.rows.map((r) => r[0]),
    ['Abe', 'Bea', 'Cara'],
  )
  const names = (list) => list.map((i) => dir.rows[i][0])
  assert.deepEqual(names(dir.sorts.popular), ['Bea', 'Abe', 'Cara'], 'popular ties broken by the count')
  assert.deepEqual(names(dir.sorts.roles), ['Abe', 'Cara', 'Bea'])
  assert.deepEqual(names(dir.sorts.newest), ['Abe', 'Cara', 'Bea'])
  assert.equal(dir.total, 3)
})

test('directory: a ranked list stops at rankMax, the A to Z keeps everyone', () => {
  const rows = Array.from({ length: 30 }, (_, i) => card(`Name ${String(i).padStart(2, '0')}`, i))
  const dir = directory(rows, ['popular'], { rankMax: 10, minLetter: 1 })
  assert.equal(dir.sorts.popular.length, 10)
  assert.equal(dir.letters.n.length, 30)
})

test('directory: a thin letter is folded into #, in name order, and the A to Z points there', () => {
  const rows = [card('Quinn', 1), card('Xan', 1), card('Adam', 1), card('Alan', 1), card('Amy', 1), card('9nine', 1)]
  const dir = directory(rows, ['popular'], { minLetter: 3 })
  assert.deepEqual(Object.keys(dir.letters).sort(), ['0', 'a'])
  assert.deepEqual(dir.merged, ['q', 'x'])
  assert.deepEqual(
    dir.letters['0'].map((i) => dir.rows[i][0]),
    ['9nine', 'Quinn', 'Xan'],
  )
  assert.equal(letterPath('g', dir, 'q'), '/directory/g/0')
  assert.equal(letterPath('g', dir, 'a'), '/directory/g/a')
  assert.equal(letterPath('g', dir, 'z'), null, 'nobody under z: no link')
})

test('hub paths: the front is the default sort, every other sort and page has its own address', () => {
  assert.equal(sortPath('studios', 'popular'), '/directory/studios')
  assert.equal(sortPath('studios', 'popular', 2), '/directory/studios/by/popular/2')
  assert.equal(sortPath('studios', 'shows'), '/directory/studios/by/shows')
  assert.equal(sortPath('studios', 'shows', 3), '/directory/studios/by/shows/3')
  const many = (n) => Array.from({ length: n }, (_, i) => i)
  const hubs = {
    groups: { studios: { letters: { a: many(PER_LETTER_PAGE + 1) }, sorts: { popular: many(PER_RANK_PAGE + 1), shows: many(5) } } },
    years: { 2024: [1], 'before-1961': [1] },
    seasonIndex: [],
    genreIndex: [],
    schedule: null,
  }
  const paths = hubPaths(hubs).map((p) => p.path)
  for (const path of [
    '/directory/studios',
    '/directory/studios/by/popular/2',
    '/directory/studios/by/shows',
    '/directory/studios/a',
    '/directory/studios/a/2',
    '/year',
    '/year/2024',
    '/year/before-1961',
  ]) {
    assert.ok(paths.includes(path), path)
  }
  assert.equal(paths.includes('/directory/studios/by/popular'), false, 'no twin of the front page')
  assert.equal(paths.includes('/directory/studios/by/shows/2'), false)
  assert.equal(new Set(paths).size, paths.length, 'every path once')
  assert.deepEqual(pageSlice([1, 2, 3, 4, 5], 2, 2), [3, 4])
})

test('year plan: busy years keep their page, the thin years at either end share one', () => {
  const counts = { 1950: 3, 1955: 20, 1958: 4, 1960: 30, 1961: 12, 2024: 50, 2025: 40, 2026: 20, 2027: 15, 2028: 2, 2031: 1 }
  const plan = yearPlan(counts, { min: 12, current: 2026 })
  assert.deepEqual(plan.own, [2027, 2026, 2025, 2024, 1961, 1960])
  assert.deepEqual(plan.early, { key: 'before-1959', label: 'Before 1959', years: [1950, 1955, 1958] })
  assert.equal(plan.late, null, 'three shows after 2027 are too few for a page')
  const late = yearPlan({ ...counts, 2029: 12 }, { min: 12, current: 2026 })
  assert.deepEqual(late.late, { key: 'from-2028', label: '2028 and later', years: [2028, 2029, 2031] })
  assert.equal(yearPlan({ 2000: 3, 2026: 40 }, { min: 12, current: 2026 }).early, null, 'a lone thin year is not enough for a page')
})

const pops = { '/anime/a': 100, '/anime/b': 900, '/anime/c': 50 }
const popOf = (href) => pops[href] || 0

test('cards: a voice actor is known for the main role in their most watched show', () => {
  const p = {
    name: 'Aoi',
    voiceHref: '/voice-actor/aoi',
    image: 'aoi.jpg',
    favourites: 42,
    counts: { roles: 3 },
    roles: [
      { href: '/anime/b', title: 'B', year: 2020, role: 'SUPPORTING', character: { name: 'Side' } },
      { href: '/anime/a', title: 'A', year: 2024, role: 'MAIN', character: { name: 'Hero' } },
      { href: '/anime/c', title: 'C', year: 2010, role: 'MAIN', character: { name: 'Lead' } },
    ],
  }
  assert.deepEqual(voiceCard(p, popOf), ['Aoi', '/voice-actor/aoi', 3, 'aoi.jpg', 'Hero in A', 42, 2024, '', ''])
})

test('cards: a voice actor card carries the language most of their roles are in', () => {
  assert.equal(mainLanguage([{ language: 'English' }, { language: 'Japanese' }, { language: 'English' }]), 'English')
  assert.equal(mainLanguage([{ language: 'Japanese' }, { language: 'English' }]), 'Japanese', 'a tie goes to the first met')
  assert.equal(mainLanguage([]), '')
  const p = { name: 'Em', voiceHref: '/voice-actor/em', counts: { roles: 2 }, roles: [{ href: '/anime/a', title: 'A', year: 2024, role: 'MAIN', character: { name: 'Hero' }, language: 'English' }] }
  assert.equal(voiceCard(p, popOf)[8], 'English')
})

test('directory: the English dub list keeps only English voices, most popular first, and is no page when empty', () => {
  const voice = (name, pop, language) => [name, `/voice-actor/${name.toLowerCase()}`, 1, '', '', pop, 2024, '', language]
  const rows = [voice('Abe', 5, 'Japanese'), voice('Bea', 3, 'English'), voice('Cy', 9, 'English')]
  const dir = directory(rows, ['popular', 'roles', 'english'], { minLetter: 1 })
  assert.deepEqual(
    dir.sorts.english.map((i) => dir.rows[i][0]),
    ['Cy', 'Bea'],
  )
  assert.equal(dir.sorts.popular.length, 3, 'the other lists keep everyone')
  const paths = (d) => hubPaths({ groups: { 'voice-actors': d }, years: {} }).map((p) => p.path)
  assert.ok(paths(dir).includes('/directory/voice-actors/by/english'))
  const none = directory([voice('Abe', 5, 'Japanese')], ['popular', 'english'], { minLetter: 1 })
  assert.ok(!paths(none).some((p) => p.includes('/by/english')), 'no English voices, no page')
  assert.ok(paths(none).includes('/directory/voice-actors'), 'the front page stays')
})

test('cards: staff, studios, artists and watch orders', () => {
  assert.equal(roleWords('Episode Director (eps 3, 7)'), 'Episode Director')
  assert.equal(spanOf([2001, 1999, 2010]), '1999 to 2010')
  assert.equal(spanOf([2001]), '2001')
  assert.equal(spanOf([]), '')

  const staff = {
    name: 'Dee',
    staffHref: '/staff/dee',
    image: '',
    favourites: 1,
    counts: { shows: 3 },
    works: [
      { items: [{ href: '/anime/a', title: 'A', year: 2001, roles: ['Director'] }] },
      { items: [{ href: '/anime/b', title: 'B', year: 2011, roles: ['Storyboard (ep 3)', 'Theme Song Performance'] }] },
      { items: [{ href: '/anime/c', title: 'C', year: 2005, roles: ['Series Composition'] }] },
    ],
  }
  assert.deepEqual(staffCard(staff, popOf), ['Dee', '/staff/dee', 3, '', 'Director, A', 150, 2011, '2001 to 2011'], 'a key credit wins over a more watched storyboard')
  const singer = { ...staff, works: [{ items: [{ href: '/anime/b', title: 'B', year: 2011, roles: ['Theme Song Performance', 'Key Animation'] }] }] }
  assert.equal(staffCard(singer, popOf)[4], 'Key Animation, B', 'crew work, never the song')
  assert.equal(staffCard(singer, popOf)[5], 0, 'no key credit: nothing to rank by')

  const studio = { name: 'Studio', slug: 'studio', works: [{ href: '/anime/a', title: 'A', year: 1999, cover: 'a.jpg' }, { href: '/anime/b', title: 'B', year: 2020, cover: 'b.jpg' }] }
  assert.deepEqual(studioCard(studio, popOf), ['Studio', '/studio/studio', 2, ['b.jpg', 'a.jpg'], 'Best known for B', 1000, 2020, '1999 to 2020'])

  const artist = { name: 'Band', slug: 'band', songs: [{ type: 'OP', title: 'Blue', anime: { href: '/anime/a', title: 'A', year: 2001, cover: 'a.jpg' } }, { type: 'ED', title: 'Red', anime: { href: '/anime/b', title: 'B', year: 2002, cover: 'b.jpg' } }] }
  assert.deepEqual(artistCard(artist, popOf), ['Band', '/artist/band', 2, 'b.jpg', '“Red”, B ending', 1000, 2002, '2001 to 2002'])

  const watch = { name: 'Saga', slug: 'saga', entries: [{ href: '/anime/c', title: 'Film', year: 1998, cover: 'c.jpg', main: false }, { href: '/anime/a', title: 'One', year: 2000, cover: 'a.jpg', main: true }] }
  assert.deepEqual(watchCard(watch, popOf), ['Saga', '/watch-order/saga', 2, 'a.jpg', 'Start with One', 100, 2000, '1998 to 2000'])
})

test('format groups: TV first, each group in its own order, unknown formats last', () => {
  const row = (title, format) => [title, `/anime/${title}`, '', format]
  const groups = formatGroups([row('a', 'Movie'), row('b', 'TV series'), row('c', 'Movie'), row('d', 'Weird'), row('e', 'ONA')])
  assert.deepEqual(
    groups.map((g) => [g.key, g.label, g.rows.map((r) => r[0]).join('')]),
    [
      ['tv-series', 'TV series', 'b'],
      ['ona', 'ONAs', 'e'],
      ['movie', 'Movies', 'ac'],
      ['anime', 'Other', 'd'],
    ],
  )
})

test('newest rows: by season then year, ties keep the most watched order, undated rows left out', () => {
  const row = (title, season) => [title, `/anime/${title}`, '', 'TV series', 12, season]
  const rows = [row('a', 'Spring 2024'), row('b', ''), row('c', 'Fall 2024'), row('d', 'Spring 2024'), row('e', '2025')]
  assert.deepEqual(
    newestRows(rows, 3).map((r) => r[0]),
    ['e', 'c', 'a'],
  )
})

test('pictures: the AniList placeholder is no picture', () => {
  assert.equal(pictureOf('https://s4.anilist.co/file/anilistcdn/staff/large/default.jpg'), '')
  assert.equal(pictureOf('https://s4.anilist.co/file/anilistcdn/staff/large/n95118-oOElrn1aSaiC.png'), 'https://s4.anilist.co/file/anilistcdn/staff/large/n95118-oOElrn1aSaiC.png')
  assert.equal(pictureOf(''), '')
  const p = { name: 'X', voiceHref: '/voice-actor/x', image: 'https://s4.anilist.co/file/anilistcdn/staff/large/default.jpg', counts: { roles: 3 }, roles: [] }
  assert.equal(voiceCard(p, () => 0)[3], '')
})

test('the home studios: one show per series, three covers, as many rows as the watch orders', async () => {
  const { hubsOf, seriesKey } = await import('../src/where/outputs.mjs')
  assert.equal(seriesKey('HAIKYU!! 2nd Season'), seriesKey('HAIKYU!!'))
  assert.equal(seriesKey('The Apothecary Diaries'), 'apothecary')
  assert.notEqual(seriesKey('ONE PIECE'), seriesKey('One-Punch Man'))
  const work = (title, pop) => ({ title, href: `/anime/${pop}`, cover: `c${pop}` })
  const titles = [1, 2, 3, 4].map((n) => ({ id: n, slug: String(n), title: String(n), popularity: n * 10, studios: [] }))
  const works = [work('KONOSUBA', 4), work('KONOSUBA 2', 3), work('Mob Psycho 100', 2), work('Other', 1)]
  const studios = Array.from({ length: 12 }, (_, i) => ({ id: i, name: `S${i}`, slug: `s${i}`, works }))
  const { home } = hubsOf({ titles, people: [], studios, artists: [], watch: [] })
  assert.equal(home.studios.length, 8)
  assert.deepEqual(home.studios[0][3], ['KONOSUBA', 'Mob Psycho 100'])
  assert.deepEqual(home.studios[0][4], ['c4', 'c2', 'c1'])
})
