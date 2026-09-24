// Shared pure logic for the header search box (src/layouts/Base.astro) and
// the full results page (src/pages/search.astro). Kept in one module so the
// two never drift out of sync with each other, or with the build side that
// files titles into slices (src/lib/search-shards.js, served by
// src/pages/search/[prefix].json.js and src/pages/search/manifest.v1.json.js).
//
// This runs in the browser: both callers pull it in from a plain (non
// is:inline) <script>, which Astro/Vite bundles as an ES module, so the
// import works like any other module import.

// Accents fold away, apostrophes vanish entirely ("I'll" -> "ill", matching
// a typed "ill"), and every other punctuation mark becomes a space. This
// MUST behave identically to the fold() in src/lib/search-shards.js: that
// build decides which slice a title is filed under with its copy, this one
// decides which slice to fetch and how to match rows inside it. If the two
// drift, a match here can land in a slice the build never filed it into.
export const fold = (text) =>
  text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[’‘'`]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()

/**
 * Which word of the (already folded) query decides which slice to fetch:
 * the longest word that is at least 2 letters long.
 *
 * A slice keeps only its most popular rows once it is a leaf's own file
 * (see pathFor() below), and a common word like "the" fills its slice with
 * titles the reader did not mean, so a less popular "the ..." title might
 * not be the one that floats to the top. Every word of a title is filed
 * (see search-shards.js), so any word the reader typed finds it; the
 * longest word is the one whose slice is least likely to be crowded out.
 *
 * A query whose first word is a single letter — "I'm Standing on a Million
 * Lives" folds to "im standing on a million lives" — has to skip past "i"
 * or it lands on a slice nothing was ever filed under.
 */
export function longestWord(needle) {
  return (
    needle
      .split(/\s+/)
      .filter((w) => w.length >= 2)
      .sort((a, b) => b.length - a.length)[0] || ''
  )
}

/**
 * Walks a query word down the hierarchical slice tree to the file that
 * actually holds it. `splitPrefixes` is the manifest at /search/manifest.v1.json
 * (see loadManifest()) — the set of prefixes that outgrew a single file and
 * split into one-letter-deeper children (see src/lib/search-shards.js).
 *
 * Starting at the word's first 2 letters: if that prefix never split, its
 * file is complete — stop there. If it did split, and the word has a
 * letter beyond the current depth, move one letter deeper and check again.
 * If the word runs out exactly at a split prefix (the typed word IS that
 * prefix, e.g. "ha" once "ha" has split, or any other 2-letter word), stop
 * there too — that prefix's own file is the best-effort, capped one
 * described in search-shards.js, and there is nowhere deeper for a word
 * that short to go until the reader types more.
 *
 * This MUST walk the same way the build split (see resolve() in
 * search-shards.js), or a query can be sent to a file the build never
 * wrote for it.
 */
export function pathFor(word, splitPrefixes) {
  let depth = 2
  while (word.length > depth && splitPrefixes.has(word.slice(0, depth))) {
    depth += 1
  }
  return word.slice(0, depth)
}

/**
 * The file to search for a whole query. Every word of a title is filed, so
 * any query word finds it, but not every file is complete: a split prefix's
 * own file is capped. So a word that ends in a complete file wins over one
 * that ends in a capped file ("the one": "one" beats "the"), and among
 * equals the longest word wins, as before.
 */
export function slicePathFor(needle, splitPrefixes) {
  const words = needle
    .split(/\s+/)
    .filter((w) => w.length >= 2)
    .sort((a, b) => b.length - a.length)
  if (!words.length) return ''
  const paths = words.map((w) => pathFor(w, splitPrefixes))
  return paths.find((p) => !splitPrefixes.has(p)) || paths[0]
}

/** A slice's row is folded once, when it arrives, and never again. Folding
 * every row on every keypress is what made the box feel slow on a phone.
 * Each row grows two fields: the folded title, and the folded title plus
 * alternate names as one string to test against.
 */
export function prepare(rows) {
  for (const row of rows) {
    const folded = fold(row[0])
    row[5] = folded
    row[6] = row[4] ? folded + ' ' + row[4] : folded
  }
  return rows
}

// Records carry only the cover file name. Every cover of the same kind
// shares this address, so repeating it on every record would be waste.
const COVER_BASE = 'https://s4.anilist.co/file/anilistcdn/media/'

/** A record's `kind` (from its url, e.g. "/manhwa/..." -> "manhwa") maps to
 * one of two cover folders AniList actually serves from. The header dropdown
 * draws a thumbnail and keeps 'small'; the results page draws a full card and
 * asks for 'medium'. Only the folder changes between sizes. */
export function coverUrl(kind, cover, size = 'small') {
  if (cover.includes('://')) return size === 'small' ? cover : cover.replace('/small/', `/${size}/`)
  return `${COVER_BASE}${kind === 'anime' ? 'anime' : 'manga'}/cover/${size}/${cover}`
}

export const escapeHtml = (text) =>
  String(text).replace(
    /[&<>"]/g,
    (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[ch],
  )

// A slice fetch that fails outright — offline, DNS, an interrupted mobile
// connection mid-download — used to reject on the first try and show the
// error row straight away. On a phone that first hiccup is common and the
// retry usually just works, so try twice more, with a short backoff, before
// giving up. A 404 is never a failure: it means nothing in the catalog has
// a word starting with those letters, which is a legitimate empty result,
// and is never retried.
const RETRY_DELAYS_MS = [300, 900]

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function fetchJsonWithRetry(url) {
  let lastError
  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
    try {
      const res = await fetch(url, { cache: 'default' })
      if (res.status === 404) return []
      if (!res.ok) throw new Error(`${url}: ${res.status}`)
      return await res.json()
    } catch (err) {
      lastError = err
      if (attempt < RETRY_DELAYS_MS.length) await sleep(RETRY_DELAYS_MS[attempt])
    }
  }
  throw lastError
}

// prefix -> a promise for that slice's records. Shared module-wide, so the
// header box and the results page never fetch the same slice twice when
// both are on the same page (the search page carries both).
const slices = new Map()

export function isSliceLoaded(prefix) {
  return slices.has(prefix)
}

export function loadSlice(prefix) {
  let job = slices.get(prefix)
  if (!job) {
    // A rejected job is not cached: the next keystroke or a "Try again"
    // click must retry, not stay stuck on a dead promise forever.
    job = fetchJsonWithRetry(`/search/${prefix}.json`)
      .then(prepare)
      .catch((err) => {
        slices.delete(prefix)
        throw err
      })
    slices.set(prefix, job)
  }
  return job
}

// The manifest is tiny and fetched once; same retry-then-cache shape as a
// slice, minus the per-row prepare() step.
let manifestJob = null

export function isManifestLoaded() {
  return manifestJob !== null
}

export function loadManifest() {
  if (!manifestJob) {
    manifestJob = fetchJsonWithRetry('/search/manifest.v1.json')
      .then((list) => new Set(Array.isArray(list) ? list : []))
      .catch((err) => {
        manifestJob = null
        throw err
      })
  }
  return manifestJob
}

/**
 * Every word of the (already folded) query must appear; better matches
 * float up: exact title, then title-starts-with, then word-starts-with,
 * then substring. Ties keep the slice's popularity order (rows are written
 * most-popular first, and sort() is stable) — that is why no popularity is
 * stored.
 *
 * `rows` must already be prepare()d (row[5]/row[6] present). Returns EVERY
 * matching row, ranked — callers decide how many to show.
 */
export function rankMatches(rows, needle) {
  const words = needle.split(/\s+/).filter(Boolean)
  const scored = []
  for (const row of rows) {
    const title = row[5]
    const hay = row[6]
    if (!words.every((w) => hay.includes(w))) continue
    let score = 1
    if (title === needle) score = 4
    else if (title.startsWith(needle)) score = 3
    else if (hay.includes(' ' + needle) || hay.startsWith(needle)) score = 2
    scored.push([score, row])
  }
  scored.sort((a, b) => b[0] - a[0])
  return scored.map((x) => x[1])
}

/**
 * Runs a full query end to end: fold it, pick the word to search on, walk
 * the manifest to the right slice, load it, and rank every match. Shared so
 * the header dropdown and the /search page can never disagree about what a
 * query matches — only how many rows they choose to show.
 *
 * Throws whatever loadManifest()/loadSlice() throws after their retries are
 * exhausted; callers show the error state and offer "Try again", which just
 * calls this again (a failed slice/manifest job is never cached).
 */
export async function runSearch(q) {
  const needle = fold(q)
  if (needle.length < 2) return { needle, matches: [] }

  const word = longestWord(needle)
  if (!word) return { needle, matches: [] }

  const splitPrefixes = await loadManifest()
  const prefix = slicePathFor(needle, splitPrefixes)
  const rows = await loadSlice(prefix)
  // A split prefix's own file holds only its most popular rows, so its match
  // count is not the whole catalog's. The caller says so instead of a number.
  return { needle, matches: rankMatches(rows, needle), partial: splitPrefixes.has(prefix) }
}

// A search that found nothing is the one search whose words we keep: it names
// a title people want and the index does not hold yet. The words pass through
// here in the page AND again in the Worker (src/lib/beacon-rows.js), because a
// page can be changed by anyone who opens the developer tools.
//
// People type odd things into a box. Anything that looks like an e-mail
// address, a link or a phone number is thrown away whole, never trimmed and
// kept: an empty answer means "send nothing".
const WORDS_MIN = 2
const WORDS_MAX = 40
// A title can hold a year or a volume number. Five digits in a row, even with
// spaces, dots or dashes between them, is a phone number or an order number.
const LONG_NUMBER = /\d{5,}/
const LINK_BITS = /@|https?:|www\.|\/|\\|[a-z0-9-]\.(com|net|org|io|co|me|ly|gg|tv|app|xyz|info|to|cc|uk|de|jp)\b/i

/** The words of a search, cleaned for keeping, or '' when they must not be kept. */
export function normalizeQuery(q) {
  const raw = String(q == null ? '' : q).toLowerCase().trim()
  if (!raw || raw.length > 200) return ''
  if (LINK_BITS.test(raw)) return ''
  const joined = raw.replace(/(\d)[\s\-.()+_/]+(?=\d)/g, '$1')
  if (LONG_NUMBER.test(joined)) return ''
  const words = fold(raw).replace(/\s+/g, ' ')
  if (words.length < WORDS_MIN || words.length > WORDS_MAX) return ''
  return words
}
