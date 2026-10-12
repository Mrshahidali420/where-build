/**
 * "Character spotlight": one lead character and the people who voice them.
 *
 * Data: the main cast on a popular title's record, with the character's own
 * picture and the Japanese (and, when the record has one, English) voice
 * actor. One post per character, at most every six months.
 *
 * Image: cream paper. The name as the headline across the top, the portrait
 * on a flat block of the accent colour, the voices as two plain lines.
 */
import { clip, fitSize, isDrawable } from '../text.mjs'
import { byPopularity, streamsLine, top } from './shared.mjs'

export const MIN_POPULARITY = 30_000
/** At most this many characters from one title are offered. */
const PER_TITLE = 2
const PORTRAIT = { width: 460, height: 690 }
const BLOCK_SHIFT = 26
const NAME_STEPS = [[9, 124], [12, 100], [16, 80], [22, 62], [40, 50]]

function toPost(title, member) {
  return {
    item: `char:${member.id}`,
    title: title.title,
    path: title.path,
    label: 'Cast, voice actors and where to watch',
    genre: title.genres[0],
    name: member.name,
    platforms: top(title.platforms),
    art: { hero: member.image },
    view: { name: clip(member.name, 40), from: clip(title.title, 64), voice: clip(member.voice, 30), voiceEn: member.voiceEn && clip(member.voiceEn, 30), sites: top(title.platforms).map((s) => clip(s, 16)) },
  }
}

function find(data) {
  return data.titles
    .filter((t) => t.popularity >= MIN_POPULARITY && t.platforms.length && isDrawable(t.title))
    .sort(byPopularity)
    .flatMap((t) => t.cast.filter((m) => m.voice && isDrawable(m.name) && isDrawable(m.voice)).slice(0, PER_TITLE).map((m) => toPost(t, m)))
}

const english = (v, lead) => (v.voiceEn ? `${lead}${v.voiceEn} in English` : '')

const captions = [
  (p) => [`${p.name} from ${p.title} is voiced by ${p.view.voice} in Japanese${english(p.view, ' and ')}.`, streamsLine(p.platforms, 'The show streams on')],
  (p) => [`Character spotlight: ${p.name}, one of the leads of ${p.title}.`, `Japanese voice: ${p.view.voice}.`, p.view.voiceEn && `English voice: ${p.view.voiceEn}.`],
  (p) => [`Who voices ${p.name} in ${p.title}?`, `${p.view.voice} in Japanese${english(p.view, ', ')}.`],
]

function voiceRow(label, name, k, t) {
  return k.col({ borderTop: `2px solid ${t.line}`, paddingTop: 14, paddingBottom: 16 }, k.kicker(label, { color: t.soft, fontSize: 21, letterSpacing: 3 }), k.display({ fontSize: name.length > 20 ? 28 : 34, marginTop: 6 }, name))
}

function template(v, k) {
  const t = k.tone('light')
  const portrait = v.art.hero ? k.contain(v.art.hero.ratio, PORTRAIT.width, PORTRAIT.height) : PORTRAIT
  return k.page(
    t,
    k.kicker('Character spotlight', { color: t.soft }),
    k.display({ ...k.clamp(2), fontSize: fitSize(v.name, NAME_STEPS), fontWeight: k.f.displayBlack, lineHeight: 1.02, marginTop: 18 }, v.name),
    k.row(
      { marginTop: 44 },
      k.box(
        { position: 'relative', width: portrait.width + BLOCK_SHIFT, height: portrait.height + BLOCK_SHIFT, flexShrink: 0 },
        k.box({ position: 'absolute', left: BLOCK_SHIFT, top: BLOCK_SHIFT, width: portrait.width, height: portrait.height, backgroundColor: t.block }),
        k.art(v.art.hero, PORTRAIT.width, PORTRAIT.height, { position: 'absolute', left: 0, top: 0 }),
      ),
      k.col(
        { marginLeft: 44, width: 936 - portrait.width - BLOCK_SHIFT - 44, justifyContent: 'flex-end' },
        k.kicker('From', { color: t.soft, fontSize: 21, letterSpacing: 3 }),
        k.display({ ...k.clamp(4), fontSize: v.from.length > 30 ? 30 : 38, lineHeight: 1.12, marginTop: 8, marginBottom: 30 }, v.from),
        voiceRow('Japanese voice', v.voice, k, t),
        v.voiceEn && voiceRow('English voice', v.voiceEn, k, t),
      ),
    ),
    v.sites.length > 0 &&
      k.col(
        { marginTop: 48, borderTop: `2px solid ${t.line}`, paddingTop: 22 },
        k.kicker('Where to watch', { color: t.soft, fontSize: 21, letterSpacing: 3 }),
        k.display({ fontSize: 34, marginTop: 8 }, v.sites.join(' · ')),
      ),
    k.fill(),
  )
}

export default { key: 'character', name: 'Character spotlight', urgent: false, gapDays: 180, titleGap: false, window: 80, find, captions, tags: (p) => ['anime', p.genre], template }
