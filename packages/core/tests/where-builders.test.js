// The Where entity builders (src/where/): people, studios, song artists,
// franchises, episode rows and crew roles, each from small hand-made inputs.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildPeople, byProminence } from '../src/where/people.mjs'
import { buildStudios, studiosOfTitle } from '../src/where/studios.mjs'
import { buildArtists, artistKey } from '../src/where/artists.mjs'
import { buildFranchises, mainChain, releaseOrder } from '../src/where/franchises.mjs'
import { buildEpisodes, datedCount, parseStreamingTitle } from '../src/where/episodes.mjs'
import { baseRole, categoryOf, keyCreditOf, roleDetail } from '../src/where/roles.mjs'

const credits = {
  1: {
    staff: [
      { id: 10, role: 'Director' },
      { id: 11, role: 'Key Animation (ep 3)' },
      { id: 12, role: null },
    ],
    characters: [
      { id: 100, role: 'MAIN', voiceActors: [{ id: 20, language: 'Japanese' }, { id: 21, language: 'English' }] },
      { id: 101, role: 'SUPPORTING', voiceActors: [{ id: 20, language: 'Japanese' }] },
    ],
    studios: [
      { id: 50, name: 'Bones', isMain: true },
      { id: 51, name: 'Aniplex', isMain: false },
    ],
  },
  2: {
    staff: [{ id: 10, role: 'Director' }, { id: 10, role: 'Storyboard' }],
    characters: [{ id: 100, role: 'MAIN', voiceActors: [{ id: 20, language: 'Japanese' }] }],
    studios: [{ id: 50, name: 'Bones', isMain: true }],
  },
}
const staff = { 10: { name: 'Director Person' }, 20: { name: 'Voice Person' }, 21: { name: 'Dub Person' } }

test('people: one record per person, voice roles and crew shows counted distinctly', () => {
  const people = buildPeople([{ id: 1 }, { id: 2 }], credits, staff)
  const director = people.get(10)
  assert.equal(director.name, 'Director Person')
  // Two credits on title 2 are one show.
  assert.equal(director.staffWorkCount, 2)
  // The same character in two titles is two roles; two characters in one title are two roles.
  assert.equal(people.get(20).voiceRoleCount, 3)
  assert.equal(people.get(21).voiceRoleCount, 1)
  // A credit with no role is skipped, not crashed on.
  assert.equal(people.has(12), false)
  // A person staff.json does not know still gets a record, with no name (the gates need one).
  assert.equal(people.get(11).name, '')
})

test('people: only the titles handed in are read', () => {
  const people = buildPeople([{ id: 2 }], credits, staff)
  assert.equal(people.get(20).voiceRoleCount, 1)
  assert.equal(people.has(21), false)
})

test('people: most credited first, ties by id', () => {
  const people = [...buildPeople([{ id: 1 }, { id: 2 }], credits, staff).values()].sort(byProminence)
  assert.equal(people[0].id, 20)
})

test('studios: the animation studio only, never the producer', () => {
  const studios = buildStudios([{ id: 1 }, { id: 2 }], credits)
  assert.deepEqual([...studios.keys()], [50])
  assert.deepEqual(studios.get(50).titleIds, [1, 2])
  assert.deepEqual(studiosOfTitle(credits, 1), [{ id: 50, name: 'Bones' }])
})

test('artists: filed by the slug of the name, OP and ED only', () => {
  const themes = {
    1: [
      { type: 'OP', seq: 1, title: 'Song A', artists: ['LiSA'] },
      { type: 'ED', seq: 1, title: 'Song B', artists: ['Lisa', 'Other'] },
      { type: 'IN', seq: 1, title: 'Insert', artists: ['LiSA'] },
      { type: 'OP', seq: 2, title: '', artists: ['LiSA'] },
    ],
  }
  const artists = buildArtists([{ id: 1 }], themes)
  assert.equal(artistKey('LiSA'), 'lisa')
  assert.equal(artists.get('lisa').songs.length, 2)
  assert.equal(artists.get('other').songs.length, 1)
})

