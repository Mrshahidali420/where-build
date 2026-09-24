/**
 * The files scripts/where-data.mjs pulled into a Where site's data/, read
 * once, blocked titles already out. scripts/make-where.mjs builds from this
 * and scripts/count-pages.mjs counts from it, so both see the same data.
 */
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { dropBlocked, dropBlockedRows } from '../src/lib/blocked.js'

/** One data/ file. With no `empty`, a missing file stops the run with the fix. */
export function readData(dir, name, empty) {
  const file = join(dir, name)
  if (!existsSync(file)) {
    if (empty === undefined) throw new Error(`data/${name} is missing: run scripts/where-data.mjs pull first`)
    return empty
  }
  return JSON.parse(readFileSync(file, 'utf8'))
}

export function loadWhereData(dir) {
  return {
    anime: dropBlockedRows(dropBlocked(readData(dir, 'anime.json'))),
    credits: readData(dir, 'credits.json', {}),
    staff: readData(dir, 'staff.json', {}),
    airing: readData(dir, 'airing.json', { schedule: [], history: {} }),
    themes: readData(dir, 'themes.json', { byAnilistId: {} }).byAnilistId || {},
    cast: readData(dir, 'cast.json', {}),
    comics: readData(dir, 'linked-comics.json', []),
    home: readData(dir, 'home-registry.json', { t: {}, c: {} }),
  }
}
