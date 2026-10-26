/**
 * The characters page of an anime (/anime/<slug>/characters): every cast row
 * of the title page, each with the facts AniList keeps for the character
 * (gender, age, birthday, blood type, height, favourites, a short bio).
 *
 * The facts come from data/characters.json, filled by
 * scripts/ingest-character-facts.mjs: { "<id>": { g, a, b, d: "M-D", f, h,
 * bio, on } }. A missing file is an empty one: no title has enough facts, so
 * no characters page is built and the title page is unchanged.
 *
 * Pure.
 */

/** The id at the end of a catalog cast slug ("some-name-40882"). */
export const idOfSlug = (slug) => Number(/-(\d+)$/.exec(slug || '')?.[1]) || null

/**
 * The character ids a title's cast table shows, in its order: the credits
 * walk's rows when it reached the title, else the catalog's own cast list.
 * The same choice record-title.mjs castOf makes, so the ingest fetches
 * exactly the characters a page can print.
 */
export function castIdsOfTitle(item, creditsRow) {
  const fromCredits = (creditsRow?.characters || []).map((c) => c?.id)
  const ids = fromCredits.length ? fromCredits : (item.characters || []).map((c) => c.id || idOfSlug(c.slug))
  return ids.filter((id) => Number.isInteger(id))
}

/** True when a fetched row has at least one fact a card can print. */
export const hasFacts = (row) => Boolean(row && (row.g || row.a || row.b || row.d || row.h || row.bio))

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

/** "7-26" -> "July 26"; '' for anything that is not a real month and day. */
export function birthdayWord(md) {
  const m = /^(\d{1,2})-(\d{1,2})$/.exec(md || '')
  if (!m) return ''
  const month = Number(m[1])
  const day = Number(m[2])
  if (month < 1 || month > 12 || day < 1 || day > 31) return ''
  return `${MONTHS[month - 1]} ${day}`
}

/** One cast row ({ name, image, role, voices, face }) with its facts, empty ones left out. */
export function characterCard(row, facts) {
  const f = facts || {}
  const card = {
    name: row.name,
    image: row.image || '',
    role: row.role || '',
    voices: row.voices || [],
    face: row.face || null,
    gender: f.g || '',
    age: f.a || '',
    birthday: birthdayWord(f.d),
    blood: f.b || '',
    height: f.h || '',
    favourites: Number(f.f) || 0,
    bio: f.bio || '',
  }
  return Object.fromEntries(Object.entries(card).filter(([key, value]) => key === 'name' || key === 'voices' || (value !== '' && value !== null && value !== 0)))
}

const ROLE_ORDER = { MAIN: 0, SUPPORTING: 1, BACKGROUND: 2 }

/**
 * The cards of a characters page: main first, then by favourites, most first.
 * rows: cast rows with their character id ({ id, name, image, role, voices, face }).
 * facts: data/characters.json.
 */
export function charactersOf(rows, facts = {}) {
  return rows
    .map((row, at) => ({ at, card: characterCard(row, facts[String(row.id)]) }))
    .sort((x, y) =>
      (ROLE_ORDER[x.card.role] ?? 3) - (ROLE_ORDER[y.card.role] ?? 3) ||
      (y.card.favourites || 0) - (x.card.favourites || 0) ||
      x.at - y.at,
    )
    .map((x) => x.card)
}

/** How many cast rows have facts: what the characters gate counts. */
export const factCount = (rows, facts = {}) => rows.filter((row) => hasFacts(facts[String(row.id)])).length

const countWord = (n, word) => `${n} ${word}`

/** "18 characters: 4 main, 14 supporting." from the cards. */
export function charactersSummary(cards) {
  const by = (role) => cards.filter((c) => c.role === role).length
  const parts = [
    by('MAIN') && countWord(by('MAIN'), 'main'),
    by('SUPPORTING') && countWord(by('SUPPORTING'), 'supporting'),
    by('BACKGROUND') && countWord(by('BACKGROUND'), 'in the background'),
  ].filter(Boolean)
  const lead = `${cards.length} ${cards.length === 1 ? 'character' : 'characters'}`
  return parts.length ? `${lead}: ${parts.join(', ')}.` : `${lead}.`
}

const listWords = (words) => (words.length < 2 ? words.join('') : `${words.slice(0, -1).join(', ')} and ${words[words.length - 1]}`)

/** The meta description: only what the page really prints. Untruncated. */
export function charactersDescription(title, cards) {
  const has = (key) => cards.some((c) => c[key])
  const facts = [has('age') && 'ages', has('birthday') && 'birthdays', has('height') && 'heights'].filter(Boolean)
  const languages = ['Japanese', 'English'].filter((language) => cards.some((c) => c.voices.some((v) => v.language === language)))
  const parts = [...facts]
  if (languages.length) parts.push(`the ${listWords(languages)} voice cast`)
  const what = parts.length ? `: ${listWords(parts)}` : ''
  return `All ${cards.length} ${cards.length === 1 ? 'character' : 'characters'} of ${title}${what}.`
}