test('franchises: related titles grouped, anchored on the first release', () => {
  const titles = [
    { id: 3, title: 'Show Season 2', startDate: [2015, 4, 1], relations: [{ id: 1, relation: 'PREQUEL' }] },
    { id: 1, title: 'Show', startDate: [2013, 4, 1], relations: [{ id: 3, relation: 'SEQUEL' }, { id: 4, relation: 'SIDE_STORY' }] },
    { id: 4, title: 'Show OVA', startDate: [2014, 1, 1], relations: [] },
    { id: 9, title: 'Alone', startDate: [2013, 1, 1], relations: [{ id: 1, relation: 'CHARACTER' }] },
  ]
  const franchises = buildFranchises(titles)
  assert.equal(franchises.size, 1)
  const show = franchises.get(1)
  assert.deepEqual(show.ids, [1, 4, 3])
  // The main story follows SEQUEL only; the OVA stays out of it.
  const byId = new Map(titles.map((t) => [t.id, t]))
  assert.deepEqual(mainChain(show, byId), [1, 3])
  // An unknown date sorts last.
  assert.ok(releaseOrder({ id: 1, startDate: [] }, { id: 2, startDate: [2000] }) > 0)
})

test('franchises: a crossover never welds two franchises together', () => {
  const titles = [
    { id: 1, title: 'Thief', startDate: [1971], relations: [{ id: 2, relation: 'SEQUEL' }] },
    { id: 2, title: 'Thief Part 2', startDate: [1977], relations: [{ id: 1, relation: 'PREQUEL' }] },
    { id: 3, title: 'Detective', startDate: [1996], relations: [{ id: 4, relation: 'SEQUEL' }] },
    { id: 4, title: 'Detective Season 2', startDate: [1998], relations: [{ id: 3, relation: 'PREQUEL' }, { id: 5, relation: 'SEQUEL' }] },
    { id: 5, title: 'Detective Season 3', startDate: [1999], relations: [{ id: 4, relation: 'PREQUEL' }] },
    // The crossover: a side story of both. It joins one franchise, never both.
    { id: 9, title: 'Thief vs Detective', startDate: [2009], relations: [{ id: 1, relation: 'SIDE_STORY' }, { id: 3, relation: 'SIDE_STORY' }] },
    // Two specials tied only to each other are a group of their own.
    { id: 20, title: 'Special', startDate: [2001], relations: [{ id: 21, relation: 'SUMMARY' }] },
    { id: 21, title: 'Special Recap', startDate: [2002], relations: [] },
  ]
  const franchises = buildFranchises(titles)
  assert.deepEqual([...franchises.keys()].sort((a, b) => a - b), [1, 3, 20])
  assert.deepEqual(franchises.get(1).ids, [1, 2])
  // The longer story wins the crossover.
  assert.deepEqual(franchises.get(3).ids, [3, 4, 5, 9])
  assert.deepEqual(franchises.get(20).ids, [20, 21])
  // The main story reads a link filed on one side only (4 names 5 as its
  // sequel, 5 names 4 as its prequel; 3 names 4 but 4 does not name 3 back).
  const byId = new Map(titles.map((t) => [t.id, t]))
  assert.deepEqual(mainChain(franchises.get(3), byId), [3, 4, 5])
  const oneSided = [
    { id: 1, title: 'A', startDate: [2000], relations: [] },
    { id: 2, title: 'B', startDate: [2001], relations: [{ id: 1, relation: 'PREQUEL' }] },
  ]
  const [only] = buildFranchises(oneSided).values()
  assert.deepEqual(mainChain(only, new Map(oneSided.map((t) => [t.id, t]))), [1, 2])
})

test('episodes: the first date wins, a finished show stops at its count', () => {
  assert.deepEqual(parseStreamingTitle('Episode 12 - The Promise'), { number: 12, title: 'The Promise' })
  assert.equal(parseStreamingTitle('Special'), null)
  const item = {
    status: 'FINISHED',
    episodes: 2,
    streamingEpisodes: [{ title: 'Episode 1 - Start' }, { title: 'Episode 3 - Rerun' }],
  }
  const rows = buildEpisodes(item, [{ episode: 1, at: 200 }, { episode: 1, at: 100 }, { episode: 2, at: 300 }], [])
  assert.deepEqual(rows, [
    [1, 'Start', 100],
    [2, '', 300],
  ])
  assert.equal(datedCount(rows), 2)
})

test('roles: per-episode credits are never key credits', () => {
  assert.equal(baseRole('Key Animation (ep 3)'), 'Key Animation')
  assert.equal(roleDetail('Key Animation (ep 3)'), 'ep 3')
  assert.ok(keyCreditOf('Director'))
  assert.equal(keyCreditOf('Director (ep 5)'), null)
  assert.equal(categoryOf('Made-up Role').key, 'other')
})
