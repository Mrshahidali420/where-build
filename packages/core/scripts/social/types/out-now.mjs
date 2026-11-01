/**
 * "Out now": an episode of a show many people follow has just aired.
 * Part of the airing news (tasks/airing-queue-plan.md): it goes before the
 * rotation, in the four hours after the air time, and is its own post even
 * when the title had another post today (`sameDay`, plan.mjs).
 *
 * Data: the airing schedule rows whose time is between AFTER_MS ago and now,
 * joined to the title: popular enough, with an official stream.
 *
 * Image, two looks (the owner's reference: the Page ALL ANIME AT ONCE):
 *   - with two or more stills of the show (stills/load.mjs): a white band on
 *     top with a small italic line, "EPISODE 5 / OUT TODAY" huge, the title
 *     letter-spaced, the band ending in a soft curve over a grid of stills
 *     cut edge to edge with thin white gutters;
 *   - else: the one still edge to edge (or the cover whole) across the top,
 *     the headline large under it and one solid tag, title then episode.
 * The caption is short: a capitals hook, one fact, a question, the link line,
 * three hashtags.
 */
import { clip } from '../text.mjs'
import { dayMonthOf, timeOf, weekdayOf } from '../when.mjs'
import { H, INNER, PAD, W } from '../render/parts.mjs'
import { stillsExtra, stillsOf } from '../stills/load.mjs'
import { byPopularity, ctaOf, single, top, uniqueBy, usable } from './shared.mjs'

export const MIN_POPULARITY = 2000
/** How long after its air time an episode is still news. */
export const AFTER_MS = 4 * 3_600_000
/** The stills a grid shows: two to six. */
export const GRID = { min: 2, max: 6, gutter: 6 }
/** The one colour the reference look adds: the word in red. */
export const RED = '#E0262B'
const PAPER = '#FFFFFF'
/** The picture across the top in the plain look, and the white band of the grid look. */
const HERO = { height: 790 }
const BAND = { height: 430, curve: 90 }
const FOOT = 180
const TAG_TITLE_MAX = 30
/** The tag's type size: a long title is set smaller so it is not cut. */
const tagSize = (title) => (title.length > 22 ? 24 : title.length > 16 ? 28 : 32)
const SPACED_MAX = 30
const CTA = 'Episode dates and where to watch: link in the first comment'
const ORDINALS = ['first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth', 'ninth', 'tenth', 'eleventh', 'twelfth']
const ordinal = (n) => ORDINALS[n - 1] || `${n}th`

/** The stills of this show the run loaded, the newest last, up to this episode. */
function stillsFor(data, titleId, episode) {
  const found = stillsOf(data).find((s) => s.title.id === titleId)
  return (found?.stills || []).filter((s) => !(s.number > episode))
}

/** The post for one episode; `mark` names the news ('out', 'final'). */
export function airingPost(data, title, row, { mark, label = 'Episode dates and where to watch' }) {
  const at = row.at * 1000
  const stills = stillsFor(data, title.id, row.episode).slice(-GRID.max)
  const grid = stills.length >= GRID.min
  return {
    ...single(title),
    // Short captions: no synopsis.
    synopsis: null,
    tags: single(title).tags.filter((tag) => !/amazon/i.test(tag)).slice(0, 3),
    item: `${title.id}:${mark === 'final' ? 'final' : `${row.episode}:${mark}`}`,
    at,
    label,
    episode: row.episode,
    fact: factOf(title, at),
    // A grid of stills, else the one still loaded large (shown edge to edge), else the cover whole.
    // Not the banner: AniList's banners are thin strips, and cut to this shape they blur.
    art: grid ? { frames: stills.map((s) => s.url) } : stills.length ? { hero: stills[0].url, heroSize: 1600 } : { hero: title.image },
    view: {
      title: clip(title.title.toUpperCase(), TAG_TITLE_MAX),
      spaced: clip(title.title.toUpperCase(), SPACED_MAX),
      episode: row.episode,
      time: `${timeOf(at)} ET`,
    },
  }
}

