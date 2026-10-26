// The characters page: the facts walk's pure parts (scripts/sister-characters.mjs),
// the gate (src/where/gates.mjs, compute.mjs), the join into the title record
// (src/where/record-title.mjs, characters.mjs) and the words the page prints.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { cleanBio, parseHeight, shapeFacts, selectToFetch, mergeFacts, ownedCharacterIds } from '../scripts/sister-characters.mjs'
import {
  birthdayWord,
  castIdsOfTitle,
  charactersOf,
  charactersSummary,
  charactersDescription,
  hasFacts,
} from '../src/where/characters.mjs'
import { computeWhere, gateTitles } from '../src/where/compute.mjs'
import { gateOf, passesCharacters, WHERE_GATE_DEFAULTS } from '../src/where/gates.mjs'
import { titleRecord } from '../src/where/record-title.mjs'
import { charactersJsonld } from '../src/where/jsonld.mjs'
import { pageUrlsOf } from '../src/where/outputs.mjs'

const site = { ownedKinds: [{ kind: 'anime', notFrom: ['CN', 'TW'] }], gates: [] }
const anime = (id, extra = {}) => ({ id, kind: 'anime', country: 'JP', cover: 'c.jpg', title: `Show ${id}`, slug: `show-${id}`, episodes: 12, ...extra })
const castRow = (id, role = 'SUPPORTING') => ({ id, role, voiceActors: [{ id: 900, language: 'Japanese' }] })
const fact = (extra = {}) => ({ g: 'Female', a: '17', on: '2026-10-01', ...extra })

// ---- bio cleaning -------------------------------------------------------

test('cleanBio drops spoilers, fact lines, markdown, links and HTML', () => {
  const raw = [
    '__Height:__ 160 cm',
    '__Age:__ 17',
    '**Affiliation:** Example Guild',
    '',
    'A quiet [archer](https://example.org/x) from the __northern__ hills.<br>She ~!secretly leads the rebels!~ trains every day.',
  ].join('\n')
  assert.equal(cleanBio(raw), 'A quiet archer from the northern hills. She trains every day.')
})

test('cleanBio keeps a paragraph that only starts with a bold name', () => {
  assert.equal(cleanBio('__Mira__ is the captain of the ship.'), 'Mira is the captain of the ship.')
})

test('cleanBio cuts at a sentence end, never mid-sentence, and gives "" when it cannot', () => {
  const sentence = 'This sentence is exactly fifty characters long ok. '
  const long = sentence.repeat(10)
  const cut = cleanBio(long)
  assert.ok(cut.length <= 280, `length ${cut.length}`)
  assert.ok(cut.endsWith('.'))
  assert.equal(cut, sentence.repeat(5).trim())
  assert.equal(cleanBio('word '.repeat(100)), '')
  assert.equal(cleanBio(''), '')
  assert.equal(cleanBio(null), '')
  assert.equal(cleanBio('~!All of it is a spoiler.!~'), '')
})

// ---- height ------------------------------------------------------------

test('parseHeight reads the __Height:__ line in centimetres', () => {
  assert.equal(parseHeight('__Height:__ 178 cm\nSome text.'), '178 cm')
  assert.equal(parseHeight('__Height__: 165cm (5\'5")'), '165 cm')
  assert.equal(parseHeight('**Height:** 152.5 cm'), '152.5 cm')
  assert.equal(parseHeight('__Age:__ 17<br>__Height:__ 170 cm'), '170 cm')
  assert.equal(parseHeight('__Height:__ 5\'10"'), '5\'10"')
  assert.equal(parseHeight('__Height:__ tall'), '')
  assert.equal(parseHeight('She is 170 cm tall.'), '')
  assert.equal(parseHeight('~!__Height:__ 210 cm!~'), '')
  assert.equal(parseHeight(null), '')
})

// ---- birthday ------------------------------------------------------------

test('birthdayWord formats month-day as "July 26"', () => {
  assert.equal(birthdayWord('7-26'), 'July 26')
  assert.equal(birthdayWord('1-1'), 'January 1')
  assert.equal(birthdayWord('12-31'), 'December 31')
  assert.equal(birthdayWord('13-1'), '')
  assert.equal(birthdayWord('7'), '')
  assert.equal(birthdayWord(undefined), '')
})

// ---- shaping and selecting ----------------------------------------------

