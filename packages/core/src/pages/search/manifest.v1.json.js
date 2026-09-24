export const prerender = true
// The manifest for the hierarchical search slices: every prefix that split
// into deeper child slices (see src/lib/search-shards.js). Everything not
// listed here is a complete leaf file — the client (finder-core.js's
// pathFor) only needs to go looking for a deeper file when the prefix it is
// standing on is in this list.
//
// Kept to a plain array of strings on purpose: at production size this is
// still only as many entries as there are busy prefixes, a tiny fraction of
// the catalog, and an array needs no parsing beyond JSON.parse.
import { getSearchIndex } from '../../lib/search-shards.js'

export function GET() {
  const { manifest } = getSearchIndex()
  return new Response(JSON.stringify(manifest), {
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  })
}
