// Loads the build-time facts behind a reader's list: the list rows in
// /d/l/<n>.json and the For you pool in /d/feed.v1.json. Both are written by
// scripts/make-shards.mjs and served as plain static files, so fetching them
// costs the Worker nothing.
//
// Browser only. A file stays in memory once it has loaded, so the same page
// asking twice downloads once.

import { listBucket } from './shard-key.js'

// How many shard files are fetched at once. An import of a long AniList list
// can touch hundreds of the 512 files; this keeps a phone from opening them
// all in the same instant.
const PARALLEL = 6

const shards = new Map()
let feed = null

async function getJson(url) {
  const res = await fetch(url, { credentials: 'omit' })
  if (!res.ok) throw new Error(`${url} answered ${res.status}`)
  return res.json()
}

/** One shard file, as { "<id>": row }. A failed read is not cached. */
function loadShard(n) {
  let pending = shards.get(n)
  if (!pending) {
    pending = getJson(`/d/l/${n}.json`).catch((e) => {
      shards.delete(n)
      throw e
    })
    shards.set(n, pending)
  }
  return pending
}

/**
 * The rows for a set of AniList ids, as a Map of id -> row. An id we do not
 * hold is simply absent from the map. `failed` counts shard files that did
 * not load, so a page can tell "not in the index" from "could not check".
 */
export async function loadRows(ids) {
  const wanted = [...new Set([...ids].map(Number).filter((n) => n > 0))]
  const buckets = [...new Set(wanted.map(listBucket))]
  const byBucket = new Map()
  let failed = 0
  let next = 0
  async function worker() {
    while (next < buckets.length) {
      const n = buckets[next++]
      try {
        byBucket.set(n, await loadShard(n))
      } catch (e) {
        failed++
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(PARALLEL, buckets.length) }, worker))

  const rows = new Map()
  const unknown = new Set()
  for (const id of wanted) {
    const shard = byBucket.get(listBucket(id))
    if (!shard) {
      unknown.add(id)
      continue
    }
    const row = shard[id]
    if (Array.isArray(row)) rows.set(id, row)
  }
  return { rows, failed, unknown }
}

/** The For you pool. Throws when it cannot be loaded. */
export function loadFeed() {
  if (!feed) {
    feed = getJson('/d/feed.v1.json').catch((e) => {
      feed = null
      throw e
    })
  }
  return feed
}
