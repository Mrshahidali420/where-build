// The settings a Where site adds (src/lib/define-site.mjs), the self-hosted
// fonts the integration turns them into, and the build-time sources it picks
// by builder (integration.mjs).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { join } from 'node:path'
import { defineSite, isWhereSite } from '../src/lib/define-site.mjs'
import { fontModule, sourceFileFor } from '../integration.mjs'
import fixture from './fixtures/site.config.mjs'

const input = () => structuredClone(fixture)
const SELF = {
  subsets: ['latin', 'latin-ext'],
  faces: [
    { pkg: '@fontsource/display-face', file: 'display-face', weights: [400], preload: [400], admin: [] },
    { pkg: '@fontsource/text-face', file: 'text-face', weights: [400, 700], preload: [400], admin: [700] },
  ],
}
const selfHosted = () => {
  const copy = input()
  copy.fonts = { display: "'Display Face'", text: "'Text Face'", self: structuredClone(SELF) }
  return copy
}
const whereSite = () => ({ ...input(), builder: 'where', r2: { ...input().r2, dataBucket: 'data', statePrefix: 'anime' } })

test('the builder defaults to core; a Where site needs a data bucket and a state folder', () => {
  assert.equal(fixture.builder, 'core')
  assert.equal(isWhereSite(fixture), false)
  assert.equal(isWhereSite(defineSite(whereSite())), true)
  assert.throws(() => defineSite({ ...input(), builder: 'other' }), /builder must be one of/)
  assert.throws(() => defineSite({ ...whereSite(), r2: { ...input().r2, dataBucket: 'data' } }), /Where site needs dataBucket and statePrefix/)
  assert.throws(() => defineSite({ ...whereSite(), r2: { ...input().r2, dataBucket: 'data', statePrefix: 'Bad Name' } }), /statePrefix/)
})

test('self-hosted fonts: every preloaded or admin weight must ship', () => {
  assert.equal(defineSite(selfHosted()).fonts.self.faces.length, 2)
  const noStylesheet = input()
  delete noStylesheet.fonts.stylesheet
  assert.throws(() => defineSite(noStylesheet), /stylesheet/)
  const unshipped = selfHosted()
  unshipped.fonts.self.faces[1].preload = [500]
  assert.throws(() => defineSite(unshipped), /weight 500 is preloaded or used by admin but not shipped/)
  const notFontsource = selfHosted()
  notFontsource.fonts.self.faces[0].pkg = 'some-font'
  assert.throws(() => defineSite(notFontsource), /@fontsource/)
})

test('footer.legal and search.pageLinks are checked when given', () => {
  const legal = input()
  legal.footer.legal = [{ href: '/about' }]
  assert.throws(() => defineSite(legal), /footer\.legal needs href and label/)
  const links = input()
  links.search.pageLinks = 'not a list'
  assert.throws(() => defineSite(links), /search\.pageLinks must be a list/)
})

test('the font module imports each subset of each weight, and preloads only the first screen', () => {
  const site = defineSite(selfHosted())
  const page = fontModule(site, 'page')
  assert.match(page, /import '@fontsource\/text-face\/latin-700\.css'/)
  assert.match(page, /import '@fontsource\/text-face\/latin-ext-400\.css'/)
  assert.match(page, /import face0 from '@fontsource\/display-face\/files\/display-face-latin-400-normal\.woff2\?url'/)
  assert.match(page, /export const fontPreload = \[face0, face1\]/)
  assert.doesNotMatch(page, /text-face-latin-700-normal\.woff2/)
  const admin = fontModule(site, 'admin')
  assert.match(admin, /import '@fontsource\/text-face\/latin-700\.css'/)
  assert.doesNotMatch(admin, /display-face/)
  assert.match(admin, /export const fontPreload = \[\]/)
  // A site on a font service gets an empty module.
  assert.equal(fontModule(fixture, 'page'), 'export const fontPreload = []\n')
})

test('a Where build never pulls the catalog sources into its graph', () => {
  const where = defineSite(whereSite())
  assert.equal(sourceFileFor(where, 'virtual:sitemap-source').endsWith(join('lib', 'where-sitemap.js')), true)
  assert.equal(sourceFileFor(where, 'virtual:search-source').endsWith(join('lib', 'search-source-where.js')), true)
  assert.equal(sourceFileFor(fixture, 'virtual:sitemap-source').endsWith(join('lib', 'sitemap-urls.js')), true)
  assert.equal(sourceFileFor(fixture, 'virtual:search-source').endsWith(join('lib', 'search-source-catalog.js')), true)
  assert.equal(sourceFileFor(fixture, './something.js'), null)
})

test('font pairs: one line picks a pair, every face ships its preloaded weight, the display weight defaults to 400', async () => {
  const { FONT_PAIRS, fontPair } = await import('../src/lib/font-pairs.mjs')
  for (const key of Object.keys(FONT_PAIRS)) {
    const site = defineSite({ ...selfHosted(), fonts: fontPair(key) })
    assert.deepEqual(site.fonts.self.subsets, ['latin', 'latin-ext'])
    assert.match(site.fonts.displayWeight, /^[1-9]00$/)
    const code = fontModule(site, 'page')
    for (const face of site.fonts.self.faces) assert.match(code, new RegExp(`${face.pkg}/latin-ext-${face.weights[0]}\.css`))
  }
  assert.throws(() => fontPair('comic-sans'), /no pair/)
  assert.equal(defineSite(selfHosted()).fonts.displayWeight, '400')
  assert.throws(() => defineSite({ ...selfHosted(), fonts: { ...selfHosted().fonts, displayWeight: 'bold' } }), /displayWeight/)
})

test('every font pair is installed in the anime site, so the swap is one line', async () => {
  const { FONT_PAIRS } = await import('../src/lib/font-pairs.mjs')
  const { readFileSync } = await import('node:fs')
  const pkg = JSON.parse(readFileSync(new URL('../../../sites/anime/package.json', import.meta.url), 'utf8'))
  for (const pair of Object.values(FONT_PAIRS)) {
    for (const face of pair.faces) assert.ok(pkg.dependencies[face.pkg], `${face.pkg} is in sites/anime/package.json`)
  }
})
