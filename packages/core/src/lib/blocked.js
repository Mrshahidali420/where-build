/**
 * Titles the site owner removed for good, read from data/block.json.
 *
 * Why this file exists: the catalog is rebuilt from AniList every night, so a
 * page deleted by hand is back the next morning. The AniList id is the one key
 * that never changes, so the removal is a list, and the list is checked in all
 * three places a title can reach a reader:
 *
 *   1. scripts/anilist-core.mjs  - the nightly ingest, before anything is saved
 *   2. src/lib/catalog.js        - the pages built at build time
 *   3. scripts/make-shards.mjs   - the shards the Worker reads at request time
 *
 * A push-only deploy does not run the ingest, so steps 2 and 3 are what make a
 * new block take effect on the very next deploy instead of the next night.
 *
 * To remove a title: put its AniList id in data/block.json, say why, deploy.
 * Its title page, its sub-pages, its sitemap rows and its relation rows on
 * other titles all go. The old URLs then answer 404, which is what tells a
 * search engine the page is gone.
 */
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

// Resolved from the working directory for the same reason catalog.js is: this
// module is bundled into dist/_worker.js before the prerender step runs it.
const FILE = join(process.cwd(), 'data', 'block.json')

export const BLOCKED_MEDIA = (() => {
  if (!existsSync(FILE)) return new Set()
  try {
    const raw = JSON.parse(readFileSync(FILE, 'utf8'))
    return new Set((raw.media || []).map(Number).filter(Number.isInteger))
  } catch (error) {
    throw new Error(`data/block.json is not valid JSON: ${error.message}`)
  }
})()

/** The same list without the blocked ids. Returns the input when nothing is blocked. */
export function dropBlocked(items) {
  if (!BLOCKED_MEDIA.size) return items
  return items.filter((item) => !BLOCKED_MEDIA.has(item.id))
}

/**
 * Strip rows that point at a blocked title. A relation or recommendation row
 * carries only an id, so without this a removed title is still named on every
 * page that links to it.
 */
export function dropBlockedRows(items) {
  if (!BLOCKED_MEDIA.size) return items
  for (const item of items) {
    if (item.relations) item.relations = item.relations.filter((r) => !BLOCKED_MEDIA.has(r.id))
    if (item.recommendations) item.recommendations = item.recommendations.filter((r) => !BLOCKED_MEDIA.has(r.id))
  }
  return items
}
