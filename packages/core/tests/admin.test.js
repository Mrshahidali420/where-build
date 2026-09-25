// The plain-English helpers in src/lib/admin.js: reading a search query back
// out of an outbound link's own address, and picking a click-feed filter
// chip from the URL. Both are pure — no database, no Astro.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { CLICK_FILTERS, clickFilterOf, searchTarget } from '../src/lib/admin.js'

test('searchTarget reads a Google search straight off the link', () => {
  const out = searchTarget('https://www.google.com/search?q=The%20Berserker%20NPC')
  assert.deepEqual(out, { service: 'Google', query: 'The Berserker NPC' })
  // The bare domain works the same as the www one.
  assert.equal(searchTarget('https://google.com/search?q=hi').service, 'Google')
})

test('searchTarget reads a YouTube or Spotify song search', () => {
  assert.deepEqual(
    searchTarget('https://www.youtube.com/results?search_query=Solo%20Leveling%20OP1'),
    { service: 'YouTube', query: 'Solo Leveling OP1' }
  )
  assert.deepEqual(
    searchTarget('https://open.spotify.com/search/Ali%20(ru)'),
    { service: 'Spotify', query: 'Ali (ru)' }
  )
})

test('searchTarget gives back nothing for an ordinary link, or Amazon', () => {
  assert.equal(searchTarget('https://www.crunchyroll.com/series/solo-leveling'), null)
  assert.equal(searchTarget('https://www.amazon.com/s?k=solo+leveling&tag=x'), null)
  assert.equal(searchTarget('https://www.google.com/maps?q=tokyo'), null, 'a Google page that is not /search')
  assert.equal(searchTarget(''), null)
  assert.equal(searchTarget('not a url'), null)
})

test('clickFilterOf reads the chip from ?clicks=, and falls back to All', () => {
  assert.equal(clickFilterOf(new URL('https://x/my-admin?clicks=buy')).key, 'buy')
  assert.equal(clickFilterOf(new URL('https://x/my-admin?clicks=watch')).label, 'Watch')
  assert.equal(clickFilterOf(new URL('https://x/my-admin')).key, '')
  assert.equal(clickFilterOf(new URL('https://x/my-admin?clicks=nonsense')).key, '', 'an unknown kind is not a filter')
})

test('CLICK_FILTERS names exactly the kinds the kind column ever holds, plus All', () => {
  assert.deepEqual(CLICK_FILTERS.map((f) => f.key), ['', 'buy', 'read', 'watch', 'other'])
})
