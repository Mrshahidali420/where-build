export const prerender = true
import config from '../lib/site.mjs'

// The one line AdSense asks for. integration.mjs builds this file only when
// the site has an AdSense publisher id.
export function GET() {
  const publisher = config.adsensePub.replace(/^ca-/, '')
  return new Response(`google.com, ${publisher}, DIRECT, f08c47fec0942fa0\n`, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  })
}
