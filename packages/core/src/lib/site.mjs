/**
 * The site this build is for: the one sites/<site>/site.config.mjs every page,
 * script and test reads its name, address, ids and colours from.
 *
 * Two ways in, one answer:
 *   - Inside Astro (build and dev) the core integration replaces this whole
 *     module with the site's settings written out as data (integration.mjs,
 *     sitePlugin), so the Worker bundle carries them and never reads a file.
 *   - Scripts and tests run under plain node. They name the config file in
 *     SITE_CONFIG (scripts/build-site.mjs sets it; the tests point it at
 *     tests/fixtures/site.config.mjs). A script started by hand from a site's
 *     folder finds that folder's site.config.mjs by itself.
 */
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const file = process.env.SITE_CONFIG || (existsSync('site.config.mjs') ? 'site.config.mjs' : '')
if (!file) throw new Error('No site: set SITE_CONFIG, or run from a folder that holds site.config.mjs.')

const { default: config } = await import(pathToFileURL(resolve(file)).href)
export default config
