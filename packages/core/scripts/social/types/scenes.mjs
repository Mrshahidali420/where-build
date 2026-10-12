/**
 * "Scenes": two frames of a show, one above the other, from edge to edge.
 *
 * Data: the stills of the show's last two episodes that have one (TMDB, else Kitsu,
 * stills/load.mjs). One post per newest episode. The frames carry no
 * words over them: the title, a short line and the brand sit in a band
 * under them.
 */
import { clip } from '../text.mjs'
import { H, PAD, W, INNER } from '../render/parts.mjs'
import { ctaOf, keyFacts, single } from './shared.mjs'
import { stillsExtra, stillsOf } from '../stills/load.mjs'

/** The two frames, cut to this shape so they fill the width; the band under them takes the rest. */
const FRAME = { width: W, height: 556 }
const DIVIDER = 6
const CTA = 'Where to watch it: link in the first comment'

function find(data) {
  return stillsOf(data)
    .filter(({ stills }) => stills.length >= 2)
    .map(({ title, finished, stills }) => {
      // A show still airing: its two newest episodes. A finished one: its first two (no spoilers).
      const pair = finished ? stills.slice(0, 2) : stills.slice(-2)
      return {
        ...single(title),
        item: `${title.id}:${pair[1].number}`,
        label: 'Where to watch it',
        episodes: pair.map((s) => s.number),
        facts: keyFacts(title),
        art: { frames: pair.map((s) => s.url) },
        view: { title: clip(title.title, 60), episodes: pair.map((s) => s.number) },
      }
    })
}

const which = (p) => `episodes ${p.episodes[0]} and ${p.episodes[1]}`

const captions = [
  (p) => ({ hook: `🎬 Scenes from ${p.title}.`, facts: [`Frames from ${which(p)}.`, ...p.facts], cta: ctaOf('watch', 0) }),
  (p) => ({ hook: `👀 Two frames from ${p.title}, ${which(p)}.`, facts: p.facts, cta: ctaOf('watch', 1) }),
  (p) => ({ hook: `✨ Straight from the show: ${p.title}.`, facts: [`These are from ${which(p)}.`, ...p.facts], cta: ctaOf('watch', 2) }),
]

const questions = [(p) => `Which scene of ${p.title} stayed with you?`, (p) => `Are you watching ${p.title}?`, (p) => `What did you think of episode ${p.episodes[1]}?`]

const frame = (picture) => (picture ? { type: 'img', props: { src: picture.src, width: FRAME.width, height: FRAME.height, style: { objectFit: 'cover', flexShrink: 0 } } } : null)

function template(v, k) {
  const t = k.tone('dark')
  const [a, b] = v.art.frames || []
  return k.box(
    { width: W, height: H, backgroundColor: t.bg, color: t.ink, fontFamily: k.f.text, flexDirection: 'column' },
    frame(a),
    k.box({ height: DIVIDER, backgroundColor: t.bg, flexShrink: 0 }),
    frame(b),
    k.col(
      { width: INNER, marginLeft: PAD, flexGrow: 1, justifyContent: 'flex-end', paddingBottom: 44 },
      k.row({ alignItems: 'baseline', marginBottom: 14 }, k.kicker('Scenes from', { color: t.pop, fontSize: 21, letterSpacing: 3, marginRight: 14 }), k.display({ ...k.clamp(1), fontSize: 30, fontWeight: k.f.displayBlack, maxWidth: INNER - 220 }, v.title)),
      k.cta(CTA, t),
      k.brand(t),
    ),
  )
}

export default { key: 'scenes', name: 'Scenes', urgent: false, gapDays: 300, titleGap: false, window: 1, find, captions, questions, tags: (p) => p.tags, template, extra: stillsExtra }
