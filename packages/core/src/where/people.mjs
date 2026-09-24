/**
 * People: voice actors and staff, from credits.json and staff.json.
 *
 * AniList files crew and voice actors under one Staff type, so one person has
 * one record here and may earn two pages: /voice-actor/<slug> for their
 * roles and /staff/<slug> for their crew credits (a singer who also voices,
 * a director who once acted). Both pages read the same shard record.
 *
 * Only titles that have a page on the site are read, so every show a person
 * page lists is a real link.
 *
 * Pure: maps in, maps out.
 */

import { isCountedCrew, keyCreditOf } from './roles.mjs'

/** The voice languages a title page's cast table shows. Every language still counts toward a person's page. */
export const CAST_LANGUAGES = ['Japanese', 'English']

function blank(id, info) {
  return {
    id,
    name: info?.name || '',
    info: info || null,
    voice: [], // { titleId, characterId, role, language }
    crew: [], // { titleId, role }
    voiceRoleCount: 0,
    staffWorkCount: 0,
    crewShowCount: 0,
    keyShowCount: 0,
  }
}

/**
 * Every person the credits of these titles name.
 *   titles  the titles that have a page (anything with an `id`)
 *   credits credits.json, by title id
 *   staff   staff.json, by person id
 * Returns Map(personId -> person).
 */
export function buildPeople(titles, credits, staff) {
  const people = new Map()
  const personOf = (id) => {
    let person = people.get(id)
    if (!person) people.set(id, (person = blank(id, staff[String(id)])))
    return person
  }
  for (const title of titles) {
    const row = credits[String(title.id)]
    if (!row) continue
    for (const credit of row.staff || []) {
      if (!credit?.id || !credit.role) continue
      personOf(credit.id).crew.push({ titleId: title.id, role: credit.role })
    }
    for (const character of row.characters || []) {
      if (!character?.id) continue
      for (const voice of character.voiceActors || []) {
        if (!voice?.id) continue
        personOf(voice.id).voice.push({ titleId: title.id, characterId: character.id, role: character.role || '', language: voice.language || '' })
      }
    }
  }
  for (const person of people.values()) Object.assign(person, countsOf(person))
  return people
}

/**
 * What a person's credits add up to:
 *   voiceRoleCount  distinct (show, character) voice roles
 *   staffWorkCount  distinct shows with any crew credit (what a staff page lists)
 *   crewShowCount   distinct shows with a credit that counts as crew work
 *                   (not a song performance, not a producer seat; roles.mjs)
 *   keyShowCount    distinct shows where they hold a key credit (director,
 *                   series writer, original creator, character design, music)
 */
export function countsOf(person) {
  const shows = (credits) => new Set(credits.map((c) => c.titleId)).size
  return {
    voiceRoleCount: new Set(person.voice.map((v) => `${v.titleId}:${v.characterId}`)).size,
    staffWorkCount: shows(person.crew),
    crewShowCount: shows(person.crew.filter((c) => isCountedCrew(c.role))),
    keyShowCount: shows(person.crew.filter((c) => keyCreditOf(c.role))),
  }
}

/** Most credited first, then best loved, then by id, so the order never flickers between builds. */
export function byProminence(a, b) {
  const weight = (p) => p.voiceRoleCount + p.staffWorkCount
  return weight(b) - weight(a) || (b.info?.favourites || 0) - (a.info?.favourites || 0) || a.id - b.id
}

/**
 * People who worked on the same shows as this one, on the crew side, with how
 * many shows they share. Only those with a page, and only a real pattern (at
 * least `min` shared shows), most shared first.
 */
export function collaboratorsOf(person, crewByTitle, hasPage, { min = 2, max = 12 } = {}) {
  const shared = new Map()
  for (const titleId of new Set(person.crew.map((c) => c.titleId))) {
    for (const otherId of crewByTitle.get(titleId) || []) {
      if (otherId === person.id || !hasPage(otherId)) continue
      shared.set(otherId, (shared.get(otherId) || 0) + 1)
    }
  }
  return [...shared]
    .filter(([, count]) => count >= min)
    .sort((a, b) => b[1] - a[1] || a[0] - b[0])
    .slice(0, max)
    .map(([id, count]) => ({ id, count }))
}

/** titleId -> Set of crew person ids, for collaboratorsOf. */
export function crewByTitle(people) {
  const map = new Map()
  for (const person of people.values()) {
    for (const credit of person.crew) {
      if (!map.has(credit.titleId)) map.set(credit.titleId, new Set())
      map.get(credit.titleId).add(person.id)
    }
  }
  return map
}
