import { pathOf } from './catalog.js'
import config from './site.mjs'

const SITE = config.siteUrl

/**
 * A browse page is a CollectionPage that carries an ItemList of what is
 * visible on it. Only the items on this page are listed, so the list a
 * search engine reads matches the list a visitor sees.
 */
export function listingJsonld({ name, description, path, items, total }) {
  return {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    '@id': `${SITE}${path}#collection`,
    url: `${SITE}${path}`,
    name,
    description,
    dateModified: new Date().toISOString().slice(0, 10),
    mainEntity: {
      '@type': 'ItemList',
      numberOfItems: total ?? items.length,
      itemListOrder: 'https://schema.org/ItemListOrderDescending',
      itemListElement: items.map((item, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        name: item.title,
        url: `${SITE}${pathOf(item, item.kind)}`,
      })),
    },
  }
}
