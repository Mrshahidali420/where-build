/**
 * "Global airing time": when an episode airs, as the clock time of thirty
 * countries.
 *
 * Data: an airing schedule row of today (any episode of a show many people
 * follow) or a first episode of today or tomorrow, joined to the title. The
 * times come from the row's own timestamp and real time zones (zones.mjs).
 *
 * Image: a poster. The show's wide key art across the top (its cover beside
 * the title when the record has no wide art), the title, the episode and
 * the date, then the countries in three columns, each with a small round
 * flag, its name and its time. A "+1" marks a country where it is already
 * the next day. Then where it streams.
 */
import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { clip, fitSize, listOf } from '../text.mjs'
import { dateOf, dayMonthOf, nearDay, timeOf, weekdayOf } from '../when.mjs'
import { H, INNER, PAD, W, linesOf } from '../render/parts.mjs'
import { baseTitle, seasonTag, tagOf, uniqueTags } from '../story.mjs'
import { airDetails, byPopularity, ctaOf, keyFacts, single, top, uniqueBy, usable } from './shared.mjs'
import { COUNTRIES, localTimes, shiftMark, timeIn } from '../zones.mjs'
import { POSTING_ZONE } from '../pace.mjs'

/** This type is for the shows people wait for: a higher floor than the episode card. */
export const MIN_POPULARITY = { episode: 40_000, premiere: 8000 }
const COLUMNS = 3
const ROWS = Math.ceil(COUNTRIES.length / COLUMNS)
/** The height of a country's row: tighter under wide art, which takes the room left over. */
const ROW_HEIGHT = { wide: 43, cover: 50 }
const COLUMN_GAP = 26
const FLAG_PX = 28
const FLAG_DIR = fileURLToPath(new URL('../flags/', import.meta.url))
/** The wide art across the top: its least and greatest height. */
const BAND = { min: 250, max: 400 }
/** Art counts as wide from this shape on (width / height). */
const WIDE_FROM = 1.6
const COVER = { width: 300, height: 420 }
const TITLE_STEPS = [[18, 58], [32, 48], [56, 40], [90, 34]]
/** Heights of the fixed pieces under the art, in pixels. */
const FIXED = { top: 26, kicker: 32, date: 42, rule: 30, grid: ROWS * ROW_HEIGHT.wide, note: 30, watch: 74, foot: 118, bottom: 56 }
const CTA = 'Episode dates and where to watch: link in the first comment'

/** The show's hashtag; a long name is tagged by what stands before its colon ("BLEACH: ..." -> #BLEACH). */
const titleTag = (name) => tagOf(baseTitle(name)) || tagOf(name) || tagOf(String(name).split(/:\s|\s[-–—]\s/)[0])

function toPost(title, row, now) {
  const at = row.at * 1000
  const times = localTimes(at, POSTING_ZONE)
  const premiere = row.episode === 1
  const platforms = top(title.platforms)
  const when = `${weekdayOf(at)} ${dayMonthOf(at)}`
  return {
    ...single(title),
    item: `${title.id}:${row.episode}`,
    at,
    label: 'Episode dates and where to watch',
    facts: keyFacts(title),
    details: airDetails(title, when, premiere ? 'Premiere date' : 'Release date'),
    tags: uniqueTags([titleTag(title.title), seasonTag(title.season), tagOf(title.studio), tagOf(platforms[0]), '#AnimeNews', '#anime']),
    episode: row.episode,
    premiere,
    day: nearDay(at, now),
    cities: [timeIn(times, 'us'), timeIn(times, 'gb'), timeIn(times, 'in')],
    art: { hero: title.image, banner: title.banner },
    view: {
      title: clip(title.title, 90),
      what: premiere ? 'Premiere' : `Episode ${row.episode}`,
      date: `${when} · ${timeOf(at)} ET`,
      times: times.map((t) => ({ code: t.code, name: t.name, time: t.time, mark: shiftMark(t.shift) })),
      platforms,
    },
  }
}

