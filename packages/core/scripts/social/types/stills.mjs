/**
 * "Episode still": one large frame of the newest episode of a show, with the
 * title, the episode and where it streams.
 *
 * Data: the still of the latest episode (TMDB, else Kitsu; stills/load.mjs), for a show
 * many people follow. One post per episode.
 */
import { clip, fitSize } from '../text.mjs'
import { aboutOf, airDetails, ctaOf, keyFacts, single, top } from './shared.mjs'
import { stillsExtra, stillsOf } from '../stills/load.mjs'

const STILL = { width: 936, height: 527 }
const TITLE_STEPS = [[18, 64], [32, 52], [56, 42], [90, 34]]
const CTA = 'Episode dates and where to watch: link in the first comment'

function find(data) {
  // The newest episode of a show still airing: a finished show's last frame would give its ending away.
  return stillsOf(data).filter((s) => !s.finished).map(({ title, stills }) => {
    const still = stills.at(-1)
    return {
      ...single(title),
      item: `${title.id}:${still.number}`,
      label: 'Episode dates and where to watch',
      episode: still.number,
      facts: keyFacts(title),
      details: airDetails(title, null),
      art: { hero: still.url },
      view: { title: clip(title.title, 90), episode: still.number, platforms: top(title.platforms), about: aboutOf(title, { genres: 2, alt: false }) },
    }
  })
}

const captions = [
  (p) => ({ hook: `📺 A still from ${p.title}, episode ${p.episode}.`, facts: p.facts, details: p.details, cta: ctaOf('episode', 0) }),
  (p) => ({ hook: `🎬 ${p.title} episode ${p.episode} is out.`, facts: p.facts, details: p.details, cta: ctaOf('episode', 1) }),
  (p) => ({ hook: `👀 From episode ${p.episode} of ${p.title}.`, facts: p.facts, details: p.details, cta: ctaOf('episode', 2) }),
]

const questions = [(p) => `Have you watched episode ${p.episode} of ${p.title} yet?`, (p) => `What did you think of episode ${p.episode}?`, (p) => `Are you keeping up with ${p.title}?`]

function template(v, k) {
  const t = k.tone('dark')
  return k.page(
    t,
    { cta: CTA },
    k.row({ justifyContent: 'space-between', alignItems: 'flex-end' }, k.kicker(`Episode ${v.episode}`, { color: t.pop }), k.kicker('Episode still', { color: t.soft, fontSize: 21 })),
    k.display({ ...k.clamp(2), fontSize: fitSize(v.title, TITLE_STEPS), fontWeight: k.f.displayBlack, lineHeight: 1.05, marginTop: 16 }, v.title),
    k.row({ marginTop: 28, justifyContent: 'center' }, k.art(v.art.hero, STILL.width, STILL.height)),
    k.about(v.about, t, { size: 26, width: STILL.width, style: { marginTop: 26 } }),
    v.platforms.length > 0 && k.row({ alignItems: 'baseline', marginTop: 18 }, k.kicker('Watch on', { color: t.soft, fontSize: 21, letterSpacing: 3, marginRight: 16 }), k.display({ ...k.clamp(1), fontSize: 34 }, v.platforms.join(' · '))),
    k.fill(),
  )
}

export default { key: 'stills', name: 'Episode still', urgent: false, gapDays: 300, titleGap: false, window: 1, find, captions, questions, tags: (p) => p.tags, template, extra: stillsExtra }
