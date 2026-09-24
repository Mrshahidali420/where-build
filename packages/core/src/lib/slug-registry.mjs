// The slug registry: data/slug-registry.json.
//
// Why it exists. reslug.mjs used to hand out clean slugs by popularity on
// every build: the most popular "Solo Leveling" got /manhwa/solo-leveling and
// a less popular namesake got /manhwa/solo-leveling-2018. Popularity moves
// every night, so the day the namesake overtook the original the two swapped
// addresses, and a URL Google had indexed started showing a different book.
// The registry remembers, per AniList id, the address a page was given. Once
// given, an address never moves and is never handed to anything else.
//
// Shape (compact JSON, never pretty-printed: it holds one row per page):
//   {
//     version: 1,
//     bootstrappedAt, bootstrappedFrom: { runId, titles, characterPages },
//     migrations: ["fan-name-slugs-1", "series-suffix-slugs-1"],   one-time moves already applied
//     entries: {
//       "t:<anilistId>": { ns, slug, raw, past: [] },
//       "c:<characterId>": { ns: "character", slug, raw, past: [], aliases: [] }
//     }
//   }
// ns is the URL folder (manhwa, manga, manhua, novel, anime, character). raw is
// the id-carrying slug the ingest wrote (solo-leveling-105398). past holds
// every earlier address as a full path, so each one keeps redirecting. Entries
// are never deleted, not even for a blocked title, so its address can never be
// recycled for a different book.
//
// Resolved from the working directory, not from import.meta.url, for the
// same reason blocked.js and catalog.js are: catalog.js is bundled into
// dist/_worker.js before the prerender step runs it.
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { writeJsonAtomic } from './write-atomic.mjs'

export const REGISTRY_FILE = join(process.cwd(), 'data', 'slug-registry.json')

// Written by scripts/slug-registry.mjs when a registry that shipped before
// was lost and had to be worked out again. While it exists, CI will not save
// the recomputed registry over the good copies in the cache and in R2.
export const RECOVERED_MARKER = join(process.cwd(), 'data', 'slug-registry.recovered')

/** A registry with nothing in it yet. */
export function newRegistry(bootstrappedFrom = null) {
  return {
    version: 1,
    bootstrappedAt: new Date().toISOString(),
    bootstrappedFrom,
    entries: {},
  }
}

/**
 * The registry on disk. A missing file is null (nothing assigned yet). A file
 * that is there but cannot be read is an error, never a silent empty registry:
 * an empty registry would hand out fresh slugs and move pages.
 */
export function loadRegistry(file = REGISTRY_FILE) {
  if (!existsSync(file)) return null
  let registry
  try {
    registry = JSON.parse(readFileSync(file, 'utf8'))
  } catch (error) {
    throw new Error(`${file} is corrupt: ${error.message}`)
  }
  if (!registry || registry.version !== 1 || typeof registry.entries !== 'object' || !registry.entries) {
    throw new Error(`${file} is corrupt: not a version 1 slug registry`)
  }
  return registry
}

export function saveRegistry(registry, file = REGISTRY_FILE) {
  writeJsonAtomic(file, registry)
}

export const registrySize = (registry) => (registry ? Object.keys(registry.entries).length : 0)

/**
 * A short fingerprint of the entries, published in the live manifest. FNV-1a
 * in plain JavaScript instead of node:crypto, because this module is bundled
 * with catalog.js and the Worker runs without Node compatibility.
 */
export function registryHash(registry) {
  const text = JSON.stringify(registry?.entries || {})
  let h1 = 0x811c9dc5
  let h2 = 0x01000193
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i)
    h1 = Math.imul(h1 ^ c, 0x01000193)
    h2 = Math.imul(h2 ^ c, 0x0100019d)
  }
  const hex = (n) => (n >>> 0).toString(16).padStart(8, '0')
  return hex(h1) + hex(h2)
}
