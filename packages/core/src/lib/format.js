// Pure formatting helpers. NOTHING in this file loads the catalog, so it is
// safe for the Worker to import at request time. Anything that needs the
// whole catalog lives in catalog.js and is build-time only.
import { PLATFORMS, FALLBACK } from './platforms.js'
import { LOGOS } from './platform-logos.js'
import { sectionOf } from './section.mjs'

export const platform = (site) => PLATFORMS[site] || FALLBACK

/** Format labels a reader would actually say out loud. */
const FORMAT_WORDS = {
  KR: 'manhwa',
  CN: 'manhua',
  JP: 'manga',
  TW: 'manhua',
}
export const formatWord = (item) => (item.kind === 'novel' ? 'novel' : FORMAT_WORDS[item.country] || 'comic')

const STATUS_WORDS = {
  FINISHED: 'Finished',
  RELEASING: 'Still releasing',
  NOT_YET_RELEASED: 'Not out yet',
  CANCELLED: 'Cancelled',
  HIATUS: 'On hiatus',
}
export const statusWord = (status) => STATUS_WORDS[status] || 'Unknown'

// AniList character bios use a tiny markdown: __bold__, _italic_,
// [name](url) links and ~!spoiler!~ blocks. Render them as safe HTML.
// A bio that was cut mid-sentence (older data) loses its last fragment.
const wholeSentences = (text) => {
  const t = String(text).trim()
  if (/[.!?"'’”)\]]$/.test(t)) return t
  const end = Math.max(t.lastIndexOf('. '), t.lastIndexOf('.\n'), t.lastIndexOf('\n\n'))
  return end > 0 ? t.slice(0, end + 1) : t
}

export const bioHtml = (text) => {
  const safe = wholeSentences(text)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  return safe
    .replace(/~!([\s\S]*?)!~/g, '')
    .replace(/\[([^\]]+)\]\((https?:[^)\s]+)\)/g, '$1')
    .replace(/__([^_\n]+)__/g, '<b>$1</b>')
    .replace(/(^|[\s(])_([^_\n]+)_(?=[\s:.,)]|$)/gm, '$1<i>$2</i>')
    .split(/\n{2,}/)
    .map((para) => `<p>${para.trim().replace(/\n/g, '<br>')}</p>`)
    .join('')
}

// The same bio as plain text, for meta descriptions and structured data.
export const bioText = (text) =>
  bioHtml(text).replace(/<\/p><p>/g, ' ').replace(/<br>/g, ' ').replace(/<[^>]+>/g, '')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim()

export const truncate = (text, length) =>
  !text ? '' : text.length <= length ? text : `${text.slice(0, length).replace(/\s+\S*$/, '')}…`

/**
 * How tall a character is, pulled out of the AniList bio.
 *
 * People search "how tall is X" all day, and the answer is already sitting in
 * the text we store. AniList writers mark it with bold markers, but they are
 * not consistent: the colon sits inside the markers on some records and
 * outside on others, the space before "cm" goes missing, and a growing
 * character is given a range. All of those shapes are the same fact.
 *
 * Returns a short clean string such as "170 cm (5'7\")", or '' when the bio
 * says nothing about height.
 */
export function parseHeight(description) {
  const text = String(description || '')
  // All of these say the same thing, and all of them are in the data:
  //   __Height:__ 170 cm      __Height__: 170 cm
  //   **Height:** 170 cm      **Height**: 170 cm
  //   __Initial Height:__ 168cm      __Height (2045-2049):__ 138 - 155 cm
  const found =
    text.match(
      /(?:__|\*\*)\s*(?:[a-z]+\s+)?height(?![a-z])[^_*\n]{0,24}(?:__|\*\*)\s*:?\s*([^\n]{1,60})/i
    ) ||
    // Some writers use no bold at all. Only a line that STARTS with the word
    // is trusted, so the word "height" inside a sentence is never mistaken
    // for a fact.
    text.match(/(?:^|\n)\s*height\s*:\s*([^\n]{1,60})/i)
  if (!found) return ''

  let value = found[1]
    .replace(/~!.*$/, '')       // a spoiler marker ends the fact
    .replace(/<[^>]*>/g, '')
    .replace(/\s+/g, ' ')
    .trim()

  // Stop at the next fact when the writer put two on one line.
  value = value.split(/\s+(?:__|\*\*)/)[0].trim()
  // A trailing separator left over from the cut.
  value = value.replace(/[;,.\-–—\s]+$/, '').trim()
  // "168cm" is the same as "168 cm".
  value = value.replace(/(\d)\s*(cm|mm|m|ft|in|kg)\b/gi, '$1 $2')

  // A height with no digit in it is not a height.
  if (!/\d/.test(value)) return ''
  if (value.length > 48) return ''
  return value
}

