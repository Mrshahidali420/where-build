// A Where site's gates (src/where/gates.mjs), and the ownedKinds filter every
// reader of the catalog goes through (src/lib/owned.mjs), end to end through
// computeWhere (src/where/compute.mjs), the one function the build and
// scripts/count-pages.mjs both count from.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { ownedOnly } from '../src/lib/owned.mjs'
import { countGate } from '../src/lib/page-counts.mjs'
import { computeWhere } from '../src/where/compute.mjs'
import {
  WHERE_GATE_DEFAULTS,
  gateOf,
  passesArtist,
  passesEpisodes,
  passesStaff,
  passesStudio,
  passesTitle,
  passesVoiceActor,
  passesWatchOrder,
} from '../src/where/gates.mjs'

const animeSite = {
  ownedKinds: [{ kind: 'anime', notFrom: ['CN', 'TW'] }],
  gates: [
    { page: '/voice-actor/<slug>', count: 'where', type: 'voiceActor', min: 2 },
    { page: '/watch-order/<slug>', count: 'where', type: 'watchOrder', min: 2 },
  ],
}

const anime = (id, extra = {}) => ({ id, kind: 'anime', country: 'JP', cover: 'c.jpg', title: `Show ${id}`, episodes: 12, ...extra })

test('ownedKinds: the anime site holds anime not from China or Taiwan, and nothing else', () => {
  const records = [anime(1), anime(2, { country: 'CN' }), anime(3, { country: 'TW' }), anime(4, { country: 'KR' }), { id: 5, kind: 'comic', country: 'JP' }]
  assert.deepEqual(
    ownedOnly(animeSite, records).map((r) => r.id),
    [1, 4],
  )
})

test('a site gate overrides the default; the rest keep the plan numbers', () => {
  assert.equal(gateOf(animeSite, 'voiceActor').min, 2)
  assert.equal(gateOf(animeSite, 'staff').min, WHERE_GATE_DEFAULTS.staff.min)
})

test('each gate lets through exactly what it says', () => {
  const titleGate = { credits: 3 }
  assert.equal(passesTitle({ cover: null }, { episodes: true, airing: true, credits: 9 }, titleGate), false)
  assert.equal(passesTitle({ cover: 'c' }, { episodes: false, airing: false, credits: 2 }, titleGate), false)
  assert.equal(passesTitle({ cover: 'c' }, { episodes: false, airing: false, credits: 3 }, titleGate), true)
  assert.equal(passesTitle({ cover: 'c' }, { episodes: true, airing: false, credits: 0 }, titleGate), true)
  assert.equal(passesEpisodes(12, { min: 13 }), false)
  assert.equal(passesEpisodes(13, { min: 13 }), true)
  assert.equal(passesVoiceActor({ name: 'A', voiceRoleCount: 3 }, { min: 3 }), true)
  assert.equal(passesVoiceActor({ name: '', voiceRoleCount: 30 }, { min: 3 }), false)
  assert.equal(passesStaff({ name: 'A', staffWorkCount: 1 }, { min: 2 }), false)
  assert.equal(passesStudio({ name: 'S', titleIds: [1, 2] }, { min: 2 }), true)
  assert.equal(passesArtist({ name: 'X', songs: [{}] }, { min: 2 }), false)
  assert.equal(passesWatchOrder({ ids: [1, 2, 3] }, { min: 3 }), true)
})

test('computeWhere: a title another site owns never reaches a page, a person or a franchise', () => {
  const data = {
    anime: [
      anime(1, { relations: [{ id: 2, relation: 'SEQUEL' }, { id: 3, relation: 'SEQUEL' }] }),
      anime(2, { relations: [{ id: 1, relation: 'PREQUEL' }] }),
      // Donghua: the manhua site's.
      anime(3, { country: 'CN', relations: [{ id: 1, relation: 'PREQUEL' }] }),
      // No cover: no page.
      anime(4, { cover: null }),
    ],
    credits: {
      1: { characters: [{ id: 100, voiceActors: [{ id: 20, language: 'Japanese' }] }] },
      2: { characters: [{ id: 101, voiceActors: [{ id: 20, language: 'Japanese' }] }] },
      3: { characters: [{ id: 102, voiceActors: [{ id: 30, language: 'Japanese' }] }, { id: 103, voiceActors: [{ id: 30, language: 'Japanese' }] }] },
    },
    staff: { 20: { name: 'Voice' }, 30: { name: 'Donghua Voice' } },
    airing: { schedule: [], history: {} },
    themes: {},
  }
  const where = computeWhere(animeSite, data)
  assert.deepEqual(
    where.titles.map((t) => t.item.id),
    [1, 2],
  )
  assert.deepEqual([...where.pages.voice], [20])
  assert.equal(where.people.has(30), false)
  assert.deepEqual([...where.pages.watch], [1])
  assert.deepEqual(where.franchises.get(1).ids, [1, 2])
  assert.equal(where.counts.title, 2)
  // count-pages prints these same numbers (page-counts.mjs, count: 'where').
  assert.equal(countGate({ count: 'where', type: 'voiceActor' }, [], { where: where.counts }), 1)
  assert.equal(countGate({ count: 'where', type: 'voiceActor' }, []), null)
})
