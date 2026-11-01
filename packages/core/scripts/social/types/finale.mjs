/**
 * "Final episode": the last episode of a show airs today.
 * Airing news (tasks/airing-queue-plan.md): urgent, and its own post even
 * when the title had another post today (`sameDay`, plan.mjs).
 *
 * Data: an airing schedule row of today whose episode is the show's last
 * (the record's episode count, more than one), popular enough, with a stream.
 *
 * Image: the two looks of the "Out now" card (out-now.mjs), with the words
 * of a finale.
 */
import { dateOf } from '../when.mjs'
import { ctaOf } from './shared.mjs'
import { GRID, airingPost, airingRows, gridCard, heroCard } from './out-now.mjs'
import { stillsExtra } from '../stills/load.mjs'

function find(data, { now }) {
  const today = dateOf(now)
  return airingRows(data, (row) => dateOf(row.at * 1000) === today)
    .filter(({ row, title }) => title.episodes > 1 && row.episode === title.episodes)
    .map(({ row, title }) => ({ ...airingPost(data, title, row, { mark: 'final' }), aired: row.at * 1000 <= now }))
}

const loud = (p) => p.title.toUpperCase()
const when = (p) => (p.aired ? 'AIRED' : 'AIRS')

const captions = [
  (p) => ({ hook: `🔥 THE FINAL EPISODE OF ${loud(p)} ${when(p)} TODAY!`, facts: [p.fact], cta: ctaOf('episode', 0) }),
  (p) => ({ hook: `🚨 ${loud(p)} ENDS TODAY WITH EPISODE ${p.episode}!`, facts: [p.fact], cta: ctaOf('episode', 1) }),
  (p) => ({ hook: `📺 IT IS FINALE DAY FOR ${loud(p)}!`, facts: [`Episode ${p.episode} is the last one.`, p.fact], cta: ctaOf('episode', 2) }),
]

const questions = [(p) => `💬 How do you want ${p.title} to end?`, () => '💬 Will you miss this one?', (p) => `💬 Was ${p.title} worth watching to the end?`]

const template = (v, k) =>
  v.art.frames?.length >= GRID.min
    ? gridCard(v, k, { kicker: ['The final episode airs', 'TODAY'], head: [`EPISODE ${v.episode}`, ['THE', 'FINALE']], spaced: v.spaced })
    : heroCard(v, k, ['FINAL EPISODE', 'TODAY'])

export default { key: 'finale', name: 'Final episode today', urgent: true, sameDay: true, gapDays: 300, titleGap: false, window: 1, find, captions, questions, tags: (p) => p.tags, template, extra: stillsExtra }
