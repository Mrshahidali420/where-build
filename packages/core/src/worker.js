// The front door. makeWorker(site, build) gives one site's Worker. It does
// four jobs, in this order:
//   0. on a Workers dev host, the guard keeps the site out of every index
//      (src/lib/dev-guard.js)
//   1. old URLs are sent to their new home
//   2. a page already rendered once is served from the edge cache
//   3. everything else goes to Astro, which serves a static file or
//      renders a title or character page from a shard
//
// The site's own worker.js imports its build and hands it over:
//   export default makeWorker(site, { astro, redirects, shards })
// astro is dist/_worker.js/index.js, redirects is data/redirects.json and
// shards is data/shards.json, all written by that site's build.
import { runRollup } from './lib/rollup.js'
import { cleanRow, INSERT_SQL } from './lib/beacon-rows.js'
import { devGuard, withNoindex } from './lib/dev-guard.js'
import { isDevHost } from './lib/define-site.mjs'

// How long the edge keeps a rendered page. The data changes once a day.
const CACHE_SECONDS = 86400

// The answer pages that hang under a title or a character page.
const SUBPAGE = /^(\/[^/]+\/[^/]+)(\/(?:buy|free|like|characters))$/

// Where the page script posts one row per view, per outbound click and per
// exit. It is short on purpose: it travels in every page.
const BEACON_PATH = '/_a'

// A row is small. Anything bigger than this is a mistake or an attack, and is
// dropped before it reaches the database.
const MAX_BODY = 32768
// Most visits now arrive as one batch at the end, so a body holds many rows.
const MAX_ROWS = 25

/**
 * Keep one event. It can never fail the page: the script does not wait for the
 * answer, and every error here ends as the same empty 204.
 */
async function recordEvent(request, env) {
  const done = new Response(null, {
    status: 204,
    headers: { 'cache-control': 'no-store' },
  })
  if (!env || !env.ANALYTICS) return done

  let body
  try {
    const raw = await request.text()
    if (!raw || raw.length > MAX_BODY) return done
    body = JSON.parse(raw)
  } catch (e) {
    return done
  }
  if (!body || typeof body !== 'object') return done

  // No pass, nothing written. This is the whole defence: a browser driven by a
  // program cannot get a Turnstile ticket, so it can never hold a pass.
  if (!(await passIsGood(body.pass, env))) return done

  // One visit used to cost three requests: open, click, leave. On a free
  // Workers plan that was 82% of the whole daily allowance, and the site
  // started answering 504 once the allowance ran out. The page now keeps its
  // rows in the tab and sends them all together when the reader really goes,
  // so a whole visit costs one request instead of three.
  const rows = Array.isArray(body.rows) ? body.rows.slice(0, MAX_ROWS) : [body]
  const now = Date.now()
  const country = request.headers.get('cf-ipcountry') || ''

  try {
    // Every field is checked and cut in src/lib/beacon-rows.js. A row it
    // refuses (an unknown action, a search that looks like an e-mail) is
    // simply not written.
    const stmt = env.ANALYTICS.prepare(INSERT_SQL)
    const batch = []
    for (const row of rows) {
      const values = cleanRow(row, country, now)
      if (values) batch.push(stmt.bind(...values))
    }
    if (batch.length) await env.ANALYTICS.batch(batch)
  } catch (e) {
    // A full day allowance or a dropped connection must not break a page view.
  }
  return done
}


// Where the page asks for a pass. It sends one Turnstile ticket and gets back
// a pass that lasts half an hour.
//
// Turnstile is Cloudflare's own "is a real browser here" test. It is free and
// the reader never sees it. It exists because nothing the page itself can
// measure works any more: the crawler that fills these reports runs a real
// browser on home internet lines in forty six countries, waits on the page for
// up to thirty eight seconds, and scrolls. It looks exactly like a reader from
// the inside. From the outside, to Cloudflare, it does not.
const PASS_PATH = '/_p'
const VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify'
// A Turnstile ticket is good once and dies after five minutes, so the page
// cannot keep sending it. The worker trades it for a pass of our own, and the
// pass is what travels with every later beacon.
const PASS_MINUTES = 30

const enc = new TextEncoder()

