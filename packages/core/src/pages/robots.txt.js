export const prerender = true
import config from '../lib/site.mjs'
import { DEV_ROBOTS, robotsTxt } from '../lib/robots.mjs'

// The shared crawler policy (src/lib/robots.mjs) with this site's sitemap.
// A site with no domain yet lives only on its Workers dev address, where
// nothing may be crawled: its file says "Disallow: /" too, even before the
// Worker answers this path itself (src/lib/dev-guard.js).
export function GET() {
  return new Response(config.domain ? robotsTxt(config.siteUrl) : DEV_ROBOTS, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  })
}
