/**
 * Reel "Airing today": today's new episodes, one show per slide in order of
 * air time.
 *
 * Data: the episodes the "New episode today" post offers (episode.mjs: a
 * show with an official stream and enough readers), the most followed
 * MAX_ITEMS of them. It needs MIN_ITEMS, and is made once a day. Off until
 * its name is written in FB_POST_TYPES.
 */
import { END_LINE, endSlide, itemSlide, titleSlide } from '../reel/slides.mjs'
import { tagOf, uniqueTags } from '../story.mjs'
import { clip, listOf } from '../text.mjs'
import { dateOf, dayMonthOf, weekdayOf } from '../when.mjs'
import episode from './episode.mjs'
import { ctaOf } from './shared.mjs'

export const MIN_ITEMS = 3
export const MAX_ITEMS = 6

const itemOf = (post) => ({ time: post.view.time.replace(/ ET$/, ''), title: clip(post.title, 60), note: [`Episode ${post.view.number}`, post.view.platforms[0]].filter(Boolean).join(' · ') })

/** The reel for these episodes (most followed first), shown in order of air time. */
function toPost(all, now) {
  const shown = all.slice(0, MAX_ITEMS).sort((x, y) => x.at - y.at)
  const lead = all[0]
  return {
    item: `today:${dateOf(now)}`,
    title: null,
    path: lead.path,
    label: `${lead.title}: episode dates and where to watch`,
    names: all.slice(0, 3).map((post) => post.title),
    total: all.length,
    tags: uniqueTags([...all.slice(0, 3).map((post) => tagOf(post.title)), '#NewEpisode', '#anime', '#AnimeRecommendation']),
    art: { thumbs: shown.map((post) => post.art.hero) },
    view: { date: `${weekdayOf(now)} ${dayMonthOf(now)}`, items: shown.map(itemOf) },
    without: (blank) => {
      const drop = new Set(blank.map((i) => shown[i]))
      const rest = all.filter((post) => !drop.has(post))
      return rest.length >= MIN_ITEMS ? toPost(rest, now) : null
    },
  }
}

function find(data, { now }) {
  const today = episode.find(data, { now })
  return today.length >= MIN_ITEMS ? [toPost(today, now)] : []
}

const captions = [
  (p) => ({ hook: `📺 ${p.total} anime air a new episode today, ${p.view.date}.`, facts: [`Among them: ${listOf(p.names)}.`, 'All times are US Eastern.'], cta: ctaOf('first', 0) }),
  (p) => ({ hook: `⏰ Today's new anime episodes, in order of air time.`, facts: [`${listOf(p.names)} lead the day.`, 'All times are US Eastern.'], cta: ctaOf('first', 1) }),
  (p) => ({ hook: `🚨 New episode day 🚨 ${listOf(p.names)}.`, facts: [`${p.total} shows in all, ${p.view.date}.`], cta: ctaOf('first', 2) }),
]

const questions = [() => 'Which one are you watching first?', (p) => `Are you keeping up with ${p.names[0]}?`, () => 'Which of these is your pick of the day?']

function slides(v, k) {
  return [
    titleSlide(k, { kicker: v.date, lines: [{ text: 'AIRING' }, { text: 'TODAY', pop: true }], sub: 'New episodes, in order of air time. Times are US Eastern.' }),
    ...v.items.map((row, i) => itemSlide(k, { tag: row.time, tagNote: 'ET', picture: v.art.thumbs[i], title: row.title, note: row.note, step: `${i + 1} / ${v.items.length}` })),
    endSlide(k, { head: 'Episode dates and where to watch', line: END_LINE }),
  ]
}

export default { key: 'reel-today', name: 'Reel: airing today', reel: true, urgent: false, gapDays: 300, titleGap: false, window: 1, find, captions, questions, tags: (p) => p.tags, slides }
