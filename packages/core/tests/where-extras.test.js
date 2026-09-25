// The Where site's shop, like pages, mood pages and title-page lines: the
// buy rows by source, the gates that keep thin pages out, and the hub paths
// the sitemap lists only when a gate built them.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { storesFrom } from '../src/lib/shop-links.js'
import { animeShopRows, songListen, shopOf } from '../src/where/shop.mjs'
import { closeness, similarAll, likeListOf, likePagesOf } from '../src/where/similar.mjs'
import { buildMoods, ANIME_MOODS } from '../src/where/moods.mjs'
import { gateOf, passesShop, WHERE_GATE_DEFAULTS } from '../src/where/gates.mjs'
import { hubPaths } from '../src/where/hubs.mjs'
import { likeIntro, likeHubs, moodHubs } from '../src/where/hub-extras.mjs'
import { computeWhere } from '../src/where/compute.mjs'
import { answerLine, castLanguages, dubOf, quickStats, pills } from '../src/where/title-lines.mjs'
import { faqOf } from '../src/where/faq.mjs'
import { voiceFacts } from '../src/where/person-facts.mjs'

const EMPTY = storesFrom({})
const TAGGED = storesFrom({ us: 'fixture-us' })

// ------------------------------------------------------------------ buy rows

test('a manga-based anime gets discs, the manga, figures and posters', () => {
  const rows = animeShopRows({ title: 'Frieren: Beyond Journey’s End', source: 'MANGA' }, 'US', EMPTY)
  assert.deepEqual(rows.map((r) => r.kind), ['discs', 'books', 'merch', 'prints'])
  assert.match(new URL(rows[1].url).searchParams.get('k'), /manga$/)
  for (const row of rows) assert.equal(new URL(row.url).searchParams.has('tag'), false, 'no tag until the owner has one')
})

test('the books row follows the source: light novel, novel, game, original, none', () => {
  const kindsOf = (source) => animeShopRows({ title: 'Some Show', source }, 'US', EMPTY)
  assert.match(new URL(kindsOf('LIGHT_NOVEL')[1].url).searchParams.get('k'), /light novel$/)
  assert.equal(kindsOf('VIDEO_GAME')[1].kind, 'games')
  assert.equal(kindsOf('ORIGINAL')[1].label, 'Art books and guides')
  assert.deepEqual(kindsOf('OTHER').map((r) => r.kind), ['discs', 'merch', 'prints'])
})

test('a real tag is carried on every buy row', () => {
  for (const row of animeShopRows({ title: 'Naruto', source: 'MANGA' }, 'US', TAGGED)) {
    assert.equal(new URL(row.url).searchParams.get('tag'), 'fixture-us')
  }
})

test('no usable name, no rows', () => {
  assert.deepEqual(animeShopRows({ title: '', romaji: '' }, 'US', EMPTY), [])
})

test('a song gets YouTube, Spotify and an Amazon affiliate search', () => {
  const links = songListen({ title: 'Yuusha', artists: [{ name: 'YOASOBI' }] }, 'US', EMPTY)
  assert.deepEqual(links.map((l) => l.label), ['YouTube', 'Spotify', 'Amazon'])
  assert.equal(links[2].aff, 'music')
  assert.equal(links[2].rel, 'nofollow sponsored noopener')
  assert.equal(new URL(links[2].url).searchParams.get('k'), 'Yuusha YOASOBI')
  assert.deepEqual(songListen({ title: '', artists: [] }), [])
})

// ------------------------------------------------------------------ /shop

const record = (id, extra = {}) => ({
  id,
  slug: `show-${id}`,
  title: `Show ${id}`,
  romaji: '',
  cover: `https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/${id}.jpg`,
  popularity: 1000 - id,
  source: 'MANGA',
  cast: [
    { name: `Hero ${id}`, image: 'h.jpg', role: 'MAIN' },
    { name: `Friend ${id}`, image: 'f.jpg', role: 'MAIN' },
    { name: `Extra ${id}`, image: 'e.jpg', role: 'MAIN' },
    { name: `Side ${id}`, image: 's.jpg', role: 'SUPPORTING' },
  ],
  ...extra,
})

