/**
 * One site's settings, checked and completed.
 *
 * Every sites/<site>/site.config.mjs is `export default defineSite({ ... })`.
 * The core never names a site: its name, its address, its ids, its colours
 * and the pages it builds all come from here, and tests/no-brand-leak.test.js
 * holds the core to that. A key that is missing or misspelt stops the build
 * with its name, instead of printing "undefined" into forty thousand pages.
 *
 * Pure on purpose: the Worker, the Astro build, the scripts and the tests all
 * load it.
 */
import { ROUTES } from './routes.mjs'
import { DOCK_ICONS } from './dock-icons.js'
import { COUNTERS } from './page-counts.mjs'

/** The catalog's record kinds (see src/lib/section.mjs). */
export const OWNABLE_KINDS = ['comic', 'novel', 'anime']

/** The twelve colours of the stage. src/styles/app.css reads each one. */
export const COLOR_TOKENS = [
  'night',
  'night-raised',
  'night-sunk',
  'cobalt',
  'cobalt-line',
  'cobalt-bright',
  'rose',
  'rose-soft',
  'dawn',
  'dawn-dim',
  'dawn-faint',
  'day',
]

/** The Amazon stores src/lib/shop-links.js knows. A tag may be '' (not approved yet). */
export const AMAZON_STORES = ['us', 'uk', 'de', 'fr', 'it', 'es', 'ca', 'jp']

/** Where the Workers dev address lives. The guard in src/worker.js keys on it. */
export const DEV_HOST_SUFFIX = '.workers.dev'

const HEX = /^#[0-9a-f]{6}$/i
const COUNTRY = /^[A-Z]{2}$/

function need(ok, key, what) {
  if (!ok) throw new Error(`site.config: ${key} ${what}`)
}

const isText = (value) => typeof value === 'string' && value.trim() !== ''
const isTextOrNull = (value) => value === null || isText(value)

function checkText(input, keys) {
  for (const key of keys) need(isText(input[key]), key, 'must be a non-empty string')
}

function checkNullable(input, keys) {
  for (const key of keys) need(isTextOrNull(input[key]), key, 'must be a string or null')
}

function checkLinks(list, key) {
  need(Array.isArray(list), key, 'must be a list')
  for (const link of list) need(isText(link.href) && isText(link.label), key, 'needs href and label on every link')
}

function checkColors(colors) {
  need(colors && typeof colors === 'object', 'colors', 'must be an object')
  for (const token of COLOR_TOKENS) need(HEX.test(colors[token] || ''), `colors.${token}`, 'must be a #rrggbb colour')
  const extra = Object.keys(colors).filter((token) => !COLOR_TOKENS.includes(token))
  need(extra.length === 0, 'colors', `has unknown tokens: ${extra.join(', ')}`)
}

function checkRoutes(routes) {
  need(Array.isArray(routes), 'routes', 'must be a list of route keys')
  for (const key of routes) need(ROUTES[key], `routes: ${key}`, `is not a core route (${Object.keys(ROUTES).join(', ')})`)
}

function checkAmazon(amazon) {
  need(amazon && amazon.stores && typeof amazon.stores === 'object', 'amazon.stores', 'must be an object')
  for (const store of AMAZON_STORES) {
    need(typeof amazon.stores[store] === 'string', `amazon.stores.${store}`, "must be a tag or ''")
  }
}

function checkOwned(rules) {
  need(Array.isArray(rules) && rules.length > 0, 'ownedKinds', 'must list at least one kind')
  for (const rule of rules) {
    need(OWNABLE_KINDS.includes(rule.kind), 'ownedKinds', `kind must be one of ${OWNABLE_KINDS.join(', ')}`)
    for (const key of ['from', 'notFrom']) {
      if (rule[key] !== undefined) need(Array.isArray(rule[key]) && rule[key].every((c) => COUNTRY.test(c)), `ownedKinds ${rule.kind}.${key}`, 'must list two-letter country codes')
    }
  }
}

