/**
 * The "at a glance" paragraph of a Where title page: what this one record
 * holds, said in sentences.
 *
 * `glanceFacts(r)` turns a title record (src/where/record-title.mjs) into
 * weighted sentences, each gated on the field it states. `glanceOf(r)` prints
 * the heaviest of them, leaving out any fact one of the page's folded
 * questions (faq.mjs) already answers, so a page never says a thing twice.
 *
 * Rules for anything added here:
 *   1. Never state a fact the record does not hold. No guessing, no filler.
 *   2. Never print a genre or tag from BLOCKED_TAGS.
 *   3. One wording per fact. Pages differ because their facts differ, never
 *      because a word was swapped.
 *   4. The show is "it": the heading above the paragraph already names it.
 *
 * Pure: the same record always gives the same sentences.
 */
import { BLOCKED_TAGS } from '../lib/prose.mjs'
import { listWords } from './hub-extras.mjs'
import { airDate, partialDate, plural, sourceWord } from './words.mjs'

/** How many sentences the paragraph prints. */
export const GLANCE_MAX = 6

const num = (n) => Number(n).toLocaleString('en-US')
const names = (people, limit = 2) => listWords((people || []).slice(0, limit).map((p) => p.name))
const keyOf = (r, label) => (r.key || []).find((k) => k.label === label)?.people || []
const voicesIn = (c, language) => (c.voices || []).filter((v) => v.language === language).map((v) => v.name)

/** The sources that read naturally as "adapted from a ...". */
const ADAPTED_FROM = new Set(['MANGA', 'LIGHT_NOVEL', 'VISUAL_NOVEL', 'VIDEO_GAME', 'NOVEL', 'WEB_NOVEL', 'COMIC', 'GAME', 'PICTURE_BOOK', 'DOUJINSHI'])

/** Genres a page may print, in AniList's order. */
export const cleanGenres = (r) => (r.genres || []).filter((g) => !BLOCKED_TAGS.has(g))

// Each fact: (record, now) -> a sentence, or '' when the record lacks the field.
// `faq` names the question (faq.mjs) that says the same thing, when one does.

function nextFact(r, now) {
  const next = r.nextEpisode
  if (!next || !(next.at > now)) return ''
  return `Episode ${next.number} airs on ${airDate(next.at)}.`
}

function orderFact(r) {
  const w = r.watch
  if (!w || !(w.total > 1)) return ''
  const around = w.next ? `; ${w.next.title} comes next` : w.prev ? `; it follows ${w.prev.title}` : ''
  return `It is entry ${w.position} of ${w.total} in the ${w.name} watch order${around}.`
}

function sequelFact(r) {
  const related = r.related || []
  const sequel = related.find((t) => t.relation === 'Sequel')
  const prequel = related.find((t) => t.relation === 'Prequel')
  const year = (t) => (t.year ? ` (${t.year})` : '')
  if (sequel && prequel) return `It follows ${prequel.title}${year(prequel)}, and the story continues in ${sequel.title}${year(sequel)}.`
  if (sequel) return `The story continues in ${sequel.title}${year(sequel)}.`
  if (prequel) return `It follows ${prequel.title}${year(prequel)}.`
  return ''
}

/** What it is tied to besides a sequel: its main story, side stories, spin-offs. */
function familyFact(r) {
  const related = r.related || []
  const main = related.find((t) => t.relation === 'Main story')
  if (main) return `It is a side entry to ${main.title}.`
  const sides = related.filter((t) => t.relation === 'Side story' || t.relation === 'Spin-off')
  if (sides.length) return `It has ${plural(sides.length, 'side story', 'side stories')} listed here, starting with ${sides[0].title}.`
  return ''
}

function chartFact(r) {
  if (!r.chart?.rank) return ''
  return `It sits at #${num(r.chart.rank)} on AniList's ${r.chart.words} chart of all time.`
}

function songFact(r) {
  const songs = r.songs || []
  const first = songs.find((s) => s.type === 'OP')
  if (!first) return songs.length ? `It has ${plural(songs.length, 'theme song')} on record, all of them endings.` : ''
  const by = names(first.artists)
  const count = songs.length > 1 ? `It has ${plural(songs.length, 'theme song')}; the first opening is` : 'Its opening is'
  return `${count} “${first.title}”${by ? ` by ${by}` : ''}.`
}

function voiceFact(r) {
  const lead = (r.cast || []).find((c) => c.role === 'MAIN' && voicesIn(c, 'Japanese').length)
  if (!lead) return ''
  const en = voicesIn(lead, 'English')
  return `${voicesIn(lead, 'Japanese')[0]} voices ${lead.name} in Japanese${en.length ? `, and ${en[0]} in the English dub` : ''}.`
}

/** Voice casts beyond Japanese and English, by language. */
function dubsFact(r) {
  const languages = (r.dubs || []).map((d) => d.language).filter(Boolean)
  if (!languages.length) return ''
  const shown = languages.slice(0, 4)
  const more = languages.length > shown.length ? ` and ${plural(languages.length - shown.length, 'more language')}` : ''
  return `Voice casts are also listed in ${more ? shown.join(', ') : listWords(shown)}${more}.`
}

