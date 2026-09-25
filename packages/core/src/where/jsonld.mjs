/**
 * Structured data for the Where pages: what each page is about, in
 * schema.org words. Base.astro wraps each node into the page's @graph. Only
 * facts the page itself prints go in.
 *
 * Pure.
 */
import { isoDate } from './words.mjs'

const abs = (siteUrl, path) => (path ? new URL(path, siteUrl).href : undefined)
const clean = (node) => Object.fromEntries(Object.entries(node).filter(([, v]) => v !== undefined && v !== '' && !(Array.isArray(v) && !v.length)))

export function animeJsonld(r, siteUrl) {
  const isMovie = r.format === 'MOVIE'
  const [y, m, d] = r.startDate || []
  const started = y ? [y, m, d].filter(Boolean).map((n, i) => (i ? String(n).padStart(2, '0') : n)).join('-') : undefined
  const director = r.key.find((k) => k.label === 'Director')?.people || []
  return clean({
    '@type': isMovie ? 'Movie' : 'TVSeries',
    '@id': `${siteUrl}/anime/${r.slug}#anime`,
    name: r.title,
    alternateName: [r.romaji, r.native].filter((n) => n && n !== r.title),
    url: `${siteUrl}/anime/${r.slug}`,
    image: r.cover,
    genre: r.genres,
    [isMovie ? 'datePublished' : 'startDate']: started,
    ...(isMovie ? {} : { numberOfEpisodes: r.episodes || undefined }),
    productionCompany: r.studios.map((s) => clean({ '@type': 'Organization', name: s.name, url: abs(siteUrl, s.href) })),
    director: director.map((p) => clean({ '@type': 'Person', name: p.name, url: abs(siteUrl, p.href) })),
    musicBy: (r.key.find((k) => k.label === 'Music')?.people || []).map((p) => clean({ '@type': 'Person', name: p.name, url: abs(siteUrl, p.href) })),
    actor: actorsOf(r).map((v) => clean({ '@type': 'Person', name: v.name, url: abs(siteUrl, v.href) })),
  })
}

/** The Japanese voices of the main cast, as the page's cast table prints them, at most ten. */
function actorsOf(r) {
  const seen = new Set()
  const out = []
  for (const c of r.cast || []) {
    if (c.role !== 'MAIN') continue
    for (const v of c.voices) {
      if (v.language !== 'Japanese' || seen.has(v.name)) continue
      seen.add(v.name)
      out.push(v)
    }
  }
  return out.slice(0, 10)
}

export function episodesJsonld(r, siteUrl) {
  return {
    '@type': 'ItemList',
    name: `${r.title} episodes`,
    itemListElement: r.rows.map(([n, title, at], i) =>
      clean({ '@type': 'ListItem', position: i + 1, item: clean({ '@type': 'TVEpisode', episodeNumber: n, name: title || `Episode ${n}`, datePublished: at ? isoDate(at) : undefined, partOfSeries: { '@id': `${siteUrl}/anime/${r.slug}#anime` } }) }),
    ),
  }
}

export function personJsonld(p, path, siteUrl) {
  return clean({
    '@type': 'Person',
    name: p.name,
    alternateName: [p.native, ...(p.aliases || [])].filter(Boolean),
    url: `${siteUrl}${path}`,
    image: p.image,
    jobTitle: (p.occupations || []).join(', '),
    sameAs: p.anilistUrl ? [p.anilistUrl] : undefined,
  })
}

/** The page's folded questions (src/where/faq.mjs), word for word as printed. */
export function faqJsonld(faq, path, siteUrl) {
  if (!faq.length) return null
  return {
    '@type': 'FAQPage',
    '@id': `${siteUrl}${path}#faq`,
    mainEntity: faq.map(({ q, a }) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })),
  }
}

/** A studio: the company. Its shows go in a separate ItemList node. */
export const studioJsonld = (s, siteUrl) => ({ '@type': 'Organization', name: s.name, url: `${siteUrl}/studio/${s.slug}` })

/** `start`: how many items came before this page, so page 2 counts on from page 1. */
export function listJsonld(name, items, siteUrl, start = 0) {
  return {
    '@type': 'ItemList',
    name,
    itemListElement: items.map((item, i) => clean({ '@type': 'ListItem', position: start + i + 1, name: item.title || item.name, url: abs(siteUrl, item.href) })),
  }
}
