import { test } from 'node:test'
import assert from 'node:assert/strict'
import { wordCount, mask, nearDupRate, topSentences, sample } from '../scripts/measure-core.mjs'
import { linkGraph, typeOfPath } from '../src/where/link-graph.mjs'
import { dataBlocks } from '../src/where/title-depth.mjs'

test('measure: words, masks and near twins', () => {
  assert.equal(wordCount('Three small words.'), 3)
  assert.equal(mask('It aired in 2019 on Crunchyroll.'), mask('It aired in 2004 on Netflix.'))
  const twins = [
    { text: 'Naruto is a finished TV series by Pierrot, 220 episodes, first aired 2002.', names: ['Naruto'] },
    { text: 'Bleach is a finished TV series by Pierrot, 366 episodes, first aired 2004.', names: ['Bleach'] },
    { text: 'A page that says something else entirely about a small quiet film nobody saw.', names: [] },
  ]
  assert.equal(Math.round(nearDupRate(twins) * 100), 67)
  assert.equal(topSentences(['Same line. One.', 'Same line. Two.'])[0].pages, 2)
  assert.deepEqual(sample([1, 2, 3, 4, 5], 3, 7), sample([1, 2, 3, 4, 5], 3, 7))
})

test('link graph: counts links per page type and skips noindexed pages', () => {
  const titles = [
    { slug: 'a', cast: [{ face: 'https://x.example/c', voices: [{ href: '/voice-actor/v1' }] }], similar: [{ href: '/anime/b' }], studios: [{ href: '/studio/s' }] },
    { slug: 'b', cast: [], similar: [{ href: '/anime/a' }], songs: [{ artists: [{ href: '/artist/thin' }] }] },
  ]
  const people = [
    { voicePage: true, voiceHref: '/voice-actor/v1', roles: [{ href: '/anime/a' }] },
    { voicePage: true, voiceHref: '/voice-actor/v2', roles: [{ href: '/anime/b' }] },
  ]
  const graph = linkGraph({ titles, people, studios: [{ slug: 's', works: [{ href: '/anime/a' }] }], artists: [{ slug: 'thin', noindex: true, songs: [] }] })
  assert.equal(typeOfPath('/voice-actor/x'), 'voice')
  assert.equal(graph.types.voice.pages, 2)
  assert.equal(graph.types.voice.noTitleLink, 1)
  assert.equal(graph.types.artist.noindex, 1)
  assert.equal(graph.types.artist.pages, 0)
  assert.equal(graph.toNoindex, 1)
  assert.equal(graph.outside, 1)
  assert.equal(graph.similar.max, 1)
})

test('title depth: counts the blocks a record really has', () => {
  assert.equal(dataBlocks({}), 0)
  assert.equal(dataBlocks({ cast: [{ voices: [{}] }], songs: [{}], watchOn: [{}], dated: 3, watch: {}, key: [{}], description: 'word '.repeat(40) }), 7)
  assert.equal(dataBlocks({ cast: [{ voices: [] }], description: 'short' }), 0)
})

test('the buy box is left off a near-empty title page, unless real products were picked', async () => {
  const { showsBuyBox } = await import('../src/where/title-depth.mjs')
  const full = { format: 'TV', cast: [{ voices: [{}] }], songs: [{}] }
  assert.equal(showsBuyBox(full), true)
  assert.equal(showsBuyBox({ format: 'TV', songs: [{}] }), false)
  assert.equal(showsBuyBox({ ...full, format: 'MUSIC' }), false)
  assert.equal(showsBuyBox({ format: 'MUSIC', picks: { picks: [{}] } }), true)
})

test('title notes are built from the record', async () => {
  const { castNote, similarNote } = await import('../src/where/page-text.mjs')
  const voice = (language) => ({ name: 'V', language })
  assert.equal(castNote({ cast: [{ voices: [voice('Japanese'), voice('English')] }, { voices: [voice('Japanese')] }] }), 'Japanese voices for 2 and English dub voices for 1 of 2 characters.')
  assert.equal(castNote({ cast: [{ voices: [voice('Japanese')] }] }), 'Japanese voices for 1 of 1 character.')
  assert.equal(castNote({ cast: [{ voices: [] }] }), '')
  assert.equal(similarNote({ title: 'Show', similar: [{ shared: ['Action', 'Drama'] }, { shared: ['Action'] }] }), 'Picked for what they share with Show: Action and Drama.')
})
