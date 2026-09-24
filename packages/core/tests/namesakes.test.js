// Same-name characters: how names match, who comes first, and which page
// shows the list near the top (src/lib/namesakes.mjs).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { nameKey, groupNamesakes, namesakeLabel, isLessKnown, storyName, NAMESAKES_MAX } from '../src/lib/namesakes.mjs'

const person = (slug, name, favourites = 0, series = 'A Story', appearances = 1) => ({
  slug,
  name,
  favourites,
  series,
  appearsIn: Array.from({ length: appearances }, (_, i) => ({ slug: `t${i}` })),
})
const options = {
  nameOf: (p) => p.name,
  cardOf: (p, name) => ({ slug: p.slug, name, series: p.series }),
}

test('names match across case, accents, punctuation and spacing', () => {
  assert.equal(nameKey('Jin-Woo'), nameKey('jin  woo'))
  assert.equal(nameKey('Émilia'), nameKey('emilia'))
  assert.equal(nameKey(' Percival '), 'percival')
  assert.notEqual(nameKey('Ram'), nameKey('Rem'))
  assert.equal(nameKey(''), '')
  assert.equal(nameKey(null), '')
})

test('a unique name gets no list', () => {
  const lists = groupNamesakes([person('ram', 'Ram'), person('rem', 'Rem')], options)
  assert.equal(lists.size, 0)
})

test('the famous namesake comes first and the obscure page is marked less known', () => {
  const pages = [
    person('percival', 'Percival', 10, 'Fate/Grand Order'),
    person('percival-seven-deadly-sins', 'Percival', 168, 'The Seven Deadly Sins'),
    person('percival-other', 'PERCIVAL', 2, 'Other'),
  ]
  const lists = groupNamesakes(pages, options)
  const short = lists.get('percival')
  assert.deepEqual(short.namesakes.map((c) => c.slug), ['percival-seven-deadly-sins', 'percival-other'])
  assert.equal(short.lessKnown, true)
  const famous = lists.get('percival-seven-deadly-sins')
  assert.deepEqual(famous.namesakes.map((c) => c.slug), ['percival', 'percival-other'])
  assert.equal(famous.lessKnown, false)
  assert.equal(lists.get('percival-other').lessKnown, true)
})

test('a tie in favourites is not "less known", and appearances break the order', () => {
  const lists = groupNamesakes(
    [person('asa', 'Asa', 0, 'Mononoke', 1), person('asa-daemons', 'Asa', 0, 'Daemons', 3)],
    options
  )
  assert.equal(lists.get('asa').lessKnown, false)
  assert.equal(lists.get('asa-daemons').lessKnown, false)
  assert.deepEqual(lists.get('asa').namesakes.map((c) => c.slug), ['asa-daemons'])
})

test('the list is capped, keeping the best known', () => {
  const pages = Array.from({ length: 10 }, (_, i) => person(`luna-${i}`, 'Luna', i))
  const lists = groupNamesakes(pages, options)
  const own = lists.get('luna-0').namesakes
  assert.equal(own.length, NAMESAKES_MAX)
  assert.equal(own[0].slug, 'luna-9')
  assert.equal(own[NAMESAKES_MAX - 1].slug, `luna-${10 - NAMESAKES_MAX}`)
})

test('two records on one address are one page', () => {
  const lists = groupNamesakes([person('migi', 'Migi', 6), person('migi', 'Migi', 6)], options)
  assert.equal(lists.size, 0)
})

test('the records are not changed', () => {
  const pages = [person('a', 'Kai', 1), person('b', 'Kai', 2)]
  const before = JSON.stringify(pages)
  groupNamesakes(pages, options)
  assert.equal(JSON.stringify(pages), before)
})

test('less known needs a clear gap in favourites', () => {
  assert.equal(isLessKnown(6, 2969), true)
  assert.equal(isLessKnown(10, 168), true)
  assert.equal(isLessKnown(0, 9), false)
  assert.equal(isLessKnown(2, 3), false)
  assert.equal(isLessKnown(100, 150), false)
  assert.equal(isLessKnown(168, 168), false)
})

test('the story name stops at its first subtitle', () => {
  assert.equal(storyName('The Seven Deadly Sins: Four Knights of the Apocalypse'), 'The Seven Deadly Sins')
  assert.equal(storyName('Re:ZERO -Starting Life in Another World- Ex'), 'Re:ZERO')
  assert.equal(storyName('Fate/Grand Order: Epic of Remnant'), 'Fate/Grand Order')
  assert.equal(storyName('Parasyte'), 'Parasyte')
  assert.equal(storyName(''), '')
})

test('the link text is the search people type', () => {
  assert.equal(namesakeLabel({ name: 'Migi', series: 'Parasyte' }), 'Migi from Parasyte')
  assert.equal(namesakeLabel({ name: 'Migi', series: '' }), 'Migi')
})
