/**
 * The rules behind "Readers also look for" (data/boost-links.json).
 *
 * Search Console shows two kinds of page. Some already rank near the top
 * (sources); some sit just off the first page, at position 8 to 20 (targets).
 * A plain link from a source to a related target is the cheapest push there
 * is. This file decides which pairs qualify and what the link says; the
 * script scripts/build-boost-links.mjs fetches the data and writes the file.
 *
 * Everything here is pure (no fetch, no disk), so tests/boost-core.test.js
 * can check every rule with small made-up records.
 *
 * "Related" is decided only by catalog data, never by guesswork:
 * - a character and a title: the character appears in that title;
 * - two characters: both appear in the same title, and that title is not a
 *   crossover (Isekai Quartet puts Ram next to Sebas, but nobody who reads
 *   about Ram is looking for Sebas);
 * - two titles: the same title (its answer pages), or the same story in
 *   another form (an AniList adaptation, source, parent, prequel or sequel).
 * AniList's "similar" and "recommended" lists are left out on purpose: they
 * were the weak pairs in the September 2026 report.
 */
import { sectionOf, SECTIONS } from './section.mjs'
import { nameKey, storyName } from './namesakes.mjs'

export const RULES = {
  targetMinPos: 8,
  targetMaxPos: 20,
  targetMinImpr: 15,
  // A source ranks near the top, or already earns clicks from lower down.
  sourceMaxPos: 5,
  sourceMinImpr: 1,
  sourceMinClicks: 3,
  maxPerSource: 3,
  maxPerTarget: 3,
}

// The relations that make two titles one story. The same list picks.js uses.
export const SAME_STORY = ['ADAPTATION', 'SOURCE', 'PARENT', 'PREQUEL', 'SEQUEL']

// The sub-pages that exist under a character and under a title.
const CHARACTER_SUBS = new Set(['', 'buy'])
const TITLE_SUBS = new Set(['', 'free', 'like', 'buy', 'characters'])

