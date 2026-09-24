#!/usr/bin/env node
/**
 * Opening and ending songs for every anime, as plain text.
 *
 *   node scripts/sync-animethemes.mjs      writes data/themes.json
 *
 * Sources (both owners gave written permission on 23 Sep 2026 for commercial
 * use, no credit required). We keep titles, artists and episode ranges only.
 * We never store, embed or link their audio or video files.
 *
 *   1. AnimeThemes (api.animethemes.moe). The whole anime list, 100 per page,
 *      with the AniList id from each anime's resources. About 50 calls.
 *   2. AniSongDB (anisongdb.com), gap-fill only. For the anime in
 *      data/anime.json that AnimeThemes does not cover, or covers with a song
 *      that has no artist, asked by MAL id, 500 ids per call. An existing
 *      AnimeThemes row only gains its missing artist, and only when the song
 *      titles agree. Skipped when data/anime.json is missing or SKIP_ANISONGDB=1.
 *
 * Output: { builtAt, sources, byAnilistId: { "<id>": [row, ...] } }
 *   row = { type: 'OP'|'ED', seq, title, artists: [..], episodes?, version? }
 *   OP before ED, then by sequence. One row per slot: dub and alternate
 *   versions of the same slot collapse into one. Anime with no songs are left
 *   out.
 *
 * Guard: when a previous data/themes.json exists and the new one covers fewer
 * than 90% of its anime, nothing is written and the script exits 1. That is
 * what a half-failed run looks like. ALLOW_SHRINK=1 lets it through.
 *
 * Env: SYNC_LIMIT_PAGES=n stops AnimeThemes after n pages (local testing).
 *      SKIP_ANISONGDB=1 skips the gap-fill.
 */
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { writeFileAtomic } from '../src/lib/write-atomic.mjs'
import config from '../src/lib/site.mjs'

// The site being built is the working directory (scripts/build-site.mjs), so
// its data/ and dist/ are found from there, not from this file.
const ROOT = process.cwd()
const OUT = join(ROOT, 'data', 'themes.json')
const CATALOG = join(ROOT, 'data', 'anime.json')

const USER_AGENT = `${config.key}-sync/1.0 (+${config.siteUrl}${config.routes.includes('contact') ? '/contact' : ''})`
const ANIMETHEMES = 'https://api.animethemes.moe/anime'
const ANISONGDB = 'https://anisongdb.com/api/mal_ids_request'

// AnimeThemes allows 90 calls a minute. One call started per 1.1 s is ~55.
const MIN_GAP_MS = 1100
const PAGE_SIZE = 100
const MAL_BATCH = 500
const MAX_TRIES = 6
const BACKOFF_BASE_MS = 2000
const REQUEST_TIMEOUT_MS = 60_000
const KEEP_RATIO = 0.9
const MAX_ARTISTS = 6

const LIMIT_PAGES = Number(process.env.SYNC_LIMIT_PAGES) || Infinity
const ALLOW_SHRINK = !!process.env.ALLOW_SHRINK
const SKIP_ANISONGDB = process.env.SKIP_ANISONGDB === '1'

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

// ---- HTTP -----------------------------------------------------------------------

let lastStart = 0
let calls = 0

/** Seconds or an HTTP date, as Retry-After allows. Null when absent. */
function retryAfterMs(res) {
  const value = res.headers.get('retry-after')
  if (!value) return null
  const seconds = Number(value)
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000)
  const at = Date.parse(value)
  return Number.isFinite(at) ? Math.max(0, at - Date.now()) : null
}