test('shapeFacts keeps only the facts that exist, compactly', () => {
  const row = shapeFacts(
    { id: 5, gender: 'Male', age: '16-17', bloodType: 'A', dateOfBirth: { month: 7, day: 26 }, favourites: 1200, description: '__Height:__ 178 cm\nA swordsman.' },
    '2026-10-26',
  )
  assert.deepEqual(row, { g: 'Male', a: '16-17', b: 'A', d: '7-26', f: 1200, h: '178 cm', bio: 'A swordsman.', on: '2026-10-26' })
  assert.deepEqual(shapeFacts({ id: 6, dateOfBirth: { month: 7, day: null }, favourites: 0, description: null }, '2026-10-26'), { on: '2026-10-26' })
})

test('fresh ids are never refetched; missing come first, then stale oldest first', () => {
  const existing = {
    1: fact({ on: '2026-10-20' }), // fresh
    2: fact({ on: '2026-05-01' }), // stale
    3: fact({ on: '2026-01-01' }), // staler
    4: { on: '2026-07-28' }, // exactly 90 days: still fresh
  }
  const pick = selectToFetch([1, 2, 3, 4, 5], existing, '2026-10-26')
  assert.deepEqual(pick.missing, [5])
  assert.deepEqual(pick.stale, [3, 2])
  assert.deepEqual(pick.ids, [5, 3, 2])
  assert.equal(pick.ids.includes(1), false)
  assert.equal(pick.ids.includes(4), false)
})

test('mergeFacts applies new rows and marks asked-but-unreturned ids as checked', () => {
  const existing = { 1: fact({ on: '2026-01-01' }), 9: fact() }
  const merged = mergeFacts(existing, new Map([[2, fact({ on: '2026-10-26' })]]), [1, 2], '2026-10-26')
  assert.equal(merged[2].on, '2026-10-26')
  assert.deepEqual(merged[1], { ...existing[1], on: '2026-10-26' })
  assert.deepEqual(merged[9], existing[9])
  assert.equal(existing[1].on, '2026-01-01', 'the old map is not changed')
})

test('ownedCharacterIds: cast ids of owned titles only, credits rows first, else the catalog list', () => {
  const titles = [
    anime(1, { characters: [{ id: 50 }] }),
    anime(2, { characters: [{ slug: 'some-name-60' }] }),
    anime(3, { country: 'CN', characters: [{ id: 70 }] }),
  ]
  const credits = { 1: { characters: [castRow(11), castRow(10)] } }
  assert.deepEqual(ownedCharacterIds(site, titles, credits), [10, 11, 60])
  assert.deepEqual(castIdsOfTitle(titles[0], credits[1]), [11, 10])
})

// ---- the gate ------------------------------------------------------------

const sixFacts = Object.fromEntries([1, 2, 3, 4, 5, 6].map((id) => [id, fact()]))
const gateData = (characters) => ({
  anime: [anime(1), anime(2)],
  credits: {
    1: { characters: [castRow(1, 'MAIN'), castRow(2), castRow(3), castRow(4), castRow(5), castRow(6)] },
    2: { characters: [castRow(1, 'MAIN'), castRow(2), castRow(3), castRow(4), castRow(5), castRow(7)] },
  },
  staff: { 900: { name: 'Voice Person' } },
  cast: Object.fromEntries([1, 2, 3, 4, 5, 6, 7].map((id) => [id, [`Character ${id}`, `img${id}.jpg`, false]])),
  airing: { schedule: [], history: {} },
  themes: {},
  characters,
})

test('the characters gate: 6 cast rows with facts by default, the site may change it', () => {
  assert.equal(WHERE_GATE_DEFAULTS.characters.min, 6)
  assert.equal(passesCharacters(6, { min: 6 }), true)
  assert.equal(passesCharacters(5, { min: 6 }), false)
  assert.equal(gateOf({ gates: [{ count: 'where', type: 'characters', min: 3 }] }, 'characters').min, 3)
  assert.equal(hasFacts({ on: '2026-10-01' }), false)
  assert.equal(hasFacts({ f: 10, on: '2026-10-01' }), false)
  assert.equal(hasFacts({ bio: 'x', on: '2026-10-01' }), true)

  const titles = gateTitles(site, gateData(sixFacts))
  assert.deepEqual(
    titles.map((t) => [t.item.id, t.charactersPage]),
    [
      [1, true],
      [2, false], // character 7 has no facts: 5 of 6
    ],
  )
  assert.equal(computeWhere(site, gateData(sixFacts)).counts.characters, 1)
})

