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

/** The one line under a voice actor's name: how many roles, in how many shows, in which language. */
export function voiceLede(p) {
  const roles = p.roles || []
  const shows = new Set(roles.map((r) => r.href)).size
  const mains = roles.filter((r) => r.role === 'MAIN').length
  const languages = [...new Set(roles.map((r) => r.language))]
  return (
    `${plural(roles.length, 'role')} in ${plural(shows, 'anime', 'anime')}` +
    (mains ? `, ${mains} of them main characters` : '') +
    (languages.length === 1 ? `, in ${languages[0]}.` : '.')
  )
}

// What a staff member's biggest group says about them, as the end of "most of all ...".
const STAFF_AS = {
  created: 'as a creator',
  directed: 'as a director',
  wrote: 'as a writer',
  designed: 'as a designer',
  composed: 'in music and songs',
  animated: 'as an animator',
  sound: 'in sound',
  produced: 'as a producer',
}

/** The group a staff member has the most shows in. */
export const leadWork = (p) => [...(p.works || [])].sort((a, b) => b.items.length - a.items.length)[0] || null

/** The one line under a staff member's name. */
export function staffLede(p) {
  const lead = leadWork(p)
  return `Credited on ${plural(p.counts.shows, 'anime', 'anime')}` + (lead && STAFF_AS[lead.key] ? `, most of all ${STAFF_AS[lead.key]}.` : '.')
}

/** A song artist's counts: openings, endings, shows. */
export function artistCounts(a) {
  const ops = a.songs.filter((s) => s.type === 'OP').length
  return { ops, eds: a.songs.length - ops, shows: new Set(a.songs.map((s) => s.anime.href)).size }
}

/** The one line under a song artist's name. */
export function artistLede(a) {
  const { ops, eds, shows } = artistCounts(a)
  return `${plural(ops, 'opening')} and ${plural(eds, 'ending')} in ${plural(shows, 'anime', 'anime')}, newest show first.`
}

/** The fact sentences of each person page (filled in by the facts step). */
export const voiceLines = () => []
export const staffLines = () => []
export const artistLines = () => []
