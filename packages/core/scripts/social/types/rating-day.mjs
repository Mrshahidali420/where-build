/**
 * "Top-rated episodes right now": the same card as the week's list (rating-week.mjs), more often.
 *
 * Data: the day's IMDb snapshot (ratings/load.mjs): the best episode of each show that aired in the
 * last seven days with at least MIN_VOTES votes, the top four, three at least. New episodes get few
 * votes (checked 8 Nov 2026: one show had 500 votes inside three days, four had 100 inside seven), so
 * the bar is lower than the weekly list's. It is named by the episodes in it, so the same list is never
 * posted twice inside three days, and a new episode that changes it makes a new post.
 * Urgent: it goes out when it has news, as an extra post next to the others (the cap per day is set
 * in FB_TYPE_CAPS, e.g. rating-day:2). Off until its name is written in FB_POST_TYPES.
 */
import { tagOf, uniqueTags } from '../story.mjs'
import { ctaOf } from './shared.mjs'
import { ratingsExtra } from '../ratings/load.mjs'
import { findIn, templateWith } from './rating-week.mjs'

export const DAY_WINDOW_MS = 7 * 86_400_000
export const MIN_VOTES = 100

const find = (data, { now }) =>
  findIn(data, now, { windowMs: DAY_WINDOW_MS, minVotes: MIN_VOTES, itemOf: (rows) => `day:${rows.map((r) => r.id || `${r.titleId}.${r.ep}`).join('+')}` }).map((post) => ({
    ...post,
    tags: uniqueTags([...post.names.slice(0, 2).map((name) => tagOf(name)), '#AnimeRatings']).filter((tag) => !/amazon/i.test(tag)).slice(0, 3),
  }))

const captions = [
  (p) => ({ hook: '🔥👀 THE BEST-RATED ANIME EPISODES RIGHT NOW ON IMDb!', facts: [`${p.lead.title} episode ${p.lead.episode} leads with ${p.lead.score}/10.`], cta: ctaOf('first', 0) }),
  (p) => ({ hook: `⭐ ${p.lead.title.toUpperCase()} HAS THE TOP-RATED EPISODE THIS WEEK!`, facts: [`Episode ${p.lead.episode} holds ${p.lead.score}/10 on IMDb.`], cta: ctaOf('first', 1) }),
  (p) => ({ hook: '📈 FRESH EPISODE SCORES ARE IN, BY IMDb RATING!', facts: [`${p.names.length} shows made the list.`], cta: ctaOf('first', 2) }),
]

const questions = [() => '💬 Which anime delivered the best episode this week?', () => '💬 Which of these was your pick?', () => '💬 Which score would you change?']

export default {
  key: 'rating-day',
  name: 'Top-rated episodes right now',
  urgent: true,
  gapDays: 3,
  titleGap: false,
  window: 1,
  find,
  captions,
  questions,
  tags: (p) => p.tags,
  template: templateWith('TOP-RATED EPISODES'),
  extra: ratingsExtra,
}
