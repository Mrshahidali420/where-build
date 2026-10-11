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
import { plural, formatWord } from './words.mjs'

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
    p.favourites ? ['AniList favourites', plural(p.favourites, 'person', 'people')] : null,
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
  const parts = [ops && plural(ops, 'opening'), eds && plural(eds, 'ending')].filter(Boolean)
  return `${parts.join(' and ')} in ${plural(shows, 'anime', 'anime')}, newest show first.`
}

/** "a", "a and b", "a, b and c". */
const listed = (words) => (words.length <= 1 ? words[0] || '' : `${words.slice(0, -1).join(', ')} and ${words.at(-1)}`)

/** The years the rows cover and the one year with the most of them: { first, last, peak, peakCount } or null. */
export function yearFacts(years) {
  const dated = years.filter(Boolean)
  if (!dated.length) return null
  const perYear = new Map()
  for (const year of dated) perYear.set(year, (perYear.get(year) || 0) + 1)
  const ranked = [...perYear].sort((a, b) => b[1] - a[1] || b[0] - a[0])
  // A peak is a fact only when one year stands alone at the top, with 3 or more.
  const alone = ranked[0][1] >= 3 && (ranked.length === 1 || ranked[1][1] < ranked[0][1])
  return { first: Math.min(...dated), last: Math.max(...dated), peak: alone ? ranked[0][0] : null, peakCount: alone ? ranked[0][1] : 0 }
}

/**
 * A voice actor's page in sentences, each one a fact worked out from their
 * own record and left out when the record does not hold it: the years their
 * roles span and the busiest one, the role from the most watched show, the
 * character they come back to most, the languages they are credited in.
 * Nothing is reworded from page to page: a different page reads differently
 * because its facts differ.
 */
export function voiceLines(p) {
  const roles = p.roles || []
  const lines = []
  const years = yearFacts(roles.map((r) => r.year))
  if (years && years.last > years.first) {
    lines.push(
      `The roles listed here run from ${years.first} to ${years.last}` +
        (years.peak ? `, and ${years.peak} was the busiest year, with ${plural(years.peakCount, 'role')}.` : '.'),
    )
  }
  const known = p.voiceKnown
  if (known) lines.push(`The most watched show on the list is ${known.title}, where ${p.name} voices ${known.character}${known.main ? ', a main character' : ''}.`)
  const perCharacter = new Map()
  for (const r of roles) perCharacter.set(r.character.name, (perCharacter.get(r.character.name) || new Set()).add(r.href))
  const [again, shows] = [...perCharacter].sort((a, b) => b[1].size - a[1].size || a[0].localeCompare(b[0]))[0] || []
  if (again && shows.size >= 3) lines.push(`${again} is the character ${p.name} has come back to most, across ${plural(shows.size, 'show')}.`)
  const perLanguage = new Map()
  for (const r of roles) if (r.language) perLanguage.set(r.language, (perLanguage.get(r.language) || 0) + 1)
  if (perLanguage.size > 1) {
    const parts = [...perLanguage].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([language, n]) => `${language} (${plural(n, 'role')})`)
    lines.push(`${p.name} is credited in ${listed(parts)}.`)
  }
  return lines
}

/** A staff member's page in sentences, by the same rule as voiceLines. */
export function staffLines(p) {
  const byShow = new Map()
  for (const group of p.works || []) for (const item of group.items) byShow.set(item.href, item)
  const items = [...byShow.values()]
  const lines = []
  const years = yearFacts(items.map((item) => item.year))
  if (years && years.last > years.first) {
    lines.push(
      `The credits listed here run from ${years.first} to ${years.last}` +
        (years.peak ? `, with the most in ${years.peak}: ${plural(years.peakCount, 'show')}.` : '.'),
    )
  }
  const known = p.staffKnown
  if (known) lines.push(`The most watched of them is ${known.title}${known.roles?.length ? `, where ${p.name} is credited for ${listed(known.roles)}` : ''}.`)
  const perFormat = new Map()
  for (const item of items) if (item.format) perFormat.set(item.format, (perFormat.get(item.format) || 0) + 1)
  if (perFormat.size > 1) {
    const parts = [...perFormat].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 3).map(([format, n]) => `${n} ${formatWord(format)}`)
    lines.push(`By format: ${listed(parts)}.`)
  }
  const groups = (p.works || []).filter((g) => g.items.length && g.key !== 'other')
  if (groups.length > 1) {
    const second = [...groups].sort((a, b) => b.items.length - a.items.length)[1]
    lines.push(`The second largest group of credits is "${second.label}", on ${plural(second.items.length, 'show')}.`)
  }
  return lines
}

/** A song artist's page in sentences, by the same rule. */
export function artistLines(a) {
  const songs = a.songs || []
  const lines = []
  const years = yearFacts(songs.map((s) => s.anime.year))
  if (years && years.last > years.first) {
    lines.push(`The songs listed here run from ${years.first} to ${years.last}` + (years.peak ? `, with ${plural(years.peakCount, 'song')} in ${years.peak} alone.` : '.'))
  }
  const perShow = new Map()
  for (const s of songs) perShow.set(s.anime.title, (perShow.get(s.anime.title) || 0) + 1)
  const [show, count] = [...perShow].sort((x, y) => y[1] - x[1] || x[0].localeCompare(y[0]))[0] || []
  if (show && count >= 2 && perShow.size > 1) lines.push(`${show} uses the most of them: ${plural(count, 'song')}.`)
  const word = (s) => (s.type === 'OP' ? 'opening' : 'ending')
  const newest = songs[0]
  const oldest = songs.at(-1)
  if (newest?.anime.year && oldest?.anime.year && oldest !== newest && newest.anime.year !== oldest.anime.year) {
    lines.push(`The earliest is "${oldest.title}", an ${word(oldest)} of ${oldest.anime.title} (${oldest.anime.year}), and the newest is "${newest.title}", from ${newest.anime.title} (${newest.anime.year}).`)
  }
  return lines
}
