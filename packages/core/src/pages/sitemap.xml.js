export const prerender = true
import { SITE, getSitemapParts } from '../lib/sitemap-parts.js'
import { today } from '../lib/sitemap-xml.js'

// The site has ~18,000 pages. One giant file is slow for a crawler to read,
// so /sitemap.xml is an index that points at one file per section.
export async function GET() {
  const day = today()
  const sitemapParts = await getSitemapParts()
  const body = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${sitemapParts
  .map((part) => `  <sitemap><loc>${SITE}/sitemap-${part.name}.xml</loc><lastmod>${day}</lastmod></sitemap>`)
  .join('\n')}
</sitemapindex>
`
  return new Response(body, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } })
}