test('the shop shelves hold only shows with a page, most watched first', () => {
  const shop = shopOf([record(3), record(1), record(2, { picks: { picks: [{ a: 'X', n: 'Vol 1', t: 'book' }], from: null } })])
  assert.equal(shop.total, 3)
  assert.deepEqual(shop.popular.map((row) => row[1]), ['/anime/show-1', '/anime/show-2', '/anime/show-3'])
  assert.match(shop.popular[0][2], /\/cover\/medium\//)
  assert.equal(shop.picked.length, 1)
  // Two main characters per show at most, never a supporting one.
  assert.deepEqual(shop.faces.filter((f) => f[4] === '/anime/show-1').map((f) => f[0]), ['Hero 1', 'Friend 1'])
})

test('the shop gate needs enough shelvable titles', () => {
  const gate = gateOf({ gates: [] }, 'shop')
  assert.equal(gate.min, WHERE_GATE_DEFAULTS.shop.min)
  assert.equal(passesShop(gate.min - 1, gate), false)
  assert.equal(passesShop(gate.min, gate), true)
})

// ------------------------------------------------------------------ similar and like pages

const item = (id, genres, tags = [], extra = {}) => ({ id, genres, tags, popularity: 10000 - id, title: `T${id}`, ...extra })

test('similar needs two shared genres, or one genre and two tags', () => {
  assert.equal(closeness(item(1, ['Action', 'Drama']), item(2, ['Action', 'Drama'])).score > 0, true)
  assert.equal(closeness(item(1, ['Action']), item(2, ['Action'])).score, 0)
  assert.equal(closeness(item(1, ['Action'], ['Revenge', 'Gore']), item(2, ['Action'], ['Gore', 'Revenge'])).score > 0, true)
})

test('similarAll never lists a title as like itself, best match first', () => {
  const items = [item(1, ['Action', 'Drama', 'Fantasy']), item(2, ['Action', 'Drama', 'Fantasy']), item(3, ['Action', 'Drama']), item(4, ['Comedy'])]
  const out = similarAll(items)
  assert.deepEqual(out.get(1).map((m) => m.id), [2, 3])
  assert.deepEqual(out.get(4), [])
})

test('a like list puts AniList recommendations first, then matches, no repeats', () => {
  const list = likeListOf(
    { id: 1, recIds: [{ id: 5, rating: 10 }, { id: 9, rating: 50 }, { id: 7, rating: 99 }] },
    [{ id: 5, genres: ['Action'], tags: [] }, { id: 6, genres: ['Action', 'Drama'], tags: [] }],
    (id) => id !== 7,
  )
  assert.deepEqual(list.map((r) => [r.id, r.why]), [[9, 'rec'], [5, 'rec'], [6, 'match']])
})

test('like pages only for the most watched, and only with a long enough list', () => {
  const items = Array.from({ length: 30 }, (_, i) => item(i + 1, ['Action', 'Drama', 'Fantasy'], [], { recIds: [] }))
  items.push(item(99, ['Cooking'], [], { popularity: 999999, recIds: [] }))
  const similar = similarAll(items)
  const likes = likePagesOf(items, similar, { top: 5, min: 10 })
  // The most watched title of all (99) has no close matches: no page.
  assert.equal(likes.has(99), false)
  // Only the top five by popularity could get one; 1 to 4 do.
  assert.deepEqual([...likes.keys()].sort((a, b) => a - b), [1, 2, 3, 4])
  for (const list of likes.values()) assert.ok(list.length >= 10)
  assert.equal(likePagesOf(items, similar, { top: 5, min: 100 }).size, 0)
})

test('every like intro is its own', () => {
  const r = (title, genres, studio) => ({ title, format: 'TV', startYear: 2013, studios: [{ name: studio }], genres, tags: ['Revenge'] })
  const rows = [{ why: 'rec' }, { why: 'match' }]
  const a = likeIntro(r('Attack on Titan', ['Action', 'Drama'], 'WIT STUDIO'), rows)
  const b = likeIntro(r('Frieren', ['Adventure', 'Fantasy'], 'MADHOUSE'), rows)
  assert.notEqual(a, b)
  assert.match(a, /^Attack on Titan is a 2013 TV series by WIT STUDIO that mixes action and drama/)
  assert.match(a, /these 2 anime come closest/)
})

// ------------------------------------------------------------------ moods

test('a mood with too few shows is not built', () => {
  const quiet = ANIME_MOODS.find((m) => m.slug === 'quiet-and-warm')
  const cosy = Array.from({ length: 5 }, (_, i) => item(i + 1, ['Slice of Life'], ['Iyashikei']))
  assert.equal(buildMoods(cosy, { min: 6, per: 60 }, [quiet]).length, 0)
  const built = buildMoods(cosy, { min: 5, per: 3 }, [quiet])
  assert.equal(built.length, 1)
  assert.equal(built[0].items.length, 3, 'a mood lists at most per')
})

test('a mood keeps out a show with an avoided tag', () => {
  const quiet = ANIME_MOODS.find((m) => m.slug === 'quiet-and-warm')
  const shows = [item(1, ['Slice of Life'], ['Iyashikei']), item(2, ['Slice of Life'], ['Iyashikei', 'Gore'])]
  assert.deepEqual(buildMoods(shows, { min: 1, per: 60 }, [quiet])[0].items.map((s) => s.id), [1])
})

test('every mood has its own slug and its own intro', () => {
  assert.equal(new Set(ANIME_MOODS.map((m) => m.slug)).size, ANIME_MOODS.length)
  assert.equal(new Set(ANIME_MOODS.map((m) => m.intro)).size, ANIME_MOODS.length)
})

// ------------------------------------------------------------------ hubs and counts

const emptyHubs = { groups: {}, years: {}, seasonIndex: [], genreIndex: [] }

test('the shop, mood and like pages are listed only when built', () => {
  const none = hubPaths(emptyHubs).map((p) => p.path)
  assert.ok(!none.includes('/shop') && !none.includes('/mood'))
  const card = (t) => [t.title, `/anime/${t.slug}`, t.cover]
  const recordOf = new Map([[1, { id: 1, slug: 'one', title: 'One', cover: 'c', genres: [], tags: [] }], [2, { id: 2, slug: 'two', title: 'Two', cover: 'c' }]])
  const moods = moodHubs([{ mood: ANIME_MOODS[0], items: [{ id: 2 }] }], recordOf, card)
  const like = likeHubs(new Map([[1, [{ id: 2, why: 'rec', genres: [], tags: [] }]]]), recordOf, card)
  const paths = hubPaths({ ...emptyHubs, shop: { popular: [] }, ...moods, like }).map((p) => p.path)
  assert.ok(paths.includes('/shop'))
  assert.ok(paths.includes('/mood'))
  assert.ok(paths.includes(`/mood/${ANIME_MOODS[0].slug}`))
  assert.ok(paths.includes('/anime/one/like'))
})

test('computeWhere counts the shop, mood and like pages its gates let through', () => {
  const site = {
    ownedKinds: [{ kind: 'anime' }],
    gates: [
      { page: '/shop', count: 'where', type: 'shop', min: 2 },
      { page: '/mood/<slug>', count: 'where', type: 'mood', min: 2, per: 60 },
      { page: '/anime/<slug>/like', count: 'where', type: 'like', top: 1, min: 1 },
    ],
  }
  const anime = [1, 2, 3].map((id) => ({
    id,
    kind: 'anime',
    country: 'JP',
    cover: 'c.jpg',
    title: `Cosy ${id}`,
    episodes: 12,
    popularity: 100 - id,
    genres: ['Slice of Life', 'Comedy'],
    tags: ['Iyashikei'],
  }))
  const where = computeWhere(site, { anime, credits: {}, staff: {}, themes: {}, airing: { schedule: [], history: {} } })
  assert.equal(where.counts.shop, 1)
  assert.ok(where.counts.mood >= 1)
  assert.equal(where.counts.like, 1)
  assert.ok(where.likes.has(1))
})

// ------------------------------------------------------------------ title-page lines

test('the answer line says what the show is and where it streams', () => {
  const r = { title: 'Frieren', format: 'TV', status: 'FINISHED', studios: [{ name: 'MADHOUSE' }], episodes: 28, season: 'FALL', seasonYear: 2023, watchOn: [{ site: 'Crunchyroll' }], cast: [], key: [], crew: [], songs: [], dated: 28 }
  const line = answerLine(r, ['Crunchyroll'])
  assert.match(line, /^Frieren is a finished TV series by MADHOUSE, 28 episodes, first aired Fall 2023\./)
  assert.match(line, /streams officially on Crunchyroll, and Crunchyroll has a free tier\./)
  assert.match(answerLine({ ...r, status: 'NOT_YET_RELEASED', watchOn: [] }), /an upcoming TV series.*due Fall 2023\. No official stream/)
})

test('the quick strip holds only real numbers and the pills say airing', () => {
  const stats = quickStats({ score: 91, watching: 1200, completed: 0, favourites: 50, watchOn: [] })
  assert.deepEqual(stats.map((s) => s.label), ['AniList score', 'Watching now', 'Favourites'])
  assert.equal(stats[0].value, '9.1')
  assert.equal(pills({ status: 'RELEASING', watchOn: [{ site: 'X' }] })[0].live, true)
})

test('the cast languages are only those a voice in the table speaks, Japanese first', () => {
  const voice = (language) => ({ name: 'V', href: '/voice-actor/v', language })
  assert.deepEqual(castLanguages({ cast: [{ voices: [voice('English')] }, { voices: [voice('Japanese')] }] }), ['Japanese', 'English'])
  assert.deepEqual(castLanguages({ cast: [{ voices: [voice('Japanese')] }, { voices: [] }] }), ['Japanese'])
  assert.deepEqual(castLanguages({ cast: [] }), [])
})

test('sub or dub: a dub only with an English voice, subtitled only with Japanese voices, nothing without voices', () => {
  const voice = (name, language) => ({ name, href: `/voice-actor/${name}`, language })
  const r = {
    title: 'Frieren',
    status: 'FINISHED',
    watchOn: [{ site: 'Crunchyroll' }],
    cast: [
      { name: 'Frieren', role: 'MAIN', voices: [voice('Atsumi Tanezaki', 'Japanese'), voice('Mallorie Rodak', 'English')] },
      { name: 'Fern', role: 'MAIN', voices: [voice('Kana Ichinose', 'Japanese')] },
    ],
  }
  const dub = dubOf(r)
  assert.equal(dub.dubbed, true)
  assert.equal(dub.voiced, 1)
  assert.match(dub.line, /^English dub: AniList lists English voices for 1 character\. It streams officially on Crunchyroll; whether a service carries the dub/)
  assert.ok(pills(r).some((p) => p.text === 'English dub' && p.dub))

  const sub = { ...r, cast: r.cast.map((c) => ({ ...c, voices: c.voices.filter((v) => v.language === 'Japanese') })) }
  assert.equal(dubOf(sub).line, 'Subtitled only: no English dub cast listed.')
  assert.equal(dubOf({ ...sub, status: 'NOT_YET_RELEASED' }).badge, 'No English dub yet')
  assert.equal(dubOf({ ...r, cast: [{ name: 'X', voices: [] }] }), null, 'no voices, no claim')

  const ask = (rec) => faqOf({ rows: [], key: [], songs: [], studios: [], ...rec }, 0).find((f) => /dubbed in English/.test(f.q))
  assert.match(ask(r).a, /^Yes\. Frieren has an English dub: AniList lists English voices for 1 character, with Mallorie Rodak as Frieren\. It streams officially on Crunchyroll/)
  assert.match(ask(sub).a, /^No English dub is listed for Frieren\./)
  assert.equal(ask({ ...sub, status: 'NOT_YET_RELEASED' }), undefined, 'not asked before it airs')
})

test('a voice actor sheet lifts bio facts and counts roles, and the bio loses those lines', () => {
  const p = {
    gender: 'Male',
    favourites: 10610,
    bio: '__Height:__ 174 cm\n\nA voice actor from Tokyo.',
    roles: [
      { href: '/anime/b', title: 'B', year: 2020, role: 'MAIN', character: { name: 'Bee' } },
      { href: '/anime/a', title: 'A', year: 1999, role: 'SUPPORTING', character: { name: 'Ay' } },
    ],
  }
  const { rows, bio } = voiceFacts(p)
  const labels = rows.map(([label]) => label)
  assert.ok(labels.includes('Height'))
  assert.deepEqual(rows.find(([label]) => label === 'Newest role'), ['Newest role', 'Bee, B (2020)'])
  assert.deepEqual(rows.find(([label]) => label === 'Earliest role here'), ['Earliest role here', 'Ay, A (1999)'])
  assert.doesNotMatch(bio, /Height/)
})

test('a like intro never repeats a genre or a word as a tag', () => {
  const r = { title: 'Durarara!!', format: 'TV', startYear: 2010, studios: [{ name: 'Studio' }], genres: ['Action', 'Mystery'], tags: ['Urban Fantasy', 'Gangs', 'Urban', 'Action', 'Ensemble Cast'] }
  const intro = likeIntro(r, [{ why: 'rec' }])
  assert.match(intro, /urban fantasy, gangs and ensemble cast at its core/)
})
