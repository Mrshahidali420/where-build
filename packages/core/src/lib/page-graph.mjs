/**
 * A Where page's structured data: the site's Organization and WebSite, the
 * page's own nodes, and its breadcrumbs, in one @graph so the parts can point
 * at each other by @id. Every page is a self-contained answer for a search
 * engine that only ever reads that one URL.
 *
 * Pure.
 *   crumbs: the steps after Home; the last one is the page and has no href.
 */
export function pageGraph({ config, jsonld, crumbs = [] }) {
  const site = config.siteUrl
  const organization = {
    '@type': 'Organization',
    '@id': `${site}/#organization`,
    name: config.name,
    url: site,
    logo: `${site}/icon-512.png`,
    description: config.description,
    ...(config.email ? { email: config.email } : {}),
  }
  const own = (Array.isArray(jsonld) ? jsonld : jsonld ? [jsonld] : [])
    .filter(Boolean)
    .map(({ '@context': _context, ...node }) => ({ ...node, isPartOf: { '@id': `${site}/#website` } }))
  const website = {
    '@type': 'WebSite',
    '@id': `${site}/#website`,
    url: site,
    name: config.name,
    publisher: { '@id': organization['@id'] },
    potentialAction: {
      '@type': 'SearchAction',
      target: { '@type': 'EntryPoint', urlTemplate: `${site}/search?q={search_term_string}` },
      'query-input': 'required name=search_term_string',
    },
  }
  const breadcrumbs = crumbs.length
    ? {
        '@type': 'BreadcrumbList',
        itemListElement: [{ name: 'Home', href: '/' }, ...crumbs].map((step, i) => ({
          '@type': 'ListItem',
          position: i + 1,
          name: step.name,
          ...(step.href ? { item: new URL(step.href, site).href } : {}),
        })),
      }
    : null
  return { '@context': 'https://schema.org', '@graph': [organization, ...own, website, ...(breadcrumbs ? [breadcrumbs] : [])] }
}

/** The graph as a <script type="application/ld+json"> body, safe inside HTML. */
export const graphJson = (graph) => JSON.stringify(graph).replace(/</g, '\\u003c')
