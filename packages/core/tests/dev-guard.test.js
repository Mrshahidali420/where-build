// The dev-host guard (src/lib/dev-guard.js): a Workers dev address is never
// indexed, and a real domain never meets the guard at all.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { devGuard, withNoindex, NOINDEX } from '../src/lib/dev-guard.js'
import { robotsTxt, isBlockedAgent, DEV_ROBOTS } from '../src/lib/robots.mjs'
import { isDevHost } from '../src/lib/define-site.mjs'

const site = { dev: { blockBots: true } }
const BROWSER = { accept: 'text/html', 'user-agent': 'Mozilla/5.0 (Windows NT 10.0) Chrome/130.0' }
const ask = (url, headers = BROWSER, on = site) => devGuard(on, new Request(url, { headers }))

test('only a workers.dev host counts as a dev host', () => {
  assert.equal(isDevHost('whereanime.mr-shahidali-sa.workers.dev'), true)
  assert.equal(isDevHost('WHEREANIME.X.WORKERS.DEV'), true)
  assert.equal(isDevHost('whereanime.com'), false)
  assert.equal(isDevHost('workers.dev.example.com'), false)
  assert.equal(isDevHost(''), false)
})

test('a real domain is never touched, not even for a blocked crawler', () => {
  assert.equal(ask('https://example.com/robots.txt'), null)
  assert.equal(ask('https://example.com/', { 'user-agent': 'GPTBot/1.0' }), null)
})

test('on a dev host robots.txt disallows everything, for everyone', async () => {
  for (const headers of [BROWSER, { 'user-agent': 'GPTBot/1.0' }]) {
    const res = ask('https://a.b.workers.dev/robots.txt', headers)
    assert.equal(res.status, 200)
    assert.equal(await res.text(), DEV_ROBOTS)
    assert.equal(res.headers.get('x-robots-tag'), NOINDEX)
  }
})

test('on a dev host the shut-out crawlers and bare scripts get a 403, browsers pass', () => {
  assert.equal(ask('https://a.b.workers.dev/', { accept: '*/*', 'user-agent': 'Mozilla/5.0 (compatible; AhrefsBot/7.0)' }).status, 403)
  assert.equal(ask('https://a.b.workers.dev/', { 'user-agent': 'Mozilla/5.0' }).status, 403)
  assert.equal(ask('https://a.b.workers.dev/manga/berserk'), null)
})

test('with blockBots off only robots.txt is answered by the guard', () => {
  const open = { dev: { blockBots: false } }
  assert.equal(ask('https://a.b.workers.dev/', { 'user-agent': 'GPTBot/1.0' }, open), null)
  assert.equal(ask('https://a.b.workers.dev/robots.txt', BROWSER, open).status, 200)
})

test('withNoindex keeps the answer and adds the header', async () => {
  const res = withNoindex(new Response('hi', { status: 404, headers: { 'content-type': 'text/plain' } }))
  assert.equal(res.status, 404)
  assert.equal(res.headers.get('content-type'), 'text/plain')
  assert.equal(res.headers.get('x-robots-tag'), NOINDEX)
  assert.equal(await res.text(), 'hi')
})

test('the shared policy names its Sitemap and shuts out the take-only crawlers', () => {
  const text = robotsTxt('https://example.com')
  assert.match(text, /Sitemap: https:\/\/example\.com\/sitemap\.xml\n$/)
  assert.equal(isBlockedAgent('Mozilla/5.0 (compatible; GPTBot/1.2; +https://openai.com/gptbot)'), true)
  assert.equal(isBlockedAgent('Mozilla/5.0 (compatible; Googlebot/2.1)'), false)
  assert.equal(isBlockedAgent('Mozilla/5.0 (compatible; YandexBot/3.0)'), false)
  assert.equal(isBlockedAgent(null), false)
})
