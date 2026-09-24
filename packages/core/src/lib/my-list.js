// "My list": the reader's saved titles and their own named lists, kept in
// their own browser under one localStorage key. The list itself never leaves
// the browser; GA4 and our own counter only get anonymous counts ("a title was
// saved", with its AniList id), never list names or an AniList username. See
// /privacy. Pages are cached at the edge and served to everybody, so every personal
// part of the site is drawn by this module in the reader's browser.
//
// The shape is chosen to map 1:1 onto AniList, so a later step can sync it to
// a real account without a migration:
//
//   { v:1, createdAt, updatedAt,
//     titles: { "<anilistId>": { id, media, ns, slug, title, cover,
//                                status, progress, score, hidden,
//                                addedAt, updatedAt, genres, tags, rel, seen } },
//     lists:  [ { id, name, createdAt, updatedAt, ids:[...] } ],
//     anilist: { user, importedAt, matched, skipped } | null }
//
// "My list" is every entry in `titles`. A named list only points at ids in
// `titles`, like a playlist: one title can sit in many lists, removing a title
// takes it out of every list, and deleting a list never touches `titles`.
//
// The top half of this file is pure (state in, new state out) so it can be
// tested in node. openStore() at the bottom is the browser side.

import { SECTIONS } from './section.mjs'
import { sendOwn, toOwnRow } from './own-count.js'

export const STORE_KEY = 'mi_list_v1'
export const BAD_KEY = 'mi_list_bad'
export const VERSION = 1

export const MAX_TITLES = 500
export const MAX_LISTS = 20
export const MAX_NAME = 40
const MAX_GENRES = 4
const MAX_TAGS = 6
const MAX_REL = 8
const MAX_TEXT = 300

/** AniList's own list statuses, in the order a reader thinks of them. */
export const STATUSES = ['CURRENT', 'PLANNING', 'COMPLETED', 'REPEATING', 'PAUSED', 'DROPPED']
const STATUS_SET = new Set(STATUSES)
const SECTION_SET = new Set(SECTIONS)

/** The word a reader would use: "Reading" for a comic, "Watching" for anime. */
export function statusLabel(status, media) {
  const anime = media === 'ANIME'
  switch (status) {
    case 'CURRENT':
      return anime ? 'Watching' : 'Reading'
    case 'PLANNING':
      return anime ? 'Plan to watch' : 'Plan to read'
    case 'COMPLETED':
      return 'Finished'
    case 'REPEATING':
      return anime ? 'Rewatching' : 'Rereading'
    case 'PAUSED':
      return 'Paused'
    case 'DROPPED':
      return 'Dropped'
    default:
      return 'Saved'
  }
}

// ---------------------------------------------------------------------------
// Cleaning. Everything read back from storage, from a page's data attributes
// or from AniList is checked here, so the rest of the code can trust it.
// ---------------------------------------------------------------------------

const isId = (n) => Number.isInteger(n) && n > 0 && n < 1e9
const MAX_PROGRESS = 100000
const clampProgress = (value) => Math.max(0, Math.min(MAX_PROGRESS, Math.trunc(Number(value) || 0)))
const text = (value, max = MAX_TEXT) => String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, max)
const idsOf = (list, max) =>
  [...new Set((Array.isArray(list) ? list : []).map(Number).filter(isId))].slice(0, max)
const namesOf = (list, max) =>
  [...new Set((Array.isArray(list) ? list : []).map((n) => text(n, 60)).filter(Boolean))].slice(0, max)
const httpsOnly = (url) => {
  const clean = text(url, 500)
  return /^https:\/\//.test(clean) ? clean : ''
}
// A slug is only ever lower-case letters, digits and hyphens (src/lib/slugify.mjs).
const slugOk = (slug) => /^[a-z0-9][a-z0-9-]{0,99}$/.test(slug)

/** A list name, tidied: spaces collapsed, cut to MAX_NAME. */
export const cleanName = (name) => text(name, MAX_NAME + 20)

/** The public address of a saved title. ns is from a fixed set, so it is safe. */
export const pathOfEntry = (entry) => `/${entry.ns}/${entry.slug}`

function cleanSeen(seen) {
  if (!seen || typeof seen !== 'object') return null
  return {
    status: text(seen.status, 20),
    sites: namesOf(seen.sites, 4),
    nextAt: Number(seen.nextAt) || 0,
    count: Number(seen.count) || 0,
    at: Number(seen.at) || 0,
    ...(Number(seen.flagAt) ? { flagAt: Number(seen.flagAt) } : {}),
  }
}

