/**
 * Where to BUY, as opposed to where to read.
 *
 * A reader who finishes a series often wants the printed volumes, the disc set,
 * or a figure of the character. That is a real thing they want and the index
 * already knows the title, so the page can answer it.
 *
 * Why these are SHOP links and not product listings: showing a product card
 * with a price and a rating means holding Amazon's product data, and Amazon
 * only hands that data out through its API to an Associate who is already
 * making sales. Scraping it instead is banned by the same agreement that pays
 * us, and the penalty is the account. So until the API opens, every link here
 * carries only the title we already own, works on all ~104,000 pages the day it
 * ships, and can never rot into a dead listing or a wrong price.
 *
 * Each row names its own icon and its own button words. A row that says
 * "Shop figures" is worth more than three rows that all say "Shop", because
 * the reader knows what is behind it before they spend the tap.
 *
 * It imports only the site's settings: each site has its own tags.
 */
import config from './site.mjs'

/**
 * The Amazon stores we can be paid by.
 *
 * Amazon runs one programme per country and gives a different tag to each, so
 * a UK reader sent to amazon.com with the US tag earns nothing for either of
 * us. Cloudflare tells us the reader's country, so we can send them to their
 * own store instead.
 *
 * The tags are the site's own (amazon.stores in its config). An empty tag
 * means "we have not been approved there yet". Such a store is never used: the
 * reader falls back to the US store on the US tag. So a country switches on
 * the moment its tag is pasted in, and nothing breaks while it is missing. A
 * site with no US tag yet builds its links without a tag at all.
 *
 * `dept` holds each store's own department ids, because they are NOT the same
 * everywhere: the US calls its film department `movies-tv` and the UK calls it
 * `dvd`. A department we are unsure of is simply left out, and the link then
 * searches the whole store on the same words. That finds slightly more noise,
 * never an error page.
 */
const STORE_HOSTS = {
  us: { host: 'www.amazon.com', dept: { books: 'stripbooks', video: 'movies-tv', toys: 'toys-and-games' } },
  uk: { host: 'www.amazon.co.uk', dept: { books: 'stripbooks', video: 'dvd' } },
  de: { host: 'www.amazon.de', dept: { books: 'stripbooks', video: 'dvd' } },
  fr: { host: 'www.amazon.fr', dept: { books: 'stripbooks', video: 'dvd' } },
  it: { host: 'www.amazon.it', dept: { books: 'stripbooks', video: 'dvd' } },
  es: { host: 'www.amazon.es', dept: { books: 'stripbooks', video: 'dvd' } },
  ca: { host: 'www.amazon.ca', dept: { books: 'stripbooks', video: 'movies-tv' } },
  jp: { host: 'www.amazon.co.jp', dept: { books: 'english-books', video: 'dvd' } },
}

/**
 * The stores with their tags: { us: { host, tag, dept }, ... }. `tags` is a
 * site's amazon.stores ({ us: '<its US tag>', it: '' }); a store left out or left ''
 * has no tag. Exported so a test can build the stores of any set of tags.
 */
export function storesFrom(tags = {}) {
  return Object.fromEntries(
    Object.entries(STORE_HOSTS).map(([key, store]) => [key, { ...store, tag: String(tags[key] || '') }])
  )
}

const STORES = storesFrom(config.amazon.stores)

// Which store serves which country. A country that is not listed, or one whose
// store has no tag yet, gets the US store. Neighbours that genuinely shop on
// another country's Amazon are pointed at it, because Amazon has no store of
// their own: Austria buys on amazon.de, Belgium on amazon.fr.
const COUNTRY_STORE = {
  GB: 'uk',
  IE: 'uk',
  DE: 'de',
  AT: 'de',
  CH: 'de',
  FR: 'fr',
  BE: 'fr',
  LU: 'fr',
  MC: 'fr',
  IT: 'it',
  ES: 'es',
  PT: 'es',
  CA: 'ca',
  JP: 'jp',
}

// Logical department names. The real Amazon id is looked up per store.
export const BOOKS = 'books'
export const VIDEO = 'video'
export const TOYS = 'toys'
// No department at all: the whole store. Posters and shirts do not live in
// toys, and each store files them under a different id (home, fashion,
// clothing), so a guessed department would hide exactly what was asked for.
export const ALL = 'all'

