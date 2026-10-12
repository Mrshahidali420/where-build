// Episode stills (stills/, types/stills.mjs, scenes.mjs, collage.mjs): Kitsu
// on a recorded answer, the picture checks on made-up pictures, twins, which
// shows are looked at, and the three types. No network.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import sharp from 'sharp'
import { kitsuIdOf, latestStills, toStill, firstStills } from '../scripts/social/stills/kitsu.mjs'
import { showsFor, loadStills, MIN_POPULARITY } from '../scripts/social/stills/load.mjs'
import { distance, distinct, fingerprint, judgeStill } from '../scripts/social/stills/quality.mjs'
import { captionFor } from '../scripts/social/plan.mjs'
import { kitOf } from '../scripts/social/render/parts.mjs'
import collage from '../scripts/social/types/collage.mjs'
import scenes from '../scripts/social/types/scenes.mjs'
import stills from '../scripts/social/types/stills.mjs'
import { NOW, HOUR, BLOCKED } from './social-kit.mjs'
import { sampleData, sampleStills, walk } from './social-data.mjs'

const REC = JSON.parse(readFileSync(new URL('./fixtures/kitsu-frieren.json', import.meta.url), 'utf8'))
const kitsu = async (url) => ({ ok: true, json: async () => (url.includes('/mappings') ? REC.mapping : REC.episodes) })
const KIT = kitOf({ name: 'X', domain: 'x.com', color: { night: '#000000', raised: '#111111', accent: '#ff0000', paper: '#ffffff' }, font: {} }, {})
const FAKE = { src: 'data:image/jpeg;base64,AA==', ratio: 16 / 9 }

/** A made-up scene: a soft gradient with a bright block whose place depends on the seed. */
async function scene(seed, width = 1280, height = 720) {
  const pixels = Buffer.alloc(width * height * 3)
  const left = (seed * 173) % (width - 300)
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const i = (y * width + x) * 3
      const lit = x >= left && x < left + 300 && y > 200 && y < 500
      pixels[i] = pixels[i + 1] = pixels[i + 2] = lit ? 240 : 40 + Math.round((x / width) * 120)
    }
  }
  return sharp(pixels, { raw: { width, height, channels: 3 } }).jpeg().toBuffer()
}

/** A made-up still: noise (sharp, lit), or flat black, or with black bars, or blurred. */
async function picture({ width = 1280, height = 720, kind = 'noise', seed = 1 } = {}) {
  const pixels = Buffer.alloc(width * height * 3)
  let n = seed
  for (let i = 0; i < pixels.length; i += 1) {
    n = (n * 1103515245 + 12345) & 0x7fffffff
    pixels[i] = kind === 'black' ? 4 : 60 + (n % 160)
  }
  if (kind === 'bars') pixels.fill(0, 0, width * Math.round(height * 0.12) * 3).fill(0, width * Math.round(height * 0.88) * 3)
  let img = sharp(pixels, { raw: { width, height, channels: 3 } })
  if (kind === 'blur') img = img.blur(12)
  return img.jpeg().toBuffer()
}

test('kitsu: the id from the MyAnimeList id, and the stills of the episodes, oldest first', async () => {
  const id = await kitsuIdOf(52991, { fetch: kitsu })
  assert.equal(id.id, REC.mapping.included[0].id)
  const list = await latestStills(id.id, { count: 5, fetch: kitsu })
  assert.equal(list.length, 5)
  assert.ok(list.every((s, i) => i === 0 || s.number > list[i - 1].number))
  assert.ok(list.every((s) => s.url.startsWith('https://') && s.id.startsWith('kitsu:')))
  assert.equal((await firstStills(id.id, { count: 2, fetch: kitsu }))[0].number, 1)
  assert.equal(toStill({ id: '1', attributes: { number: 3, thumbnail: null } }), null)
})

test('quality: big, lit and sharp passes; small, black, letterboxed or soft does not', async () => {
  assert.equal((await judgeStill(await picture(), sharp)).reason, null)
  assert.match((await judgeStill(await picture({ width: 640, height: 360 }), sharp)).reason, /too small/)
  assert.match((await judgeStill(await picture({ kind: 'black' }), sharp)).reason, /mostly black/)
  assert.match((await judgeStill(await picture({ kind: 'bars' }), sharp)).reason, /black bars/)
  assert.match((await judgeStill(await picture({ kind: 'blur' }), sharp)).reason, /soft/)
})