/**
 * The facts a caller passes in about a title (from the page, or from an
 * AniList import), cleaned. Returns null when the title cannot be saved.
 */
export function cleanMeta(meta) {
  if (!meta || typeof meta !== 'object') return null
  const id = Number(meta.id)
  const ns = text(meta.ns, 10)
  const slug = text(meta.slug, 100)
  if (!isId(id) || !SECTION_SET.has(ns) || !slugOk(slug)) return null
  return {
    id,
    media: ns === 'anime' ? 'ANIME' : 'MANGA',
    ns,
    slug,
    title: text(meta.title) || slug,
    cover: httpsOnly(meta.cover),
    genres: namesOf(meta.genres, MAX_GENRES),
    tags: namesOf(meta.tags, MAX_TAGS),
    rel: idsOf(meta.rel, MAX_REL).filter((n) => n !== id),
  }
}

function cleanEntry(raw) {
  const meta = cleanMeta(raw)
  if (!meta) return null
  return {
    ...meta,
    status: STATUS_SET.has(raw.status) ? raw.status : 'PLANNING',
    progress: clampProgress(raw.progress),
    score: Number.isFinite(Number(raw.score)) && raw.score !== null ? Math.max(0, Math.min(100, Number(raw.score))) : null,
    hidden: raw.hidden === true,
    addedAt: Number(raw.addedAt) || 0,
    updatedAt: Number(raw.updatedAt) || 0,
    seen: cleanSeen(raw.seen),
  }
}

export function emptyState(now = Date.now()) {
  return { v: VERSION, createdAt: now, updatedAt: now, titles: {}, lists: [], anilist: null }
}

/**
 * Whatever was stored, made safe. Returns null when the data is not ours to
 * read (an unknown version): the caller keeps a raw copy and starts fresh,
 * so a future format is never destroyed by an older page.
 */
export function sanitize(raw, now = Date.now()) {
  if (!raw || typeof raw !== 'object' || raw.v !== VERSION) return null
  const titles = {}
  for (const value of Object.values(raw.titles && typeof raw.titles === 'object' ? raw.titles : {})) {
    const entry = cleanEntry(value)
    if (entry && Object.keys(titles).length < MAX_TITLES) titles[entry.id] = entry
  }
  const lists = []
  const names = new Set()
  for (const list of Array.isArray(raw.lists) ? raw.lists : []) {
    const name = cleanName(list && list.name).slice(0, MAX_NAME)
    const id = text(list && list.id, 40)
    if (!name || !/^l_[a-z0-9]+$/.test(id) || names.has(name.toLowerCase())) continue
    if (lists.length >= MAX_LISTS) break
    names.add(name.toLowerCase())
    lists.push({
      id,
      name,
      createdAt: Number(list.createdAt) || now,
      updatedAt: Number(list.updatedAt) || now,
      ids: idsOf(list.ids, MAX_TITLES).filter((n) => titles[n]),
    })
  }
  const a = raw.anilist
  return {
    v: VERSION,
    createdAt: Number(raw.createdAt) || now,
    updatedAt: Number(raw.updatedAt) || now,
    titles,
    lists,
    anilist:
      a && typeof a === 'object'
        ? {
            user: text(a.user, 40),
            importedAt: Number(a.importedAt) || 0,
            matched: Number(a.matched) || 0,
            skipped: Number(a.skipped) || 0,
          }
        : null,
  }
}

// ---------------------------------------------------------------------------
// Changes. Each takes the state and returns { state } with a NEW state, or
// { error } with words a reader can act on. The old state is never touched.
// ---------------------------------------------------------------------------

const fail = (error) => ({ error })
const touch = (state, now, patch) => ({ ...state, ...patch, updatedAt: now })
const countTitles = (state) => Object.keys(state.titles).length
const FULL = `Your list is full (${MAX_TITLES} titles). Remove one to add another.`

export function addTitle(state, meta, status = 'PLANNING', now = Date.now()) {
  const clean = cleanMeta(meta)
  if (!clean) return fail('This title could not be saved.')
  const had = state.titles[clean.id]
  if (!had && countTitles(state) >= MAX_TITLES) return fail(FULL)
  const entry = had
    ? { ...had, ...clean, updatedAt: now }
    : {
        ...clean,
        status: STATUS_SET.has(status) ? status : 'PLANNING',
        progress: 0,
        score: null,
        hidden: false,
        addedAt: now,
        updatedAt: now,
        seen: null,
      }
  return { state: touch(state, now, { titles: { ...state.titles, [clean.id]: entry } }), added: !had }
}