function checkGates(gates) {
  need(Array.isArray(gates), 'gates', 'must be a list')
  for (const gate of gates) need(isText(gate.page) && COUNTERS[gate.count], `gates ${gate.page}`, `needs a page and a count from: ${Object.keys(COUNTERS).join(', ')}`)
}

/**
 * Two ways to ship type. `stylesheet` and `adminStylesheet` name a font
 * service's CSS (the first site's way). `self` lists @fontsource
 * packages the build bundles into /_astro/, so a page never waits on another
 * host: { subsets, faces: [{ pkg, file, weights, preload, admin }] }, where
 * `file` is the package's file prefix, `preload` the weights the first screen
 * paints and `admin` the weights /my-admin uses (see integration.mjs).
 */
function checkFonts(fonts) {
  checkText(fonts, ['display', 'text'])
  need(fonts.displayWeight === undefined || /^[1-9]00$/.test(fonts.displayWeight), 'fonts.displayWeight', "must be a weight like '400', as a string")
  if (!fonts.self) return checkText(fonts, ['stylesheet', 'adminStylesheet'])
  const { subsets, faces } = fonts.self
  need(Array.isArray(subsets) && subsets.length > 0 && subsets.every(isText), 'fonts.self.subsets', 'must list subsets')
  need(Array.isArray(faces) && faces.length > 0, 'fonts.self.faces', 'must list at least one face')
  for (const face of faces) {
    need(/^@fontsource\/[a-z0-9-]+$/.test(face.pkg || '') && isText(face.file), 'fonts.self.faces', 'needs an @fontsource pkg and its file prefix')
    for (const key of ['weights', 'preload', 'admin']) {
      const list = face[key] || []
      need(Array.isArray(list) && list.every((w) => Number.isInteger(w)), `fonts.self ${face.pkg}.${key}`, 'must list weights')
    }
    need((face.weights || []).length > 0, `fonts.self ${face.pkg}.weights`, 'must list at least one weight')
    for (const weight of [...(face.preload || []), ...(face.admin || [])]) {
      need(face.weights.includes(weight), `fonts.self ${face.pkg}`, `weight ${weight} is preloaded or used by admin but not shipped`)
    }
  }
}

/** Which build a site runs (scripts/build-site.mjs): the core's, or the Where entity build. */
export const BUILDERS = ['core', 'where']

function checkObjects(input, keys) {
  for (const key of keys) need(input[key] && typeof input[key] === 'object' && !Array.isArray(input[key]), key, 'must be an object')
}

/** A frozen copy, all the way down, so no page can change another page's settings. */
function freeze(value) {
  if (value && typeof value === 'object') {
    for (const inner of Object.values(value)) freeze(inner)
    Object.freeze(value)
  }
  return value
}

/**
 * The settings, checked, with the derived values added:
 *   devHost  <workerName>.<workersSubdomain>.workers.dev
 *   host     the domain when there is one, else devHost
 *   siteUrl  https://<host>, the origin of every canonical, sitemap row and JSON-LD id
 */
