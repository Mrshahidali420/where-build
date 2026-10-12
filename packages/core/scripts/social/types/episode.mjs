/**
 * "New episode today": one post per episode on today's airing schedule.
 *
 * Data: the airing schedule rows whose time falls on this posting day, joined
 * to the title. An episode whose time has passed is written as aired; one
 * still to come as airing. Urgent: it goes before the rotation (plan.mjs).
 *
 * Image: the episode number as the biggest thing on the page, the cover whole
 * on the right, the time under the number.
 */
import { clip, fitSize, listOf, sentence } from '../text.mjs'
import { dateOf, shortDayMonthOf, shortWeekdayOf, timeOf } from '../when.mjs'
import { INNER } from '../render/parts.mjs'
import { byPopularity, streamsLine, TITLE_MAX, TITLE_STEPS, top, uniqueBy, usable } from './shared.mjs'

export const MIN_POPULARITY = 3000
/** The size of the number by how many digits it has. */
const NUMBER_STEPS = [[1, 330], [2, 262], [3, 176], [4, 132]]

function toPost(title, row, now) {
  const at = row.at * 1000
  return {
    item: `${title.id}:${row.episode}`,
    title: title.title,
    path: title.path,
    label: 'Episode dates and where to watch',
    genre: title.genres[0],
    art: { hero: title.image },
    view: {
      title: clip(title.title, TITLE_MAX),
      number: row.episode,
      time: `${timeOf(at)} ET`,
      aired: at <= now,
      day: `${shortWeekdayOf(now)} ${shortDayMonthOf(now)}`,
      platforms: top(title.platforms),
      studio: title.studio,
    },
  }
}

function find(data, { now }) {
  const today = dateOf(now)
  const rows = (data.schedule || [])
    .filter((row) => row.mediaId && row.episode > 0 && dateOf(row.at * 1000) === today)
    .map((row) => ({ row, title: data.byId.get(row.mediaId) }))
    .filter(({ title }) => title && title.platforms.length && title.popularity >= MIN_POPULARITY && usable(title))
    .sort((x, y) => byPopularity(x.title, y.title))
  return uniqueBy(rows, ({ row }) => `${row.mediaId}:${row.episode}`).map(({ row, title }) => toPost(title, row, now))
}

const when = (v) => `${v.aired ? 'aired' : 'airs'} today at ${v.time}`

const captions = [
  (p) => [`Episode ${p.view.number} of ${p.title} ${when(p.view)}.`, streamsLine(p.view.platforms), p.view.studio && sentence(`Animation by ${p.view.studio}`)],
  (p) => [`New episode day for ${p.title}: episode ${p.view.number} ${when(p.view)}.`, streamsLine(p.view.platforms, 'Watch it on')],
  (p) => [`${p.title} is back today with episode ${p.view.number}.`, `It ${p.view.aired ? 'aired' : 'airs'} at ${p.view.time}.`, streamsLine(p.view.platforms, 'Official streams:')],
]

function template(v, k) {
  const t = k.tone('dark')
  return k.page(
    t,
    k.row({ justifyContent: 'space-between', alignItems: 'flex-end' }, k.kicker('New episode', { color: t.pop }), k.kicker(v.day, { color: t.soft })),
    k.rule(t.line, 2, { marginTop: 20 }),
    k.row(
      { marginTop: 36, height: 730, justifyContent: 'space-between' },
      k.col(
        { width: 390, justifyContent: 'space-between' },
        k.col(
          {},
          k.display({ fontSize: 40, color: t.soft, letterSpacing: 8 }, 'EPISODE'),
          k.display({ fontSize: fitSize(String(v.number), NUMBER_STEPS), fontWeight: k.f.displayBlack, color: t.pop, lineHeight: 1, marginTop: 4, marginLeft: -6 }, v.number),
        ),
        k.col(
          {},
          k.kicker(v.aired ? 'Aired today' : 'Airs today', { color: t.soft, fontSize: 24 }),
          k.display({ fontSize: 42, marginTop: 8 }, v.time),
        ),
      ),
      k.box({ width: 520, justifyContent: 'flex-end', alignItems: 'flex-start' }, k.art(v.art.hero, 520, 730)),
    ),
    k.display({ ...k.clamp(3), fontSize: fitSize(v.title, TITLE_STEPS), marginTop: 36, maxWidth: INNER }, v.title),
    v.platforms.length > 0 && k.body({ fontSize: 30, color: t.soft, marginTop: 14 }, `Streams on ${listOf(v.platforms)}`),
    k.fill(),
  )
}

export default { key: 'episode', name: 'New episode today', urgent: true, gapDays: 300, titleGap: false, window: 1, find, captions, tags: (p) => ['anime', p.genre], template }
