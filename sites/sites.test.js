// The four "Where" sites: each one is on its dev address only, carries none
// of another site's ids, and has its own palette, at least as readable as
// manhwaindex's.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync, readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const HERE = fileURLToPath(new URL('.', import.meta.url))
const NAMES = readdirSync(HERE).filter((name) => existsSync(join(HERE, name, 'site.config.mjs')))
const sites = await Promise.all(NAMES.map(async (name) => (await import(pathToFileURL(join(HERE, name, 'site.config.mjs')).href)).default))

// manhwaindex's own contrast for each pair (foreground on background),
// measured from its palette on 24 Sep 2026. A sister may not fall below it.
const FLOORS = {
  'dawn/night': 17.37, 'dawn-dim/night': 10.01, 'dawn-faint/night': 5.96, 'dawn-faint/night-raised': 5.66,
  'dawn-dim/night-raised': 9.51, 'dawn/night-raised': 16.49, 'rose/night': 6.32, 'rose/night-raised': 6.0,
  'rose-soft/night': 10.31, 'cobalt-bright/night': 5.43, 'cobalt-bright/night-raised': 5.15, 'dawn/cobalt': 9.94,
  'day/cobalt': 11.64, 'dawn-dim/cobalt': 5.73, 'night/rose': 6.32, 'night/rose-soft': 10.31,
  'night/cobalt-bright': 5.43, 'dawn/cobalt-line': 8.05,
}
// manhwaindex's accents, which no sister may reuse.
const TAKEN = ['#16337d', '#24418f', '#5f7fe0', '#e0688a', '#f0a3b8']

const channel = (v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)
const luminance = (hex) => {
  const [r, g, b] = [1, 3, 5].map((i) => channel(parseInt(hex.slice(i, i + 2), 16) / 255))
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
const contrast = (a, b) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

test('four sites, each on its dev address only', () => {
  assert.deepEqual(NAMES.sort(), ['anime', 'manga', 'manhua', 'novel'])
  for (const site of sites) {
    assert.equal(site.domain, null, site.key)
    assert.equal(site.siteUrl, `https://${site.workerName}.mr-shahidali-sa.workers.dev`)
    assert.match(site.plannedDomain, /^where[a-z]+\.com$/)
    assert.equal(site.r2.catalogWrite, false, `${site.key} must never write the catalog`)
    assert.equal(site.malExtras, false)
  }
})

test('no site carries an id: analytics, ads, shop tags, keys and databases stay empty', () => {
  for (const site of sites) {
    for (const key of ['ga4Id', 'adsensePub', 'turnstileSiteKey', 'email', 'dmcaEmail']) assert.equal(site[key], null, `${site.key}.${key}`)
    assert.ok(Object.values(site.amazon.stores).every((tag) => tag === ''), `${site.key} amazon tags`)
    assert.equal(site.indexNow.key, null)
    assert.equal(site.d1.id, null)
  }
  // And nothing copied from manhwaindex's config, whatever the key.
  const ids = /G-[A-Z0-9]{8,12}|ca-pub-|manhwaindex-2|0x4AAAAAAE|368b5571dfe5|a31cde34-/
  for (const name of [...NAMES.map((n) => join(n, 'site.config.mjs')), 'family.mjs']) {
    assert.doesNotMatch(readFileSync(join(HERE, name), 'utf8'), ids, name)
  }
})

test('every palette is its own and at least as readable as manhwaindex', () => {
  const accents = new Set()
  for (const site of sites) {
    for (const [pair, floor] of Object.entries(FLOORS)) {
      const [fg, bg] = pair.split('/')
      const ratio = contrast(site.colors[fg], site.colors[bg])
      assert.ok(ratio >= floor, `${site.key} ${pair} is ${ratio.toFixed(2)}, below ${floor}`)
    }
    for (const token of ['cobalt', 'cobalt-line', 'cobalt-bright', 'rose', 'rose-soft']) {
      const hex = site.colors[token].toLowerCase()
      assert.ok(!TAKEN.includes(hex), `${site.key} ${token} reuses a manhwaindex colour`)
      assert.ok(!accents.has(hex), `${site.key} ${token} ${hex} is another sister's`)
      accents.add(hex)
    }
  }
})

test('no sister links to a workers.dev host', () => {
  for (const site of sites) {
    for (const url of Object.values(site.sisterSites)) if (url) assert.doesNotMatch(url, /workers\.dev/)
  }
})
