// Bring an AniList list into My list.
//
// Two POSTs, straight from the reader's browser to AniList's public GraphQL
// API: one for their anime, one for their manga. Nothing passes through our
// server, and only a public list can be read this way (no sign-in, no token).
// The CSP in public/_headers allows https://graphql.anilist.co for this.
//
// Each AniList entry is matched to a page we hold through the list rows
// (/d/l/<n>.json, keyed by the same AniList id), so the match is a join on
// ids, never a guess on titles. Custom lists come across as named lists.
//
// Never MyAnimeList or Jikan: their terms do not allow this use.

import { ROW } from './list-row.js'

const ENDPOINT = 'https://graphql.anilist.co'
const USER_RE = /^[A-Za-z0-9_-]{2,30}$/
const TAG_MIN_RANK = 60

const QUERY = `query ($user: String, $type: MediaType) {
  MediaListCollection(userName: $user, type: $type) {
    user { name }
    lists {
      name
      isCustomList
      entries {
        status
        progress
        score(format: POINT_100)
        hiddenFromStatusLists
        media {
          id
          title { english romaji }
          coverImage { medium }
          genres
          tags { name rank isMediaSpoiler }
        }
      }
    }
  }
}`

/** An error with words a reader can act on. `code` is for GA4, not for them. */
export class ImportError extends Error {
  constructor(code, message) {
    super(message)
    this.name = 'ImportError'
    this.code = code
  }
}

/** A username AniList could hold: letters, digits, _ and -, 2 to 30 long. */
export const cleanUser = (value) => String(value || '').trim().replace(/^@/, '')
export const isUserName = (value) => USER_RE.test(cleanUser(value))

/** Turn AniList's answer, or a failed fetch, into one ImportError. */
function errorFor(status, body) {
  const message = ((body && body.errors) || []).map((e) => String(e.message || '')).join(' ')
  if (/private/i.test(message)) {
    return new ImportError('private', 'That AniList list is private. Make it public in AniList settings (Lists), then try again.')
  }
  if (/not found/i.test(message) || status === 404) {
    return new ImportError('not_found', 'No AniList user has that name. Check the spelling and try again.')
  }
  if (status === 429) {
    return new ImportError('rate_limited', 'AniList says too many requests right now. Wait a minute, then try again.')
  }
  return new ImportError('failed', 'AniList did not answer properly. Try again in a minute.')
}

async function fetchCollection(user, type, fetchImpl) {
  let res
  try {
    res = await fetchImpl(ENDPOINT, {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({ query: QUERY, variables: { user, type } }),
      credentials: 'omit',
    })
  } catch (e) {
    throw new ImportError('network', 'Could not reach AniList. Check your connection and try again.')
  }
  let body = null
  try {
    body = await res.json()
  } catch (e) {
    body = null
  }
  if (!res.ok || !body || body.errors || !body.data || !body.data.MediaListCollection) {
    throw errorFor(res.status, body)
  }
  return body.data.MediaListCollection
}

/**
 * Every entry of one collection, once per media id. An entry sits in its
 * status list and in each custom list it belongs to; AniList repeats it in
 * each, so the custom list names are gathered onto the one entry.
 */
function flatten(collection, media) {
  const byId = new Map()
  for (const list of collection.lists || []) {
    for (const entry of list.entries || []) {
      const m = entry && entry.media
      if (!m || !Number.isInteger(m.id)) continue
      let row = byId.get(m.id)
      if (!row) {
        row = {
          id: m.id,
          media,
          title: (m.title && (m.title.english || m.title.romaji)) || '',
          cover: (m.coverImage && m.coverImage.medium) || '',
          genres: (m.genres || []).slice(0, 4),
          tags: (m.tags || [])
            .filter((t) => t && !t.isMediaSpoiler && t.rank >= TAG_MIN_RANK)
            .sort((a, b) => b.rank - a.rank)
            .slice(0, 6)
            .map((t) => t.name),
          status: entry.status,
          progress: entry.progress || 0,
          score: entry.score || 0,
          hidden: entry.hiddenFromStatusLists === true,
          lists: [],
        }
        byId.set(m.id, row)
      }
      if (list.isCustomList && list.name && !row.lists.includes(list.name)) row.lists.push(list.name)
    }
  }
  return [...byId.values()]
}

/**
 * Read a public AniList list. Returns { user, entries } where each entry
 * still needs matching to our pages (see matchEntries). Throws ImportError.
 */
export async function fetchAniList(userName, fetchImpl = globalThis.fetch.bind(globalThis)) {
  const user = cleanUser(userName)
  if (!USER_RE.test(user)) {
    throw new ImportError('bad_name', 'Type an AniList username: letters, numbers, _ or -.')
  }
  // One after the other, not both at once: AniList allows only a few
  // requests a minute, and a second one that fails would waste the first.
  const anime = await fetchCollection(user, 'ANIME', fetchImpl)
  const manga = await fetchCollection(user, 'MANGA', fetchImpl)
  const name = (anime.user && anime.user.name) || (manga.user && manga.user.name) || user
  const seen = new Set()
  const entries = []
  for (const row of [...flatten(anime, 'ANIME'), ...flatten(manga, 'MANGA')]) {
    if (seen.has(row.id)) continue
    seen.add(row.id)
    entries.push(row)
  }
  return { user: name, entries }
}

/**
 * Join AniList entries to the pages we hold. `rows` is a Map of id -> list
 * row (list-data.js loadRows). An entry with no row is counted, not saved:
 * we only ever save a title that has a page to open.
 */
export function matchEntries(entries, rows) {
  const matched = []
  let skipped = 0
  for (const e of entries) {
    const row = rows.get(e.id)
    if (!row) {
      skipped++
      continue
    }
    matched.push({
      meta: {
        id: e.id,
        ns: row[ROW.NS],
        slug: row[ROW.SLUG],
        title: e.title,
        cover: e.cover,
        genres: e.genres,
        tags: e.tags,
        rel: [row[ROW.SRC], ...(row[ROW.ADAPT] || []), ...(row[ROW.RECS] || [])].filter(Boolean),
      },
      status: e.status,
      progress: e.progress,
      score: e.score,
      hidden: e.hidden,
      lists: e.lists,
    })
  }
  return { matched, skipped }
}
