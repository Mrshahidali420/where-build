// "Readers also look for": which pairs qualify, what the link says, and the
// per-page limits (src/lib/boost-core.mjs).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  RULES,
  pageOf,
  pagesFromGsc,
  topQueries,
  pickTargets,
  pickSources,
  isCrossover,
  relatedToCharacter,
  relatedToTitle,
  leftoverWords,
  queryMismatch,
  shortTitle,
  anchorFor,
  choosePairs,
  linksTo,
} from '../src/lib/boost-core.mjs'

const url = (path) => `https://example.com${path}`
const row = (keys, clicks, impressions, position) => ({ keys, clicks, impressions, position })

test('only character and title pages, and their answer pages, take part', () => {
  assert.equal(pageOf('/character/ram').type, 'character')
  assert.equal(pageOf('/character/shiggy/buy').base, '/character/shiggy')
  assert.equal(pageOf('/anime/banana-fish/characters').base, '/anime/banana-fish')
  assert.equal(pageOf('/manhwa/solo-leveling/').sub, '')
  assert.equal(pageOf('/schedule'), null)
  assert.equal(pageOf('/genre/action'), null)
  assert.equal(pageOf('/character/ram/unknown'), null)
  assert.equal(pageOf('/'), null)
})

test('Search Console rows become clean paths, merged by impressions', () => {
  const pages = pagesFromGsc([
    row([url('/character/ram')], 1, 10, 4),
    row([url('/character/ram/')], 0, 30, 8),
  ])
  const ram = pages.get('/character/ram')
  assert.equal(ram.impr, 40)
  assert.equal(ram.clicks, 1)
  assert.equal(ram.pos, 7)
})

test('the biggest query of a page is its top query', () => {
  const top = topQueries({
    rows: [
      row(['roswaal', url('/character/roswaal-mathers')], 0, 300, 10),
      row(['roswaal mathers', url('/character/roswaal-mathers')], 0, 145, 10),
    ],
  })
  assert.equal(top.get('/character/roswaal-mathers').query, 'roswaal')
})

test('targets sit at position 8 to 20 with impressions; sources near the top or with clicks', () => {
  const pages = pagesFromGsc([
    row([url('/character/roswaal-mathers')], 0, 445, 10.3),
    row([url('/character/too-few')], 0, 5, 10),
    row([url('/character/too-far')], 0, 500, 25),
    row([url('/character/ram')], 0, 27, 4.8),
    row([url('/character/anos-voldigoad')], 3, 2390, 10.6),
    row([url('/schedule')], 9, 90, 2),
  ])
  assert.deepEqual(pickTargets(pages).map((p) => p.path).sort(), ['/character/anos-voldigoad', '/character/roswaal-mathers'])
  assert.deepEqual(pickSources(pages).map((p) => p.path).sort(), ['/character/anos-voldigoad', '/character/ram'])
})

const reZero = {
  title: 'Re:ZERO -Starting Life in Another World-',
  relations: [
    { relation: 'ADAPTATION', id: 1, title: 'Re:ZERO', hit: { item: { slug: 're-zero', kind: 'novel' } } },
    { relation: 'SIDE_STORY', id: 2 },
  ],
  characters: [{ slug: 'ram', name: 'Ram' }, { slug: 'roswaal-mathers', name: 'Roswaal Mathers' }],
}
const quartet = {
  title: 'Isekai Quartet',
  relations: [
    { relation: 'CHARACTER', id: 10 },
    { relation: 'CHARACTER', id: 11 },
    { relation: 'CHARACTER', id: 12 },
    { relation: 'SEQUEL', id: 13 },
  ],
  characters: [{ slug: 'ram', name: 'Ram' }, { slug: 'sebas-tian', name: 'Sebas Tian' }],
}

