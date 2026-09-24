/**
 * What an AniList staff role means to a reader.
 *
 * credits.json carries AniList's role text as it is: "Director", "Script (ep
 * 3)", "Theme Song Performance (OP)". A staff page groups a person's work by
 * what they did (directed, wrote, designed, composed), and a title page leads
 * with the few credits people search for by name. Both read the role through
 * here, so they never file the same credit two ways.
 *
 * Pure.
 */

/** "Script (ep 3)" -> "Script". AniList sometimes leaves a trailing space. */
export const baseRole = (role) => String(role || '').replace(/\s*\([^)]*\)\s*$/, '').trim()

/** "Script (ep 3)" -> "ep 3"; "" when the role has no detail. */
export const roleDetail = (role) => /\(([^)]*)\)\s*$/.exec(String(role || ''))?.[1].trim() || ''

/** The groups of a staff page, in the order the page shows them. */
export const CATEGORIES = [
  { key: 'created', label: 'Created', roles: ['Original Creator', 'Original Story', 'Original Work', 'Original Concept', 'Original Plan', 'Story & Art', 'Story', 'Art'] },
  { key: 'directed', label: 'Directed', roles: ['Director', 'Chief Director', 'Series Director', 'Assistant Director', 'Episode Director', 'Unit Director', 'Storyboard'] },
  { key: 'wrote', label: 'Wrote', roles: ['Series Composition', 'Script', 'Screenplay', 'Scenario', 'ADR Script'] },
  {
    key: 'designed',
    label: 'Designed',
    roles: ['Character Design', 'Original Character Design', 'Sub Character Design', 'Mechanical Design', 'Art Director', 'Art Design', 'Color Design', 'Prop Design', 'Design Works', 'Title Logo Design', 'Creature Design', 'Costume Design', 'Background Art'],
  },
  {
    key: 'composed',
    label: 'Music and songs',
    roles: ['Music', 'Music Composition', 'Music Arrangement', 'Music Lyrics', 'Music Performance', 'Music Producer', 'Theme Song Composition', 'Theme Song Arrangement', 'Theme Song Lyrics', 'Theme Song Performance', 'Insert Song Performance'],
  },
  {
    key: 'animated',
    label: 'Animated',
    roles: ['Key Animation', '2nd Key Animation', 'In-Between Animation', 'Animation', 'Animation Director', 'Chief Animation Director', 'Assistant Animation Director', 'Main Animator', 'CG Director', 'Director of Photography', 'Photography', 'Special Effects'],
  },
  { key: 'sound', label: 'Sound', roles: ['Sound Director', 'Sound Effects', 'Sound Design', 'ADR Director'] },
  { key: 'produced', label: 'Produced', roles: ['Producer', 'Executive Producer', 'Animation Producer', 'CG Producer', 'Planning', 'Production'] },
]

export const OTHER = { key: 'other', label: 'Other work', roles: [] }

const CATEGORY_OF = new Map(CATEGORIES.flatMap((c) => c.roles.map((role) => [role, c])))

/** The staff-page group a role belongs to. */
export const categoryOf = (role) => CATEGORY_OF.get(baseRole(role)) || OTHER

/**
 * The credits a title page names first, each linked to the person's page:
 * the ones people search for ("anime directed by W", "who wrote X").
 * Each lists the AniList roles that fill it, best first.
 */
export const KEY_CREDITS = [
  { label: 'Original creator', roles: ['Original Creator', 'Original Story', 'Original Work', 'Story & Art', 'Story'] },
  { label: 'Director', roles: ['Chief Director', 'Series Director', 'Director'] },
  { label: 'Series writer', roles: ['Series Composition', 'Screenplay', 'Script'] },
  { label: 'Character design', roles: ['Character Design', 'Original Character Design'] },
  { label: 'Music', roles: ['Music', 'Music Composition'] },
]

/**
 * The key credit a role fills, or null. A credit for some episodes only
 * ("Director (ep 5)", "Script (eps 3, 7)") is not the show's director or
 * writer, so it stays with the rest of the crew.
 */
export function keyCreditOf(role) {
  if (/\beps?\b/i.test(roleDetail(role))) return null
  const base = baseRole(role)
  return KEY_CREDITS.find((key) => key.roles.includes(base)) || null
}
