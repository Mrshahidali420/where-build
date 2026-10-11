import { test } from 'node:test'
import assert from 'node:assert/strict'
import { pairChance, spreadDraw, capPicks, SIMILAR_CAP } from '../src/where/link-spread.mjs'
import { similarAll } from '../src/where/similar.mjs'
import { dubLinks } from '../src/where/dub-links.mjs'
import { similarCardsOf } from '../src/where/record-title.mjs'

test('pair chance is fixed for a pair and spread over [0, 1)', () => {
  assert.equal(pairChance(3, 9), pairChance(3, 9))
  assert.notEqual(pairChance(3, 9), pairChance(9, 3))
  const draws = Array.from({ length: 200 }, (_, i) => pairChance(1, i))
  assert.ok(draws.every((d) => d >= 0 && d < 1))
  assert.ok(Math.abs(draws.reduce((n, d) => n + d, 0) / 200 - 0.5) < 0.1)
})

test('a well watched show draws higher on average, but not on every page', () => {
  const big = { id: 1, popularity: 400000 }
  const small = { id: 2, popularity: 50 }
  let bigFirst = 0
  for (let page = 10; page < 510; page++) if (spreadDraw(page, big) > spreadDraw(page, small)) bigFirst++
  assert.ok(bigFirst > 350 && bigFirst < 500, String(bigFirst))
})

test('cap: a show at the cap gives its place away, unless nothing else can fill it', () => {
  const rows = [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }]
  const usedOf = (id) => (id === 1 ? SIMILAR_CAP : 0)
  assert.deepEqual(capPicks(rows, { usedOf, shown: 2 }).map((r) => r.id), [2, 3])
  assert.deepEqual(capPicks(rows.slice(0, 2), { usedOf, shown: 2 }).map((r) => r.id), [1, 2])
})

test('you may also like: equally close shows are not the same famous few on every page', () => {
  const items = Array.from({ length: 400 }, (_, i) => ({ id: i + 1, popularity: 1000 - i, genres: ['Action', 'Drama'], tags: [] }))
  const similar = similarAll(items)
  const firsts = new Set(items.map((item) => similar.get(item.id)[0].id))
  assert.ok(firsts.size > 100, String(firsts.size))
  assert.ok(similar.get(1).every((row) => row.id !== 1))
  assert.deepEqual(similarAll(items).get(7), similar.get(7), 'the same on every build')
})

test('the title page counts its picks against the cap', () => {
  const ctx = {
    titleById: new Map([1, 2, 3].map((id) => [id, { title: `T${id}` }])),
    link: { title: (id) => `/anime/t${id}` },
    similar: new Map([[9, [{ id: 1, genres: ['A'] }, { id: 2, genres: ['A'] }, { id: 3, genres: ['A'] }]]]),
    similarUsed: new Map([[1, SIMILAR_CAP]]),
  }
  const picks = similarCardsOf({ id: 9 }, ctx)
  assert.deepEqual(picks.map((p) => p.id), [1, 2, 3], 'fewer candidates than places: nobody is dropped')
  assert.equal(ctx.similarUsed.get(2), 1)
})

test('other-language voices: the people with no title link are named first', () => {
  const voice = (id, language) => ({ id, language })
  const credits = {
    1: { characters: [{ id: 1, voiceActors: [voice(10, 'Japanese'), voice(20, 'German'), voice(21, 'German'), voice(30, 'Italian')] }] },
    2: { characters: [{ id: 2, voiceActors: [voice(20, 'German'), voice(22, 'German'), voice(99, 'German')] }] },
  }
  const linked = (id) => id !== 99
  const one = dubLinks([{ id: 2 }, { id: 1 }], credits, linked, { perTitle: 1 })
  assert.deepEqual(one.get(1), [{ id: 20, language: 'German' }])
  // Title 2: 20 already has a link from title 1, so 22 is named; 99 has no page to link.
  assert.deepEqual(one.get(2), [{ id: 22, language: 'German' }])
  // With room for all, they print by language, then in cast order.
  assert.deepEqual(dubLinks([{ id: 1 }], credits, linked).get(1).map((v) => v.id), [20, 21, 30])
  assert.equal(dubLinks([{ id: 3 }], { 3: { characters: [{ id: 1, voiceActors: [voice(10, 'Japanese')] }] } }, linked).size, 0)
})
