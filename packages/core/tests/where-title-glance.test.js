// The "at a glance" paragraph of a Where title page: every sentence needs its
// own field, nothing blocked is printed, and pages built from different
// records do not come out as near twins.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { glanceFacts, glanceOf, cleanGenres, GLANCE_MAX } from '../src/where/title-glance.mjs'
import { faqOf } from '../src/where/faq.mjs'
import { titleText } from '../src/where/page-text.mjs'
import { nearDupRate, seeded, topSentences } from '../scripts/measure-core.mjs'

const NOW = 1_760_000_000
const person = (name) => ({ name, href: `/staff/${name.toLowerCase().replace(/\s+/g, '-')}` })
const voice = (name, language) => ({ name, language })

const bare = () => ({ id: 1, title: 'Moon Garden', romaji: 'Moon Garden', format: 'TV', status: 'FINISHED', rows: [], cast: [], songs: [], key: [], related: [], recs: [], watchOn: [] })
const full = () => ({
  ...bare(),
  romaji: 'Tsuki no Niwa',
  native: '月の庭',
  synonyms: ['MG', 'Tsuki no Niwa', 'Garden of the Moon'],
  source: 'MANGA',
  episodes: 24,
  startDate: [2019, 10, 5],
  startYear: 2019,
  endYear: 2020,
  score: 82,
  completed: 5000,
  genres: ['Drama', 'Ecchi', 'Fantasy'],
  chart: { rank: 40, words: 'most popular' },
  studios: [{ name: 'Studio Kite' }],
  key: [
    { label: 'Original creator', people: [person('Aki Mori')] },
    { label: 'Director', people: [person('Kei Ono')] },
    { label: 'Series writer', people: [person('Rin Abe')] },
    { label: 'Music', people: [person('Yu Sato')] },
  ],
  cast: [{ name: 'Aki', role: 'MAIN', voices: [voice('Mai Kato', 'Japanese'), voice('Sam Lee', 'English')] }],
  dubs: [{ language: 'French' }, { language: 'German' }],
  songs: [{ type: 'OP', title: 'Run', artists: [{ name: 'Band A' }] }, { type: 'ED', title: 'Home', artists: [] }],
  watch: { name: 'Moon Garden', position: 1, total: 3, prev: null, next: { title: 'Moon Garden: Second Bloom' } },
  related: [{ relation: 'Sequel', title: 'Moon Garden: Second Bloom', year: 2021 }],
  recs: [{ title: 'Other Show' }, { title: 'Third Show' }, { title: 'Fourth Show' }],
  watchOn: [{ site: 'Crunchyroll' }, { site: 'Netflix' }],
  nextEpisode: null,
})

const keys = (r) => glanceFacts(r, NOW).map((f) => f.key)
const all = (r) => glanceFacts(r, NOW).map((f) => f.text).join(' ')

test('a record with nothing but a name says nothing', () => {
  assert.deepEqual(glanceFacts(bare(), NOW), [])
  assert.deepEqual(glanceOf(bare(), { now: NOW }), [])
})

test('each sentence needs its own field', () => {
  const fields = {
    order: 'watch', sequel: 'related', chart: 'chart', song: 'songs', dubs: 'dubs', voice: 'cast',
    source: 'source', recs: 'recs', aka: 'synonyms', stream: 'watchOn', genres: 'genres',
  }
  assert.ok(Object.keys(fields).every((key) => keys(full()).includes(key)))
  for (const [key, field] of Object.entries(fields)) {
    const without = { ...full(), [field]: Array.isArray(full()[field]) ? [] : null }
    assert.ok(!keys(without).includes(key), `${key} without ${field}`)
  }
  assert.ok(!keys({ ...full(), key: [] }).includes('crew'))
  assert.ok(!keys({ ...full(), key: [], studios: [] }).includes('makers'))
  assert.ok(!keys({ ...full(), endYear: 2019 }).includes('run'), 'a run inside one year is not a run')
  assert.ok(!keys({ ...full(), score: 0, completed: 0 }).includes('score'))
  assert.ok(!keys({ ...full(), episodes: 1 }).includes('episodes'))
  assert.ok(!keys({ ...full(), native: '', romaji: 'Moon Garden' }).includes('native'))
})

