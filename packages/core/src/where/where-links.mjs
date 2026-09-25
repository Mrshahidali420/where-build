/**
 * where-links.json: the addresses of this site's live anime and voice actor
 * pages, for the home site (config.sisterSites.manhwa) to link to. scripts/where-data.mjs
 * push writes it to R2 beside the registry, only after a deploy that worked.
 *
 *   { v: 1, builtAt, anime: { "<AniList id>": "<slug>" }, voiceActors: { "<AniList name.full>": "<slug>" } }
 *
 * Only pages in this build's sitemap (data/page-urls.json) are listed: the
 * slug registry also holds addresses whose page is gone, and a link to one
 * would be a 404. A voice actor is keyed by name, so a name two live voice
 * actors share is dropped rather than guessed.
 *
 * Pure.
 */

export const WHERE_LINKS_VERSION = 1

/** The paths of one sitemap group ('anime', 'voice-actors'), as a Set. */
function livePaths(pageUrls, name) {
  return new Set((pageUrls.groups || []).find((g) => g.name === name)?.urls.map((u) => u.path) || [])
}

/**
 * registry  data/slug-registry.json ({ entries: { "t:<id>": { ns, slug }, "p:<id>": ... } })
 * pageUrls  data/page-urls.json
 * staff     data/staff.json (id -> { name })
 */
export function whereLinksOf({ registry, pageUrls, staff, builtAt }) {
  const liveAnime = livePaths(pageUrls, 'anime')
  const liveVoices = livePaths(pageUrls, 'voice-actors')
  const anime = {}
  const byName = new Map()
  for (const [key, entry] of Object.entries(registry.entries || {})) {
    const [kind, id] = key.split(':')
    if (kind === 't' && entry.ns === 'anime' && liveAnime.has(`/anime/${entry.slug}`)) anime[id] = entry.slug
    if (kind === 'p' && liveVoices.has(`/voice-actor/${entry.slug}`)) {
      const name = staff[id]?.name
      if (name) byName.set(name, [...(byName.get(name) || []), entry.slug])
    }
  }
  const voiceActors = Object.fromEntries([...byName].filter(([, slugs]) => slugs.length === 1).map(([name, [slug]]) => [name, slug]))
  return { v: WHERE_LINKS_VERSION, builtAt, anime, voiceActors }
}
