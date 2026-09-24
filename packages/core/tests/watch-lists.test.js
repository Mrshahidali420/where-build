// The "with an anime" lists under /where-to-watch: which comics get a row,
// which anime the row names, and how the list is split into pages
// (src/lib/watch-lists.mjs).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  WATCH_LISTS,
  WATCH_LIST_KEYS,
  WATCH_PER_PAGE,
  watchListPath,
  smallCover,
  platformNames,
  adaptationsOf,
  mainAdaptation,
  watchRow,
  buildWatchLists,
  watchPageCount,
  watchPage,
  streamingCount,
  topServices,
} from '../src/lib/watch-lists.mjs'

const COVER = 'https://s4.anilist.co/file/anilistcdn/media/manga/cover/large/bx105398-b673Vt5ZSuz3.jpg'

const show = (id, slug, extra = {}) => ({
  kind: 'anime',
  id,
  slug,
  title: slug.replace(/-/g, ' '),
  popularity: 100,
  startYear: 2020,
  status: 'FINISHED',
  watchLinks: [],
  ...extra,
})

const comic = (id, slug, country, shows, extra = {}) => ({
  kind: 'comic',
  id,
  slug,
  country,
  title: slug.replace(/-/g, ' '),
  cover: COVER,
  popularity: 1000,
  relations: shows.map((s) => ({ relation: s.relation || 'ADAPTATION', id: s.id, type: 'ANIME' })),
  animeInIndex: shows.map((s) => ({ slug: s.slug, title: s.title })),
  ...extra,
})

const bySlug = (...shows) => new Map(shows.map((s) => [s.slug, s]))

test('three lists, one per section, at /where-to-watch/<section>', () => {
  assert.deepEqual(WATCH_LIST_KEYS, ['manhwa', 'manhua', 'novel'])
  for (const key of WATCH_LIST_KEYS) assert.equal(WATCH_LISTS[key].section, key)
  assert.equal(watchListPath('manhwa'), '/where-to-watch/manhwa')
  assert.equal(watchListPath('novel', 1), '/where-to-watch/novel')
  assert.equal(watchListPath('novel', 3), '/where-to-watch/novel/3')
  assert.ok(WATCH_LISTS.manhwa.title.startsWith('Manhwa With an Anime'))
})

test('covers use the 230-pixel copy; only the folder changes', () => {
  assert.equal(smallCover(COVER), COVER.replace('/cover/large/', '/cover/medium/'))
  assert.equal(smallCover(''), '')
  assert.equal(smallCover(null), '')
})

test('service names: each once, cheapest for the viewer first', () => {
  const names = platformNames({
    watchLinks: [
      { site: 'Netflix' },
      { site: 'Crunchyroll', language: 'English' },
      { site: 'Crunchyroll', language: 'Spanish' },
      { site: 'YouTube' },
    ],
  })
  assert.equal(names.length, 3)
  assert.equal(new Set(names).size, 3)
  // YouTube is free with ads, so it comes before the monthly plans.
  assert.equal(names[0], 'YouTube')
  assert.deepEqual(platformNames({}), [])
})

test('only an adaptation or the same story told again counts, never a spin-off or a shared character', () => {
  const tv = show(1, 'tower-of-god')
  const alt = { ...show(2, 'overgeared'), relation: 'ALTERNATIVE' }
  const cameo = { ...show(3, 'crossover-special'), relation: 'CHARACTER' }
  const film = { ...show(4, 'prequel-film'), relation: 'PREQUEL' }
  const item = comic(10, 'x', 'KR', [tv, alt, cameo, film])
  const found = adaptationsOf(item, bySlug(tv, alt, cameo, film)).map((s) => s.slug)
  assert.deepEqual(found, ['tower-of-god', 'overgeared'])
})

test('an anime this build does not hold is never named', () => {
  const gone = show(1, 'blocked-show')
  const item = comic(10, 'x', 'KR', [gone])
  assert.deepEqual(adaptationsOf(item, bySlug()), [])
  assert.equal(watchRow(item, []), null)
})