test('a crossover is a title tied mostly to other stories by their characters', () => {
  assert.equal(isCrossover(quartet), true)
  assert.equal(isCrossover(reZero), false)
  const conan = {
    relations: [
      ...Array.from({ length: 9 }, (_, i) => ({ relation: 'CHARACTER', id: i })),
      ...Array.from({ length: 60 }, (_, i) => ({ relation: 'SIDE_STORY', id: 100 + i })),
    ],
  }
  assert.equal(isCrossover(conan), false)
})

test('two characters are related through a shared story, never through a crossover', () => {
  const titles = new Map([
    ['/anime/re-zero', reZero],
    ['/anime/isekai-quartet', quartet],
  ])
  const roswaal = {
    slug: 'roswaal-mathers',
    name: 'Roswaal Mathers',
    appearsIn: [{ kind: 'anime', slug: 're-zero', title: 'Re:ZERO' }],
  }
  const sebas = {
    slug: 'sebas-tian',
    name: 'Sebas Tian',
    appearsIn: [{ kind: 'anime', slug: 'isekai-quartet', title: 'Isekai Quartet' }],
  }
  const forRoswaal = relatedToCharacter(roswaal, titles)
  assert.ok(forRoswaal.has('/character/ram'))
  assert.ok(forRoswaal.has('/anime/re-zero'))
  assert.ok(!forRoswaal.has('/character/roswaal-mathers'))
  const forSebas = relatedToCharacter(sebas, titles)
  assert.ok(!forSebas.has('/character/ram'))
  assert.ok(!forSebas.has('/anime/isekai-quartet'))
})

test('a title is related to its own pages, its cast and the same story elsewhere, not to similar titles', () => {
  const related = relatedToTitle({ ...reZero, similar: [{ slug: 'summertime-rendering' }] }, '/anime/re-zero')
  assert.ok(related.has('/anime/re-zero'))
  assert.ok(related.has('/character/ram'))
  assert.ok(related.has('/novel/re-zero'))
  assert.equal([...related.keys()].some((k) => k.includes('summertime')), false)
})

test('a query that names another story is caught, a name typed apart is not', () => {
  const kiwi = ['Kiwi']
  assert.deepEqual(leftoverWords('how old is kiwi', kiwi), [])
  assert.equal(queryMismatch('cyberpunk edgerunners characters kiwi', kiwi, ['Made in Abyss']), true)
  assert.equal(queryMismatch('tear slime', ['Tear'], ['That Time I Got Reincarnated as a Slime']), false)
  assert.equal(queryMismatch('zhou gong jin', ['Gongjin Zhou'], ['Some Donghua']), false)
  assert.equal(queryMismatch('fuji kiseki star blossom', ['Fuji Kiseki'], ['Umamusume'], 'Her song Star Blossom'), false)
})

test('long story names are cut to what people type', () => {
  assert.equal(shortTitle('Re:ZERO -Starting Life in Another World-'), 'Re:ZERO')
  assert.equal(shortTitle('Magi: The Labyrinth of Magic'), 'Magi')
  assert.equal(shortTitle('That Time I Got Reincarnated as a Slime Season 2', 'tear slime'), 'Slime')
  assert.equal(
    shortTitle('The 100 Girlfriends Who Really, Really, Really, Really, REALLY Love You', 'the 100 girlfriends all characters'),
    'The 100 Girlfriends'
  )
  assert.equal(shortTitle('BANANA FISH'), 'Banana Fish')
  assert.equal(shortTitle('ONE PIECE'), 'One Piece')
  assert.equal(shortTitle('GANGSTA.'), 'Gangsta')
})

