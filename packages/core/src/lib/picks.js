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
 */
import data from '@site/data/picks.json'
import { storeFor } from './shop-links.js'

const US_HOST = 'www.amazon.com'

// The relations that are the same story in another form, or the next part of
// it. A reader on the manga page of a series wants the same volume 1 as a
// reader on its anime page. Checked in this order, so the closest one wins.
const SAME_STORY = ['ADAPTATION', 'SOURCE', 'PARENT', 'PREQUEL', 'SEQUEL']

// What each type is called on the card.
export const PICK_LABELS = {
  book: 'Book',
  figure: 'Figure',
  plush: 'Plush',
  poster: 'Poster',
  apparel: 'Apparel',
  merch: 'Merch',
}

export const pickUrl = (asin) => `https://${US_HOST}/dp/${asin}?tag=${storeFor('US').tag}`

// True when this reader shops on amazon.com, the store the picks were made on.
export const picksShowFor = (country) => storeFor(country).host === US_HOST

const titlePicks = (id) => data.titles[String(id)] || null

/**
 * The picks for one title page, and which title they were picked for.
 *
 * `from` is null when the picks are the page's own. When they belong to the
 * same story in another form (the manga of this anime, the first season of
 * this sequel), `from` names that title, so the heading can say so instead of
 * pretending they were chosen for this exact page.
 */
export function picksForTitle(item) {
  if (!item) return null
  const own = titlePicks(item.id)
  if (own) return { picks: own, from: null }
  for (const relation of SAME_STORY) {
    const rel = (item.relations || []).find((r) => r.relation === relation && titlePicks(r.id))
    if (rel) return { picks: titlePicks(rel.id), from: rel.title || null }
  }
  return null
}

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
