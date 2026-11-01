// The airing news (tasks/airing-queue-plan.md): caps per kind on the old
// queue (FB_TYPE_CAPS), and the types out now, final episode and episodes
// out today, with their two card looks and their short captions.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { kindsNow, underCap } from '../scripts/social/attempt.mjs'
import { captionFor, planNext } from '../scripts/social/plan.mjs'
import { settingsOf, typeCapsOf } from '../scripts/social/post.mjs'
import { kitOf } from '../scripts/social/render/parts.mjs'
import { dateOf } from '../scripts/social/when.mjs'
import { TYPES, REELS } from '../scripts/social/types/index.mjs'
import outNow, { AFTER_MS } from '../scripts/social/types/out-now.mjs'
import finale from '../scripts/social/types/finale.mjs'
import today from '../scripts/social/types/today.mjs'
import { NOW, HOUR, BLOCKED } from './social-kit.mjs'
import { sampleData, sampleStills, walk } from './social-data.mjs'

const THEME = { name: 'Fixture Index', domain: 'example.com', color: { night: '#0b0a12', raised: '#1a1824', accent: '#c4e650', paper: '#f4f1ea' }, font: { display: 'D', text: 'T', displayBold: 700, displayBlack: 800, textRegular: 400, textMedium: 500, textBold: 700 } }
const kit = kitOf(THEME, {})
const typeOf = (key) => TYPES.find((t) => t.key === key)
const posted = (type, minutesAgo, over = {}) => ({ type, status: 'posted', at: NOW - minutesAgo * 60_000, day: dateOf(NOW - minutesAgo * 60_000), ...over })

test('caps: FB_TYPE_CAPS is read as kind -> most posts in 24 hours, bad parts left out', () => {
  assert.deepEqual([...typeCapsOf('where:30, character:30,fact:2,bad,x:0,y:-1,z:1.5')], [['where', 30], ['character', 30], ['fact', 2]])
  assert.equal(typeCapsOf('').size, 0)
  assert.deepEqual([...settingsOf({ FB_TYPE_CAPS: 'fanart:1' }).typeCaps], [['fanart', 1]])
})

test('caps: a kind at its cap of posts in the rolling 24 hours waits; the rest go on', () => {
  const kinds = ['classic', { key: 'where' }, { key: 'fact' }, { key: 'episode', urgent: true }]
  const caps = typeCapsOf('where:2,fact:1,classic:1')
  const history = [posted('where', 60), posted('where', 30), posted('fact', 25 * 60), { status: 'posted', at: NOW - 10 * 60_000 }]
  assert.deepEqual(underCap(kinds, history, NOW, caps).map((k) => k.key || k), ['fact', 'episode'])
  // A failed post does not count, and one older than 24 hours has left the window.
  assert.deepEqual(underCap(kinds, [posted('where', 60, { status: 'failed' }), posted('where', 30)], NOW, caps).map((k) => k.key || k), ['classic', 'where', 'fact', 'episode'])
  assert.deepEqual(kindsNow(kinds, history, NOW, 3, null, caps).map((k) => k.key || k), ['fact', 'episode'])
  assert.equal(kindsNow(kinds, history, NOW, 3).length, 4)
})

test('out now: an episode that aired in the last four hours, most popular first', () => {
  const data = sampleData()
  assert.deepEqual(outNow.find(data, { now: NOW }).map((p) => p.item), ['100:12:out', '101:24:out'])
  // Before the air time it is not out; four hours after, it is no longer news.
  assert.deepEqual(outNow.find(data, { now: NOW - 3 * HOUR }).map((p) => p.item), [])
  assert.deepEqual(outNow.find(data, { now: NOW - 2 * HOUR + AFTER_MS + 60_000 }).map((p) => p.item), ['101:24:out'])
})

