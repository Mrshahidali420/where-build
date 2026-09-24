// Query building, shaping and selection for scripts/ingest-staff.mjs.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { STAFF_QUERY, shapeStaff, referencedStaffIds, selectNew, mergeStaff } from '../scripts/sister-staff.mjs'

test('STAFF_QUERY batches staff(id_in) under a Page', () => {
  assert.match(STAFF_QUERY, /Page\(page: 1, perPage: 50\)/)
  assert.match(STAFF_QUERY, /staff\(id_in: \$ids\)/)
  assert.match(STAFF_QUERY, /staffMedia/)
})

test('shapeStaff carries the fields staff.json needs, bio cut like everywhere else', () => {
  const node = {
    id: 1,
    name: { full: 'Tomokazu Seki', native: '関智一', alternative: ['Seki Mondoya'] },
    image: { large: 'https://x/1.png' },
    description: '<p>Height: 174cm</p>',
    languageV2: 'Japanese',
    primaryOccupations: ['Voice Actor'],
    dateOfBirth: { year: 1971, month: 7, day: 2 },
    homeTown: 'Tokyo',
    yearsActive: [1994],
    gender: 'Male',
    favourites: 5000,
    siteUrl: 'https://anilist.co/staff/1',
    staffMedia: { edges: [{ staffRole: 'Main', node: { id: 10, type: 'ANIME' } }] },
    characters: { nodes: [{ id: 100 }] },
  }
  const shaped = shapeStaff(node)
  assert.equal(shaped.name, 'Tomokazu Seki')
  assert.equal(shaped.native, '関智一')
  assert.deepEqual(shaped.aliases, ['Seki Mondoya'])
  assert.equal(shaped.description, 'Height: 174cm')
  assert.deepEqual(shaped.birthDate, { year: 1971, month: 7, day: 2 })
  assert.deepEqual(shaped.media, [{ id: 10, type: 'ANIME', role: 'Main' }])
  assert.deepEqual(shaped.characterIds, [100])
})

test('shapeStaff leaves birthDate null when AniList has nothing', () => {
  const node = { id: 1, name: { full: 'X' }, dateOfBirth: { year: null, month: null, day: null } }
  assert.equal(shapeStaff(node).birthDate, null)
})

test('referencedStaffIds finds crew ids and voice-actor ids, from every credits record', () => {
  const creditsById = {
    1: { staff: [{ id: 10 }], characters: [{ voiceActors: [{ id: 20 }, { id: 21 }] }] },
    2: { staff: [{ id: 10 }, { id: 30 }], characters: [] },
  }
  assert.deepEqual([...referencedStaffIds(creditsById)].sort((a, b) => a - b), [10, 20, 21, 30])
})

test('selectNew keeps only ids staff.json does not already hold', () => {
  const referenced = new Set([1, 2, 3])
  assert.deepEqual(selectNew(referenced, { 2: {} }).sort(), [1, 3])
})

test('mergeStaff overwrites only the fetched ids', () => {
  const existing = { 1: { name: 'A' } }
  const fetched = new Map([[2, { name: 'B' }]])
  assert.deepEqual(mergeStaff(existing, fetched), { 1: { name: 'A' }, 2: { name: 'B' } })
})
