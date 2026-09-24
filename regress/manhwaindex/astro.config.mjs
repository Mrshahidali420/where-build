import { defineConfig } from 'astro/config'
import cloudflare from '@astrojs/cloudflare'
import sisterCore from '@sister/core/integration'
import site from './site.config.mjs'

// Hybrid rendering. Listings, the home page and the sitemaps are built as
// files. Title pages and character pages are rendered by the Worker when a
// reader asks for one. The pages themselves come from packages/core, mounted
// by the core integration for every route group the config switches on.
export default defineConfig({
  site: site.siteUrl,
  output: 'server',
  adapter: cloudflare({ imageService: 'passthrough' }),
  integrations: [sisterCore(site)],
})
