export const prerender = true
// One header search box used to fetch one file holding every title. At
// 107,036 titles that file was 28 MB: over Cloudflare's 25 MB asset limit,
// and far too much for a phone to download to type in a box.
//
// The index is cut into slices keyed by the first letters of a word, and a
// title is filed under EVERY word (>= 2 letters) in its title and alternate
// names, not just the first — so "god" still finds "Tower of God", and a
// one-letter-first-word title like "I'm Standing on a Million Lives" is
// still reachable once the client (finder-core.js's pathFor) picks a later
// word to search on.
//
// A busy 2-letter prefix ("ha", "th", "so"...) can outgrow a single file at
// production size. Rather than truncate and silently drop the less popular
// titles under it, that prefix SPLITS into 3-letter (then 4-letter, and so
// on) child slices, so every title stays findable by an exact search of its
// own title. See src/lib/search-shards.js for the build and
// src/lib/finder-core.js's pathFor() for how the client walks down to the
// right file — the two must agree, or a query lands on a file the build
// never wrote.
import { getSearchIndex } from '../../lib/search-shards.js'

export function getStaticPaths() {
  const { files } = getSearchIndex()
  return [...files.keys()].map((prefix) => ({ params: { prefix } }))
}

export function GET({ params }) {
  const { files } = getSearchIndex()
  return new Response(JSON.stringify(files.get(params.prefix) || []), {
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  })
}