/** The credits the makers question does not cover: who wrote it, scored it and drew its characters. */
function crewFact(r) {
  const parts = [
    [keyOf(r, 'Series writer'), 'wrote the script'],
    [keyOf(r, 'Music'), 'wrote the music'],
    [keyOf(r, 'Character design'), 'designed the characters'],
  ].filter(([people]) => people.length)
  if (!parts.length) return ''
  return `${listWords(parts.map(([people, did]) => `${names(people)} ${did}`))}.`
}

function makersFact(r) {
  const studios = names(r.studios)
  const directors = names(keyOf(r, 'Director'))
  if (studios && directors) return `${directors} directed it at ${studios}.`
  if (directors) return `${directors} directed it.`
  return studios ? `${studios} animated it.` : ''
}

function sourceFact(r) {
  if (r.source === 'ORIGINAL') return 'It is an original story, not adapted from a manga, a novel or a game.'
  if (!ADAPTED_FROM.has(r.source)) return ''
  const word = sourceWord(r.source).toLowerCase()
  const creator = names(keyOf(r, 'Original creator'))
  return creator ? `It was adapted from the ${word} by ${creator}.` : `It was adapted from a ${word}.`
}

function recsFact(r) {
  const recs = (r.recs || []).slice(0, 2).map((t) => t.title).filter(Boolean)
  if (!recs.length) return ''
  return `AniList members who liked it most often recommend ${listWords(recs)}.`
}

function akaFact(r) {
  // A music video's other name is the programme it aired in, shared by hundreds of them.
  if (r.format === 'MUSIC') return ''
  const also = (r.synonyms || []).filter((s) => s && s !== r.title && s !== r.romaji).slice(0, 2)
  if (!also.length) return ''
  return `It is also known as ${listWords(also)}.`
}

function nativeFact(r) {
  // A "romaji" still in Japanese script is not a reading aid, so it is not printed as one.
  const romaji = r.romaji && r.romaji !== r.title && /^[\p{Script=Latin}\p{N}\p{P}\p{S}\p{Zs}]+$/u.test(r.romaji) ? r.romaji : ''
  if (!r.native || r.native === r.title) return romaji ? `Its romanised title is ${romaji}.` : ''
  return `Its original title is ${r.native}${romaji ? ` (${romaji})` : ''}.`
}

/** A run that crossed a calendar year; a single season is in the page's first line already. */
function runFact(r) {
  const first = partialDate(r.startDate)
  if (!first || !r.endYear || !r.startYear || r.endYear === r.startYear) return ''
  return `It ran from ${first} to ${r.endYear}.`
}

function episodesFact(r) {
  if (r.status !== 'FINISHED' || !(r.episodes > 1)) return ''
  return `It finished at ${plural(r.episodes, 'episode')}.`
}

function scoreFact(r) {
  const done = r.completed ? `${num(r.completed)} have finished it` : ''
  if (r.score) return `AniList members score it ${r.score} out of 100${done ? `, and ${done}` : ''}.`
  return done ? `${num(r.completed)} AniList members have finished it.` : ''
}

function genreFact(r) {
  const genres = cleanGenres(r).slice(0, 3)
  if (!genres.length) return ''
  return `AniList files it under ${listWords(genres)}.`
}

function streamFact(r) {
  const sites = (r.watchOn || []).map((w) => w.site)
  if (!sites.length) return ''
  return `AniList lists ${plural(sites.length, 'official stream')} for it, ${sites.length > 1 ? 'starting with' : 'on'} ${sites[0]}.`
}

// The heaviest first: what few shows can say outranks what every show can.
const FACTS = [
  { key: 'next', weight: 100, faq: 'next', say: nextFact },
  { key: 'order', weight: 92, faq: 'order', say: orderFact },
  { key: 'sequel', weight: 88, faq: 'sequel', say: sequelFact },
  { key: 'chart', weight: 84, say: chartFact },
  { key: 'family', weight: 80, say: familyFact },
  { key: 'song', weight: 76, faq: 'song', say: songFact },
  { key: 'dubs', weight: 72, say: dubsFact },
  { key: 'voice', weight: 68, faq: 'voice', say: voiceFact },
  { key: 'crew', weight: 64, say: crewFact },
  { key: 'source', weight: 60, faq: 'source', say: sourceFact },
  { key: 'makers', weight: 56, faq: 'makers', say: makersFact },
  { key: 'recs', weight: 52, say: recsFact },
  { key: 'run', weight: 48, say: runFact },
  { key: 'aka', weight: 44, say: akaFact },
  { key: 'score', weight: 40, say: scoreFact },
  { key: 'stream', weight: 36, faq: 'stream', say: streamFact },
  { key: 'episodes', weight: 32, faq: 'episodes', say: episodesFact },
  { key: 'genres', weight: 28, say: genreFact },
  { key: 'native', weight: 24, say: nativeFact },
]

/** Every sentence this record can say: [{ key, weight, faq, text }], the heaviest first. */
export function glanceFacts(r, now = Math.floor(Date.now() / 1000)) {
  return FACTS.map(({ key, weight, faq, say }) => ({ key, weight, faq, text: say(r, now) })).filter((fact) => fact.text)
}

/**
 * The sentences the page prints, never more than GLANCE_MAX.
 * `answered`: the keys of the questions the page already shows (faqOf().key).
 */
export function glanceOf(r, { now, answered = [] } = {}) {
  const said = new Set(answered)
  return glanceFacts(r, now)
    .filter((fact) => !fact.faq || !said.has(fact.faq))
    .slice(0, GLANCE_MAX)
    .map((fact) => fact.text)
}
