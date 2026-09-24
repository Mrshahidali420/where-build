// A site's settings are checked before anything is built
// (src/lib/define-site.mjs): a missing or misspelt key stops the build with
// its name.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { defineSite, hasRoute } from '../src/lib/define-site.mjs'
import { ALL_ROUTES, ROUTES, patternOf } from '../src/lib/routes.mjs'
import fixture from './fixtures/site.config.mjs'

const input = () => structuredClone(fixture)
const without = (key) => {
  const copy = input()
  delete copy[key]
  return copy
}

test('the derived addresses follow the domain', () => {
  assert.equal(fixture.host, 'example.com')
  assert.equal(fixture.siteUrl, 'https://example.com')
  assert.equal(fixture.devHost, 'fixture.tests.workers.dev')
  const dev = defineSite({ ...input(), domain: null })
  assert.equal(dev.host, 'fixture.tests.workers.dev')
  assert.equal(dev.siteUrl, 'https://fixture.tests.workers.dev')
})

test('the settings are frozen all the way down', () => {
  assert.throws(() => {
    fixture.colors.night = '#000000'
  }, TypeError)
  assert.throws(() => fixture.nav.push({ href: '/x', label: 'x' }), TypeError)
})

test('a missing key is named', () => {
  assert.throws(() => defineSite(without('name')), /site\.config: name /)
  assert.throws(() => defineSite(without('workerName')), /workerName/)
  assert.throws(() => defineSite(without('ga4Id')), /ga4Id must be a string or null/)
})

test('a colour must be one of the twelve tokens, as #rrggbb', () => {
  const bad = input()
  bad.colors.rose = 'pink'
  assert.throws(() => defineSite(bad), /colors\.rose/)
  const extra = input()
  extra.colors.mint = '#00ff99'
  assert.throws(() => defineSite(extra), /unknown tokens: mint/)
})

test('a domain may not be a workers.dev host, and a sister link may not point at one', () => {
  assert.throws(() => defineSite({ ...input(), domain: 'x.y.workers.dev' }), /domain/)
  assert.throws(() => defineSite({ ...input(), sisterSites: { anime: 'https://x.y.workers.dev' } }), /sisterSites\.anime/)
  assert.doesNotThrow(() => defineSite({ ...input(), sisterSites: { anime: 'https://example.org', manga: null } }))
})

test('routes are core route keys, and the contact pages need their emails', () => {
  assert.throws(() => defineSite({ ...input(), routes: ['home', 'blog'] }), /routes: blog/)
  assert.throws(() => defineSite({ ...input(), email: null }), /contact needs email/)
  const quiet = defineSite({ ...input(), email: null, dmcaEmail: null, routes: ['home', 'titles'] })
  assert.equal(hasRoute(quiet, 'titles'), true)
  assert.equal(hasRoute(quiet, 'contact'), false)
})

test('a dock item needs an icon the core draws', () => {
  assert.throws(() => defineSite({ ...input(), dock: [{ href: '/', label: 'Home', icon: 'rocket' }] }), /dock \//)
})

test('owned kinds are catalog kinds', () => {
  assert.throws(() => defineSite({ ...input(), ownedKinds: [] }), /ownedKinds/)
  assert.throws(() => defineSite({ ...input(), ownedKinds: [{ kind: 'movie' }] }), /ownedKinds/)
})

test('every route names page files, and each becomes an address without "index" or an extension', () => {
  assert.deepEqual(ALL_ROUTES, Object.keys(ROUTES))
  for (const files of Object.values(ROUTES)) assert.ok(files.length > 0)
  assert.equal(patternOf('index.astro'), '/')
  assert.equal(patternOf('genre/index.astro'), '/genre')
  assert.equal(patternOf('[kind]/[slug]/free.astro'), '/[kind]/[slug]/free')
  assert.equal(patternOf('sitemap.xml.js'), '/sitemap.xml')
})
