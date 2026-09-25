/**
 * The "at a glance" sheet of a voice actor page, the home site's character
 * page way: the personal facts AniList's editors write at the top of a bio
 * ("__Height:__ 174 cm", "__Blood Type:__ A") lifted into a table, plus the
 * numbers this site works out from the roles themselves. The bio is handed
 * back without the lines the table now shows, so nothing is said twice.
 *
 * Birthday, hometown and years active are in the page head already
 * (src/components/where/PersonHead.astro), so they are not repeated here. No
 * age: staff.json holds no date of death, and an age for someone who has
 * died would be wrong.
 *
 * Pure.
 */
import { parseFacts } from '../lib/format.js'
import { plural } from './words.mjs'

const num = (n) => Number(n).toLocaleString('en-US')

/** p: a person shard record with a voice page (src/where/record-entities.mjs). */
export function voiceFacts(p) {
  const { facts, bio } = parseFacts(p.bio, { own: { gender: p.gender } })
  const roles = p.roles || []
  const shows = new Set(roles.map((r) => r.href)).size
  const mains = roles.filter((r) => r.role === 'MAIN').length
  const dated = roles.filter((r) => r.year)
  const newest = dated[0]
  const oldest = dated.at(-1)
  const rows = [
    p.gender ? ['Gender', p.gender] : null,
    ...facts.map((f) => [f.label, f.value]),
    shows ? ['Anime voiced', plural(shows, 'show')] : null,
    mains ? ['Main roles', num(mains)] : null,
    oldest && oldest !== newest ? ['Earliest role here', `${oldest.character.name}, ${oldest.title} (${oldest.year})`] : null,
    newest ? ['Newest role', `${newest.character.name}, ${newest.title} (${newest.year})`] : null,
    p.favourites ? ['AniList favourites', `${num(p.favourites)} people`] : null,
  ].filter(Boolean)
  return { rows, bio }
}
