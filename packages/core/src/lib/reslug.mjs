/**
 * Clean public slugs.
 *
 * The raw data carries AniList ids in every slug (solo-leveling-105398).
 * Public URLs must not expose database ids, so at load time every slug
 * is stripped to its clean form. Collisions inside one URL namespace are
 * resolved by popularity: the most popular title keeps the clean slug,
 * the rest get the first-release year, and only as a last resort does a
 * title keep its original id slug. Characters have no year, so losing
 * duplicates keep their id slug.
 *
 * THE REGISTRY. Popularity moves every night, so working the slugs out from
 * scratch on every build let two namesakes swap addresses the day the loser
 * overtook the winner, and an indexed URL started showing a different book.
 * Now the first slug a page is given is written to data/slug-registry.json
 * (see slug-registry.mjs) and kept for good. The popularity rule above only
 * decides the slug of a page the registry has never seen. Handed-out slugs,
 * old id slugs, earlier addresses and alias addresses are all reserved
 * forever, so nothing new can ever take an address that once meant something
 * else.
 *
 * With an empty registry this used to give exactly the slugs the old code
 * gave, which is how the first registry was built from the live site without
 * moving a single page. It no longer quite does: a NEW Korean or Chinese
 * character whose page leads with the fan-searched name ("Sung Jin-Woo", see
 * names.mjs) now gets its slug from that name, not from AniList's Western
 * order. So an empty-registry rebuild differs from the old slugs for those
 * characters. That is acceptable: the live registry was bootstrapped on
 * 22 Sep 2026 and is never rebuilt, except by the owner on purpose with
 * accept_registry, which already accepts that some pages may move.
 *
 * FAN-NAME MIGRATION. Characters registered before that rule came in were
 * moved once to their fan-name slug by migrateFanNameSlugs() below, run by
 * make-redirects.mjs, except pages that already had search impressions or
 * visits (data/character-slug-keep.json).
 *
 * SERIES SLUGS. A character whose name was taken used to keep its id slug
 * (/character/luna-5407). Now it tries its name plus its lead story first
 * (/character/luna-sailor-moon), then that plus the story's year, and only
 * then the id slug. Characters registered before that rule were moved once by
 * migrateSeriesSlugs(), with the same keep list protecting earned pages.
 *
 * Returns the 301 map { "/manhwa/solo-leveling-105398": "/manhwa/solo-leveling", ... }
 * consumed by the redirect worker, plus the (possibly grown) registry.
 */

import { sectionOf, READ_SECTIONS } from './section.mjs'
import { slugify } from './slugify.mjs'
import { displayName } from './names.mjs'

export const comicKind = sectionOf

const stripId = (slug) => slug.replace(/-\d+$/, '')

// How many of the most-loved characters get their other names as redirects
// (/character/eren-jaeger -> /character/eren-yeager). The whole redirect map is
// bundled into the Worker code, so this stays capped. make-redirects prints
// the size of redirects.json on every build so growth is visible.
const ALIAS_TOP = 3000
// Two letters is not a name anyone searches for, and it would reserve a very
// short address forever.
const ALIAS_MIN_LENGTH = 3

// Recorded in registry.migrations once the one-time move has run, so it never
// runs twice and a moved page is never moved again.
export const FAN_NAME_MIGRATION = 'fan-name-slugs-1'
// The second one-time move: characters stuck on their id slug (/character/luna-5407)
// go to a slug that names their story (/character/luna-sailor-moon). See
// migrateSeriesSlugs below. Runs after FAN_NAME_MIGRATION, never before it.
export const SERIES_SUFFIX_MIGRATION = 'series-suffix-slugs-1'

// A story name in a URL is there to tell namesakes apart, not to be read in
// full. "Tensei Shitara Slime Datta Ken" says it in five words; forty letters
// keeps the whole address short enough to read in a search result.
const SERIES_MAX_WORDS = 5
const SERIES_MAX_LENGTH = 40
// Words a cut series name must not end on.
const TRAILING_FILLER = new Set([
  'the', 'a', 'an', 'of', 'to', 'as', 'in', 'on', 'at', 'and', 'or', 'for', 'with', 'my', 'i', 'is',
  'from', 'by', 'episode', 'season', 'part', 'vol', 'volume',
])