/** The one fact under the hook: where it streams (never Amazon by name: the caption gate bans the word), else when it airs. */
function factOf(title, at) {
  const streams = top(title.platforms.filter((name) => !/amazon/i.test(name)), 2)
  return streams.length ? `It streams on ${streams.join(' and ')}.` : `It airs ${weekdayOf(at)} ${dayMonthOf(at)} at ${timeOf(at)} ET.`
}

/** The schedule rows of popular shows with a stream, most popular first, one per episode. */
export function airingRows(data, keep) {
  const rows = (data.schedule || [])
    .filter((row) => row.mediaId && row.episode > 0 && keep(row))
    .map((row) => ({ row, title: data.byId.get(row.mediaId) }))
    .filter(({ title }) => title && title.platforms.length && title.popularity >= MIN_POPULARITY && usable(title))
    .sort((x, y) => byPopularity(x.title, y.title))
  return uniqueBy(rows, ({ row }) => `${row.mediaId}:${row.episode}`)
}

function find(data, { now }) {
  return airingRows(data, (row) => row.at * 1000 <= now && row.at * 1000 > now - AFTER_MS).map(({ row, title }) => airingPost(data, title, row, { mark: 'out' }))
}

const loud = (p) => p.title.toUpperCase()

const captions = [
  (p) => ({ hook: `🔥 ${loud(p)} EPISODE ${p.episode} IS OUT NOW!`, facts: [p.fact], cta: ctaOf('episode', 0) }),
  (p) => ({ hook: `🚨 EPISODE ${p.episode} OF ${loud(p)} JUST DROPPED!`, facts: [p.fact], cta: ctaOf('episode', 1) }),
  (p) => ({ hook: `📺 ${loud(p)} IS BACK WITH EPISODE ${p.episode}!`, facts: [p.fact], cta: ctaOf('episode', 2) }),
]

const questions = [(p) => `💬 Are you watching ${p.title}?`, (p) => `💬 What did you think of episode ${p.episode}?`, (p) => `💬 Have you watched episode ${p.episode} yet?`]

const img = (picture, width, height) => ({ type: 'img', props: { src: picture.src, width, height, style: { objectFit: 'cover', flexShrink: 0 } } })

/** Rows of stills: two or three alone in a column, four or more two to a row. */
function grid(frames, k, height) {
  const across = frames.length >= 4 ? 2 : 1
  const shown = across === 2 ? frames.slice(0, frames.length - (frames.length % 2)) : frames
  const rows = Math.ceil(shown.length / across)
  const cellW = Math.floor((W - GRID.gutter * (across - 1)) / across)
  const cellH = Math.floor((height - GRID.gutter * (rows - 1)) / rows)
  return k.col(
    { width: W, height, backgroundColor: PAPER, justifyContent: 'space-between' },
    Array.from({ length: rows }, (_, r) => k.row({ width: W, justifyContent: 'space-between' }, shown.slice(r * across, r * across + across).map((frame) => img(frame, cellW, cellH)))),
  )
}

/** The foot of every airing card: the line about the first comment and the brand, on the dark. */
const foot = (k, t, style = {}) => k.col({ width: INNER, marginLeft: PAD, paddingBottom: PAD - 24, ...style }, k.cta(CTA, t), k.brand(t))

/**
 * The grid look: the white band with the words over the top of the stills.
 * @param lines { kicker: [before, red word], head: [first, [black, red]], spaced }
 */
