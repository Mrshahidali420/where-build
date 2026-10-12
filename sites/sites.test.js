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

// Sites that have launched on their own domain. The rest live on their dev address.
const LIVE = new Set(['whereanime'])

test('four sites, each on its dev address until it launches on its planned domain', () => {
  assert.deepEqual(NAMES.sort(), ['anime', 'manga', 'manhua', 'novel'])
  for (const site of sites) {
    if (LIVE.has(site.key)) {
      assert.equal(site.domain, site.plannedDomain, site.key)
      assert.equal(site.siteUrl, `https://${site.domain}`)
    } else {
      assert.equal(site.domain, null, site.key)
      assert.equal(site.siteUrl, `https://${site.workerName}.mr-shahidali-sa.workers.dev`)
    }
    assert.match(site.plannedDomain, /^where[a-z]+\.com$/)
    assert.equal(site.r2.catalogWrite, false, `${site.key} must never write the catalog`)
    assert.equal(site.malExtras, false)
  }
})

test('no site carries a borrowed id: analytics, ads, shop tags and keys are empty or its own', () => {
  for (const site of sites) {
    // Before launch these stay empty; a live site may carry its own.
    if (!LIVE.has(site.key)) {
      for (const key of ['ga4Id', 'adsensePub', 'turnstileSiteKey', 'email', 'dmcaEmail']) assert.equal(site[key], null, `${site.key}.${key}`)
      assert.equal(site.indexNow.key, null)
    }
    // A shop tag is empty until the owner creates it, and then it is the
    // site's own (whereanime-20), never another site's.
    assert.ok(Object.values(site.amazon.stores).every((tag) => tag === '' || tag.startsWith(site.key)), `${site.key} amazon tags`)
    // A site gets its own D1 database once provisioned (WhereAnime did on 25 Sep
    // 2026); until then the id is null. Never manhwaindex's, checked below.
    assert.ok(site.d1.id === null || /^[0-9a-f-]{36}$/.test(site.d1.id), `${site.key}.d1.id`)
  }
  // And nothing copied from manhwaindex's config, whatever the key.
  const ids = /G-R1V6DJN1L3|ca-pub-|manhwaindex-2|manhwaindex\d+-2|manhwainde0f6|0x4AAAAAAE|368b5571dfe5|a31cde34-/
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

// Both files: the hand picks and the products matched from publisher records
// (packages/core/scripts/picks-from-products.mjs).
test('hand-picked and matched products hold ASINs and names only, never a shop tag', () => {
  for (const name of NAMES) {
    for (const base of ['picks.json', 'product-picks.json']) {
      const file = join(HERE, name, 'data', base)
      if (!existsSync(file)) continue
      const text = readFileSync(file, 'utf8')
      assert.doesNotMatch(text, /tag=|"[a-z0-9]+-2[0-2]"/i, `${name}: ${base} carries a tag`)
      const picks = JSON.parse(text)
      for (const group of [picks.titles, picks.characters, picks.people]) {
        for (const list of Object.values(group || {})) {
          for (const pick of list) assert.deepEqual(Object.keys(pick).filter((k) => !['a', 'n', 't'].includes(k)), [], `${name}: ${pick.a}`)
        }
      }
    }
  }
})

test('matched products never shadow a hand pick, and hold three at most', () => {
  for (const name of NAMES) {
    const file = join(HERE, name, 'data', 'product-picks.json')
    if (!existsSync(file)) continue
    const matched = JSON.parse(readFileSync(file, 'utf8'))
    const handFile = join(HERE, name, 'data', 'picks.json')
    const hand = existsSync(handFile) ? JSON.parse(readFileSync(handFile, 'utf8')).titles || {} : {}
    for (const [id, list] of Object.entries(matched.titles || {})) {
      assert.equal(hand[id], undefined, `${name}: ${id} is hand-picked`)
      assert.ok(list.length >= 1 && list.length <= 3, `${name}: ${id}`)
      for (const pick of list) assert.match(pick.a, /^(\d{9}[\dX]|B[0-9A-Z]{9})$/, `${name}: ${id}`)
    }
    assert.ok(Array.isArray(matched.noEnglishBooks), `${name}: noEnglishBooks`)
  }
})

// The hand picks were made for manhwaindex and are reused here. A pick holds
// an ASIN only, so the tag is written when the link is built, from this
// site's own config. Every Amazon link the title page's shop shelf can draw
// is built here from the real data files and must carry whereanime-20.
test('every shop shelf link on whereanime carries its own tag, never manhwaindex\'s', async () => {
  process.env.SITE_CONFIG = join(HERE, 'anime', 'site.config.mjs')
  const core = (path) => import(pathToFileURL(join(HERE, '..', 'packages', 'core', 'src', path)).href)
  const { shelfCards, primeTrial } = await core('where/shop-shelf.mjs')
  const { animeShopRows } = await core('where/shop.mjs')
  const { storeFor } = await core('lib/shop-links.js')
  const { pickUrlFor, picksForTitleIn } = await core('lib/picks-core.js')
  assert.equal(storeFor('US').tag, 'whereanime-20')
  const pickUrl = (asin) => pickUrlFor(asin, storeFor('US').tag)
  const data = (name) => JSON.parse(readFileSync(join(HERE, 'anime', 'data', name), 'utf8'))
  const [hand, matched, formats] = [data('picks.json'), data('product-picks.json'), data('pick-isbn-formats.json')]
  const ebooks = new Set(formats.ebook)
  const ids = new Set([...Object.keys(hand.titles), ...Object.keys(matched.titles)])
  let links = 0
  for (const id of ids) {
    const r = {
      id: Number(id), title: 'A Show', format: 'TV', status: 'FINISHED', episodes: 12, source: 'MANGA', popularity: 900000,
      songs: [{ type: 'OP', title: 'Song' }], cast: [], key: [], watchOn: [],
    }
    const picked = picksForTitleIn(hand, r, matched, formats)
    for (const country of ['US', 'GB', 'DE', 'JP', 'IT', '']) {
      const { cards, rest } = shelfCards({ r, buys: animeShopRows(r, country), picks: picked?.picks || [], trial: primeTrial(r, country), pickUrl })
      assert.equal(cards.at(-1).aff, 'trial-prime')
      for (const url of [...cards.map((c) => c.url), ...rest.map((p) => pickUrl(p.a))]) {
        const link = new URL(url)
        assert.equal(link.hostname, 'www.amazon.com', url)
        assert.equal(link.searchParams.get('tag'), 'whereanime-20', url)
        assert.doesNotMatch(url, /manhwaindex/i, url)
        links++
      }
    }
    for (const pick of picked?.picks || []) assert.ok(!ebooks.has(String(pick.a).toUpperCase()), `${id}: ${pick.a} is an e-book ISBN`)
  }
  assert.ok(links > 1000, 'the data files were read')
  // And no data file kept in git names manhwaindex's tag.
  for (const name of ['picks.json', 'product-picks.json', 'pick-isbn-formats.json']) {
    assert.doesNotMatch(readFileSync(join(HERE, 'anime', 'data', name), 'utf8'), /manhwaindex-2|manhwaindex\d+-2/i, name)
  }
})

// The Facebook Page poster adds an Amazon line to its first comment when the
// repo variable FB_AFFILIATE_COMMENT is true (packages/core/scripts/social/
// shop.mjs). It builds the link from the same picks and the same store as the
// title page, so it must carry whereanime-20 too, and never manhwaindex's tag.
test('every Amazon link the Facebook poster can write carries whereanime-20, never manhwaindex\'s', async () => {
  process.env.SITE_CONFIG = join(HERE, 'anime', 'site.config.mjs')
  const social = (path) => import(pathToFileURL(join(HERE, '..', 'packages', 'core', 'scripts', 'social', path)).href)
  const { shopFinder } = await social('shop.mjs')
  const { commentFor } = await social('site.mjs')
  const dir = join(HERE, 'anime', 'data')
  const find = shopFinder({ dir })
  const data = (name) => JSON.parse(readFileSync(join(dir, name), 'utf8'))
  const ids = new Set([...Object.keys(data('picks.json').titles), ...Object.keys(data('product-picks.json').titles)])
  let links = 0
  for (const id of ids) {
    const shop = find({ id: Number(id), relations: [] })
    if (!shop) continue
    const comment = commentFor({ label: 'Where to watch it', path: '/anime/x', shop }, { affiliate: true })
    const [siteLine, shopLine, ...more] = comment.split('\n')
    assert.deepEqual(more, [])
    assert.match(siteLine, /^Where to watch it: https:\/\/whereanime\.com\/anime\/x\?/)
    const link = new URL(shopLine.split(': ').at(-1))
    assert.equal(link.hostname, 'www.amazon.com', shopLine)
    assert.match(link.pathname, /^\/dp\//, shopLine)
    assert.equal(link.searchParams.get('tag'), 'whereanime-20', shopLine)
    assert.doesNotMatch(comment, /manhwaindex|associate/i, comment)
    links++
  }
  assert.ok(links > 500, `only ${links} links were checked`)
})
