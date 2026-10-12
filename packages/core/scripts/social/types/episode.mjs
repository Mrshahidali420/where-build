/**
 * "New episode today": one post per episode on today's airing schedule.
 *
 * Data: the airing schedule rows whose time falls on this posting day, joined
 * to the title. An episode whose time has passed is written as aired; one
 * still to come as airing. Urgent: it goes before the rotation (plan.mjs).
 *
 * Image: the episode number as the biggest thing on the page, the cover whole
 * on the right, the rating, genres and other name under the number, the time
 * at the foot of the column.
 */
import { clip, fitSize, listOf, sentence } from '../text.mjs'
import { dateOf, shortDayMonthOf, shortWeekdayOf, timeOf } from '../when.mjs'
import { INNER } from '../render/parts.mjs'
import { aboutOf, byPopularity, ctaOf, keyFacts, onPlatform, single, streamsLine, TITLE_MAX, TITLE_STEPS, top, uniqueBy, usable } from './shared.mjs'

export const MIN_POPULARITY = 3000
/** The size of the number by how many digits it has. */
const NUMBER_STEPS = [[1, 270], [2, 220], [3, 150], [4, 112]]
const COVER = { width: 500, height: 704 }
const CTA = 'Episode dates and where to watch: link in the first comment'

function toPost(title, row, now) {
  const at = row.at * 1000
  return {
    ...single(title),
    item: `${title.id}:${row.episode}`,
    label: 'Episode dates and where to watch',
    facts: [title.studio && sentence(`Animation by ${title.studio}`), ...keyFacts(title)],
    art: { hero: title.image },
    view: {
      title: clip(title.title, TITLE_MAX),
      number: row.episode,
      time: `${timeOf(at)} ET`,
      aired: at <= now,
      day: `${shortWeekdayOf(now)} ${shortDayMonthOf(now)}`,
      platforms: top(title.platforms),
      about: aboutOf(title, { status: false, genres: 2 }),
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
  (p) => ({ hook: `🚨 New episode alert 🚨 ${p.title} episode ${p.view.number} ${when(p.view)}.`, facts: [streamsLine(p.view.platforms), ...p.facts], cta: ctaOf('episode', 0) }),
  (p) => ({ hook: `📺 It is ${p.title} day: episode ${p.view.number} ${when(p.view)}.`, facts: [streamsLine(p.view.platforms, 'Watch it on'), ...p.facts], cta: ctaOf('episode', 1) }),
  (p) => ({ hook: `⏰ ${p.title} is back today with episode ${p.view.number}.`, facts: [`It ${p.view.aired ? 'aired' : 'airs'} at ${p.view.time}.`, streamsLine(p.view.platforms, 'Official streams:'), ...p.facts], cta: ctaOf('episode', 2) }),
]

const questions = [(p) => onPlatform(p, 'Are you watching'), (p) => `What do you expect from episode ${p.view.number} of ${p.title}?`, (p) => `How is ${p.title} going for you so far?`]

function template(v, k) {
  const t = k.tone('dark')
  return k.page(
    t,
    { cta: CTA },
    k.row({ justifyContent: 'space-between', alignItems: 'flex-end' }, k.kicker('New episode', { color: t.pop }), k.kicker(v.day, { color: t.soft })),
    k.rule(t.line, 2, { marginTop: 20 }),
    k.row(
      { marginTop: 32, height: COVER.height, justifyContent: 'space-between' },
      k.col(
        { width: INNER - COVER.width - 40, justifyContent: 'space-between' },
        k.col(
          {},
          k.display({ fontSize: 38, color: t.soft, letterSpacing: 8 }, 'EPISODE'),
          k.display({ fontSize: fitSize(String(v.number), NUMBER_STEPS), fontWeight: k.f.displayBlack, color: t.pop, lineHeight: 1, marginTop: 2, marginLeft: -6 }, v.number),
        ),
        k.about(v.about, t, { size: 24, width: INNER - COVER.width - 40 }),
        k.col(
          {},
          k.kicker(v.aired ? 'Aired today' : 'Airs today', { color: t.soft, fontSize: 24 }),
          k.display({ fontSize: 42, marginTop: 8 }, v.time),
        ),
      ),
      k.box({ width: COVER.width, justifyContent: 'flex-end', alignItems: 'flex-start' }, k.art(v.art.hero, COVER.width, COVER.height)),
    ),
    k.display({ ...k.clamp(2), fontSize: fitSize(v.title, TITLE_STEPS), marginTop: 30, maxWidth: INNER }, v.title),
    v.platforms.length > 0 && k.body({ fontSize: 30, color: t.soft, marginTop: 12 }, `Streams on ${listOf(v.platforms)}`),
    k.fill(),
  )
}

export default { key: 'episode', name: 'New episode today', urgent: true, gapDays: 300, titleGap: false, window: 1, find, captions, questions, tags: (p) => p.tags, template }
