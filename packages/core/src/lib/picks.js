/**
 * Hand-picked Amazon products.
 *
 * The shop links in shop-links.js open a live Amazon search, which works for
 * every title but lands the reader on a page of mixed results. For the series
 * and characters people visit most, real products were picked by hand instead
 * (volume 1, a box set, a figure, a plush). data/picks.json holds them, keyed
 * by AniList id; scripts/build-picks.mjs explains where they come from.
 *
 * Each pick is only an ASIN, a short name and a type. No price, no image and
 * no rating: those are Amazon's product data, which the Associates agreement
 * only allows through its API. The card shows our own cover instead.
 *
 * The products were picked on amazon.com, and a merch ASIN there often does
 * not exist on another country's Amazon. So picks are shown only to readers
 * whose store is the US one. Everyone else still gets the search rows in the
 * buy box, which work in their own store.
 *
 * The rules live in picks-core.js, pure, so a build script can use them too.
 */
import data from '@site/data/picks.json'
import { storeFor } from './shop-links.js'
import { US_HOST, PICK_LABELS, pickUrlFor, picksForTitleIn } from './picks-core.js'

export { PICK_LABELS }

export const pickUrl = (asin) => pickUrlFor(asin, storeFor('US').tag)

// True when this reader shops on amazon.com, the store the picks were made on.
export const picksShowFor = (country) => storeFor(country).host === US_HOST

/** The picks for one title page, and which title they were picked for (see picks-core.js). */
export const picksForTitle = (item) => picksForTitleIn(data, item)

export const picksForCharacter = (person) =>
  (person && data.characters[String(person.id)]) || null

/**
 * The picks for a character page: the character's own, or else the picks of
 * the story they are from. `from` is null for their own, and otherwise names
 * the story, so the heading never claims a volume 1 is a figure of them.
 */
export function picksForPerson(person, story) {
  const own = picksForCharacter(person)
  if (own) return { picks: own, from: null }
  const series = picksForTitle(story)
  return series ? { picks: series.picks, from: series.from || story.title } : null
}

// Every title id with its own picks. The shop page lists these.
export const pickedTitleIds = () => Object.keys(data.titles).map(Number)
export const pickedCharacterIds = () => Object.keys(data.characters).map(Number)
