/**
 * The check every door that writes shares: the request must come from this
 * site's own page. A page on another site cannot make a visitor's browser, or
 * the owner's, post here: the Origin must be this site, and Sec-Fetch-Site,
 * which every current browser sends and a page cannot forge, must not say
 * otherwise. The body must be JSON, which a plain cross-site form cannot send
 * without a preflight these doors never answer.
 */

/** Null when the request comes from this site's own page, else the reason. */
export function crossSite(request) {
  const own = new URL(request.url).origin
  const origin = request.headers.get('origin')
  if (!origin || origin !== own) return 'wrong origin'
  const site = request.headers.get('sec-fetch-site')
  if (site && site !== 'same-origin') return 'not same-origin'
  const type = (request.headers.get('content-type') || '').split(';')[0].trim().toLowerCase()
  if (type !== 'application/json') return 'body must be JSON'
  return null
}
