import { test } from 'node:test'
import assert from 'node:assert/strict'
import * as h from '../src/lib/admin-hints.js'

test('change and changeWords', () => {
  assert.equal(h.change(120, 100), 20)
  assert.equal(h.change(5, 0), null)
  assert.equal(h.changeWords(80, 100), '▼ 20% vs the 7 days before')
  assert.equal(h.changeWords(100, 100), 'same as the 7 days before')
  assert.equal(h.changeWords(3, 0), '')
})

test('traffic: a fall of 20% or more says to look at Search Console', () => {
  assert.match(h.trafficHint(79, 100).text, /Search Console/)
  assert.equal(h.trafficHint(79, 100).level, 'act')
  assert.equal(h.trafficHint(90, 100), null)
  assert.equal(h.trafficHint(10, 40), null, 'too small to judge')
  assert.equal(h.trafficHint(130, 100).level, 'good')
})

test('a new sender in the top five is named', () => {
  const now = [{ source: 'reddit.com', entries: 9 }, { source: '', entries: 50 }]
  const before = [{ source: '', entries: 40 }]
  assert.match(h.newSourceHint(now, before, (s) => `<${s}>`).text, /<reddit.com>/)
  assert.equal(h.newSourceHint(now, [...before, { source: 'reddit.com', entries: 2 }]), null)
})

test('entry pages with a low hand-off', () => {
  assert.ok(h.entryPageHint({ entries: 30, views: 200, clicks: 3 }))
  assert.equal(h.entryPageHint({ entries: 30, views: 200, clicks: 10 }), null)
  assert.equal(h.entryPageHint({ entries: 5, views: 200, clicks: 0 }), null)
})

test('quick exits over 70% of 20+ arrivals, and never a noindex', () => {
  const hint = h.quickExitHint({ entries: 40, quick_exits: 32 })
  assert.match(hint.text, /80%/)
  assert.equal(h.quickExitHint({ entries: 40, quick_exits: 28 }), null)
  assert.equal(h.quickExitHint({ entries: 10, quick_exits: 10 }), null)
})

test('no hint anywhere ever suggests noindex', () => {
  const all = [
    h.trafficHint(10, 100),
    h.trafficHint(200, 100),
    h.entryPageHint({ entries: 99, views: 99, clicks: 0 }),
    h.quickExitHint({ entries: 99, quick_exits: 99 }),
    h.savedHint(9, 0),
    h.droppedHint(9, 10),
    h.importHint(0, 0, 9),
    h.feedHint(500, 0),
    h.missingTitleHint(3),
    h.platformHint({ name: 'WEBTOON', total: 50 }),
    h.brokenLinkHint(9),
    h.noClickHint({ views: 99, clicks: 0 }),
    h.rollupHint('', '2026-09-23'),
    h.writeLoadHint(40000),
  ]
  for (const one of all) {
    assert.ok(one, 'every rule fires on these numbers')
    assert.doesNotMatch(one.text, /noindex/i)
  }
})

test('lists, import and feed floors', () => {
  assert.equal(h.savedHint(2, 0), null)
  assert.equal(h.savedHint(5, 100), null)
  assert.equal(h.droppedHint(3, 20), null)
  assert.ok(h.droppedHint(3, 9))
  assert.equal(h.importHint(3, 0, 1), null, 'fewer than 5 imports says nothing')
  assert.ok(h.importHint(6, 1, 3))
  assert.equal(h.feedHint(40, 0), null)
  assert.equal(h.feedHint(100, 2), null)
})

test('a missed search points at data/keep.json', () => {
  assert.match(h.missingTitleHint(1).text, /data\/keep\.json/)
  assert.equal(h.missingTitleHint(0), null)
})

test('broken links point at the hand-written redirects', () => {
  assert.match(h.brokenLinkHint(3).text, /data\/manual-redirects\.json/)
  assert.equal(h.brokenLinkHint(2), null)
})

test('the night job and the write allowance', () => {
  assert.equal(h.rollupHint('2026-09-23', '2026-09-23'), null)
  assert.ok(h.rollupHint('2026-09-21', '2026-09-23'))
  assert.equal(h.writeLoadHint(700), null)
  assert.equal(h.writeLoadHint(20000).level, 'watch')
  assert.equal(h.writeLoadHint(30000).level, 'act')
})

test('topHints puts things to do first and keeps three', () => {
  const out = h.topHints([
    { text: 'g', level: 'good' },
    null,
    { text: 'w', level: 'watch' },
    { text: 'a1', level: 'act' },
    { text: 'a2', level: 'act' },
  ])
  assert.deepEqual(out.map((x) => x.text), ['a1', 'a2', 'w'])
})
