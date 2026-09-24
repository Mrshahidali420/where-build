/**
 * Links from a Where site to another site of the family (docs/PLAN.md
 * section 3). The rules, each enforced here:
 *
 *   1. Only a relation the catalog proves: the same AniList id on the other
 *      site, an AniList ADAPTATION/SOURCE relation, a cast row. Never
 *      "similar", never a genre, never a blanket block.
 *   2. A card: cover, title, one fact, one anchor. At most MAX_CARDS a page.
 *   3. Only to a kind this site does not own, on the site that holds it. Until
 *      a sister has a domain, that is the home site, which holds every kind.
 *   4. Never to a workers.dev host: a target that is not a real https domain
 *      draws nothing.
 *   5. Plain links, no nofollow, no UTM. The page's counter records each
 *      click under kind 'other' with the target host by itself.
 *
 * The addresses come from the home site's own frozen slug registry
 * (data/home-registry.json, scripts/where-data.mjs), so a link is exactly the
 * page it names there.
 *
 * Pure.
 */
import { DEV_HOST_SUFFIX } from '../lib/define-site.mjs'

export const MAX_CARDS = 3

/** True only for an https address on a real domain. */
export function isAllowedTarget(url) {
  try {
    const { protocol, hostname } = new URL(url)
    return protocol === 'https:' && !hostname.toLowerCase().endsWith(DEV_HOST_SUFFIX)
  } catch {
    return false
  }
}

/**
 * The site that holds every kind (config.sisterSites.manhwa, the first site
 * of the family), or null when it is not a real domain.
 */
export function homeBase(site) {
  const base = site.sisterSites?.manhwa || null
  return base && isAllowedTarget(base) ? base.replace(/\/+$/, '') : null
}

/** What the home site calls a comic's folder, as a reader says it. */
const KIND_WORDS = { manhwa: 'manhwa', manga: 'manga', manhua: 'manhua', novel: 'light novel' }

const plural = (n, word) => `${n.toLocaleString('en-US')} ${word}${n === 1 ? '' : 's'}`

/** The one fact on a source card: how long it is, and whether it is finished. */
export function sourceFact(comic, folder) {
  const parts = [KIND_WORDS[folder] || 'manga']
  if (comic.volumes) parts.push(plural(comic.volumes, 'volume'))
  else if (comic.chapters) parts.push(plural(comic.chapters, 'chapter'))
  if (comic.status === 'FINISHED') parts.push('finished')
  else if (comic.status === 'RELEASING') parts.push('ongoing')
  return parts.join(', ')
}

/**
 * The cross-site cards of one anime, best first, never more than MAX_CARDS:
 *   - where to watch it legally, when it streams anywhere official
 *   - the manga or novel it was adapted from
 * ctx: { base, home, comicsById } (see homeBase, data/home-registry.json,
 * data/linked-comics.json).
 */
export function crossCards(item, { base, home, comicsById }) {
  if (!base) return []
  const cards = []
  const own = home.t[String(item.id)]
  const services = new Set((item.watchLinks || []).map((link) => link.site).filter(Boolean)).size
  if (own && own[0] === 'anime' && services > 0) {
    cards.push({
      href: `${base}/anime/${own[1]}`,
      cover: item.cover || null,
      title: `Where to watch ${item.title} legally`,
      fact: `Streaming on ${plural(services, 'official service')}`,
      anchor: 'See where to watch',
    })
  }
  for (const rel of item.relations || []) {
    if (rel.type !== 'MANGA' || (rel.relation !== 'ADAPTATION' && rel.relation !== 'SOURCE')) continue
    const comic = comicsById.get(rel.id)
    const target = home.t[String(rel.id)]
    if (!comic || !target) continue
    const [folder, slug] = target
    cards.push({
      href: `${base}/${folder}/${slug}`,
      cover: comic.cover || null,
      title: comic.title,
      fact: `The ${sourceFact(comic, folder)}`,
      anchor: `Where to read the ${KIND_WORDS[folder] || 'manga'}`,
    })
  }
  const seen = new Set()
  return cards.filter((card) => isAllowedTarget(card.href) && !seen.has(card.href) && seen.add(card.href)).slice(0, MAX_CARDS)
}

/**
 * The home site's page for one character, or null. The home site's character
 * pages are the family's canonical ones: a cast face links there, and only
 * when that page exists.
 * ctx: { base, home, cast } (data/cast.json: id -> [name, image, hasPage]).
 */
export function characterUrl(characterId, { base, home, cast }) {
  if (!base) return null
  const known = cast[String(characterId)]
  const slug = home.c[String(characterId)]
  if (!known || !known[2] || !slug) return null
  const url = `${base}/character/${slug}`
  return isAllowedTarget(url) ? url : null
}
