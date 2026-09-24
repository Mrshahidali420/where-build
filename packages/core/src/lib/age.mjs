// A character's age, said the way a person would say it.
//
// AniList stores the age as free text typed by its editors, so about one age
// in six is not a plain number. Printed as is, "17-" read like a typo ("Ram is
// 17-."). On AniList a trailing dash means "this age at the start, older later
// in the story". The shapes below cover nearly all of the 18,000 ages in the
// catalog (checked 24 Sep 2026); anything else is printed as its own words,
// cleaned, and the FAQ says it is AniList's wording rather than pretend it is
// a number.
//
// `text` reads well both in the facts table ("Age: 16 to 17") and after "is"
// ("Ram is 17 or older."). `plain` is false for free text, which only makes
// sense in quotes.

const NUMBER = (n) => Number(n).toLocaleString('en-US')

/** @returns {{ text: string, plain: boolean } | null} null when there is no real age */
export function ageOf(raw) {
  const s = String(raw ?? '')
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  if (!s) return null
  if (/^(unknown|confidential|\?+|n\/a|-+)$/i.test(s)) return null
  // A redacted "████" or any other age with no letter or digit in it.
  if (!/[\p{L}\p{N}]/u.test(s)) return null

  let m
  // 17
  if ((m = s.match(/^(\d{1,5})$/))) return { text: NUMBER(m[1]), plain: true }
  // 17- : the age when the story starts, older later
  if ((m = s.match(/^(\d{1,5})\s*[-~]$/))) return { text: `${NUMBER(m[1])} or older`, plain: true }
  // 16-17, 16 - 17, 16~17
  if ((m = s.match(/^(\d{1,5})\s*[-~–]\s*(\d{1,5})$/)) && Number(m[1]) < Number(m[2])) {
    return { text: `${NUMBER(m[1])} to ${NUMBER(m[2])}`, plain: true }
  }
  // 1000+, Over 1000, >1000
  if ((m = s.match(/^(\d{1,5})\s*\+$/)) || (m = s.match(/^(?:over|>)\s*(\d{1,5})$/i))) {
    return { text: `over ${NUMBER(m[1])}`, plain: true }
  }
  // ~20, 20~ (a lone trailing ~ is taken above as "or older"), Around 20
  if ((m = s.match(/^~\s*(\d{1,5})$/)) || (m = s.match(/^(?:around|about|approx\.?)\s*(\d{1,5})$/i))) {
    return { text: `about ${NUMBER(m[1])}`, plain: true }
  }
  // 20s, Early 20's, Late 20s
  if ((m = s.match(/^(early |mid |mid-|late )?(\d{1,3})0'?s$/i))) {
    const when = m[1] ? `${m[1].trim().replace(/-$/, '').toLowerCase()} ` : ''
    return { text: `in their ${when}${m[2]}0s`, plain: true }
  }
  return { text: s, plain: false }
}
