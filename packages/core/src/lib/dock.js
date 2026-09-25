// The phone bar at the foot of a page (src/layouts/Where.astro): which of the
// config's `dock` links to draw, and which one is the page the reader is on.
// Pure, so the rules are tested (tests/dock.test.js) and the layout only draws.

/** An address as the site writes it: no ".html", no trailing slash, "/" for home. */
export function cleanPath(pathname) {
  const path = String(pathname || '/')
    .split(/[?#]/)[0]
    .replace(/\.html$/, '')
    .replace(/\/index$/, '/')
    .replace(/(.)\/+$/, '$1')
  return path || '/'
}

/**
 * True when `href` is the page at `pathname`, or a section it heads: /shop is
 * lit on /shop, /my-list on /my-list, and /schedule on /schedule. Home is lit
 * only on the home page itself, never on every page under it.
 */
export function isDockActive(pathname, href) {
  const here = cleanPath(pathname)
  const target = cleanPath(href)
  if (target === '/') return here === '/'
  return here === target || here.startsWith(`${target}/`)
}

/**
 * The links to draw: the config's, less any hub its gate did not build this
 * time (site-stats.json `missing`), so the bar never points at a 404. At most
 * `max`, because five is what fits a 320 px phone at a 44 px tap target.
 */
export function dockItems(dock = [], missing = [], max = 5) {
  const gone = new Set(missing)
  return dock.filter((item) => !gone.has(item.href)).slice(0, max)
}