export function removeTitle(state, id, now = Date.now()) {
  const key = Number(id)
  if (!state.titles[key]) return { state }
  const { [key]: _gone, ...titles } = state.titles
  const lists = state.lists.map((list) =>
    list.ids.includes(key) ? { ...list, ids: list.ids.filter((n) => n !== key), updatedAt: now } : list
  )
  return { state: touch(state, now, { titles, lists }) }
}

export function setStatus(state, id, status, now = Date.now()) {
  const entry = state.titles[Number(id)]
  if (!entry) return fail('That title is not on your list.')
  if (!STATUS_SET.has(status)) return fail('Unknown status.')
  const next = { ...entry, status, updatedAt: now }
  return { state: touch(state, now, { titles: { ...state.titles, [entry.id]: next } }) }
}

/** Only the snapshot of what the reader was last shown; no event, no reorder. */
export function setSeen(state, id, seen) {
  const entry = state.titles[Number(id)]
  if (!entry) return { state }
  return { state: { ...state, titles: { ...state.titles, [entry.id]: { ...entry, seen: cleanSeen(seen) } } } }
}

/** A title's address moved (its section or slug): follow the list row. */
export function setPath(state, id, ns, slug) {
  const entry = state.titles[Number(id)]
  if (!entry || !SECTION_SET.has(ns) || !slugOk(slug)) return { state }
  if (entry.ns === ns && entry.slug === slug) return { state }
  const next = { ...entry, ns, slug, media: ns === 'anime' ? 'ANIME' : 'MANGA' }
  return { state: { ...state, titles: { ...state.titles, [entry.id]: next } } }
}

/**
 * Many titles at once, after the list rows load on /my-list: the snapshot
 * each one was shown, and its address when the row says it moved. One write
 * instead of one per title.   updates: [{ id, seen?, ns?, slug? }]
 */
export function applyRowUpdates(state, updates) {
  let next = state
  for (const u of updates) {
    if (u.ns && u.slug) next = setPath(next, u.id, u.ns, u.slug).state
    if (u.seen) next = setSeen(next, u.id, u.seen).state
  }
  return { state: next }
}

function checkName(state, name, exceptId) {
  const clean = cleanName(name)
  if (!clean) return { error: 'Give the list a name.' }
  if (clean.length > MAX_NAME) return { error: `Keep the name to ${MAX_NAME} characters or fewer.` }
  const lower = clean.toLowerCase()
  const clash = state.lists.find((l) => l.id !== exceptId && l.name.toLowerCase() === lower)
  if (clash) return { error: `You already have a list called "${clash.name}".` }
  return { name: clean }
}

const newListId = () => `l_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`

export function createList(state, name, now = Date.now(), id = newListId()) {
  if (state.lists.length >= MAX_LISTS) return fail(`You can have up to ${MAX_LISTS} lists.`)
  const checked = checkName(state, name)
  if (checked.error) return fail(checked.error)
  const list = { id, name: checked.name, createdAt: now, updatedAt: now, ids: [] }
  return { state: touch(state, now, { lists: [...state.lists, list] }), list }
}

export function renameList(state, listId, name, now = Date.now()) {
  const list = state.lists.find((l) => l.id === listId)
  if (!list) return fail('That list no longer exists.')
  const checked = checkName(state, name, listId)
  if (checked.error) return fail(checked.error)
  const lists = state.lists.map((l) => (l.id === listId ? { ...l, name: checked.name, updatedAt: now } : l))
  return { state: touch(state, now, { lists }) }
}

/** The list goes; every title in it stays on My list with its status. */
export function deleteList(state, listId, now = Date.now()) {
  if (!state.lists.some((l) => l.id === listId)) return fail('That list no longer exists.')
  return { state: touch(state, now, { lists: state.lists.filter((l) => l.id !== listId) }) }
}

/**
 * Put a title in a list, or take it out. A title that is not saved yet is
 * saved first (as PLANNING), because a list can only point at saved titles.
 */
