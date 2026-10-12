// TMDB as the first source of episode stills (stills/tmdb.mjs, match.mjs,
// load.mjs): the reader, the match of a title to a show and season, the
// pick of a still, the kept ids, and the fall back to Kitsu. Answers are
// fixtures in TMDB's shape; no network.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import sharp from 'sharp'
import { bestStill, stillUrl, tmdbClient } from '../scripts/social/stills/tmdb.mjs'
import { airsAlong, cachedMatch, findShow, likeness, MISS_DAYS, seasonOf } from '../scripts/social/stills/match.mjs'
import { loadStills } from '../scripts/social/stills/load.mjs'
import { NOW, HOUR, DAY } from './social-kit.mjs'

const KEY = 'test-key-not-real'
const REC = JSON.parse(readFileSync(new URL('./fixtures/tmdb-frieren.json', import.meta.url), 'utf8'))
const KITSU = JSON.parse(readFileSync(new URL('./fixtures/kitsu-frieren.json', import.meta.url), 'utf8'))
const noWait = async () => {}
const json = (body, status = 200) => ({ ok: status < 300, status, headers: { get: () => null }, json: async () => body })

const FRIEREN = { id: 7, title: 'Sousou no Frieren 2nd Season', alt: "Frieren: Beyond Journey's End Season 2", format: 'TV', start: { year: 2026, month: 1, day: 16 }, status: 'RELEASING', popularity: 500000, malId: 52991, nextEpisode: { number: 5, at: NOW + 2 * HOUR } }

/** A made-up frame that passes the picture checks: grain, and a bright block whose place the seed sets. */
async function frame(seed) {
  const [width, height] = [1280, 720]
  const left = (seed * 233) % (width - 320)
  const pixels = Buffer.alloc(width * height * 3)
  let n = seed
  for (let i = 0; i < pixels.length; i += 1) {
    n = (n * 1103515245 + 12345) & 0x7fffffff
    const x = Math.floor(i / 3) % width
    pixels[i] = (x >= left && x < left + 320 ? 150 : 40) + (n % 90)
  }
  return sharp(pixels, { raw: { width, height, channels: 3 } }).jpeg().toBuffer()
}

/** TMDB and its picture host from the fixture; every address asked is noted. */
function tmdb({ search = REC.search } = {}) {
  const asked = []
  const fetch = async (url) => {
    const u = new URL(url)
    asked.push(u.pathname)
    if (u.hostname !== 'api.themoviedb.org' && u.hostname !== 'kitsu.io') {
      const episode = Number(u.pathname.match(/\/e(\d+)\.jpg$/)?.[1])
      const bytes = await frame(episode || [...u.pathname].reduce((sum, c) => (sum * 31 + c.charCodeAt(0)) % 65521, 7))
      return { ok: true, arrayBuffer: async () => bytes }
    }
    if (u.hostname === 'kitsu.io') return json(url.includes('/mappings') ? KITSU.mapping : KITSU.episodes)
    assert.equal(u.searchParams.get('api_key'), KEY)
    if (u.pathname === '/3/search/tv') return json(search)
    if (u.pathname === '/3/tv/209867') return json(REC.show)
    const episode = u.pathname.match(/\/episode\/(\d+)\/images$/)
    if (episode) return json(REC.images[episode[1]] || { stills: [] })
    return json({}, 404)
  }
  return { fetch, asked }
}

function memoryBook(data = { v: 1, entries: [] }) {
  let state = { data, version: 1 }
  return {
    read: async () => state,
    write: async (next, version) => (version === state.version ? ((state = { data: next, version: version + 1 }), true) : false),
    get data() {
      return state.data
    },
  }
}

test('reader: the key goes in the address, "too many" is waited out, an error never shows the address', async () => {
  let calls = 0
  const waits = []
  const get = tmdbClient(KEY, { wait: async (ms) => waits.push(ms), fetch: async () => (calls++ < 1 ? { ok: false, status: 429, headers: { get: () => '2' } } : json({ fine: true })) })
  assert.deepEqual(await get('/tv/1'), { fine: true })
  assert.ok(waits.includes(2000))
  const failing = tmdbClient(KEY, { wait: noWait, fetch: async () => ({ ok: false, status: 401, headers: { get: () => null } }) })
  await assert.rejects(failing('/tv/1'), (error) => error.message === 'TMDB answered 401' && !error.message.includes(KEY))
  assert.equal(await tmdbClient(KEY, { wait: noWait, fetch: async () => json({}, 404) })('/tv/1'), null)
})

