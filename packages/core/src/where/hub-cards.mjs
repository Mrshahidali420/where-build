/**
 * The cards of the directory hubs (src/where/hubs.mjs directory()): one per
 * voice actor, staff member, studio, song artist and watch order, each with a
 * picture and the one or two facts a reader scans a list for.
 *
 *   [name, href, count, image, line, pop, year, span]
 *
 *   count  what the directory counts (roles, shows, songs, entries)
 *   image  a portrait or cover url, or for a studio up to three covers
 *   line   what they are best known for, in a few words
 *   pop    what "most popular" sorts by
 *   year   what "newest" sorts by: the latest year of their work
 *   span   "1963 to 2026", or ''
 *
 * A voice actor's card carries a ninth field, the language most of their
 * roles are in (voiceCard).
 *
 * Built from the page records (src/where/record-entities.mjs), so every card
 * names a page that exists. `popOf(href)` is a title's AniList popularity.
 *
 * Pure.
 */
import { baseRole, isCountedCrew, keyCreditOf } from './roles.mjs'

const best = (items, popOf, hrefOf = (x) => x.href) =>
  items.reduce((top, item) => (!top || (popOf(hrefOf(item)) || 0) > (popOf(hrefOf(top)) || 0) ? item : top), null)

const yearsOf = (list) => list.map((x) => x.year).filter(Boolean)

/** AniList's grey "no image" placeholder counts as no picture: the card draws initials instead. */
export const pictureOf = (url) => (!url || /\/default\.(jpg|png)$/i.test(url) ? '' : url)

/** "2013 to 2023", "2013", or '' when no year is known. */
export function spanOf(years) {
  if (!years.length) return ''
  const first = Math.min(...years)
  const last = Math.max(...years)
  return first === last ? String(first) : `${first} to ${last}`
}

/** A crew credit as a reader says it: "Director", not "Director (eps 1-12)". */
export const roleWords = baseRole

const newest = (list) => Math.max(0, ...yearsOf(list))

/**
 * The language most of a voice actor's roles are in ('Japanese', 'English'),
 * or '' with no roles. A tie goes to the language met first.
 */
export function mainLanguage(roles) {
  const counts = new Map()
  for (const r of roles) if (r.language) counts.set(r.language, (counts.get(r.language) || 0) + 1)
  return [...counts].reduce((top, entry) => (!top || entry[1] > top[1] ? entry : top), null)?.[0] || ''
}

/**
 * A voice actor: roles, the best-known main role, AniList favourites, and
 * (a ninth field) the language most of their roles are in, which the
 * "English dub" list filters on.
 */
export function voiceCard(p, popOf) {
  const roles = p.roles || []
  const mains = roles.filter((r) => r.role === 'MAIN')
  const top = best(mains.length ? mains : roles, popOf)
  return [p.name, p.voiceHref, p.counts.roles, pictureOf(p.image), top ? `${top.character.name} in ${top.title}` : '', p.favourites || 0, newest(roles), '', mainLanguage(roles)]
}

/**
 * A staff member: shows, and what they are known for, their key credit
 * (director, writer, creator, designer, composer) on their most watched show,
 * else their crew work, never a song they sang. "Most popular" adds up how
 * watched the shows they hold a key credit on are, so directors and creators
 * lead, not the singers a favourites count would put first.
 */
export function staffCard(p, popOf) {
  const items = (p.works || []).flatMap((group) => group.items)
  const withRole = (test) => items.map((item) => ({ item, role: (item.roles || []).find(test) })).filter((x) => x.role)
  const keys = withRole(keyCreditOf)
  const crew = withRole(isCountedCrew)
  const top = best(keys, popOf, (x) => x.item.href) || best(crew, popOf, (x) => x.item.href)
  const pop = [...new Set(keys.map((x) => x.item.href))].reduce((n, href) => n + (popOf(href) || 0), 0)
  const line = top ? `${roleWords(top.role)}, ${top.item.title}` : ''
  return [p.name, p.staffHref, p.counts.shows, pictureOf(p.image), line, pop, newest(items), spanOf(yearsOf(items))]
}

