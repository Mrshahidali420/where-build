// REQUEST TIME. Reads a single record out of a shard through the ASSETS
// binding. Never import catalog.js from here: that would pull the whole
// 26 MB catalog into the Worker and the deploy would be rejected.
import { bucket, titleKey, TITLE_SHARDS, CHARACTER_SHARDS } from './shard-key.js'
import config from './site.mjs'

// A shard file is a list of lines, "key<TAB>json". We find our line with a
// plain string search and parse only that one record, so a big shard costs
// almost the same as a small one.
const MAX_CACHED_SHARDS = 8
const cache = new Map()

// How many times a shard read is tried before the page gives up. One blip in
// the ASSETS binding used to turn into a 404 for every title in that shard,
// and a 404 tells Google to drop the page. Now a blip is retried, and if it
// still fails the page answers 503, which tells Google to come back later.
const READ_ATTEMPTS = 3

/** Thrown when a shard could not be read. It never means "no such record". */
export class ShardUnavailable extends Error {
  constructor(name, status) {
    super(`shard ${name} unavailable (${status})`)
    this.name = 'ShardUnavailable'
  }
}

/** The shard text, or null when the read failed. Never caches a failure. */
async function fetchShard(env, folder, n) {
  try {
    const res = await env.ASSETS.fetch(new Request(`https://assets.local/d/${folder}/${n}.txt`))
    // Every shard number below the fixed count exists in every build, so a
    // miss here is a broken or half-finished deploy, not a missing record.
    if (!res.ok) return { text: null, status: res.status }
    return { text: await res.text(), status: res.status }
  } catch (e) {
    return { text: null, status: e?.message || 'error' }
  }
}

async function readShard(env, folder, n) {
  const name = `${folder}/${n}`
  const hit = cache.get(name)
  if (hit !== undefined) return hit

  let last = { text: null, status: 'unread' }
  for (let attempt = 0; attempt < READ_ATTEMPTS; attempt++) {
    last = await fetchShard(env, folder, n)
    if (last.text !== null) break
  }
  if (last.text === null) throw new ShardUnavailable(name, last.status)

  // A warm isolate keeps the shard, so the next hit on it is free. Only a
  // real read is ever kept: a failure must not poison the whole shard.
  if (cache.size >= MAX_CACHED_SHARDS) cache.delete(cache.keys().next().value)
  cache.set(name, last.text)
  return last.text
}

/**
 * One record, or null when the key is not in its shard. Throws
 * ShardUnavailable when the shard itself could not be read, so the page can
 * answer 503 instead of 404.
 */
async function readRecord(env, folder, count, key) {
  const text = await readShard(env, folder, bucket(key, count))
  const at = text.indexOf(`\n${key}\t`)
  if (at < 0) return null
  const from = at + key.length + 2
  const to = text.indexOf('\n', from)
  try {
    return JSON.parse(to < 0 ? text.slice(from) : text.slice(from, to))
  } catch {
    return null
  }
}

/** One title, or null when the kind and slug do not name a real page. */
export function loadTitle(env, kind, slug) {
  return readRecord(env, 't', TITLE_SHARDS, titleKey(kind, slug))
}

/** One character, or null. */
export function loadCharacter(env, slug) {
  return readRecord(env, 'c', CHARACTER_SHARDS, slug)
}

/**
 * One record of any other shard folder, or null: a Where site's people,
 * studios, artists and franchises (src/where/shard-folders.mjs names the
 * folders and their fixed counts).
 */
export function loadRecord(env, folder, count, key) {
  return readRecord(env, folder, count, key)
}

/** The Cloudflare runtime, whatever Astro version put it there. */
export const envOf = (astro) => astro.locals?.runtime?.env

// Cloudflare stamps every request with the reader's country. It is used to
// pick their own Amazon store. An empty answer is fine: the shop links fall
// back to the US store on their own.
export const countryOf = (astro) => astro.request.headers.get('cf-ipcountry') || ''

/**
 * The real 404 page, with a real 404 status. Astro cannot rewrite to a
 * page that was built as a file, so the file is served directly.
 */
export async function notFound(astro) {
  const env = envOf(astro)
  let body = '<!doctype html><title>Not found</title><h1>Not found</h1>'
  try {
    const res = await env.ASSETS.fetch(new Request('https://assets.local/404.html'))
    if (res.ok || res.status === 404) body = await res.text()
  } catch {
    // fall through to the plain message above
  }
  return new Response(body, {
    status: 404,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      // A 404 must never stick. A title added tomorrow has to work at once,
      // even for a reader whose browser saw the miss today.
      'cache-control': 'no-store',
    },
  })
}

/**
 * The answer when the data could not be read: 503, try again shortly.
 *
 * This is the one status that means "the page exists, the server hiccuped".
 * A crawler keeps the page in its index and comes back; a reader's browser
 * shows the note and a refresh usually works. A 404 here would have told
 * Google the page is gone, which is how real pages fell out of search.
 */
export function unavailable(astro, error) {
  const detail = error instanceof ShardUnavailable ? error.message : 'read failed'
  console.error(`503 ${astro.url?.pathname || ''}: ${detail}`)
  const body =
    '<!doctype html><html lang="en"><head><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<meta name="robots" content="noarchive">' +
    '<title>One moment</title>' +
    `<style>body{font:16px/1.5 system-ui,sans-serif;margin:0;min-height:100vh;display:grid;place-items:center;background:${config.colors.night};color:${config.colors.dawn}}main{max-width:32rem;padding:2rem}h1{font-size:1.4rem;margin:0 0 .5rem}p{margin:0 0 1rem;opacity:.8}a{color:${config.colors.rose}}.brand{display:inline-flex;align-items:center;gap:.5rem;margin-bottom:1.5rem;font-weight:800;font-size:1.2rem;text-decoration:none;color:${config.colors.dawn}}.brand svg{color:${config.colors.rose}}.brand span{color:${config.colors.rose}}</style>` +
    `<link rel="icon" href="/favicon.svg" type="image/svg+xml">` +
    `</head><body><main><a class="brand" href="/"><svg width="28" height="28" viewBox="0 0 32 32" aria-hidden="true">${config.mark}</svg>${config.wordmark[0]}<span>${config.wordmark[1]}</span></a><h1>One moment</h1>` +
    '<p>This page exists, but the data behind it did not load just now. Refresh in a few seconds.</p>' +
    '<p><a href="javascript:location.reload()">Try again</a></p></main></body></html>'
  return new Response(body, {
    status: 503,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'no-store',
      'retry-after': '30',
    },
  })
}
