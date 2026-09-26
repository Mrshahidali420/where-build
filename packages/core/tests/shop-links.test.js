// Amazon links built from a site's own tags (src/lib/shop-links.js): an empty
// tag still gives a working search link, only without a `tag` parameter; a
// real tag is carried, per store, and a country with no tag falls back to the
// US store. The hand-picked product links (src/lib/picks-core.js) follow the
// same rule.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { storesFrom, storeFor, shopUrl, BOOKS, VIDEO, TOYS, ALL } from '../src/lib/shop-links.js'
import { pickUrlFor, picksForTitleIn } from '../src/lib/picks-core.js'

const EMPTY = storesFrom({ us: '', uk: '', de: '', fr: '', it: '', es: '', ca: '', jp: '' })
const TAGGED = storesFrom({ us: 'fixture-us', it: 'fixture-it' })

const paramsOf = (url) => new URL(url).searchParams

test('an empty tag builds a working link with no tag parameter', () => {
  const url = shopUrl('Frieren manga', BOOKS, 'US', EMPTY)
  assert.equal(new URL(url).host, 'www.amazon.com')
  assert.equal(paramsOf(url).get('k'), 'Frieren manga')
  assert.equal(paramsOf(url).get('i'), 'stripbooks')
  assert.equal(paramsOf(url).has('tag'), false)
  assert.doesNotMatch(url, /tag=/)
})

test('with no tag anywhere every country gets the US store, untagged', () => {
  for (const country of ['GB', 'IT', 'DE', 'JP', '', null]) {
    const url = shopUrl('Naruto anime', VIDEO, country, EMPTY)
    assert.equal(new URL(url).host, 'www.amazon.com', String(country))
    assert.equal(paramsOf(url).has('tag'), false)
  }
})

test('a real US tag is carried on the US store', () => {
  const url = shopUrl('Naruto anime', TOYS, 'US', TAGGED)
  assert.equal(paramsOf(url).get('tag'), 'fixture-us')
  assert.equal(paramsOf(url).get('i'), 'toys-and-games')
})

test('a country whose store has a tag goes to its own store with its own tag', () => {
  const url = shopUrl('Naruto anime', VIDEO, 'IT', TAGGED)
  assert.equal(new URL(url).host, 'www.amazon.it')
  assert.equal(paramsOf(url).get('tag'), 'fixture-it')
  assert.equal(paramsOf(url).get('i'), 'dvd')
})

test('a country whose store has no tag yet falls back to the US store and tag', () => {
  assert.equal(storeFor('GB', TAGGED).host, 'www.amazon.com')
  const url = shopUrl('Naruto', BOOKS, 'GB', TAGGED)
  assert.equal(paramsOf(url).get('tag'), 'fixture-us')
})

test('ALL searches the whole store, with no department', () => {
  assert.equal(paramsOf(shopUrl('Naruto poster', ALL, 'US', TAGGED)).has('i'), false)
})

test('storesFrom never reuses one store tag for another', () => {
  assert.equal(TAGGED.uk.tag, '')
  assert.equal(TAGGED.us.tag, 'fixture-us')
})

test('a pick links to amazon.com, tagged only when there is a tag', () => {
  assert.equal(pickUrlFor('1569319006', ''), 'https://www.amazon.com/dp/1569319006')
  assert.equal(pickUrlFor('1569319006', 'fixture-us'), 'https://www.amazon.com/dp/1569319006?tag=fixture-us')
})

test('picks come from the title, else from the same story in another form', () => {
  const data = { titles: { 10: [{ a: 'A1', n: 'Vol 1', t: 'book' }] }, characters: {} }
  assert.deepEqual(picksForTitleIn(data, { id: 10 }).from, null)
  const anime = { id: 20, relations: [{ relation: 'SIDE_STORY', id: 10 }, { relation: 'ADAPTATION', id: 10, title: 'The Manga' }] }
  assert.deepEqual(picksForTitleIn(data, anime), { picks: data.titles[10], byHand: true, from: 'The Manga' })
  assert.equal(picksForTitleIn(data, { id: 30, relations: [{ relation: 'CHARACTER', id: 10 }] }), null)
  assert.equal(picksForTitleIn(null, { id: 10 }), null)
})
