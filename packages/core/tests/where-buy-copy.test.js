import { test } from 'node:test'
import assert from 'node:assert/strict'
import { animeBuyCopy, supportLine } from '../src/where/buy-copy.mjs'

const manga = { kind: 'books', label: 'The manga it came from' }
const figures = { kind: 'merch', label: 'Figures and plushies' }

test('the support line names the site and is not the Associates sentence', () => {
  const line = supportLine('Some Site')
  assert.equal(line, 'Buying through these links helps keep Some Site free, at no extra cost to you.')
  assert.doesNotMatch(line, /Associate|qualifying purchases/)
})

test('a finished anime is about discs with no subscription, and names its source row', () => {
  const copy = animeBuyCopy({ title: 'Show', status: 'FINISHED' }, [manga, figures])
  assert.equal(copy.heading, 'Keep Show on your shelf')
  assert.match(copy.sub, /no subscription/)
  assert.match(copy.sub, /Figures, posters and the manga it came from/)
})

test('an airing anime says discs may lag behind', () => {
  const copy = animeBuyCopy({ title: 'Show', status: 'RELEASING' }, [manga])
  assert.match(copy.sub, /still airing/)
})

test('an anime not out yet points at merch, not discs', () => {
  const copy = animeBuyCopy({ title: 'Show', status: 'NOT_YET_RELEASED' }, [figures])
  assert.match(copy.sub, /Discs come after the broadcast/)
  assert.match(copy.sub, /figures and posters are the way/)
})

test('no book row means the words never promise a book', () => {
  const copy = animeBuyCopy({ title: 'Show', status: 'FINISHED' }, [figures])
  assert.doesNotMatch(copy.sub, /manga|novel/)
})

test('no copy carries an em dash', () => {
  const emDash = String.fromCharCode(0x2014)
  for (const status of ['FINISHED', 'RELEASING', 'NOT_YET_RELEASED', 'HIATUS']) {
    const copy = animeBuyCopy({ title: 'Show', status }, [manga])
    assert.ok(!copy.heading.includes(emDash) && !copy.sub.includes(emDash))
  }
})
