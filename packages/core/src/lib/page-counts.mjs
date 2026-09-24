/**
 * How many pages a site would build under each of its gates: the counters
 * behind scripts/count-pages.mjs.
 *
 * A site's config lists its gates (`gates`), one per page type, as
 * { page, count, ...settings }. `count` names one counter below, and the
 * settings are the gate's thresholds from docs/PLAN.md section 2. Every
 * counter reads the catalog only. A gate that needs data the catalog does not
 * hold yet (credits, staff, airing dates: Phase 1) counts what the catalog can
 * prove and says so, or answers null.
 *
 * Pure: the records come in, a number goes out.
 */

/** The facts a title page can stand on. A title needs a cover and any one of its gate's list. */
const FACTS = {
  episodes: (r) => r.episodes > 0 || Boolean(r.nextEpisode) || (r.streamingEpisodes || []).length > 0,
  chapters: (r) => r.chapters > 0,
  volumes: (r) => r.volumes > 0,
  popularity: (r, gate) => r.popularity >= gate.popularity,
  adaptation: (r) => (r.relations || []).some((rel) => rel.relation === 'ADAPTATION'),
  anime: (r) => (r.relations || []).some((rel) => rel.type === 'ANIME' && rel.relation === 'ADAPTATION'),
  author: (r, gate, people) => (r.authors || []).some((a) => (people.get(a.name)?.works || 0) >= 2),
}

/** The relations that tie one story's entries together. */
const FRANCHISE = new Set(['PREQUEL', 'SEQUEL', 'SIDE_STORY', 'SPIN_OFF', 'ALTERNATIVE', 'PARENT', 'SUMMARY', 'COMPILATION'])
const LINEAGE = new Set([...FRANCHISE, 'ADAPTATION', 'SOURCE'])

/** Author name -> { works, popularity of the best-known one }, over the owned records. */
function peopleOf(owned) {
  const people = new Map()
  for (const r of owned) {
    for (const name of new Set((r.authors || []).map((a) => a.name))) {
      const person = people.get(name) || { works: 0, popularity: 0 }
      person.works++
      person.popularity = Math.max(person.popularity, r.popularity || 0)
      people.set(name, person)
    }
  }
  return people
}

function countBy(owned, keysOf) {
  const counts = new Map()
  for (const r of owned) for (const key of new Set(keysOf(r))) counts.set(key, (counts.get(key) || 0) + 1)
  return counts
}

const atLeast = (counts, min) => [...counts.values()].filter((n) => n >= min).length

/** Groups of ids joined by the given relations, each with the number of entries it holds. */
function groups(owned, relations, types) {
  const parent = new Map()
  const find = (id) => {
    while (parent.get(id) !== id) {
      parent.set(id, parent.get(parent.get(id)))
      id = parent.get(id)
    }
    return id
  }
  const add = (id) => parent.has(id) || parent.set(id, id)
  for (const r of owned) {
    add(r.id)
    for (const rel of r.relations || []) {
      if (!relations.has(rel.relation) || (types && !types.includes(rel.type))) continue
      add(rel.id)
      parent.set(find(rel.id), find(r.id))
    }
  }
  return countBy([...parent.keys()].map((id) => ({ id })), (entry) => [find(entry.id)])
}

export const COUNTERS = {
  /** Title pages: a cover and any one fact from `any`. */
  titles: (owned, gate) => {
    const people = gate.any.includes('author') ? peopleOf(owned) : null
    return owned.filter((r) => r.cover && gate.any.some((fact) => FACTS[fact](r, gate, people))).length
  },
  /** Titles with at least `min` episodes. */
  episodes: (owned, gate) => owned.filter((r) => r.episodes >= gate.min).length,
  /** Studios with at least `min` works. */
  studios: (owned, gate) => atLeast(countBy(owned, (r) => r.studios || []), gate.min),
  /** People (catalog author names) with `min` works, or one work at `popular` popularity. */
  people: (owned, gate) =>
    [...peopleOf(owned).values()].filter((p) => p.works >= gate.min || p.popularity >= gate.popular).length,
  /** Franchises (`lineage: true`: across media) with at least `min` entries. */
  franchises: (owned, gate) => atLeast(groups(owned, gate.lineage ? LINEAGE : FRANCHISE, gate.types), gate.min),
  /** AniList tags carried by at least `min` titles. */
  tags: (owned, gate) => atLeast(countBy(owned, (r) => r.tags || []), gate.min),
  /** Song artists (AnimeThemes) with at least `min` songs; null without themes.json. */
  artists: (owned, gate, { themes }) => {
    if (!themes) return null
    const songs = new Map()
    for (const r of owned) {
      for (const song of themes[r.id] || []) {
        for (const artist of song.artists || []) songs.set(artist, (songs.get(artist) || 0) + 1)
      }
    }
    return atLeast(songs, gate.min)
  },
  /** Pages built from credits.json or staff.json: nothing to count until Phase 1. */
  credits: () => null,
  /**
   * A Where site's gates. Its own build code counts them (src/where/compute.mjs,
   * handed in as extra.where by scripts/count-pages.mjs), so the count and the
   * pages built can never disagree. null when the sister data was not read.
   */
  where: (owned, gate, { where } = {}) => (where ? (where[gate.type] ?? null) : null),
}

/**
 * One gate's count, or null when its data does not exist yet. A gate with a
 * `kind` counts only that kind of the site's records (a site may own two).
 */
export function countGate(gate, owned, extra = {}) {
  const records = gate.kind ? owned.filter((r) => r.kind === gate.kind) : owned
  return COUNTERS[gate.count](records, gate, extra)
}
