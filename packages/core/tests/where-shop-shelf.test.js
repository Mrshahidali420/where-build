// The shop shelf of a Where anime title page (src/where/shop-shelf.mjs): which
// cards it holds, what each is called, where each link goes and how each click
// is named for the tracker.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { shelfCards, primeTrial, pickKicker, objectOf, artOf, volumeOf, isBoxSet, PRIME_TRIAL } from '../src/where/shop-shelf.mjs'
import { animeShopRows } from '../src/where/shop.mjs'
import { storesFrom } from '../src/lib/shop-links.js'
import { pickUrlFor, picksForTitleIn } from '../src/lib/picks-core.js'
import { BUY_SOURCES, cleanRow, COLUMNS } from '../src/lib/beacon-rows.js'
import { shopName, SPOTS } from '../src/lib/admin.js'

// The made-up tag of the fixture site: no real site's tag is written in the core.
const TAG = 'fixture-tag'
const STORES = storesFrom({ us: TAG })
const pickUrl = (asin) => pickUrlFor(asin, TAG)

const show = (over = {}) => ({
  id: 1,
  title: 'Some Show',
  romaji: 'Some Show',
  format: 'TV',
  status: 'FINISHED',
  episodes: 12,
  source: 'MANGA',
  popularity: 500000,
  cover: 'https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/a.jpg',
  banner: 'https://s4.anilist.co/file/anilistcdn/media/anime/banner/a.jpg',
  cast: [{ name: 'Lead', role: 'MAIN', image: 'https://s4.anilist.co/file/anilistcdn/character/large/c.jpg' }],
  songs: [{ type: 'OP', title: 'Opening', artists: [{ name: 'Band' }] }],
  key: [],
  watchOn: [{ site: 'Crunchyroll' }],
  ...over,
})

const PICKS = [
  { a: '1569319006', n: 'Some Show, Vol. 1', t: 'book' },
  { a: '1421525828', n: 'Some Show Box Set 1: Volumes 1-27', t: 'book' },
  { a: 'B09PR99KT7', n: 'Some Show Lead Figure', t: 'figure' },
]

test('the picked product leads, then a card per search row, then the trial', () => {
  const r = show()
  const buys = animeShopRows(r, 'US', STORES)
  const { cards, rest } = shelfCards({ r, buys, picks: PICKS, trial: primeTrial(r, 'US', STORES), art: artOf(r), pickUrl })
  assert.equal(cards.length, 1 + buys.length + 1)
  assert.deepEqual(cards.map((c) => c.src), ['pick', ...buys.map(() => 'buybox'), 'trial'])
  assert.deepEqual(cards.map((c) => c.aff), ['pick_book', ...buys.map((row) => row.kind), 'trial-prime'])
  assert.deepEqual(cards.filter((c) => c.lead).map((c) => c.aff), ['pick_book'])
  assert.equal(cards[0].url, 'https://www.amazon.com/dp/1569319006?tag=fixture-tag')
  assert.equal(cards[0].kicker, 'Manga · Vol. 1')
  assert.equal(cards[0].tab, 'Vol. 1')
  assert.deepEqual(rest.map((p) => p.a), ['1421525828', 'B09PR99KT7'])
})

test('the search cards keep the row words and links the record earned', () => {
  const r = show()
  const buys = animeShopRows(r, 'US', STORES)
  const { cards, rest } = shelfCards({ r, buys, picks: [], trial: null, art: artOf(r), pickUrl })
  assert.deepEqual(rest, [])
  assert.deepEqual(cards.map((c) => [c.label, c.note, c.url, c.cta]), buys.map((row) => [row.label, row.note, row.url, row.cta]))
  // With no product the first search card carries the lead weight.
  assert.deepEqual(cards.map((c) => c.lead), [true, ...buys.slice(1).map(() => false)])
})

