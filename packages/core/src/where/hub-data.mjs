// BUILD TIME ONLY. The hub lists scripts/make-where.mjs wrote, for the
// prerendered hub pages. Read with readFileSync from the site's data/ (the
// build's working directory), like src/lib/catalog.js, so the bundler never
// turns the file into a module. Read once per build.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

let hubs = null

export function whereHubs() {
  if (!hubs) hubs = JSON.parse(readFileSync(join(process.cwd(), 'data', 'where-hubs.json'), 'utf8'))
  return hubs
}
