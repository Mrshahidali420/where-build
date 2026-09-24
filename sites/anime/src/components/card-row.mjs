// A hub row [title, href, cover, format, episodes, season, studio]
// (packages/core/src/where/outputs.mjs cardRow) as a cover card for Covers.astro.
import { plural } from '@sister/core/src/where/words.mjs'

export const cardOfRow = ([title, href, cover, format, episodes, season, studio]) => ({
  title,
  href,
  cover,
  meta: [format, episodes ? plural(episodes, 'ep') : '', studio || season].filter(Boolean).join(', '),
})