test('each kind is drawn as its own object, around our own art', () => {
  assert.deepEqual(['discs', 'games', 'books', 'music', 'merch', 'prints', 'figure', 'plush', 'poster', 'apparel', 'disc', 'book'].map(objectOf),
    ['case', 'case', 'book', 'sleeve', 'stand', 'frame', 'stand', 'stand', 'frame', 'tee', 'case', 'book'])
  const r = show()
  const art = artOf(r)
  assert.match(art.cover, /\/cover\/medium\//)
  const { cards } = shelfCards({ r, buys: animeShopRows(r, 'US', STORES), trial: primeTrial(r, 'US', STORES), art, pickUrl })
  const by = Object.fromEntries(cards.map((c) => [c.aff, c]))
  assert.equal(by.discs.art, art.cover)
  assert.equal(by.merch.art, art.portrait)
  assert.equal(by['trial-prime'].art, art.banner)
  for (const card of cards) assert.match(card.art, /anilist\.co/, card.aff)
  // No banner and no portrait: the cover stands in, and no art at all is null.
  assert.equal(shelfCards({ r, trial: primeTrial(r, 'US', STORES), art: { cover: 'c' }, pickUrl }).cards[0].art, 'c')
  assert.equal(shelfCards({ r, trial: primeTrial(r, 'US', STORES), art: {}, pickUrl }).cards[0].art, null)
})

test('an art book search wears no volume tab; a manga search does', () => {
  const tabOf = (r) => shelfCards({ r, buys: animeShopRows(r, 'US', STORES), pickUrl }).cards.find((c) => c.aff === 'books')?.tab
  assert.equal(tabOf(show()), 'Vol. 1')
  assert.equal(tabOf(show({ source: 'ORIGINAL' })), null)
})

test('the Prime trial goes to /prime with the tag, and never promises days', () => {
  const trial = primeTrial(show(), 'US', STORES)
  assert.equal(trial.url, 'https://www.amazon.com/prime?tag=fixture-tag')
  assert.equal(trial.kind, 'trial-prime')
  assert.doesNotMatch(trial.url, /primesignup/)
  assert.doesNotMatch(`${trial.label} ${trial.note} ${trial.cta}`, /\d/)
  assert.ok(`${trial.label} ${trial.note}`.length < 80, 'the card is the same on many pages, so it stays short')
  // A country with no tag of its own falls back to the US store on the US tag.
  assert.equal(primeTrial(show(), 'DE', STORES).url, trial.url)
  // No tag at all: no bounty, so no card.
  assert.equal(primeTrial(show(), 'US', storesFrom({})), null)
})

test('the trial says the show is on Prime Video only when its stream list does', () => {
  assert.doesNotMatch(primeTrial(show(), 'US', STORES).note, /Listed/)
  assert.match(primeTrial(show({ watchOn: [{ site: 'Amazon Prime Video' }] }), 'US', STORES).note, /^Listed on Prime Video/)
  assert.match(primeTrial(show({ watchOn: [{ site: 'Amazon' }] }), 'US', STORES).note, /^Listed on Prime Video/)
})

test('a pick says what it is', () => {
  const manga = show()
  const novel = show({ source: 'LIGHT_NOVEL' })
  assert.equal(pickKicker({ n: 'Some Show, Vol. 3', t: 'book' }, manga), 'Manga · Vol. 3')
  assert.equal(pickKicker({ n: 'Some Show Box Set 1', t: 'book' }, manga), 'Manga box set')
  assert.equal(pickKicker({ n: 'Some Show, Vol. 1 (light novel)', t: 'book' }, novel), 'Light novel · Vol. 1')
  assert.equal(pickKicker({ n: 'Some Show, Vol. 1 (manga)', t: 'book' }, novel), 'Manga · Vol. 1')
  // A light novel show's unnamed book could be either form: nothing is guessed.
  assert.equal(pickKicker({ n: 'Some Show, Vol. 1', t: 'book' }, novel), 'English edition · Vol. 1')
  assert.equal(pickKicker({ n: 'Some Show: Complete Series [Blu-ray]', t: 'disc' }, manga), 'Blu-ray')
  assert.equal(pickKicker({ n: 'Some Show Lead', t: 'figure' }, manga), 'Figure')
  assert.equal(volumeOf('My Dress-Up Darling 01'), 1)
  assert.equal(volumeOf('Some Show Lead Figure'), null)
  assert.ok(isBoxSet('Naruto Box Set 1: Volumes 1-27'))
})

test('an e-book ISBN is never shown as a pick', () => {
  const hand = { titles: { 1: [{ a: '1975301234', n: 'E-book', t: 'book' }, { a: '1569319006', n: 'Print', t: 'book' }], 2: [{ a: '197530123x', n: 'E-book', t: 'book' }] } }
  const formats = { ebook: ['1975301234', '197530123X'] }
  assert.deepEqual(picksForTitleIn(hand, { id: 1 }, null, formats).picks.map((p) => p.a), ['1569319006'])
  assert.equal(picksForTitleIn(hand, { id: 2 }, null, formats), null)
  // A show whose own picks are all e-books falls through to its source's.
  const item = { id: 2, relations: [{ relation: 'SOURCE', id: 1, title: 'The Manga' }] }
  assert.deepEqual(picksForTitleIn(hand, item, null, formats), { picks: [hand.titles[1][1]], from: 'The Manga', byHand: true })
  // Without the list nothing is dropped.
  assert.equal(picksForTitleIn(hand, { id: 1 }).picks.length, 2)
})

test('a trial click is kept by the beacon and named in the admin', () => {
  assert.ok(BUY_SOURCES.has('trial'))
  const row = cleanRow({ name: 'affiliate_amazon_trial_prime', kind: 'buy', shop_kind: 'trial-prime', detail: 'trial' }, 'US', Date.parse('2026-10-11T12:00:00Z'))
  assert.equal(row[COLUMNS.indexOf('detail')], 'trial')
  assert.equal(row[COLUMNS.indexOf('shop_kind')], 'trial-prime')
  assert.equal(shopName(PRIME_TRIAL.kind), 'Prime trial')
  assert.equal(SPOTS.trial, 'Shop shelf trial card')
})
