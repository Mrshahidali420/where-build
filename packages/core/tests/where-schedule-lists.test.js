// The rest of /schedule (src/where/schedule-lists.mjs): where each show
// streams, the shows airing now, and the announced lists with their minimums.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { platformsOf, popularAiring, upcomingLists, UPCOMING } from '../src/where/schedule-lists.mjs'
import { hubsOf } from '../src/where/outputs.mjs'

const NOW = Date.UTC(2026, 8, 25) / 1000
const DAY = 86400

const record = (id, extra = {}) => ({
  id,
  slug: `show-${id}`,
  title: `Show ${id}`,
  cover: `https://img.example/cover/large/${id}.jpg`,
  format: 'TV',
  status: 'FINISHED',
  startDate: null,
  startPrecision: null,
  popularity: 1000 * id,
  watchOn: [],
  nextEpisode: null,
  studios: [],
  ...extra,
})

const at = (days) => {
  const d = new Date((NOW + days * DAY) * 1000)
  return [d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate()]
}
// Announced titles sit below the "big" bar unless a test lifts them.
const upcoming = (id, days, extra = {}) => record(id, { status: 'NOT_YET_RELEASED', startDate: at(days), startPrecision: 'day', popularity: 50 * id, ...extra })

test('platformsOf: official sites once each, at most four', () => {
  const sites = ['Crunchyroll', 'Netflix', 'Crunchyroll', 'Hulu', 'HIDIVE', 'Disney Plus'].map((site) => ({ site, url: 'https://x' }))
  assert.deepEqual(platformsOf(record(1, { watchOn: sites })), ['Crunchyroll', 'Netflix', 'Hulu', 'HIDIVE'])
  assert.deepEqual(platformsOf(record(1)), [])
  assert.deepEqual(platformsOf(undefined), [])
})

test('popularAiring: releasing shows, most listed first, with the next episode and platforms', () => {
  const titles = [
    record(1, { status: 'RELEASING', nextEpisode: { at: NOW + DAY, number: 4 }, watchOn: [{ site: 'Netflix' }] }),
    record(5, { status: 'RELEASING' }),
    record(3, { status: 'RELEASING', nextEpisode: { at: NOW + 2 * DAY, number: 9 } }),
    record(9, { status: 'FINISHED' }),
  ]
  const rows = popularAiring(titles, NOW)
  assert.deepEqual(rows.map((r) => r[1]), ['/anime/show-5', '/anime/show-3', '/anime/show-1'])
  assert.deepEqual(rows[0].slice(3), [0, 0, []], 'no calendar date: episode and time are 0')
  assert.deepEqual(rows[2].slice(3), [4, NOW + DAY, ['Netflix']])
  assert.match(rows[2][2], /\/cover\/medium\//, 'the small cover')
  assert.deepEqual(popularAiring(titles.slice(0, 2), NOW), [], 'too few for a section')
})

test('popularAiring: a final episode that has aired leaves no next episode', () => {
  const titles = [1, 2, 3].map((id) => record(id, { status: 'RELEASING', episodes: 12, nextEpisode: { at: NOW - 3600, number: id === 1 ? 12 : 5 } }))
  const byHref = Object.fromEntries(popularAiring(titles, NOW).map((r) => [r[1], r.slice(3, 5)]))
  assert.deepEqual(byHref['/anime/show-1'], [0, 0], 'episode 12 of 12 aired: nothing rolls on to 13')
  assert.deepEqual(byHref['/anime/show-2'], [6, NOW - 3600 + 7 * DAY], 'mid-season: the next weekly slot')
})

test('upcomingLists: announced titles only, each list cut, thin lists dropped', () => {
  const titles = [
    upcoming(40, 30),
    upcoming(41, 10),
    upcoming(42, 20, { popularity: 50000 }),
    upcoming(43, 5, { format: 'MOVIE' }),
    upcoming(44, 60, { format: 'MOVIE', popularity: 20000 }),
    upcoming(45, 3, { cover: '' }),
    record(46, { status: 'RELEASING' }),
    upcoming(47, -5),
  ]
  const lists = upcomingLists(titles, NOW)
  const byKey = Object.fromEntries(lists.map((l) => [l.key, l.rows]))
  assert.deepEqual(
    byKey.anticipated.map((r) => r[1]),
    ['/anime/show-42', '/anime/show-44', '/anime/show-43', '/anime/show-41', '/anime/show-40'],
    'most listed first; started, coverless and dated-in-the-past titles left out',
  )
  assert.equal(byKey.big, undefined, 'two big titles are below the minimum')
  assert.deepEqual(byKey.soon.map((r) => r[1]), ['/anime/show-43', '/anime/show-41', '/anime/show-40'], 'soonest first')
  assert.deepEqual(byKey.movies.map((r) => r[1]), ['/anime/show-43', '/anime/show-44'])
  const [title, href, cover, format, when, time] = byKey.movies[0]
  assert.equal(title, 'Show 43')
  assert.equal(href, '/anime/show-43')
  assert.match(cover, /\/cover\/medium\//)
  assert.equal(format, 'Movie')
  assert.ok(when)
  assert.equal(time, Date.UTC(...at(5).map((n, i) => (i === 1 ? n - 1 : n))) / 1000)
})

test('upcomingLists: a month-only date prints as the month, with no countdown', () => {
  const titles = [40, 41, 42].map((id) => upcoming(id, 0, { startDate: [2027, 1, 1], startPrecision: 'month' }))
  const soon = upcomingLists(titles, NOW)
  assert.deepEqual(soon.map((l) => l.key), ['anticipated'], 'no exact day: not in the dated lists')
  assert.deepEqual(soon[0].rows[0].slice(4), ['January 2027', 0])
})

test('upcomingLists: the list lengths and minimums', () => {
  assert.deepEqual(UPCOMING.map((u) => [u.key, u.max, u.min]), [['anticipated', 12, 3], ['big', 12, 3], ['soon', 24, 3], ['movies', 12, 2]])
  const many = Array.from({ length: 30 }, (_, i) => upcoming(100 + i, i + 1))
  const soon = upcomingLists(many, NOW).find((l) => l.key === 'soon')
  assert.equal(soon.rows.length, 24)
})

test('hubsOf: the schedule carries platforms per row, the shows airing now and the announced lists', () => {
  const titles = [
    record(1, { status: 'RELEASING', watchOn: [{ site: 'Crunchyroll' }], nextEpisode: { at: NOW + DAY, number: 2 } }),
    record(2, { status: 'RELEASING' }),
    record(3, { status: 'RELEASING' }),
    upcoming(40, 10),
    upcoming(41, 20),
    upcoming(42, 30),
  ]
  const where = { now: NOW, schedule: { from: NOW, total: 1, days: [{ day: '2026-09-26', rows: [{ id: 1, episode: 2, at: NOW + DAY }] }] } }
  const hubs = hubsOf({ titles, people: [], studios: [], artists: [], watch: [], where })
  assert.deepEqual(hubs.schedule.days[0].rows[0], ['Show 1', '/anime/show-1', titles[0].cover, 2, NOW + DAY, 0, ['Crunchyroll']])
  assert.deepEqual(hubs.schedule.popular.map((r) => r[1]), ['/anime/show-3', '/anime/show-2', '/anime/show-1'])
  assert.deepEqual(hubs.schedule.upcoming.map((l) => l.key), ['anticipated', 'soon'])
  assert.deepEqual(hubs.home.airing, [], 'the front page rows keep their own shape')
})
