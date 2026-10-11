import { test } from 'node:test'
import assert from 'node:assert/strict'
import { yearFacts, voiceLines, staffLines, artistLines, voiceLede, staffLede, artistLede } from '../src/where/person-facts.mjs'
import { costarsOf, voicesByTitle } from '../src/where/people.mjs'

const role = (year, character, title, extra = {}) => ({ year, href: `/anime/${title}`, title, role: 'SUPPORTING', language: 'Japanese', character: { name: character }, ...extra })

test('year facts: a peak only when one year stands alone with three or more', () => {
  assert.deepEqual(yearFacts([2001, 2003, 2003, 2003]), { first: 2001, last: 2003, peak: 2003, peakCount: 3 })
  assert.equal(yearFacts([2001, 2001, 2002, 2002]).peak, null)
  assert.equal(yearFacts([null, 0]), null)
})

test('voice lines say only what the record holds', () => {
  assert.deepEqual(voiceLines({ name: 'A', roles: [role(2010, 'X', 'one')] }), [])
  const p = {
    name: 'Ann Lee',
    voiceKnown: { character: 'Mira', title: 'Big Show', main: true },
    roles: [role(2012, 'Mira', 'a'), role(2012, 'Mira', 'b'), role(2012, 'Mira', 'c'), role(2009, 'Tom', 'd', { language: 'English' })],
  }
  const lines = voiceLines(p)
  assert.equal(lines[0], 'The roles listed here run from 2009 to 2012, and 2012 was the busiest year, with 3 roles.')
  assert.equal(lines[1], 'The most watched show on the list is Big Show, where Ann Lee voices Mira, a main character.')
  assert.equal(lines[2], 'Mira is the character Ann Lee has come back to most, across 3 shows.')
  assert.equal(lines[3], 'Ann Lee is credited in Japanese (3 roles) and English (1 role).')
  assert.equal(voiceLede(p), '4 roles in 4 anime.')
})

test('two voice actors with different records never share a sentence', () => {
  const a = voiceLines({ name: 'A B', voiceKnown: { character: 'X', title: 'S1' }, roles: [role(2001, 'X', 'a'), role(2005, 'Y', 'b')] })
  const b = voiceLines({ name: 'C D', voiceKnown: { character: 'Z', title: 'S2' }, roles: [role(1999, 'Z', 'c'), role(2020, 'W', 'd')] })
  assert.equal(a.length, 2)
  assert.equal(a.filter((line) => b.includes(line)).length, 0)
})

test('staff lines', () => {
  const item = (year, title, format = 'TV') => ({ year, title, href: `/anime/${title}`, format })
  const p = {
    name: 'Jo Ito',
    counts: { shows: 3 },
    staffKnown: { title: 'Big Show', roles: ['Director', 'Storyboard'] },
    works: [
      { key: 'directed', label: 'Directed', items: [item(2001, 'a'), item(2004, 'b', 'MOVIE')] },
      { key: 'wrote', label: 'Wrote', items: [item(2004, 'b', 'MOVIE')] },
    ],
  }
  assert.deepEqual(staffLines(p), [
    'The credits listed here run from 2001 to 2004.',
    'The most watched of them is Big Show, where Jo Ito is credited for Director and Storyboard.',
    'By format: 1 Movie and 1 TV series.',
    'The second largest group of credits is "Wrote", on 1 show.',
  ])
  assert.equal(staffLede(p), 'Credited on 3 anime, most of all as a director.')
  assert.deepEqual(staffLines({ name: 'N', works: [] }), [])
})

test('artist lines', () => {
  const song = (title, type, show, year) => ({ title, type, anime: { title: show, href: `/anime/${show}`, year } })
  const a = { name: 'Band', songs: [song('New', 'OP', 'Two', 2020), song('Mid', 'ED', 'One', 2011), song('Old', 'ED', 'One', 2010)] }
  assert.deepEqual(artistLines(a), [
    'The songs listed here run from 2010 to 2020.',
    'One uses the most of them: 2 songs.',
    'The earliest is "Old", an ending of One (2010), and the newest is "New", from Two (2020).',
  ])
  assert.equal(artistLede(a), '1 opening and 2 endings in 2 anime, newest show first.')
  assert.deepEqual(artistLines({ name: 'Solo', songs: [song('Only', 'OP', 'One', 2010)] }), [])
})

test('co-stars: a pattern of three shared shows, only people with a page', () => {
  const person = (id, shows) => ({ id, voice: shows.map((titleId) => ({ titleId })) })
  const people = new Map([person(1, [1, 2, 3, 4]), person(2, [1, 2, 3]), person(3, [1, 2]), person(4, [1, 2, 3, 4])].map((p) => [p.id, p]))
  const byTitle = voicesByTitle(people)
  assert.deepEqual(costarsOf(people.get(1), byTitle, (id) => id !== 4), [{ id: 2, count: 3 }])
})
