/**
 * /where-to-watch: the official streaming services the site's anime are
 * listed on, each with how many shows here it carries, how many of those are
 * airing now, and its most watched ones. What each service asks of a viewer
 * (how it is paid for, what is free, where it works) comes from
 * src/lib/platform-facts.js on the page itself.
 *
 * A service with fewer than `min` shows is left out, and with fewer than
 * `services` services left there is no page at all: a hub of two names is
 * not worth a crawl.
 *
 * Pure: title records (src/where/record-title.mjs) in, the hub's rows out.
 */
import { genreSlug } from './anime-hubs.mjs'
import { listWords } from './hub-extras.mjs'

export const PLATFORM_HUB = { min: 12, top: 8, services: 3 }

const byPopularity = (a, b) => (b.popularity || 0) - (a.popularity || 0) || a.id - b.id

/**
 * { total, services: [{ name, slug, count, airing, rows }] }, the service
 * with the most shows first, or null when too few pass. `total` counts the
 * shows with at least one official stream; `rows` are cardRow(title), most
 * watched first.
 */
export function platformHub(titles, cardRow, { min, top, services: least } = PLATFORM_HUB) {
  const bySite = new Map()
  let total = 0
  for (const t of [...titles].sort(byPopularity)) {
    const sites = new Set((t.watchOn || []).map((w) => w.site).filter(Boolean))
    if (sites.size) total++
    for (const site of sites) {
      const entry = bySite.get(site) || { count: 0, airing: 0, rows: [] }
      bySite.set(site, {
        count: entry.count + 1,
        airing: entry.airing + (t.status === 'RELEASING' ? 1 : 0),
        rows: entry.rows.length < top ? [...entry.rows, cardRow(t)] : entry.rows,
      })
    }
  }
  const services = [...bySite]
    .filter(([, entry]) => entry.count >= min)
    .map(([name, entry]) => ({ name, slug: genreSlug(name), ...entry }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
  return services.length >= least ? { total, services } : null
}

/** A service's free offer, in a few words, when its facts say there is one (platform-facts.js FREE). */
const FREE_WORDS = { 'All of it': 'every episode', 'Most of it': 'most episodes', 'The first episodes': 'the first episodes of a series' }

/**
 * The hub's questions, from its own rows and the services' facts
 * (`factsOf(name)` is platform-facts.js factsFor, handed in so this stays pure).
 */
export function platformFaq(hub, factsOf, site) {
  if (!hub) return []
  const top = hub.services.slice(0, 3)
  const out = [
    {
      q: 'Where can I watch anime legally?',
      a: `On the official streaming services. Of the ${hub.total.toLocaleString('en-US')} shows on ${site} with an official stream, the most are on ${listWords(top.map((s) => `${s.name} (${s.count.toLocaleString('en-US')})`))}. What each carries depends on your country.`,
    },
  ]
  const free = hub.services.filter((s) => FREE_WORDS[factsOf(s.name)?.free])
  if (free.length) {
    out.push({
      q: 'Where can I watch anime for free?',
      a: `${listWords(free.slice(0, 4).map((s) => `${s.name} (${FREE_WORDS[factsOf(s.name).free]})`))} ${free.length === 1 ? 'lets' : 'let'} you watch without paying. Each service's section below says how the rest is paid for.`,
    })
  }
  const [first] = hub.services
  out.push({
    q: 'Which streaming service has the most anime?',
    a: `${first.name}, with ${first.count.toLocaleString('en-US')} of the shows here${first.airing ? `, ${first.airing.toLocaleString('en-US')} of them airing now` : ''}.${hub.services[1] ? ` ${hub.services[1].name} is next with ${hub.services[1].count.toLocaleString('en-US')}.` : ''}`,
  })
  return out
}
