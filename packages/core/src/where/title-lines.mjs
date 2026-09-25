/**
 * The short lines at the top of a Where title page, the home site's quick
 * strip, pills and one-sentence answer, said the way this site speaks: about
 * the show, its episodes and who made it. Worked out from one title record
 * (src/where/record-title.mjs), so they can never disagree with the page.
 *
 * Pure.
 */
import { formatInSentence, statusWord, seasonWord, plural } from './words.mjs'
import { listWords } from './hub-extras.mjs'

const num = (n) => Number(n).toLocaleString('en-US')

/**
 * The quick strip: only real numbers, the score first and lit. Fewer than
 * three and the strip is not drawn at all (the head already has the facts).
 */
export function quickStats(r) {
  return [
    r.score ? { label: 'AniList score', value: (r.score / 10).toFixed(1), hot: true } : null,
    r.chart ? { label: `${r.chart.words[0].toUpperCase()}${r.chart.words.slice(1)}`, value: `#${num(r.chart.rank)}` } : null,
    r.watching ? { label: 'Watching now', value: num(r.watching) } : null,
    r.completed ? { label: 'Finished it', value: num(r.completed) } : null,
    r.favourites ? { label: 'Favourites', value: num(r.favourites) } : null,
    (r.watchOn || []).length ? { label: 'Official streams', value: String(r.watchOn.length) } : null,
  ].filter(Boolean)
}

/** The pills: airing or not, and how many official places stream it. */
export function pills(r, freeNames = []) {
  const streams = (r.watchOn || []).length
  return [
    { text: statusWord(r.status), live: r.status === 'RELEASING' },
    streams ? { text: `${plural(streams, 'official stream')}` } : null,
    freeNames.length ? { text: `Free on ${listWords(freeNames.slice(0, 2))}` } : null,
  ].filter(Boolean)
}

// A status as it reads before the format: "a finished TV series".
const STATUS_WORDS = {
  FINISHED: 'finished',
  RELEASING: 'currently airing',
  NOT_YET_RELEASED: 'upcoming',
  CANCELLED: 'cancelled',
  HIATUS: 'paused',
}

/**
 * One sentence that answers what the reader came for: what the show is, how
 * long, when, where it streams, and what this page holds.
 */
export function answerLine(r, freeNames = []) {
  const what = formatInSentence(r.format)
  const studio = r.studios?.[0]?.name
  const status = STATUS_WORDS[r.status] || ''
  const when = seasonWord(r.season, r.seasonYear) || (r.startYear ? String(r.startYear) : '')
  const count = r.episodes ? `, ${plural(r.episodes, 'episode')}` : ''
  const described = `${status ? `${status} ` : ''}${what}`
  const article = /^[aeiou]/i.test(described) ? 'an' : 'a'
  const aired = r.status === 'NOT_YET_RELEASED' ? 'due' : 'first aired'
  const first = `${r.title} is ${article} ${described}${studio ? ` by ${studio}` : ''}${count}${when ? `, ${aired} ${when}` : ''}.`
  const sites = (r.watchOn || []).map((s) => s.site)
  const where = sites.length
    ? ` It streams officially on ${listWords(sites.slice(0, 3))}${sites.length > 3 ? ` and ${sites.length - 3} more` : ''}${freeNames.length ? `, and ${listWords(freeNames.slice(0, 2))} ${freeNames.length === 1 ? 'has' : 'have'} a free tier` : ''}.`
    : ' No official stream is listed for it yet.'
  const holds = [
    r.dated ? 'every dated episode' : '',
    (r.cast || []).some((c) => c.voices?.length) ? 'the voice cast' : '',
    (r.key || []).length || (r.crew || []).length ? 'the staff' : '',
    (r.songs || []).length ? 'its songs' : '',
  ].filter(Boolean)
  return `${first}${where}${holds.length ? ` Below: ${listWords(holds)}.` : ''}`
}
