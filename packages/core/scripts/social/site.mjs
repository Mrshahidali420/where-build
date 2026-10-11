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

/** The first comment: one plain line and the link. */
export function commentOf(candidate) {
  const label = candidate.nextEpisode ? 'Episode dates and where to watch' : 'Where to watch it'
  return `${label}: ${linkOf(candidate.path)}`
}
