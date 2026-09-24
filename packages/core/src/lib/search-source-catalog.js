// BUILD TIME ONLY. A catalog site's search rows (see src/lib/search-index.js).
import { comics, novels, anime } from './catalog.js'
import { sectionOf } from './section.mjs'
import { record } from './search-shards.js'

/** [item, record] pairs for the whole catalog, most-popular first. */
export function sourceRows() {
  return [
    ...comics.map((c) => [c, record(c, sectionOf(c))]),
    ...novels.map((n) => [n, record(n, 'novel')]),
    ...anime.map((a) => [a, record(a, 'anime')]),
  ].sort((a, b) => (b[0].popularity || 0) - (a[0].popularity || 0))
}
