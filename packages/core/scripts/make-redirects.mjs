// Build data/redirects.json: every old id-suffixed URL -> its clean URL.
// Runs before astro build; the redirect worker imports the result.
//
// Two sources feed it. reslugAll() works out the machine-made ones from the
// catalog itself. data/manual-redirects.json holds the hand-written ones: a
// dead address a real reader hit, pointed at the page that answers them. The
// hand-written ones are applied last, so they always win.
//
// This is also the ONE script that writes data/slug-registry.json. It runs
// first in `npm run build`, registers every page the registry has not seen,
// and saves it; make-shards.mjs and catalog.js then read it frozen, so all
// three agree on every slug. REGISTRY_READONLY=1 skips the save (the readers
// then work the same new slugs out in memory, from the same inputs).
// ALIAS_REDIRECTS=0 turns the character alias redirects off.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  reslugAll,
  migrateFanNameSlugs,
  FAN_NAME_MIGRATION,
  migrateSeriesSlugs,
  SERIES_SUFFIX_MIGRATION,
  titleYears,
} from '../src/lib/reslug.mjs'
import { dropBlocked, dropBlockedRows } from '../src/lib/blocked.js'
import { ownedOnly } from '../src/lib/owned.mjs'
import config from '../src/lib/site.mjs'
import { loadRegistry, saveRegistry, newRegistry, registrySize } from '../src/lib/slug-registry.mjs'
import { writeFileAtomic } from '../src/lib/write-atomic.mjs'

// The site being built is the working directory (scripts/build-site.mjs), so
// its data/ and dist/ are found from there, not from this file.
const DATA = join(process.cwd(), 'data')
const read = (p) => JSON.parse(readFileSync(join(DATA, p), 'utf8'))

// Blocked titles leave first, exactly as they do in make-shards.mjs and
// catalog.js. They used to stay in here, so a blocked title still competed
// for a clean slug and could push a live namesake onto its year slug in the
// redirect map while the pages used the plain one.
const comics = ownedOnly(config, dropBlockedRows(dropBlocked(read('comics.json'))))
const anime = ownedOnly(config, dropBlockedRows(dropBlocked(read('anime.json'))))
const characters = read('characters.json')

const readonly = process.env.REGISTRY_READONLY === '1'
const aliases = process.env.ALIAS_REDIRECTS !== '0'

const before = loadRegistry()
const start =
  before ||
  newRegistry({
    runId: process.env.GITHUB_RUN_ID || 'local',
    titles: comics.length + anime.length,
    characterPages: characters.filter((c) => c.image && (c.appearsIn || []).length > 0).length,
  })

// The one-time move of characters to their fan-name slug (see
// migrateFanNameSlugs in reslug.mjs). It runs here, the only writer, before
// the redirects are worked out, so the old slug lands in `past` and redirects
// in this same build. Under REGISTRY_READONLY=1 it is skipped: nothing would
// be saved, so the frozen readers would still build pages on the old slugs
// while this map pointed away from them.
if (!(start.migrations || []).includes(FAN_NAME_MIGRATION)) {
  if (readonly) {
    console.log(`slug registry: ${FAN_NAME_MIGRATION} pending, skipped under REGISTRY_READONLY=1`)
  } else {
    const keep = new Set(read('character-slug-keep.json').slugs)
    const m = migrateFanNameSlugs(characters, start, keep)
    console.log(
      `slug registry: ${FAN_NAME_MIGRATION} ran: ${m.candidates} characters lead with a fan name, ` +
        `moved: ${m.moved}, kept (search impressions or visits): ${m.kept}, ` +
        `skipped (address used by another page): ${m.collided}, skipped (too short or already there): ${m.short}`
    )
    for (const example of m.examples) console.log(`  ${example}`)
  }
}

// The second one-time move: characters on an id slug (/character/luna-5407)
// go to their name plus their story (see migrateSeriesSlugs). After the
// fan-name move, so a character that took its fan name there is no longer on
// an id slug here, and skipped under REGISTRY_READONLY=1 for the same reason.
if (!(start.migrations || []).includes(SERIES_SUFFIX_MIGRATION)) {
  if (readonly) {
    console.log(`slug registry: ${SERIES_SUFFIX_MIGRATION} pending, skipped under REGISTRY_READONLY=1`)
  } else {
    const keep = new Set(read('character-slug-keep.json').slugs)
    const m = migrateSeriesSlugs(characters, start, keep, titleYears(comics, anime))
    console.log(
      `slug registry: ${SERIES_SUFFIX_MIGRATION} ran: ${m.candidates} character pages on an id slug, ` +
        `moved: ${m.moved} (${m.withYear} with the story's year), ` +
        `kept (search impressions or visits): ${m.kept}, ` +
        `skipped (both series slugs used by another page): ${m.collided}, ` +
        `skipped (no usable story name): ${m.noSeries}`
    )
    for (const example of m.examples) console.log(`  ${example}`)
  }
}

const result = reslugAll(comics, anime, characters, { registry: start, aliases })
const { redirects, registry } = result

if (readonly) {
  console.log('slug registry: REGISTRY_READONLY=1, not saved')
} else {
  saveRegistry(registry)
}
console.log(
  `slug registry: ${registrySize(registry)} entries` +
    `${before ? '' : ' (new registry)'}, added: ${result.added}, moved: ${result.moved}, ` +
    `renamed: ${result.renamed}, aliases added: ${result.aliases}`
)

const manual = read('manual-redirects.json')
Object.assign(redirects, manual)

const text = JSON.stringify(redirects)
writeFileAtomic(join(DATA, 'redirects.json'), text)
console.log(
  `redirects.json: ${Object.keys(redirects).length} old URLs mapped ` +
    `(${Object.keys(manual).length} hand-written, ${result.aliasRedirects} character aliases` +
    `${aliases ? '' : ', ALIAS_REDIRECTS=0'}), ${(text.length / 1048576).toFixed(2)} MB`
)