test('the row leads with an anime that streams, then one already out, then the most watched', () => {
  const s1 = show(1, 'season-1', { popularity: 900, watchLinks: [{ site: 'Crunchyroll' }] })
  const s2 = show(2, 'season-2', { popularity: 300, watchLinks: [{ site: 'Crunchyroll' }] })
  const film = show(3, 'film', { popularity: 5000 })
  const next = show(4, 'season-3', { popularity: 9000, status: 'NOT_YET_RELEASED', watchLinks: [{ site: 'Crunchyroll' }] })
  assert.equal(mainAdaptation([s2, film, s1, next]).slug, 'season-1')
  assert.equal(mainAdaptation([film]).slug, 'film')
  assert.equal(mainAdaptation([]), null)
})

test('a row: the comic, the anime, its year, and a link into the anime page\'s table', () => {
  const tv = show(1, 'solo-leveling', {
    title: 'Solo Leveling',
    startYear: 2024,
    watchLinks: [{ site: 'Crunchyroll' }, { site: 'Netflix' }],
  })
  const s2 = show(2, 'solo-leveling-season-2', { popularity: 50, watchLinks: [{ site: 'Crunchyroll' }] })
  const row = watchRow(comic(7, 'solo-leveling', 'KR', [tv, s2], { title: 'Solo Leveling' }), [tv, s2])
  assert.equal(row.path, '/manhwa/solo-leveling')
  assert.equal(row.cover, COVER.replace('/cover/large/', '/cover/medium/'))
  assert.equal(row.anime.path, '/anime/solo-leveling')
  assert.equal(row.anime.watchPath, '/anime/solo-leveling#watch')
  assert.equal(row.anime.year, 2024)
  assert.equal(row.anime.upcoming, false)
  assert.deepEqual([...row.anime.platforms].sort(), ['Crunchyroll', 'Netflix'])
  assert.equal(row.moreAnime, 1)
})

test('building the lists: one row per comic, in its own section, most popular first', () => {
  const a = show(1, 'anime-a', { watchLinks: [{ site: 'Crunchyroll' }] })
  const b = show(2, 'anime-b')
  const c = show(3, 'anime-c', { watchLinks: [{ site: 'Bilibili' }] })
  const d = show(4, 'anime-d', { watchLinks: [{ site: 'Crunchyroll' }] })
  const e = show(5, 'anime-e')
  const titles = [
    comic(10, 'small-manhwa', 'KR', [a], { popularity: 10 }),
    comic(11, 'big-manhwa', 'KR', [b], { popularity: 99 }),
    comic(12, 'a-manhua', 'CN', [c]),
    comic(13, 'taiwan-manhua', 'TW', [c]),
    comic(14, 'a-novel', 'JP', [d], { kind: 'novel' }),
    comic(15, 'a-manga', 'JP', [e]),
    comic(16, 'no-anime', 'KR', []),
  ]
  const lists = buildWatchLists(titles, [a, b, c, d, e])
  assert.deepEqual(lists.manhwa.map((r) => r.path), ['/manhwa/big-manhwa', '/manhwa/small-manhwa'])
  assert.deepEqual(lists.manhua.map((r) => r.path).sort(), ['/manhua/a-manhua', '/manhua/taiwan-manhua'])
  assert.deepEqual(lists.novel.map((r) => r.path), ['/novel/a-novel'])
  // Manga has no list: see the note at the top of watch-lists.mjs.
  assert.equal(lists.manga, undefined)
  assert.equal(streamingCount(lists.manhwa), 1)
  assert.deepEqual(buildWatchLists([], []), { manhwa: [], manhua: [], novel: [] })
})

test('pages: page 1 always exists, the last page holds the rest', () => {
  const rows = Array.from({ length: WATCH_PER_PAGE * 2 + 5 }, (_, i) => ({ i }))
  assert.equal(watchPageCount(rows), 3)
  assert.equal(watchPageCount([]), 1)
  assert.equal(watchPage(rows, 1).length, WATCH_PER_PAGE)
  assert.equal(watchPage(rows, 3).length, 5)
  assert.equal(watchPage(rows, 2)[0].i, WATCH_PER_PAGE)
  assert.deepEqual(watchPage(rows, 4), [])
})

test('the services most rows name, counted once per row', () => {
  const row = (...names) => ({ anime: { platforms: names } })
  const top = topServices([row('Crunchyroll', 'Netflix'), row('Crunchyroll'), row('Bilibili'), row()], 2)
  assert.deepEqual(top, [
    { name: 'Crunchyroll', count: 2 },
    { name: 'Bilibili', count: 1 },
  ])
})
