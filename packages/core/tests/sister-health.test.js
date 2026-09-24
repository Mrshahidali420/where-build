// The coverage floors scripts/ingest-credits.mjs, ingest-staff.mjs and
// ingest-airing.mjs push against (docs/PLAN.md section 8, Phase 1).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  creditsHealth, staffHealth, airingHealth, checkCoverage, checkIncomplete,
  COVERAGE_FLOOR, MAX_INCOMPLETE_SHARE,
} from '../scripts/sister-health.mjs'

test('creditsHealth counts coverage of the full catalog id list', () => {
  const byId = { 1: {}, 2: {}, 3: {} }
  assert.deepEqual(creditsHealth(byId, [1, 2, 3, 4]), { count: 3, coverage: 0.75 })
  assert.deepEqual(creditsHealth({}, [1, 2]), { count: 0, coverage: 0 })
  assert.deepEqual(creditsHealth(byId, []), { count: 3, coverage: 0 })
})

test('staffHealth counts coverage of the ids credits.json points at', () => {
  const byId = { 10: {}, 20: {} }
  assert.deepEqual(staffHealth(byId, [10, 20, 30]), { count: 2, coverage: 0.6667 })
})

test('airingHealth counts RELEASING anime that have at least one history row', () => {
  const history = { 1: [{ at: 1 }], 2: [], 3: [{ at: 2 }] }
  assert.deepEqual(airingHealth(history, [1, 2, 3, 4]), {
    count: 3, releasingCoverage: 0.5, incompleteCount: 0, incompleteShare: 0,
  })
})

test('airingHealth also reports the share of titles with history left incomplete', () => {
  const history = { 1: [{ at: 1 }], 2: [{ at: 2 }], 3: [{ at: 3 }] }
  const incomplete = { 1: true, 9: false } // 9 is not even in history; only counted ids matter
  assert.deepEqual(airingHealth(history, [1, 2, 3], incomplete), {
    count: 3, releasingCoverage: 1, incompleteCount: 1, incompleteShare: 0.3333,
  })
})

test('checkCoverage lets a bootstrap push through as long as it has any records', () => {
  assert.deepEqual(checkCoverage('credits.json', 'coverage', { count: 5, coverage: 0.1 }, null), [])
  assert.deepEqual(checkCoverage('credits.json', 'coverage', { count: 0, coverage: 0 }, null), ['credits.json has no records'])
})

test('checkCoverage does not defend a floor that was never reached', () => {
  const prev = { coverage: 0.4 }
  assert.deepEqual(checkCoverage('credits.json', 'coverage', { count: 1, coverage: 0.2 }, prev), [])
})

test('checkCoverage refuses a push that drops a mature file below its floor', () => {
  const prev = { coverage: 0.995 }
  const problems = checkCoverage('credits.json', 'coverage', { count: 1, coverage: 0.5 }, prev)
  assert.equal(problems.length, 1)
  assert.match(problems[0], /fell from 99\.5% to 50\.0%/)
})

test('checkCoverage allows a small, normal amount of drift', () => {
  const prev = { coverage: 0.995 }
  assert.deepEqual(checkCoverage('credits.json', 'coverage', { count: 1, coverage: 0.99 }, prev), [])
})

test('checkCoverage respects allowDrop and a custom floor', () => {
  const prev = { coverage: 0.995 }
  assert.deepEqual(checkCoverage('credits.json', 'coverage', { count: 1, coverage: 0.1 }, prev, { allowDrop: true }), [])
  assert.equal(COVERAGE_FLOOR, 0.99)
})

test('checkIncomplete refuses a push when too large a share of history is incomplete', () => {
  const problems = checkIncomplete('airing.json', { incompleteShare: 0.1 })
  assert.equal(problems.length, 1)
  assert.match(problems[0], /10\.0% of titles with history are incomplete \(limit 5\.0%\)/)
})

test('checkIncomplete allows a push at or under the floor, even on a brand new file', () => {
  assert.deepEqual(checkIncomplete('airing.json', { incompleteShare: MAX_INCOMPLETE_SHARE }), [])
  assert.deepEqual(checkIncomplete('airing.json', { incompleteShare: 0 }), [])
  assert.deepEqual(checkIncomplete('airing.json', {}), [])
})

test('checkIncomplete respects a custom maxShare', () => {
  const problems = checkIncomplete('airing.json', { incompleteShare: 0.02 }, { maxShare: 0.01 })
  assert.equal(problems.length, 1)
})
