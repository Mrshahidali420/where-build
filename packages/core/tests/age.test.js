import { test } from 'node:test'
import assert from 'node:assert/strict'
import { ageOf } from '../src/lib/age.mjs'

const text = (raw) => ageOf(raw)?.text ?? null

test('a plain number stays a number', () => {
  assert.equal(text('17'), '17')
  assert.equal(text(17), '17')
  assert.equal(text('17\r'), '17')
  assert.equal(text(' 17\t'), '17')
})

test('a trailing dash means this age at the start, older later', () => {
  assert.equal(text('17-'), '17 or older')
  assert.equal(text('15 -'), '15 or older')
})

test('a range reads as "to"', () => {
  assert.equal(text('16-17'), '16 to 17')
  assert.equal(text('16 - 18'), '16 to 18')
  assert.equal(text('16~17'), '16 to 17')
})

test('big and rough ages', () => {
  assert.equal(text('1000+'), 'over 1,000')
  assert.equal(text('Over 500'), 'over 500')
  assert.equal(text('~20'), 'about 20')
  assert.equal(text('Around 30'), 'about 30')
  assert.equal(text('20s'), 'in their 20s')
  assert.equal(text("Early 20's"), 'in their early 20s')
  assert.equal(text('Late 30s'), 'in their late 30s')
})

test('no age means nothing is printed', () => {
  assert.equal(ageOf(''), null)
  assert.equal(ageOf(null), null)
  assert.equal(ageOf('Unknown'), null)
  assert.equal(ageOf('Confidential'), null)
  assert.equal(ageOf('?'), null)
  assert.equal(ageOf('████'), null)
})

test('free text is kept, cleaned, and marked as not plain', () => {
  assert.deepEqual(ageOf('Same as  Mia\r'), { text: 'Same as Mia', plain: false })
  assert.deepEqual(ageOf('16 (Season 1), 18 (Season 2)'), { text: '16 (Season 1), 18 (Season 2)', plain: false })
  assert.equal(ageOf('17').plain, true)
})

test('a backwards range is not turned into nonsense', () => {
  assert.deepEqual(ageOf('18-16'), { text: '18-16', plain: false })
})
