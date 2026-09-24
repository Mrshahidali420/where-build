import { defineConfig } from 'astro/config'
import cloudflare from '@astrojs/cloudflare'
import sisterCore from '@sister/core/integration'
import site from './site.config.mjs'

// The pages come from packages/core, mounted by the core integration for
// every route group site.config.mjs switches on. Listings and sitemaps are
// built as files; title and entity pages are rendered by the Worker.
export default defineConfig({
  site: site.siteUrl,
  output: 'server',
  adapter: cloudflare({ imageService: 'passthrough' }),
  integrations: [sisterCore(site)],
})
