/**
 * The thinnest person and artist pages, taken out of Google: the page stays
 * live, answers with <meta name="robots" content="noindex,follow">, leaves
 * the sitemap and the directories, and is no longer linked from other pages.
 *
 * A page is noindexed only when its own data is thin AND Google showed it
 * to nobody in the window of data/index-keep.json (src/lib/index-keep.js).
 * With no keep list the rule is off and nothing is noindexed: the build still
 * counts what it would do.
 *
 *   voice actor  kept with a bio of 40+ words, or 5+ shows voiced in the
 *                languages the cast tables print, or 15+ shows in any language
 *   staff        kept with a bio of 40+ words, or work on 6+ shows
 *   artist       kept with 4+ songs across 3+ shows
 *
 * Worked out at build time by scripts/make-where.mjs, which stores the result
 * on each record (noindexVoice, noindexStaff, noindex), so the Worker only
 * reads a flag. Pure.
 */
import { CAST_LANGUAGES } from './people.mjs'

export const BIO_WORDS = 40
export const VOICE_CAST_SHOWS = 5
export const VOICE_ANY_SHOWS = 15
export const STAFF_SHOWS = 6
export const ARTIST_SONGS = 4
export const ARTIST_SHOWS = 3

/** Words in a bio, with AniList's markup and links not counted. */
export function bioWords(text) {
  const plain = String(text || '')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(/[_*~#>|]/g, ' ')
  return (plain.match(/[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu) || []).length
}

const hasBio = (person) => bioWords(person.info?.description) >= BIO_WORDS
const showCount = (credits) => new Set(credits.map((c) => c.titleId)).size

/** person: one of buildPeople's (src/where/people.mjs). */
export function thinVoice(person) {
  if (hasBio(person)) return false
  const voice = person.voice || []
  if (showCount(voice) >= VOICE_ANY_SHOWS) return false
  return showCount(voice.filter((v) => CAST_LANGUAGES.includes(v.language))) < VOICE_CAST_SHOWS
}

export const thinStaff = (person) => !hasBio(person) && showCount(person.crew || []) < STAFF_SHOWS

/** artist: one of buildArtists' (src/where/artists.mjs). */
export const thinArtist = (artist) => (artist.songs || []).length < ARTIST_SONGS || showCount(artist.songs || []) < ARTIST_SHOWS

const blank = () => ({ pages: 0, thin: 0, kept: 0, noindex: 0 })

/**
 * Which pages to noindex.
 *   people   the people with a page; artists: the artists with a page
 *   pages    computeWhere's `pages` (voice and staff ids)
 *   pathOf   { voice(id), staff(id), artist(key) } -> the page's path
 *   keep     Set of paths from data/index-keep.json; empty turns the rule off
 * Returns { on, voice: Set(ids), staff: Set(ids), artist: Set(keys), counts }.
 * counts per type: pages, thin (by the data test), kept (thin but on the keep
 * list), noindex (thin - kept when the rule is on, else 0).
 */
export function noindexSets({ people = [], artists = [], pages, pathOf, keep = new Set() }) {
  const on = keep.size > 0
  const out = { on, voice: new Set(), staff: new Set(), artist: new Set(), counts: { voice: blank(), staff: blank(), artist: blank() } }
  const judge = (type, key, thin, path) => {
    const count = out.counts[type]
    count.pages++
    if (!thin) return
    count.thin++
    if (keep.has(path)) return void count.kept++
    if (!on) return
    count.noindex++
    out[type].add(key)
  }
  for (const person of people) {
    if (pages.voice.has(person.id)) judge('voice', person.id, thinVoice(person), pathOf.voice(person.id))
    if (pages.staff.has(person.id)) judge('staff', person.id, thinStaff(person), pathOf.staff(person.id))
  }
  for (const artist of artists) judge('artist', artist.key, thinArtist(artist), pathOf.artist(artist.key))
  return out
}