/** JSON from `url`, throttled, retried on 429, 5xx and network errors. */
async function fetchJson(url, init = {}) {
  for (let attempt = 1; ; attempt++) {
    const wait = lastStart + MIN_GAP_MS - Date.now()
    if (wait > 0) await sleep(wait)
    lastStart = Date.now()
    calls++
    let res
    try {
      res = await fetch(url, {
        ...init,
        headers: { 'User-Agent': USER_AGENT, Accept: 'application/json', ...init.headers },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      })
    } catch (error) {
      if (attempt >= MAX_TRIES) throw new Error(`${url}: ${error.message}`)
      await sleep(BACKOFF_BASE_MS * 2 ** (attempt - 1))
      continue
    }
    if (res.ok) return res.json()
    const retryable = res.status === 429 || res.status >= 500
    if (!retryable || attempt >= MAX_TRIES) {
      throw new Error(`${url}: HTTP ${res.status} after ${attempt} tries`)
    }
    const delay = retryAfterMs(res) ?? BACKOFF_BASE_MS * 2 ** (attempt - 1)
    console.log(`  HTTP ${res.status}, waiting ${Math.round(delay / 1000)} s (try ${attempt})`)
    await sleep(delay)
  }
}

// ---- rows -----------------------------------------------------------------------

const clean = (text) => (typeof text === 'string' ? text.replace(/\s+/g, ' ').trim() : '')

const byTypeThenSeq = (a, b) => (a.type === b.type ? a.seq - b.seq : a.type === 'OP' ? -1 : 1)

/** One row, with the empty optional fields left off. */
function row(type, seq, title, artists, episodes, version) {
  const out = { type, seq, title, artists: artists.slice(0, MAX_ARTISTS) }
  if (episodes) out.episodes = episodes
  if (version) out.version = version
  return out
}

/** "Name", or "Name (as Character)" when the artist sang in character. */
function artistName(artist) {
  const pivot = artist.artistsong || {}
  const name = clean(pivot.alias) || clean(artist.name)
  const as = clean(pivot.as)
  return as ? `${name} (as ${as})` : name
}

const RANGE = /^(\d+)(?:\s*-\s*(\d+))?$/

/**
 * "1-2", "3-5", "6-13" -> "1-13". Returns null when any piece is not a plain
 * number or range, so odd text is kept as it came instead of mangled.
 */
function mergeRanges(pieces) {
  const spans = []
  for (const piece of pieces) {
    const match = RANGE.exec(piece)
    if (!match) return null
    const from = Number(match[1])
    const to = Number(match[2] ?? match[1])
    spans.push([Math.min(from, to), Math.max(from, to)])
  }
  spans.sort((a, b) => a[0] - b[0])
  const merged = []
  for (const [from, to] of spans) {
    const last = merged[merged.length - 1]
    if (last && from <= last[1] + 1) last[1] = Math.max(last[1], to)
    else merged.push([from, to])
  }
  return merged.map(([from, to]) => (from === to ? `${from}` : `${from}-${to}`)).join(', ')
}

/** The episodes of every version of one theme, as one list of ranges. */
function episodesOf(entries = []) {
  const texts = [...entries]
    .sort((a, b) => (a.version || 1) - (b.version || 1))
    .map((entry) => clean(entry.episodes))
    // "??-40": the source does not know either. Say nothing rather than that.
    .filter((text) => text && !text.includes('?'))
  if (!texts.length) return ''
  const pieces = texts.flatMap((text) => text.split(',').map((s) => s.trim()).filter(Boolean))
  return mergeRanges(pieces) ?? [...new Set(texts)].join(', ')
}

/** AnimeThemes themes -> rows. One per OP/ED slot; the original beats a dub group. */
function rowsFromAnimeThemes(themes = []) {
  const slots = new Map()
  for (const theme of themes) {
    if (theme.type !== 'OP' && theme.type !== 'ED') continue
    const title = clean(theme.song?.title)
    if (!title) continue
    const seq = theme.sequence || 1
    const key = `${theme.type}|${seq}`
    const held = slots.get(key)
    // A theme outside any group is the original broadcast one. A grouped one
    // (a dub, a re-release) only fills a slot nothing else has.
    if (held && (theme.group || !held.group)) continue
    slots.set(key, { theme, title, seq, group: theme.group })
  }
  return [...slots.values()]
    .map(({ theme, title, seq, group }) =>
      row(
        theme.type,
        seq,
        title,
        (theme.song.artists || []).map(artistName).filter(Boolean),
        episodesOf(theme.animethemeentries),
        clean(group?.name),
      ))
    .sort(byTypeThenSeq)
}