// ---------------------------------------------------------------------------
// The fact lines at the top of an AniList bio, as a table.
//
// Writers open a bio with lines such as `__Height:__ 170 cm` and
// `__Affiliation:__ Public Safety`. Printed as prose they read as a jumble of
// bold labels above the story; as a table they answer "what is X's rank" at a
// glance, the way the pages that outrank us show them.

const FACT_MAX = 8
const FACT_VALUE_MAX = 120
const FACT_LABEL_MAX = 30

// One fact in all four shapes the data uses:
//   __Label:__ value   **Label:** value   __Label__: value   **Label**: value
// The value runs until the next fact on the same line, or the end of the line.
// Bold text inside a value WITHOUT a colon is part of that value.
const FACT_RE = /(__|\*\*)\s*([^_*\n:]{1,40}?)\s*(:?)\s*\1\s*(:?)\s*([\s\S]*?)(?=\s*(?:__|\*\*)[^_*\n:]{1,40}?\s*(?::\s*(?:__|\*\*)|(?:__|\*\*)\s*:)|$)/g

// Several spellings of one label. The first one met in a bio is kept.
const FACT_ALIASES = {
  affiliations: 'Affiliation',
  ability: 'Abilities',
  job: 'Occupation',
  occupations: 'Occupation',
  skill: 'Skills',
  weapon: 'Weapons',
  'birth place': 'Birthplace',
  'place of birth': 'Birthplace',
  'date of birth': 'Birthday',
  'birth date': 'Birthday',
  birthdate: 'Birthday',
  'relative(s)': 'Relatives',
  relative: 'Relatives',
  'hair colour': 'Hair Color',
  'eye colour': 'Eye Color',
}
// When a bio holds more than FACT_MAX facts, these are kept first: the ones
// people search after a character's name. Lower case, most wanted first.
const FACT_PRIORITY = [
  'height', 'age', 'birthday', 'occupation', 'affiliation', 'position', 'rank',
  'race', 'species', 'team', 'class', 'school', 'grade', 'nationality', 'abilities',
]
// Labels that head a note, not a fact.
const NOT_FACTS = new Set(['note', 'notes', 'warning', 'spoiler', 'spoilers', 'source', 'sources'])
const SMALL_WORDS = new Set(['of', 'and', 'or', 'in', 'the', 'a', 'an', 'to', 'for', 'at', 'on'])

const titleCase = (label) =>
  label
    .split(/\s+/)
    .map((word, i) => {
      if (/^[A-Z0-9]{2,}$/.test(word)) return word // an acronym such as MBTI
      const lower = word.toLowerCase()
      if (i > 0 && SMALL_WORDS.has(lower)) return lower
      return lower.replace(/^([^a-z]*)([a-z])/, (_, lead, first) => lead + first.toUpperCase())
    })
    .join(' ')

const factLabel = (raw) => {
  const tidy = raw.replace(/\s+/g, ' ').trim()
  return FACT_ALIASES[tidy.toLowerCase()] || titleCase(tidy)
}

const factValue = (raw) =>
  raw
    .replace(/\[([^\]]*)\]\([^)\s]*\)/g, '$1') // [text](url) -> text
    .replace(/https?:\/\/\S+/g, '')             // a bare link says nothing in a table
    .replace(/<[^>]*>/g, ' ')                   // "17<br>170cm" is two words, not one
    .replace(/(__|\*\*)/g, '')
    .replace(/(^|[\s(])[_*]([^_*\n]+)[_*](?=[\s:.,)]|$)/g, '$1$2') // _italic_, *italic*
    .replace(/\s+/g, ' ')
    .replace(/^[\s:;,\-–—]+|[\s;,\-–—]+$/g, '')
    .trim()

// A value that is really the start of the story: a line break with text after
// it, or a sentence ending then another starting ("Superhero. He fights...").
// A word of three or more small letters before the stop, so "Mr. Monier" and
// "Vol. 3" are still facts.
const looksLikeProse = (raw, value) =>
  /<br\s*\/?>\s*\S/i.test(raw) || /[a-z]{3,}[.!?]\s+[A-Z][a-z]/.test(value)

