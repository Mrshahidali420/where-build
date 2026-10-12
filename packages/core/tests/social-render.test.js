// Every template post type: it finds posts from the data alone, every wording
// of its caption passes the gate, its image tree is whole, and the renderer
// turns a tree into a 1080x1350 picture with the real font files.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { captionFor } from '../scripts/social/plan.mjs'
import { checkText, detailLines, MAX_POST, MAX_POST_TAGS } from '../scripts/social/text.mjs'
import { kitOf, contain, toneOf, W, H } from '../scripts/social/render/parts.mjs'
import { loadArt, loadFonts, renderPost, WIDTH, HEIGHT } from '../scripts/social/render/engine.mjs'
import { TYPES, TYPE_KEYS } from '../scripts/social/types/index.mjs'
import { factsOf } from '../scripts/social/types/fact.mjs'
import { scopesOf } from '../scripts/social/types/anticipated.mjs'
import { samplePosts, argsOf } from '../scripts/social/samples.mjs'
import { NOW, DAY, BLOCKED } from './social-kit.mjs'
import { classic, fakeArt, sampleData, walk } from './social-data.mjs'

/** A theme from fonts the repo installs, so the test never depends on a site. */
const THEME = {
  name: 'Fixture Index',
  domain: 'example.com',
  color: { night: '#101010', raised: '#181818', accent: '#c3e64f', paper: '#f0f0f0' },
  font: { display: 'Unbounded', text: 'Figtree', displayBold: 700, displayBlack: 900, textRegular: 400, textMedium: 500, textBold: 800 },
  fonts: [
    { name: 'Unbounded', pkg: '@fontsource/unbounded', file: 'unbounded', weights: [700, 900] },
    { name: 'Figtree', pkg: '@fontsource/figtree', file: 'figtree', weights: [400, 500, 800] },
  ],
  mark: { file: null },
}
const kit = kitOf(THEME, {})
const data = sampleData()
const postsOf = (type) => type.find(data, { now: NOW })

test('types: the thirteen WhereAnime types are there, each with its own name and design', () => {
  assert.deepEqual([...TYPE_KEYS].sort(), ['airtime', 'anticipated', 'birthday', 'character', 'cosplay', 'episode', 'fact', 'fanart', 'next-month', 'next-week', 'onair', 'premiere', 'where'])
  // Fan art and cosplay share one design (types/art-card.mjs): a picture and its credit.
  assert.equal(new Set(TYPES.map((t) => t.template)).size, TYPES.length - 1)
  for (const type of TYPES) {
    assert.ok(type.name && type.gapDays > 0 && type.captions.length >= 3, type.key)
    assert.equal(typeof type.find, 'function')
  }
})

