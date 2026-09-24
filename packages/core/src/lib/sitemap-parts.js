// BUILD TIME ONLY. Which URLs this site's sitemap lists.
//
// A site built from the catalog lists what its route groups build
// (src/lib/sitemap-urls.js, which loads the catalog). A Where site lists the
// pages its own build gated in (src/lib/where-sitemap.js, one small file), and
// never loads the catalog at all. The integration makes that choice:
// `virtual:sitemap-source` is one file or the other, so the unused source is
// never in the build's module graph (a bundler follows every import it can
// see, even behind an `if` that never runs).
import { sitemapParts } from 'virtual:sitemap-source'
import config from './site.mjs'

export const SITE = config.siteUrl

/** Every sub-sitemap, in crawl order: [{ name, urls: [{ loc, priority, image?, caption? }] }]. */
export function getSitemapParts() {
  return Promise.resolve(sitemapParts)
}