async function sign(key, message) {
  const k = await crypto.subtle.importKey(
    'raw',
    enc.encode(key),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const mac = await crypto.subtle.sign('HMAC', k, enc.encode(message))
  return Array.from(new Uint8Array(mac))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

/**
 * Trade one Turnstile ticket for a pass. The pass is the minute it dies plus a
 * signature, so the worker can check it later without keeping a list.
 */
async function issuePass(request, env) {
  const no = new Response('no', { status: 403, headers: { 'cache-control': 'no-store' } })
  if (!env || !env.TURNSTILE_SECRET || !env.PASS_KEY) return no

  let token = ''
  try {
    const raw = await request.text()
    if (raw.length > 4096) return no
    token = String(JSON.parse(raw).token || '')
  } catch (e) {
    return no
  }
  if (!token) return no

  try {
    const form = new FormData()
    form.append('secret', env.TURNSTILE_SECRET)
    form.append('response', token)
    const ip = request.headers.get('cf-connecting-ip')
    if (ip) form.append('remoteip', ip)
    const answer = await fetch(VERIFY_URL, { method: 'POST', body: form })
    const verdict = await answer.json()
    if (!verdict || verdict.success !== true) return no
  } catch (e) {
    return no
  }

  const dies = Date.now() + PASS_MINUTES * 60000
  const pass = dies + '.' + (await sign(env.PASS_KEY, String(dies)))
  return new Response(JSON.stringify({ pass }), {
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  })
}

/** True only for a pass this worker signed itself and that is still alive. */
async function passIsGood(pass, env) {
  if (!env || !env.PASS_KEY || typeof pass !== 'string') return false
  const cut = pass.indexOf('.')
  if (cut < 1) return false
  const dies = Number(pass.slice(0, cut))
  if (!dies || dies < Date.now()) return false
  return pass.slice(cut + 1) === (await sign(env.PASS_KEY, String(dies)))
}

/** One site's Worker, around that site's Astro build. */
export function makeWorker(site, { astro, redirects, shards }) {
  // Every build writes a new builtAt. It goes in the cache key, so a page kept
  // by the last build can never be found again after a deploy. Without this a
  // template change stays invisible for a full day.
  const BUILD = String(shards.builtAt || 0)

  async function serve(request, env, ctx) {
    const url = new URL(request.url)
    const path = url.pathname.replace(/\/$/, '') || '/'

    const target = redirects[path]
    if (target) return Response.redirect(`${url.origin}${target}${url.search}`, 301)

    // A page that moved takes its answer pages with it. The map holds only the
    // page itself, so /character/jin-u-seong/buy is matched here by its parent
    // and follows it to /character/sung-jin-woo/buy. One lookup, no new rows.
    const sub = SUBPAGE.exec(path)
    if (sub && redirects[sub[1]]) {
      return Response.redirect(`${url.origin}${redirects[sub[1]]}${sub[2]}${url.search}`, 301)
    }

    if (url.pathname === PASS_PATH) {
      if (request.method !== 'POST') return new Response(null, { status: 405 })
      return issuePass(request, env)
    }

    if (url.pathname === BEACON_PATH) {
      if (request.method !== 'POST') return new Response(null, { status: 405 })
      return recordEvent(request, env)
    }

    // The admin pages read the database on every request, so they are
    // rendered fresh every time and never kept by the edge.
    if (path === '/my-admin' || path.startsWith('/my-admin/')) {
      return astro.fetch(request, env, ctx)
    }

    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return astro.fetch(request, env, ctx)
    }

    const cache = caches.default
    // The buy links point at the reader's own Amazon store, so a page cached
    // for one country must never be served to another. The country joins the
    // key. This costs almost nothing: an edge cache is per data centre, and a
    // data centre already serves mostly one country.
    const country = request.headers.get('cf-ipcountry') || 'zz'
    // Always GET: the cache API refuses to store a HEAD request.
    const cacheKey = new Request(
      `${url.origin}${url.pathname}?_b=${BUILD}&_c=${country}`,
      { method: 'GET' }
    )
    const hit = await cache.match(cacheKey)
    if (hit) return hit

    const response = await astro.fetch(request, env, ctx)

    // Only a good HTML answer is worth keeping. A 404 must stay cheap to fix.
    const type = response.headers.get('content-type') || ''
    if (response.status === 200 && type.includes('text/html')) {
      const kept = new Response(response.body, response)
      kept.headers.set('cache-control', `public, max-age=0, s-maxage=${CACHE_SECONDS}`)
      ctx.waitUntil(cache.put(cacheKey, kept.clone()))
      return kept
    }
    return response
  }

  return {
    async fetch(request, env, ctx) {
      const guarded = devGuard(site, request)
      if (guarded) return guarded
      const response = await serve(request, env, ctx)
      return isDevHost(new URL(request.url).hostname) ? withNoindex(response) : response
    },

    /**
     * Once a night, at 00:10 UTC, yesterday is squeezed into the small daily
     * tables and raw rows older than 30 days are thrown away. See
     * src/lib/rollup.js. One run is one Worker request.
     */
    async scheduled(controller, env, ctx) {
      ctx.waitUntil(runRollup(env && env.ANALYTICS))
    },
  }
}
