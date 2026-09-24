#!/usr/bin/env node
/**
 * A Where site's data build: from the files scripts/where-data.mjs pulled
 * into data/, every page the site has, cut into shards the Worker reads.
 *
 *   cd sites/anime && npm run build      (scripts/build-site.mjs runs this first)
 *
 *   1. gates        src/where/compute.mjs: which titles, people, studios,
 *                   artists and franchises have a page
 *   2. addresses    the slug registry (data/slug-registry.json), the one
 *                   writer of it on a Where site: titles by the core's own
 *                   rule (src/lib/reslug.mjs), entities by
 *                   src/where/entity-slugs.mjs. Frozen: an address once given
 *                   never moves.
 *   3. records      every page's record with its links resolved
 *                   (src/where/linker.mjs), into public/d/<folder>/
 *   4. the rest     hubs, search rows, sitemap list, redirects, the shell's
 *                   numbers and the manifest (src/where/outputs.mjs)
 *
 * Refuses to ship a site clearly smaller than the one live (the live manifest
 * pulled from R2), like the core's shrink guard. ALLOW_SHRINK=1 overrides it.
 */
import { rmSync } from 'node:fs'
import { join } from 'node:path'
import { writeFileAtomic } from '../src/lib/write-atomic.mjs'
import { reslugAll } from '../src/lib/reslug.mjs'
import { loadRegistry, saveRegistry, newRegistry, registrySize, registryHash } from '../src/lib/slug-registry.mjs'
import { TITLE_SHARDS, titleKey } from '../src/lib/shard-key.js'
import { computeWhere } from '../src/where/compute.mjs'
import { byProminence, crewByTitle } from '../src/where/people.mjs'
import { assignSlugs } from '../src/where/entity-slugs.mjs'
import { makeLinker } from '../src/where/linker.mjs'
import { homeBase } from '../src/where/cross.mjs'
import { titleRecord } from '../src/where/record-title.mjs'
import { personRecord, studioRecord, artistRecord, franchiseRecord } from '../src/where/record-entities.mjs'
import { hubsOf, searchRowsOf, pageUrlsOf } from '../src/where/outputs.mjs'
import { hubPaths } from '../src/where/hubs.mjs'
import { WHERE_SHARDS } from '../src/where/shard-folders.mjs'
import { writeShardFolder } from './where-shards.mjs'
import { readData, loadWhereData } from './where-load.mjs'
import config from '../src/lib/site.mjs'

const ROOT = process.cwd()
const DATA = join(ROOT, 'data')
const OUT = join(ROOT, 'public', 'd')
const SHRINK_LIMIT = 0.02
// The site's own pages that are not entity pages; the sitemap lists them.
const EXTRA_PAGES = ['/about', '/contact', '/privacy', '/dmca']

const read = (name, empty) => readData(DATA, name, empty)
const write = (name, value) => writeFileAtomic(join(DATA, name), JSON.stringify(value))

let mark = Date.now()
const since = (label) => {
  console.log(`  ${label}: ${((Date.now() - mark) / 1000).toFixed(1)}s`)
  mark = Date.now()
}

/** Every page's address. Titles by the core's rule, the rest by the entity rule; new ones registered. */
function address(where, registry) {
  const items = where.titles.map((t) => t.item)
  const { redirects } = reslugAll([], items, [], { registry })
  const title = new Map(items.map((item) => [item.id, item.slug]))
  const withPage = [...where.people.values()].filter((p) => where.pages.voice.has(p.id) || where.pages.staff.has(p.id)).sort(byProminence)
  const person = assignSlugs(registry, 'person', withPage, { keyOf: (p) => `p:${p.id}`, namesOf: (p) => [p.name] })
  const studios = [...where.studios.values()].filter((s) => where.pages.studio.has(s.id)).sort((a, b) => b.titleIds.length - a.titleIds.length || a.id - b.id)
  const studio = assignSlugs(registry, 'studio', studios, { keyOf: (s) => `s:${s.id}`, namesOf: (s) => [s.name, `${s.name} studio`] })
  const artists = [...where.artists.values()].filter((a) => where.pages.artist.has(a.key)).sort((a, b) => b.songs.length - a.songs.length || a.key.localeCompare(b.key))
  const artist = assignSlugs(registry, 'artist', artists, { keyOf: (a) => `a:${a.key}`, namesOf: (a) => [a.key, `${a.key} songs`] })
  const byId = new Map(items.map((item) => [item.id, item]))
  const franchises = [...where.franchises.values()].filter((f) => where.pages.watch.has(f.anchorId)).sort((a, b) => b.ids.length - a.ids.length || a.anchorId - b.anchorId)
  const watch = assignSlugs(registry, 'watch-order', franchises, {
    keyOf: (f) => `f:${f.anchorId}`,
    namesOf: (f) => [f.name, `${f.name} ${byId.get(f.anchorId)?.startYear || ''}`],
  })
  const unkey = (map) => new Map([...map].map(([key, slug]) => [key.slice(2), slug]))
  const numeric = (map) => new Map([...map].map(([key, slug]) => [Number(key.slice(2)), slug]))
  return {
    redirects,
    slugs: { title, person: numeric(person.slugs), studio: numeric(studio.slugs), artist: unkey(artist.slugs), watch: numeric(watch.slugs) },
    lists: { people: withPage, studios, artists, franchises },
    added: person.added + studio.added + artist.added + watch.added,
  }
}

