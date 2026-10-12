/**
 * "New anime premiere": episode 1 of a show airs today or tomorrow.
 *
 * Data: an airing schedule row with episode 1 whose time falls on this
 * posting day or the next. A show does not need a streaming site yet, only a
 * live page. Urgent: it goes before the rotation, once per show.
 *
 * Image: a centred poster. The word, the date line, the cover whole with a
 * thin offset frame, the title under it.
 */
import { clip, fitSize, sentence } from '../text.mjs'
import { dayMonthOf, nearDay, timeOf, weekdayOf } from '../when.mjs'
import { byPopularity, streamsLine, top, uniqueBy, usable } from './shared.mjs'

export const MIN_POPULARITY = 1000
const COVER = { width: 450, height: 630 }
const FRAME_SHIFT = 22

function toPost(title, row, now) {
  const at = row.at * 1000
  return {
    item: String(title.id),
    title: title.title,
    path: title.path,
    label: 'Episode dates and where to watch',
    genre: title.genres[0],
    art: { hero: title.image },
    view: {
      title: clip(title.title, 70),
      day: nearDay(at, now),
      date: `${weekdayOf(at)} ${dayMonthOf(at)}`,
      time: `${timeOf(at)} ET`,
      studio: title.studio,
      platforms: top(title.platforms),
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
  (p) => [`${p.title} premieres ${p.view.day} at ${p.view.time}.`, p.view.studio && sentence(`Animation by ${p.view.studio}`), streamsLine(p.view.platforms)],
  (p) => [`Episode 1 of ${p.title} airs ${p.view.day} at ${p.view.time}.`, streamsLine(p.view.platforms, 'Watch it on')],
  (p) => [`Starting ${p.view.day}: ${p.title}.`, `The first episode is set for ${p.view.time}.`, p.view.studio && sentence(`Made by ${p.view.studio}`)],
]

function template(v, k) {
  const t = k.tone('dark')
  const cover = v.art.hero ? k.contain(v.art.hero.ratio, COVER.width, COVER.height) : COVER
  return k.page(
    t,
    k.col(
      { alignItems: 'center', flexGrow: 1 },
      k.display({ fontSize: 114, fontWeight: k.f.displayBlack, color: t.pop, lineHeight: 1 }, 'PREMIERE'),
      k.kicker(`${v.day} · ${v.date} · ${v.time}`, { color: t.ink, marginTop: 18, fontSize: 25, letterSpacing: 3 }),
      k.box(
        { position: 'relative', width: cover.width + FRAME_SHIFT, height: cover.height + FRAME_SHIFT, marginTop: 40, marginLeft: FRAME_SHIFT },
        k.box({ position: 'absolute', left: FRAME_SHIFT, top: FRAME_SHIFT, width: cover.width, height: cover.height, border: `4px solid ${t.pop}` }),
        k.art(v.art.hero, COVER.width, COVER.height, { position: 'absolute', left: 0, top: 0 }),
      ),
      k.display({ ...k.clamp(3), fontSize: fitSize(v.title, [[16, 60], [32, 50], [52, 42], [70, 36]]), marginTop: 34, width: 880, textAlign: 'center' }, v.title),
      v.platforms.length > 0 && k.body({ fontSize: 28, color: t.soft, marginTop: 12 }, `Streams on ${v.platforms.join(', ')}`),
    ),
  )
}

export default { key: 'premiere', name: 'New anime premiere', urgent: true, gapDays: 300, titleGap: false, window: 1, find, captions, tags: (p) => ['anime', p.genre], template }
