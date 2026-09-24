#!/usr/bin/env node
/**
 * Make sure data/slug-registry.json exists before anything changes the catalog.
 *
 * Runs in CI after the caches and the R2 snapshot are restored and BEFORE the
 * ingest, so the catalog it reads is the one the live site was built from.
 * That matters on the very first run: the registry is then worked out from
 * that catalog with the old popularity rule, which gives exactly the slugs
 * that are live today, and from then on they are frozen.
 *
 *   registry on disk          -> nothing to do (a corrupt one fails loudly)
 *   no registry, the live manifest says one shipped before
 *                             -> the registry was LOST (cache and R2 both
 *                                gone). Work it out again from today's
 *                                catalog so the build can go on, write the
 *                                marker data/slug-registry.recovered so CI
 *                                does not save the stand-in over a good copy,
 *                                and raise an error annotation. Dispatch the
 *                                workflow with accept_registry to adopt it.
 *   no registry, none shipped -> first run. Refuse when the catalog on disk is
 *                                clearly smaller than the live site (a seed
 *                                fallback): freezing slugs from the seed would
 *                                pin the wrong winners forever. Otherwise
 *                                build the registry and save it.
 *
 * Locally, with no saved live manifest, it simply builds the registry.
 *
 * A rebuild no longer gives exactly the pre-registry slugs: a character whose
 * page leads with the fan-searched name now gets its slug from that name (see
 * reslug.mjs). The live registry is already bootstrapped, so this only
 * matters for an accept_registry rebuild, which is a deliberate owner action.
 */
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { reslugAll } from '../src/lib/reslug.mjs'
import { dropBlocked, dropBlockedRows } from '../src/lib/blocked.js'
import {
  REGISTRY_FILE,
  RECOVERED_MARKER,
  loadRegistry,
  saveRegistry,
  newRegistry,
  registrySize,
} from '../src/lib/slug-registry.mjs'
import { writeFileAtomic } from '../src/lib/write-atomic.mjs'

const DATA = join(process.cwd(), 'data')
const LIVE_MANIFEST_FILE = join(DATA, 'live-manifest.json')
// The same 2% the build's shrink guard allows.
const SEED_TOLERANCE = 1.02

const read = (name) => JSON.parse(readFileSync(join(DATA, name), 'utf8'))
const inCi = !!process.env.GITHUB_ACTIONS

function fail(message) {
  console.error(inCi ? `::error::${message}` : `ERROR: ${message}`)
  process.exit(1)
}

function readLiveManifest() {
  if (!existsSync(LIVE_MANIFEST_FILE)) return null
  try {
    return JSON.parse(readFileSync(LIVE_MANIFEST_FILE, 'utf8'))
  } catch (error) {
    console.log(`live manifest unreadable (${error.message}); treating it as missing`)
    return null
  }
}

/** The catalog as the build will see it: blocked titles out, as everywhere. */
function loadCatalog() {
  const comics = dropBlockedRows(dropBlocked(read('comics.json')))
  const anime = dropBlockedRows(dropBlocked(read('anime.json')))
  const characters = read('characters.json')
  const characterPages = characters.filter((c) => c.image && (c.appearsIn || []).length > 0).length
  return { comics, anime, characters, titles: comics.length + anime.length, characterPages }
}

function build(catalog) {
  const registry = newRegistry({
    runId: process.env.GITHUB_RUN_ID || 'local',
    titles: catalog.titles,
    characterPages: catalog.characterPages,
  })
  // Aliases are left to make-redirects.mjs; this step only freezes the pages.
  reslugAll(catalog.comics, catalog.anime, catalog.characters, { registry })
  saveRegistry(registry)
  return registry
}

function main() {
  if (existsSync(REGISTRY_FILE)) {
    let registry
    try {
      registry = loadRegistry()
    } catch (error) {
      fail(`${error.message}. Delete it only if the cache and R2 hold a good copy.`)
    }
    console.log(`slug registry present: ${registrySize(registry)} entries, nothing to do`)
    return
  }

  const live = readLiveManifest()
  const catalog = loadCatalog()

  if (live?.slugs?.entries) {
    if (process.env.ACCEPT_REGISTRY === '1') {
      const registry = build(catalog)
      console.log(
        `::warning::Slug registry was missing and has been rebuilt with ${registrySize(registry)} entries ` +
          `(the live site had ${live.slugs.entries}). accept_registry is set, so it will be saved.`
      )
      return
    }
    // Stop the run. A stand-in worked out from today's popularity could move
    // pages, and since it could not be saved, the next night would work out
    // another one and move them again: exactly what the registry exists to
    // prevent. A stale site with stable addresses beats a fresh one whose
    // addresses shuffle every night. The live site keeps serving meanwhile.
    writeFileAtomic(RECOVERED_MARKER, new Date().toISOString() + '\n')
    fail(
      `The slug registry is LOST: the live site was built from one with ${live.slugs.entries} ` +
        `entries (hash ${live.slugs.hash}) but neither the Actions cache nor R2 had it. Nothing was ` +
        'built or deployed. Restore data/slug-registry.json from R2 (daily/...), or run this workflow ' +
        'by hand with accept_registry = 1 to rebuild it from today\'s catalog and keep it.'
    )
  }

  if (live) {
    const titlesShort = live.titles > catalog.titles * SEED_TOLERANCE
    const pagesShort = live.characterPages > catalog.characterPages * SEED_TOLERANCE
    if (titlesShort || pagesShort) {
      fail(
        `Refusing to build the first slug registry: the live site has ${live.titles} titles and ` +
          `${live.characterPages} character pages, the catalog on disk only ${catalog.titles} and ` +
          `${catalog.characterPages}. This looks like the seed copy standing in for a lost cache, and ` +
          'freezing its slugs would pin the wrong pages forever. Restore the catalog first.'
      )
    }
  } else if (inCi) {
    console.log('::warning::No saved live manifest to check the catalog against; building the first slug registry anyway.')
  }

  const registry = build(catalog)
  console.log(
    `slug registry bootstrapped: ${registrySize(registry)} entries from ${catalog.titles} titles ` +
      `and ${catalog.characterPages} character pages`
  )
}

main()