test('types: every type finds a post in the sample data, and every wording passes the gate', () => {
  for (const type of TYPES) {
    const posts = postsOf(type)
    assert.ok(posts.length > 0, `${type.key} found nothing`)
    for (const post of posts) {
      assert.ok(post.item && post.path.startsWith('/anime/') && post.label, `${type.key}: ${JSON.stringify(post).slice(0, 80)}`)
      const seen = new Set()
      for (let turn = 0; turn < type.captions.length; turn += 1) {
        const made = captionFor({ ...type, captions: [type.captions[turn]] }, post, 0, BLOCKED)
        assert.ok(made, `${type.key} wording ${turn + 1} failed for ${post.item}`)
        assert.equal(checkText(made.caption, { blockedTags: BLOCKED, max: MAX_POST, emoji: 4 + detailLines(post.details).length, maxTags: MAX_POST_TAGS }), null)
        // Hook, then a question, then the line about the first comment, then the hashtags.
        const parts = made.caption.split('\n\n')
        assert.match(parts[0], /\p{Extended_Pictographic}/u, `${type.key}: the hook opens with an emoji`)
        assert.ok(parts.at(-3).endsWith('?'), `${type.key}: ${made.caption}`)
        assert.match(parts.at(-2), /^👇 .*first comment/)
        assert.match(parts.at(-1), /^#\S+( #\S+)*$/)
        seen.add(made.caption)
      }
      assert.equal(seen.size, type.captions.length, `${type.key}: the wordings must differ`)
    }
  }
})

test('types: every image tree is whole (the right size, no missing text, sized pictures)', () => {
  for (const type of TYPES) {
    for (const post of postsOf(type)) {
      const tree = type.template({ ...post.view, art: fakeArt(post) }, kit)
      assert.deepEqual([tree.props.style.width, tree.props.style.height], [W, H], type.key)
      const { texts, images } = walk(tree)
      assert.ok(texts.includes('Fixture Index') && texts.includes('example.com'), `${type.key}: the site name and address close every image`)
      assert.ok(texts.some((text) => /link in the first comment$/.test(text)), `${type.key}: every image points at the first comment`)
      for (const text of texts) assert.doesNotMatch(text, /undefined|null|NaN|\[object/, `${type.key}: ${text}`)
      for (const image of images) assert.ok(image.width > 0 && image.height > 0 && image.src, `${type.key}: a picture without a size`)
      // A missing small picture leaves a flat panel, never a hole in the tree.
      assert.ok(type.template({ ...post.view, art: { hero: fakeArt(post).hero, thumbs: [] } }, kit))
    }
  }
})

test('types: what each one says comes from the record', () => {
  const episodes = postsOf(TYPES.find((t) => t.key === 'episode'))
  assert.deepEqual(episodes.map((p) => p.item), ['100:12', '2:7']) // today's episodes, most popular first
  const ep = episodes[1]
  assert.deepEqual([ep.view.number, ep.view.time, ep.view.aired], [7, '5:00 PM ET', false])
  assert.deepEqual([episodes[0].view.time, episodes[0].view.aired], ['12:00 PM ET', true])

  const [premiere] = postsOf(TYPES.find((t) => t.key === 'premiere'))
  assert.deepEqual([premiere.title, premiere.view.day, premiere.view.date], ['Soon 0', 'tomorrow', 'Tuesday 13 October'])

  const [week] = postsOf(TYPES.find((t) => t.key === 'next-week'))
  assert.equal(week.item, 'week:2026-10-19')
  assert.deepEqual(week.view.rows.map((r) => `${r.day} ${r.date}`), ['Tue 20 Oct', 'Wed 21 Oct', 'Fri 23 Oct'])

  const [month] = postsOf(TYPES.find((t) => t.key === 'next-month'))
  assert.equal(month.item, 'month:2026-11')
  assert.equal(month.view.total, 7) // the year-only date is left out
  assert.equal(month.view.cells[0].date, '1 Nov')
  assert.equal(TYPES.find((t) => t.key === 'next-month').find(sampleData(), { now: NOW + 40 * DAY }).length, 0) // nothing dated in December

  const scopes = scopesOf(data.titles)
  assert.deepEqual(scopes.map((s) => s.key), ['all', 'season:2027-WINTER'])
  const [top] = postsOf(TYPES.find((t) => t.key === 'anticipated'))
  assert.deepEqual(top.view.rows.map((r) => r.count), ['50K', '49K', '48K', '47K', '46K'])

  const [char] = postsOf(TYPES.find((t) => t.key === 'character'))
  assert.deepEqual([char.item, char.name, char.view.voice, char.view.voiceEn], ['char:901', 'Mira Vale', 'Voice 901', 'English 901'])
  assert.ok(!postsOf(TYPES.find((t) => t.key === 'character')).some((p) => p.name === 'Extra')) // a supporting role

  const onair = postsOf(TYPES.find((t) => t.key === 'onair'))
  assert.deepEqual(onair.map((p) => [p.title, p.view.number, p.view.weekday]), [['Weekly Show', 5, 'Thursday']]) // today's episode is not "next"
})

test('facts: only what the record states, and a fact it lacks is never offered', () => {
  const entry = data.byId.get(100)
  assert.deepEqual(factsOf(entry).map((f) => [f.kind, f.figure]), [['rated', '#7'], ['run', '124'], ['score', '8.8']]) // strongest first
  // A rank for one year is not an all-time rank, a short run is not a long one.
  const plain = sampleData().byId.get(2)
  assert.deepEqual(factsOf(plain), []) // a good score is not a strong fact: no card
  assert.deepEqual(factsOf({ ...plain, score: 90, rating: '9.0' }).map((f) => [f.kind, f.figure]), [['score', '9.0']])
  // The sentence on the image names the title, and a rank outside the top 50 is not offered.
  assert.ok(factsOf(entry).every((f) => f.line.includes('Steel Harbor')))
  assert.deepEqual(factsOf({ ...plain, ranks: [{ rank: 51, type: 'POPULAR' }] }), [])
  assert.match(factsOf(entry)[0].say[0], /^Steel Harbor is the number 7 highest rated anime of all time on AniList\.$/)
  assert.ok(classic().ranks.some((r) => !r.allTime)) // the fixture does carry a yearly rank
})

test('parts: a picture is placed whole, and each tone keeps type readable', () => {
  assert.deepEqual(contain(0.5, 400, 400), { width: 200, height: 400 })
  assert.deepEqual(contain(2, 400, 400), { width: 400, height: 200 })
  assert.equal(toneOf(THEME, 'dark').ink, THEME.color.paper)
  assert.equal(toneOf(THEME, 'light').pop, THEME.color.night) // the accent is never type on cream
  assert.equal(toneOf(THEME, 'accent').bg, THEME.color.accent)
})

test('samples: two different posts per type, looking at later days when today has one', async () => {
  const loadData = async (at) => sampleData(at)
  const facts = await samplePosts(TYPES.find((t) => t.key === 'fact'), { per: 2, now: NOW, loadData })
  assert.equal(new Set(facts.map((s) => s.post.title)).size, 2)
  const weeks = await samplePosts(TYPES.find((t) => t.key === 'next-week'), { per: 2, now: NOW, loadData })
  assert.equal(weeks.length, 1) // the sample schedule has one week of premieres
  assert.deepEqual(argsOf(['--out', 'x', '--per', '3', '--types', 'fact,where', '--long']), { out: 'x', per: 3, only: ['fact', 'where'], long: true })
})

test('engine: the real fonts load and a template becomes a 1080x1350 picture', async () => {
  const { default: sharp } = await import('sharp')
  assert.ok(loadFonts(THEME).length >= 5)
  const cover = await sharp({ create: { width: 46, height: 65, channels: 3, background: '#3355aa' } }).jpeg().toBuffer()
  const fetch = async (url) => (/missing/.test(url) ? { ok: false } : { ok: true, arrayBuffer: async () => cover })
  const art = await loadArt('https://img.example/a.jpg', { fetch, sharp })
  assert.ok(art.src.startsWith('data:image/jpeg;base64,') && Math.abs(art.ratio - 46 / 65) < 0.01)
  assert.equal(await loadArt('https://img.example/missing.jpg', { fetch, sharp }), null)

  const type = TYPES.find((t) => t.key === 'episode')
  const [post] = postsOf(type)
  const { png, jpeg } = await renderPost(type, post, { theme: THEME, fetch })
  const meta = await sharp(png).metadata()
  assert.deepEqual([meta.width, meta.height, meta.format], [WIDTH, HEIGHT, 'png'])
  assert.equal((await sharp(jpeg).metadata()).format, 'jpeg')
  // The hero picture is required: without it nothing is drawn.
  await assert.rejects(renderPost(type, { ...post, art: { hero: 'https://img.example/missing.jpg' } }, { theme: THEME, fetch }), /main picture/)
})
