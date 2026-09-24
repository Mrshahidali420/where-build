export const prerender = true
import config from '../lib/site.mjs'

// IndexNow proves the site owns its key by finding the key at /<key>.txt.
// integration.mjs mounts this file at that address, and only when the site
// has a key (a site without a domain has none: see scripts/indexnow.mjs).
export function GET() {
  return new Response(config.indexNow.key, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  })
}
