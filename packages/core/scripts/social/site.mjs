/**
 * The site's side of the Facebook Page poster: the brand, the address and the
 * wording of the link comment, all from the site's own site.config.mjs (the
 * core never names a site). Everything else in scripts/social/ is the same
 * module the home site carries.
 */
import config from '../../src/lib/site.mjs'

export const SITE = {
  key: config.key,
  name: config.name,
  origin: `https://${config.domain}`,
}

/** Read by the counter script (utm_* -> campaign) and by GA4 as-is. */
export const UTM = 'utm_source=facebook&utm_medium=social&utm_campaign=page'

export const linkOf = (path) => `${SITE.origin}${path}?${UTM}`

/** The repo variable that adds the Amazon line to the first comment. Off unless it is exactly 'true'. */
export const affiliateOn = (env) => env.FB_AFFILIATE_COMMENT === 'true'

/**
 * The first comment. Line 1 is always the site link, so the preview card is
 * the site's. Line 2 is the Amazon link of this very title, only when the
 * switch is on and the site's own picks hold a product for it (shop.mjs).
 * Nothing else is said about it here (the disclosure lives on the site).
 * @param post { label, path, shop? }
 */
export function commentFor(post, { affiliate = false } = {}) {
  const lines = [`${post.label}: ${linkOf(post.path)}`]
  if (affiliate && post.shop?.url) lines.push(`${post.shop.label}: ${post.shop.url}`)
  return lines.join('\n')
}

/** The first comment of a classic post. */
export function commentOf(candidate, options) {
  const label = candidate.nextEpisode ? 'Episode dates and where to watch' : 'Where to watch it'
  return commentFor({ label, path: candidate.path, shop: candidate.shop }, options)
}
