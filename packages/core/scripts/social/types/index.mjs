/**
 * The site's template post types, in the order they are tried when two of
 * them have news at once. Each one is a picker, a caption writer with a few
 * wordings, and its own image design (one file each).
 *
 * A type posts only when its key is in the repo variable FB_POST_TYPES
 * (gate.mjs). The classic post (a cover and a caption) is not in this list;
 * its name in the variable is `classic`.
 */
import anticipated from './anticipated.mjs'
import character from './character.mjs'
import episode from './episode.mjs'
import fact from './fact.mjs'
import nextMonth from './next-month.mjs'
import nextWeek from './next-week.mjs'
import onair from './onair.mjs'
import premiere from './premiere.mjs'
import where from './where.mjs'

export const TYPES = [premiere, episode, onair, nextWeek, nextMonth, anticipated, character, fact, where]

export const TYPE_KEYS = TYPES.map((type) => type.key)
