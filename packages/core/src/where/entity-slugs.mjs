/**
 * Frozen addresses for a Where site's entity pages: people, studios, song
 * artists and franchises, in the same slug registry as its titles
 * (data/slug-registry.json, src/lib/slug-registry.mjs).
 *
 * The rule is the registry's: once a page has an address it keeps it for
 * good, and an address once given is never handed to anything else. A new
 * page tries its clean name, then each fallback in turn, then its name with
 * its key, which no other page can hold. The items come winner-first (the
 * best-known person gets the clean name), and the winner is judged only once:
 * on the day each page first appears.
 *
 *   ns       the registry folder: 'person', 'studio', 'artist', 'watch-order'
 *   keyOf    the registry key: 'p:<AniList staff id>', 's:<studio id>', ...
 *   namesOf  the slugs to try, best first (already slugified or plain words)
 *
 * Pure apart from writing new entries into the registry it is handed.
 */
import { slugify } from '../lib/slugify.mjs'

/** Every slug a registry folder has ever used, current and past. */
export function reservedIn(registry, ns) {
  const taken = new Set()
  for (const entry of Object.values(registry.entries)) {
    if (entry.ns !== ns) continue
    taken.add(entry.slug)
    for (const path of entry.past || []) taken.add(path.split('/').pop())
  }
  return taken
}

/**
 * The slug of every item, registering the new ones. Returns Map(key -> slug)
 * and counts how many were new.
 */
export function assignSlugs(registry, ns, items, { keyOf, namesOf }) {
  const taken = reservedIn(registry, ns)
  const slugs = new Map()
  let added = 0
  for (const item of items) {
    const key = keyOf(item)
    const known = registry.entries[key]
    if (known) {
      slugs.set(key, known.slug)
      continue
    }
    const tries = namesOf(item).map(slugify).filter(Boolean)
    const last = slugify(`${tries[0] || ns}-${key.split(':').pop()}`)
    let slug = tries.find((s) => !taken.has(s)) || last
    for (let n = 2; taken.has(slug); n++) slug = `${last}-${n}`
    registry.entries[key] = { ns, slug, raw: slug, past: [] }
    taken.add(slug)
    slugs.set(key, slug)
    added++
  }
  return { slugs, added }
}
