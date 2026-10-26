/**
 * Pure parts of the character facts walk (scripts/ingest-character-facts.mjs):
 * the query, cleaning one AniList character into the compact row
 * characters.json stores, picking which ids to ask for, and merging. Kept
 * apart from the script the same way scripts/sister-staff.mjs is.
 *
 * A row: { g, a, b, d: "M-D", f, h, bio, on: "YYYY-MM-DD" }
 *   g gender, a age, b blood type, d birthday (month-day), f favourites,
 *   h height (from the description's "__Height:__ 178 cm" line), bio a short
 *   spoiler-free description, on the day it was fetched. Empty facts are left
 *   out. An id AniList did not return keeps a row with `on` only, so it is not
 *   asked for again until it goes stale.
 */
import { IDS_PER_CALL } from './anilist-core.mjs'
import { ownedOnly } from '../src/lib/owned.mjs'
import { castIdsOfTitle } from '../src/where/characters.mjs'

/** A row older than this is asked for again. A fresher one is never refetched. */
export const FRESH_DAYS = 90
export const BIO_MAX = 280

export const CHARACTER_FACTS_QUERY = `query ($ids: [Int]) {
  Page(page: 1, perPage: ${IDS_PER_CALL}) {
    characters(id_in: $ids) {
      id
      gender
      age
      bloodType
      dateOfBirth { month day }
      favourites
      description(asHtml: false)
    }
  }
}`

/** A "__Key:__ value" (or "**Key:** value") fact line, as AniList writes them. */
const FACT_LINE = /^\s*(?:__|\*\*)[^_*\n]{1,40}?(?::\s*(?:__|\*\*)|(?:__|\*\*)\s*:)/

const withoutSpoilers = (text) => String(text || '').replace(/~![\s\S]*?!~/g, ' ')
const withLineBreaks = (text) => text.replace(/<br\s*\/?>/gi, '\n').replace(/\r\n?/g, '\n')

/** The height named in a description, as "178 cm", or '' when there is none. */
export function parseHeight(description) {
  const text = withLineBreaks(withoutSpoilers(description))
  const line = /(?:__|\*\*)\s*Height\s*:?\s*(?:__|\*\*)\s*:?\s*([^\n]+)/i.exec(text)
  if (!line) return ''
  const value = line[1]
  const cm = /(\d{2,3}(?:[.,]\d+)?)\s*cm\b/i.exec(value)
  if (cm) return `${cm[1].replace(',', '.')} cm`
  const plain = value.replace(/[_*[\]]/g, '').replace(/\(.*?\)/g, '').trim()
  return /\d/.test(plain) && plain.length <= 24 ? plain : ''
}

/** The last sentence end at or before `max` characters, or '' when there is none. */
function cutAtSentence(text, max) {
  if (text.length <= max) return text
  const head = text.slice(0, max + 1)
  let end = -1
  for (const m of head.matchAll(/[.!?]["')\]]?(?=\s|$)/g)) if (m.index + m[0].length <= max) end = m.index + m[0].length
  return end > 0 ? head.slice(0, end).trim() : ''
}

/**
 * A description as a short plain bio: spoilers out, the "__Key:__ value"
 * fact lines out (they are shown as facts instead), markdown, links and HTML
 * stripped, whitespace collapsed, cut at a sentence end to BIO_MAX
 * characters. '' when nothing is left.
 */
export function cleanBio(description, max = BIO_MAX) {
  const lines = withLineBreaks(withoutSpoilers(description))
    .split('\n')
    .filter((line) => !FACT_LINE.test(line))
  const text = lines
    .join(' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(/(\*\*|__|~~~|~~|[*_`#>])/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/\s+/g, ' ')
    .replace(/\s+([.,!?;:])/g, '$1')
    .trim()
  return cutAtSentence(text, max)
}

const short = (value, max) => {
  const text = String(value ?? '').replace(/\s+/g, ' ').trim()
  return text.length <= max ? text : ''
}

/** One AniList character node -> the compact row characters.json stores. */
export function shapeFacts(node, today) {
  const month = node.dateOfBirth?.month
  const day = node.dateOfBirth?.day
  const row = {
    g: short(node.gender, 30),
    a: short(node.age, 40),
    b: short(node.bloodType, 10),
    d: month && day ? `${month}-${day}` : '',
    f: Number(node.favourites) || 0,
    h: parseHeight(node.description),
    bio: cleanBio(node.description),
    on: today,
  }
  return Object.fromEntries(Object.entries(row).filter(([, value]) => value !== '' && value !== 0))
}

/** Every character id the cast tables of the site's titles can show, ascending. */
export function ownedCharacterIds(site, titles, creditsById) {
  const ids = new Set()
  for (const item of ownedOnly(site, titles)) {
    for (const id of castIdsOfTitle(item, creditsById[String(item.id)])) ids.add(id)
  }
  return [...ids].sort((a, b) => a - b)
}

const DAY_MS = 24 * 60 * 60 * 1000
const ageInDays = (on, today) => {
  const then = Date.parse(`${on}T00:00:00Z`)
  return Number.isFinite(then) ? (Date.parse(`${today}T00:00:00Z`) - then) / DAY_MS : Infinity
}

/**
 * The ids to ask for: never fetched first, then the ones checked more than
 * FRESH_DAYS ago, oldest first. A row fetched within FRESH_DAYS is never asked
 * for again.
 */
export function selectToFetch(ids, existing, today, freshDays = FRESH_DAYS) {
  const missing = []
  const stale = []
  for (const id of ids) {
    const row = existing[String(id)]
    if (!row) missing.push(id)
    else if (ageInDays(row.on, today) > freshDays) stale.push(id)
  }
  stale.sort((x, y) => String(existing[String(x)].on || '').localeCompare(String(existing[String(y)].on || '')) || x - y)
  return { missing, stale, ids: [...missing, ...stale] }
}

/**
 * A new characters.json: `existing` with this run's rows applied. An id
 * asked for in a call that worked but not returned (AniList has no such
 * character any more) keeps what it had with a new `on`, so it waits
 * FRESH_DAYS like any other instead of being asked for every night.
 */
export function mergeFacts(existing, fetchedById, askedIds, today) {
  const merged = { ...existing }
  for (const id of askedIds) if (!fetchedById.has(id)) merged[String(id)] = { ...(existing[String(id)] || {}), on: today }
  for (const [id, row] of fetchedById) merged[String(id)] = row
  return merged
}
