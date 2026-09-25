// where-links.json (src/where/where-links.mjs): the live addresses the home
// site links to, never a registry address whose page is gone, and never a
// voice actor name two live people share.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { whereLinksOf, WHERE_LINKS_VERSION } from '../src/where/where-links.mjs'

const registry = {
  entries: {
    't:1': { ns: 'anime', slug: 'cowboy-bebop' },
    't:2': { ns: 'anime', slug: 'gone-show' },
    'p:10': { ns: 'person', slug: 'kana-hanazawa' },
    'p:11': { ns: 'person', slug: 'staff-only' },
    'p:12': { ns: 'person', slug: 'yuki-sato' },
    'p:13': { ns: 'person', slug: 'yuki-sato-2' },
    'p:14': { ns: 'person', slug: 'monica-rial' },
    's:5': { ns: 'studio', slug: 'bones' },
  },
}
const pageUrls = {
  groups: [
    { name: 'anime', urls: [{ path: '/anime/cowboy-bebop' }] },
    { name: 'voice-actors', urls: ['kana-hanazawa', 'yuki-sato', 'yuki-sato-2', 'monica-rial'].map((slug) => ({ path: `/voice-actor/${slug}` })) },
    { name: 'staff', urls: [{ path: '/staff/staff-only' }] },
  ],
}
const staff = {
  10: { name: 'Kana Hanazawa' },
  11: { name: 'Staff Only' },
  12: { name: 'Yuki Sato' },
  13: { name: 'Yuki Sato' },
  14: { name: 'Monica Rial' },
}

test('where-links: only live pages, and a shared voice actor name is dropped', () => {
  const links = whereLinksOf({ registry, pageUrls, staff, builtAt: 123 })
  assert.equal(links.v, WHERE_LINKS_VERSION)
  assert.equal(links.builtAt, 123)
  assert.deepEqual(links.anime, { 1: 'cowboy-bebop' }, 'a registry address with no live page is left out')
  assert.deepEqual(links.voiceActors, { 'Kana Hanazawa': 'kana-hanazawa', 'Monica Rial': 'monica-rial' })
})

test('where-links: nothing live, nothing listed', () => {
  const links = whereLinksOf({ registry, pageUrls: { groups: [] }, staff, builtAt: 0 })
  assert.deepEqual(links.anime, {})
  assert.deepEqual(links.voiceActors, {})
})