/** Lowercase, no trailing slash, no query string. The same form boost-links.js looks up. */
export function cleanPath(path) {
  const bare = String(path || '').split(/[?#]/)[0].toLowerCase()
  return bare.length > 1 ? bare.replace(/\/+$/, '') : bare
}

/** A full URL or a path, as a clean path. */
export function pathOf(urlOrPath) {
  const text = String(urlOrPath || '')
  try {
    return cleanPath(new URL(text).pathname)
  } catch {
    return cleanPath(text)
  }
}

/**
 * What a path is: a character page, a title page, or one of their answer
 * pages. Anything else (the home page, a hub, /schedule) is null, because the
 * link block only lives on these pages.
 */
export function pageOf(path) {
  const parts = cleanPath(path).split('/').filter(Boolean)
  if (parts.length < 2 || parts.length > 3) return null
  const [folder, slug, sub = ''] = parts
  if (folder === 'character' && CHARACTER_SUBS.has(sub)) {
    return { type: 'character', section: 'character', slug, sub, base: `/character/${slug}` }
  }
  if (SECTIONS.includes(folder) && TITLE_SUBS.has(sub)) {
    return { type: 'title', section: folder, slug, sub, base: `/${folder}/${slug}` }
  }
  return null
}

// One row of a Search Console answer, whatever shape it came in: the API's
// `{ keys: [...] }`, or named fields.
const numberOf = (value) => (Number.isFinite(Number(value)) ? Number(value) : 0)
const rowsOf = (data) => (Array.isArray(data) ? data : data?.rows || [])

/**
 * Page rows (dimension "page") as a Map of path to { path, clicks, impr, pos }.
 * Two URLs that clean to one path (a trailing slash, a ?query) are merged,
 * with the position weighted by impressions.
 */
export function pagesFromGsc(data) {
  const pages = new Map()
  for (const row of rowsOf(data)) {
    const path = pathOf(row.keys ? row.keys[0] : row.page)
    if (!path) continue
    const impr = numberOf(row.impressions)
    const before = pages.get(path)
    if (!before) {
      pages.set(path, { path, clicks: numberOf(row.clicks), impr, pos: numberOf(row.position) })
      continue
    }
    const total = before.impr + impr
    pages.set(path, {
      path,
      clicks: before.clicks + numberOf(row.clicks),
      impr: total,
      pos: total ? (before.pos * before.impr + numberOf(row.position) * impr) / total : before.pos,
    })
  }
  return pages
}

/** Query + page rows as a Map of path to its biggest query { query, impr, clicks }. */
export function topQueries(data) {
  const best = new Map()
  for (const row of rowsOf(data)) {
    const query = row.keys ? row.keys[0] : row.query
    const path = pathOf(row.keys ? row.keys[1] : row.page)
    if (!query || !path) continue
    const found = { query: String(query), impr: numberOf(row.impressions), clicks: numberOf(row.clicks) }
    const now = best.get(path)
    if (!now || found.impr > now.impr || (found.impr === now.impr && found.clicks > now.clicks)) best.set(path, found)
  }
  return best
}

/** Pages just off the first page with real impressions. Only link-able page types. */
export function pickTargets(pages, rules = RULES) {
  return [...pages.values()].filter(
    (p) => pageOf(p.path) && p.pos >= rules.targetMinPos && p.pos <= rules.targetMaxPos && p.impr >= rules.targetMinImpr
  )
}

/** Pages Google already ranks near the top, or that earn clicks from lower down. */
export function pickSources(pages, rules = RULES) {
  return [...pages.values()].filter(
    (p) =>
      pageOf(p.path) &&
      ((p.pos > 0 && p.pos <= rules.sourceMaxPos && p.impr >= rules.sourceMinImpr) || p.clicks >= rules.sourceMinClicks)
  )
}

/**
 * A crossover: a title AniList ties to two or more other stories by their
 * characters (Isekai Quartet, Overlord and Re:Zero and Konosuba at once), and
 * mostly by that. Sharing one says nothing about the two characters.
 *
 * "Mostly" matters. Detective Conan also has nine character ties (Magic
 * Kaito, Lupin), but sixty-odd ties of its own story (films, side stories,
 * the manga), so it is a home, not a crossover. Isekai Quartet has four
 * character ties and one sequel.
 */
export function isCrossover(title) {
  const relations = title?.relations || []
  const others = new Set(relations.filter((r) => r.relation === 'CHARACTER').map((r) => r.id ?? r.title))
  const own = relations.filter((r) => r.relation !== 'CHARACTER').length
  return others.size >= 2 && others.size > own
}

const titlePathOf = (row) => `/${sectionOf(row)}/${row.slug}`

/**
 * Every page base related to a character, with the reason. `titles` maps a
 * title path to its full record; a title that could not be read adds only
 * the title page itself, never its cast.
 */
export function relatedToCharacter(person, titles) {
  const related = new Map()
  const add = (base, why) => {
    if (!related.has(base)) related.set(base, why)
  }
  for (const row of person?.appearsIn || []) {
    const path = titlePathOf(row)
    const title = titles.get(path)
    if (title && isCrossover(title)) continue
    add(path, `${person.name} is a character of ${row.title}`)
    for (const mate of title?.characters || []) {
      if (mate.slug && mate.slug !== person.slug) add(`/character/${mate.slug}`, `both are characters of ${row.title}`)
    }
  }
  return related
}

/** Every page base related to a title: its own pages, its cast, and the same story in another form. */
export function relatedToTitle(title, path) {
  const related = new Map([[path, `the same title: ${title.title}`]])
  for (const mate of title?.characters || []) {
    if (mate.slug) related.set(`/character/${mate.slug}`, `${mate.name} is a character of ${title.title}`)
  }
  for (const rel of title?.relations || []) {
    const item = rel.hit?.item
    if (!SAME_STORY.includes(rel.relation) || !item?.slug) continue
    const base = titlePathOf(item)
    if (!related.has(base)) related.set(base, `${rel.title} is the ${rel.relation.toLowerCase()} of ${title.title} (AniList relation)`)
  }
  return related
}

// Words a query carries that name no story: the question around the name.
const QUESTION_WORDS = new Set(
  ('a an and all age anime are birthday buy by chapter character characters does dub english episode ' +
    'figure free from full height how in is legally manga manhua manhwa merch name novel of old ' +
    'online read season tall the to va voice actor watch where who what wiki fandom does did list cast ' +
    'there going be will when release date next new last first ending end can get got').split(' ')
)

export const wordsOf = (text) => nameKey(text).split(' ').filter(Boolean)

/**
 * The query's words that are not the page's own names and not question words.
 * A word inside one of the names counts as the name: "zhou gong jin" is
 * Gongjin Zhou typed with a space.
 */
export function leftoverWords(query, names) {
  const own = names.flatMap(wordsOf)
  const exact = new Set(own)
  const inName = (w) => w.length >= 3 && own.some((o) => o.includes(w))
  return wordsOf(query).filter((w) => !exact.has(w) && !QUESTION_WORDS.has(w) && !inName(w))
}

/** The first story whose name shares a word with the leftover query words. */
export function seriesNamed(leftover, seriesTitles) {
  if (!leftover.length) return null
  const wanted = new Set(leftover)
  return seriesTitles.find((title) => wordsOf(title).some((w) => wanted.has(w))) || null
}

/**
 * True when the query is about another story than the page: two or more
 * words left over, none of them in the page's stories or its own text.
 * "cyberpunk edgerunners characters kiwi" on the Made in Abyss Kiwi is the case.
 */
export function queryMismatch(query, names, seriesTitles, ownText = '') {
  const leftover = leftoverWords(query, names)
  if (leftover.length < 2) return false
  if (seriesNamed(leftover, seriesTitles)) return false
  const text = new Set(wordsOf(ownText))
  return !leftover.some((w) => text.has(w))
}

// Long names are cut to what people type. Past this many letters the leading
// words, or the words the query shares with the name, stand in for it.
const SHORT_TITLE_MAX = 32

// "BANANA FISH", "ONE PIECE" and "GANGSTA." are AniList's styling, not how a
// sentence spells them. A name with no lowercase letter at all is written as
// a name, word by word; in a mixed name only a shouted word of four letters
// or more is. Short ones (SAO) and mixed words (SPY×FAMILY) stay as they are.
const unshout = (text) => {
  const allCaps = !/\p{Ll}/u.test(text)
  const shout = allCaps ? /^([A-Z])([A-Z]{2,})[.!]?$/ : /^([A-Z])([A-Z]{3,})[.!]?$/
  return text
    .split(' ')
    .map((word) => {
      const shouted = word.match(shout)
      return shouted ? shouted[1] + shouted[2].toLowerCase() : word
    })
    .join(' ')
}

/**
 * The part of a story's name people search: "Re:ZERO" for "Re:ZERO -Starting
 * Life in Another World-", "Magi" for "Magi: The Labyrinth of Magic". A name
 * still too long gives way to the longest run of its words the query also
 * has ("Slime" for "That Time I Got Reincarnated as a Slime Season 2").
 */
function pickShort(title, query) {
  const full = String(title || '').trim()
  const main = storyName(full)
  if (main.length <= SHORT_TITLE_MAX) return main
  const inQuery = new Set(wordsOf(query))
  const words = main.split(/\s+/)
  let best = []
  let run = []
  for (const word of words) {
    const key = nameKey(word)
    if (key && inQuery.has(key)) {
      run = [...run, word]
      if (run.length > best.length) best = run
    } else {
      run = []
    }
  }
  const picked = best.join(' ').replace(/[,.;]+$/, '')
  if (picked.replace(/[^\p{L}\p{N}]/gu, '').length >= 4) return picked
  return words.slice(0, 4).join(' ').replace(/[,.;]+$/, '')
}

export const shortTitle = (title, query = '') => unshout(pickShort(title, query))

/**
 * The link text for a target, built from its top query but always spelled
 * the way the page spells it. Never the question ("how old is ..."), only
 * the thing asked about:
 * - a character: the name, plus the story in brackets when the query names
 *   it ("Frederica Baumann (Re:ZERO)");
 * - a title page: the short name plus what the page answers
 *   ("Banana Fish characters", "Where to watch Gangsta").
 */
export function anchorFor({ page, name, names = [], seriesTitles = [], query = '', word = '', verb = '' }) {
  if (page.type === 'character') {
    const story = seriesNamed(leftoverWords(query, [name, ...names]), seriesTitles)
    const base = story ? `${name} (${shortTitle(story, query)})` : name
    return page.sub === 'buy' ? `${name} merch` : base
  }
  const short = shortTitle(name, query)
  switch (page.sub) {
    case 'characters':
      return `${short} characters`
    case 'free':
      return `Where to ${verb || 'read'} ${short}`
    case 'like':
      return `${word ? word[0].toUpperCase() + word.slice(1) : 'Titles'} like ${short}`
    case 'buy':
      return `${short} merch`
    default:
      return word ? `${short} ${word}` : short
  }
}

/**
 * The pairs that make the file. Biggest targets first (on a tie, the one
 * nearer page one, since it needs the smaller push); each source keeps
 * `maxPerSource` links and each target gets `maxPerTarget` sources at most.
 * Among sources for one target, the one with the most clicks wins, then the
 * best position. Candidates already cleared of pairs the source links today.
 *
 * Returns `{ "<source path>": [{ path, anchor }] }`, ordered by source path so
 * the file diffs cleanly month to month.
 */
export function choosePairs(candidates, rules = RULES) {
  const order = [...candidates].sort(
    (a, b) =>
      b.target.impr - a.target.impr ||
      a.target.pos - b.target.pos ||
      b.source.clicks - a.source.clicks ||
      a.source.pos - b.source.pos ||
      (a.source.path < b.source.path ? -1 : a.source.path > b.source.path ? 1 : 0) ||
      (a.target.path < b.target.path ? -1 : a.target.path > b.target.path ? 1 : 0)
  )
  const perSource = new Map()
  const perTarget = new Map()
  const seen = new Set()
  const kept = []
  for (const pair of order) {
    const key = `${pair.source.path} ${pair.target.path}`
    if (pair.source.path === pair.target.path || seen.has(key)) continue
    const fromSource = perSource.get(pair.source.path) || 0
    const toTarget = perTarget.get(pair.target.path) || 0
    if (fromSource >= rules.maxPerSource || toTarget >= rules.maxPerTarget) continue
    seen.add(key)
    perSource.set(pair.source.path, fromSource + 1)
    perTarget.set(pair.target.path, toTarget + 1)
    kept.push(pair)
  }
  const links = {}
  for (const source of [...new Set(kept.map((p) => p.source.path))].sort()) {
    links[source] = kept
      .filter((p) => p.source.path === source)
      .map((p) => ({ path: p.target.path, anchor: p.anchor }))
  }
  return { links, kept }
}

/* ------------------------------------------------------ the home page block */

// "Popular characters right now" on the home page (data/home-boost.json).
// Most targets have no page ranking near the top that could link to them
// (266 of 318 in September 2026, Anos Voldigoad the biggest). The home page
// is the strongest page on the site, so one plain link from it is the push
// those pages cannot get anywhere else. Same script, same monthly refresh.
export const HOME_MAX = 20

/** How near page one a position is: 1 at the top of the target range, 1/13 at its bottom. */
export function closeness(pos, rules = RULES) {
  const span = rules.targetMaxPos + 1 - rules.targetMinPos
  return Math.min(1, Math.max(0, (rules.targetMaxPos + 1 - pos) / span))
}

/** Impressions times closeness: the most searched first, and of two alike the one nearer page one. */
export const homeScore = (page, rules = RULES) => page.impr * closeness(page.pos, rules)

/**
 * The targets the home block links, best first. The block is headed "Popular
 * characters", so only a character's own page gets in: a cast list or a title
 * page read as "Alya ... characters / Anime" there. A target that got a
 * "Readers also look for" link this month already has its push, so it gives
 * its place to one that has none. `linked` is a Set of those target paths.
 */
export function rankHomeTargets(targets, linked = new Set(), rules = RULES) {
  return targets
    .filter((t) => /^\/character\/[^/]+$/.test(t.path) && !linked.has(t.path))
    .map((t) => ({ ...t, score: homeScore(t, rules) }))
    .sort((a, b) => b.score - a.score || b.impr - a.impr || (a.path < b.path ? -1 : a.path > b.path ? 1 : 0))
}

/**
 * AniList's smaller copy of a portrait or a cover. Only the folder changes,
 * never the file name. AniList's grey placeholder is no face at all, so it
 * gives an empty string and the row goes without a picture.
 */
export function smallImage(url) {
  const text = String(url || '')
  if (!text || /\/default\.[a-z]+$/i.test(text)) return ''
  return text.replace('/character/large/', '/character/medium/').replace('/cover/large/', '/cover/medium/')
}

// The small text under a name on the home page wraps to two lines at most.
const HOME_STORY_MAX = 40

/**
 * A story's name for the home block: the full name when it fits ("Cyberpunk:
 * Edgerunners", which the anchor rule would cut to "Cyberpunk"), else the name
 * up to its subtitle ("The Misfit of Demon King Academy"), else its first
 * whole words and an ellipsis. Never a cut mid-word.
 */
export function storyLabel(title) {
  const full = unshout(String(title || '').trim())
  if (full.length <= HOME_STORY_MAX) return full
  const main = storyName(full)
  if (main.length <= HOME_STORY_MAX) return main
  return `${main.slice(0, HOME_STORY_MAX + 1).replace(/\s+\S*$/, '').replace(/[\s,.;:!?-]+$/, '')}…`
}

/**
 * One row of the home block, in the words people search, split in two: the
 * name, and the story in small text. A character's story is the one its top
 * query names, else the one it is best known from ("Anos Voldigoad", "The
 * Misfit of Demon King Academy"). A title page is its link text, with the
 * section word under it ("Banana Fish characters", "Anime").
 */
export function homeItemFor({ path, page, name, names = [], seriesTitles = [], query = '', word = '', verb = '', image = '' }) {
  const small = smallImage(image)
  const withImage = (item) => (small ? { ...item, image: small } : item)
  if (page.type === 'character') {
    const story = seriesNamed(leftoverWords(query, [name, ...names]), seriesTitles) || seriesTitles[0] || ''
    return withImage({
      path,
      name: page.sub === 'buy' ? `${name} merch` : name,
      story: storyLabel(story),
    })
  }
  return withImage({
    path,
    name: page.sub ? anchorFor({ page, name, query, word, verb }) : shortTitle(name, query),
    story: word ? word[0].toUpperCase() + word.slice(1) : '',
  })
}

/**
 * The page's HTML without its own "Readers also look for" block (marked
 * `data-boost`), so this month's links never count as links the page had.
 */
export function withoutBoostBlock(html) {
  return String(html || '').replace(/<section\b[^>]*\bdata-boost\b[\s\S]*?<\/section>/gi, '')
}

/**
 * True when the HTML already carries a link to this path: a relative link, or
 * an absolute one on `origin` (the site's own address) when it is given.
 */
export function linksTo(html, path, origin = '') {
  const text = withoutBoostBlock(html)
  const clean = cleanPath(path)
  const escaped = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const pattern = new RegExp(`href=["'](?:${escaped(origin)})?${escaped(clean)}/?["'#?]`, 'i')
  return pattern.test(text)
}
