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
import { answerLine, castLanguages, dubOf } from './title-lines.mjs'
import { faqOf } from './faq.mjs'
import { animeShopRows } from './shop.mjs'
import { animeBuyCopy, supportLine } from './buy-copy.mjs'
import { showsBuyBox } from './title-depth.mjs'
import { plural } from './words.mjs'
import { voiceFacts, voiceLede, staffLede, artistLede, voiceLines, staffLines, artistLines } from './person-facts.mjs'

const join = (parts) => parts.filter(Boolean).join(' ')

/** The cast note of a title page, or '' when the cast has no voices. */
export function castNote(r) {
  const cast = r.cast || []
  if (!cast.some((c) => c.voices.length > 0)) return ''
  const dub = dubOf(r)
  return castLanguages(r).includes('English')
    ? `The Japanese voice and the English dub voice side by side (English for ${dub.voiced} of ${plural(cast.length, 'character')}).`
    : 'Japanese voices. AniList lists no English dub cast for it.'
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
    watchOn.length ? 'Official streams listed on AniList. What each one carries depends on your country.' : '',
    buy ? `${buy.heading}. ${buy.sub} ${buys.map((row) => `${row.label}. ${row.note}.`).join(' ')}` : '',
    buy && !r.picks ? supportLine(siteName) : '',
    castNote(r),
    (r.songs || []).length ? 'Each song opens a search for it on YouTube, Spotify or Amazon.' : '',
    (r.recs || []).length ? `What AniList members recommend to people who liked ${r.title}.` : '',
    (r.similar || []).length ? 'Shows that share its genres and themes, the most watched first.' : '',
    ...faq.map((f) => `${f.q} ${f.a}`),
  ])
  const names = [r.title, r.romaji, ...(r.studios || []).map((s) => s.name), ...watchOn.map((w) => w.site)]
  return { site, other: r.description || '', names }
}

/** p: a person record with a voice page. */
export function voiceText(p) {
  const glance = voiceFacts(p)
  const sheet = glance.rows.length > 2 ? glance.rows.map(([label, value]) => `${label}: ${value}.`).join(' ') : ''
  const site = join([voiceLede(p), sheet, ...voiceLines(p), 'Newest show first.'])
  return { site, other: glance.bio || '', names: [p.name] }
}

/** p: a person record with a staff page. */
export function staffText(p) {
  const groups = (p.works || []).map((g) => `${g.label}: ${plural(g.items.length, 'anime', 'anime')}.`).join(' ')
  const site = join([staffLede(p), groups, ...staffLines(p), (p.collaborators || []).length ? 'Works most often with.' : ''])
  return { site, other: p.bio || '', names: [p.name] }
}

/** a: an artist record. */
export function artistText(a) {
  const site = join([artistLede(a), ...artistLines(a), `Songs by ${a.name}: ${plural(a.songs.length, 'song')}.`])
  return { site, other: '', names: [a.name] }
}
