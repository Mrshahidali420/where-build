/**
 * "Collage": a show with an episode today or tomorrow, in frames from its
 * last episodes: one large and four small under it, or, when eight good
 * frames are there, a grid of eight (two across, four down).
 *
 * Data: the airing schedule (the coming episode) and the stills of the
 * episodes before it, from TMDB or Kitsu (stills/load.mjs). The header says which episode is
 * coming and when; the frames are what has aired so far, and the words say
 * so. One post per coming episode.
 */
import { clip, fitSize } from '../text.mjs'
import { dayMonthOf, nearDay, timeOf, weekdayOf } from '../when.mjs'
import { INNER } from '../render/parts.mjs'
import { aboutOf, airDetails, ctaOf, keyFacts, single, top } from './shared.mjs'
import { stillsExtra, stillsOf } from '../stills/load.mjs'

const HERO = { width: INNER, height: Math.round(INNER / (16 / 9)) }
const GAP = 12
const TILE = { width: Math.floor((INNER - GAP * 3) / 4), height: Math.floor((INNER - GAP * 3) / 4 / (16 / 9)) }
/** The grid: two frames across, four rows, cut a little wider than 16:9 so the page holds them. */
const GRID = { across: 2, count: 8, width: Math.floor((INNER - GAP) / 2), height: 206 }
const TITLE_STEPS = [[18, 56], [32, 46], [56, 38], [90, 32]]
const CTA = 'Episode dates and where to watch: link in the first comment'

function find(data, { now }) {
  return stillsOf(data)
    .filter(({ title, stills }) => stills.length >= 5 && title.nextEpisode && nearDay(title.nextEpisode.at, now))
    .map(({ title, stills }) => {
      const grid = stills.length >= GRID.count
      const shown = stills.slice(grid ? -GRID.count : -5)
      const [first, last] = [shown[0], shown.at(-1)]
      const next = title.nextEpisode
      return {
        ...single(title),
        item: `${title.id}:${next.number}`,
        label: 'Episode dates and where to watch',
        episode: next.number,
        day: nearDay(next.at, now),
        time: `${timeOf(next.at)} ET`,
        range: [first.number, last.number],
        facts: keyFacts(title),
        details: airDetails(title, `${weekdayOf(next.at)} ${dayMonthOf(next.at)}`),
        art: grid ? { thumbs: shown.map((s) => s.url) } : { hero: last.url, thumbs: shown.slice(0, 4).map((s) => s.url) },
        view: { grid, title: clip(title.title, 90), head: `Episode ${next.number} · ${nearDay(next.at, now)} ${timeOf(next.at)} ET`, range: `Frames from episodes ${first.number} to ${last.number}`, platforms: top(title.platforms), about: aboutOf(title, { genres: 2, alt: false, status: false }) },
      }
    })
}

const captions = [
  (p) => ({ hook: `🚨 ${p.title} episode ${p.episode} airs ${p.day} at ${p.time}.`, facts: [`The story so far, in frames from episodes ${p.range[0]} to ${p.range[1]}.`, ...p.facts], details: p.details, cta: ctaOf('episode', 0) }),
  (p) => ({ hook: `⏰ Episode ${p.episode} of ${p.title} is ${p.day}.`, facts: [`Catch up first: frames from episodes ${p.range[0]} to ${p.range[1]}.`, ...p.facts], details: p.details, cta: ctaOf('episode', 1) }),
  (p) => ({ hook: `🎬 ${p.title}: episode ${p.episode} comes ${p.day}.`, facts: [`Here is where it left off, episodes ${p.range[0]} to ${p.range[1]}.`, ...p.facts], details: p.details, cta: ctaOf('episode', 2) }),
]

const questions = [(p) => `What do you expect from episode ${p.episode} of ${p.title}?`, (p) => `Are you caught up with ${p.title}?`, (p) => `Which episode of ${p.title} has been the best so far?`]

const picture = (k, t, size) => (art) => (art ? { type: 'img', props: { src: art.src, width: size.width, height: size.height, style: { objectFit: 'cover', flexShrink: 0 } } } : k.box({ width: size.width, height: size.height, backgroundColor: t.line, flexShrink: 0 }))

/** Eight frames, two across, oldest first, and the episodes they come from. */
function gridTemplate(v, k, t) {
  const rows = Array.from({ length: GRID.count / GRID.across }, (_, i) => (v.art.thumbs || []).slice(i * GRID.across, (i + 1) * GRID.across))
  return k.page(
    t,
    { cta: CTA },
    k.kicker(v.head, { color: t.pop }),
    k.display({ ...k.clamp(1), fontSize: fitSize(v.title, TITLE_STEPS), fontWeight: k.f.displayBlack, lineHeight: 1.05, marginTop: 14 }, v.title),
    k.col({ marginTop: 22 }, rows.map((row, i) => k.row({ justifyContent: 'space-between', marginTop: i ? GAP : 0 }, row.map(picture(k, t, GRID))))),
    k.body({ fontSize: 20, color: t.soft, marginTop: 10 }, v.range),
    k.fill(),
  )
}

function template(v, k) {
  const t = k.tone('dark')
  if (v.grid) return gridTemplate(v, k, t)
  const tile = picture(k, t, TILE)
  return k.page(
    t,
    { cta: CTA },
    k.kicker(v.head, { color: t.pop }),
    k.display({ ...k.clamp(2), fontSize: fitSize(v.title, TITLE_STEPS), fontWeight: k.f.displayBlack, lineHeight: 1.05, marginTop: 14 }, v.title),
    v.art.hero && { type: 'img', props: { src: v.art.hero.src, width: HERO.width, height: HERO.height, style: { objectFit: 'cover', marginTop: 24, flexShrink: 0 } } },
    k.row({ marginTop: GAP, justifyContent: 'space-between' }, (v.art.thumbs || []).map(tile)),
    k.body({ fontSize: 20, color: t.soft, marginTop: 10 }, v.range),
    k.about(v.about, t, { size: 24, width: INNER, style: { marginTop: 14 } }),
    k.fill(),
  )
}

export default { key: 'collage', name: 'Collage', urgent: false, gapDays: 300, titleGap: false, window: 1, find, captions, questions, tags: (p) => p.tags, template, extra: stillsExtra }
