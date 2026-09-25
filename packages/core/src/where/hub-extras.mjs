/**
 * The mood and "anime like X" hubs a Where build writes into
 * data/where-hubs.json (src/where/outputs.mjs): each page's rows and its own
 * opening words, from the title records that have a page, so every row names
 * a page that exists.
 *
 * Pure.
 */
import { formatInSentence, plural } from './words.mjs'

const lower = (list) => list.map((word) => word.toLowerCase())

/** "a", "a and b", "a, b and c". */
export function listWords(words) {
  if (words.length <= 1) return words[0] || ''
  return `${words.slice(0, -1).join(', ')} and ${words.at(-1)}`
}

/**
 * The moods that passed their gate: { moods: { slug: page }, moodIndex: [...] }.
 * cardRow is outputs.mjs's own grid row, so a mood grid is drawn like a genre's.
 */
export function moodHubs(moods, recordOf, cardRow) {
  const pages = {}
  const index = []
  for (const { mood, items } of moods) {
    const rows = items.map((item) => recordOf.get(item.id)).filter(Boolean).map(cardRow)
    pages[mood.slug] = { slug: mood.slug, title: mood.title, ask: mood.ask, intro: mood.intro, rows }
    index.push({ slug: mood.slug, title: mood.title, ask: mood.ask, count: rows.length, covers: rows.slice(0, 3).map((row) => row[2]) })
  }
  return { moods: pages, moodIndex: index }
}

/**
 * Up to three of a show's strongest tags that say something new: a tag that
 * repeats a genre, or shares a word with a tag already taken ("Urban" after
 * "Urban Fantasy"), is skipped.
 */
function distinctTags(tags, genres, max = 3) {
  const taken = []
  const words = new Set(genres.map((g) => g.toLowerCase()))
  for (const tag of tags.slice(0, 8)) {
    if (taken.length >= max) break
    const own = tag.toLowerCase().split(/[\s-]+/)
    if (words.has(tag.toLowerCase()) || own.some((w) => words.has(w))) continue
    taken.push(tag)
    for (const w of own) words.add(w)
  }
  return taken
}

/**
 * The opening of one like page, from its own facts, so no two read the same:
 * what the show is, what it is made of, and how the list was chosen.
 */
export function likeIntro(r, rows) {
  const what = formatInSentence(r.format)
  const studio = r.studios?.[0]?.name
  const genres = lower((r.genres || []).slice(0, 3))
  const tags = lower(distinctTags(r.tags || [], r.genres || []))
  const recs = rows.filter((row) => row.why === 'rec').length
  const matches = rows.length - recs
  const lead =
    `${r.title} is ${r.startYear ? `a ${r.startYear} ${what}` : `${/^[AEIOU]/i.test(what) ? 'an' : 'a'} ${what}`}${studio ? ` by ${studio}` : ''}` +
    (genres.length ? ` that mixes ${listWords(genres)}` : '') +
    (tags.length ? `, with ${listWords(tags)} at its core` : '') +
    '.'
  const how = [
    recs ? `The first ${plural(recs, 'show')} ${recs === 1 ? 'is' : 'are'} what AniList members recommend most to people who finished ${r.title}` : '',
    matches ? `${recs ? 'the other' : 'All'} ${plural(matches, 'show')} share at least two of its genres, or a genre and its strongest tags` : '',
  ].filter(Boolean)
  return `${lead} If you want more of the same, these ${plural(rows.length, 'anime', 'anime')} come closest. ${how.join('; ')}. Each one opens its own episode dates, voice cast and staff.`
}

/** Why one row is on a like page, in a few words under its cover. */
function whyOf(row) {
  if (row.why === 'rec') return 'Recommended by AniList fans'
  const shared = [...row.genres.slice(0, 2), ...row.tags.slice(0, 1)]
  return shared.length ? `Also ${listWords(shared)}` : 'A close match'
}

/**
 * The like pages: { "<slug>": { slug, title, href, cover, intro, rows } },
 * each row { title, href, cover, meta, why }. A list that lost rows to titles
 * without a record (none should) keeps only what is left.
 */
export function likeHubs(likes, recordOf, cardRow) {
  const pages = {}
  for (const [id, list] of likes) {
    const r = recordOf.get(id)
    if (!r) continue
    const rows = list
      .map((row) => {
        const t = recordOf.get(row.id)
        if (!t) return null
        const [title, href, cover, format] = cardRow(t)
        return { title, href, cover, meta: [format, t.startYear].filter(Boolean).join(', '), why: whyOf(row), kind: row.why }
      })
      .filter(Boolean)
    pages[r.slug] = {
      slug: r.slug,
      title: r.title,
      href: `/anime/${r.slug}`,
      cover: r.cover,
      year: r.startYear || null,
      intro: likeIntro(r, list),
      rows,
    }
  }
  return pages
}