test('the sentences say what the record holds, word for word', () => {
  const text = all(full())
  assert.match(text, /It is entry 1 of 3 in the Moon Garden watch order; Moon Garden: Second Bloom comes next\./)
  assert.match(text, /The story continues in Moon Garden: Second Bloom \(2021\)\./)
  assert.match(text, /It sits at #40 on AniList's most popular chart of all time\./)
  assert.match(text, /It has 2 theme songs; the first opening is “Run” by Band A\./)
  assert.match(text, /Voice casts are also listed in French and German\./)
  assert.match(text, /Mai Kato voices Aki in Japanese, and Sam Lee in the English dub\./)
  assert.match(all({ ...full(), romaji: 'つきのにわ' }), /Its original title is 月の庭\./)
  assert.match(text, /Rin Abe wrote the script and Yu Sato wrote the music\./)
  assert.match(text, /It was adapted from the manga by Aki Mori\./)
  assert.match(text, /Kei Ono directed it at Studio Kite\./)
  assert.match(text, /AniList members who liked it most often recommend Other Show and Third Show\./)
  assert.match(text, /It ran from 5 Oct 2019 to 2020\./)
  assert.match(text, /It is also known as MG and Garden of the Moon\./)
  assert.match(text, /AniList members score it 82 out of 100, and 5,000 have finished it\./)
  assert.match(text, /Its original title is 月の庭 \(Tsuki no Niwa\)\./)
})

test('a fact is worded by what the record has, never guessed', () => {
  assert.match(all({ ...full(), source: 'ORIGINAL' }), /It is an original story/)
  assert.match(all({ ...full(), key: [] }), /It was adapted from a manga\./)
  assert.ok(!keys({ ...full(), source: 'OTHER' }).includes('source'))
  assert.match(all({ ...full(), cast: [{ name: 'Aki', role: 'MAIN', voices: [voice('Mai Kato', 'Japanese')] }] }), /Mai Kato voices Aki in Japanese\./)
  assert.match(all({ ...full(), related: [{ relation: 'Prequel', title: 'Before', year: 2015 }] }), /It follows Before \(2015\)\./)
  assert.match(all({ ...full(), related: [{ relation: 'Main story', title: 'Parent' }] }), /It is a side entry to Parent\./)
  assert.match(all({ ...full(), songs: [{ type: 'ED', title: 'Home' }] }), /1 theme song on record, all of them endings/)
  assert.match(all({ ...full(), nextEpisode: { number: 5, at: NOW + 86400 } }), /^Episode 5 airs on /)
  assert.ok(!keys({ ...full(), nextEpisode: { number: 5, at: NOW - 60 } }).includes('next'), 'an episode already aired is not next')
  assert.ok(!keys({ ...full(), format: 'MUSIC' }).includes('aka'))
})

test('a blocked genre never reaches the text', () => {
  assert.deepEqual(cleanGenres(full()), ['Drama', 'Fantasy'])
  assert.doesNotMatch(all(full()), /Ecchi/)
  assert.ok(!keys({ ...full(), genres: ['Ecchi', 'Hentai'] }).includes('genres'))
})

test('the paragraph never names the show, and never repeats a question the page shows', () => {
  const r = full()
  const faq = faqOf(r, NOW)
  const glance = glanceOf(r, { now: NOW, answered: faq.map((f) => f.key) })
  assert.ok(glance.length > 0 && glance.length <= GLANCE_MAX)
  const said = new Set(faq.map((f) => f.key))
  for (const fact of glanceFacts(r, NOW)) if (fact.faq && said.has(fact.faq)) assert.ok(!glance.includes(fact.text), fact.key)
  // "Moon Garden" appears only inside other names (the watch order, the sequel), never as the subject.
  for (const sentence of glance) assert.doesNotMatch(sentence, /^Moon Garden\b/)
  assert.deepEqual(glanceOf(r, { now: NOW, answered: faq.map((f) => f.key) }), glance, 'the same record gives the same words')
})

// ------------------------------------------------------- near-twin guard

const FORMATS = ['TV', 'TV', 'MOVIE', 'OVA', 'ONA', 'SPECIAL', 'TV_SHORT']
const SOURCES = ['MANGA', 'ORIGINAL', 'LIGHT_NOVEL', 'VIDEO_GAME', 'OTHER', '']

/** A title record with a seeded mix of fields, the way the catalog's records differ. */
function fixture(i, rand) {
  const has = (share) => rand() < share
  const pick = (list) => list[Math.floor(rand() * list.length)]
  const format = pick(FORMATS)
  const episodes = format === 'MOVIE' ? 1 : 1 + Math.floor(rand() * 26)
  const startYear = 1990 + Math.floor(rand() * 35)
  const voices = has(0.4) ? [voice(`Seiyuu ${i}`, 'Japanese'), voice(`Actor ${i}`, 'English')] : [voice(`Seiyuu ${i}`, 'Japanese')]
  return {
    ...bare(),
    id: i,
    title: `Show ${i}`,
    romaji: has(0.5) ? `Romaji ${i}` : `Show ${i}`,
    native: has(0.8) ? `原題${i}` : '',
    synonyms: has(0.5) ? [`Alias ${i}`] : [],
    format,
    status: has(0.95) ? 'FINISHED' : 'RELEASING',
    source: pick(SOURCES),
    episodes,
    startDate: [startYear, 4, 1],
    startYear,
    endYear: startYear + (has(0.2) ? 1 : 0),
    season: has(0.6) ? 'SPRING' : '',
    seasonYear: startYear,
    popularity: Math.floor(rand() * rand() * 120000),
    score: has(0.7) ? 50 + Math.floor(rand() * 40) : 0,
    completed: has(0.8) ? Math.floor(rand() * 90000) : 0,
    genres: has(0.8) ? [pick(['Action', 'Comedy', 'Drama']), ...(has(0.5) ? ['Fantasy'] : [])] : [],
    chart: has(0.08) ? { rank: 1 + Math.floor(rand() * 500), words: 'most popular' } : null,
    studios: has(0.6) ? [{ name: `Studio ${i % 40}` }] : [],
    key: [
      has(0.6) && { label: 'Director', people: [person(`Director ${i}`)] },
      has(0.45) && { label: 'Original creator', people: [person(`Creator ${i}`)] },
      has(0.45) && { label: 'Music', people: [person(`Composer ${i}`)] },
      has(0.4) && { label: 'Series writer', people: [person(`Writer ${i}`)] },
    ].filter(Boolean),
    cast: has(0.6) ? [{ name: `Hero ${i}`, role: 'MAIN', voices }] : [],
    dubs: has(0.15) ? [{ language: 'German' }, ...(has(0.5) ? [{ language: 'Italian' }] : [])] : [],
    songs: has(0.5) ? [{ type: has(0.6) ? 'OP' : 'ED', title: `Song ${i}`, artists: has(0.8) ? [{ name: `Band ${i}` }] : [] }] : [],
    watch: has(0.3) ? { name: `Saga ${i}`, position: 2, total: 4, prev: { title: `Before ${i}` }, next: has(0.5) ? { title: `After ${i}` } : null } : null,
    related: has(0.35) ? [{ relation: pick(['Sequel', 'Prequel', 'Main story', 'Side story']), title: `Related ${i}`, year: startYear + 1 }] : [],
    recs: has(0.6) ? [{ title: `Rec ${i}` }] : [],
    watchOn: has(0.4) ? [{ site: pick(['Crunchyroll', 'Netflix', 'HIDIVE']), url: 'https://example.com' }] : [],
    description: 'word '.repeat(60),
  }
}

test('title pages built from different records are not near twins', () => {
  const rand = seeded(20261011)
  const pages = Array.from({ length: 400 }, (_, i) => titleText(fixture(i + 1, rand), { siteName: 'Some Site', now: NOW }))
  const rate = nearDupRate(pages.map((p) => ({ text: p.site, names: p.names })))
  assert.ok(rate < 0.6, `near-twin rate ${rate}`)
  // Short row labels aside, no full sentence of the box or the paragraph is on most pages.
  const repeated = topSentences(pages.map((p) => p.site)).filter((s) => s.sentence.split(/\s+/).length > 4 && !/helps keep Some Site free/.test(s.sentence))
  assert.ok(repeated[0].share < 0.45, `"${repeated[0].sentence}" is on ${repeated[0].share} of pages`)
})