test('twins: the same frame twice is shown once', async () => {
  const a = await fingerprint(await scene(1), sharp)
  const b = await fingerprint(await sharp(await scene(1)).resize(1000).jpeg({ quality: 60 }).toBuffer(), sharp)
  const c = await fingerprint(await scene(4), sharp)
  assert.ok(distance(a, b) < 6)
  assert.ok(distance(a, c) > 6)
  assert.equal(distinct([{ hash: a }, { hash: b }, { hash: c }]).length, 2)
})

test('shows: soon-airing first, then airing, then the best-known finished ones; popular only', () => {
  const t = (id, over) => ({ id, malId: id, popularity: 200000, status: 'RELEASING', episodes: 12, ...over })
  const soon = { nextEpisode: { at: NOW + 2 * HOUR } }
  const list = [t(1, { status: 'FINISHED' }), t(2), t(3, soon), t(4, { popularity: MIN_POPULARITY - 1 }), t(5, { malId: null }), t(6, { status: 'NOT_YET_RELEASED', ...soon })]
  // In turns, a few an hour: over enough hours every show comes round, the unpopular one never.
  const seen = new Set(Array.from({ length: 6 }, (_, h) => showsFor(list, NOW + h * HOUR, 3).map((s) => s.id)).flat())
  assert.deepEqual([...seen].sort(), [1, 2, 3, 5, 6])
  // A census: every airing or premiering show, the less-followed ones too, no finished one.
  assert.deepEqual(showsFor(list, NOW, 3, { census: true }).map((s) => s.id).sort(), [2, 3, 4, 5, 6])
  assert.equal(showsFor([], NOW).length, 0)
})

test('loader: checked stills of the shows of the hour; a source that fails gives none', async () => {
  const good = await picture()
  const fetch = async (url) => (url.includes('kitsu.io') ? kitsu(url) : { ok: true, arrayBuffer: async () => good })
  const title = { id: 7, title: 'Frieren', malId: 52991, popularity: 500000, status: 'RELEASING', episodes: 28 }
  const out = await loadStills({ now: NOW, titles: [title], fetch, sharp })
  assert.equal(out.length, 1)
  assert.equal(out[0].stills.length, 1) // every made-up frame is the same picture: twins are dropped
  const said = []
  assert.deepEqual(await loadStills({ now: NOW, titles: [title], fetch: async () => ({ ok: false, status: 500 }), sharp, say: (l) => said.push(l) }), [])
  assert.match(said[0], /could not be read/)
})

function withStills(count, over = {}) {
  const data = sampleData()
  return { ...data, stills: sampleStills(2, count), ...over }
}

test('types: one still, two scenes, a collage of five; each finds, words and draws', () => {
  const data = withStills(6)
  for (const type of [stills, scenes, collage]) {
    const posts = type.find(data, { now: NOW })
    assert.equal(posts.length, 1, type.key)
    const post = posts[0]
    for (let turn = 0; turn < type.captions.length; turn += 1) assert.ok(captionFor({ ...type, captions: [type.captions[turn]] }, post, 0, BLOCKED), `${type.key} ${turn}`)
    const art = { hero: post.art.hero ? FAKE : null, thumbs: (post.art.thumbs || []).map(() => FAKE), frames: (post.art.frames || []).map(() => FAKE) }
    const { images } = walk(type.template({ ...post.view, art }, KIT))
    assert.equal(images.length, { stills: 1, scenes: 2, collage: 5 }[type.key] + (type.key === 'scenes' ? 0 : 0), type.key)
  }
  assert.equal(stills.find(data, { now: NOW })[0].episode, 6)
  assert.deepEqual(scenes.find(data, { now: NOW })[0].episodes, [5, 6])
  assert.deepEqual(collage.find(data, { now: NOW })[0].range, [2, 6])
  // Too few frames: no collage. A finished show: no "newest episode" still, and scenes from its start.
  assert.equal(collage.find(withStills(4), { now: NOW }).length, 0)
  const done = withStills(6)
  done.stills[0].finished = true
  assert.equal(stills.find(done, { now: NOW }).length, 0)
  assert.deepEqual(scenes.find(done, { now: NOW })[0].episodes, [1, 2])
})

test('collage: eight good frames make the grid of eight, oldest first', () => {
  const post = collage.find(withStills(9), { now: NOW })[0]
  assert.equal(post.view.grid, true)
  assert.deepEqual(post.range, [2, 9])
  const art = { thumbs: post.art.thumbs.map(() => FAKE) }
  const { images } = walk(collage.template({ ...post.view, art }, KIT))
  assert.equal(images.length, 8)
  assert.equal(collage.find(withStills(7), { now: NOW })[0].view.grid, false)
})