/** A studio: shows, the years it spans, its most watched show, three covers. */
export function studioCard(s, popOf) {
  const works = s.works || []
  const ranked = [...works].sort((a, b) => (popOf(b.href) || 0) - (popOf(a.href) || 0))
  const pop = works.reduce((n, w) => n + (popOf(w.href) || 0), 0)
  return [s.name, `/studio/${s.slug}`, works.length, ranked.slice(0, 3).map((w) => w.cover).filter(Boolean), ranked[0] ? `Best known for ${ranked[0].title}` : '', pop, newest(works), spanOf(yearsOf(works))]
}

/** A song artist: songs, the song of their most watched show, that show's cover. */
export function artistCard(a, popOf) {
  const songs = a.songs || []
  const top = best(songs, popOf, (s) => s.anime.href)
  const shows = new Map(songs.map((s) => [s.anime.href, popOf(s.anime.href) || 0]))
  const pop = [...shows.values()].reduce((n, v) => n + v, 0)
  const line = top ? `“${top.title}”, ${top.anime.title} ${top.type === 'OP' ? 'opening' : 'ending'}` : ''
  return [a.name, `/artist/${a.slug}`, songs.length, top?.anime.cover || '', line, pop, newest(songs.map((s) => s.anime)), spanOf(yearsOf(songs.map((s) => s.anime)))]
}

/** A watch order: entries, the years it spans, where to start, its most watched entry's pull. */
export function watchCard(w, popOf) {
  const entries = w.entries || []
  const main = entries.filter((e) => e.main)
  const first = (main.length ? main : entries)[0]
  const pop = Math.max(0, ...entries.map((e) => popOf(e.href) || 0))
  return [w.name, `/watch-order/${w.slug}`, entries.length, first?.cover || '', first ? `Start with ${first.title}` : '', pop, newest(entries), spanOf(yearsOf(entries))]
}

const FORMAT_ORDER = ['TV series', 'ONA', 'Movie', 'OVA', 'Special', 'TV short', 'Music video', 'Anime']
const FORMAT_MANY = { 'TV series': 'TV series', Movie: 'Movies', Special: 'Specials', OVA: 'OVAs', ONA: 'ONAs', 'TV short': 'TV shorts', 'Music video': 'Music videos', Anime: 'Other' }

/**
 * A season's title cards split by format (row[3], the format word), TV first:
 * [{ key, label, rows }], each list keeping its most-watched-first order.
 */
export function formatGroups(rows) {
  const groups = new Map()
  for (const row of rows) {
    const word = FORMAT_MANY[row[3]] ? row[3] : 'Anime'
    if (!groups.has(word)) groups.set(word, [])
    groups.get(word).push(row)
  }
  return FORMAT_ORDER.filter((word) => groups.has(word)).map((word) => ({
    key: word.toLowerCase().replace(/\s+/g, '-'),
    label: FORMAT_MANY[word],
    rows: groups.get(word),
  }))
}

const SEASON_RANK = { Winter: 1, Spring: 2, Summer: 3, Fall: 4 }

/** Where a title card's season word ("Fall 2026", row[5]) sits in time, 0 when it has none. */
const whenOf = (row) => {
  const m = /^(Winter|Spring|Summer|Fall)?\s*(\d{4})$/.exec(String(row[5] || '').trim())
  return m ? Number(m[2]) * 10 + (SEASON_RANK[m[1]] || 0) : 0
}

/** The `max` newest of a most-watched list of title cards, newest season first, the order among equals kept. */
export function newestRows(rows, max) {
  return rows
    .map((row, i) => ({ row, i, when: whenOf(row) }))
    .filter((x) => x.when)
    .sort((a, b) => b.when - a.when || a.i - b.i)
    .slice(0, max)
    .map((x) => x.row)
}
