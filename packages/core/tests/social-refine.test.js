// The refinement round of 12 Oct 2026: what a post may end on, how a title
// wraps, which covers are placeholders, what the Amazon line says, and the
// rule that keeps one kind of post from running three times in a row.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import sharp from 'sharp'
import { baseTitle, synopsisOf, taglineOf, tagsFor, TAGLINE_MAX } from '../scripts/social/story.mjs'
import { planNext, MAX_STREAK } from '../scripts/social/plan.mjs'
import { shopLabel } from '../scripts/social/shop.mjs'
import { isBlankCover } from '../scripts/social/render/engine.mjs'
import { linesOf, noOrphan, wrapUnits, INNER } from '../scripts/social/render/parts.mjs'
import { ctaOf, START_WITH_ONE } from '../scripts/social/types/shared.mjs'
import { buildData } from '../scripts/social/source.mjs'
import { TYPES } from '../scripts/social/types/index.mjs'
import { NOW, DAY } from './social-kit.mjs'
import { sampleItems, sampleSchedule, upcoming } from './social-data.mjs'

const NBSP = String.fromCharCode(160)

test('synopsis: it never ends on a teaser question, a lead-in colon, a scrap or an ellipsis', () => {
  const first = 'A boy finds a sword in the old forest near the village he grew up in.'
  assert.equal(synopsisOf(`${first} Will he survive?`), first)
  assert.equal(synopsisOf(`${first} The proof:`), first)
  assert.equal(synopsisOf(`${first} And then...`), first)
  assert.equal(synopsisOf(`${first} Not really.`), first) // two words say nothing
  assert.equal(synopsisOf('Will he survive the old forest near the village he grew up in, and at what cost?'), null)
})

test('tagline: the first sentence when it is whole and short, and nothing otherwise', () => {
  assert.equal(taglineOf('A deaf girl is bullied by the popular boy in her class. Years later he looks for her.'), 'A deaf girl is bullied by the popular boy in her class.')
  assert.equal(taglineOf('A boy fights... for "the right death." He is not alone.'), null) // dots inside read as a cut-off
  assert.equal(taglineOf('What would you do for one more day? He finds out.'), null)
  assert.equal(taglineOf(`${'A very long opening sentence that goes on. '.replace('.', '').repeat(4)}.`), null)
  assert.ok(TAGLINE_MAX <= 120)
  assert.equal(taglineOf(''), null)
})

test('hashtag: a season or part suffix and a subtitle are left out of the title tag', () => {
  assert.deepEqual(['Chitose Is in the Ramune Bottle 2nd Cour', 'Dandadan 3rd Season', 'Black Clover Season 2', 'Pokémon Horizons: The Series', 'Attack on Titan Final Season Part 2'].map(baseTitle), ['Chitose Is in the Ramune Bottle', 'Dandadan', 'Black Clover', 'Pokémon Horizons', 'Attack on Titan'])
  // One word before the colon is not a name on its own; a title with no suffix is untouched.
  assert.deepEqual(['Frieren: Beyond Journey’s End', 'Solo Leveling', 'Re:Zero'].map(baseTitle), ['Frieren: Beyond Journey’s End', 'Solo Leveling', 'Re:Zero'])
  assert.equal(tagsFor({ title: 'Chitose Is in the Ramune Bottle 2nd Cour', genres: [] })[0], '#ChitoseIsInTheRamuneBottle')
})

test('wrapping: a line never ends on a separator, and a short last word is not left alone', () => {
  const lines = wrapUnits('Drama · Psychological · Mystery', 20)
  assert.deepEqual(lines, ['Drama', 'Psychological'])
  assert.deepEqual(wrapUnits('Action · Fantasy · Drama', 18), ['Action · Fantasy', 'Drama'])
  assert.ok(lines.every((line) => !/·\s*$/.test(line)))
  assert.equal(noOrphan('Pokémon Horizons: The Series'), `Pokémon Horizons: The${NBSP}Series`)
  assert.equal(noOrphan("The Swordmaster's Son"), "The Swordmaster's Son") // tying these would strand "The"
  assert.equal(noOrphan('DARK MACHINE THE ANIMATION'), 'DARK MACHINE THE ANIMATION')
  assert.deepEqual([linesOf('PSYREN', 84, INNER), linesOf('Mahou Shoujo Ikusei Keikaku: restart', 56, INNER), linesOf('', 56, INNER)], [1, 2, 0])
})

