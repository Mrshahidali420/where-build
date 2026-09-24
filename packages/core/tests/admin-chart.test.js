// The drawing helpers of /my-admin, and the one new question they ask the
// database (dailySeries), run against the real schema.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { analyticsD1 } from './d1-shim.js'
import {
  barRects,
  clickKey,
  daysBetween,
  deltaOf,
  fillDays,
  flagOf,
  groupRepeats,
  share,
  shortDay,
  sparkPath,
  stackRects,
  withToday,
} from '../src/lib/admin-chart.js'
import { dailySeries, SERIES_FIELDS } from '../src/lib/admin-more.js'

test('sparkPath draws from left to right, highest value at the top', () => {
  const out = sparkPath([0, 5, 10], 100, 20, 0)
  assert.equal(out.line, 'M0 20 L50 10 L100 0')
  assert.equal(out.area, 'M0 20 L50 10 L100 0 L100 20 L0 20 Z')
  assert.equal(out.max, 10)
})

test('sparkPath copes with nothing, one point, all zeros and bad numbers', () => {
  assert.equal(sparkPath([]).line, '')
  assert.equal(sparkPath([7], 100, 20, 0).line, 'M50 0')
  assert.equal(sparkPath([0, 0], 100, 20, 0).line, 'M0 20 L100 20')
  assert.equal(sparkPath(['x', -3, null], 100, 20, 0).line, 'M0 20 L50 20 L100 20')
})

test('barRects stands every column on the floor and keeps a small day visible', () => {
  const out = barRects([100, 0, 1], 30, 50, 0)
  assert.deepEqual(out.map((r) => r.h), [50, 0, 1])
  assert.deepEqual(out.map((r) => r.y + r.h), [50, 50, 50])
  assert.deepEqual(out.map((r) => r.x), [0, 10, 20])
})

test('stackRects stacks parts bottom up on one shared scale', () => {
  const { max, columns } = stackRects([[2, 2], [1, 0]], 20, 40, 0)
  assert.equal(max, 4)
  assert.deepEqual(columns[0].map((r) => [r.y, r.h]), [[20, 20], [0, 20]])
  assert.deepEqual(columns[1].map((r) => [r.y, r.h]), [[30, 10], [30, 0]])
})

test('share never draws a sliver for zero, and never passes 100', () => {
  assert.equal(share(0, 10), 0)
  assert.equal(share(5, 0), 0)
  assert.equal(share(5, 10), 50)
  assert.equal(share(1, 1000), 2)
  assert.equal(share(20, 10), 100)
})

test('deltaOf says the change in words as well as colour', () => {
  assert.deepEqual(deltaOf(112, 100), { pct: 12, dir: 'up', arrow: '▲', words: 'up 12%' })
  assert.deepEqual(deltaOf(50, 100), { pct: -50, dir: 'down', arrow: '▼', words: 'down 50%' })
  assert.equal(deltaOf(100, 100).words, 'no change')
  assert.equal(deltaOf(5, 0).pct, null)
  assert.equal(deltaOf(5, 0).words, '')
})

test('flagOf turns a country code into its flag, and skips non-countries', () => {
  assert.equal(flagOf('us'), '\u{1F1FA}\u{1F1F8}')
  assert.equal(flagOf('T1'), '')
  assert.equal(flagOf('XX'), '')
  assert.equal(flagOf(''), '')
  assert.equal(flagOf('USA'), '')
})

test('groupRepeats folds only rows that repeat one after another', () => {
  const rows = [
    { kind: 'read', platform: 'Manta', path: '/a', ts: 60000 },
    { kind: 'read', platform: 'Manta', path: '/a', ts: 61000 },
    { kind: 'read', platform: 'Manta', path: '/a', ts: 119000 },
    { kind: 'read', platform: 'Tapas', path: '/a', ts: 119500 },
    { kind: 'read', platform: 'Manta', path: '/a', ts: 119900 },
    { kind: 'read', platform: 'Manta', path: '/a', ts: 180000 },
  ]
  const out = groupRepeats(rows, clickKey)
  assert.deepEqual(out.map((r) => [r.platform, r.count]), [
    ['Manta', 3],
    ['Tapas', 1],
    ['Manta', 1],
    ['Manta', 1],
  ])
  // The first (newest) row of a group is the one kept.
  assert.equal(out[0].ts, 60000)
  // The input is not changed.
  assert.equal(rows[0].count, undefined)
})

test('daysBetween and fillDays give every day, quiet days as zeros', () => {
  assert.deepEqual(daysBetween('2026-09-29', '2026-10-01'), ['2026-09-29', '2026-09-30', '2026-10-01'])
  assert.deepEqual(daysBetween('2026-09-02', '2026-09-01'), [])
  const out = fillDays([{ day: '2026-09-02', views: 4 }], '2026-09-01', '2026-09-02', ['views', 'clicks'])
  assert.deepEqual(out, [
    { day: '2026-09-01', views: 0, clicks: 0 },
    { day: '2026-09-02', views: 4, clicks: 0 },
  ])
})

test('withToday adds today as the range total minus the closed days', () => {
  const closed = [{ day: '2026-09-01', views: 10 }, { day: '2026-09-02', views: 5 }]
  const out = withToday(closed, { views: 22 }, '2026-09-03', ['views'])
  assert.deepEqual(out.at(-1), { day: '2026-09-03', views: 7 })
  assert.equal(out.length, 3)
  // Never below zero, even if the totals were cut short.
  assert.equal(withToday(closed, { views: 3 }, '2026-09-03', ['views']).at(-1).views, 0)
})

test('shortDay names the weekday', () => {
  assert.equal(shortDay('2026-09-24'), 'Thu 24')
  assert.equal(shortDay('nope'), '')
})

test('dailySeries reads the nightly tables only, with list saves per day', async () => {
  const d1 = analyticsD1()
  d1.raw.exec(`
    INSERT INTO daily_totals (day, views, sessions, clicks, reads, watches, buys, quick_exits)
      VALUES ('2026-09-01', 10, 6, 3, 2, 1, 0, 2), ('2026-09-03', 8, 5, 1, 1, 0, 0, 1);
    INSERT INTO daily_actions (day, name, item, detail, label, n, people)
      VALUES ('2026-09-01', 'list_add', '1', 'PLANNING', 'A', 2, 2),
             ('2026-09-01', 'list_add', '2', 'CURRENT', 'B', 1, 1),
             ('2026-09-01', 'feed_view', '', '', '', 9, 9);`)
  const rows = await dailySeries(d1, '2026-09-01', '2026-09-03')
  assert.equal(rows.length, 2)
  assert.deepEqual(rows[0], { day: '2026-09-01', views: 10, visits: 6, clicks: 3, reads: 2, watches: 1, buys: 0, quick_exits: 2, saves: 3 })
  const filled = fillDays(rows, '2026-09-01', '2026-09-03', SERIES_FIELDS)
  assert.deepEqual(filled.map((r) => r.views), [10, 0, 8])
})
