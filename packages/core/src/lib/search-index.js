// BUILD TIME ONLY. The search slices and manifest for this site, built once.
//
// Where the rows come from depends on the site, and the choice is made by the
// integration, not here: `virtual:search-source` is src/lib/search-source-
// catalog.js for a site built from the catalog, and search-source-where.js
// for a Where site. A bundler follows every import it can see, even one that
// never runs, so a runtime `if` would still pull the catalog into a Where
// build; the virtual module keeps the other source out of the graph entirely.
import { sourceRows } from 'virtual:search-source'
import { buildTree } from './search-shards.js'

// Computed once per build, on first call; the second page to ask gets the
// same promise back, not a second pass over the rows.
//
//   files    — Map<prefix, record[]>, one entry per slice file to write.
//   manifest — string[], every prefix that split (has children one letter
//              deeper). Everything else is a complete leaf.
let cached = null
export function getSearchIndex() {
  if (!cached) cached = Promise.resolve(sourceRows()).then(buildTree)
  return cached
}
