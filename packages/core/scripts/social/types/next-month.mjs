/**
 * "Coming next month": the anime that start next month, as a sheet of covers.
 *
 * Data: titles whose start date (known to the day or the month) falls in the
 * next calendar month, the most popular first. It needs at least MIN_CELLS
 * and comes back at most once in twelve days.
 *
 * Image: the accent colour as the page, the month name across the top, six
 * covers in two rows with the date and the title under each.
 */
import { seasonTag, tagOf, uniqueTags } from '../story.mjs'
import { clip, fitSize, isDrawable, listMore, listOf } from '../text.mjs'
import { nextMonthOf } from '../when.mjs'
import { INNER } from '../render/parts.mjs'
import { byPopularity, ctaOf } from './shared.mjs'

export const MIN_POPULARITY = 500
export const MIN_CELLS = 3
export const MAX_CELLS = 6
const PER_ROW = 3
const GAP = 30
const CELL = Math.floor((INNER - GAP * (PER_ROW - 1)) / PER_ROW)
const COVER_HEIGHT = 318
const CTA = 'Dates and where to watch the top pick: link in the first comment'
/** The month name's size by its length ("May" to "September"). */
const MONTH_STEPS = [[5, 150], [7, 128], [8, 112], [9, 98]]

const startsIn = (title, month) => title.start && title.start.precision !== 'year' && title.start.year === month.year && title.start.month === month.month

/** The day is shown only when the record knows it; a month-only date stays a month. */
const cellOf = (title, month) => ({
  title: clip(title.title, 40),
  date: title.start.precision === 'day' && title.start.day ? `${title.start.day} ${month.name.slice(0, 3)}` : month.name,
})

function find(data, { now }) {
  const month = nextMonthOf(now)
  const all = data.titles.filter((t) => startsIn(t, month) && t.popularity >= MIN_POPULARITY && isDrawable(t.title)).sort(byPopularity)
  if (all.length < MIN_CELLS) return []
  const shown = all.slice(0, MAX_CELLS)
  return [
    {
      item: `month:${month.year}-${month.month}`,
      title: null,
      path: all[0].path,
      label: `${all[0].title}: dates and where to watch`,
      names: all.slice(0, 3).map((t) => t.title),
      tags: uniqueTags([...all.slice(0, 3).map((t) => tagOf(t.title)), seasonTag(all[0].season), '#NewAnime', '#anime']),
      art: { thumbs: shown.map((t) => t.image) },
      view: { month: month.name, year: month.year, cells: shown.map((t) => cellOf(t, month)), total: all.length },
    },
  ]
}

const captions = [
  (p) => ({ hook: `🗓️ ${p.view.total} anime are set to start in ${p.view.month}.`, facts: [`The most followed on AniList so far: ${listOf(p.names)}.`], cta: ctaOf('list', 0) }),
  (p) => ({ hook: `✨ Coming in ${p.view.month} ✨`, facts: [`${listMore(p.names, p.view.total)}.`, 'The dates are on the image.'], cta: ctaOf('list', 1) }),
  (p) => ({ hook: `👀 ${p.view.month} on the anime calendar.`, facts: [`${listOf(p.names)} lead the list.`, `${p.view.total} new shows in all.`], cta: ctaOf('list', 2) }),
]

const questions = [(p) => `Which ${p.view.month} anime are you waiting for?`, () => 'Which of these is going on your watchlist?', (p) => `Are you waiting for ${p.names[0]}?`]

function cell(c, picture, k, t) {
  return k.col(
    { width: CELL },
    k.box({ width: CELL, height: COVER_HEIGHT, alignItems: 'flex-end', justifyContent: 'flex-start' }, k.art(picture, CELL, COVER_HEIGHT)),
    k.display({ fontSize: 20, marginTop: 12, letterSpacing: 1 }, c.date.toUpperCase()),
    k.body({ display: 'block', lineClamp: 2, fontSize: 23, fontWeight: k.f.textBold, lineHeight: 1.18, marginTop: 4, color: t.ink }, c.title),
  )
}

function template(v, k) {
  const t = k.tone('accent')
  const rows = [v.cells.slice(0, PER_ROW), v.cells.slice(PER_ROW)].filter((r) => r.length)
  return k.page(
    t,
    { cta: CTA },
    k.row({ justifyContent: 'space-between' }, k.kicker('New anime in', { color: t.ink }), k.kicker(v.year, { color: t.soft })),
    k.display({ fontSize: fitSize(v.month, MONTH_STEPS), fontWeight: k.f.displayBlack, lineHeight: 1, marginTop: 10, marginLeft: -4 }, v.month.toUpperCase()),
    k.rule(t.ink, 4, { marginTop: 18 }),
    rows.map((cells, r) =>
      k.row(
        { marginTop: r ? 26 : 30 },
        cells.map((c, i) => k.box({ marginRight: i < cells.length - 1 ? GAP : 0 }, cell(c, v.art.thumbs[r * PER_ROW + i], k, t))),
      ),
    ),
    k.fill(),
  )
}

export default { key: 'next-month', name: 'Coming next month', urgent: false, gapDays: 12, titleGap: false, window: 1, find, captions, questions, tags: (p) => p.tags, template }
