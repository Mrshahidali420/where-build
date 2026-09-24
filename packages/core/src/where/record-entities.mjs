/**
 * The shard records of a Where site's entity pages: people (one record for
 * a voice actor page and a staff page), studios, song artists and
 * franchises. Every link is resolved at build time (src/where/linker.mjs).
 *
 * Pure.
 */
import { CATEGORIES, OTHER, categoryOf } from './roles.mjs'
import { collaboratorsOf } from './people.mjs'
import { regularsOf } from './studios.mjs'
import { characterUrl } from './cross.mjs'
import { mainChain } from './franchises.mjs'

const byYearDesc = (a, b) => (b.year || 0) - (a.year || 0) || a.title.localeCompare(b.title)

/** The few facts of a title a list row shows. */
function titleRow(ctx, id) {
  const t = ctx.titleById.get(id)
  if (!t) return null
  return {
    title: t.title,
    href: ctx.link.title(id),
    year: t.startYear || null,
    format: t.format || '',
    status: t.status || '',
    episodes: t.episodes || null,
    cover: t.cover || '',
  }
}

/** Every voice role, newest show first. One row per show, character and language. */
function rolesOf(person, ctx) {
  const seen = new Set()
  const rows = []
  for (const role of person.voice) {
    const key = `${role.titleId}:${role.characterId}:${role.language}`
    if (seen.has(key)) continue
    seen.add(key)
    const show = titleRow(ctx, role.titleId)
    const known = ctx.cast[String(role.characterId)]
    if (!show || !known?.[0]) continue
    rows.push({
      ...show,
      character: { name: known[0], image: known[1] || '', face: characterUrl(role.characterId, ctx.cross) },
      role: role.role,
      language: role.language,
    })
  }
  return rows.sort(byYearDesc)
}

/** Crew work, grouped by what they did; one row per show inside a group, with every role they held on it. */
function worksOf(person, ctx) {
  const groups = new Map()
  for (const credit of person.crew) {
    const category = categoryOf(credit.role)
    if (!groups.has(category.key)) groups.set(category.key, new Map())
    const shows = groups.get(category.key)
    if (!shows.has(credit.titleId)) shows.set(credit.titleId, [])
    const roles = shows.get(credit.titleId)
    if (!roles.includes(credit.role)) roles.push(credit.role)
  }
  return [...CATEGORIES, OTHER]
    .filter((category) => groups.has(category.key))
    .map((category) => ({
      key: category.key,
      label: category.label,
      items: [...groups.get(category.key)]
        .map(([titleId, roles]) => {
          const show = titleRow(ctx, titleId)
          return show ? { ...show, roles } : null
        })
        .filter(Boolean)
        .sort(byYearDesc),
    }))
    .filter((group) => group.items.length)
}

const clip = (list, max) => (list || []).slice(0, max)

/** A person: voice roles when they have a voice page, crew work when they have a staff page. */
export function personRecord(person, slug, ctx) {
  const info = person.info || {}
  const voicePage = ctx.pages.voice.has(person.id)
  const staffPage = ctx.pages.staff.has(person.id)
  const collaborators = staffPage
    ? collaboratorsOf(person, ctx.crewByTitle, (id) => ctx.pages.staff.has(id))
        .map(({ id, count }) => ({ name: ctx.staff[String(id)]?.name || '', href: ctx.link.staff(id), count }))
        .filter((c) => c.name)
    : []
  return {
    id: person.id,
    slug,
    name: person.name,
    native: info.native || '',
    aliases: clip(info.aliases, 5),
    image: info.image || '',
    bio: info.description || '',
    birthDate: info.birthDate || null,
    homeTown: info.homeTown || '',
    yearsActive: info.yearsActive || [],
    gender: info.gender || '',
    occupations: clip(info.occupations, 4),
    language: info.language || '',
    anilistUrl: info.anilistUrl || '',
    voicePage,
    staffPage,
    counts: { roles: person.voiceRoleCount, shows: person.staffWorkCount },
    voiceHref: voicePage ? ctx.link.voice(person.id) : null,
    staffHref: staffPage ? ctx.link.staff(person.id) : null,
    roles: voicePage ? rolesOf(person, ctx) : [],
    works: staffPage ? worksOf(person, ctx) : [],
    collaborators,
  }
}

const named = (ctx, list) =>
  list.map(({ id, count }) => ({ name: ctx.staff[String(id)]?.name || '', href: ctx.link.crew(id), count })).filter((p) => p.name)

export function studioRecord(studio, slug, ctx) {
  return {
    id: studio.id,
    slug,
    name: studio.name,
    works: studio.titleIds.map((id) => titleRow(ctx, id)).filter(Boolean).sort(byYearDesc),
    directors: named(ctx, regularsOf(studio, ctx.credits, ['Director', 'Chief Director', 'Series Director'])),
    composers: named(ctx, regularsOf(studio, ctx.credits, ['Music', 'Music Composition'])),
  }
}

export function artistRecord(artist, slug, ctx) {
  const songs = artist.songs
    .map((song) => {
      const show = titleRow(ctx, song.titleId)
      return show ? { type: song.type, seq: song.seq, title: song.title, episodes: song.episodes, anime: show } : null
    })
    .filter(Boolean)
    .sort((a, b) => (b.anime.year || 0) - (a.anime.year || 0) || a.anime.title.localeCompare(b.anime.title) || a.type.localeCompare(b.type) || a.seq - b.seq)
  return { key: artist.key, slug, name: artist.name, songs }
}

/** A franchise in release order, with its main story marked. */
export function franchiseRecord(franchise, slug, ctx) {
  const chain = new Set(mainChain(franchise, ctx.titleById))
  return {
    anchorId: franchise.anchorId,
    slug,
    name: franchise.name,
    entries: franchise.ids.map((id) => ({ ...titleRow(ctx, id), main: chain.has(id) })),
  }
}
