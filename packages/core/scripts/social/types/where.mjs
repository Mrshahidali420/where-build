/**
 * "Where to watch": the official streaming sites of one popular title.
 *
 * Data: the record's official English or worldwide streaming links, and how
 * much of the show is out. The title then rests for the 30-day title gap.
 *
 * Image: the cover whole on the left, the streaming sites as a tall plain
 * list on the right, the title under both.
 */
import { clip, fitSize, listOf } from '../text.mjs'
import { INNER } from '../render/parts.mjs'
import { byPopularity, top, usable } from './shared.mjs'

export const MIN_POPULARITY = 15_000
const MAX_SITES = 5
const COVER = { width: 520, height: 730 }

function stateOf(t) {
  if (t.status === 'FINISHED') return t.episodes > 1 ? `All ${t.episodes} episodes are out.` : 'It is out in full.'
  if (t.status === 'RELEASING') return 'New episodes are still airing.'
  return null
}

function toPost(title) {
  return {
    item: String(title.id),
    title: title.title,
    path: title.path,
    label: 'Where to watch it',
    genre: title.genres[0],
    state: stateOf(title),
    art: { hero: title.image },
    view: {
      title: clip(title.title, 80),
      sites: top(title.platforms, MAX_SITES).map((s) => clip(s, 22)),
      meta: [title.noun, title.year, title.episodes > 1 && `${title.episodes} episodes`].filter(Boolean).join(' · '),
    },
  }
}

const find = (data) =>
  data.titles
    .filter((t) => t.popularity >= MIN_POPULARITY && t.platforms.length && (t.status === 'FINISHED' || t.status === 'RELEASING') && usable(t))
    .sort(byPopularity)
    .map(toPost)

const sites = (p) => listOf(top(p.view.sites))

const captions = [
  (p) => [`Where to watch ${p.title}? Officially on ${sites(p)}.`, p.state],
  (p) => [`${p.title} streams on ${sites(p)}.`, p.state],
  (p) => [`Looking for ${p.title}?`, `The official streams are ${sites(p)}.`, p.state],
]

function template(v, k) {
  const t = k.tone('dark')
  return k.page(
    t,
    k.row(
      { height: COVER.height },
      k.box({ width: COVER.width, height: COVER.height, alignItems: 'flex-start' }, k.art(v.art.hero, COVER.width, COVER.height)),
      k.col(
        { marginLeft: 40, width: INNER - COVER.width - 40 },
        k.kicker('Where to watch', { color: t.pop }),
        k.col(
          { marginTop: 22 },
          v.sites.map((site) => k.box({ borderTop: `2px solid ${t.line}`, paddingTop: 24, paddingBottom: 24 }, k.display({ fontSize: site.length > 12 ? 26 : 34, lineHeight: 1.1 }, site))),
          k.rule(t.line, 2),
        ),
        k.fill(),
        k.body({ fontSize: 24, color: t.soft }, 'Official streaming sites'),
      ),
    ),
    k.display({ ...k.clamp(3), fontSize: fitSize(v.title, [[18, 70], [36, 58], [60, 46], [80, 38]]), marginTop: 44, maxWidth: INNER }, v.title),
    v.meta && k.body({ fontSize: 30, color: t.soft, marginTop: 14 }, v.meta),
    k.fill(),
  )
}

export default { key: 'where', name: 'Where to watch', urgent: false, gapDays: 30, titleGap: true, window: 400, find, captions, tags: (p) => ['anime', p.genre], template }
