export const prerender = true
import { sitemapParts, urlsetXml } from '../lib/sitemap-urls.js'

// One file per section, listed by /sitemap.xml.
export function getStaticPaths() {
  return sitemapParts.map((part) => ({ params: { part: part.name }, props: { urls: part.urls } }))
}

export function GET({ props }) {
  return new Response(urlsetXml(props.urls), {
    headers: { 'Content-Type': 'application/xml; charset=utf-8' },
  })
}