export function toggleInList(state, listId, meta, now = Date.now()) {
  const list = state.lists.find((l) => l.id === listId)
  if (!list) return fail('That list no longer exists.')
  const id = Number(meta && meta.id)
  let next = state
  if (!next.titles[id]) {
    const added = addTitle(next, meta, 'PLANNING', now)
    if (added.error) return added
    next = added.state
  }
  const inList = list.ids.includes(id)
  const ids = inList ? list.ids.filter((n) => n !== id) : [...list.ids, id]
  const lists = next.lists.map((l) => (l.id === listId ? { ...l, ids, updatedAt: now } : l))
  return { state: touch(next, now, { lists }), inList: !inList }
}

/**
 * Undo a remove: put back the exact entry it was, and put it back into every
 * list it sat in that still exists. Used by the "Undo" after one tap removes.
 */
export function restoreTitle(state, entry, listIds = [], now = Date.now()) {
  const clean = cleanEntry(entry || {})
  if (!clean) return fail('That title could not be put back.')
  if (!state.titles[clean.id] && countTitles(state) >= MAX_TITLES) return fail(FULL)
  const back = new Set(listIds)
  const lists = state.lists.map((l) =>
    back.has(l.id) && !l.ids.includes(clean.id) ? { ...l, ids: [...l.ids, clean.id], updatedAt: now } : l
  )
  return { state: touch(state, now, { titles: { ...state.titles, [clean.id]: clean }, lists }) }
}

/** The ids of every list a title sits in. */
export const listsOf = (state, id) => state.lists.filter((l) => l.ids.includes(Number(id))).map((l) => l.id)

/**
 * Fold an AniList import into the list. AniList wins on status, progress and
 * score for a title the reader already has, because it is where they track.
 *
 *   rows  [{ meta, status, progress, score, hidden, lists:[names] }]
 *
 * Named lists are matched by name, ignoring case, and made when missing (up
 * to the cap). Returns the new state and what happened, in numbers.
 */
export function mergeImport(state, rows, user, now = Date.now()) {
  let next = state
  let added = 0
  let updated = 0
  let full = 0
  let listsMade = 0
  // AniList list names that could not become a list here (the 20-list cap).
  const listsSkipped = new Set()
  for (const row of rows) {
    const meta = cleanMeta(row.meta)
    if (!meta) continue
    const had = next.titles[meta.id]
    if (!had && countTitles(next) >= MAX_TITLES) {
      full++
      continue
    }
    const base = had ? { ...had, ...meta } : { ...meta, addedAt: now, seen: null }
    const entry = {
      ...base,
      status: STATUS_SET.has(row.status) ? row.status : had ? had.status : 'PLANNING',
      progress: clampProgress(row.progress),
      score: Number(row.score) > 0 ? Math.min(100, Number(row.score)) : had ? had.score : null,
      hidden: row.hidden === true,
      updatedAt: now,
    }
    next = { ...next, titles: { ...next.titles, [meta.id]: entry } }
    if (had) updated++
    else added++

    for (const raw of row.lists || []) {
      // AniList allows longer names than we do: cut to our limit. Two names
      // that become the same once cut share one list, so names stay unique.
      const name = cleanName(raw).slice(0, MAX_NAME).trim()
      if (!name) continue
      const lower = name.toLowerCase()
      let list = next.lists.find((l) => l.name.toLowerCase() === lower)
      if (!list) {
        const made = createList(next, name, now)
        if (made.error) {
          listsSkipped.add(lower)
          continue
        }
        next = made.state
        list = made.list
        listsMade++
      }
      if (list.ids.includes(meta.id)) continue
      next = {
        ...next,
        lists: next.lists.map((l) => (l.id === list.id ? { ...l, ids: [...l.ids, meta.id], updatedAt: now } : l)),
      }
    }
  }
  return { state: touch(next, now, {}), added, updated, full, listsMade, listsSkipped: listsSkipped.size }
}

export function noteImport(state, info, now = Date.now()) {
  return {
    state: touch(state, now, {
      anilist: {
        user: text(info.user, 40),
        importedAt: now,
        matched: Number(info.matched) || 0,
        skipped: Number(info.skipped) || 0,
      },
    }),
  }
}

// ---------------------------------------------------------------------------
// GA4 and our own counter. gtag is set up inline on every page
// (src/layouts/Base.astro), but a blocker can remove it, so every call is
// guarded. Nothing personal is sent: an AniList id, a section and a status,
// never a list name or a username.
//
// `title` is the title's public name. It goes to our own counter only, so
// the dashboard can say "Solo Leveling" instead of an id; GA4 gets exactly
// what it got before. What reaches our counter is decided by the allow-list
// in toOwnRow() (src/lib/own-count.js), never by what a caller passes.
// ---------------------------------------------------------------------------