// ---- AnimeThemes ------------------------------------------------------------------

async function syncAnimeThemes(byId) {
  const params = new URLSearchParams({
    'filter[has]': 'resources',
    'filter[site]': 'AniList',
    include: 'resources,animethemes.animethemeentries,animethemes.song.artists,animethemes.group',
    'fields[anime]': 'id,name',
    'fields[resource]': 'site,external_id',
    'fields[animetheme]': 'type,sequence,slug',
    'fields[animethemeentry]': 'episodes,version',
    'fields[song]': 'title',
    'fields[artist]': 'name',
    'fields[group]': 'name',
    'page[size]': String(PAGE_SIZE),
  })
  let url = `${ANIMETHEMES}?${params}&page[number]=1`
  let pages = 0
  let seen = 0
  while (url && pages < LIMIT_PAGES) {
    const body = await fetchJson(url)
    pages++
    for (const anime of body.anime || []) {
      seen++
      const rows = rowsFromAnimeThemes(anime.animethemes)
      if (!rows.length) continue
      for (const resource of anime.resources || []) {
        if (resource.site !== 'AniList' || !resource.external_id) continue
        const id = String(resource.external_id)
        // Two AnimeThemes entries on one AniList id: keep the fuller list.
        if ((byId[id]?.length || 0) >= rows.length) continue
        byId[id] = rows
      }
    }
    if (pages % 10 === 0) console.log(`  AnimeThemes page ${pages}, ${Object.keys(byId).length} anime with songs`)
    url = body.links?.next || null
  }
  const complete = !url
  if (!complete) console.log(`  stopped after ${pages} pages (SYNC_LIMIT_PAGES)`)
  return { pages, anime: seen, withSongs: Object.keys(byId).length, complete }
}

// ---- AniSongDB gap-fill -----------------------------------------------------------

const SONG_TYPE = /^(Opening|Ending)\s+(\d+)$/

/** AniSongDB songs of one anime -> rows. Dubs, reruns and insert songs are dropped. */
function rowsFromAniSongDb(songs) {
  const slots = new Map()
  for (const song of songs) {
    if (song.isDub || song.isRebroadcast) continue
    const match = SONG_TYPE.exec(clean(song.songType))
    const title = clean(song.songName)
    if (!match || !title) continue
    const type = match[1] === 'Opening' ? 'OP' : 'ED'
    const seq = Number(match[2])
    const key = `${type}|${seq}`
    if (slots.has(key)) continue
    const artists = clean(song.songArtist) ? [clean(song.songArtist)] : []
    slots.set(key, row(type, seq, title, artists))
  }
  return [...slots.values()].sort(byTypeThenSeq)
}

function readCatalog() {
  if (!existsSync(CATALOG)) return null
  try {
    return JSON.parse(readFileSync(CATALOG, 'utf8'))
  } catch (error) {
    console.log(`  data/anime.json does not parse (${error.message}); gap-fill skipped`)
    return null
  }
}

/** Lower-case letters and digits only, for a loose title match. */
const squash = (text) => clean(text).toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '')

/**
 * AnimeThemes knows the song but not who sang it: take the artist from the
 * AniSongDB song in the same slot, when the titles agree.
 */
function fillArtists(rows, extra) {
  let filled = 0
  for (const row of rows) {
    if (row.artists.length) continue
    const other = extra.find((r) => r.type === row.type && r.seq === row.seq)
    if (!other?.artists.length) continue
    const a = squash(row.title)
    const b = squash(other.title)
    if (!a || !b || !(a.includes(b) || b.includes(a))) continue
    row.artists = other.artists
    filled++
  }
  return filled
}

