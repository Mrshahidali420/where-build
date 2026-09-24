export const prerender = true
import { getSitemapParts } from '../lib/sitemap-parts.js'
import { urlsetXml } from '../lib/sitemap-xml.js'

// One file per section, listed by /sitemap.xml.
export async function getStaticPaths() {
  const sitemapParts = await getSitemapParts()
  return sitemapParts.map((part) => ({ params: { part: part.name }, props: { urls: part.urls } }))
}

export function GET({ props }) {
  return new Response(urlsetXml(props.urls), {
    headers: { 'Content-Type': 'application/xml; charset=utf-8' },
  })
}