export function defineSite(input) {
  checkText(input, ['key', 'name', 'shortName', 'tagline', 'description', 'mark', 'workerName', 'workersSubdomain', 'adminSalt', 'rebuildUtc'])
  checkNullable(input, ['domain', 'plannedDomain', 'email', 'dmcaEmail', 'ga4Id', 'adsensePub', 'turnstileSiteKey'])
  checkObjects(input, ['amazon', 'indexNow', 'colors', 'fonts', 'd1', 'r2', 'sisterSites', 'dev', 'footer', 'search'])
  need(/^[a-z0-9-]+$/.test(input.key), 'key', 'must be lower case letters, digits and dashes')
  need(Array.isArray(input.wordmark) && input.wordmark.length === 2 && input.wordmark.every(isText), 'wordmark', 'must be two words')
  need(!input.domain || !input.domain.endsWith(DEV_HOST_SUFFIX), 'domain', 'must be a real domain, not a workers.dev host')
  checkColors(input.colors)
  checkFonts(input.fonts)
  need(input.builder === undefined || BUILDERS.includes(input.builder), 'builder', `must be one of ${BUILDERS.join(', ')}`)
  checkRoutes(input.routes)
  checkAmazon(input.amazon)
  checkLinks(input.nav, 'nav')
  checkText(input.footer, ['blurb', 'bar'])
  checkLinks(input.footer.browse, 'footer.browse')
  if (input.footer.legal !== undefined) checkLinks(input.footer.legal, 'footer.legal')
  checkLinks(input.dock, 'dock')
  for (const item of input.dock) need(DOCK_ICONS[item.icon], `dock ${item.href}`, `needs an icon from: ${Object.keys(DOCK_ICONS).join(', ')}`)
  checkLinks(input.search.emptyLinks, 'search.emptyLinks')
  if (input.search.pageLinks !== undefined) checkLinks(input.search.pageLinks, 'search.pageLinks')
  need(input.search.description === undefined || isText(input.search.description), 'search.description', 'must be a non-empty string')
  need(isTextOrNull(input.indexNow.key), 'indexNow.key', 'must be a string or null')
  need(isText(input.d1.name), 'd1.name', 'must be a non-empty string')
  need(isTextOrNull(input.d1.id), 'd1.id', 'must be a string or null')
  need(Array.isArray(input.cron) && input.cron.every(isText), 'cron', 'must be a list of cron lines')
  need(isText(input.r2.catalogBucket), 'r2.catalogBucket', 'must be a non-empty string')
  need(typeof input.r2.catalogWrite === 'boolean', 'r2.catalogWrite', 'must be true (the site that owns the catalog) or false')
  need(isTextOrNull(input.r2.dataBucket), 'r2.dataBucket', 'must be a string or null')
  // Where this site keeps its own state in the data bucket (scripts/where-data.mjs).
  need(input.r2.statePrefix === undefined || /^[a-z0-9-]+$/.test(input.r2.statePrefix), 'r2.statePrefix', 'must be lower case letters, digits and dashes')
  need(input.builder !== 'where' || (input.r2.dataBucket && input.r2.statePrefix), 'r2', 'a Where site needs dataBucket and statePrefix')
  need(typeof input.dev.blockBots === 'boolean', 'dev.blockBots', 'must be true or false')
  need(typeof input.malExtras === 'boolean', 'malExtras', 'must be true or false')
  need(Array.isArray(input.entityKinds), 'entityKinds', 'must be a list')
  checkOwned(input.ownedKinds)
  checkGates(input.gates)
  need(input.sisterSites && typeof input.sisterSites === 'object', 'sisterSites', 'must be an object')
  for (const [kind, url] of Object.entries(input.sisterSites)) {
    // A link to a workers.dev host would point readers and crawlers at a dev
    // site. Until a sister has a domain its entry stays null.
    need(url === null || (isText(url) && !new URL(url).hostname.endsWith(DEV_HOST_SUFFIX)), `sisterSites.${kind}`, 'must be a real https URL or null')
  }
  for (const route of ['contact', 'dmca']) {
    if (input.routes.includes(route)) need(isText(input.email) && isText(input.dmcaEmail), route, 'needs email and dmcaEmail')
  }

  const devHost = `${input.workerName}.${input.workersSubdomain}${DEV_HOST_SUFFIX}`
  const host = input.domain || devHost
  const site = structuredClone(input)
  // The weight the display face is drawn at (src/lib/font-pairs.mjs): a
  // one-weight poster face is 400, a variable family its heavy cut.
  site.fonts = { displayWeight: '400', ...site.fonts }
  return freeze({ builder: 'core', ...site, devHost, host, siteUrl: `https://${host}` })
}

/** True for a Workers dev address. Such a host is never indexed. */
export function isDevHost(hostname) {
  return String(hostname || '').toLowerCase().endsWith(DEV_HOST_SUFFIX)
}

/** True for a site built by the Where entity build (scripts/make-where.mjs). */
export const isWhereSite = (site) => site.builder === 'where'

/** True when the site builds this group of core pages. */
export function hasRoute(site, key) {
  return site.routes.includes(key)
}