function guardAgainstShrink(manifest) {
  if (process.env.ALLOW_SHRINK) return console.log('  ALLOW_SHRINK is set: the shrink guard is off for this build.')
  const live = read('live-manifest.json', null)
  if (!live) return console.log('  no live manifest to compare against; shrink guard skipped')
  for (const key of ['titles', 'people']) {
    if (!live[key] || manifest[key] >= live[key] * (1 - SHRINK_LIMIT)) continue
    console.error(`SHRINK GUARD: ${key} fell from ${live[key]} live to ${manifest[key]} in this build. Refusing to build.`)
    console.error('Pages that exist today would 404 tomorrow. If the drop is intended, run again with ALLOW_SHRINK=1.')
    process.exit(1)
  }
  console.log(`  shrink guard ok: titles ${live.titles} -> ${manifest.titles}, people ${live.people} -> ${manifest.people}`)
}

function main() {
  const data = loadWhereData(DATA)
  since('read data')
  const where = computeWhere(config, data)
  since('gates')

  const registry = loadRegistry() || newRegistry({ runId: process.env.GITHUB_RUN_ID || 'local', titles: where.titles.length })
  const { redirects, slugs, lists, added } = address(where, registry)
  since('addresses')

  const titleById = new Map(where.titles.map((t) => [t.item.id, t.item]))
  const franchiseOf = new Map()
  for (const f of where.franchises.values()) for (const id of f.ids) franchiseOf.set(id, f)
  const ctx = {
    link: makeLinker(slugs, where.pages),
    pages: where.pages,
    credits: data.credits,
    staff: data.staff,
    cast: data.cast,
    themes: data.themes,
    titleById,
    franchiseOf,
    crewByTitle: crewByTitle(where.people),
    cross: { base: homeBase(config), home: data.home, cast: data.cast, comicsById: new Map(data.comics.map((c) => [c.id, c])) },
  }
  const titles = where.titles.map((t) => titleRecord(t, ctx))
  const people = lists.people.map((p) => personRecord(p, slugs.person.get(p.id), ctx))
  const studios = lists.studios.map((s) => studioRecord(s, slugs.studio.get(s.id), ctx))
  const artists = lists.artists.map((a) => artistRecord(a, slugs.artist.get(a.key), ctx))
  const watch = lists.franchises.map((f) => franchiseRecord(f, slugs.watch.get(f.anchorId), ctx))
  since('records')

  rmSync(OUT, { recursive: true, force: true })
  const sizes = {
    titles: writeShardFolder(join(OUT, 't'), titles.map((r) => [titleKey('anime', r.slug), r]), TITLE_SHARDS),
    people: writeShardFolder(join(OUT, WHERE_SHARDS.person.folder), people.map((r) => [r.slug, r]), WHERE_SHARDS.person.count),
    studios: writeShardFolder(join(OUT, WHERE_SHARDS.studio.folder), studios.map((r) => [r.slug, r]), WHERE_SHARDS.studio.count),
    artists: writeShardFolder(join(OUT, WHERE_SHARDS.artist.folder), artists.map((r) => [r.slug, r]), WHERE_SHARDS.artist.count),
    watch: writeShardFolder(join(OUT, WHERE_SHARDS.watch.folder), watch.map((r) => [r.slug, r]), WHERE_SHARDS.watch.count),
  }
  since('shards')

  const hubs = hubsOf({ titles, people, studios, artists, watch, where, airing: data.airing?.schedule || [] })
  write('where-hubs.json', hubs)
  write('search-rows.json', searchRowsOf(titles))
  write('page-urls.json', pageUrlsOf({ titles, people, studios, artists, watch, hubs, extra: EXTRA_PAGES }))
  // The page shell reads this small file: the numbers it shows, and the hubs
  // whose gate kept them out this time, so no menu or footer link names a 404.
  const built = new Set(hubPaths(hubs).map((p) => p.path))
  const missing = ['/schedule', '/season', '/genre'].filter((path) => !built.has(path))
  write('site-stats.json', { comics: 0, anime: titles.length, genres: [], missing })
  write('redirects.json', { ...redirects, ...read('manual-redirects.json', {}) })

  const manifest = {
    titleShards: TITLE_SHARDS,
    titles: titles.length,
    people: people.length,
    studios: studios.length,
    artists: artists.length,
    watchOrders: watch.length,
    builtAt: Date.now(),
    slugs: { entries: registrySize(registry), hash: registryHash(registry) },
  }
  guardAgainstShrink(manifest)
  saveRegistry(registry)
  write('shards.json', manifest)
  writeFileAtomic(join(OUT, 'manifest.json'), JSON.stringify(manifest))

  const mb = (n) => `${(n / 1048576).toFixed(1)} MB`
  for (const [name, s] of Object.entries(sizes)) console.log(`${name.padEnd(8)} ${s.records} records in ${s.files} shards, ${mb(s.bytes)}, biggest file ${mb(s.biggest)}`)
  console.log(`gates      ${JSON.stringify(where.counts)}`)
  console.log(`registry   ${registrySize(registry)} entries (${added} new entity addresses), ${Object.keys(redirects).length} redirects`)
}

main()
