/**
 * The core's pages, in groups a site switches on by name.
 *
 * Astro cannot import a page from another package, so a site does not own
 * these files: integration.mjs hands each enabled one to injectRoute(). A
 * site's config lists the groups it wants in `routes`, and the sitemap
 * (src/lib/sitemap-urls.js) lists only what those groups build, so a page a
 * site does not build is never offered to a crawler.
 *
 * Each file is named by its path under src/pages. Its URL pattern is that
 * path without the extension, the way Astro would read it from a folder.
 */
export const ROUTES = {
  home: ['index.astro'],
  // Browse hubs, their pages and filters, and the title page itself.
  titles: [
    '[kind]/index.astro',
    '[kind]/page/[page].astro',
    '[kind]/only/[filter].astro',
    '[kind]/only/[filter]/[page].astro',
    '[kind]/[slug].astro',
  ],
  // The answer pages under a title: free, like, buy and the full cast.
  answers: [
    '[kind]/[slug]/free.astro',
    '[kind]/[slug]/like.astro',
    '[kind]/[slug]/buy.astro',
    '[kind]/[slug]/characters.astro',
  ],
  characters: [
    'character/index.astro',
    'character/page/[page].astro',
    'character/[slug].astro',
    'character/[slug]/buy.astro',
  ],
  genres: [
    'genre/index.astro',
    'genre/[slug].astro',
    'genre/[slug]/[kind].astro',
    'genre/[slug]/[kind]/[page].astro',
    'genre/[slug]/only/[shelf].astro',
  ],
  moods: ['mood/index.astro', 'mood/[slug].astro'],
  seasons: [
    'anime/season/index.astro',
    'anime/season/[year]/[season].astro',
    'anime/season/[year]/[season]/[page].astro',
  ],
  schedule: ['schedule.astro'],
  platforms: ['platform/[slug].astro'],
  whereToRead: ['where-to-read.astro'],
  whereToWatch: ['where-to-watch.astro', 'where-to-watch/[list].astro', 'where-to-watch/[list]/[page].astro'],
  shop: ['shop.astro'],
  myList: ['my-list.astro'],
  // The results page, and the slices the header box reads. A site with its own
  // results page (a Where site) switches on only `searchIndex`.
  search: ['search.astro'],
  searchIndex: ['search/[prefix].json.js', 'search/manifest.v1.json.js'],
  sitemaps: ['sitemap.xml.js', 'sitemap-[part].xml.js'],
  admin: [
    'my-admin.astro',
    'my-admin/clicks.astro',
    'my-admin/health.astro',
    'my-admin/journeys.astro',
    'my-admin/lists.astro',
    'my-admin/money.astro',
    'my-admin/pages.astro',
    'my-admin/search.astro',
    'my-admin/sections.astro',
    'my-admin/week.astro',
  ],
  about: ['about.astro'],
  contact: ['contact.astro'],
  privacy: ['privacy.astro'],
  dmca: ['dmca.astro'],
  notFound: ['404.astro'],
}

/** '[kind]/[slug]/free.astro' -> '/[kind]/[slug]/free'; 'index.astro' -> '/'. */
export function patternOf(file) {
  const bare = file.replace(/\.(astro|js)$/, '').replace(/(^|\/)index$/, '')
  return `/${bare}`
}

/** Every group: the whole core, as the site that owns the catalog builds it. */
export const ALL_ROUTES = Object.keys(ROUTES)
