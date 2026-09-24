// Links from a Where site to the rest of the family (src/where/cross.mjs,
// docs/PLAN.md section 3): proven relations only, at most three a page, and
// never to a workers.dev host. Plus the frozen entity addresses
// (src/where/entity-slugs.mjs).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { MAX_CARDS, characterUrl, crossCards, homeBase, isAllowedTarget } from '../src/where/cross.mjs'
import { assignSlugs, reservedIn } from '../src/where/entity-slugs.mjs'

const BASE = 'https://home.example'

const home = {
  t: { 1: ['anime', 'show'], 200: ['manga', 'show-manga'], 201: ['novel', 'show-novel'], 202: ['manhwa', 'show-webtoon'], 203: ['manga', 'show-spinoff'] },
  c: { 100: 'hero', 101: 'rival' },
}
const comicsById = new Map([200, 201, 202, 203].map((id) => [id, { id, title: `Comic ${id}`, cover: 'c.jpg', volumes: 3, status: 'FINISHED' }]))
const item = {
  id: 1,
  title: 'Show',
  cover: 'c.jpg',
  watchLinks: [{ site: 'Crunchyroll' }, { site: 'Netflix' }, { site: 'Crunchyroll' }],
  relations: [
    { id: 200, type: 'MANGA', relation: 'SOURCE' },
    { id: 201, type: 'MANGA', relation: 'ADAPTATION' },
    { id: 202, type: 'MANGA', relation: 'ADAPTATION' },
    { id: 203, type: 'MANGA', relation: 'ADAPTATION' },
    // Not a proven source: never a card.
    { id: 204, type: 'MANGA', relation: 'CHARACTER' },
    { id: 5, type: 'ANIME', relation: 'SEQUEL' },
  ],
}

test('only an https address on a real domain is a target', () => {
  assert.equal(isAllowedTarget('https://home.example/anime/x'), true)
  assert.equal(isAllowedTarget('https://home.dev.workers.dev/anime/x'), false)
  assert.equal(isAllowedTarget('https://HOME.DEV.WORKERS.DEV/x'), false)
  assert.equal(isAllowedTarget('http://home.example/x'), false)
  assert.equal(isAllowedTarget('not a url'), false)
})

test('the home base is null unless it is a real domain', () => {
  assert.equal(homeBase({ sisterSites: { manhwa: 'https://home.example/' } }), BASE)
  assert.equal(homeBase({ sisterSites: { manhwa: 'https://home.dev.workers.dev' } }), null)
  assert.equal(homeBase({ sisterSites: { manhwa: null } }), null)
})

test('cards: watch-legally first, proven sources after, never more than three', () => {
  const cards = crossCards(item, { base: BASE, home, comicsById })
  assert.equal(MAX_CARDS, 3)
  assert.equal(cards.length, 3)
  assert.equal(cards[0].href, `${BASE}/anime/show`)
  assert.match(cards[0].fact, /2 official services/)
  assert.deepEqual(
    cards.slice(1).map((c) => c.href),
    [`${BASE}/manga/show-manga`, `${BASE}/novel/show-novel`],
  )
  for (const card of cards) assert.equal(isAllowedTarget(card.href), true)
})

test('cards: nothing on a dev-host base, nothing without a proven page', () => {
  assert.deepEqual(crossCards(item, { base: null, home, comicsById }), [])
  assert.deepEqual(crossCards(item, { base: 'https://home.dev.workers.dev', home, comicsById }), [])
  const unknown = { ...item, id: 9, watchLinks: [], relations: [{ id: 999, type: 'MANGA', relation: 'SOURCE' }] }
  assert.deepEqual(crossCards(unknown, { base: BASE, home, comicsById }), [])
  // Streams nowhere official: no watch card, even with a page at home.
  const offAir = { ...item, watchLinks: [], relations: [] }
  assert.deepEqual(crossCards(offAir, { base: BASE, home, comicsById }), [])
})

test('a cast face links home only when that character page exists', () => {
  const cast = { 100: ['Hero', 'h.jpg', true], 101: ['Rival', 'r.jpg', false] }
  assert.equal(characterUrl(100, { base: BASE, home, cast }), `${BASE}/character/hero`)
  assert.equal(characterUrl(101, { base: BASE, home, cast }), null)
  assert.equal(characterUrl(102, { base: BASE, home, cast }), null)
  assert.equal(characterUrl(100, { base: null, home, cast }), null)
})

test('entity addresses: clean name first, frozen once given, never reused', () => {
  const registry = { entries: {} }
  const options = { keyOf: (p) => `p:${p.id}`, namesOf: (p) => [p.name] }
  const first = assignSlugs(registry, 'person', [{ id: 1, name: 'Kana Hanazawa' }, { id: 2, name: 'Kana Hanazawa' }], options)
  assert.equal(first.slugs.get('p:1'), 'kana-hanazawa')
  assert.equal(first.slugs.get('p:2'), 'kana-hanazawa-2')
  assert.equal(first.added, 2)
  // A later build that meets the same people in another order changes nothing.
  const again = assignSlugs(registry, 'person', [{ id: 2, name: 'Kana Hanazawa' }, { id: 1, name: 'Renamed' }], options)
  assert.equal(again.slugs.get('p:1'), 'kana-hanazawa')
  assert.equal(again.slugs.get('p:2'), 'kana-hanazawa-2')
  assert.equal(again.added, 0)
  // A slug a page once held is never handed to another page.
  registry.entries['p:1'].past = ['voice-actor/old-name']
  assert.ok(reservedIn(registry, 'person').has('old-name'))
  const next = assignSlugs(registry, 'person', [{ id: 3, name: 'Old Name' }], options)
  assert.equal(next.slugs.get('p:3'), 'old-name-3')
  // Folders do not collide: a studio may use a slug a person holds.
  const studio = assignSlugs(registry, 'studio', [{ id: 1, name: 'Kana Hanazawa' }], { keyOf: (s) => `s:${s.id}`, namesOf: (s) => [s.name] })
  assert.equal(studio.slugs.get('s:1'), 'kana-hanazawa')
})
