// BUILD TIME ONLY. A Where site's search rows (see src/lib/search-index.js).
//
// A Where site builds only the titles that passed its own gate, so its build
// (scripts/make-where.mjs) writes the records ready-made, most-popular first,
// to data/search-rows.json. A title that has no page is never in the box.
// Read with readFileSync: a JSON import is slow at this size.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

export function sourceRows() {
  const rows = JSON.parse(readFileSync(join(process.cwd(), 'data', 'search-rows.json'), 'utf8'))
  return rows.map((row) => [null, row])
}
