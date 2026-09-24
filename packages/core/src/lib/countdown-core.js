// "in 3 days", "in 5 hours", "airing now". Shared by components/Countdown.astro
// and by the My list and For you blocks, which draw their own countdowns from
// the list rows in the browser. Pure, so the same words come out everywhere.

const MINUTE = 60
const HOUR = 3600
export const DAY = 86400

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`

/** Seconds left until an episode, in words. */
export function phrase(left) {
  if (left <= 0) return 'airing now'
  if (left < HOUR) return `in ${plural(Math.round(left / MINUTE), 'minute')}`
  if (left < DAY) return `in ${plural(Math.round(left / HOUR), 'hour')}`
  return `in ${plural(Math.round(left / DAY), 'day')}`
}