/**
 * The slug of the name a character page leads with, when that is the fan
 * form ("sung-jin-woo" for AniList's "Jin-U Seong"). Empty when the page leads
 * with AniList's own full name, or when the fan form makes too short a slug.
 */
function fanSlugOf(person) {
  const { primary, formal } = displayName(person)
  if (!formal) return ''
  const slug = slugify(primary)
  return slug.length >= ALIAS_MIN_LENGTH ? slug : ''
}

// Most appearances first. The order characters claim slugs in, both in
// reslugAll and in the migration, so the same character wins in both.
const byAppearances = (a, b) => (b.appearsIn?.length || 0) - (a.appearsIn?.length || 0)

/**
 * The title a character page is about: a MAIN role before a supporting one,
 * and a comic before its anime. The same pick character/[slug].astro makes
 * with `ranked` and `order` (outside its TITLE_TEST), so the story named in a
 * character's URL and in the namesake list is the one its page leads with.
 */
export function leadAppearance(person) {
  const rows = person?.appearsIn || []
  const main = rows.filter((a) => a.role === 'MAIN')
  const pool = main.length ? main : rows
  return pool.find((a) => a.kind !== 'anime') || pool[0] || null
}

/**
 * startYear by the id slug the ingest wrote, for every title. A character's
 * appearance rows carry that same slug but no year, and the year is the last
 * way to tell two namesakes in one story's name apart.
 */
export function titleYears(comics, anime) {
  const years = new Map()
  for (const title of [...comics, ...anime]) if (title.startYear) years.set(title.slug, title.startYear)
  return years
}