test('the anchor names the page, never the question', () => {
  const character = pageOf('/character/frederica-baumann')
  assert.equal(
    anchorFor({ page: character, name: 'Frederica Baumann', seriesTitles: ['Re:ZERO -Starting Life in Another World-'], query: 'frederica re zero' }),
    'Frederica Baumann (Re:ZERO)'
  )
  assert.equal(
    anchorFor({ page: pageOf('/character/roswaal-mathers'), name: 'Roswaal Mathers', seriesTitles: ['Re:ZERO'], query: 'roswaal' }),
    'Roswaal Mathers'
  )
  assert.equal(
    anchorFor({ page: pageOf('/character/naofumi-iwatani'), name: 'Naofumi Iwatani', seriesTitles: ['The Rising of the Shield Hero'], query: 'how old is naofumi iwatani' }),
    'Naofumi Iwatani'
  )
  assert.equal(anchorFor({ page: pageOf('/anime/banana-fish/characters'), name: 'BANANA FISH', query: 'banana fish characters' }), 'Banana Fish characters')
  assert.equal(anchorFor({ page: pageOf('/anime/gangsta/free'), name: 'GANGSTA.', verb: 'watch' }), 'Where to watch Gangsta')
})

const pair = (source, target, targetImpr, extra = {}) => ({
  source: { path: source, clicks: 0, pos: 3, ...extra.source },
  target: { path: target, impr: targetImpr, pos: 10, ...extra.target },
  anchor: target.split('/').pop(),
})

test('each source keeps three links at most, biggest targets first', () => {
  const { links } = choosePairs([
    pair('/character/ram', '/character/a', 10),
    pair('/character/ram', '/character/b', 445),
    pair('/character/ram', '/character/c', 199),
    pair('/character/ram', '/character/d', 126),
    pair('/character/ram', '/character/e', 50),
  ])
  assert.deepEqual(links['/character/ram'].map((l) => l.path), ['/character/b', '/character/c', '/character/d'])
  assert.equal(RULES.maxPerSource, 3)
})

test('each target gets three sources at most, most clicks first', () => {
  const { kept } = choosePairs([
    pair('/character/s1', '/character/t', 50, { source: { clicks: 0 } }),
    pair('/character/s2', '/character/t', 50, { source: { clicks: 5 } }),
    pair('/character/s3', '/character/t', 50, { source: { clicks: 2 } }),
    pair('/character/s4', '/character/t', 50, { source: { clicks: 1 } }),
  ])
  assert.deepEqual(kept.map((p) => p.source.path), ['/character/s2', '/character/s3', '/character/s4'])
})

test('on equal impressions the target nearer page one wins the last slot', () => {
  const { links } = choosePairs([
    pair('/character/suphia/buy', '/character/tear', 88),
    pair('/character/suphia/buy', '/character/vesta', 38),
    pair('/character/suphia/buy', '/character/hakurou', 20, { target: { pos: 9.1 } }),
    pair('/character/suphia/buy', '/character/kumara', 20, { target: { pos: 8.4 } }),
  ])
  assert.deepEqual(links['/character/suphia/buy'].map((l) => l.path), ['/character/tear', '/character/vesta', '/character/kumara'])
})

test('a page never links to itself, and a repeated pair counts once', () => {
  const { kept } = choosePairs([
    pair('/character/ram', '/character/ram', 100),
    pair('/character/ram', '/character/rem', 90),
    pair('/character/ram', '/character/rem', 90),
  ])
  assert.equal(kept.length, 1)
})

test('an existing link is found, but not one from the boost block itself', () => {
  const html =
    '<a href="/character/ram">Ram</a>' +
    '<section class="section" data-boost><a href="/character/roswaal-mathers">Roswaal</a></section>'
  assert.equal(linksTo(html, '/character/ram'), true)
  assert.equal(linksTo(html, '/character/roswaal-mathers'), false)
  assert.equal(linksTo('<a href="https://example.com/character/ram/">x</a>', '/character/ram', 'https://example.com'), true)
  assert.equal(linksTo('<a href="https://elsewhere.com/character/ram/">x</a>', '/character/ram', 'https://example.com'), false)
  assert.equal(linksTo('<a href="/character/ram-2">x</a>', '/character/ram'), false)
})
