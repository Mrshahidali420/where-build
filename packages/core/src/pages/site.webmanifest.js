export const prerender = true
import config from '../lib/site.mjs'
import { isWhereSite } from '../lib/define-site.mjs'

// What a phone shows when the site is added to the home screen: the name,
// the ground colour behind the icon, and the two icons in the site's public/.
export function GET() {
  const manifest = {
    name: config.shortName,
    short_name: config.shortName,
    description: config.description,
    start_url: '/',
    display: 'browser',
    background_color: config.colors.night,
    theme_color: config.colors.night,
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
      // A Where site's brand files (scripts/make-site-icons.mjs) include a
      // full-bleed icon that a phone may crop to its own shape.
      ...(isWhereSite(config) ? [{ src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }] : []),
    ],
  }
  return new Response(`${JSON.stringify(manifest, null, 2)}\n`, {
    headers: { 'Content-Type': 'application/manifest+json; charset=utf-8' },
  })
}