// A label starts with a letter or a digit. "(Kanji" is the tail of the value
// before it, cut off by a bold marker.
const goodLabel = (raw) => /^[\p{L}\p{N}]/u.test(raw.trim())

/** Every fact on one line, or null when the line is not a fact line. */
function factsOnLine(line) {
  const text = line.trim()
  if (!/^(__|\*\*)[^_*\n]{1,40}?(:\s*\1|\1\s*:)/.test(text)) return null
  const found = []
  for (const m of text.matchAll(FACT_RE)) {
    // A colon inside or right after the markers is what makes it a label.
    if (!m[3] && !m[4]) continue
    if (goodLabel(m[2])) {
      found.push({ rawLabel: m[2], rawValue: m[5] })
    } else if (found.length) {
      // `__Name:__ Foo __(Kanji:__ bar)` is one fact: "Foo (Kanji: bar)".
      const last = found[found.length - 1]
      found[found.length - 1] = { ...last, rawValue: `${last.rawValue} ${m[0]}` }
    } else {
      return null
    }
  }
  return found.length ? found : null
}

// Letters and digits only, so "183 cm." and "183cm" count as the same value.
const squash = (text) => String(text).toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '')

/**
 * The leading `__Label:__ value` lines of an AniList bio.
 *
 * Returns `{ facts, bio }`:
 *   facts  [{ label, value }] in the bio's order, plain text, at most
 *          FACT_MAX (FACT_PRIORITY labels first when there are more).
 *   bio    the description without the lines whose facts all made the table,
 *          so the page never prints the same fact twice.
 *
 * A fact is left out (and its line stays in the bio) when its value holds a
 * spoiler, reads like prose, or runs longer than a table cell should. A label
 * with no value is never a fact; its line leaves the bio unless it heads a
 * paragraph. Only the block at the very top counts: the first line of prose
 * ends it, so a label deep in the story is never lifted out of context.
 *
 * `own` maps a lower-case label to the value the page already shows from the
 * character record (`{ age: '17', height: '170 cm' }`; `height` covers every
 * label with "height" in it). Such a line is never a fact: it leaves the bio
 * only when it says exactly what the record says, otherwise it stays, so
 * "17 (Part 1), 20 (Part 2)" is not lost behind a record's "17".
 *
 * Each fact also carries `values`: the separate values merged into `value`
 * ("Affiliation" and "Affiliations" lines), never split on commas.
 * Pure, and safe in the Worker.
 */
