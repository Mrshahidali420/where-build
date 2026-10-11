/**
 * Voices in other languages. A title's cast table prints the Japanese and
 * English voices (src/where/people.mjs CAST_LANGUAGES), so a voice actor who
 * dubs in German or Italian had a page that no title page linked to: 5,664
 * of 11,907 voice actor pages on 11 Oct 2026. Each title now names some of
 * its other-language voices under the cast, and the choice is made so that
 * the links go first to the people who have the fewest.
 *
 * Pure, and the same on every build for the same data: titles are walked in
 * id order.
 */
import { CAST_LANGUAGES } from './people.mjs'

/** How many other-language voices one title page names. */
export const DUBS_PER_TITLE = 24
/** Past this many title links a voice actor is no longer first in line. */
export const DUB_LINKS_ENOUGH = 3

/**
 * titles   [{ id }] with a page
 * credits  credits.json, by title id
 * linked   (personId) -> true when the person has a voice page others may link to
 * Returns Map(titleId -> [{ id, language }]) in the order to print.
 */
export function dubLinks(titles, credits, linked, { perTitle = DUBS_PER_TITLE, enough = DUB_LINKS_ENOUGH } = {}) {
  const links = new Map()
  const bump = (id) => links.set(id, (links.get(id) || 0) + 1)
  const sorted = [...titles].sort((a, b) => a.id - b.id)
  // The links the cast tables already give.
  for (const title of sorted) {
    const seen = new Set()
    for (const character of credits[String(title.id)]?.characters || []) {
      for (const voice of character.voiceActors || []) {
        if (!voice?.id || !CAST_LANGUAGES.includes(voice.language) || seen.has(voice.id) || !linked(voice.id)) continue
        seen.add(voice.id)
        bump(voice.id)
      }
    }
  }
  const out = new Map()
  for (const title of sorted) {
    const found = new Map()
    let order = 0
    for (const character of credits[String(title.id)]?.characters || []) {
      for (const voice of character.voiceActors || []) {
        if (!voice?.id || !voice.language || CAST_LANGUAGES.includes(voice.language) || found.has(voice.id) || !linked(voice.id)) continue
        found.set(voice.id, { id: voice.id, language: voice.language, order: order++ })
      }
    }
    if (!found.size) continue
    // Fewest links first; past `enough` everyone is equal and the cast order decides.
    const need = (row) => Math.min(links.get(row.id) || 0, enough)
    const picked = [...found.values()].sort((a, b) => need(a) - need(b) || a.order - b.order).slice(0, perTitle)
    for (const row of picked) bump(row.id)
    out.set(title.id, picked.sort((a, b) => a.language.localeCompare(b.language) || a.order - b.order).map(({ id, language }) => ({ id, language })))
  }
  return out
}
