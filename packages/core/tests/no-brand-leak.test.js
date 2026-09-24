// The core never names a site. Every name, address and id comes from the
// site's own site.config.mjs (src/lib/define-site.mjs), so a sister site
// built from the core can never ship the first site's analytics, ad account,
// shop tags or keys by accident.
//
// Every text file in packages/core is read, this one included: the strings
// below are cut in two so this file does not match itself.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { extname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const CORE = fileURLToPath(new URL('..', import.meta.url))
const BINARY = new Set(['.gz', '.png', '.ico', '.jpg', '.jpeg', '.webp', '.avif', '.woff', '.woff2'])

// The first site's own values, and the shapes any site's ids take.
const LEAKS = [
  ["the first site's name",new RegExp('manhwa' + 'inde', 'i')],
  ['a GA4 id', new RegExp('\\bG' + '-[A-Z0-9]{8,12}\\b')],
  ['an AdSense publisher id', new RegExp('ca' + '-pub-\\d')],
  ['the AdSense publisher number', new RegExp('27893927' + '33984505')],
  ['an Amazon tag', new RegExp('["\'`][a-z0-9]+' + '-2[0-2]["\'`]')],
  ['the Turnstile site key', new RegExp('0x4AAAAAAE' + '8pcD79Cqtyp6rS')],
  ['the IndexNow key', new RegExp('368b5571dfe5' + '413a9a435c04fac12b49')],
  ['the analytics database id', new RegExp('a31cde34-' + 'a594-4430')],
]

function textFiles(dir) {
  const out = []
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules') continue
    const path = join(dir, name)
    if (statSync(path).isDirectory()) out.push(...textFiles(path))
    else if (!BINARY.has(extname(name).toLowerCase())) out.push(path)
  }
  return out
}

test('no site name, id, tag or key is written into the core', () => {
  const files = textFiles(CORE)
  assert.ok(files.length > 100, `read only ${files.length} files`)
  const hits = []
  for (const file of files) {
    const lines = readFileSync(file, 'utf8').split('\n')
    lines.forEach((line, at) => {
      for (const [what, pattern] of LEAKS) {
        if (pattern.test(line)) hits.push(`${relative(CORE, file)}:${at + 1} ${what}: ${line.trim().slice(0, 100)}`)
      }
    })
  }
  assert.deepEqual(hits, [])
})

test('the leak patterns do catch what they are for', () => {
  const caught = (text) => LEAKS.some(([, pattern]) => pattern.test(text))
  assert.equal(caught(`const site = 'https://${'manhwa'}index.com'`), true)
  assert.equal(caught(`gtag('config', '${'G'}-ABCDEF1234')`), true)
  assert.equal(caught(`us: '${'shop'}-20'`), true)
  assert.equal(caught(`const site = config.siteUrl`), false)
})
