// "Top-rated episodes right now" (types/rating-day.mjs): the week's card, more often, named by its episodes.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { captionFor } from '../scripts/social/plan.mjs'
import { KINDS } from '../scripts/social/types/index.mjs'
import ratingDay from '../scripts/social/types/rating-day.mjs'
import ratingWeek from '../scripts/social/types/rating-week.mjs'
import { NOW, BLOCKED } from './social-kit.mjs'
import { sampleData, sampleRatings } from './social-data.mjs'

/** The sample data with a third show that aired a day ago, so the list has its three episodes. */
function threeShows() {
  const data = sampleData()
  const ratings = sampleRatings(NOW)
  ratings.rows.push({ id: 'tt0101024', titleId: 101, ep: 24, aired: NOW - 86_400_000, score: 8.4, votes: 900, base: null })
  return { ...data, ratings }
}

test('rating-day: known to the poster, urgent, an extra next to the weekly list', () => {
  assert.ok(KINDS.includes(ratingDay))
  assert.equal(ratingDay.urgent, true)
  assert.equal(ratingWeek.urgent, false)
  assert.notEqual(ratingDay.key, ratingWeek.key)
})

test('rating-day: a list of the last seven days, named by its episodes, with a caption that passes the gate', () => {
  const posts = ratingDay.find(threeShows(), { now: NOW })
  assert.equal(posts.length, 1)
  assert.match(posts[0].item, /^day:tt0100011+\+/)
  assert.equal(posts[0].view.items.length, 4)
  assert.deepEqual(posts[0].view.items.map((i) => i.score), ['9.4', '8.7', '8.4', '7.9'])
  const made = captionFor(ratingDay, posts[0], 0, BLOCKED)
  assert.ok(made, 'a caption was made')
  assert.match(made.caption, /IMDb/)
  assert.notEqual(posts[0].item, 'week')
})

test('rating-day: fewer than three shows in the window is no post', () => {
  assert.deepEqual(ratingDay.find(sampleData(), { now: NOW + 6 * 86_400_000 }), [])
})

test('rating-day: nothing inside the window means no post, and the week card is unchanged', () => {
  assert.deepEqual(ratingDay.find(sampleData(), { now: NOW + 30 * 86_400_000 }), [])
  assert.equal(ratingWeek.find(sampleData(), { now: NOW })[0].item, 'week')
})
