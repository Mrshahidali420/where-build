// The home page's "Popular characters right now": which pages it links, in
// which order, and what each row says (src/lib/boost-core.mjs).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  RULES,
  pageOf,
  pickTargets,
  closeness,
  homeScore,
  rankHomeTargets,
  smallImage,
  storyLabel,
  homeItemFor,
  HOME_MAX,
} from '../src/lib/boost-core.mjs'

const page = (path, impr, pos, clicks = 0) => ({ path, impr, pos, clicks })

test('closeness is 1 at the top of the target range and falls to 1/13 at the bottom', () => {
  assert.equal(closeness(8), 1)
  assert.equal(closeness(20), 1 / 13)
  assert.equal(closeness(14.5), 6.5 / 13)
  // Outside the range it stays between 0 and 1.
  assert.equal(closeness(3), 1)
  assert.equal(closeness(40), 0)
})

test('the score is impressions times closeness, the one the September report used', () => {
  assert.equal(homeScore(page('/character/a', 1300, 8)), 1300)
  assert.ok(Math.abs(homeScore(page('/character/a', 1300, 20)) - 100) < 1e-9)
  // Anos Voldigoad: 2,390 impressions at 10.56, about 1,919 in the report.
  assert.equal(Math.round(homeScore(page('/character/anos-voldigoad', 2390, 10.56))), 1919)
})

test('ranking: big pages first, and of two alike the one nearer page one', () => {
  const ranked = rankHomeTargets([
    page('/character/far', 1000, 19.5),
    page('/character/near', 300, 8.2),
    page('/character/big', 900, 10),
    page('/character/twin-b', 300, 8.2),
  ])
  assert.deepEqual(
    ranked.map((t) => t.path),
    ['/character/big', '/character/near', '/character/twin-b', '/character/far']
  )
  assert.ok(ranked.every((t) => typeof t.score === 'number'))
})

test('a target that got a "Readers also look for" link gives its place away', () => {
  const ranked = rankHomeTargets(
    [page('/character/roswaal-mathers', 445, 10.3), page('/character/anos-voldigoad', 2390, 10.56)],
    new Set(['/character/anos-voldigoad'])
  )
  assert.deepEqual(ranked.map((t) => t.path), ['/character/roswaal-mathers'])
})

test('the home block takes only the page of one character', () => {
  const ranked = rankHomeTargets([
    page('/anime/alya-sometimes-hides-her-feelings-in-russian/characters', 2000, 10),
    page('/manhwa/solo-leveling', 1500, 10),
    page('/character/shiggy/buy', 1200, 10),
    page('/character/anos-voldigoad', 900, 10),
  ])
  assert.deepEqual(ranked.map((t) => t.path), ['/character/anos-voldigoad'])
})

test('only striking-distance pages of a linkable type reach the ranking', () => {
  const pages = new Map(
    [
      page('/character/in-range', 100, 12),
      page('/character/too-high', 900, 4),
      page('/character/too-low', 900, 25),
      page('/character/too-small', 10, 12),
      page('/schedule', 500, 12),
    ].map((p) => [p.path, p])
  )
  assert.deepEqual(pickTargets(pages).map((p) => p.path), ['/character/in-range'])
  assert.equal(RULES.targetMinImpr, 15)
})

test('faces use AniList\'s smaller copy, and its placeholder is no face', () => {
  assert.equal(
    smallImage('https://s4.anilist.co/file/anilistcdn/character/large/b138595-Z6j0gP9s7avX.png'),
    'https://s4.anilist.co/file/anilistcdn/character/medium/b138595-Z6j0gP9s7avX.png'
  )
  assert.equal(
    smallImage('https://s4.anilist.co/file/anilistcdn/media/manga/cover/large/bx105398-b673Vt5ZSuz3.jpg'),
    'https://s4.anilist.co/file/anilistcdn/media/manga/cover/medium/bx105398-b673Vt5ZSuz3.jpg'
  )
  assert.equal(smallImage('https://s4.anilist.co/file/anilistcdn/character/large/default.jpg'), '')
  assert.equal(smallImage(''), '')
  assert.equal(smallImage(undefined), '')
})

test('story labels: the full name when it fits, the part before the subtitle, never a cut word', () => {
  assert.equal(storyLabel('Cyberpunk: Edgerunners'), 'Cyberpunk: Edgerunners')
  assert.equal(
    storyLabel("The Misfit of Demon King Academy: History's Strongest Demon King Reincarnates and Goes to School with His Descendants"),
    'The Misfit of Demon King Academy'
  )
  const long = storyLabel('I Was Reincarnated as the 7th Prince so I Can Take My Time Perfecting My Magical Ability')
  assert.ok(long.endsWith('…'))
  assert.ok(long.length <= 42)
  assert.ok('I Was Reincarnated as the 7th Prince so I Can'.startsWith(long.slice(0, -1)))
  assert.equal(storyLabel('BANANA FISH'), 'Banana Fish')
})

test('a character row: the name, and the story its top query names', () => {
  const item = homeItemFor({
    path: '/character/frederica-baumann',
    page: pageOf('/character/frederica-baumann'),
    name: 'Frederica Baumann',
    names: ['Frederica Baumann'],
    seriesTitles: ['Re:ZERO -Starting Life in Another World- Season 2', 'Re:ZERO -Starting Life in Another World-'],
    query: 'frederica re zero',
    image: 'https://s4.anilist.co/file/anilistcdn/character/large/b1-x.png',
  })
  assert.deepEqual(item, {
    path: '/character/frederica-baumann',
    name: 'Frederica Baumann',
    story: 'Re:ZERO',
    image: 'https://s4.anilist.co/file/anilistcdn/character/medium/b1-x.png',
  })
})

test('a character row falls back to the story they are best known from, and drops a missing face', () => {
  const item = homeItemFor({
    path: '/character/anos-voldigoad',
    page: pageOf('/character/anos-voldigoad'),
    name: 'Anos Voldigoad',
    seriesTitles: ['The Misfit of Demon King Academy: History\'s Strongest Demon King', 'Maou Gakuin no Futekigousha (manga)'],
    query: 'anos voldigoad',
    image: '',
  })
  assert.deepEqual(item, {
    path: '/character/anos-voldigoad',
    name: 'Anos Voldigoad',
    story: 'The Misfit of Demon King Academy',
  })
  assert.equal(
    homeItemFor({ path: '/character/shiggy/buy', page: pageOf('/character/shiggy/buy'), name: 'Shiggy', seriesTitles: ['Slime'] }).name,
    'Shiggy merch'
  )
})

test('a title row: its link text, with the section word as the small text', () => {
  const characters = homeItemFor({
    path: '/anime/banana-fish/characters',
    page: pageOf('/anime/banana-fish/characters'),
    name: 'BANANA FISH',
    query: 'banana fish characters',
    word: 'anime',
    verb: 'watch',
  })
  assert.equal(characters.name, 'Banana Fish characters')
  assert.equal(characters.story, 'Anime')
  const own = homeItemFor({ path: '/manhwa/solo-leveling', page: pageOf('/manhwa/solo-leveling'), name: 'Solo Leveling', word: 'manhwa' })
  assert.equal(own.name, 'Solo Leveling')
  assert.equal(own.story, 'Manhwa')
})

test('the block holds twenty links', () => {
  assert.equal(HOME_MAX, 20)
})
