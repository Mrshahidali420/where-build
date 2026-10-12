/**
 * "Airing right now": a series in the middle of its run, with the day its
 * next episode arrives.
 *
 * Data: a title whose status is RELEASING and whose next episode (airing
 * schedule) falls in the coming week but not today (today's episodes have
 * their own type). The same title comes back at most once in four weeks.
 *
 * Image: a cream band with the headline, the cover standing across the edge
 * of the band, the next episode, the title and the rating, genres and other
 * name on the night half.
 */
import { clip, fitSize } from '../text.mjs'
import { dateOf, DAY_MS, timeOf, weekdayOf } from '../when.mjs'
import { H, INNER, PAD, W } from '../render/parts.mjs'
import { aboutOf, byPopularity, ctaOf, keyFacts, onPlatform, single, streamsLine, TITLE_MAX, top, usable } from './shared.mjs'

export const MIN_POPULARITY = 8000
const WEEK_MS = 7 * DAY_MS
const BAND = 470
const COVER = { width: 440, height: 620, top: 160 }
const CTA = 'Episode dates and where to watch: link in the first comment'

function toPost(title) {
  const at = title.nextEpisode.at
  return {
    ...single(title),
    item: String(title.id),
    label: 'Episode dates and where to watch',
    facts: keyFacts(title),
    art: { hero: title.image },
    view: { title: clip(title.title, TITLE_MAX), number: title.nextEpisode.number, weekday: weekdayOf(at), time: `${timeOf(at)} ET`, platforms: top(title.platforms), about: aboutOf(title, { alt: false }) },
  }
}

function find(data, { now }) {
  const today = dateOf(now)
  return data.titles
    .filter((t) => t.status === 'RELEASING' && t.nextEpisode && t.nextEpisode.at > now && t.nextEpisode.at <= now + WEEK_MS && dateOf(t.nextEpisode.at) !== today)
    .filter((t) => t.platforms.length && t.popularity >= MIN_POPULARITY && usable(t))
    .sort(byPopularity)
    .map(toPost)
}

const next = (v) => `Episode ${v.number} arrives on ${v.weekday} at ${v.time}.`

const captions = [
  (p) => ({ hook: `📺 ${p.title} is airing right now.`, facts: [next(p.view), streamsLine(p.view.platforms), ...p.facts], cta: ctaOf('episode', 0) }),
  (p) => ({ hook: `👀 Keeping up with ${p.title}?`, facts: [`Episode ${p.view.number} is next, on ${p.view.weekday} at ${p.view.time}.`, streamsLine(p.view.platforms, 'Watch it on'), ...p.facts], cta: ctaOf('episode', 1) }),
  (p) => ({ hook: `🔥 On air this season: ${p.title}.`, facts: [`The next episode, number ${p.view.number}, is set for ${p.view.weekday} at ${p.view.time}.`, streamsLine(p.view.platforms, 'Official streams:'), ...p.facts], cta: ctaOf('episode', 2) }),
]

const questions = [(p) => onPlatform(p, 'Are you following'), (p) => `Is ${p.title} one of your picks this season?`, (p) => `What do you expect from episode ${p.view.number} of ${p.title}?`]

function template(v, k) {
  const light = k.tone('light')
  const dark = k.tone('dark')
  const cover = v.art.hero ? k.contain(v.art.hero.ratio, COVER.width, COVER.height) : COVER
  const clear = COVER.top + cover.height - BAND
  return k.box(
    { width: W, height: H, backgroundColor: dark.bg, color: dark.ink, fontFamily: k.f.text },
    k.box({ position: 'absolute', left: 0, top: 0, width: W, height: BAND, backgroundColor: light.bg }),
    k.col(
      { position: 'absolute', left: PAD, top: PAD, width: INNER, color: light.ink },
      k.kicker('This season', { color: light.soft }),
      k.display({ fontSize: 96, fontWeight: k.f.displayBlack, lineHeight: 0.98, marginTop: 26 }, 'AIRING'),
      k.display({ fontSize: 96, fontWeight: k.f.displayBlack, lineHeight: 0.98 }, 'NOW'),
    ),
    k.box({ position: 'absolute', left: W - PAD - cover.width - 8, top: COVER.top - 8, padding: 8, backgroundColor: dark.bg }, k.art(v.art.hero, COVER.width, COVER.height)),
    k.col(
      { position: 'absolute', left: PAD, top: BAND, width: INNER, height: H - BAND - PAD },
      k.col(
        { height: Math.max(clear + 44, 250), width: INNER - COVER.width - 40 },
        k.kicker('Next episode', { color: dark.pop, marginTop: 48 }),
        k.display({ fontSize: 52, marginTop: 14 }, `Episode ${v.number}`),
        k.body({ fontSize: 32, color: dark.soft, marginTop: 12 }, v.weekday),
        k.body({ fontSize: 32, color: dark.soft }, v.time),
      ),
      k.display({ ...k.clamp(2), fontSize: fitSize(v.title, [[18, 66], [36, 54], [60, 44], [90, 36]]), maxWidth: INNER }, v.title),
      v.platforms.length > 0 && k.body({ fontSize: 28, color: dark.soft, marginTop: 10 }, `Streams on ${v.platforms.join(', ')}`),
      k.about(v.about, dark, { size: 23, style: { marginTop: 14 } }),
      k.fill(),
      k.cta(CTA, dark),
      k.brand(dark),
    ),
  )
}

export default { key: 'onair', name: 'Airing right now', urgent: false, gapDays: 28, titleGap: false, window: 15, find, captions, questions, tags: (p) => p.tags, template }