const solid = (color) => sharp({ create: { width: 120, height: 170, channels: 3, background: color } })

test('covers: a logo on plain white or black is a placeholder; real art is not', async () => {
  const logo = await solid('#ffffff').composite([{ input: await sharp({ create: { width: 40, height: 20, channels: 3, background: '#cc2222' } }).png().toBuffer(), left: 40, top: 70 }]).png().toBuffer()
  assert.equal(await isBlankCover(logo, sharp), true)
  assert.equal(await isBlankCover(await solid('#000000').png().toBuffer(), sharp), true)
  const art = await solid('#3366aa').composite([{ input: await sharp({ create: { width: 60, height: 90, channels: 3, background: '#eeeeee' } }).png().toBuffer(), left: 30, top: 40 }]).png().toBuffer()
  assert.equal(await isBlankCover(art, sharp), false)
})

test('amazon line: the words fit the product and the post', () => {
  const book = { t: 'book', n: 'Vol. 1' }
  assert.equal(shopLabel(book, { kind: 'anime', source: 'MANGA' }, 'Manga'), 'Read the manga it is based on')
  assert.equal(shopLabel(book, { kind: 'anime', source: 'LIGHT_NOVEL' }, 'Light novel'), 'Read the light novel it is based on')
  // An original anime is not "based on" the manga made after it; a comic's own volume is just the volume.
  assert.equal(shopLabel(book, { kind: 'anime', source: 'ORIGINAL' }, 'Manga'), 'Get the manga on Amazon')
  assert.equal(shopLabel(book, { kind: 'manga' }, 'Manhwa'), 'Get the manhwa on Amazon')
  assert.equal(shopLabel(book, { kind: 'manga' }, null), 'Get the English edition on Amazon')
  assert.equal(shopLabel({ t: 'disc', n: 'The Complete Series Blu-ray' }, { kind: 'anime' }, null), 'Get the Blu-ray on Amazon')
  assert.equal(shopLabel({ t: 'figure', n: 'Nendoroid' }, { kind: 'anime' }, null), 'Get the figure on Amazon')
  for (const pick of [{ t: 'figure' }, { t: 'disc', n: 'DVD' }, { t: 'poster' }]) assert.doesNotMatch(shopLabel(pick, { kind: 'anime', source: 'MANGA' }, null), /book|read/i)
})

