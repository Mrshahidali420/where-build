// Shared fixtures for the Facebook Page poster tests (social*.test.js).
import { memoryStore } from '../scripts/social/ledger.mjs'
import { run } from '../scripts/social/post.mjs'
import { toCandidate, BLOCKED_TAGS } from '../scripts/social/source.mjs'

export const NOW = Date.UTC(2026, 9, 12, 18, 0) // 14:00 ET
export const HOUR = 3_600_000
export const DAY = 24 * HOUR
export const BLOCKED = [...BLOCKED_TAGS]

export const record = (over = {}) => ({
  kind: 'anime',
  id: 1,
  slug: 'solo-leveling',
  title: 'Solo Leveling',
  country: 'JP',
  format: 'TV',
  status: 'FINISHED',
  startYear: 2024,
  endYear: 2024,
  chapters: null,
  episodes: 12,
  studios: ['A-1 Pictures'],
  score: 84,
  popularity: 200000,
  genres: ['Action', 'Fantasy'],
  tags: ['Dungeon'],
  cover: 'https://s4.anilist.co/file/anilistcdn/media/manga/cover/large/bx1.jpg',
  readLinks: [],
  watchLinks: [
    { site: 'Crunchyroll', url: 'https://crunchyroll.com/x', language: 'English' },
    { site: 'Laftel', url: 'https://laftel.net/x', language: 'Korean' },
  ],
  recIds: [],
  updatedAt: (NOW - DAY) / 1000,
  ...over,
})

export const anime = (over = {}) =>
  record({
    kind: 'anime',
    id: 2,
    slug: 'frieren-2',
    title: 'Frieren',
    country: 'JP',
    format: 'TV',
    status: 'RELEASING',
    chapters: null,
    episodes: 28,
    studios: ['Madhouse'],
    readLinks: [],
    watchLinks: [{ site: 'Crunchyroll', url: 'https://crunchyroll.com/x', language: null }],
    nextEpisode: { number: 7, at: (NOW + 3 * HOUR) / 1000 },
    ...over,
  })

/** A record as a candidate, its own slug standing in for the live page list. */
export const cand = (item, upcoming) => toCandidate(item, { [item.id]: item.slug }, upcoming)

// --- the whole run ------------------------------------------------------

export const pools = () => ({
  new: [cand(anime())],
  old: [{ ...cand(record()), recs: [{ title: 'Tower of God' }, { title: 'Omniscient Reader' }] }],
})

export function harness(env, graph) {
  const text = []
  const store = memoryStore()
  const base = {
    env,
    now: NOW,
    rng: () => 0,
    loadPools: async () => ({ pools: pools(), source: 'test' }),
    store,
    makeGraph: () => graph,
    summary: (t) => text.push(t),
    sleep: async () => {},
    blockedTags: BLOCKED,
  }
  /** go() is the plain run; run(over) swaps some of what the run is given. */
  return { store, text, go: () => run(base), run: (over = {}) => run({ ...base, ...over }) }
}
