// The options every sister ingest script reads the same way.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseFlags, readOptions } from '../scripts/sister-cli.mjs'

test('parseFlags reads --key=value and bare --key', () => {
  assert.deepEqual(parseFlags(['--limit=100', '--push', 'ignored']), { limit: '100', push: '1' })
})

test('readOptions defaults to delta mode, local only, no cap', () => {
  assert.deepEqual(readOptions([], {}), { mode: 'delta', push: false, limit: null, ids: null })
})

test('readOptions takes MODE and PUSH from the environment', () => {
  assert.deepEqual(readOptions([], { MODE: 'full-refresh', PUSH: '1' }), {
    mode: 'full-refresh',
    push: true,
    limit: null,
    ids: null,
  })
})

test('a --flag wins over the matching env var', () => {
  const opts = readOptions(['--mode=full-refresh', '--limit=10'], { MODE: 'delta', LIMIT: '999' })
  assert.equal(opts.mode, 'full-refresh')
  assert.equal(opts.limit, 10)
})

test('--ids parses a comma list of integers and drops anything that is not one', () => {
  const opts = readOptions(['--ids=1, 2,x,3'], {})
  assert.deepEqual(opts.ids, [1, 2, 3])
})

test('an empty --ids or IDS leaves ids null, so selection is not bypassed', () => {
  assert.equal(readOptions([], { IDS: '' }).ids, null)
})
