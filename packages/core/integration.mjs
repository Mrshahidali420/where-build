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
import { isWhereSite } from './src/lib/define-site.mjs'

const CORE = fileURLToPath(new URL('.', import.meta.url))
const PAGES = new URL('./src/pages/', import.meta.url)
const SITE_MODULE = slash(fileURLToPath(new URL('./src/lib/site.mjs', import.meta.url)))
const STYLES = slash(fileURLToPath(new URL('./src/styles/', import.meta.url)))
const DATA_PREFIX = '@site/data/'
const LIB = fileURLToPath(new URL('./src/lib/', import.meta.url))

// Build-time sources that differ by builder. Each id is one file or the
// other, so the unused one (and the catalog it loads) never enters the graph.
const SOURCE_MODULES = {
  'virtual:sitemap-source': { core: 'sitemap-urls.js', where: 'where-sitemap.js' },
  'virtual:search-source': { core: 'search-source-catalog.js', where: 'search-source-where.js' },
}

/** The file behind a source id for this site, or null for any other id. */
export function sourceFileFor(site, id) {
  const choice = SOURCE_MODULES[id]
  return choice ? join(LIB, choice[isWhereSite(site) ? 'where' : 'core']) : null
}

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

// The browse links the full results page offers when a search finds nothing,
// when the site's config does not name its own (search.pageLinks).
const DEFAULT_PAGE_LINKS = [
  ['/manhwa', 'manhwa'],
  ['/manga', 'manga'],
  ['/manhua', 'manhua'],
  ['/novel', 'novels'],
  ['/anime', 'anime'],
  ['/character', 'characters'],
].map(([href, label]) => ({ href, label }))

/** The links on the full results page when a search finds nothing. */
export function searchPageLinksHtml(site) {
  return (site.search.pageLinks || DEFAULT_PAGE_LINKS).map((link) => `<a href="${link.href}">${link.label}</a>`).join(' / ')
}

/** The HTML the search box shows when a search finds nothing. */
export function searchEmptyHtml(site) {
  const links = site.search.emptyLinks.map((link) => `<a href="${link.href}">${link.label}</a>`)
  return links.length ? `Browse all ${links.join(' / ')}.` : ''
}

// The site's own type, when its config ships it (`fonts.self`). Base.astro
// imports the first, Admin.astro the second.
const FONT_MODULES = { 'virtual:site-fonts': 'page', 'virtual:site-fonts-admin': 'admin' }

/**
 * The code of one font module: an import of each @fontsource stylesheet the
 * surface uses (latin and whatever other subsets the config names), and the
 * hashed URLs of the faces the first screen paints, for <link rel="preload">.
 * The stylesheets carry font-display: swap, and the build copies the woff2
 * files into /_astro/ under content-hashed names (a year-long cache, see
 * public/_headers). A site with a font service stylesheet gets an empty module.
 */
export function fontModule(site, surface) {
  const self = site.fonts.self
  if (!self) return 'export const fontPreload = []\n'
  const lines = []
  const urls = []
  for (const face of self.faces) {
    const weights = surface === 'admin' ? face.admin || [] : face.weights
    for (const weight of weights) {
      for (const subset of self.subsets) lines.push(`import '${face.pkg}/${subset}-${weight}.css'`)
    }
    if (surface !== 'page') continue
    for (const weight of face.preload || []) {
      const name = `face${urls.length}`
      lines.push(`import ${name} from '${face.pkg}/files/${face.file}-${self.subsets[0]}-${weight}-normal.woff2?url'`)
      urls.push(name)
    }
  }
  lines.push(`export const fontPreload = [${urls.join(', ')}]`)
  return `${lines.join('\n')}\n`
}

function sitePlugin(site, siteRoot) {
  return {
    name: 'sister-core:site',
    enforce: 'pre',
    resolveId(id) {
      if (id.startsWith(DATA_PREFIX)) return join(siteRoot, 'data', id.slice(DATA_PREFIX.length))
      if (FONT_MODULES[id]) return `\0${id}`
      return sourceFileFor(site, id)
    },
    load(id) {
      if (slash(id).split('?')[0] === SITE_MODULE) return `const site = ${JSON.stringify(site)}\nexport default site\n`
      if (id.startsWith('\0') && FONT_MODULES[id.slice(1)]) return fontModule(site, FONT_MODULES[id.slice(1)])
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
            define: {
              'import.meta.env.SITE_SEARCH_EMPTY': JSON.stringify(searchEmptyHtml(site)),
              'import.meta.env.SITE_SEARCH_PAGE_LINKS': JSON.stringify(searchPageLinksHtml(site)),
            },
          },
        })
      },
      'astro:build:done': ({ dir }) => {
        copySharedPublic(fileURLToPath(dir))
      },
    },
  }
}