export function track(name, params = {}) {
  const { title, ...ga } = params || {}
  try {
    if (typeof window !== 'undefined' && typeof window.gtag === 'function') {
      window.gtag('event', name, { page_type: location.pathname.split('/')[1] || 'home', ...ga })
    }
  } catch (e) {
    // Analytics must never break the list.
  }
  sendOwn(toOwnRow(name, params))
}

// ---------------------------------------------------------------------------
// The browser store. One per page. It reads localStorage once, writes after
// every change and listens for other tabs changing the same key.
// ---------------------------------------------------------------------------

/**
 * `storage` is window.localStorage in the browser, or any object with
 * getItem/setItem in a test. When storage is blocked (private mode, a strict
 * setting, a full disk) the list still works for this page, in memory, and
 * `persistent` is false so the page can say so.
 */
export function createStore(storage) {
  let persistent = true
  let state = emptyState()
  const listeners = new Set()

  function read() {
    let raw = null
    try {
      raw = storage ? storage.getItem(STORE_KEY) : null
      if (!storage) persistent = false
    } catch (e) {
      persistent = false
      return emptyState()
    }
    if (!raw) return emptyState()
    let parsed = null
    try {
      parsed = JSON.parse(raw)
    } catch (e) {
      parsed = null
    }
    const clean = sanitize(parsed)
    if (clean) return clean
    // Not a shape this page knows. Keep the raw text aside, never delete it,
    // and never overwrite an older copy already kept there.
    try {
      if (storage.getItem(BAD_KEY) === null) storage.setItem(BAD_KEY, raw)
    } catch (e) {
      // Nothing more to do: the fresh list still works in memory.
    }
    return emptyState()
  }

  function write() {
    if (!storage) return false
    try {
      storage.setItem(STORE_KEY, JSON.stringify(state))
      persistent = true
      return true
    } catch (e) {
      persistent = false
      return false
    }
  }

  const emit = () => {
    for (const fn of listeners) {
      try {
        fn(state)
      } catch (e) {
        // One broken listener must not stop the others.
      }
    }
  }

  /** Apply one change. Returns the change's result, plus `saved`. */
  function apply(result) {
    if (!result || result.error) return result
    state = result.state
    const saved = write()
    emit()
    return { ...result, saved }
  }

  state = read()

  return {
    get: () => state,
    get persistent() {
      return persistent
    },
    has: (id) => Boolean(state.titles[Number(id)]),
    entry: (id) => state.titles[Number(id)] || null,
    count: () => countTitles(state),
    subscribe(fn) {
      listeners.add(fn)
      return () => listeners.delete(fn)
    },
    /** Another tab changed the list: read it again and redraw. */
    reload() {
      state = read()
      emit()
    },
    add: (meta, status) => apply(addTitle(state, meta, status)),
    remove: (id) => apply(removeTitle(state, id)),
    setStatus: (id, status) => apply(setStatus(state, id, status)),
    setSeen: (id, seen) => apply(setSeen(state, id, seen)),
    setPath: (id, ns, slug) => apply(setPath(state, id, ns, slug)),
    applyRowUpdates: (updates) => apply(applyRowUpdates(state, updates)),
    createList: (name) => apply(createList(state, name)),
    renameList: (listId, name) => apply(renameList(state, listId, name)),
    deleteList: (listId) => apply(deleteList(state, listId)),
    toggleInList: (listId, meta) => apply(toggleInList(state, listId, meta)),
    mergeImport: (rows, user) => apply(mergeImport(state, rows, user)),
    noteImport: (info) => apply(noteImport(state, info)),
    restore: (entry, listIds) => apply(restoreTitle(state, entry, listIds)),
    /** Everything goes, including a kept copy of an old unreadable list. */
    clear() {
      try {
        if (storage) storage.removeItem(BAD_KEY)
      } catch (e) {
        // Blocked storage: there is nothing kept to remove anyway.
      }
      return apply({ state: emptyState() })
    },
  }
}

let shared = null

/** The page's one store, wired to localStorage and to other tabs. */
export function openStore() {
  if (shared) return shared
  let storage = null
  try {
    storage = window.localStorage
  } catch (e) {
    storage = null
  }
  shared = createStore(storage)
  try {
    window.addEventListener('storage', (event) => {
      if (event.key === STORE_KEY || event.key === null) shared.reload()
    })
  } catch (e) {
    // No window events (a test): nothing to listen to.
  }
  return shared
}
