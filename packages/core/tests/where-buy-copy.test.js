import { test } from 'node:test'
import assert from 'node:assert/strict'
import { animeBuyCopy, supportLine } from '../src/where/buy-copy.mjs'

const discs = { kind: 'discs', label: 'Blu-ray and DVD' }
const manga = { kind: 'books', label: 'The manga it came from' }
const figures = { kind: 'merch', label: 'Figures and plushies' }
const posters = { kind: 'prints', label: 'Posters and apparel' }
const music = { kind: 'music', label: 'Soundtrack and theme songs' }

test('the support line names the site and is not the Associates sentence', () => {
  const line = supportLine('Some Site')
  assert.equal(line, 'Buying through these links helps keep Some Site free, at no extra cost to you.')
  assert.doesNotMatch(line, /Associate|qualifying purchases/)
})

test('a finished series says its own episode count and names the rows beside the discs', () => {
  const copy = animeBuyCopy({ title: 'Show', format: 'TV', status: 'FINISHED', episodes: 25, endYear: 2013 }, [discs, manga, music, figures, posters])
  assert.equal(copy.heading, 'Keep Show on your shelf')
  assert.equal(copy.sub, '25 episodes finished in 2013, so a Blu-ray or DVD set can hold the whole run, where one was made. This box also holds the manga it came from, the soundtrack, figures and posters.')
})

test('a film, an airing show and a one-off each get the disc line that fits', () => {
  assert.match(animeBuyCopy({ title: 'Show', format: 'MOVIE', status: 'FINISHED', startYear: 2016 }, [discs]).sub, /^A film from 2016 fits on one disc/)
  assert.match(animeBuyCopy({ title: 'Show', format: 'MOVIE', status: 'FINISHED' }, [discs]).sub, /^A film fits on one disc/)
  assert.match(animeBuyCopy({ title: 'Show', format: 'TV', status: 'RELEASING', episodes: 12 }, [discs, manga]).sub, /still airing/)
  assert.equal(animeBuyCopy({ title: 'Show', format: 'OVA', status: 'FINISHED', episodes: 1 }, [discs]).sub, 'A Blu-ray or DVD lets you rewatch it with no subscription, where a disc release was made.')
})

test('with no disc row the box never talks about discs on a shelf', () => {
  const unaired = animeBuyCopy({ title: 'Show', status: 'NOT_YET_RELEASED' }, [manga, figures])
  assert.equal(unaired.heading, 'Own a piece of Show')
  assert.equal(unaired.sub, 'Discs come after the broadcast. Until then, this box points at the manga it came from and figures.')
  const web = animeBuyCopy({ title: 'Show', format: 'ONA', status: 'FINISHED' }, [figures])
  assert.equal(web.sub, 'This box points at figures.')
  assert.doesNotMatch(web.heading + web.sub, /shelf|Blu-ray|DVD/)
})

test('the words never promise a row the box does not hold', () => {
  const copy = animeBuyCopy({ title: 'Show', format: 'TV', status: 'FINISHED', episodes: 12 }, [discs, figures])
  assert.doesNotMatch(copy.sub, /manga|novel|soundtrack|posters/)
  assert.doesNotMatch(animeBuyCopy({ title: 'Show', format: 'TV', status: 'FINISHED' }, [discs]).sub, /also holds/)
})

test('no copy carries an em dash', () => {
  const emDash = String.fromCharCode(0x2014)
  for (const status of ['FINISHED', 'RELEASING', 'NOT_YET_RELEASED', 'HIATUS']) {
    for (const rows of [[discs, manga], [manga], []]) {
      const copy = animeBuyCopy({ title: 'Show', status }, rows)
      assert.ok(!copy.heading.includes(emDash) && !copy.sub.includes(emDash))
    }
  }
})
