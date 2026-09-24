/**
 * The dev-host guard: what keeps a site on its Workers dev address out of
 * every search index until it has a real domain.
 *
 * It keys on the address a request came in on, never on a setting, so it can
 * never be left switched on by mistake: on the real domain it is simply never
 * reached, and when a site gets its domain the dev address is switched off in
 * wrangler.jsonc (scripts/make-wrangler.mjs) and the guard goes with it.
 *
 * On a dev host:
 *   - robots.txt says "Disallow: /" to everyone
 *   - every answer carries X-Robots-Tag: noindex, nofollow, noarchive
 *   - the crawlers robots.txt shuts out, and anything that sends no Accept
 *     header (a bare script, never a browser), get a small 403 before any
 *     page is rendered. A dev address has no firewall in front of it, and a
 *     crawler that ignores robots.txt would otherwise spend real requests.
 *
 * The static files never reach the Worker. The same header reaches them
 * through a host rule in public/_headers, and the pages built as files carry
 * a noindex meta tag, because their address at build time is the dev host
 * (src/layouts/Base.astro).
 */
import { isDevHost } from './define-site.mjs'
import { DEV_ROBOTS, isBlockedAgent } from './robots.mjs'

export const NOINDEX = 'noindex, nofollow, noarchive'

/** The same response, marked so no search engine keeps it. */
export function withNoindex(response) {
  const marked = new Response(response.body, response)
  marked.headers.set('x-robots-tag', NOINDEX)
  return marked
}

function plain(body, status) {
  return new Response(body, {
    status,
    headers: {
      'content-type': 'text/plain; charset=utf-8',
      'cache-control': 'no-store',
      'x-robots-tag': NOINDEX,
    },
  })
}

/**
 * The answer the guard gives by itself, or null to let the request through.
 * Only ever answers on a dev host.
 */
export function devGuard(site, request) {
  const url = new URL(request.url)
  if (!isDevHost(url.hostname)) return null
  // First, and for everyone: even a crawler that is turned away below should
  // read that it may not come in.
  if (url.pathname === '/robots.txt') return plain(DEV_ROBOTS, 200)
  if (site.dev.blockBots) {
    const agent = request.headers.get('user-agent')
    if (isBlockedAgent(agent) || !request.headers.get('accept')) return plain('Forbidden\n', 403)
  }
  return null
}