async function gapFill(byId) {
  if (SKIP_ANISONGDB) return { skipped: 'SKIP_ANISONGDB=1' }
  const catalog = readCatalog()
  if (!catalog) return { skipped: 'no data/anime.json' }
  // MAL id -> our AniList id: the anime AnimeThemes left empty, and the ones
  // where it has a song with no artist.
  const wanted = new Map()
  for (const item of catalog) {
    if (item.kind !== 'anime' || !item.malId) continue
    const rows = byId[String(item.id)]
    if (rows && rows.every((r) => r.artists.length)) continue
    wanted.set(Number(item.malId), String(item.id))
  }
  const malIds = [...wanted.keys()]
  let added = 0
  let artistsFilled = 0
  let batches = 0
  for (let i = 0; i < malIds.length; i += MAL_BATCH) {
    const batch = malIds.slice(i, i + MAL_BATCH)
    let songs
    try {
      songs = await fetchJson(ANISONGDB, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mal_ids: batch }),
      })
      batches++
    } catch (error) {
      // The guard below decides whether a shorter list may be written.
      console.log(`  ::warning::AniSongDB batch ${i / MAL_BATCH + 1} failed: ${error.message}`)
      continue
    }
    const byMal = new Map()
    for (const song of Array.isArray(songs) ? songs : []) {
      const mal = song.linked_ids?.myanimelist
      if (!wanted.has(mal)) continue
      if (!byMal.has(mal)) byMal.set(mal, [])
      byMal.get(mal).push(song)
    }
    for (const [mal, list] of byMal) {
      const rows = rowsFromAniSongDb(list)
      if (!rows.length) continue
      const id = wanted.get(mal)
      if (byId[id]) {
        artistsFilled += fillArtists(byId[id], rows)
        continue
      }
      byId[id] = rows
      added++
    }
  }
  return { asked: malIds.length, batches, withSongs: added, artistsFilled }
}

// ---- guard and write --------------------------------------------------------------

function previousCount() {
  if (!existsSync(OUT)) return 0
  try {
    return Object.keys(JSON.parse(readFileSync(OUT, 'utf8')).byAnilistId || {}).length
  } catch {
    return 0
  }
}

async function main() {
  const started = Date.now()
  const byId = {}
  console.log('AnimeThemes: paging the anime list')
  const animethemes = await syncAnimeThemes(byId)
  console.log(`  ${animethemes.pages} pages, ${animethemes.anime} anime, ${animethemes.withSongs} with songs`)

  console.log('AniSongDB: gap-fill by MAL id')
  const anisongdb = await gapFill(byId)
  console.log(`  ${JSON.stringify(anisongdb)}`)

  const count = Object.keys(byId).length
  const before = previousCount()
  if (!count) {
    console.error('::error::no anime with songs; data/themes.json left as it was')
    process.exit(1)
  }
  if (before && count < before * KEEP_RATIO && !ALLOW_SHRINK) {
    console.error(
      `::error::the new song list covers ${count} anime, the old one ${before}. Refusing to ` +
        'replace it with a list that much smaller; nothing was written. Set ALLOW_SHRINK=1 if intended.'
    )
    process.exit(1)
  }

  // Stable output: ids in numeric order, so a rerun with the same data is the same file.
  const sorted = {}
  for (const id of Object.keys(byId).sort((a, b) => a - b)) sorted[id] = byId[id]
  const rows = Object.values(sorted).reduce((n, list) => n + list.length, 0)
  const seconds = Math.round((Date.now() - started) / 1000)
  const out = {
    builtAt: new Date().toISOString(),
    sources: { animethemes, anisongdb, calls, seconds },
    anime: count,
    rows,
    byAnilistId: sorted,
  }
  writeFileAtomic(OUT, JSON.stringify(out))
  console.log(`themes.json: ${count} anime, ${rows} songs (was ${before}); ${calls} calls in ${seconds} s`)
}

main().catch((error) => {
  console.error('SYNC ANIMETHEMES FAILED:', error.message)
  process.exit(1)
})