function find(data, { now }) {
  const today = dateOf(now)
  const rows = (data.schedule || [])
    .filter((row) => row.mediaId && row.episode > 0 && (dateOf(row.at * 1000) === today || (row.episode === 1 && nearDay(row.at * 1000, now))))
    .map((row) => ({ row, title: data.byId.get(row.mediaId) }))
    .filter(({ row, title }) => title && usable(title) && title.popularity >= (row.episode === 1 ? MIN_POPULARITY.premiere : MIN_POPULARITY.episode) && (row.episode === 1 || title.platforms.length))
    .sort((x, y) => byPopularity(x.title, y.title))
  return uniqueBy(rows, ({ row }) => `${row.mediaId}:${row.episode}`).map(({ row, title }) => toPost(title, row, now))
}

const what = (p) => (p.premiere ? 'premieres' : `episode ${p.episode} airs`)
/** "10:45 AM in the USA, 3:45 PM in the UK and 8:15 PM in India (+1 day)" */
const cities = (p) => listOf(p.cities.filter(Boolean).map((c) => `${c.time} in ${c.code === 'in' ? 'India' : `the ${c.name}`}${c.shift > 0 ? ' (the next day)' : c.shift < 0 ? ' (the day before)' : ''}`))

const captions = [
  (p) => ({ hook: `🌍 ${p.title} ${what(p)} ${p.day}. Here is the time in your country.`, facts: [`That is ${cities(p)}.`, ...p.facts], details: p.details, cta: ctaOf('episode', 0) }),
  (p) => ({ hook: `🚨 ${p.title}: ${p.premiere ? 'the premiere' : `episode ${p.episode}`} is ${p.day} 🚨`, facts: [`It airs at ${cities(p)}.`, 'The time in thirty countries is on the card.', ...p.facts], details: p.details, cta: ctaOf('episode', 1) }),
  (p) => ({ hook: `⏰ What time does ${p.title} ${p.premiere ? 'start' : `episode ${p.episode} air`} where you live?`, facts: [`It is ${p.day}: ${cities(p)}.`, ...p.facts], details: p.details, cta: ctaOf('episode', 2) }),
]

const questions = [(p) => `What time does ${p.title} air where you are?`, (p) => `Will you watch ${p.title} the moment it is out, or later?`, (p) => `Where are you watching ${p.title} from?`]

/** The flags as small round pictures, read from the repo once: { us: 'data:image/png...' }. */
let flags = null
async function assets({ sharp }) {
  if (flags) return { flags }
  const size = FLAG_PX * 3
  const mask = Buffer.from(`<svg width="${size}" height="${size}"><circle cx="${size / 2}" cy="${size / 2}" r="${size / 2}"/></svg>`)
  const made = await Promise.all(
    readdirSync(FLAG_DIR)
      .filter((file) => file.endsWith('.svg'))
      .map(async (file) => {
        const png = await sharp(readFileSync(`${FLAG_DIR}${file}`), { density: 300 }).resize(size, size, { fit: 'cover' }).composite([{ input: mask, blend: 'dest-in' }]).png().toBuffer()
        return [file.replace('.svg', ''), `data:image/png;base64,${png.toString('base64')}`]
      }),
  )
  flags = Object.fromEntries(made)
  return { flags }
}

function cell(entry, k, t, { width, height }, flag) {
  return k.row(
    { width, height, alignItems: 'center', borderTop: `1px solid ${t.line}` },
    flag ? { type: 'img', props: { src: flag, width: FLAG_PX, height: FLAG_PX, style: { marginRight: 10, flexShrink: 0 } } } : k.box({ width: FLAG_PX, height: FLAG_PX, marginRight: 10, flexShrink: 0 }),
    k.body({ fontSize: 17, fontWeight: k.f.textBold, letterSpacing: 1, textTransform: 'uppercase', color: t.soft, flexGrow: 1, whiteSpace: 'nowrap' }, entry.name),
    k.body({ fontSize: 22, fontWeight: k.f.textBold, color: t.ink, whiteSpace: 'nowrap' }, entry.time),
    entry.mark && k.body({ fontSize: 15, fontWeight: k.f.textBold, color: t.pop, marginLeft: 5, marginBottom: 8 }, entry.mark),
  )
}

function grid(v, k, t, height) {
  const width = Math.floor((INNER - COLUMN_GAP * (COLUMNS - 1)) / COLUMNS)
  const columns = Array.from({ length: COLUMNS }, (_, c) => v.times.slice(c * ROWS, (c + 1) * ROWS))
  return k.row({ justifyContent: 'space-between' }, columns.map((list) => k.col({ width }, list.map((entry) => cell(entry, k, t, { width, height }, v.assets?.flags?.[entry.code])))))
}

