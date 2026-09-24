// Which of a character's names to lead with. Pure and import-free on purpose:
// the Worker imports it at request time, and answers.mjs imports it too, which
// plain Node scripts load, so it must never pull in format.js or the catalog.

const MAX_ALTERNATES = 8

// Some AniList names carry a stray double or trailing space ("Lin  Cai ").
const tidy = (name) => String(name || '').replace(/\s+/g, ' ').trim()
const wordsOf = (name) => tidy(name).split(' ').filter(Boolean)
const letters = (word) => word.toLowerCase().replace(/[^a-z]/g, '').length

// The consonants of one word, in order. Korean and Chinese romanizations of the
// same name differ almost only in vowels and in the semi-vowels w, y and h:
// Seong/Sung, U/Woo, Yu/Yoo, Hyeok/Hyuk, Su/Soo, Yeong/Young. Hyphens and
// apostrophes vanish too, so "Jin-Woo", "Jinwoo" and "Jin'woo" are one word.
const skeleton = (word) =>
  word
    .toLowerCase()
    .replace(/[^a-z]/g, '')
    .replace(/[aeiouwyh]/g, '')

// Plain Latin letters, spaces and the punctuation names use. No brackets (an
// alias with a bracket carries a second script or a gloss) and no accents: a
// pinyin form with tone marks ("Sūn Jǐng") is not what anyone types.
const LATIN_NAME = /^[A-Za-z][A-Za-z .'’-]*$/

// Only a real Korean or Chinese name is flipped: a native spelling that is one
// run of Hangul, or one run of Han characters in a Chinese or Taiwanese story.
// "쿤 아게로 아그니스" (Khun Aguero Agnis) has spaces, so it is a Western-style
// name in a Korean story and its order is not ours to change.
//
// Japanese names are left alone on purpose. English-speaking fans mostly write
// them given name first ("Light Yagami"), the same order AniList uses, so an
// alias in Japanese order is not the searched form. A Japanese name in kanji
// looks exactly like a Chinese one, which is why the story's country decides.
const HANGUL_NAME = /^[ᄀ-ᇿ㄰-㆏가-힯]+$/
const HAN_NAME = /^[㐀-鿿豈-﫿]+$/
const isFlippable = (native, appearsIn) =>
  HANGUL_NAME.test(native) ||
  (HAN_NAME.test(native) && (appearsIn || []).some((a) => a.country === 'CN' || a.country === 'TW'))

// Words paired up by skeleton, each with its letter count, in a stable order.
const pairsOf = (words) =>
  words
    .map((word) => [skeleton(word), letters(word)])
    .sort((x, y) => (x[0] < y[0] ? -1 : x[0] > y[0] ? 1 : x[1] - y[1]))

/** True when `alias` is `full` with its words reordered, in any romanization. */
function isReorderedForm(full, alias) {
  if (!LATIN_NAME.test(alias)) return false
  const a = wordsOf(full)
  const b = wordsOf(alias)
  if (a.length < 2 || a.length !== b.length) return false
  // A name made only of vowels says nothing a skeleton can check.
  if (!a.some((word) => skeleton(word))) return false
  // Same order means a respelling, not the family-name-first form.
  if (a.every((word, i) => skeleton(word) === skeleton(b[i]))) return false
  // Every word must match a different word of the full name, and a matched
  // pair may differ by two letters at most, so a vowel-only word like "Ya" is
  // not taken for "Youya" while "U" still matches "Woo" and "Yu" matches "Yoo".
  const pa = pairsOf(a)
  const pb = pairsOf(b)
  return pa.every(([key, n], i) => key === pb[i][0] && Math.abs(n - pb[i][1]) <= 2)
}

/**
 * The name to lead a character page with, and the other names to show.
 *
 * AniList stores every character's full name in Western order, given name
 * first: "Jin-U Seong", "Jung-Hyeok Yu". Korean and Chinese fans write and
 * search the family name first, in the romanization they grew up with: "Sung
 * Jin-Woo", "Yoo Jonghyuk". AniList usually holds that form too, but only as
 * one of the alternative names, so the page never led with it.
 *
 * We have no search volume per alias, so the rule has to be one a person can
 * check by eye. An alternative name leads only when all of these hold:
 *
 *   - the character's native name is a real Korean or Chinese name (see
 *     isFlippable above);
 *   - the alternative has exactly as many words as the full name, two or more,
 *     and every word matches one word of the full name once vowels are ignored
 *     ("Seong" = "Sung", "Jin-U" = "Jin-Woo");
 *   - its words are NOT in the full name's order. A same-order respelling
 *     ("Dongsoo Hwang" for "Dong-Su Hwang") is only a spelling, so it goes in
 *     the also-known-as list instead;
 *   - it is plain Latin letters with no brackets.
 *
 * The first alternative that passes wins, in AniList's own order. A nickname
 * ("Straw Hat", "World's Weakest Hunter") can never pass the word test, so a
 * nickname never leads. Spoiler names are never fetched at all (the ingest asks
 * AniList only for `alternative`), so none can lead or show. When nothing
 * passes, the full name leads, exactly as before.
 *
 * Returns:
 *   primary    the name to lead with in the title, h1 and FAQ
 *   formal     AniList's full name, only when it differs from `primary`
 *   alternates every other name worth printing: the native spelling first,
 *              then the other alternatives, deduped without regard to case,
 *              at most 8
 */
export function displayName(person) {
  const full = tidy(person?.name)
  const aliases = (person?.aliases || []).map(tidy).filter(Boolean)
  const native = tidy(person?.native)

  const lead = isFlippable(native, person?.appearsIn)
    ? aliases.find((alias) => isReorderedForm(full, alias))
    : undefined
  const primary = lead || full
  const formal = lead ? full : ''

  // Everything else a reader might know this character by. The names already
  // on screen (primary and formal) are left out so no name prints twice.
  const seen = new Set([primary, formal].filter(Boolean).map((n) => n.toLowerCase()))
  const alternates = []
  for (const name of [native, ...aliases]) {
    const key = name.toLowerCase()
    if (!name || seen.has(key)) continue
    seen.add(key)
    alternates.push(name)
    if (alternates.length === MAX_ALTERNATES) break
  }

  return { primary, formal, alternates }
}
