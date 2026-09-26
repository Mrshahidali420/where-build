// Product picks matched from publisher records (scripts/product-picks-core.mjs),
// how they fall in behind the hand picks (src/lib/picks-core.js), and the
// source-books row a show loses when its source has no English print
// (src/where/shop.mjs).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildProductPicks, validAsin, MAX_PICKS } from '../scripts/product-picks-core.mjs'
import { picksForTitleIn, booksKnownIn, PICK_LABELS } from '../src/lib/picks-core.js'
import { storesFrom } from '../src/lib/shop-links.js'
import { animeShopRows, shopOf } from '../src/where/shop.mjs'

const EMPTY = storesFrom({})

const rec = (over) => ({
  title_id: 1,
  site: 'both',
  product_type: 'volume',
  name: 'Some Story, Vol. 1',
  volume_number: 1,
  amazon_asin: '1421580365',
  confidence: 'high',
  ...over,
})

test('a show gets volume 1, a box set and a disc; comics and bad ASINs are left out', () => {
  const { titles, noEnglishBooks } = buildProductPicks({
    records: [
      rec({ volume_number: 3, amazon_asin: '1421580373' }),
      rec({ name: ' Some Story,  Vol. 1 ' }),
      rec({ product_type: 'box-set', name: 'Box', amazon_asin: '1974700569' }),
      rec({ product_type: 'blu-ray', name: 'Blu-ray', amazon_asin: 'B01ABCDEFG' }),
      rec({ title_id: 2, amazon_asin: '1421580366' }),
      rec({ title_id: 3, site: 'home' }),
      rec({ title_id: 4 }),
    ],
    checkedIds: [1, 2, 4, 5],
    handTitles: { 4: [{ a: 'B0HANDPICK', n: 'Hand', t: 'figure' }] },
    sites: ['both'],
  })
  assert.deepEqual(Object.keys(titles), ['1'])
  assert.ok(titles['1'].length <= MAX_PICKS)
  assert.deepEqual(titles['1'].map((p) => [p.n, p.t]), [['Some Story, Vol. 1', 'book'], ['Box', 'book'], ['Blu-ray', 'disc']])
  for (const pick of titles['1']) {
    assert.deepEqual(Object.keys(pick).sort(), ['a', 'n', 't'])
    assert.ok(validAsin(pick.a))
    assert.ok(PICK_LABELS[pick.t])
  }
  assert.deepEqual(noEnglishBooks, [5])
})

const HAND = { titles: { 10: [{ a: 'B0FIGURE01', n: 'Figure', t: 'figure' }] } }
const PRODUCTS = {
  titles: { 10: [{ a: '1421580365', n: 'Ignored', t: 'book' }], 20: [{ a: '1421580365', n: 'Vol. 1', t: 'book' }] },
  noEnglishBooks: [40, 50],
}

test('hand picks win; matched picks fill in with byHand false', () => {
  assert.equal(picksForTitleIn(HAND, { id: 10 }, PRODUCTS).byHand, true)
  assert.deepEqual(picksForTitleIn(HAND, { id: 20 }, PRODUCTS), { picks: PRODUCTS.titles[20], byHand: false, from: null })
  assert.equal(picksForTitleIn(HAND, { id: 21, relations: [{ id: 20, relation: 'SOURCE', title: 'M' }] }, PRODUCTS).from, 'M')
  // A hand pick anywhere in the story beats a matched pick of the show's own.
  const show = { id: 20, relations: [{ id: 10, relation: 'SOURCE', title: 'The Manga' }] }
  assert.deepEqual(picksForTitleIn(HAND, show, PRODUCTS), { picks: HAND.titles[10], byHand: true, from: 'The Manga' })
})

test('booksKnown: false only for a checked show with no book anywhere in its story', () => {
  assert.equal(booksKnownIn(HAND, { id: 40 }, PRODUCTS), false)
  assert.equal(booksKnownIn(HAND, { id: 50, relations: [{ id: 20, relation: 'SOURCE' }] }, PRODUCTS), true)
  assert.equal(booksKnownIn(HAND, { id: 777 }, PRODUCTS), true, 'never checked keeps the row')
  assert.equal(booksKnownIn(HAND, { id: 40 }, null), true, 'a site with no product file keeps the row')
})

test('the source-books row goes for a checked-empty show; games and art books stay', () => {
  const kinds = (r) => animeShopRows({ title: 'Some Show', ...r }, 'US', EMPTY).map((row) => row.kind)
  assert.deepEqual(kinds({ source: 'MANGA', books: false }), ['discs', 'merch', 'prints'])
  assert.deepEqual(kinds({ source: 'LIGHT_NOVEL', books: false }), ['discs', 'merch', 'prints'])
  assert.deepEqual(kinds({ source: 'MANGA', books: true }), ['discs', 'books', 'merch', 'prints'])
  assert.deepEqual(kinds({ source: 'MANGA' }), ['discs', 'books', 'merch', 'prints'], 'an old record keeps the row')
  assert.deepEqual(kinds({ source: 'VIDEO_GAME', books: false }), ['discs', 'games', 'merch', 'prints'])
  assert.deepEqual(kinds({ source: 'ORIGINAL', books: false }), ['discs', 'books', 'merch', 'prints'])
})

test('the /shop "chosen by hand" shelf leaves matched products out', () => {
  const record = (id, picks) => ({ id, title: `Show ${id}`, slug: `show-${id}`, cover: 'c.jpg', popularity: 100 - id, picks })
  const pick = [{ a: 'X', n: 'Vol 1', t: 'book' }]
  const shop = shopOf([record(1, { picks: pick, from: null, byHand: true }), record(2, { picks: pick, from: null, byHand: false })])
  assert.deepEqual(shop.picked.map((p) => p.title), ['Show 1'])
})