const heading = (v, k, t) => k.row({ justifyContent: 'space-between', alignItems: 'flex-end' }, k.kicker('Global airing time', { color: t.pop }), k.kicker(v.what, { color: t.ink }))

/** The art, the title and the date with wide art: the art from edge to edge, the words under it. */
function wideTop(v, k, t, titleSize, room) {
  const height = Math.max(BAND.min, Math.min(BAND.max, Math.floor(room)))
  return [
    { type: 'img', props: { src: v.art.banner.src, width: W, height, style: { objectFit: 'cover', flexShrink: 0 } } },
    k.col(
      { width: INNER, marginLeft: PAD, marginTop: FIXED.top },
      heading(v, k, t),
      k.display({ ...k.clamp(2), fontSize: titleSize, fontWeight: k.f.displayBlack, lineHeight: 1.05, marginTop: 14 }, v.title),
      k.body({ fontSize: 28, fontWeight: k.f.textBold, color: t.soft, marginTop: 10 }, v.date),
    ),
  ]
}

/** The same with no wide art: the cover whole on the left, the words beside it. */
function coverTop(v, k, t) {
  const cover = v.art.hero ? k.contain(v.art.hero.ratio, COVER.width, COVER.height) : COVER
  const side = INNER - cover.width - 36
  return [
    k.row(
      { width: INNER, marginLeft: PAD, marginTop: PAD - 16, height: COVER.height, alignItems: 'center' },
      k.art(v.art.hero, COVER.width, COVER.height),
      k.col(
        { width: side, marginLeft: 36 },
        k.kicker('Global airing time', { color: t.pop }),
        k.display({ ...k.clamp(4), fontSize: fitSize(v.title, [[14, 62], [28, 50], [48, 40], [90, 32]]), fontWeight: k.f.displayBlack, lineHeight: 1.05, marginTop: 16 }, v.title),
        k.display({ fontSize: 40, color: t.pop, marginTop: 20, textTransform: 'uppercase' }, v.what),
        k.body({ fontSize: 27, fontWeight: k.f.textBold, color: t.soft, marginTop: 10 }, v.date),
      ),
    ),
  ]
}

function template(v, k) {
  const t = k.tone('dark')
  const titleSize = fitSize(v.title, TITLE_STEPS)
  const wide = v.art.banner && v.art.banner.ratio >= WIDE_FROM
  const words = FIXED.top + FIXED.kicker + 14 + linesOf(v.title, titleSize, INNER) * titleSize * 1.05 + FIXED.date
  const under = FIXED.rule + FIXED.grid + FIXED.note + FIXED.watch + FIXED.foot + FIXED.bottom
  const marked = v.times.some((entry) => entry.mark)
  const sites = v.platforms.join(' · ')
  return k.box(
    { width: W, height: H, backgroundColor: t.bg, color: t.ink, fontFamily: k.f.text, flexDirection: 'column' },
    ...(wide ? wideTop(v, k, t, titleSize, H - words - under) : coverTop(v, k, t)),
    k.col(
      { width: INNER, marginLeft: PAD, flexGrow: 1, paddingBottom: FIXED.bottom },
      k.rule(t.line, 2, { marginTop: 18, marginBottom: 10 }),
      grid(v, k, t, wide ? ROW_HEIGHT.wide : ROW_HEIGHT.cover),
      k.rule(t.line, 1),
      k.body({ fontSize: 18, color: t.soft, marginTop: 8, height: 22 }, marked ? 'Dates are US Eastern. +1 is the next day there, -1 the day before.' : 'Dates are US Eastern.'),
      k.row({ alignItems: 'baseline', marginTop: 14 }, k.kicker(sites ? 'Watch on' : 'Streaming', { color: t.soft, fontSize: 21, letterSpacing: 3, marginRight: 16 }), k.display({ ...k.clamp(1), fontSize: sites.length > 30 ? 28 : 36, color: t.ink }, sites || 'not listed yet')),
      k.fill(),
      k.cta(CTA, t),
      k.brand(t),
    ),
  )
}

export default { key: 'airtime', name: 'Global airing time', urgent: true, gapDays: 300, titleGap: false, window: 1, find, captions, questions, tags: (p) => p.tags, template, assets }