test('out now and final episode are their own posts even when the title had a post today', () => {
  const data = sampleData()
  const history = [posted('where', 30, { title: 'Steel Harbor', item: '100' }), posted('where', 20, { title: 'Iron Coast', item: '101' })]
  const plan = planNext({ kinds: [outNow], data, history, now: NOW, rng: () => 0 })
  assert.equal(plan.post.item, '100:12:out')
  const last = planNext({ kinds: [finale], data, history, now: NOW, rng: () => 0 })
  assert.equal(last.post.item, '101:final')
})

test('final episode: only the last episode of a show, on its day', () => {
  const data = sampleData()
  assert.deepEqual(finale.find(data, { now: NOW }).map((p) => [p.item, p.aired]), [['101:final', true]])
  assert.deepEqual(finale.find(data, { now: NOW + 2 * 24 * HOUR }), [])
})

test('episodes out today: one list a day that names no single title, with a swipe post', () => {
  const [post] = today.find(sampleData(), { now: NOW })
  assert.equal(post.title, null)
  assert.equal(post.view.items.length, 3)
  assert.ok(REELS.some((reel) => reel.carouselOf === 'today' && typeof reel.carousel === 'function'))
})

test('short captions: a capitals hook, one fact, a question, the link line, three hashtags', () => {
  const data = sampleData()
  for (const type of [outNow, finale, today]) {
    for (const post of type.find(data, { now: NOW })) {
      for (let turn = 0; turn < type.captions.length; turn += 1) {
        const made = captionFor({ ...type, captions: [type.captions[turn]] }, post, 0, BLOCKED)
        assert.ok(made, `${type.key} ${turn}`)
        const parts = made.caption.split('\n\n')
        assert.ok(parts.length <= 5, `${type.key}: ${made.caption}`)
        assert.match(parts.at(-3), /^💬 .*\?$/)
        assert.ok(parts.at(-1).split(' ').length <= 3)
        const hook = parts[0].split('\n')[0]
        assert.equal(hook, hook.toUpperCase(), `${type.key}: the hook is in capitals`)
      }
    }
  }
})

test('cards: with stills, the white band over a grid; without, the wide picture and the tag', () => {
  const data = { ...sampleData(), stills: [...sampleStills(100, 4)] }
  const [post] = outNow.find(data, { now: NOW })
  assert.equal(post.art.frames.length, 4)
  const fake = { src: 'data:image/jpeg;base64,AA==', ratio: 16 / 9 }
  const grid = outNow.template({ ...post.view, art: { frames: post.art.frames.map(() => fake) } }, kit)
  const g = walk(grid)
  assert.ok(['EPISODE 12', 'AIRED', 'TODAY', 'Fixture Index', 'example.com'].every((text) => g.texts.includes(text)), g.texts.join('|'))
  assert.equal(g.images.length, 4)
  const plain = outNow.template({ ...post.view, art: { hero: fake } }, kit)
  const p = walk(plain)
  assert.ok(['EPISODE 12', 'AIRED TODAY', 'STEEL HARBOR'].every((text) => p.texts.includes(text)), p.texts.join('|'))
  for (const tree of [grid, plain]) assert.deepEqual([tree.props.style.width, tree.props.style.height], [1080, 1350])
  // A finale says so.
  const [last] = finale.find(sampleData(), { now: NOW })
  assert.ok(walk(finale.template({ ...last.view, art: { hero: fake } }, kit)).texts.includes('FINAL EPISODE'))
  assert.equal(typeOf('out-now').sameDay && typeOf('finale').sameDay, true)
})

test('the fact never names Amazon (the caption gate bans the word), so the post still has a caption', () => {
  const data = sampleData()
  const title = { ...data.byId.get(100), platforms: ['Amazon Prime Video', 'Crunchyroll'] }
  const byId = new Map(data.byId).set(100, title)
  const [post] = outNow.find({ ...data, byId }, { now: NOW })
  assert.match(post.fact, /^It airs today at .* ET. Crunchyroll usually adds it within hours/); assert.doesNotMatch(post.fact, /amazon/i)
  assert.ok(captionFor(outNow, post, 0, BLOCKED))
})