test('a missing characters.json gives zero characters pages and leaves the title record as it was', () => {
  const data = gateData(undefined)
  const where = computeWhere(site, data)
  assert.equal(where.counts.characters, 0)
  assert.equal(where.titles.every((t) => !t.charactersPage), true)
  const record = titleRecord(where.titles[0], recordCtx(data))
  assert.equal('charactersPage' in record, false)
  assert.equal('characters' in record, false)
  assert.equal(record.cast.length, 6)
  const urls = pageUrlsOf({ titles: [record], people: [], studios: [], artists: [], watch: [], hubs: { groups: {}, years: {} } })
  assert.deepEqual(urls.groups.find((g) => g.name === 'characters').urls, [])
})

// ---- the record join -----------------------------------------------------

function recordCtx(data) {
  const voice = (id) => (id === 900 ? '/voice-actor/voice-person' : null)
  return {
    link: { title: (id) => `/anime/show-${id}`, voice, crew: voice, cast: voice, staff: () => null, studio: () => null, artist: () => null },
    credits: data.credits,
    staff: data.staff,
    cast: data.cast,
    characters: data.characters,
    themes: {},
    titleById: new Map(data.anime.map((item) => [item.id, item])),
    franchiseOf: new Map(),
    similar: new Map(),
    similarUsed: new Map(),
    likes: new Map(),
    cross: { base: 'https://home.example', home: { t: {}, c: {} }, cast: data.cast, comicsById: new Map() },
  }
}

test('the title record joins cast rows with their facts, main first, then by favourites', () => {
  const facts = { ...sixFacts, 3: fact({ f: 50, d: '7-26', h: '160 cm', bio: 'A quiet archer.' }), 5: fact({ f: 900 }), 2: { on: '2026-10-01' } }
  // Five of the six rows have facts: this site's own gate lets five through.
  const fiveSite = { ...site, gates: [{ page: '/anime/<slug>/characters', count: 'where', type: 'characters', min: 5 }] }
  const data = gateData(facts)
  const where = computeWhere(fiveSite, data)
  const record = titleRecord(where.titles[0], recordCtx(data))
  assert.equal(record.charactersPage, true)
  assert.deepEqual(
    record.characters.map((c) => c.name),
    ['Character 1', 'Character 5', 'Character 3', 'Character 2', 'Character 4', 'Character 6'],
  )
  const archer = record.characters.find((c) => c.name === 'Character 3')
  assert.deepEqual(archer, {
    name: 'Character 3',
    image: 'img3.jpg',
    role: 'SUPPORTING',
    voices: [{ name: 'Voice Person', href: '/voice-actor/voice-person', language: 'Japanese' }],
    gender: 'Female',
    age: '17',
    birthday: 'July 26',
    height: '160 cm',
    favourites: 50,
    bio: 'A quiet archer.',
  })
  // A row with no facts prints no empty labels.
  const bare = record.characters.find((c) => c.name === 'Character 2')
  assert.deepEqual(Object.keys(bare).sort(), ['image', 'name', 'role', 'voices'])
  // The title page's cast table is unchanged by the join.
  assert.equal(record.cast.some((c) => 'id' in c || 'age' in c), false)

  const ld = charactersJsonld(record, 'https://site.example')
  assert.equal(ld['@type'], 'ItemList')
  assert.equal(ld.itemListElement.length, 6)
  assert.deepEqual(ld.itemListElement[0], { '@type': 'ListItem', position: 1, name: 'Character 1', image: 'img1.jpg' })

  const urls = pageUrlsOf({ titles: [record], people: [], studios: [], artists: [], watch: [], hubs: { groups: {}, years: {} } })
  assert.deepEqual(urls.groups.find((g) => g.name === 'characters').urls, [{ path: '/anime/show-1/characters' }])
})

// ---- the words the page prints ------------------------------------------

test('summary and description say only what the cards hold', () => {
  const cards = charactersOf(
    [
      { id: 1, name: 'A', role: 'MAIN', voices: [{ name: 'V', language: 'Japanese' }] },
      { id: 2, name: 'B', role: 'SUPPORTING', voices: [{ name: 'W', language: 'English' }] },
      { id: 3, name: 'C', role: 'SUPPORTING', voices: [] },
    ],
    { 1: fact({ d: '1-2' }), 2: fact() },
  )
  assert.equal(charactersSummary(cards), '3 characters: 1 main, 2 supporting.')
  assert.equal(charactersDescription('Example Show', cards), 'All 3 characters of Example Show: ages, birthdays and the Japanese and English voice cast.')
  const plain = charactersOf([{ id: 9, name: 'Z', role: 'MAIN', voices: [] }], {})
  assert.equal(charactersDescription('Example Show', plain), 'All 1 character of Example Show.')
})