test('still: the widest wide frame without words, never a small or square one', () => {
  assert.equal(bestStill(REC.images['3']).file_path, '/e3.jpg')
  assert.equal(bestStill({ stills: [{ file_path: '/a.jpg', width: 1280, aspect_ratio: 1.33 }, { file_path: '/b.jpg', width: 960, aspect_ratio: 1.778 }] }), null)
  assert.equal(stillUrl('/e3.jpg'), 'https://image.tmdb.org/t/p/w1280/e3.jpg')
})

test('match: names alike, the season that started with the title, and nothing on doubt', async () => {
  assert.ok(likeness("Frieren: Beyond Journey's End", "Frieren: Beyond Journey's End") === 1)
  assert.ok(likeness('Sousou no Frieren', 'Dungeon Meshi') < 0.5)
  const { fetch } = tmdb()
  const get = tmdbClient(KEY, { fetch, wait: noWait })
  assert.deepEqual(await findShow(get, FRIEREN), { id: 209867, season: 2 })
  // The first season by its own date; no season near a date; a film; no day known.
  assert.equal(seasonOf(REC.show, { start: { year: 2023, month: 9, day: 29 } }).season_number, 1)
  assert.equal(seasonOf(REC.show, { start: { year: 2025, month: 4, day: 1 } }), null)
  assert.equal(await findShow(get, { ...FRIEREN, format: 'MOVIE' }), null)
  assert.equal(await findShow(get, { ...FRIEREN, start: { year: 2026 } }), null)
  // A name that is only like another show's: no match.
  assert.equal(await findShow(tmdbClient(KEY, { fetch: tmdb({ search: { results: [{ id: 5, name: 'Dungeon Meshi', original_name: 'x', genre_ids: [16] }] } }).fetch, wait: noWait }), FRIEREN), null)
})

test('kept ids: a match is kept for good, a miss is tried again after a while', () => {
  const cache = { 7: { id: 209867, season: 2, at: NOW }, 8: { miss: true, at: NOW - (MISS_DAYS + 1) * DAY }, 9: { miss: true, at: NOW } }
  assert.equal(cachedMatch(cache, { id: 7 }, NOW).id, 209867)
  assert.equal(cachedMatch(cache, { id: 8 }, NOW), undefined)
  assert.equal(cachedMatch(cache, { id: 9 }, NOW), 'miss')
  assert.equal(cachedMatch(cache, { id: 10 }, NOW), undefined)
})

test('loader: TMDB stills of the last aired episodes, the match kept, no second search', async () => {
  const book = memoryBook()
  const first = tmdb()
  const out = await loadStills({ now: NOW, titles: [FRIEREN], fetch: first.fetch, sharp, key: KEY, book, wait: noWait })
  assert.equal(out[0].source, 'TMDB')
  assert.deepEqual(out[0].stills.map((s) => s.number), [1, 2, 3, 4])
  assert.deepEqual({ ...book.data.tmdbIds['7'], at: 0 }, { id: 209867, season: 2, at: 0 })
  const again = tmdb()
  await loadStills({ now: NOW + HOUR, titles: [FRIEREN], fetch: again.fetch, sharp, key: KEY, book, wait: noWait })
  assert.ok(!again.asked.includes('/3/search/tv'))
})

test('loader: no match on TMDB, or no key, and Kitsu gives the stills; a census counts the shows', async () => {
  const lines = []
  const book = memoryBook()
  const { fetch } = tmdb({ search: { results: [] } })
  const out = await loadStills({ now: NOW, titles: [FRIEREN], fetch, sharp, key: KEY, book, wait: noWait, census: true, say: (l) => lines.push(l) })
  assert.equal(out[0].source, 'Kitsu')
  assert.equal(book.data.tmdbIds['7'].miss, true)
  assert.match(lines.find((l) => l.startsWith('Stills census')), /Airing or premiering: 1 shows; 1\+ still 1/)
  assert.match(lines.find((l) => l.includes('Sousou no Frieren')), /no animated TMDB show of that name/)
  const plain = await loadStills({ now: NOW, titles: [FRIEREN], fetch, sharp, wait: noWait })
  assert.equal(plain[0].source, 'Kitsu')
})

