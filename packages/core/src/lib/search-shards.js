// BUILD TIME ONLY. Files the whole catalog into the search slices served at
// /search/<prefix>.json, plus the manifest at /search/manifest.v1.json.
//
// Shared by src/pages/search/[prefix].json.js (serves the slices) and
// src/pages/search/manifest.v1.json.js (serves the manifest), so the expensive
// pass over the catalog runs exactly once per build: both pages import this
// module by the same specifier, so the bundler gives them the same module
// instance and this IIFE below only runs once.
//
// --- Why hierarchical slices ---
//
// A flat "first two letters" slice was capped at MAX_PER_SLICE records,
// written most-popular-first, so an unpopular title under a busy prefix
// ("ha", "th", "so"...) could be silently dropped from the file entirely —
// an exact search for its exact title would come back "No match" even
// though the title is in the catalog. At local-seed size (3,598 titles)
// that never bites; at production size (~111,000 titles) it does, on
// exactly the common prefixes people type most.
//
// The fix: when a prefix's bucket would overflow the cap, it is SPLIT
// instead of truncated. The prefix keeps a small file of its own (the
// titles whose matching word cannot go any deeper — see below), and every
// other title moves down into a slice keyed by one more letter of that
// word. That child slice is split again if it is still over the cap, and
// so on, until every title has a home. No title is ever dropped; the cost
// is a few extra files for the handful of prefixes popular enough to need
// them.
//
// A word that IS the prefix — the typed word "ha" itself, or any other
// 2-letter word, once "ha" has split — cannot go any deeper (there is no
// 3rd letter to key a child slice on). Those stay in the split prefix's
// own file, capped at MAX_PER_SLICE like a flat slice always was. That is
// the one remaining best-effort spot, and it is the same trade a flat
// slice already made for everything.
//
// The manifest (/search/manifest.v1.json) is the list of prefixes that split.
// The client walks: start at the query word's first 2 letters; if that
// prefix is not in the manifest, its file is complete, stop there; if it
// is, and the word has a letter beyond the current depth, move one letter
// deeper and repeat. See pathFor() in src/lib/finder-core.js — it must
// match this exactly, or the client asks for a file the build never wrote.
import { comics, novels, anime } from './catalog.js'
import { sectionOf } from './section.mjs'

/**
 * Most records a single slice file may hold — either a leaf slice (every
 * title reachable through it) or a split prefix's own file (best-effort,
 * see above). Kept modest so a busy prefix's file stays small on a phone;
 * kept from dropping anything by letting the bucket split instead of
 * truncate once it is crossed.
 */
const MAX_PER_SLICE = 1500

/** How much alternate-name text rides along, in characters. */
const MAX_ALT = 32

/**
 * Accents fold away, apostrophes vanish entirely ("I'll" -> "ill", matching
 * a typed "ill"), and every other punctuation mark becomes a space. This
 * MUST behave identically to the fold() in src/lib/finder-core.js, the
 * shared copy the browser uses to decide which slice to fetch and how to
 * match rows inside it. If the two drift, a client-side match can land in
 * a slice the build never filed it into.
 */
