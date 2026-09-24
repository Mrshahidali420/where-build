export const prerender = true
import { SITE, sitemapParts, today } from '../lib/sitemap-urls.js'

// The site has ~18,000 pages. One giant file is slow for a crawler to read,
// so /sitemap.xml is an index that points at one file per section.
export function GET() {
  const day = today()
  const body = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${sitemapParts
  .map((part) => `  <sitemap><loc>${SITE}/sitemap-${part.name}.xml</loc><lastmod>${day}</lastmod></sitemap>`)
  .join('\n')}
</sitemapindex>
`
  return new Response(body, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } })
}
