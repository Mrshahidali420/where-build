/**
 * One anime's shard record: everything its title page and its episodes page
 * print, with every link already resolved (src/where/linker.mjs), so the
 * Worker renders it from this one record and never needs the catalog.
 *
 * Pure.
 */
import { KEY_CREDITS, keyCreditOf } from './roles.mjs'
import { CAST_LANGUAGES } from './people.mjs'
import { studiosOfTitle } from './studios.mjs'
import { artistKey } from './artists.mjs'
import { crossCards, characterUrl } from './cross.mjs'

/** How many cast rows a title record keeps: the credits walk fetched 25. */
const CAST_MAX = 25

const nameOf = (ctx, id) => ctx.staff[String(id)]?.name || ''

/** Key credits first (each linked), then the rest of the crew as it came. */
function creditsOf(row, ctx) {
  const key = KEY_CREDITS.map((k) => ({ label: k.label, people: [] }))
  const crew = []
  for (const credit of row?.staff || []) {
    const name = credit?.id && credit.role ? nameOf(ctx, credit.id) : ''
    if (!name) continue
    const person = { name, href: ctx.link.crew(credit.id) }
    const slot = keyCreditOf(credit.role)
    if (slot) {
      const people = key.find((k) => k.label === slot.label).people
      if (!people.some((p) => p.name === name)) people.push(person)
    } else {
      crew.push({ role: credit.role, ...person })
    }
  }
  return { key: key.filter((k) => k.people.length), crew }
}

/** The id at the end of a catalog cast slug ("eren-yeager-40882"). */
const idOfSlug = (slug) => Number(/-(\d+)$/.exec(slug || '')?.[1]) || null

/**
 * The cast table: each character's face and name, and their Japanese and
 * English voices. From credits.json when the walk reached the title, else
 * from the catalog's own cast list (faces and names, no voice links).
 */
function castOf(item, row, ctx) {
  const listed = new Map((item.characters || []).map((c) => [c.id || idOfSlug(c.slug), c]))
  const fromCredits = (row?.characters || []).map((character) => {
    const known = ctx.cast[String(character.id)] || []
    const own = listed.get(character.id) || {}
    const voices = (character.voiceActors || [])
      .filter((v) => CAST_LANGUAGES.includes(v.language))
      .map((v) => ({ name: nameOf(ctx, v.id), href: ctx.link.cast(v.id), language: v.language }))
      .filter((v) => v.name)
    return { id: character.id, name: known[0] || own.name || '', image: known[1] || own.image || '', role: character.role || own.role || '', voices }
  })
  const rows = fromCredits.length
    ? fromCredits
    : [...listed].map(([id, c]) => ({ id, name: c.name, image: c.image, role: c.role || '', voices: [] }))
  return rows
    .filter((c) => c.name)
    .slice(0, CAST_MAX)
    .map(({ id, ...c }) => ({ ...c, face: id ? characterUrl(id, ctx.cross) : null }))
}

function songsOf(item, ctx) {
  return (ctx.themes[String(item.id)] || [])
    .filter((song) => song?.title && (song.type === 'OP' || song.type === 'ED'))
    .map((song) => ({
      type: song.type,
      seq: song.seq || 0,
      title: song.title,
      episodes: song.episodes || '',
      artists: [...new Set(song.artists || [])].map((name) => ({ name, href: ctx.link.artist(artistKey(name)) })),
    }))
}

const entryOf = (ctx, id) => {
  const t = ctx.titleById.get(id)
  return t ? { title: t.title, href: ctx.link.title(id), year: t.startYear || null } : null
}

/** Where this title sits in its franchise's release order, with the entries either side. */
function watchOf(item, ctx) {
  const franchise = ctx.franchiseOf.get(item.id)
  const href = franchise ? ctx.link.watch(franchise.anchorId) : null
  if (!href) return null
  const at = franchise.ids.indexOf(item.id)
  return {
    href,
    name: franchise.name,
    position: at + 1,
    total: franchise.ids.length,
    prev: at > 0 ? entryOf(ctx, franchise.ids[at - 1]) : null,
    next: at < franchise.ids.length - 1 ? entryOf(ctx, franchise.ids[at + 1]) : null,
  }
}

