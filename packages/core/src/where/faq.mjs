/**
 * The questions a title page answers in so many words, each built only from
 * facts the same page prints (its episodes, air dates, cast, credits, songs,
 * watch order and official streams). The page shows them folded, and the same
 * list becomes its FAQPage structured data, so the two can never disagree.
 * A question with no answer in the data is left out, never guessed.
 *
 * Pure: a title record (src/where/record-title.mjs) in, [{ q, a }] out.
 */
import { airDate, partialDate, plural, seasonWord } from './words.mjs'

const MAX = 6

/** "A", "A and B", "A, B and C". */
export function listWords(names) {
  const list = names.filter(Boolean)
  if (list.length < 2) return list[0] || ''
  return `${list.slice(0, -1).join(', ')} and ${list[list.length - 1]}`
}

const clock = (at) => new Date(at * 1000).toISOString().slice(11, 16)
const names = (people) => listWords((people || []).map((p) => p.name))
const keyOf = (r, label) => r.key.find((k) => k.label === label)?.people || []

function episodesAnswer(r, now) {
  const aired = r.rows.filter(([, , at]) => at > 0 && at <= now).length
  const first = partialDate(r.startDate)
  if (r.status === 'FINISHED' && r.episodes) {
    const span = first && r.endYear ? ` It first aired on ${first} and finished in ${r.endYear}.` : first ? ` It first aired on ${first}.` : ''
    return { q: `How many episodes does ${r.title} have?`, a: `${r.title} has ${plural(r.episodes, 'episode')}.${span}` }
  }
  if (r.status === 'RELEASING') {
    const planned = r.episodes ? ` It is planned to run ${plural(r.episodes, 'episode')}.` : ''
    const so = aired ? `${plural(aired, 'episode')} have aired so far.` : 'It has started airing.'
    return { q: `How many episodes of ${r.title} are out?`, a: `${r.title} is still airing. ${so}${planned}` }
  }
  if (r.status === 'NOT_YET_RELEASED') {
    const when = first || seasonWord(r.season, r.seasonYear)
    if (!when) return null
    return { q: `When does ${r.title} come out?`, a: `${r.title} is due to start airing ${first ? `on ${first}` : `in ${when}`}. Dates can still move.` }
  }
  return null
}

function nextAnswer(r, now) {
  const next = r.nextEpisode
  if (!next || !(next.at > now)) return null
  return {
    q: `When does episode ${next.number} of ${r.title} come out?`,
    a: `Episode ${next.number} of ${r.title} airs on ${airDate(next.at)} at ${clock(next.at)} UTC, when it first airs in Japan.`,
  }
}

function voiceAnswer(r) {
  const lead = r.cast.find((c) => c.role === 'MAIN' && c.voices.some((v) => v.language === 'Japanese'))
  if (!lead) return null
  const jp = lead.voices.filter((v) => v.language === 'Japanese').map((v) => v.name)
  const en = lead.voices.filter((v) => v.language === 'English').map((v) => v.name)
  return {
    q: `Who voices ${lead.name} in ${r.title}?`,
    a: `${lead.name} is voiced by ${listWords(jp)} in Japanese${en.length ? ` and by ${listWords(en)} in the English dub` : ''}.`,
  }
}

function makersAnswer(r) {
  const studios = names(r.studios)
  const directors = names(keyOf(r, 'Director'))
  const creator = names(keyOf(r, 'Original creator'))
  if (!studios && !directors) return null
  const parts = [studios && `animated by ${studios}`, directors && `directed by ${directors}`].filter(Boolean).join(' and ')
  return { q: `Who made ${r.title}?`, a: `${r.title} was ${parts}${creator ? `, based on the work of ${creator}` : ''}.` }
}

function streamAnswer(r) {
  const sites = (r.watchOn || []).map((w) => w.site)
  if (!sites.length) return null
  return {
    q: `Where can I watch ${r.title}?`,
    a: `${r.title} is listed on ${listWords(sites.slice(0, 5))}${sites.length > 5 ? ` and ${plural(sites.length - 5, 'more service')}` : ''}. What each one offers depends on your country.`,
  }
}

function orderAnswer(r) {
  const w = r.watch
  if (!w) return null
  const around = [w.prev && `${w.prev.title} comes before it`, w.next && `${w.next.title} comes after it`].filter(Boolean)
  return {
    q: `What order should I watch ${w.name} in?`,
    a: `${r.title} is number ${w.position} of ${w.total} in the ${w.name} watch order, in release order.${around.length ? ` ${listWords(around)}.` : ''}`,
  }
}

function songAnswer(r) {
  const openings = r.songs.filter((s) => s.type === 'OP')
  const first = openings[0]
  if (!first) return null
  const by = names(first.artists)
  const lead = openings.length > 1 ? `${r.title} has ${openings.length} opening songs. The first is` : `The opening song of ${r.title} is`
  return { q: `What is the opening song of ${r.title}?`, a: `${lead} "${first.title}"${by ? ` by ${by}` : ''}.` }
}

/** The page's questions, most asked first, never more than six. */
export function faqOf(r, now = Math.floor(Date.now() / 1000)) {
  return [episodesAnswer(r, now), nextAnswer(r, now), voiceAnswer(r), makersAnswer(r), orderAnswer(r), songAnswer(r), streamAnswer(r)]
    .filter(Boolean)
    .slice(0, MAX)
}
