/**
 * "New episode today": one post per episode on today's airing schedule.
 *
 * Data: the airing schedule rows whose time falls on this posting day, joined
 * to the title. An episode whose time has passed is written as aired; one
 * still to come as airing. Urgent: it goes before the rotation (plan.mjs).
 *
 * Image: the title first, large, with one line about the story. Under it
 * the episode number and the air time as the second thing, then the labelled
 * lines (score, genre, alt title) and where it streams, the cover whole on
 * the right.
 */
import { clip, fitSize, sentence } from '../text.mjs'
import { dateOf, shortDayMonthOf, shortWeekdayOf, timeOf } from '../when.mjs'
import { FOOT, H, INNER, PAD, linesOf } from '../render/parts.mjs'
import { aboutOf, byPopularity, ctaOf, keyFacts, onPlatform, single, streamsLine, TITLE_MAX, top, uniqueBy, usable } from './shared.mjs'

export const MIN_POPULARITY = 3000
/** The size of the number by how many digits it has. */
const NUMBER_STEPS = [[1, 210], [2, 200], [3, 150], [4, 116]]
const TITLE_STEPS = [[14, 84], [24, 70], [40, 56], [90, 44]]
/** The cover is as tall as the text round it leaves room for, between these. */
const COVER = { width: 540, min: 420, max: 780 }
/** Heights of the fixed pieces of the image, in pixels. */
const HEAD = 53
const ABOUT_ROW = 50
const TAGLINE_LINE = 35
const TAGLINE_FACE = 0.5
const GAPS = 26 + 26 + 24 + 44
const CTA = 'Episode dates and where to watch: link in the first comment'

function toPost(title, row, now) {
  const at = row.at * 1000
  return {
    ...single(title),
    item: `${title.id}:${row.episode}`,
    at,
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
      tagline: title.tagline,
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

/** The height left for the cover once the title, the tagline and the labelled lines have theirs. */
function coverHeight(v, titleSize) {
  const title = linesOf(v.title, titleSize, INNER) * titleSize * 1.04
  const tagline = v.tagline ? 10 + linesOf(v.tagline, 27, INNER, { face: TAGLINE_FACE }) * TAGLINE_LINE : 0
  const about = ['rating', 'genres', 'status', 'alt'].filter((key) => v.about?.[key]).length * ABOUT_ROW
  const room = H - PAD * 2 - FOOT - HEAD - GAPS - title - tagline - about
  return Math.max(COVER.min, Math.min(COVER.max, Math.floor(room)))
}

function template(v, k) {
  const t = k.tone('dark')
  const titleSize = fitSize(v.title, TITLE_STEPS)
  const height = coverHeight(v, titleSize)
  const cover = v.art.hero ? k.contain(v.art.hero.ratio, COVER.width, height) : { width: COVER.width, height }
  const side = INNER - cover.width - 40
  return k.page(
    t,
    { cta: CTA },
    k.row({ justifyContent: 'space-between', alignItems: 'flex-end' }, k.kicker('New episode', { color: t.pop }), k.kicker(v.day, { color: t.soft })),
    k.rule(t.line, 2, { marginTop: 20 }),
    // The title first: a scroller must know which show before anything else.
    k.display({ ...k.clamp(2), fontSize: titleSize, fontWeight: k.f.displayBlack, lineHeight: 1.04, marginTop: 26, maxWidth: INNER }, v.title),
    k.tagline(v.tagline, t, { marginTop: 10 }),
    k.row(
      { marginTop: 26, height: cover.height, justifyContent: 'space-between' },
      k.col(
        { width: side, justifyContent: 'space-between' },
        k.col(
          {},
          k.display({ fontSize: 36, color: t.soft, letterSpacing: 8 }, 'EPISODE'),
          k.display({ fontSize: fitSize(String(v.number), NUMBER_STEPS), fontWeight: k.f.displayBlack, color: t.pop, lineHeight: 1, marginLeft: -4 }, v.number),
        ),
        k.col({}, k.kicker(v.aired ? 'Aired today' : 'Airs today', { color: t.soft, fontSize: 22 }), k.display({ fontSize: 40, marginTop: 6, whiteSpace: 'nowrap' }, v.time)),
        v.platforms.length > 0 &&
          k.col(
            {},
            k.kicker('Streams on', { color: t.soft, fontSize: 22, marginBottom: 6 }),
            v.platforms.map((name) => k.display({ ...k.clamp(1), fontSize: name.length > 14 ? 26 : 34, lineHeight: 1.2 }, name)),
          ),
      ),
      k.art(v.art.hero, cover.width, cover.height),
    ),
    k.about(v.about, t, { size: 28, width: INNER, style: { marginTop: 24 } }),
    k.fill(),
  )
}

export default { key: 'episode', name: 'New episode today', urgent: true, gapDays: 300, titleGap: false, window: 1, find, captions, questions, tags: (p) => p.tags, template }