test('comment line: a list post whose comment opens one title says so', () => {
  assert.equal(START_WITH_ONE, 'Start with #1: link in the first comment')
  for (const turn of [0, 1, 2]) {
    assert.match(ctaOf('first', turn), /#1|number one/i)
    assert.doesNotMatch(ctaOf('first', turn), /each one|whole list|full list/i)
    assert.match(ctaOf('list', turn), /first comment/)
  }
})

// --- the mix of kinds --------------------------------------------------------

const wording = [(p) => ({ hook: `🔥 ${p.item} is here.`, facts: ['One fact.'], cta: '👇 Link in the first comment.' })]
const kind = (key, items, over = {}) => ({ key, urgent: false, gapDays: 0, titleGap: false, window: 1, find: () => items.map((item) => ({ item, title: null, path: '/x' })), captions: wording, ...over })
const said = (...keys) => keys.map((type, i) => ({ type, item: `old-${i}`, at: 1000 + i, day: '2026-10-11', page: 'x' }))
const next = (kinds, history, slotsLeft = Infinity) => planNext({ kinds, data: {}, history, now: 10_000_000, rng: () => 0, slotsLeft })?.type.key

test('mix: the same kind never runs back to back while another kind has something to post', () => {
  const a = kind('a', ['a1', 'a2'])
  const b = kind('b', ['b1'])
  assert.equal(next([a, b], said('b', 'a')), 'b')
  assert.equal(next([a, b], said('a', 'b')), 'a')
  // Nothing else to post: the kind repeats rather than leave the Page silent.
  assert.equal(next([a, kind('b', [])], said('b', 'a')), 'a')
  assert.equal(next([a], said('a', 'a', 'a')), 'a')
})

test('mix: news may go first, but never a third time in a row while another kind is waiting', () => {
  const news = kind('news', ['n1', 'n2', 'n3'], { urgent: true })
  const fact = kind('fact', ['f1'])
  assert.equal(MAX_STREAK, 2)
  // News outranks the rotation, and may run twice when the day is short of slots.
  assert.equal(next([fact, news], said('fact')), 'news')
  assert.equal(next([fact, news], said('fact', 'news'), 2), 'news')
  assert.equal(next([fact, news], said('news', 'news'), 2), 'fact')
  // With nothing else to post, the news goes out all the same.
  assert.equal(next([kind('fact', []), news], said('news', 'news'), 2), 'news')
})

// --- this site's types --------------------------------------------------------

const typeOf = (key) => TYPES.find((t) => t.key === key)
const dataOf = (items) => buildData(items, NOW, Object.fromEntries(items.map((i) => [i.id, i.slug])), sampleSchedule())

test('next month: the list runs in date order, ties by popularity, a month-only date last', () => {
  // Popularity runs against the dates, so the order shown is not the order found.
  const items = [...[5, 3, 3, 1].map((day, n) => upcoming(n, { title: `Day ${day} ${n}`, startDate: [2026, 11, day], popularity: 9000 - n * 100 })), upcoming(7, { title: 'Month Only', startDate: [2026, 11, 1], startPrecision: 'month', popularity: 9900 })]
  const [post] = typeOf('next-month').find(dataOf(items), { now: NOW })
  assert.deepEqual(post.view.cells.map((c) => [c.title, c.date]), [['Day 1 3', '1 Nov'], ['Day 3 1', '3 Nov'], ['Day 3 2', '3 Nov'], ['Day 5 0', '5 Nov'], ['Month Only', 'November']])
  // A tile whose cover turned out blank gives way; too few left, and the post is dropped.
  assert.equal(post.without([0, 1, 2]), null)
  const six = Array.from({ length: 6 }, (_, n) => upcoming(n))
  const [full] = typeOf('next-month').find(dataOf(six), { now: NOW })
  assert.deepEqual(full.without([0]).view.cells.map((c) => c.title), ['Soon 1', 'Soon 2', 'Soon 3', 'Soon 4', 'Soon 5'])
})

test('next week: the rows run in day order', () => {
  const [week] = typeOf('next-week').find(dataOf(sampleItems()), { now: NOW })
  const days = week.view.rows.map((r) => r.date)
  assert.deepEqual(days, [...days].sort((x, y) => Number.parseInt(x, 10) - Number.parseInt(y, 10)))
})

test('episode card: the title leads, and a fact card is offered once per title, strongest fact only', () => {
  const data = dataOf(sampleItems())
  const [episode] = typeOf('episode').find(data, { now: NOW })
  assert.ok(episode.view.title && episode.view.number > 0 && 'tagline' in episode.view)
  const facts = typeOf('fact').find(data, { now: NOW })
  assert.equal(new Set(facts.map((p) => p.title)).size, facts.length)
  assert.deepEqual(facts.map((p) => [p.title, p.view.figure]), [['Steel Harbor', '#7'], ['Iron Coast', '#30']])
  assert.ok(facts.every((p) => p.view.line.includes(p.title)))
  // List posts whose comment opens one title say "start with #1".
  for (const key of ['next-week', 'next-month', 'anticipated']) for (const post of typeOf(key).find(data, { now: NOW + (key === 'next-week' ? 0 : 0) })) assert.match(typeOf(key).captions[0](post).cta, /#1/)
  assert.ok(DAY > 0)
})
