/**
 * "Coming next week": the anime whose first episode airs next week, as a
 * dated list.
 *
 * Data: airing schedule rows with episode 1 whose day falls in next week
 * (Monday to Sunday on the posting clock). It needs at least MIN_ROWS shows
 * and is posted once for each week.
 *
 * Image: a printed schedule. One row per show: the day, a small cover, the
 * title. Hairlines between rows, nothing else.
 */
import { seasonTag, tagOf, uniqueTags } from '../story.mjs'
import { clip, isDrawable, listMore, listOf } from '../text.mjs'
import { dateOf, labelOfDate, nextWeekOf, shortWeekdayOf } from '../when.mjs'
import { INNER } from '../render/parts.mjs'
import { byPopularity, ctaOf, START_WITH_ONE, uniqueBy } from './shared.mjs'

export const MIN_POPULARITY = 500
export const MIN_ROWS = 3
export const MAX_ROWS = 6
/** Row heights: the space the rows share, and the least and most one row takes. */
const ROW = { space: 796, min: 132, max: 262, roomy: 186 }

const rowOf = ({ row, title }) => ({
  day: shortWeekdayOf(row.at * 1000),
  date: labelOfDate(dateOf(row.at * 1000)),
  title: clip(title.title, 58),
  note: [title.noun, title.studio].filter(Boolean).join(' · '),
})

/** The post for these shows (most popular first). A show whose cover turned out blank can be left out. */
function toPost(all, week) {
  const shown = all.slice(0, MAX_ROWS)
  const byDay = [...shown].sort((x, y) => x.row.at - y.row.at)
  const lead = all[0].title
  return {
    item: `week:${week.from}`,
    title: null,
    path: lead.path,
    label: `${lead.title}: dates and where to watch`,
    names: all.slice(0, 3).map(({ title }) => title.title),
    tags: uniqueTags([...all.slice(0, 3).map(({ title }) => tagOf(title.title)), seasonTag(lead.season), '#NewAnime', '#anime']),
    art: { thumbs: byDay.map(({ title }) => title.image) },
    view: { range: `${labelOfDate(week.from)} to ${labelOfDate(week.to)}`, rows: byDay.map(rowOf), total: all.length },
    without: (blank) => {
      const drop = new Set(blank.map((i) => byDay[i]))
      const rest = all.filter((entry) => !drop.has(entry))
      return rest.length >= MIN_ROWS ? toPost(rest, week) : null
    },
  }
}

function find(data, { now }) {
  const week = nextWeekOf(now)
  const days = new Set(week.days)
  const all = uniqueBy(
    (data.schedule || [])
      .filter((row) => row.mediaId && row.episode === 1 && days.has(dateOf(row.at * 1000)))
      .map((row) => ({ row, title: data.byId.get(row.mediaId) }))
      .filter(({ title }) => title && title.popularity >= MIN_POPULARITY && isDrawable(title.title))
      .sort((x, y) => byPopularity(x.title, y.title)),
    ({ row }) => row.mediaId,
  )
  return all.length < MIN_ROWS ? [] : [toPost(all, week)]
}

const captions = [
  (p) => ({ hook: `🗓️ ${p.view.total} anime start next week, ${p.view.range}.`, facts: [`Among them: ${listOf(p.names)}.`, 'The days are on the image.'], cta: ctaOf('first', 0) }),
  (p) => ({ hook: `🚨 Next week's premieres are in 🚨`, facts: [`${p.view.range}: ${listMore(p.names, p.view.total)}.`], cta: ctaOf('first', 1) }),
  (p) => ({ hook: `✨ New anime from ${p.view.range}.`, facts: [`${listOf(p.names)} lead the list.`, `${p.view.total} first episodes in all.`], cta: ctaOf('first', 2) }),
]

const questions = [() => 'Which of these are you going to watch?', () => 'Which premiere are you most excited for?', (p) => `Is ${p.names[0]} on your list?`]

/** Rows share the space under the headline: few rows are tall, six are compact. */
function rowSizes(count) {
  const height = Math.max(ROW.min, Math.min(ROW.max, Math.floor(ROW.space / count)))
  const roomy = height >= ROW.roomy
  const thumbHeight = height - 26
  return { height, thumb: { width: Math.round(thumbHeight * 0.71), height: thumbHeight }, day: roomy ? 44 : 36, title: roomy ? 40 : 34, long: roomy ? 32 : 28, note: roomy ? 26 : 22 }
}

function template(v, k) {
  const t = k.tone('dark')
  const size = rowSizes(v.rows.length)
  return k.page(
    t,
    { cta: START_WITH_ONE },
    k.row({ justifyContent: 'space-between', alignItems: 'flex-end' }, k.kicker('New anime', { color: t.pop }), k.kicker(v.range, { color: t.soft })),
    k.display({ fontSize: 80, fontWeight: k.f.displayBlack, lineHeight: 1, marginTop: 18 }, 'COMING'),
    k.display({ fontSize: 80, fontWeight: k.f.displayBlack, lineHeight: 1, color: t.pop }, 'NEXT WEEK'),
    k.col(
      { marginTop: 30 },
      v.rows.map((r, i) =>
        k.row(
          { alignItems: 'center', height: size.height, borderTop: `2px solid ${t.line}` },
          k.col({ width: 150, flexShrink: 0 }, k.display({ fontSize: size.day, color: t.pop }, r.day.toUpperCase()), k.body({ fontSize: size.note + 2, color: t.soft, marginTop: 4 }, r.date)),
          k.box({ width: size.thumb.width, height: size.thumb.height, alignItems: 'center', justifyContent: 'center', marginRight: 30, flexShrink: 0 }, k.art(v.art.thumbs[i], size.thumb.width, size.thumb.height)),
          k.col(
            { width: INNER - 150 - size.thumb.width - 30 },
            k.display({ ...k.clamp(2), fontSize: r.title.length > 30 ? size.long : size.title, lineHeight: 1.12 }, r.title),
            r.note && k.body({ fontSize: size.note, color: t.soft, marginTop: 8 }, clip(r.note, 40)),
          ),
        ),
      ),
    ),
    k.fill(),
  )
}

export default { key: 'next-week', name: 'Coming next week', urgent: false, gapDays: 300, titleGap: false, window: 1, find, captions, questions, tags: (p) => p.tags, template }