export function parseFacts(description, { own = {} } = {}) {
  const text = String(description || '')
  const lines = text.split('\n')
  const found = []            // { label, value, values, lines: [line index] }
  const header = []           // indexes of the fact lines at the top
  const blocked = new Set()   // lines holding something the table cannot show
  const owned = Object.fromEntries(
    Object.entries(own).filter(([, v]) => v != null && String(v).trim()).map(([k, v]) => [k.toLowerCase(), squash(v)])
  )
  const ownedOf = (key) => (key in owned ? owned[key] : /height/.test(key) && 'height' in owned ? owned.height : null)

  for (let i = 0; i < lines.length; i++) {
    if (!lines[i].trim()) continue
    const onLine = factsOnLine(lines[i])
    if (!onLine) break
    header.push(i)

    // A label with nothing after it heads the prose on the next line
    // ("__Personality:__" then a paragraph), so that line stays. Before a
    // blank line or another fact it heads nothing and only prints a bare label.
    const next = lines[i + 1]
    const headsProse = Boolean(next && next.trim() && !factsOnLine(next))

    for (const { rawLabel, rawValue } of onLine) {
      const label = factLabel(rawLabel)
      const key = label.toLowerCase()
      const hidden = /~!|!~/.test(rawValue)
      const value = hidden ? '' : factValue(rawValue)
      if (!hidden && !value && !headsProse) continue

      // The record already answers this one on the page.
      const record = ownedOf(key)
      if (record !== null) {
        if (hidden || squash(value) !== record) blocked.add(i)
        continue
      }

      const usable =
        value &&
        value.length <= FACT_VALUE_MAX &&
        label.length <= FACT_LABEL_MAX &&
        !NOT_FACTS.has(key) &&
        !looksLikeProse(rawValue, value)
      if (!usable) { blocked.add(i); continue }

      const at = found.findIndex((f) => f.label.toLowerCase() === key)
      if (at < 0) { found.push({ label, value, values: [value], lines: [i] }); continue }
      // "Affiliation" and "Affiliations" in one bio: one row, both values.
      const before = found[at]
      if (before.values.some((v) => v.toLowerCase() === value.toLowerCase())) {
        found[at] = { ...before, lines: [...before.lines, i] }
        continue
      }
      const joined = `${before.value}, ${value}`
      if (joined.length > FACT_VALUE_MAX) { blocked.add(i); continue }
      found[at] = { ...before, value: joined, values: [...before.values, value], lines: [...before.lines, i] }
    }
  }

  // Too many for the table: the facts a reader searches for win the room,
  // then the order the writer gave. The rest stay in the bio.
  const rankOf = (f) => {
    const at = FACT_PRIORITY.indexOf(f.label.toLowerCase())
    return at < 0 ? FACT_PRIORITY.length : at
  }
  const chosen = found.length <= FACT_MAX
    ? found
    : found
      .map((f, at) => ({ f, at }))
      .sort((a, b) => rankOf(a.f) - rankOf(b.f) || a.at - b.at)
      .slice(0, FACT_MAX)
      .sort((a, b) => a.at - b.at)
      .map(({ f }) => f)

  const left = new Set(found.filter((f) => !chosen.includes(f)).flatMap((f) => f.lines))
  const drop = new Set(header.filter((i) => !blocked.has(i) && !left.has(i)))
  const bio = drop.size
    ? lines.filter((_, i) => !drop.has(i)).join('\n').replace(/^\s+/, '')
    : text
  return { facts: chosen.map(({ label, value, values }) => ({ label, value, values })), bio }
}

export function genreSlug(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

export const pathOf = (item, kind) =>
  kind === 'anime' ? `/anime/${item.slug}` : `/${sectionOf(item)}/${item.slug}`

// A character is worth its own page only if we can say something about it.
export function characterHasPage(c) {
  return Boolean(c.image) && c.appearsIn.length > 0
}

export function charactersOf(item) {
  return (item.characters || []).filter((c) => c.image)
}

export const kindOfAppearance = sectionOf

// Extra data pulled by scripts/enrich-mal.mjs: MAL score via Jikan, and
// cross-site links via anime-offline-database.
//
// It used to be imported here as one JSON file. That file is packed INTO the
// Worker, and Cloudflare allows 3 MB of Worker code in total. At 2,610 titles
// it was 463 KB; at all 107,036 titles it would break every deploy. So
// scripts/make-shards.mjs now folds each title's entry into that title's own
// shard record, and the Worker reads it off the record it already loaded.
// Empty object when nothing has been pulled for this title yet.
export const enrichOf = (item) => item.extra || {}

/* ------------------------------------------------------------ brand marks */
/**
 * Every platform gets the same square tile. Inside it is the platform's real
 * logo, downloaded once from that platform's own site and served from our own
 * /brand/ folder. We never hotlink one, so no reader is ever reported back to
 * a platform, and a platform going down cannot break our page.
 *
 * A platform we have no logo for yet still gets the same tile, with its
 * initials in the brand colour. So a platform added next year looks deliberate
 * from the first day, and the logo can follow later.
 */
const initialsOf = (site) => {
  const words = site.trim().split(/\s+/).filter(Boolean)
  if (words.length > 1) return words[0][0] + words[1][0]
  // One word can still be two words joined: WebComics, WeTV, KakaoPage. Using
  // the second capital keeps them apart, which "We" three times would not.
  const inner = site.slice(1).search(/[A-Z]/)
  if (inner > -1) return site[0] + site[inner + 1]
  return site.slice(0, 2)
}

export const markOf = (site) => {
  // The logo files are named by slug, so any platform gets its logo without
  // being listed anywhere by hand: drop the file in, and it appears.
  const slug = (site || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  // A leading "!" is the build script telling us this mark is drawn dark and
  // needs a pale plate under it. See scripts/make-brand.mjs.
  const entry = LOGOS[slug] || null
  const dark = entry ? entry.startsWith('!') : false
  return {
    ...platform(site),
    src: entry ? `/brand/${dark ? entry.slice(1) : entry}` : null,
    plate: dark,
    initials: initialsOf(site || '?'),
  }
}