const fold = (text) =>
  text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[’‘'`]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()

/** Latin words only: a Japanese synonym cannot be typed into this box. */
const wordsOf = (text) =>
  fold(text)
    .split(/\s+/)
    .filter((w) => w.length >= 2)

// Every cover of the same kind shares one long address, so only the file name
// is stored. The browser rebuilds the rest. That is about 60 bytes a record.
const COVER_HEAD =
  /^https:\/\/s4\.anilist\.co\/file\/anilistcdn\/media\/(?:manga|anime)\/cover\/large\//

/**
 * One record, written as an array. Object keys would repeat on every one of the
 * several hundred thousand records and cost more than the data itself.
 *
 *   [ title, url, cover file, year, alternate names ]
 *
 * Popularity is not stored. Records are already written most-popular first, and
 * every sort below is stable, so that order survives on its own.
 */
function record(item, kind) {
  const cover = (item.cover || '').replace('/large/', '/small/')

  // The title is matched in the browser from the title itself, so it is not
  // repeated here. Only the other names a person might type are.
  const titleWords = new Set(wordsOf(item.title))
  const alt = [...new Set([item.titleRomaji, ...(item.synonyms || []).slice(0, 1)]
    .filter(Boolean)
    .flatMap(wordsOf)
    .filter((w) => !titleWords.has(w)))]

  return [
    item.title,
    `/${kind}/${item.slug}`,
    COVER_HEAD.test(item.cover || '') ? cover.split('/').pop() : cover,
    item.startYear || 0,
    alt.join(' ').slice(0, MAX_ALT).trim(),
  ]
}

/**
 * Every word a title should be found by: the title's own words, plus the
 * alternate-name words that ride along in the record (row[4], already
 * capped to MAX_ALT characters — the same string the client matches
 * against, so filing on it keeps build and client in agreement even if a
 * long alt name gets cut mid-word). Fragments shorter than 2 letters (a
 * trailing scrap left by that character cap) are dropped: nothing ever
 * searches for a 1-letter word, so a slice filed under one is a file
 * nobody can ever ask for.
 */
function wordsToFileUnder(row) {
  return [...new Set([...wordsOf(row[0]), ...row[4].split(' ').filter((w) => w.length >= 2)])]
}

/**
 * Turns filing entries into the file tree: splitting a bucket once it is
 * over MAX_PER_SLICE instead of truncating it, so no title is ever dropped
 * (see the module comment up top). Exported on its own, separate from the
 * catalog read below it, so a test can hand it synthetic entries — at
 * production scale (~111k titles) there is no local data to build from,
 * only the local 3.6k-title seed, and projecting the real file count means
 * running this same function over a scaled-up input.
 *
 *   rows — [item, record] pairs, most-popular first (record = the 5-field
 *          array record() returns above).
 *
 * Returns { files: Map<prefix, record[]>, manifest: string[] } — see the
 * getSearchIndex() doc comment below for what each holds.
 */
export function buildTree(rows) {
  // Root buckets: every (row, word) filing entry, grouped by the word's
  // first 2 letters. Insertion order follows `rows`, so it is already
  // popularity order.
  const rootBuckets = new Map()
  for (const [, row] of rows) {
    for (const word of wordsToFileUnder(row)) {
      const key = word.slice(0, 2)
      let bucket = rootBuckets.get(key)
      if (!bucket) {
        bucket = []
        rootBuckets.set(key, bucket)
      }
      bucket.push({ row, word })
    }
  }

  const files = new Map()
  const manifest = []

  // Rows in `entries`, deduplicated by row identity, first occurrence kept
  // (== popularity order, since `rows` was iterated in that order above).
  function uniqueRowsOf(entries) {
    const seen = new Set()
    const out = []
    for (const { row } of entries) {
      if (seen.has(row)) continue
      seen.add(row)
      out.push(row)
    }
    return out
  }

  function resolve(prefix, entries) {
    const unique = uniqueRowsOf(entries)
    if (unique.length <= MAX_PER_SLICE) {
      // Complete leaf: every title reachable through this prefix lives here.
      files.set(prefix, unique)
      return
    }

    // Over the cap: split. `own` is whatever cannot go deeper (the word IS
    // this prefix already); it gets this prefix's file, capped like a flat
    // slice always was. Everything else moves one letter deeper.
    manifest.push(prefix)

    // The client also reads this file while a reader is still typing the word
    // ("sho" before "shonen"), so the exact-length words go first and the
    // rest of the room is filled with the most popular rows from below. Other
    // wise a half-typed word would show "No match" until the next letter.
    const ownEntries = entries.filter(({ word }) => word.length === prefix.length)
    const own = uniqueRowsOf(ownEntries)
    const ownSet = new Set(own)
    const fill = unique.filter((row) => !ownSet.has(row))
    files.set(prefix, [...own, ...fill].slice(0, MAX_PER_SLICE))

    const childBuckets = new Map()
    for (const entry of entries) {
      if (entry.word.length === prefix.length) continue
      const childKey = entry.word.slice(0, prefix.length + 1)
      let bucket = childBuckets.get(childKey)
      if (!bucket) {
        bucket = []
        childBuckets.set(childKey, bucket)
      }
      bucket.push(entry)
    }
    for (const [childKey, childEntries] of childBuckets) {
      resolve(childKey, childEntries)
    }
  }

  for (const [prefix, entries] of rootBuckets) {
    resolve(prefix, entries)
  }

  return { files, manifest }
}

/** [item, record] pairs for the whole catalog, most-popular first. */
function catalogRows() {
  return [
    ...comics.map((c) => [c, record(c, sectionOf(c))]),
    ...novels.map((n) => [n, record(n, 'novel')]),
    ...anime.map((a) => [a, record(a, 'anime')]),
  ].sort((a, b) => (b[0].popularity || 0) - (a[0].popularity || 0))
}

// Computed once per build, on first import; the second page to import this
// module gets the same object back, not a second pass over the catalog.
//
//   files    — Map<prefix, record[]>, one entry per slice file to write.
//   manifest — string[], every prefix that split (has children one letter
//              deeper). Everything else is a complete leaf.
let cached = null
export function getSearchIndex() {
  if (!cached) cached = buildTree(catalogRows())
  return cached
}

export { MAX_PER_SLICE, record, wordsOf, fold }