test('long runner: the whole show is matched, stills come from the season airing now, counted the catalog way', async () => {
  const runner = { id: 21, title: 'ONE PIECE', format: 'TV', start: { year: 1999, month: 10, day: 20 }, status: 'RELEASING', popularity: 600000, malId: null, nextEpisode: { number: 1151, at: NOW + 2 * HOUR } }
  const show = { id: 37854, name: 'One Piece', first_air_date: '1999-10-20', last_episode_to_air: { season_number: 23, episode_number: 10 }, seasons: [{ season_number: 1, air_date: '1999-10-20' }, { season_number: 23, air_date: '2026-04-05' }] }
  const fetch = async (url) => {
    const u = new URL(url)
    if (u.hostname === 'image.tmdb.org') {
      const bytes = await frame(Number(u.pathname.match(/\/op(\d+)\.jpg$/)[1]))
      return { ok: true, arrayBuffer: async () => bytes }
    }
    if (u.pathname === '/3/search/tv') return json({ results: [{ id: 37854, name: 'One Piece', original_name: 'ワンピース', genre_ids: [16, 10759] }] })
    if (u.pathname === '/3/tv/37854') return json(show)
    const episode = u.pathname.match(/\/season\/23\/episode\/(\d+)\/images$/)
    return json(episode && Number(episode[1]) >= 9 ? { stills: [{ file_path: `/op${episode[1]}.jpg`, width: 1920, height: 1080, aspect_ratio: 1.778, iso_639_1: null }] } : { stills: [] })
  }
  const get = tmdbClient(KEY, { fetch, wait: noWait })
  assert.deepEqual(await findShow(get, runner), { id: 37854, whole: true })
  const out = await loadStills({ now: NOW, titles: [runner], fetch, sharp, key: KEY, book: memoryBook(), wait: noWait })
  assert.deepEqual(out[0].stills.map((s) => s.number), [1149, 1150])
  // No coming episode to count from: nothing, rather than a wrong number.
  assert.deepEqual(await loadStills({ now: NOW, titles: [{ ...runner, nextEpisode: null }], fetch, sharp, key: KEY, book: memoryBook(), wait: noWait }), [])
})

test('sequel inside an earlier season: taken while it airs alongside, its own episodes only', async () => {
  const day = (ms) => new Date(ms).toISOString().slice(0, 10)
  const next = { number: 3, at: NOW + 2 * HOUR }
  const sequel = { id: 31, title: 'Blue Box Season 2', format: 'TV', start: { year: 2026, month: 10, day: 1 }, status: 'RELEASING', popularity: 45000, nextEpisode: next }
  const show = { id: 207347, name: 'Blue Box', first_air_date: '2024-10-03', seasons: [{ season_number: 1, air_date: '2024-10-03' }], last_episode_to_air: { season_number: 1, episode_number: 27, air_date: day(next.at - 7 * DAY) } }
  assert.equal(airsAlong(show, sequel), true)
  assert.equal(airsAlong({ ...show, last_episode_to_air: { ...show.last_episode_to_air, air_date: '2025-03-20' } }, sequel), false)
  assert.equal(airsAlong(show, { ...sequel, status: 'FINISHED' }), false)
  const fetch = async (url) => {
    const u = new URL(url)
    if (u.hostname === 'image.tmdb.org') {
      const bytes = await frame(Number(u.pathname.match(/\/bb(\d+)\.jpg$/)[1]))
      return { ok: true, arrayBuffer: async () => bytes }
    }
    if (u.pathname === '/3/search/tv') return json({ results: [{ id: 207347, name: 'Blue Box', original_name: 'アオのハコ', genre_ids: [16, 18] }] })
    if (u.pathname === '/3/tv/207347') return json(show)
    const episode = u.pathname.match(/\/season\/1\/episode\/(\d+)\/images$/)
    return json({ stills: [{ file_path: `/bb${episode[1]}.jpg`, width: 1920, height: 1080, aspect_ratio: 1.778, iso_639_1: null }] })
  }
  const notes = []
  assert.deepEqual(await findShow(tmdbClient(KEY, { fetch, wait: noWait }), sequel, (n) => notes.push(n)), { id: 207347, whole: true })
  const out = await loadStills({ now: NOW, titles: [sequel], fetch, sharp, key: KEY, book: memoryBook(), wait: noWait })
  // TMDB's episodes 26 and 27 are the sequel's 1 and 2; season 1's own episodes are never taken.
  assert.deepEqual(out[0].stills.map((s) => s.number), [1, 2])
  assert.match((await findShow(tmdbClient(KEY, { fetch, wait: noWait }), { ...sequel, format: 'MOVIE' }, (n) => notes.push(n))) ?? notes.at(-1), /not a series/)
})