/** The official streams AniList lists, one per service, http(s) only. */
export function watchOnOf(item) {
  const seen = new Set()
  const out = []
  for (const link of item.watchLinks || []) {
    if (!link?.site || !/^https?:\/\//i.test(link.url || '') || seen.has(link.site)) continue
    seen.add(link.site)
    out.push({ site: link.site, url: link.url })
  }
  return out
}

/** The trailer, when AniList names a YouTube id (the page plays it only on a click). */
export function trailerOf(item) {
  const id = String(item.trailer?.id || '').trim()
  if (!/^[\w-]{6,20}$/.test(id)) return null
  return { id, thumb: String(item.trailer.thumb || '').trim() || `https://i.ytimg.com/vi/${id}/hqdefault.jpg` }
}

/** AniList's relation types, as a reader says them. */
const RELATION_WORDS = {
  PREQUEL: 'Prequel',
  SEQUEL: 'Sequel',
  PARENT: 'Main story',
  SIDE_STORY: 'Side story',
  SPIN_OFF: 'Spin-off',
  ALTERNATIVE: 'Alternative version',
  SUMMARY: 'Recap',
  CHARACTER: 'Same characters',
  OTHER: 'Related',
}
const RELATION_ORDER = Object.keys(RELATION_WORDS)
const MAX_RELATED = 12
const MAX_RECS = 8

const cardOf = (ctx, id) => {
  const t = ctx.titleById.get(id)
  const href = t && ctx.link.title(id)
  return href ? { title: t.title, href, cover: t.cover || '', year: t.startYear || null, format: t.format || '' } : null
}

/** Other anime AniList relates to this one, each with a page here, closest relation first. */
export function relatedOf(item, ctx) {
  const seen = new Set([item.id])
  return (item.relations || [])
    .filter((rel) => rel.type === 'ANIME' && RELATION_WORDS[rel.relation])
    .sort((a, b) => RELATION_ORDER.indexOf(a.relation) - RELATION_ORDER.indexOf(b.relation))
    .map((rel) => {
      if (seen.has(rel.id)) return null
      seen.add(rel.id)
      const card = cardOf(ctx, rel.id)
      return card ? { ...card, relation: RELATION_WORDS[rel.relation] } : null
    })
    .filter(Boolean)
    .slice(0, MAX_RELATED)
}

/** AniList readers' recommendations, best rated first, only titles with a page and not already related. */
export function recsOf(item, ctx, related = []) {
  const skip = new Set([ctx.link.title(item.id), ...related.map((r) => r.href)])
  return [...(item.recIds || [])]
    .sort((a, b) => (b.rating || 0) - (a.rating || 0))
    .map((rec) => cardOf(ctx, rec.id))
    .filter((card) => card && !skip.has(card.href) && skip.add(card.href))
    .slice(0, MAX_RECS)
}

/** t: one entry of computeWhere's titles ({ item, rows, dated, episodesPage }). */
export function titleRecord(t, ctx) {
  const { item } = t
  const row = ctx.credits[String(item.id)]
  const { key, crew } = creditsOf(row, ctx)
  const related = relatedOf(item, ctx)
  return {
    id: item.id,
    slug: item.slug,
    title: item.title,
    romaji: item.titleRomaji || '',
    native: item.titleNative || '',
    synonyms: (item.synonyms || []).slice(0, 4),
    cover: item.cover || '',
    banner: item.banner || '',
    color: item.coverColor || '',
    format: item.format || '',
    status: item.status || '',
    source: item.source || '',
    season: item.season || '',
    seasonYear: item.seasonYear || null,
    startDate: item.startDate || null,
    startYear: item.startYear || null,
    endYear: item.endYear || null,
    episodes: item.episodes || null,
    description: item.description || '',
    genres: item.genres || [],
    tags: (item.tags || []).slice(0, 8),
    score: item.score || null,
    popularity: item.popularity || 0,
    favourites: item.favourites || 0,
    trailer: trailerOf(item),
    watchOn: watchOnOf(item),
    related,
    recs: recsOf(item, ctx, related),
    anilistUrl: item.anilistUrl || '',
    nextEpisode: item.nextEpisode || null,
    rows: t.rows,
    dated: t.dated,
    episodesPage: t.episodesPage,
    studios: studiosOfTitle(ctx.credits, item.id).map((s) => ({ name: s.name, href: ctx.link.studio(s.id) })),
    key,
    crew,
    cast: castOf(item, row, ctx),
    songs: songsOf(item, ctx),
    watch: watchOf(item, ctx),
    cross: crossCards(item, ctx.cross),
  }
}
