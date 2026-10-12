// The global airing time card (types/airtime.mjs, zones.mjs): the local time
// of thirty countries from one real timestamp, right across a change of
// daylight saving, the day marks, which episodes get a card, its words and
// its image tree. Also the labelled lines (date, studio, streams) the
// episode and premiere captions now carry.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { captionFor } from '../scripts/social/plan.mjs'
import { kitOf } from '../scripts/social/render/parts.mjs'
import { composePost, detailLines } from '../scripts/social/text.mjs'
import airtime, { MIN_POPULARITY } from '../scripts/social/types/airtime.mjs'
import episode from '../scripts/social/types/episode.mjs'
import premiere from '../scripts/social/types/premiere.mjs'
import { COUNTRIES, localTimes, shiftMark, timeIn } from '../scripts/social/zones.mjs'
import { NOW, HOUR, BLOCKED } from './social-kit.mjs'
import { sampleData, walk } from './social-data.mjs'

const ET = 'America/New_York'
const at = (code, ms) => timeIn(localTimes(ms, ET), code)
const FLAGS = fileURLToPath(new URL('../scripts/social/flags/', import.meta.url))

test('zones: thirty countries, each with a real zone and a flag file', () => {
  assert.equal(COUNTRIES.length, 30)
  assert.equal(new Set(COUNTRIES.map((c) => c.code)).size, 30)
  for (const c of COUNTRIES) {
    assert.doesNotThrow(() => new Intl.DateTimeFormat('en-US', { timeZone: c.zone }), c.zone)
    assert.ok(existsSync(`${FLAGS}${c.code}.svg`), c.code)
  }
  const zone = Object.fromEntries(COUNTRIES.map((c) => [c.code, c.zone]))
  assert.deepEqual([zone.us, zone.ca, zone.au, zone.br, zone.mx, zone.id], ['America/New_York', 'America/Toronto', 'Australia/Sydney', 'America/Sao_Paulo', 'America/Mexico_City', 'Asia/Jakarta'])
})

test('zones: daylight saving is right for the day itself, on both sides of a change', () => {
  // Saturday 24 Oct 2026, 14:00 UTC: Europe and the US are still on summer time, Sydney already is.
  const before = Date.UTC(2026, 9, 24, 14, 0)
  assert.deepEqual([at('us', before).time, at('gb', before).time, at('de', before).time, at('in', before).time, at('br', before).time], ['10:00 AM', '3:00 PM', '4:00 PM', '7:30 PM', '11:00 AM'])
  assert.deepEqual([at('au', before).time, at('au', before).shift, at('nz', before).time, at('nz', before).shift], ['1:00 AM', 1, '3:00 AM', 1])
  // Monday 26 Oct: Europe has gone back an hour (25 Oct), the US has not yet (1 Nov).
  const between = Date.UTC(2026, 9, 26, 14, 0)
  assert.deepEqual([at('us', between).time, at('gb', between).time, at('de', between).time], ['10:00 AM', '2:00 PM', '3:00 PM'])
  // Monday 2 Nov: the US is on standard time too.
  const after = Date.UTC(2026, 10, 2, 15, 0)
  assert.deepEqual([at('us', after).time, at('gb', after).time, at('in', after).time, at('jp', after).time], ['10:00 AM', '3:00 PM', '8:30 PM', '12:00 AM'])
  assert.equal(at('jp', after).shift, 1)
})

test('zones: a country still on the day before is marked -1, the same day nothing', () => {
  const lateNight = Date.UTC(2026, 9, 13, 4, 30) // 12:30 AM on 13 Oct in New York
  assert.deepEqual([at('us', lateNight).time, at('us', lateNight).shift], ['12:30 AM', 0])
  assert.deepEqual([at('mx', lateNight).time, at('mx', lateNight).shift], ['10:30 PM', -1])
  assert.deepEqual([shiftMark(1), shiftMark(-1), shiftMark(0)], ['+1', '-1', ''])
})

test('find: popular shows airing today and premieres get a card, obscure ones do not', () => {
  const posts = airtime.find(sampleData(), { now: NOW })
  assert.ok(posts.length >= 2)
  assert.ok(posts.every((p) => p.view.times.length === 30))
  assert.ok(posts.some((p) => p.premiere) && posts.some((p) => !p.premiere))
  const quiet = sampleData()
  for (const t of quiet.titles) t.popularity = MIN_POPULARITY.premiere - 1
  assert.equal(airtime.find(quiet, { now: NOW }).length, 0)
})

test('words: the hook, the cities, the three labelled lines and the hashtags', () => {
  const post = airtime.find(sampleData(), { now: NOW }).find((p) => !p.premiere)
  const { caption } = captionFor(airtime, post, 0, BLOCKED)
  assert.match(caption, /^🌍 .+ episode \d+ airs today\. Here is the time in your country\.\nThat is .+ in the USA, .+ in the UK and .+ in India/)
  assert.match(caption, /\n📅 Release date: \w+day \d+ \w+\n🎬 Studio: .+\n📺 Streaming: .+/)
  assert.match(caption, /#AnimeNews/)
  const tree = airtime.template({ ...post.view, art: { hero: { src: 'data:image/jpeg;base64,AA==', ratio: 0.7 }, thumbs: [], banner: null }, assets: { flags: { us: 'data:image/png;base64,AA==' } } }, kitOf({ name: 'X', domain: 'x.com', color: { night: '#000000', raised: '#111111', accent: '#ff0000', paper: '#ffffff' }, font: {} }, {}))
  const { texts, images } = walk(tree)
  assert.ok(texts.includes('Global airing time') && texts.includes('USA') && texts.includes('New Zealand'))
  assert.ok(images.length >= 2) // the cover and a flag
})

test('labelled lines: up to three, emoji first, a missing value left out, counted apart from the other emojis', () => {
  assert.deepEqual(detailLines([['📅', 'Release date', 'Monday 12 October.'], ['🎬', 'Studio', null], ['📺', 'Streaming', 'Crunchyroll']]), ['📅 Release date: Monday 12 October', '📺 Streaming: Crunchyroll'])
  const text = composePost({ hook: '🚨 A thing. 🚨', facts: ['⭐ 8.0 out of 10.'], details: [['📅', 'Release date', 'Monday 12 October'], ['🎬', 'Studio', 'MAPPA'], ['📺', 'Streaming', 'Crunchyroll']], question: 'Is it good?', cta: '👇 Link in the first comment.' }, ['#Tag'])
  assert.match(text, /\n\n📅 Release date: Monday 12 October\n🎬 Studio: MAPPA\n📺 Streaming: Crunchyroll\n\n/)
})

test('episode and premiere captions now carry the date, the studio and the streams (when known) as labelled lines', () => {
  const data = sampleData()
  for (const type of [episode, premiere]) {
    const post = type.find(data, { now: NOW })[0]
    for (let turn = 0; turn < type.captions.length; turn += 1) {
      const { caption } = captionFor({ ...type, captions: [type.captions[turn]] }, post, 0, BLOCKED)
      assert.match(caption, new RegExp(`📅 ${type === premiere ? 'Premiere' : 'Release'} date: `), type.key)
      // A show with no stream known yet has no streaming line: nothing is made up.
      if (post.platform) assert.match(caption, /📺 Streaming: /, type.key)
      else assert.doesNotMatch(caption, /📺/, type.key)
    }
  }
  assert.ok(HOUR > 0)
})
