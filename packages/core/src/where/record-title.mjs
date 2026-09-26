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
import { mainChain } from './franchises.mjs'
import { picksForTitleIn, booksKnownIn } from '../lib/picks-core.js'

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
    thread: threadOf(item, franchise, ctx),
  }
}

/** How many main-story entries the thread on a title page shows around this one. */
const THREAD_MAX = 9

/**
 * The main story of the franchise as a thread (prequel to sequel, one season
 * after the other), cut to the entries around this title. Null when this
 * title is not on the main story (a film or side story), or the story is one
 * entry long: the prev/next steps already say all there is.
 */
function threadOf(item, franchise, ctx) {
  const chain = mainChain(franchise, ctx.titleById)
  const at = chain.indexOf(item.id)
  if (at < 0 || chain.length < 2) return null
  const from = Math.max(0, Math.min(at - Math.floor(THREAD_MAX / 2), chain.length - THREAD_MAX))
  return {
    from: from + 1,
    total: chain.length,
    steps: chain.slice(from, from + THREAD_MAX).map((id) => {
      const t = ctx.titleById.get(id)
      return { title: t.title, href: id === item.id ? null : ctx.link.title(id), year: t.startYear || null, episodes: t.episodes || null, format: t.format || '', self: id === item.id }
    }),
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
  return href ? { id, title: t.title, href, cover: t.cover || '', year: t.startYear || null, format: t.format || '' } : null
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

/**
 * "You may also like": the closest shows by genre and tag (ctx.similar,
 * src/where/similar.mjs) that the page does not already show as related or
 * recommended, each with the genres it shares.
 */
export function similarCardsOf(item, ctx, shown = []) {
  const skip = new Set(shown.map((c) => c.href))
  const out = []
  for (const match of ctx.similar?.get(item.id) || []) {
    if (out.length >= SIMILAR_CARDS) break
    const card = cardOf(ctx, match.id)
    if (!card || skip.has(card.href)) continue
    skip.add(card.href)
    out.push({ ...card, shared: match.genres.slice(0, 3) })
  }
  return out
}
const SIMILAR_CARDS = 6

/** AniList's all-time chart place, when it has one: "#1 most popular of all time". */
function chartOf(item) {
  const words = { POPULAR: 'most popular', RATED: 'highest rated' }
  const best = (item.ranks || []).filter((r) => r.allTime && words[r.type]).sort((a, b) => a.rank - b.rank)[0]
  return best ? { rank: best.rank, words: words[best.type] } : null
}

/** t: one entry of computeWhere's titles ({ item, rows, dated, episodesPage }). */
export function titleRecord(t, ctx) {
  const { item } = t
  const row = ctx.credits[String(item.id)]
  const { key, crew } = creditsOf(row, ctx)
  const related = relatedOf(item, ctx)
  const recs = recsOf(item, ctx, related)
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
    // How much of startDate AniList gave ('day', 'month', 'year'), so a
    // first-of-the-month placeholder is never printed as a real date.
    startPrecision: item.startPrecision || null,
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
    recs,
    similar: similarCardsOf(item, ctx, [...related, ...recs]),
    chart: chartOf(item),
    watching: item.readers?.current || 0,
    completed: item.readers?.completed || 0,
    // Amazon products: this show's own, or its source's (the manga it was
    // made from), with `from` naming that source. Hand picks first, then the
    // ones matched from publisher records (`byHand: false`).
    picks: ctx.picks || ctx.productPicks ? picksForTitleIn(ctx.picks, item, ctx.productPicks) : null,
    // False only when the show was checked and its source has no English
    // print: the buy box then drops its book search (src/where/shop.mjs).
    books: booksKnownIn(ctx.picks, item, ctx.productPicks),
    likeHref: ctx.likes?.has(item.id) ? `${ctx.link.title(item.id)}/like` : null,
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
