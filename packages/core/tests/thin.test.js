import { test } from 'node:test'
import assert from 'node:assert/strict'
import { bioWords, thinVoice, thinStaff, thinArtist, noindexSets } from '../src/where/thin.mjs'
import { makeLinker } from '../src/where/linker.mjs'
import { pathOf, pathsOf } from '../../../scripts/build-index-keep.mjs'

const voices = (n, language = 'Japanese') => Array.from({ length: n }, (_, i) => ({ titleId: i + 1, characterId: i + 1, language }))
const crew = (n) => Array.from({ length: n }, (_, i) => ({ titleId: i + 1, role: 'Director' }))
const bio = 'word '.repeat(40)

test('bio words leave out markup and links', () => {
  assert.equal(bioWords('__Height:__ 174 cm [site](https://example.com/a-b-c) https://x.example/y'), 4)
  assert.equal(bioWords(null), 0)
})

test('a voice actor is thin without a bio, few cast-language shows and few shows at all', () => {
  assert.equal(thinVoice({ voice: voices(4) }), true)
  assert.equal(thinVoice({ voice: voices(5) }), false)
  assert.equal(thinVoice({ voice: voices(14, 'German') }), true)
  assert.equal(thinVoice({ voice: voices(15, 'German') }), false)
  assert.equal(thinVoice({ voice: voices(3), info: { description: bio } }), false)
  // Three characters in one show is one show.
  assert.equal(thinVoice({ voice: [1, 2, 3, 4, 5, 6].map((c) => ({ titleId: 1, characterId: c, language: 'Japanese' })) }), true)
})

test('staff and artists', () => {
  assert.equal(thinStaff({ crew: crew(5) }), true)
  assert.equal(thinStaff({ crew: crew(6) }), false)
  assert.equal(thinStaff({ crew: crew(2), info: { description: bio } }), false)
  const songs = (n, shows) => Array.from({ length: n }, (_, i) => ({ titleId: (i % shows) + 1 }))
  assert.equal(thinArtist({ songs: songs(2, 2) }), true)
  assert.equal(thinArtist({ songs: songs(4, 2) }), true)
  assert.equal(thinArtist({ songs: songs(4, 3) }), false)
})

const world = () => ({
  people: [
    { id: 1, voice: voices(3), crew: [] },
    { id: 2, voice: voices(3), crew: [] },
    { id: 3, voice: voices(9), crew: crew(2) },
  ],
  artists: [{ key: 'one', songs: [{ titleId: 1 }, { titleId: 1 }] }],
  pages: { voice: new Set([1, 2, 3]), staff: new Set([3]), artist: new Set(['one']) },
  pathOf: { voice: (id) => `/voice-actor/v${id}`, staff: (id) => `/staff/v${id}`, artist: (key) => `/artist/${key}` },
})

test('with no keep list nothing is noindexed, and the build still counts', () => {
  const out = noindexSets(world())
  assert.equal(out.on, false)
  assert.equal(out.voice.size + out.staff.size + out.artist.size, 0)
  assert.deepEqual(out.counts.voice, { pages: 3, thin: 2, kept: 0, noindex: 0 })
  assert.deepEqual(out.counts.artist, { pages: 1, thin: 1, kept: 0, noindex: 0 })
})

test('with a keep list a thin page is noindexed unless Google shows it', () => {
  const out = noindexSets({ ...world(), keep: new Set(['/voice-actor/v2', '/anime/x']) })
  assert.equal(out.on, true)
  assert.deepEqual([...out.voice], [1])
  assert.deepEqual([...out.staff], [3])
  assert.deepEqual([...out.artist], ['one'])
  assert.deepEqual(out.counts.voice, { pages: 3, thin: 2, kept: 1, noindex: 1 })
})

test('no page links to a noindexed page, which still knows its own address', () => {
  const slugs = { title: new Map(), person: new Map([[1, 'a'], [3, 'c']]), studio: new Map(), artist: new Map([['one', 'one']]), watch: new Map() }
  const pages = { voice: new Set([1, 3]), staff: new Set([3]), studio: new Set(), artist: new Set(['one']), watch: new Set() }
  const link = makeLinker(slugs, pages, { voice: new Set([1]), staff: new Set([3]), artist: new Set(['one']) })
  assert.equal(link.voice(1), null)
  assert.equal(link.own.voice(1), '/voice-actor/a')
  assert.equal(link.crew(3), '/voice-actor/c')
  assert.equal(link.artist('one'), null)
  assert.equal(link.own.artist('one'), '/artist/one')
  assert.equal(makeLinker(slugs, pages).voice(1), '/voice-actor/a')
})

test('the keep list script reads Search Console exports', () => {
  assert.equal(pathOf('https://whereanime.com/anime/x/?a=1'), '/anime/x')
  assert.equal(pathOf('/'), '/')
  assert.equal(pathOf('not a url'), '')
  assert.deepEqual(pathsOf('Top pages,Clicks,Impressions\nhttps://whereanime.com/staff/b,0,3\nhttps://whereanime.com/staff/a,0,0\n', false), ['/staff/b'])
  assert.deepEqual(pathsOf(JSON.stringify([{ keys: ['https://whereanime.com/artist/z'], impressions: 2 }, '/anime/y']), true), ['/anime/y', '/artist/z'])
})
