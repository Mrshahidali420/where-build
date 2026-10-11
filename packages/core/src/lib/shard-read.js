// REQUEST TIME. Reads a single record out of a shard through the ASSETS
// binding. Never import catalog.js from here: that would pull the whole
// 26 MB catalog into the Worker and the deploy would be rejected.
//
// This file reads no site config, so the Worker's own front door
// (src/worker.js), which is bundled outside Astro, can use it as it is.
// Pages import the same functions through src/lib/runtime.js.
import { bucket, titleKey, TITLE_SHARDS, CHARACTER_SHARDS } from './shard-key.js'

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
