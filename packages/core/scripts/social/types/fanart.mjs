/**
 * "Fan art" for this site: a character of an anime that has a page here
 * (types/art-card.mjs holds the picker, the words and the design; art/ finds
 * and checks the pictures).
 */
import { artType } from './art-card.mjs'

export default artType({ kind: 'fanart', verb: 'watch' })
