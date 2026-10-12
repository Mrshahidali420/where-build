/**
 * The site's template post types, in the order they are tried when two of
 * them have news at once. Each one is a picker, a caption writer with a few
 * wordings, and its own image design (one file each).
 *
 * A type posts only when its key is in the repo variable FB_POST_TYPES
 * (gate.mjs). The classic post (a cover and a caption) is not in this list;
 * its name in the variable is `classic`.
 */
import airtime from './airtime.mjs'
import anticipated from './anticipated.mjs'
import birthday from './birthday.mjs'
import cosplay from './cosplay.mjs'
import character from './character.mjs'
import collage from './collage.mjs'
import episode from './episode.mjs'
import fact from './fact.mjs'
import fanart from './fanart.mjs'
import nextMonth from './next-month.mjs'
import nextWeek from './next-week.mjs'
import onair from './onair.mjs'
import premiere from './premiere.mjs'
import scenes from './scenes.mjs'
import stills from './stills.mjs'
import reelAnticipated from './reel-anticipated.mjs'
import reelNextWeek from './reel-next-week.mjs'
import reelToday from './reel-today.mjs'
import where from './where.mjs'

export const TYPES = [airtime, premiere, episode, onair, nextWeek, nextMonth, anticipated, birthday, character, fact, where, fanart, cosplay, stills, scenes, collage]

export const TYPE_KEYS = TYPES.map((type) => type.key)

/** The reels (reel/): short vertical videos made from slides. Gated like every type, by name. */
export const REELS = [reelToday, reelNextWeek, reelAnticipated]

/** Every kind a run can be asked for by name. */
export const KINDS = [...TYPES, ...REELS]