export function gridCard(v, k, lines) {
  const t = k.tone('dark')
  const ink = k.theme.color.night
  const under = H - FOOT - BAND.height + BAND.curve
  return k.box(
    { width: W, height: H, backgroundColor: t.bg, color: t.ink, fontFamily: k.f.text, flexDirection: 'column', position: 'relative' },
    k.box({ position: 'absolute', top: BAND.height - BAND.curve, left: 0, width: W, height: under }, grid(v.art.frames, k, under)),
    // The band: its bottom corners curve over the stills.
    k.col(
      { position: 'absolute', top: 0, left: 0, width: W, height: BAND.height, backgroundColor: PAPER, alignItems: 'center', paddingTop: 48, borderBottomLeftRadius: BAND.curve, borderBottomRightRadius: BAND.curve },
      k.row(
        { alignItems: 'baseline' },
        k.body({ fontSize: 30, fontStyle: 'italic', color: ink, fontWeight: k.f.textMedium }, lines.kicker[0]),
        k.body({ fontSize: 30, fontStyle: 'italic', color: RED, fontWeight: k.f.textBold, marginLeft: 9 }, lines.kicker[1]),
      ),
      k.display({ fontSize: 118, fontWeight: k.f.displayBlack, color: ink, lineHeight: 0.98, marginTop: 14, whiteSpace: 'nowrap' }, lines.head[0]),
      k.row(
        {},
        k.display({ fontSize: 118, fontWeight: k.f.displayBlack, color: ink, lineHeight: 0.98, whiteSpace: 'nowrap' }, lines.head[1][0]),
        k.display({ fontSize: 118, fontWeight: k.f.displayBlack, color: RED, lineHeight: 0.98, marginLeft: 26, whiteSpace: 'nowrap' }, lines.head[1][1]),
      ),
      k.body({ fontSize: 28, fontWeight: k.f.textBold, color: ink, letterSpacing: lines.spaced.length > 20 ? 7 : 12, marginTop: 18, whiteSpace: 'nowrap' }, lines.spaced),
    ),
    k.box({ flexGrow: 1 }),
    foot(k, t, { paddingTop: 28, backgroundColor: t.bg, height: FOOT, justifyContent: 'flex-end' }),
  )
}

/** The plain look: the picture across the top, cut to fill when it is wide, the cover whole on the dark when it is not. */
function hero(picture, k, t) {
  if (!picture) return k.box({ width: W, height: HERO.height, backgroundColor: k.theme.color.raised, flexShrink: 0 })
  if (picture.ratio >= 1.2) return img(picture, W, HERO.height)
  return k.box({ width: W, height: HERO.height, backgroundColor: k.theme.color.raised, alignItems: 'center', justifyContent: 'center', flexShrink: 0 }, k.art(picture, W - PAD * 2, HERO.height - 60))
}

/**
 * The plain look: the picture, the headline (second line in the accent), then the tag.
 * @param headline [first line, second line]
 */
export function heroCard(v, k, headline) {
  const t = k.tone('dark')
  const size = headline.some((line) => line.length > 10) ? 96 : 116
  return k.box(
    { width: W, height: H, backgroundColor: t.bg, color: t.ink, fontFamily: k.f.text, flexDirection: 'column' },
    hero(v.art.hero, k, t),
    k.col(
      { width: INNER, marginLeft: PAD, flexGrow: 1, paddingTop: 30 },
      k.display({ fontSize: size, fontWeight: k.f.displayBlack, lineHeight: 0.95, whiteSpace: 'nowrap' }, headline[0]),
      k.display({ fontSize: size, fontWeight: k.f.displayBlack, lineHeight: 0.95, color: t.pop, whiteSpace: 'nowrap' }, headline[1]),
      // One solid tag: the title on the accent, the episode on the dark, the way the news Pages mark an episode.
      k.row(
        { marginTop: 24, alignSelf: 'flex-start', border: `3px solid ${t.pop}`, maxWidth: INNER },
        k.display({ ...k.clamp(1), fontSize: tagSize(v.title), fontWeight: k.f.displayBlack, color: k.theme.color.night, backgroundColor: t.pop, paddingTop: 10, paddingBottom: 8, paddingLeft: 18, paddingRight: 18, maxWidth: INNER - 250 }, v.title),
        k.display({ fontSize: tagSize(v.title), fontWeight: k.f.displayBlack, color: t.ink, paddingTop: 10, paddingBottom: 8, paddingLeft: 18, paddingRight: 18, whiteSpace: 'nowrap' }, `EPISODE ${v.episode}`),
      ),
      k.fill(),
    ),
    foot(k, t),
  )
}

const template = (v, k) =>
  v.art.frames?.length >= GRID.min
    ? gridCard(v, k, { kicker: [`The ${ordinal(v.episode)} episode released`, 'TODAY'], head: [`EPISODE ${v.episode}`, ['OUT', 'TODAY']], spaced: v.spaced })
    : heroCard(v, k, [`EPISODE ${v.episode}`, 'OUT NOW'])

export default { key: 'out-now', name: 'Episode out now', urgent: true, sameDay: true, gapDays: 300, titleGap: false, window: 1, find, captions, questions, tags: (p) => p.tags, template, extra: stillsExtra }