/**
 * The store to use for one reader. Falls back to the US store whenever we have
 * no approved tag for their country, so a link is never sent to a store we
 * cannot be paid by. `stores` defaults to the site's own (storesFrom).
 */
export function storeFor(country, stores = STORES) {
  const picked = stores[COUNTRY_STORE[String(country || '').toUpperCase()]]
  return picked && picked.tag ? picked : stores.us
}

/**
 * An Amazon shop link in the reader's own store, carrying the tag for it. A
 * store with no tag yet (a site not approved anywhere) still gets a working
 * search link, only without a `tag` parameter.
 */
export function shopUrl(terms, department, country, stores = STORES) {
  const store = storeFor(country, stores)
  const params = new URLSearchParams({ k: terms })
  const dept = store.dept[department]
  if (dept) params.set('i', dept)
  if (store.tag) params.set('tag', store.tag)
  return `https://${store.host}/s?${params.toString()}`
}

/**
 * The shortest name a shop is likely to have on a box. Amazon does not know
 * season suffixes or bracketed editions, and a longer query finds less. The
 * English name is tried first, because that is the one printed on a US box.
 */
export function shopName(item) {
  return String(item.title || item.titleRomaji || '')
    .replace(/\s*[([].*$/, '')
    .replace(/\s*[:\-–]\s*(season|part|cour)\s+\w+.*$/i, '')
    // Quote marks inside a title are part of the story's name, never part of
    // the name on the box. Amazon treats them as words to match, so leaving
    // them in makes the search find less than it should.
    .replace(/["“”]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * The first few words of a title.
 *
 * Amazon looks for every word you give it. A title of eleven words finds
 * nothing at all, and a character name added in front of it finds less than
 * nothing. Four words is enough to tell two stories apart and short enough to
 * still reach the shelf.
 */
export function shortName(name, words = 4) {
  return String(name || '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, words)
    .join(' ')
}

/**
 * The words that find a comic's printed books. A light novel searched as
 * "manga" finds its comic adaptation instead of the novel itself, so a novel
 * is searched as what it is.
 */
function bookTerms(item, name) {
  return item.kind === 'novel' ? `${name} light novel` : `${name} manga`
}

/**
 * The buy rows for one title page. Empty when we have no usable name.
 */
export function shopLinks(item, country) {
  const name = shopName(item)
  if (name.length < 2) return []

  const isAnime = item.kind === 'anime'

  const rows = isAnime
    ? [
        {
          kind: 'discs',
          icon: 'disc',
          label: 'Blu-ray and DVD',
          note: 'The disc release, if one was made',
          cta: 'Shop discs',
          url: shopUrl(`${name} anime`, VIDEO, country),
        },
        {
          kind: 'books',
          icon: 'book',
          label: 'The manga it came from',
          note: 'Printed volumes of the original',
          cta: 'Shop books',
          url: shopUrl(`${name} manga`, BOOKS, country),
        },
      ]
    : [
        {
          kind: 'books',
          icon: 'book',
          label: 'Printed volumes',
          // A live Amazon search, not a vetted list: it can show other
          // sellers and other editions, so the note promises no more than that.
          note: "Opens Amazon's live search for this series",
          cta: 'Shop books',
          url: shopUrl(bookTerms(item, name), BOOKS, country),
        },
      ]

  // This row searches the toys department, so it names what is found there.
  rows.push({
    kind: 'merch',
    icon: 'figure',
    label: 'Figures and merch',
    note: 'Figures, plushies and collectibles',
    cta: 'Shop merch',
    url: shopUrl(`${name} anime`, TOYS, country),
  })

  return rows
}

/**
 * The two short links printed under a cover on the shop page. Same idea as
 * shopLinks, cut down to what fits beside a thumbnail.
 *
 * The shop page is built ahead of time, so there is no reader to have a
 * country yet. These stay on the US store.
 */
export function shelfLinks(item) {
  const name = shopName(item)
  if (name.length < 2) return []
  const isAnime = item.kind === 'anime'
  return [
    isAnime
      ? { kind: 'discs', label: 'Discs', url: shopUrl(`${name} anime`, VIDEO) }
      : { kind: 'books', label: 'Books', url: shopUrl(bookTerms(item, name), BOOKS) },
    { kind: 'merch', label: 'Merch', url: shopUrl(`${name} anime`, TOYS) },
  ]
}

/**
 * A figure of one named character only exists for a story that sold enough
 * copies to pay for the mould. AniList popularity is the closest number we
 * hold to that. Under this line the character's own name finds an empty shop,
 * and an empty shop earns nothing and looks broken, so those pages are given
 * the printed volumes of the story instead. Those always exist.
 */
export const FIGURE_POPULARITY = 40000

// Whether a character's buy page exists is decided in one place for the
// sitemap, the page and every link to it: hasCharacterBuyPage in gates.mjs.

/**
 * How many AniList members must keep a character in their favourites before
 * their own name is worth searching on Amazon.
 *
 * FIGURE_POPULARITY above says whether the STORY is big enough for figures.
 * These two say whether THIS PERSON is one of the faces the figures are made
 * of. In the catalog, 1,000 favourites is roughly the top few hundred names
 * (Luffy, Naruto, Anya, Erwin, Nanami): figure lines exist for nearly all of
 * them, so their own merch leads the box. Under 100 is a face in the crowd:
 * a figure search for that name opens an empty or wrong shelf, so those pages
 * only get the story's books and the story's own merch row.
 */
export const FAN_FAVOURITES = 1000
export const FEW_FAVOURITES = 100

/**
 * A fan favourite in their own right: enough favourites that figures of them
 * sell even when the title we hold for them is small. That happens when AniList
 * files a loved side character only under a spin-off, or when the story's own
 * record is thin (Miku Hatsune, 3,637 favourites, sits under a title of 369).
 *
 * Why 500. In the catalog, the characters this line lets through that the
 * story line (FIGURE_POPULARITY) would refuse are Hinami Fueguchi, Shuu
 * Tsukiyama and Nishiki Nishio from Tokyo Ghoul and Miku Hatsune, all of them
 * sold as figures. At 250 the list starts taking names from stories of 3,000
 * to 13,000 readers, where a figure search mostly opens an empty shelf.
 */
export const FIGURE_FAVOURITES = 500

/**
 * The best-known title a character is in: the appearance with the highest
 * popularity. The profile page leads with a comic where the person is a main
 * character, and for a side character that is often a spin-off nobody bought
 * ("Attack on Titan: No Regrets" for Erwin Smith). Figures are made for the
 * big story, so the figure search and the figure line are judged on this one.
 */
export function bestKnownTitle(person) {
  let best = null
  for (const row of person?.appearsIn || []) {
    if (!best || (row.popularity || 0) > (best.popularity || 0)) best = row
  }
  return best
}

/**
 * Whether figures of this character are likely to exist at all. Either the
 * person is a fan favourite in their own right, or the biggest story they are
 * in clears the figure line. A record with no favourites count was never
 * enriched, so it is judged on the story alone.
 *
 * hasCharacterBuyPage in gates.mjs is built on this, and so are the shop rows
 * below, so a buy page never exists without figure rows to show on it for a
 * reason the two disagree about.
 */
export function isFigureWorthy(person) {
  const fans = person?.favourites
  if (fans != null && fans >= FIGURE_FAVOURITES) return true
  // A big story alone is not enough for a face almost nobody follows: their
  // page would offer only the story's books, which the story's own buy page
  // already does, and a merch page with no merch of its person is thin.
  if (fans != null && fans < FEW_FAVOURITES) return false
  return (bestKnownTitle(person)?.popularity || 0) >= FIGURE_POPULARITY
}

/**
 * A title as the name on a figure box: no "Season 3", no "Part 2", no
 * "Final Season". Figures are sold under the story's name, not a season's.
 */
function franchiseName(row) {
  return shopName(row || {})
    .replace(/\s+(the\s+)?final\s+season\b.*$/i, '')
    .replace(/\s+(season|part|cour)\s+\w+.*$/i, '')
    .trim()
}

/**
 * The books rows for one character: at most two series.
 *
 * First the biggest story they are in ("Attack on Titan"), because that is the
 * one most readers came from. Then the title the page leads with, where they
 * are a main character, when it is a different series ("Attack on Titan: No
 * Regrets"). Same series twice is shown once.
 */
function characterBooks(top, series, country) {
  const rows = []
  const seen = new Set()
  for (const [item, name] of [
    [top, franchiseName(top)],
    [series, shopName(series || {})],
  ]) {
    const key = String(name || '').toLowerCase()
    if (key.length < 2 || seen.has(key)) continue
    seen.add(key)
    const novel = item?.kind === 'novel'
    rows.push({
      kind: 'books',
      icon: 'book',
      label: `${name} ${novel ? 'light novels' : 'books'}`,
      // A live Amazon search, not a vetted list: it can show other
      // sellers and other editions, so the note promises no more than that.
      note: "Printed volumes, from Amazon's live search",
      cta: 'Shop books',
      url: shopUrl(bookTerms({ kind: novel ? 'novel' : 'manga' }, name), BOOKS, country),
    })
  }
  return rows.slice(0, 2)
}

/**
 * The buy rows for one character: their own merch and the story's books.
 *
 * A character is what a figure is actually made of, so the series name alone
 * finds the wrong shelf. The series is still added as a second word, because a
 * first name on its own matches half the shop — but only the first few words
 * of it, or the search matches nothing. That series is the biggest one they
 * are in, not the spin-off the page may lead with.
 *
 * Both groups show, because a reader who loves a character wants either one:
 *   - a well-known face (FAN_FAVOURITES and up): their merch first, then books.
 *   - a lesser face: the books first, then their merch.
 *   - a face in the crowd (under FEW_FAVOURITES), or no figures likely at all
 *     (isFigureWorthy says no): the books plus one series merch row.
 * A record with no favourites count at all was never enriched. Unknown is not
 * the same as obscure, so it is treated as a lesser face.
 *
 * `series` is the story's own record for the title the page leads with: its
 * title, its kind and its popularity.
 */
export function characterShopLinks(person, series, country) {
  const who = String(person?.name || '').replace(/\s+/g, ' ').trim()
  if (who.length < 2) return []

  const top = bestKnownTitle(person) || series || {}
  const fans = person?.favourites
  const books = characterBooks(top, series, country)

  // No figure of this person is likely. Offer the story itself: its books and
  // one merch row for the whole series, which a series search does fill.
  if (!isFigureWorthy(person) || (fans != null && fans < FEW_FAVOURITES)) {
    const name = franchiseName(top)
    if (name.length < 2) return books
    return [
      ...books,
      {
        kind: 'merch',
        icon: 'figure',
        label: `${name} figures and merch`,
        note: 'Figures, plushies and collectibles',
        cta: 'Shop merch',
        url: shopUrl(`${name} anime`, TOYS, country),
      },
    ]
  }

  const both = `${who} ${shortName(franchiseName(top), 4)}`.trim()
  const own = ownMerch(who, both, country)
  return fans >= FAN_FAVOURITES ? [...own, ...books] : [...books, ...own]
}

/** The rows that search one character's own name. */
function ownMerch(who, both, country) {
  return [
    {
      kind: 'figures',
      icon: 'figure',
      label: 'Figures',
      note: `Statues and scale figures of ${who}`,
      cta: 'Shop figures',
      url: shopUrl(`${both} figure`, TOYS, country),
    },
    {
      kind: 'prints',
      icon: 'poster',
      label: 'Posters and prints',
      note: 'Wall art, art books and canvases',
      cta: 'Shop prints',
      url: shopUrl(`${both} poster`, ALL, country),
    },
    {
      kind: 'apparel',
      icon: 'shirt',
      label: 'Apparel',
      note: 'Shirts, hoodies and accessories',
      cta: 'Shop apparel',
      url: shopUrl(`${both} shirt`, ALL, country),
    },
  ]
}

// Amazon requires this sentence on the site. It shows in the footer of every
// page (src/layouts/Base.astro) and on the privacy page, not beside each box.
export const AMAZON_DISCLOSURE =
  'As an Amazon Associate we earn from qualifying purchases.'