/** The story part of a series slug: at most five words and forty letters, no leading "the". */
function seriesPartOf(title) {
  // Only the main name: a subtitle after ": " or " - " is not what anyone
  // types ("Umineko: When They Cry" is searched as "umineko").
  const main = String(title || '').split(/: | - | – /)[0]
  // Words are the title's own words, counted before slugify splits them, so
  // "Haven't" is one word and not two. Apostrophes go, so it reads "havent",
  // and "Hell's Paradise" reads "hells-paradise", not "hell-s-paradise".
  let words = main
    .split(/\s+/)
    .map((word) => slugify(word.replace(/['’]/g, '')))
    .filter(Boolean)
  if (words[0] === 'the') words = words.slice(1)
  words = words.slice(0, SERIES_MAX_WORDS)
  while (words.length > 1 && words.join('-').length > SERIES_MAX_LENGTH) words.pop()
  // A cut can leave a dangling little word: "i-was-reincarnated-as-the".
  while (words.length > 1 && TRAILING_FILLER.has(words[words.length - 1])) words.pop()
  const part = words.join('-')
  // One word longer than the cap cannot be cut at a word boundary. The page
  // keeps its id slug rather than carry half a word.
  return part.length <= SERIES_MAX_LENGTH ? part : ''
}

/**
 * The addresses a character may take when its name is already someone else's,
 * best first: name plus story (luna-sailor-moon), then name plus story plus
 * the story's first year when the story has one. Empty when there is no story
 * or no Latin name to build from. `years` is titleYears().
 */
function seriesSlugsOf(person, nameBase, years) {
  const lead = leadAppearance(person)
  const part = lead ? seriesPartOf(lead.title) : ''
  if (!nameBase || !part) return []
  const slug = `${nameBase}-${part}`
  const year = years.get(lead.slug)
  return year ? [slug, `${slug}-${year}`] : [slug]
}

/** Registry key of a title: AniList media ids are one global space. */
const titleKeyOf = (item) => (item.id != null ? `t:${item.id}` : null)

/**
 * Registry key of a character. A record built from an old-format cast entry
 * has no id, but its slug still ends in the AniList id, so that is used.
 * Neither means no key: the record is left exactly as the old code left it.
 */
const characterKeyOf = (person) => {
  if (person.id != null) return `c:${person.id}`
  const match = /-(\d+)$/.exec(person.slug || '')
  return match ? `c:${match[1]}` : null
}

/** ns -> Set of every slug the registry has ever used in that folder. */
function reservedSets(registry) {
  const sets = new Map()
  const add = (ns, slug) => {
    if (!ns || !slug) return
    let set = sets.get(ns)
    if (!set) sets.set(ns, (set = new Set()))
    set.add(slug)
  }
  for (const entry of Object.values(registry.entries)) {
    add(entry.ns, entry.slug)
    add(entry.ns, entry.raw)
    for (const path of entry.past || []) {
      const match = /^\/([^/]+)\/(.+)$/.exec(path)
      if (match) add(match[1], match[2])
    }
    for (const alias of entry.aliases || []) add('character', alias)
  }
  return sets
}

function takenIn(sets, ns) {
  let set = sets.get(ns)
  if (!set) sets.set(ns, (set = new Set()))
  return set
}

/**
 * The old rule, unchanged: clean slug, then clean slug plus year, then the id
 * slug as the last resort. `own` holds addresses this same page used before,
 * which it may take back (a title that moves folder and later moves back).
 * `base` replaces the clean slug when given (a new character's fan name).
 */
function pick(item, taken, yearOf, own = null, base = '') {
  const free = (slug) => !taken.has(slug) || (own !== null && own.has(slug))
  base = base || stripId(item.slug) || item.slug
  let slug = base
  if (!free(slug) && yearOf) {
    const year = yearOf(item)
    if (year) slug = `${base}-${year}`
  }
  if (!free(slug)) slug = item.slug // last resort: keep the id slug
  return slug
}

/** The slug of a page that has a registry key. Registers it when it is new. */
function placeKeyed(key, item, ns, taken, ctx, yearOf) {
  const entries = ctx.registry.entries
  let entry = entries[key]

  if (!entry) {
    if (ctx.frozen) {
      throw new Error(
        `slug registry has no entry for ${key} (/${ns}/${item.slug}). ` +
          'scripts/make-redirects.mjs registers new pages and must run before this.'
      )
    }
    // A new character whose page leads with the fan-searched name gets its
    // address from that name, so the URL matches what people type. Only here,
    // for a page the registry has never seen: a registered page never moves,
    // and a duplicate record (in assign) keeps the old rule.
    const base = ns === 'character' ? fanSlugOf(item) : ''
    let slug = pick(item, taken, yearOf, null, base)
    // A new character whose name is already taken tries a slug that names its
    // story before the bare id slug, the same rule migrateSeriesSlugs applied
    // to the characters registered before it.
    if (ns === 'character' && slug === item.slug && stripId(item.slug) !== item.slug) {
      const series = seriesSlugsOf(item, base || stripId(item.slug), ctx.years).find((s) => !taken.has(s))
      if (series) slug = series
    }
    entry = { ns, slug, raw: item.slug, past: [] }
    if (ns === 'character') entry.aliases = []
    entries[key] = entry
    ctx.stats.added++
    ctx.entryOf.set(item, entry)
    return slug
  }

  ctx.entryOf.set(item, entry)
  if (!Array.isArray(entry.past)) entry.past = []
  const addPast = (path) => {
    if (!entry.past.includes(path)) entry.past.push(path)
  }
  const { ns: oldNs, slug: oldSlug, raw: oldRaw } = entry

  // The title was renamed on AniList, so the ingest wrote a new id slug. The
  // clean slug stays; the old id slug becomes an earlier address.
  if (oldRaw !== item.slug) {
    addPast(`/${oldNs}/${oldRaw}`)
    entry.raw = item.slug
    ctx.stats.renamed++
  }

  // The title changed folder (a country or format fix on AniList moved it from
  // manga to manhwa). Its old addresses redirect; it gets a slug in the new
  // folder by the usual rule, checked against everything reserved there.
  if (oldNs !== ns) {
    addPast(`/${oldNs}/${oldSlug}`)
    addPast(`/${oldNs}/${oldRaw}`)
    const prefix = `/${ns}/`
    const own = new Set(entry.past.filter((p) => p.startsWith(prefix)).map((p) => p.slice(prefix.length)))
    const slug = pick(item, taken, yearOf, own)
    entry.past = entry.past.filter((p) => p !== `${prefix}${slug}`)
    entry.ns = ns
    entry.slug = slug
    ctx.stats.moved++
  }

  return entry.slug
}

/**
 * Assign slugs inside one namespace. `items` must already be sorted
 * winner-first. Returns Map(oldSlug -> newSlug), as the old assign() did.
 */
function assign(ns, items, keyOf, ctx, yearOf = null) {
  const taken = takenIn(ctx.sets, ns)
  const map = new Map()
  for (const item of items) {
    const key = keyOf(item)
    let slug
    if (key && !ctx.seenKeys.has(key)) {
      ctx.seenKeys.add(key)
      slug = placeKeyed(key, item, ns, taken, ctx, yearOf)
    } else {
      // A second record on the same id slug (a duplicate character) must not
      // overwrite the first one's address: that pinned both to the raw id
      // slug and left the registry's clean address answering 404.
      if (map.has(item.slug)) continue
      // No key, or a second record with a key already placed this run. The
      // old rule decides, and nothing is stored, because one key can only
      // remember one address.
      slug = pick(item, taken, yearOf)
    }
    taken.add(slug)
    map.set(item.slug, slug)
  }
  return map
}

/**
 * Other names of the most-loved characters, registered as extra addresses of
 * their page. Only a name no page, id slug or earlier address has ever used.
 */
function addAliases(characters, ctx) {
  const taken = takenIn(ctx.sets, 'character')
  const top = characters
    .filter((c) => c.image && (c.appearsIn || []).length > 0)
    .sort((a, b) => (b.favourites || 0) - (a.favourites || 0))
    .slice(0, ALIAS_TOP)
  for (const person of top) {
    const entry = ctx.entryOf.get(person)
    if (!entry) continue
    if (!Array.isArray(entry.aliases)) entry.aliases = []
    for (const name of person.aliases || []) {
      const slug = slugify(name)
      if (slug.length < ALIAS_MIN_LENGTH || taken.has(slug)) continue
      entry.aliases.push(slug)
      taken.add(slug)
      ctx.stats.aliases++
    }
  }
}

/**
 * ONE-TIME MOVE of registered characters to their fan-name slug
 * (/character/jin-u-seong -> /character/sung-jin-woo). make-redirects.mjs runs
 * it once, before reslugAll, and records FAN_NAME_MIGRATION so it never runs
 * again. It only edits registry entries; reslugAll then hands the new slug to
 * the page, rewrites every cross-reference to it, and the old slug, now in
 * `past`, becomes a 301. The frozen readers see the saved result.
 *
 * A page is left where it is when:
 *   - its current slug is in `keep` (it already has search impressions or
 *     visits, and a move would cost what it has earned);
 *   - the fan slug is shorter than three letters or is already its slug;
 *   - the fan slug belongs, or once belonged, to any other page. An address
 *     that meant something else is never reused. The page's own old address
 *     or alias may be taken back.
 * Characters go in the same order reslugAll uses, and the first to claim a
 * slug keeps it, so two characters can never end up on one address.
 *
 * Mutates registry in place (as reslugAll does) and returns counts.
 */
export function migrateFanNameSlugs(characters, registry, keep) {
  const stats = { candidates: 0, moved: 0, kept: 0, collided: 0, short: 0, examples: [] }
  const { holders, hold } = characterHolders(registry)

  const seen = new Set()
  for (const person of [...characters].sort(byAppearances)) {
    const key = characterKeyOf(person)
    if (!key || seen.has(key)) continue
    seen.add(key)
    const entry = registry.entries[key]
    if (!entry || entry.ns !== 'character') continue
    // No page, nothing to move: a redirect to it would land on a 404.
    if (!person.image || !(person.appearsIn || []).length) continue
    if (!displayName(person).formal) continue
    stats.candidates++

    if (keep.has(entry.slug)) {
      stats.kept++
      continue
    }
    const target = fanSlugOf(person)
    if (!target || target === entry.slug) {
      stats.short++
      continue
    }
    const owners = holders.get(target)
    if (owners && [...owners].some((owner) => owner !== key)) {
      stats.collided++
      continue
    }

    const from = entry.slug
    const oldPath = `/character/${from}`
    const newPath = `/character/${target}`
    if (!Array.isArray(entry.past)) entry.past = []
    entry.past = entry.past.filter((path) => path !== newPath)
    if (!entry.past.includes(oldPath)) entry.past.push(oldPath)
    entry.slug = target
    // The fan name was often already an alias redirect to this page. It is the
    // page itself now, so it must stop redirecting.
    entry.aliases = (entry.aliases || []).filter((alias) => alias !== target)
    hold(target, key)
    stats.moved++
    if (stats.examples.length < 10) stats.examples.push(`${oldPath} -> ${newPath}`)
  }

  registry.migrations = [...(registry.migrations || []), FAN_NAME_MIGRATION]
  return stats
}

/**
 * Who holds each character address: slug -> Set of registry keys. The same
 * addresses reservedSets() reserves in the character folder. Shared by both
 * one-time moves, so they agree on what "taken" means.
 */
function characterHolders(registry) {
  const holders = new Map()
  const hold = (slug, key) => {
    if (!slug) return
    let keys = holders.get(slug)
    if (!keys) holders.set(slug, (keys = new Set()))
    keys.add(key)
  }
  for (const [key, entry] of Object.entries(registry.entries)) {
    if (entry.ns === 'character') {
      hold(entry.slug, key)
      hold(entry.raw, key)
    }
    for (const path of entry.past || []) {
      if (path.startsWith('/character/')) hold(path.slice('/character/'.length), key)
    }
    for (const alias of entry.aliases || []) hold(alias, key)
  }
  return { holders, hold }
}

/**
 * ONE-TIME MOVE of characters stuck on their id slug to a slug that names
 * their story (/character/luna-5407 -> /character/luna-sailor-moon). A reader
 * and a search engine both learn nothing from a number; the story name says
 * which Luna this is. make-redirects.mjs runs it once, after
 * migrateFanNameSlugs and before reslugAll, and records SERIES_SUFFIX_MIGRATION
 * so it never runs again. Same mechanics as the fan-name move: it only edits
 * registry entries, the old slug goes to `past` and becomes a 301.
 *
 * Only a page whose slug is still its id slug is a candidate. The page that
 * owns the bare name (/character/luna) is never one, so it never moves.
 * A page is left where it is when:
 *   - its slug is in `keep` (search impressions or visits already);
 *   - it has no page (no image or no appearances): a nicer address for a page
 *     nobody can open would only add a redirect;
 *   - its lead story gives no Latin slug part, or one word longer than the cap;
 *   - both name-story and name-story-year belong, or once belonged, to another
 *     page. Characters go in reslugAll's order and the first one wins.
 * `years` is titleYears(). Mutates registry in place and returns counts.
 */
export function migrateSeriesSlugs(characters, registry, keep, years) {
  const stats = { candidates: 0, moved: 0, withYear: 0, kept: 0, collided: 0, noSeries: 0, examples: [] }
  const { holders, hold } = characterHolders(registry)
  const freeFor = (slug, key) => [...(holders.get(slug) || [])].every((owner) => owner === key)

  const seen = new Set()
  for (const person of [...characters].sort(byAppearances)) {
    const key = characterKeyOf(person)
    if (!key || seen.has(key)) continue
    seen.add(key)
    const entry = registry.entries[key]
    if (!entry || entry.ns !== 'character') continue
    // The id fallback is the one slug equal to the raw slug. A clean slug that
    // happens to end in a number ("seito-1", "project-2501") is not one.
    if (entry.slug !== entry.raw || stripId(entry.slug) === entry.slug) continue
    if (!person.image || !(person.appearsIn || []).length) continue
    stats.candidates++

    if (keep.has(entry.slug)) {
      stats.kept++
      continue
    }
    const options = seriesSlugsOf(person, stripId(entry.slug), years)
    if (!options.length) {
      stats.noSeries++
      continue
    }
    const target = options.find((slug) => freeFor(slug, key))
    if (!target) {
      stats.collided++
      continue
    }

    const oldPath = `/character/${entry.slug}`
    const newPath = `/character/${target}`
    if (!Array.isArray(entry.past)) entry.past = []
    entry.past = entry.past.filter((path) => path !== newPath)
    if (!entry.past.includes(oldPath)) entry.past.push(oldPath)
    entry.slug = target
    entry.aliases = (entry.aliases || []).filter((alias) => alias !== target)
    hold(target, key)
    stats.moved++
    if (target !== options[0]) stats.withYear++
    if (stats.examples.length < 10) stats.examples.push(`${oldPath} -> ${newPath}`)
  }

  registry.migrations = [...(registry.migrations || []), SERIES_SUFFIX_MIGRATION]
  return stats
}

/**
 * registry: the loaded slug registry, or null to start an empty one.
 * frozen:   throw when a page has no entry. The build readers use this so a
 *           page can never get a slug make-redirects did not record.
 * aliases:  add and publish character alias redirects (make-redirects only).
 */
export function reslugAll(comics, anime, characters, { registry = null, frozen = false, aliases = false } = {}) {
  const byPop = (a, b) => (b.popularity || 0) - (a.popularity || 0)
  const yearOf = (item) => item.startYear

  const reg = registry || { version: 1, entries: {} }
  const ctx = {
    registry: reg,
    sets: reservedSets(reg),
    frozen,
    seenKeys: new Set(),
    entryOf: new Map(),
    // Read before anything below rewrites a slug: appearance rows still carry
    // the id slugs the years are keyed by.
    years: titleYears(comics, anime),
    stats: { added: 0, moved: 0, renamed: 0, aliases: 0 },
  }

  // Comics collide only inside their own section (manhwa/manga/manhua/novel).
  const comicMap = new Map()
  for (const kind of READ_SECTIONS) {
    const group = comics.filter((c) => comicKind(c) === kind).sort(byPop)
    for (const [oldSlug, newSlug] of assign(kind, group, titleKeyOf, ctx, yearOf)) comicMap.set(oldSlug, newSlug)
  }

  const animeMap = assign('anime', [...anime].sort(byPop), titleKeyOf, ctx, yearOf)

  const charSorted = [...characters].sort(byAppearances)
  const charMap = assign('character', charSorted, characterKeyOf, ctx) // no year: duplicates keep the id slug

  if (aliases) addAliases(characters, ctx)

  // 301 map, built from the OLD slugs before anything is rewritten. The id
  // slug first, in catalog order as before; then every earlier address and
  // alias of the same page.
  const redirects = {}
  let aliasRedirects = 0
  const history = (item, to) => {
    const entry = ctx.entryOf.get(item)
    if (!entry) return
    for (const path of entry.past) if (path !== to) redirects[path] = to
    if (aliases) {
      for (const alias of entry.aliases || []) {
        const from = `/character/${alias}`
        if (from === to) continue
        redirects[from] = to
        aliasRedirects++
      }
    }
  }
  for (const c of comics) {
    const next = comicMap.get(c.slug)
    if (next !== c.slug) redirects[`/${comicKind(c)}/${c.slug}`] = `/${comicKind(c)}/${next}`
    history(c, `/${comicKind(c)}/${next}`)
  }
  for (const a of anime) {
    const next = animeMap.get(a.slug)
    if (next !== a.slug) redirects[`/anime/${a.slug}`] = `/anime/${next}`
    history(a, `/anime/${next}`)
  }
  for (const ch of characters) {
    const next = charMap.get(ch.slug)
    if (next !== ch.slug) redirects[`/character/${ch.slug}`] = `/character/${next}`
    history(ch, `/character/${next}`)
  }

  // Rewrite the items and every embedded cross-reference.
  const swap = (map, obj) => {
    if (obj && map.has(obj.slug)) obj.slug = map.get(obj.slug)
  }
  for (const c of comics) {
    swap(comicMap, c)
    for (const rel of c.animeInIndex || []) swap(animeMap, rel)
    for (const person of c.characters || []) swap(charMap, person)
  }
  for (const a of anime) {
    swap(animeMap, a)
    for (const rel of a.comicInIndex || []) swap(comicMap, rel)
    for (const person of a.characters || []) swap(charMap, person)
  }
  for (const ch of characters) {
    swap(charMap, ch)
    for (const app of ch.appearsIn || []) {
      swap(app.kind === 'anime' ? animeMap : comicMap, app)
    }
  }

  return { redirects, registry: reg, ...ctx.stats, aliasRedirects }
}
