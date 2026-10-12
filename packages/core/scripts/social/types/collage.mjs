/**
 * "Collage": a show with an episode today or tomorrow, in five frames: one
 * large, four small under it, from its last episodes.
 *
 * Data: the airing schedule (the coming episode) and Kitsu's stills of the
 * episodes before it (stills/load.mjs). The header says which episode is
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
const TITLE_STEPS = [[18, 56], [32, 46], [56, 38], [90, 32]]
const CTA = 'Episode dates and where to watch: link in the first comment'

function find(data, { now }) {
  return stillsOf(data)
    .filter(({ title, stills }) => stills.length >= 5 && title.nextEpisode && nearDay(title.nextEpisode.at, now))
    .map(({ title, stills }) => {
      const five = stills.slice(-5)
      const next = title.nextEpisode
      return {
        ...single(title),
        item: `${title.id}:${next.number}`,
        label: 'Episode dates and where to watch',
        episode: next.number,
        day: nearDay(next.at, now),
        time: `${timeOf(next.at)} ET`,
        range: [five[0].number, five[4].number],
        facts: keyFacts(title),
        details: airDetails(title, `${weekdayOf(next.at)} ${dayMonthOf(next.at)}`),
        art: { hero: five[4].url, thumbs: five.slice(0, 4).map((s) => s.url) },
        view: { title: clip(title.title, 90), head: `Episode ${next.number} · ${nearDay(next.at, now)} ${timeOf(next.at)} ET`, range: `Frames from episodes ${five[0].number} to ${five[4].number}`, platforms: top(title.platforms), about: aboutOf(title, { genres: 2, alt: false, status: false }) },
      }
    })
}

const captions = [
  (p) => ({ hook: `🚨 ${p.title} episode ${p.episode} airs ${p.day} at ${p.time}.`, facts: [`The story so far, in frames from episodes ${p.range[0]} to ${p.range[1]}.`, ...p.facts], details: p.details, cta: ctaOf('episode', 0) }),
  (p) => ({ hook: `⏰ Episode ${p.episode} of ${p.title} is ${p.day}.`, facts: [`Catch up first: frames from episodes ${p.range[0]} to ${p.range[1]}.`, ...p.facts], details: p.details, cta: ctaOf('episode', 1) }),
  (p) => ({ hook: `🎬 ${p.title}: episode ${p.episode} comes ${p.day}.`, facts: [`Here is where it left off, episodes ${p.range[0]} to ${p.range[1]}.`, ...p.facts], details: p.details, cta: ctaOf('episode', 2) }),
]

const questions = [(p) => `What do you expect from episode ${p.episode} of ${p.title}?`, (p) => `Are you caught up with ${p.title}?`, (p) => `Which episode of ${p.title} has been the best so far?`]

function template(v, k) {
  const t = k.tone('dark')
  const tile = (picture) => (picture ? { type: 'img', props: { src: picture.src, width: TILE.width, height: TILE.height, style: { objectFit: 'cover', flexShrink: 0 } } } : k.box({ width: TILE.width, height: TILE.height, backgroundColor: t.line }))
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
