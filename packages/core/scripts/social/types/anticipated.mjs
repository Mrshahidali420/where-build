/**
 * "Most anticipated": a top five of anime that have not started, ranked by
 * how many AniList users have them on their planning list.
 *
 * Data: titles whose status is NOT_YET_RELEASED, with the record's own
 * planning count. One ranking for all of them, one for each coming season
 * with enough titles, one for films; each comes back at most every 3 weeks.
 *
 * Image: a ranking. Number one with its cover and a very large numeral, then
 * four rows with the numeral, a small cover, the title and the count.
 */
import { clip, compact, isDrawable, listOf } from '../text.mjs'
import { usable } from './shared.mjs'

export const TOP = 5
const SEASON_NAME = { WINTER: 'Winter', SPRING: 'Spring', SUMMER: 'Summer', FALL: 'Fall' }
const LEAD = { width: 280, height: 380 }
const THUMB = { width: 62, height: 86 }
const ROW_HEIGHT = 104

const byPlanning = (x, y) => y.planning - x.planning

/** The rankings on offer: [{ key, heading, noun, titles }]. */
export function scopesOf(titles) {
  const upcoming = titles.filter((t) => t.status === 'NOT_YET_RELEASED' && t.planning > 0 && isDrawable(t.title)).sort(byPlanning)
  const seasons = new Map()
  for (const t of upcoming) {
    if (!t.season || !SEASON_NAME[t.season.name]) continue
    const key = `${t.season.year}-${t.season.name}`
    const label = `${SEASON_NAME[t.season.name]} ${t.season.year}`
    if (!seasons.has(key)) seasons.set(key, { key: `season:${key}`, heading: label, noun: `${label} anime`, plural: `${label} anime`, titles: [] })
    seasons.get(key).titles.push(t)
  }
  return [
    { key: 'all', heading: 'Upcoming anime', noun: 'upcoming anime', plural: 'upcoming anime', titles: upcoming },
    ...seasons.values(),
    { key: 'films', heading: 'Upcoming anime films', noun: 'upcoming anime film', plural: 'upcoming anime films', titles: upcoming.filter((t) => t.format === 'MOVIE') },
  ].filter((scope) => scope.titles.length >= TOP && usable(scope.titles[0]))
}

function toPost(scope) {
  const five = scope.titles.slice(0, TOP)
  return {
    item: `anticipated:${scope.key}`,
    title: null,
    path: five[0].path,
    label: `${five[0].title}: dates and where to watch`,
    names: five.map((t) => t.title),
    lead: { title: five[0].title, count: compact(five[0].planning) },
    noun: scope.noun,
    plural: scope.plural,
    art: { hero: five[0].image, thumbs: five.slice(1).map((t) => t.image) },
    view: { heading: scope.heading, rows: five.map((t, i) => ({ rank: i + 1, title: clip(t.title, i ? 52 : 60), count: compact(t.planning) })) },
  }
}

const find = (data) => scopesOf(data.titles).map(toPost)

const captions = [
  (p) => [`${p.lead.title} is the most anticipated ${p.noun} right now: ${p.lead.count} AniList users plan to watch it.`, `Next come ${listOf(p.names.slice(1, 4))}.`],
  (p) => [`The most anticipated ${p.plural}, by AniList planning lists: ${listOf(p.names)}.`],
  (p) => [`Which ${p.plural} are people waiting for?`, `${p.lead.title} leads with ${p.lead.count} AniList users planning to watch, ahead of ${listOf(p.names.slice(1, 3))}.`],
]

function template(v, k) {
  const t = k.tone('dark')
  const [lead, ...rest] = v.rows
  return k.page(
    t,
    k.kicker(v.heading, { color: t.soft }),
    k.display({ fontSize: 78, fontWeight: k.f.displayBlack, lineHeight: 1, marginTop: 16 }, 'MOST'),
    k.display({ fontSize: 78, fontWeight: k.f.displayBlack, lineHeight: 1, color: t.pop }, 'ANTICIPATED'),
    k.row(
      { marginTop: 34, height: LEAD.height },
      k.box({ width: LEAD.width, height: LEAD.height, alignItems: 'flex-start' }, k.art(v.art.hero, LEAD.width, LEAD.height)),
      k.col(
        { marginLeft: 40, width: 596, justifyContent: 'space-between' },
        k.display({ fontSize: 190, fontWeight: k.f.displayBlack, color: t.pop, lineHeight: 0.9, marginLeft: -8 }, '1'),
        k.col(
          {},
          k.display({ ...k.clamp(3), fontSize: lead.title.length > 34 ? 36 : 44, lineHeight: 1.1 }, lead.title),
          k.body({ fontSize: 28, color: t.soft, marginTop: 10 }, `${lead.count} plan to watch`),
        ),
      ),
    ),
    k.col(
      { marginTop: 30 },
      rest.map((r, i) =>
        k.row(
          { alignItems: 'center', height: ROW_HEIGHT, borderTop: `2px solid ${t.line}` },
          k.display({ fontSize: 56, fontWeight: k.f.displayBlack, color: t.pop, width: 96 }, r.rank),
          k.box({ width: THUMB.width, height: THUMB.height, alignItems: 'center', justifyContent: 'center', marginRight: 26 }, k.art(v.art.thumbs[i], THUMB.width, THUMB.height)),
          k.display({ ...k.clamp(2), fontSize: r.title.length > 30 ? 25 : 31, lineHeight: 1.12, width: 560 }, r.title),
          k.fill(),
          k.body({ fontSize: 28, fontWeight: k.f.textBold, color: t.ink }, r.count),
        ),
      ),
    ),
    k.fill(),
    k.body({ fontSize: 22, color: t.soft, marginBottom: 14 }, 'Ranked by AniList users who plan to watch'),
  )
}

export default { key: 'anticipated', name: 'Most anticipated', urgent: false, gapDays: 21, titleGap: false, window: 1, find, captions, tags: () => ['anime', 'upcominganime'], template }
