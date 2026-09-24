// Query building, shaping and selection for scripts/ingest-credits.mjs.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { CREDITS_QUERY, shapeCredits, selectDelta, mergeSeen, mergeCredits } from '../scripts/sister-credits.mjs'

test('CREDITS_QUERY batches by id_in under a Page, not Media(id_in)', () => {
  assert.match(CREDITS_QUERY, /Page\(page: 1, perPage: 50\)/)
  assert.match(CREDITS_QUERY, /media\(id_in: \$ids\)/)
  assert.match(CREDITS_QUERY, /voiceActorRoles/)
})

test('shapeCredits keeps only ids, roles and languages', () => {
  const media = {
    id: 1,
    staff: { edges: [{ role: 'Director', node: { id: 10 } }, { role: null, node: { id: null } }] },
    studios: { edges: [{ isMain: true, node: { id: 5, name: 'Sunrise' } }] },
    characters: {
      edges: [
        {
          role: 'MAIN',
          node: { id: 100 },
          voiceActorRoles: [{ voiceActor: { id: 200, languageV2: 'Japanese' } }, { voiceActor: { id: null } }],
        },
      ],
    },
  }
  assert.deepEqual(shapeCredits(media), {
    staff: [{ id: 10, role: 'Director' }],
    studios: [{ id: 5, name: 'Sunrise', isMain: true }],
    characters: [{ id: 100, role: 'MAIN', voiceActors: [{ id: 200, language: 'Japanese' }] }],
  })
})

test('shapeCredits copes with a title with no staff, studios or characters at all', () => {
  assert.deepEqual(shapeCredits({ id: 1 }), { staff: [], studios: [], characters: [] })
})

test('selectDelta wants new ids and ids whose updatedAt moved, nothing else', () => {
  const catalog = [
    { id: 1, updatedAt: 100 }, // unchanged
    { id: 2, updatedAt: 200 }, // changed
    { id: 3, updatedAt: 300 }, // new to seen
  ]
  const seen = new Map([[1, 100], [2, 150]])
  assert.deepEqual(selectDelta(catalog, seen), [2, 3])
})

test('mergeSeen records the current catalog updatedAt for every fetched id', () => {
  const seen = new Map([[1, 100]])
  const catalogById = new Map([[1, { updatedAt: 999 }], [2, { updatedAt: 500 }]])
  const next = mergeSeen(seen, catalogById, [1, 2])
  assert.deepEqual([...next], [[1, 999], [2, 500]])
})

test('mergeCredits overwrites only the fetched ids and keeps everything else', () => {
  const existing = { 1: { staff: [] }, 2: { staff: [{ id: 9 }] } }
  const fetched = new Map([[2, { staff: [{ id: 99 }] }], [3, { staff: [] }]])
  assert.deepEqual(mergeCredits(existing, fetched), {
    1: { staff: [] },
    2: { staff: [{ id: 99 }] },
    3: { staff: [] },
  })
})
