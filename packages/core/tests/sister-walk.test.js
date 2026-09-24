// The full-refresh slice cursor shared by ingest-credits.mjs, ingest-staff.mjs
// and ingest-airing.mjs's full-refresh mode.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { nextSlice, loadWalkState, advanceWalkState } from '../scripts/sister-walk.mjs'

test('nextSlice takes a run of ids starting at the cursor', () => {
  const ids = [1, 5, 9, 20, 21, 22]
  const slice = nextSlice(ids, 9, 3)
  assert.deepEqual(slice, { ids: [9, 20, 21], next: 22, wrapped: false })
})

test('nextSlice resumes at the first id >= cursor, even when that exact id is gone', () => {
  const ids = [1, 5, 20, 21]
  const slice = nextSlice(ids, 9, 2)
  assert.deepEqual(slice.ids, [20, 21])
})

test('nextSlice wraps to the start once the slice runs past the end', () => {
  const ids = [1, 2, 3, 4, 5]
  const slice = nextSlice(ids, 4, 3)
  assert.deepEqual(slice.ids, [4, 5, 1])
  assert.equal(slice.next, 2)
  assert.equal(slice.wrapped, true)
})

test('nextSlice wraps to the very start when the cursor is past every id', () => {
  const ids = [1, 2, 3]
  const slice = nextSlice(ids, 999, 2)
  assert.deepEqual(slice.ids, [1, 2])
  assert.equal(slice.wrapped, true)
})

test('nextSlice on an empty list asks for nothing and does not move the cursor', () => {
  assert.deepEqual(nextSlice([], 5, 10), { ids: [], next: 5, wrapped: false })
})

test('loadWalkState starts fresh on a missing or corrupt file', () => {
  assert.deepEqual(loadWalkState(null), { next: 0, cycles: 0 })
  assert.deepEqual(loadWalkState({ next: 'nope' }), { next: 0, cycles: 0 })
  assert.deepEqual(loadWalkState({ next: 42, cycles: 3 }), { next: 42, cycles: 3 })
})

test('advanceWalkState bumps cycles only when the slice wrapped', () => {
  const state = { next: 4, cycles: 1 }
  assert.deepEqual(advanceWalkState(state, { next: 8, wrapped: false }), { next: 8, cycles: 1 })
  assert.deepEqual(advanceWalkState(state, { next: 2, wrapped: true }), { next: 2, cycles: 2 })
})
