/**
 * The words each page type prints, as plain text, for the measure script
 * (scripts/measure-where.mjs): `site` is what this site wrote, `other` is the
 * synopsis or bio it quotes from AniList, `names` are masked before two pages
 * are compared. Each builder calls the same functions the page calls, so the
 * measure reads what a reader reads. The fixed notes a page prints are listed
 * here beside the condition that prints them; keep them in step with the page
 * (sites/anime/src/pages).
 *
 * Pure.
 */
import { freeSplit } from '../lib/answers.mjs'
import { answerLine, dubOf } from './title-lines.mjs'
import { faqOf } from './faq.mjs'
import { glanceOf } from './title-glance.mjs'
import { animeShopRows } from './shop.mjs'
import { animeBuyCopy, supportLine } from './buy-copy.mjs'
import { showsBuyBox } from './title-depth.mjs'
import { plural } from './words.mjs'
import { listWords } from './hub-extras.mjs'
import { voiceFacts, voiceLede, staffLede, artistLede, voiceLines, staffLines, artistLines } from './person-facts.mjs'

const join = (parts) => parts.filter(Boolean).join(' ')

/** The cast note of a title page, or '' when the cast has no voices. */
export function castNote(r) {
  const cast = r.cast || []
  const voicedIn = (language) => cast.filter((c) => (c.voices || []).some((v) => v.language === language)).length
  const japanese = voicedIn('Japanese')
  const english = voicedIn('English')
  if (!japanese && !english) return ''
  const of = plural(cast.length, 'character')
  if (japanese && english) return `Japanese voices for ${japanese} and English dub voices for ${english} of ${of}.`
  return `${japanese ? 'Japanese' : 'English'} voices for ${japanese || english} of ${of}.`
}

/** The note over "You may also like": the genres the picks share with this show, by name. */
export function similarNote(r) {
  const counts = new Map()
  for (const card of r.similar || []) for (const genre of card.shared || []) counts.set(genre, (counts.get(genre) || 0) + 1)
  const top = [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 3).map(([genre]) => genre)
  return top.length ? `Picked for what they share with ${r.title}: ${listWords(top)}.` : `Shows close to ${r.title} in genre and theme.`
}

/** r: a title record. siteName: the config's name. now: unix seconds. */
export function titleText(r, { siteName = '', now } = {}) {
  const watchOn = r.watchOn || []
  const freeNames = freeSplit(watchOn).free.map((row) => row.link.site)
  const buys = showsBuyBox(r) ? animeShopRows(r, 'US') : []
  const buy = buys.length ? animeBuyCopy(r, buys) : null
  const faq = faqOf(r, now)
  const site = join([
    answerLine(r, freeNames),
    dubOf(r)?.dubbed ? dubOf(r).line : '',
    watchOn.length ? `${listWords(watchOn.slice(0, 3).map((w) => w.site))}${watchOn.length > 3 ? ` and ${watchOn.length - 3} more` : ''}, as listed on AniList. What each one carries depends on your country.` : '',
    buy ? `${buy.heading}. ${buy.sub} ${buys.map((row) => `${row.label}. ${row.note}.`).join(' ')}` : '',
    buy && !r.picks ? supportLine(siteName) : '',
    ...glanceOf(r, { now, answered: faq.map((f) => f.key) }),
    castNote(r),
    (r.recs || []).length ? `What AniList members recommend to people who liked ${r.title}.` : '',
    (r.similar || []).length ? similarNote(r) : '',
    ...faq.map((f) => `${f.q} ${f.a}`),
  ])
  const names = [r.title, r.romaji, ...(r.studios || []).map((s) => s.name), ...watchOn.map((w) => w.site)]
  return { site, other: r.description || '', names }
}

/** p: a person record with a voice page. */
export function voiceText(p) {
  const glance = voiceFacts(p)
  const sheet = glance.rows.length > 2 ? glance.rows.map(([label, value]) => `${label}: ${value}.`).join(' ') : ''
  const names = (rows, noun) => (rows || []).map((row) => `${row.name}: ${plural(row.count, noun)}.`).join(' ')
  const site = join([voiceLede(p), sheet, ...voiceLines(p), names(p.costars, 'shared show'), names(p.voiceStudios, 'show')])
  return { site, other: glance.bio || '', names: [p.name] }
}

/** p: a person record with a staff page. */
export function staffText(p) {
  const groups = (p.works || []).map((g) => `${g.label}: ${plural(g.items.length, 'anime', 'anime')}.`).join(' ')
  const names = (rows, noun) => (rows || []).map((row) => `${row.name}: ${plural(row.count, noun)}.`).join(' ')
  const site = join([staffLede(p), groups, ...staffLines(p), names(p.collaborators, 'shared show'), names(p.staffStudios, 'show')])
  return { site, other: p.bio || '', names: [p.name] }
}

/** a: an artist record. */
export function artistText(a) {
  const site = join([artistLede(a), ...artistLines(a), `Songs by ${a.name}: ${plural(a.songs.length, 'song')}.`])
  return { site, other: '', names: [a.name] }
}
