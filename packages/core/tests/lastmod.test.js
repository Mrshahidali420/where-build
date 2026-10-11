import { test } from 'node:test'
import assert from 'node:assert/strict'
import { stampText, nextLastmod, lastmodOf } from '../src/where/lastmod.mjs'
import { urlsetXml, lastmodTag, newestLastmod, today } from '../src/lib/sitemap-xml.js'
import { hubPaths, azPath, directory, PER_AZ_PAGE } from '../src/where/hubs.mjs'
import { pageUrlsOf } from '../src/where/outputs.mjs'

test('a stamp ignores the numbers that move every night', () => {
  const a = stampText({ title: 'T', episodes: 12, popularity: 10, similar: [1], score: 80 })
  assert.equal(a, stampText({ title: 'T', episodes: 12, popularity: 999, similar: [2], score: 81 }))
  assert.notEqual(a, stampText({ title: 'T', episodes: 13, popularity: 10 }))
})

test('lastmod: unknown on first sight, kept while unchanged, today when it moves, dropped when gone', () => {
  const first = nextLastmod({}, [['/a', 'x1'], ['/b', 'y1']], '2026-10-11')
  assert.deepEqual(first, { '/a': ['x1', ''], '/b': ['y1', ''] })
  const second = nextLastmod(first, [['/a', 'x2'], ['/b', 'y1'], ['/c', 'z1']], '2026-10-12')
  assert.deepEqual(second, { '/a': ['x2', '2026-10-12'], '/b': ['y1', ''], '/c': ['z1', ''] })
  const third = nextLastmod(second, [['/a', 'x2']], '2026-10-13')
  assert.deepEqual(third, { '/a': ['x2', '2026-10-12'] })
  assert.equal(lastmodOf(third, '/a'), '2026-10-12')
  assert.equal(lastmodOf(third, '/b'), '')
})

test('the sitemap prints a real date, nothing when unknown, and the build day only for untracked sources', () => {
  const day = today()
  assert.equal(lastmodTag({ lastmod: '2026-10-01' }, day), '<lastmod>2026-10-01</lastmod>')
  assert.equal(lastmodTag({ lastmod: null }, day), '')
  assert.equal(lastmodTag({}, day), `<lastmod>${day}</lastmod>`)
  const xml = urlsetXml([{ loc: 'https://x.example/a', priority: '0.5', lastmod: '2026-10-01' }, { loc: 'https://x.example/b', priority: '0.5', lastmod: null }])
  assert.equal((xml.match(/<lastmod>/g) || []).length, 1)
  assert.equal(newestLastmod([{ lastmod: '2026-10-01' }, { lastmod: null }, { lastmod: '2026-10-03' }]), '2026-10-03')
  assert.equal(newestLastmod([{ lastmod: null }]), '')
  assert.equal(newestLastmod([{}]), undefined)
})

test('page urls carry a known date and leave out noindexed pages', () => {
  const urls = pageUrlsOf({
    titles: [{ slug: 'a', title: 'A' }],
    people: [{ voicePage: true, voiceHref: '/voice-actor/v' }, { voicePage: true, voiceHref: '/voice-actor/thin', noindexVoice: true }],
    studios: [],
    artists: [{ slug: 'x', noindex: true }],
    watch: [],
    hubs: { groups: {}, years: {} },
    lastmod: (path) => (path === '/anime/a' ? '2026-10-02' : ''),
  })
  const group = (name) => urls.groups.find((g) => g.name === name).urls
  assert.equal(group('anime')[0].lastmod, '2026-10-02')
  assert.deepEqual(group('voice-actors'), [{ path: '/voice-actor/v' }])
  assert.deepEqual(group('artists'), [])
})

test('the A to Z of titles: every title is on one letter page, and every letter page is a hub path', () => {
  const rows = Array.from({ length: PER_AZ_PAGE + 20 }, (_, i) => [`Alpha ${String(i).padStart(4, '0')}`, `/anime/alpha-${i}`, 2000, 'TV'])
  const az = directory([...rows, ...Array.from({ length: 12 }, (_, i) => [`Beta ${i}`, `/anime/beta-${i}`, 2001, 'TV']), ['Zed', '/anime/zed', 1999, 'Movie']], [])
  const paths = hubPaths({ groups: {}, years: {}, az }).map((p) => p.path)
  assert.deepEqual(paths.filter((p) => p.startsWith('/a-z')), ['/a-z', '/a-z/0', '/a-z/a', '/a-z/a/2', '/a-z/b'])
  assert.equal(azPath('a', 2), '/a-z/a/2')
  const listed = Object.values(az.letters).flat().length
  assert.equal(listed, rows.length + 13)
  // The directory pages' own filters must not pick up the title letters.
  assert.ok(hubPaths({ groups: {}, years: {}, az }).every((p) => !p.letter))
})
