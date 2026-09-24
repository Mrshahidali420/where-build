/**
 * The core, as an Astro integration. A site's astro.config.mjs adds
 * `sisterCore(site)` and gets:
 *
 *   - every core page its config switches on, mounted with injectRoute().
 *     Astro cannot import a page from another package, so a site does not
 *     own these files; src/lib/routes.mjs names them.
 *   - robots.txt and site.webmanifest, plus ads.txt and the IndexNow key file
 *     when the site has those ids.
 *   - src/lib/site.mjs swapped for the site's settings written out as data,
 *     so the Worker bundle carries them and never reads a file.
 *   - the colours and fonts in src/styles/*.css filled in from the config.
 *   - `@site/data/...` imports pointed at the site's own data/ folder, which
 *     the build scripts fill (scripts/build-site.mjs).
 *   - the shared static files in packages/core/public copied beside the
 *     site's own public/ at the end of the build.
 */
import { cpSync, existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { ROUTES, patternOf } from './src/lib/routes.mjs'

const CORE = fileURLToPath(new URL('.', import.meta.url))
const PAGES = new URL('./src/pages/', import.meta.url)
const SITE_MODULE = slash(fileURLToPath(new URL('./src/lib/site.mjs', import.meta.url)))
const STYLES = slash(fileURLToPath(new URL('./src/styles/', import.meta.url)))
const DATA_PREFIX = '@site/data/'

// Vite hands ids over with forward slashes, on Windows too.
function slash(path) {
  return path.replace(/\\/g, '/')
}

/** Every page to mount: [pattern, file under src/pages]. */
export function pagesFor(site) {
  const pages = []
  for (const key of site.routes) {
    for (const file of ROUTES[key]) pages.push([patternOf(file), file])
  }
  pages.push(['/robots.txt', 'robots.txt.js'], ['/site.webmanifest', 'site.webmanifest.js'])
  if (site.adsensePub) pages.push(['/ads.txt', 'ads.txt.js'])
  if (site.indexNow.key) pages.push([`/${site.indexNow.key}.txt`, 'indexnow-key.txt.js'])
  return pages
}

/** '#e0688a' -> '224 104 138', for rgb(... / alpha). */
function channels(hex) {
  return [1, 3, 5].map((at) => parseInt(hex.slice(at, at + 2), 16)).join(' ')
}

/** A value from the config by its dotted path, or a loud failure. */
function lookup(site, path) {
  if (path.startsWith('rgb.')) return channels(lookup(site, `colors.${path.slice(4)}`))
  const value = path.split('.').reduce((node, key) => (node == null ? undefined : node[key]), site)
  if (typeof value !== 'string') throw new Error(`site(${path}) in a stylesheet names no config value`)
  return value
}

/**
 * The stylesheets say `site(colors.rose)` wherever a site's own value goes,
 * and `rgb(site(rgb.rose) / 0.4)` for the same colour see-through. Each is
 * replaced before any CSS tool reads the file, so the stylesheet a page
 * carries is exactly what a hand-written one would be.
 */
export function fillStylesheet(code, site) {
  return code.replace(/site\(([a-z0-9.-]+)\)/gi, (_, path) => lookup(site, path))
}

/** The HTML the search box shows when a search finds nothing. */
export function searchEmptyHtml(site) {
  const links = site.search.emptyLinks.map((link) => `<a href="${link.href}">${link.label}</a>`)
  return links.length ? `Browse all ${links.join(' / ')}.` : ''
}

function sitePlugin(site, siteRoot) {
  return {
    name: 'sister-core:site',
    enforce: 'pre',
    resolveId(id) {
      if (id.startsWith(DATA_PREFIX)) return join(siteRoot, 'data', id.slice(DATA_PREFIX.length))
      return null
    },
    load(id) {
      if (slash(id).split('?')[0] === SITE_MODULE) return `const site = ${JSON.stringify(site)}\nexport default site\n`
      return null
    },
    transform(code, id) {
      const file = slash(id).split('?')[0]
      if (file.startsWith(STYLES) && file.endsWith('.css')) return { code: fillStylesheet(code, site), map: null }
      return null
    },
  }
}

/** Copy packages/core/public into the build, never over a file the site has. */
function copySharedPublic(outDir) {
  const from = join(CORE, 'public')
  for (const name of readdirSync(from)) {
    const to = join(outDir, name)
    if (!existsSync(to)) cpSync(join(from, name), to, { recursive: true })
  }
}

export default function sisterCore(site) {
  return {
    name: '@sister/core',
    hooks: {
      'astro:config:setup': ({ config, injectRoute, updateConfig }) => {
        for (const [pattern, file] of pagesFor(site)) {
          injectRoute({ pattern, entrypoint: new URL(file, PAGES) })
        }
        updateConfig({
          // The settings every site shares. The page addresses never carry a
          // trailing slash or ".html", and the page CSS travels inside the page.
          trailingSlash: 'never',
          build: { format: 'file', inlineStylesheets: 'always' },
          // Covers are served straight from AniList's CDN, so no local processing.
          image: { remotePatterns: [{ protocol: 'https', hostname: 's4.anilist.co' }] },
          vite: {
            plugins: [sitePlugin(site, fileURLToPath(config.root))],
            define: { 'import.meta.env.SITE_SEARCH_EMPTY': JSON.stringify(searchEmptyHtml(site)) },
          },
        })
      },
      'astro:build:done': ({ dir }) => {
        copySharedPublic(fileURLToPath(dir))
      },
    },
  }
}
