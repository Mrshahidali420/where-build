// The hub questions (src/where/hub-faq.mjs) and /where-to-watch
// (src/where/platform-hub.mjs): every answer from the rows the page lists,
// a question without data left out, and no hub page from a thin list.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { formatSplit, hubFaq, topStudios } from '../src/where/hub-faq.mjs'
import { platformFaq, platformHub } from '../src/where/platform-hub.mjs'
import { hubPaths } from '../src/where/hubs.mjs'

// [title, href, cover, format, episodes, season, studio]
const row = (title, format, studio) => [title, `/anime/${title.toLowerCase()}`, '', format, 12, 'Fall 2024', studio]
const rows = [row('A', 'TV series', 'MAPPA'), row('B', 'Movie', 'Bones'), row('C', 'TV series', 'MAPPA'), row('D', 'TV series', 'Bones'), row('E', 'ONA', 'MAPPA')]

test('hub faq: the most watched, how many and in what formats, the busiest studio', () => {
  const faq = hubFaq({ subject: 'Fall 2024 anime', rows, site: 'Site' })
  assert.deepEqual(
    faq.map((f) => f.q),
    ['What is the most watched Fall 2024 anime?', 'How many Fall 2024 anime are there?', 'Which studio made the most Fall 2024 anime?'],
  )
  assert.equal(faq[0].a, 'A is the most watched, going by how many AniList members have it on their list. B and C come next.')
  assert.equal(faq[1].a, 'Site lists 5 shows. They are 3 TV series, 1 movie and 1 ONA.')
  assert.equal(faq[2].a, 'MAPPA, with 3 shows. Bones (2) comes next.')
  const tied = hubFaq({ subject: 'x anime', rows: [...rows, row('F', 'TV series', 'Bones')], site: 'Site' })
  assert.equal(tied[2].a, 'Bones and MAPPA, with 3 shows each.', 'a tie at the top is not a winner')
})

test('hub faq: a ranked slice says so, a fit list asks what to start with, and no data means no questions', () => {
  const genre = hubFaq({ subject: 'action anime', rows, total: 900, site: 'Site' })
  assert.match(genre[1].a, /^Site lists 900 shows, and this page ranks the 5 most watched\. Those ranked are/)
  assert.match(genre[2].a, /of the 5 most watched/)
  const mood = hubFaq({ subject: 'revenge anime', rows, order: 'fit', count: false, site: 'Site' })
  assert.deepEqual(
    mood.map((f) => f.q),
    ['Which revenge anime should I start with?', 'Which studio made the most revenge anime?'],
  )
  assert.equal(hubFaq({ subject: 'x', rows: [], site: 'Site' }).length, 0)
  assert.equal(formatSplit([row('A', 'TV series', ''), row('B', 'TV series', '')]), '', 'one format, nothing to split')
  assert.deepEqual(topStudios([row('A', 'TV series', 'Solo'), row('B', 'TV series', '')]), [], 'one show is not a pattern')
})

const title = (id, popularity, sites, status = 'FINISHED') => ({ id, slug: `t${id}`, title: `T${id}`, popularity, status, cover: '', format: 'TV', studios: [], watchOn: sites.map((site) => ({ site })) })
const cardRow = (t) => [t.title, `/anime/${t.slug}`]

test('where to watch: services with enough shows, most shows first, most watched rows first', () => {
  const titles = [
    title(1, 10, ['Crunchyroll', 'Netflix']),
    title(2, 90, ['Crunchyroll'], 'RELEASING'),
    title(3, 50, ['Crunchyroll', 'Netflix', 'Netflix']),
    title(4, 5, ['Tiny']),
    title(5, 1, []),
  ]
  const hub = platformHub(titles, cardRow, { min: 2, top: 2, services: 2 })
  assert.equal(hub.total, 4, 'shows with any official stream')
  assert.deepEqual(
    hub.services.map((s) => [s.name, s.count, s.airing]),
    [
      ['Crunchyroll', 3, 1],
      ['Netflix', 2, 0],
    ],
  )
  assert.deepEqual(
    hub.services[0].rows.map((r) => r[0]),
    ['T2', 'T3'],
    'most watched first, cut at top',
  )
  assert.equal(hub.services[0].slug, 'crunchyroll')
  assert.equal(platformHub(titles, cardRow, { min: 2, top: 2, services: 3 }), null, 'too few services, no page')

  const facts = (name) => ({ Crunchyroll: { free: 'The first episodes' } })[name] || {}
  const faq = platformFaq(hub, facts, 'Site')
  assert.match(faq[0].a, /Of the 4 shows on Site with an official stream, the most are on Crunchyroll \(3\) and Netflix \(2\)\./)
  assert.equal(faq[1].a, 'Crunchyroll (the first episodes of a series) lets you watch without paying. Each service\'s section below says how the rest is paid for.')
  assert.equal(faq[2].a, 'Crunchyroll, with 3 of the shows here, 1 of them airing now. Netflix is next with 2.')
  assert.deepEqual(platformFaq(null, facts, 'Site'), [])
})

test('where to watch: listed with the hubs only when built', () => {
  const base = { groups: {}, years: {} }
  assert.ok(hubPaths({ ...base, platforms: { total: 1, services: [] } }).some((p) => p.path === '/where-to-watch'))
  assert.ok(!hubPaths({ ...base, platforms: null }).some((p) => p.path === '/where-to-watch'))
})
