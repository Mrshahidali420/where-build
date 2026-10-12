// A small made-up catalog for the template post types (social-types.test.js,
// social-render.test.js): enough records for every type to find a post.
import { buildData } from '../scripts/social/source.mjs'
import { NOW, HOUR, DAY, record, anime } from './social-kit.mjs'

const COVER = 'https://s4.anilist.co/file/anilistcdn/media/anime/cover/large'
const FACE = 'https://s4.anilist.co/file/anilistcdn/character/large'

const cast = (id, name) => ({ id, slug: `c-${id}`, name, image: `${FACE}/b${id}-x.png`, role: 'MAIN', voice: `Voice ${id}`, voiceEn: id % 2 ? `English ${id}` : null })

/** A finished, popular show with a rank, a score and a cast. */
export const classic = (over = {}) =>
  record({
    id: 100,
    slug: 'steel-harbor',
    title: 'Steel Harbor',
    episodes: 124,
    startYear: 2010,
    endYear: 2014,
    score: 88,
    popularity: 300000,
    source: 'ORIGINAL',
    ranks: [{ rank: 7, type: 'RATED', allTime: true, year: null, context: 'highest rated all time' }, { rank: 3, type: 'RATED', allTime: false, year: 2010, context: 'highest rated' }],
    characters: [cast(901, 'Mira Vale'), cast(902, 'Tobias Reed'), { ...cast(903, 'Extra'), role: 'SUPPORTING' }],
    cover: `${COVER}/bx100-a.jpg`,
    ...over,
  })

/** A show that has not started: on planning lists, with a start date. */
export const upcoming = (n, over = {}) =>
  record({
    id: 200 + n,
    slug: `soon-${n}`,
    title: `Soon ${n}`,
    status: 'NOT_YET_RELEASED',
    episodes: null,
    score: null,
    popularity: 9000 - n * 100,
    readers: { planning: 50000 - n * 1000 },
    startYear: 2026,
    startDate: [2026, 11, n + 1],
    startPrecision: 'day',
    season: 'WINTER',
    seasonYear: 2027,
    watchLinks: [],
    cover: `${COVER}/bx${200 + n}-a.jpg`,
    ...over,
  })

/** NOW is Monday 12 Oct 2026, 14:00 US Eastern. Next week is 19 to 25 Oct. */
const NEXT_MONDAY = NOW + 7 * DAY

export function sampleItems() {
  return [
    classic(),
    classic({ id: 101, slug: 'iron-coast', title: 'Iron Coast', episodes: 24, score: 80, popularity: 90000, ranks: [{ rank: 30, type: 'POPULAR', allTime: true, year: null, context: 'most popular all time' }], characters: [] }),
    anime(), // Frieren: episode 7 in three hours
    anime({ id: 3, slug: 'weekly-3', title: 'Weekly Show', nextEpisode: { number: 5, at: (NOW + 3 * DAY) / 1000 } }),
    ...Array.from({ length: 6 }, (_, n) => upcoming(n)),
    upcoming(7, { title: 'Month Only', startDate: [2026, 11, 1], startPrecision: 'month' }),
    upcoming(8, { title: 'Some Year', startDate: [2027, 1, 1], startPrecision: 'year' }),
  ]
}

export function sampleSchedule() {
  return [
    { mediaId: 2, episode: 7, at: (NOW + 3 * HOUR) / 1000 },
    { mediaId: 100, episode: 12, at: (NOW - 2 * HOUR) / 1000 }, // aired earlier today
    { mediaId: 3, episode: 5, at: (NOW + 3 * DAY) / 1000 },
    { mediaId: 200, episode: 1, at: (NOW + 20 * HOUR) / 1000 }, // a premiere tomorrow
    { mediaId: 201, episode: 1, at: (NEXT_MONDAY + DAY) / 1000 },
    { mediaId: 202, episode: 1, at: (NEXT_MONDAY + 2 * DAY) / 1000 },
    { mediaId: 203, episode: 1, at: (NEXT_MONDAY + 4 * DAY) / 1000 },
  ]
}

/** The data the types read, built the way the poster builds it. */
export function sampleData(now = NOW) {
  const items = sampleItems()
  return buildData(items, now, Object.fromEntries(items.map((i) => [i.id, i.slug])), sampleSchedule())
}

/** Loaded art in the shape a template is handed (no real picture needed to build the tree). */
export const fakeArt = (post) => ({
  hero: post.art?.hero ? { src: 'data:image/jpeg;base64,AA==', ratio: 0.71 } : null,
  thumbs: (post.art?.thumbs || []).map(() => ({ src: 'data:image/jpeg;base64,AA==', ratio: 0.71 })),
})

/** Every piece of text and every picture in a template tree. */
export function walk(node, found = { texts: [], images: [] }) {
  if (node === null || node === undefined || node === false) return found
  if (typeof node === 'string' || typeof node === 'number') {
    found.texts.push(String(node))
    return found
  }
  if (Array.isArray(node)) {
    for (const child of node) walk(child, found)
    return found
  }
  if (node.type === 'img') found.images.push(node.props)
  walk(node.props?.children, found)
  return found
}
