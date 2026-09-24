// Which records a site owns (src/lib/owned.mjs) and how its gates count them
// (src/lib/page-counts.mjs), the two halves of scripts/count-pages.mjs.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { ownsTitle } from '../src/lib/owned.mjs'
import { countGate } from '../src/lib/page-counts.mjs'

const anime = (id, country, extra = {}) => ({ id, kind: 'anime', country, cover: 'c.jpg', ...extra })
const comic = (id, country, extra = {}) => ({ id, kind: 'comic', country, cover: 'c.jpg', ...extra })

test('a site owns a kind, narrowed by country of origin', () => {
  const animeSite = { ownedKinds: [{ kind: 'anime', notFrom: ['CN', 'TW'] }] }
  const manhuaSite = { ownedKinds: [{ kind: 'comic', from: ['CN', 'TW'] }, { kind: 'anime', from: ['CN', 'TW'] }] }
  assert.equal(ownsTitle(animeSite, anime(1, 'JP')), true)
  assert.equal(ownsTitle(animeSite, anime(2, 'CN')), false)
  assert.equal(ownsTitle(animeSite, comic(3, 'JP')), false)
  assert.equal(ownsTitle(manhuaSite, anime(2, 'CN')), true)
  assert.equal(ownsTitle(manhuaSite, comic(4, 'TW')), true)
  assert.equal(ownsTitle(manhuaSite, comic(5, 'KR')), false)
})

test('a title page needs a cover and one fact from its gate', () => {
  const records = [
    anime(1, 'JP', { episodes: 12 }),
    anime(2, 'JP', { episodes: 0, nextEpisode: { episode: 1 } }),
    anime(3, 'JP', { episodes: 0 }),
    anime(4, 'JP', { episodes: 24, cover: null }),
  ]
  assert.equal(countGate({ count: 'titles', any: ['episodes'] }, records), 2)
  assert.equal(countGate({ count: 'episodes', min: 13 }, records), 1)
})

test('a gate with a kind counts only that kind', () => {
  const records = [comic(1, 'CN', { chapters: 10 }), anime(2, 'CN', { episodes: 12 })]
  assert.equal(countGate({ count: 'titles', kind: 'anime', any: ['episodes'] }, records), 1)
  assert.equal(countGate({ count: 'titles', kind: 'comic', any: ['chapters', 'episodes'] }, records), 1)
})

test('people and studios need enough works', () => {
  const records = [
    comic(1, 'JP', { authors: [{ name: 'A' }, { name: 'B' }], popularity: 100, studios: ['S'] }),
    comic(2, 'JP', { authors: [{ name: 'A' }], popularity: 9000, studios: ['S'] }),
    comic(3, 'JP', { authors: [{ name: 'C' }], popularity: 9000, studios: ['T'] }),
  ]
  // A has two works; C has one well-known work; B has one obscure work.
  assert.equal(countGate({ count: 'people', min: 2, popular: 5000 }, records), 2)
  assert.equal(countGate({ count: 'people', min: 2 }, records), 1)
  assert.equal(countGate({ count: 'studios', min: 2 }, records), 1)
  assert.equal(countGate({ count: 'titles', any: ['author'] }, records), 2)
})

test('franchises join entries through their relations', () => {
  const rel = (id, relation, type = 'ANIME') => ({ id, relation, type })
  const records = [
    anime(1, 'JP', { relations: [rel(2, 'SEQUEL'), rel(9, 'ADAPTATION', 'MANGA')] }),
    anime(2, 'JP', { relations: [rel(1, 'PREQUEL'), rel(3, 'SEQUEL')] }),
    anime(5, 'JP', { relations: [rel(6, 'SIDE_STORY')] }),
  ]
  assert.equal(countGate({ count: 'franchises', types: ['ANIME'], min: 3 }, records), 1)
  assert.equal(countGate({ count: 'franchises', types: ['ANIME'], min: 2 }, records), 2)
  // Across media the adaptation joins the first story too.
  assert.equal(countGate({ count: 'franchises', lineage: true, min: 4 }, records), 1)
})

test('tags, artists and credits', () => {
  const records = [anime(1, 'JP', { tags: ['Isekai'] }), anime(2, 'JP', { tags: ['Isekai', 'Music'] })]
  assert.equal(countGate({ count: 'tags', min: 2 }, records), 1)
  const themes = { 1: [{ artists: ['X'] }, { artists: ['X', 'Y'] }], 2: [{ artists: ['Y'] }] }
  assert.equal(countGate({ count: 'artists', min: 2 }, records, { themes }), 2)
  assert.equal(countGate({ count: 'artists', min: 2 }, records), null)
  assert.equal(countGate({ count: 'credits', min: 3 }, records), null)
})
