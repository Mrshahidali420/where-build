/**
 * "New anime premiere": episode 1 of a show airs today or tomorrow.
 *
 * Data: an airing schedule row with episode 1 whose time falls on this
 * posting day or the next. A show does not need a streaming site yet, only a
 * live page. Urgent: it goes before the rotation, once per show.
 *
 * Image: a centred poster. The word, the date line, the cover whole with a
 * thin offset frame, the title, then the genres, rating and other name.
 */
import { clip, fitSize, sentence } from '../text.mjs'
import { dayMonthOf, nearDay, timeOf, weekdayOf } from '../when.mjs'
import { aboutOf, byPopularity, ctaOf, keyFacts, single, streamsLine, top, uniqueBy, usable } from './shared.mjs'

export const MIN_POPULARITY = 1000
const COVER = { width: 360, height: 504 }
const ABOUT_WIDTH = 640
const FRAME_SHIFT = 20
const CTA = 'Episode dates and where to watch: link in the first comment'

function toPost(title, row, now) {
  const at = row.at * 1000
  return {
    ...single(title),
    item: String(title.id),
    label: 'Episode dates and where to watch',
    facts: [title.studio && sentence(`Animation by ${title.studio}`), streamsLine(top(title.platforms)), ...keyFacts(title)],
    art: { hero: title.image },
    view: {
      title: clip(title.title, 70),
      day: nearDay(at, now),
      date: `${weekdayOf(at)} ${dayMonthOf(at)}`,
      time: `${timeOf(at)} ET`,
      platforms: top(title.platforms),
      about: aboutOf(title, { status: false }),
    },
  }
}

function find(data, { now }) {
  const rows = (data.schedule || [])
    .filter((row) => row.mediaId && row.episode === 1 && nearDay(row.at * 1000, now))
    .map((row) => ({ row, title: data.byId.get(row.mediaId) }))
    .filter(({ title }) => title && title.popularity >= MIN_POPULARITY && usable(title))
    .sort((x, y) => byPopularity(x.title, y.title))
  return uniqueBy(rows, ({ row }) => row.mediaId).map(({ row, title }) => toPost(title, row, now))
}

const captions = [
  (p) => ({ hook: `🚨 New anime alert 🚨 ${p.title} premieres ${p.view.day} at ${p.view.time}.`, facts: p.facts, cta: ctaOf('episode', 0) }),
  (p) => ({ hook: `🎬 Episode 1 of ${p.title} airs ${p.view.day} at ${p.view.time}.`, facts: p.facts, cta: ctaOf('episode', 1) }),
  (p) => ({ hook: `✨ Starting ${p.view.day}: ${p.title}.`, facts: [`The first episode is set for ${p.view.time}.`, ...p.facts], cta: ctaOf('episode', 2) }),
]

const questions = [(p) => `Will you give ${p.title} a try?`, (p) => `Is ${p.title} on your watchlist?`, (p) => `What are you hoping for from ${p.title}?`]

function template(v, k) {
  const t = k.tone('dark')
  const cover = v.art.hero ? k.contain(v.art.hero.ratio, COVER.width, COVER.height) : COVER
  return k.page(
    t,
    { cta: CTA },
    k.col(
      { alignItems: 'center', flexGrow: 1 },
      k.display({ fontSize: 110, fontWeight: k.f.displayBlack, color: t.pop, lineHeight: 1 }, 'PREMIERE'),
      k.kicker(`${v.day} · ${v.date} · ${v.time}`, { color: t.ink, marginTop: 16, fontSize: 25, letterSpacing: 3 }),
      k.box(
        { position: 'relative', width: cover.width + FRAME_SHIFT, height: cover.height + FRAME_SHIFT, marginTop: 34, marginLeft: FRAME_SHIFT },
        k.box({ position: 'absolute', left: FRAME_SHIFT, top: FRAME_SHIFT, width: cover.width, height: cover.height, border: `4px solid ${t.pop}` }),
        k.art(v.art.hero, COVER.width, COVER.height, { position: 'absolute', left: 0, top: 0 }),
      ),
      k.display({ ...k.clamp(2), fontSize: fitSize(v.title, [[16, 58], [32, 48], [52, 40], [70, 34]]), marginTop: 28, width: 880, textAlign: 'center' }, v.title),
      k.about(v.about, t, { size: 24, width: ABOUT_WIDTH, style: { marginTop: 18 } }),
      v.platforms.length > 0 && k.body({ fontSize: 26, color: t.soft, marginTop: 12 }, `Streams on ${v.platforms.join(', ')}`),
    ),
  )
}

export default { key: 'premiere', name: 'New anime premiere', urgent: true, gapDays: 300, titleGap: false, window: 1, find, captions, questions, tags: (p) => p.tags, template }
