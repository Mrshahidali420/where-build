/**
 * What a Where anime site offers to buy, the home site's way: every link opens
 * Amazon's own search (or a hand-picked product), in the reader's store, with
 * the site's own tag when it has one (src/lib/shop-links.js). We stock
 * nothing and hold no product data.
 *
 *   animeShopRows   the buy box of one title page
 *   songListen      the YouTube, Spotify and Amazon searches of one song
 *   shopOf          the lists behind /shop, written by the build
 *
 * The Amazon Associates sentence is never drawn beside any of these: it lives
 * in the footer and on the privacy page (the owner's rule).
 *
 * Pure: `stores` defaults to the site's own, and a test hands in its own.
 */
import { shopUrl, shopName, shortName, VIDEO, BOOKS, TOYS, ALL } from '../lib/shop-links.js'
import { mediumCover } from '../lib/list-row.js'

/**
 * The printed original behind an anime, by AniList's `source`. Only sources
 * that are sold as books get a books row; a game gets its own row; an
 * original anime has no book to point at, so it gets its art books instead.
 */
const SOURCE_ROWS = {
  MANGA: { terms: 'manga', label: 'The manga it came from', note: 'Printed volumes of the original manga' },
  COMIC: { terms: 'manga', label: 'The comic it came from', note: 'Printed volumes of the original' },
  LIGHT_NOVEL: { terms: 'light novel', label: 'The light novels it came from', note: 'The original light novel volumes' },
  WEB_NOVEL: { terms: 'light novel', label: 'The novels it came from', note: 'The web novel, as printed volumes' },
  NOVEL: { terms: 'novel', label: 'The novel it came from', note: 'The original novel in print' },
  ORIGINAL: { terms: 'art book', label: 'Art books and guides', note: 'Art books, guides and visual books' },
}
const GAME_SOURCES = new Set(['VIDEO_GAME', 'GAME', 'VISUAL_NOVEL'])

/** The name a shop knows a record by: its English title, else its romaji. */
export const recordShopName = (r) => shopName({ title: r?.title, titleRomaji: r?.romaji })

/** A book row for this source, or null when the source is not sold as a book. */
function sourceRow(source, name, country, stores) {
  const known = SOURCE_ROWS[source]
  if (known) {
    return { kind: 'books', icon: 'book', label: known.label, note: known.note, cta: 'Shop books', url: shopUrl(`${name} ${known.terms}`, BOOKS, country, stores) }
  }
  if (GAME_SOURCES.has(source)) {
    return { kind: 'games', icon: 'disc', label: 'The game it came from', note: 'The original game and its editions', cta: 'Shop games', url: shopUrl(`${name} game`, ALL, country, stores) }
  }
  return null
}

/**
 * The buy rows of one anime title page (a title shard record,
 * src/where/record-title.mjs). Empty when the record has no usable name.
 * Discs lead, because an anime page is about the show itself; then the
 * printed original, then figures and plushies, then posters.
 *
 * `r.books === false` means the show was checked and its source was never
 * printed in English (src/lib/picks-core.js, booksKnownIn). A book search for
 * it opens a page of unrelated books, so that row is dropped. Only a book
 * source is judged: a game's row and an original's art books stay.
 */
export function animeShopRows(r, country, stores) {
  const name = recordShopName(r)
  if (name.length < 2) return []
  const noBooks = r.books === false && BOOK_SOURCES.has(r.source)
  return [
    { kind: 'discs', icon: 'disc', label: 'Blu-ray and DVD', note: 'The disc release, where one was made', cta: 'Shop discs', url: shopUrl(`${name} anime`, VIDEO, country, stores) },
    noBooks ? null : sourceRow(r.source, name, country, stores),
    { kind: 'merch', icon: 'figure', label: 'Figures and plushies', note: 'Scale figures, plushies and collectibles', cta: 'Shop figures', url: shopUrl(`${name} anime`, TOYS, country, stores) },
    { kind: 'prints', icon: 'poster', label: 'Posters and apparel', note: 'Wall scrolls, prints, shirts and hoodies', cta: 'Shop posters', url: shopUrl(`${name} anime poster`, ALL, country, stores) },
  ].filter(Boolean)
}

/**
 * The listen links of one opening or ending: a search on YouTube, Spotify and
 * Amazon for the song's title and first artist. A search claims nothing about
 * what it will find, so none of them is called "official". Each link carries
 * data-go="song" and its own data-platform for the click tracker; the Amazon
 * one is also an affiliate link (data-aff="music").
 */
export function songListen(song, country, stores) {
  const terms = [song?.title, song?.artists?.[0]?.name].filter(Boolean).join(' ').trim()
  if (!terms) return []
  const q = encodeURIComponent(terms)
  return [
    { label: 'YouTube', url: `https://www.youtube.com/results?search_query=${q}`, rel: 'nofollow noopener', terms },
    { label: 'Spotify', url: `https://open.spotify.com/search/${q}`, rel: 'nofollow noopener', terms },
    { label: 'Amazon', url: shopUrl(terms, ALL, country, stores), rel: 'nofollow sponsored noopener', aff: 'music', terms },
  ]
}

// ------------------------------------------------------------------ /shop

const SHOP_POPULAR = 24
const SHOP_BOOKS = 18
const SHOP_PICKED = 12
const SHOP_FACES = 24
const FACES_PER_SHOW = 2
const BOOK_SOURCES = new Set(['MANGA', 'COMIC', 'LIGHT_NOVEL', 'WEB_NOVEL', 'NOVEL'])

const byPopularity = (a, b) => (b.popularity || 0) - (a.popularity || 0) || a.id - b.id

/** A shelf card: [title, href, cover, shop name, source]. The page builds the links. */
const shelfRow = (r) => [r.title, `/anime/${r.slug}`, mediumCover(r.cover), recordShopName(r), r.source || '']

/**
 * The lists behind /shop, from the title records that have a page. Every row
 * names a page that exists. The page draws the Amazon links from these at
 * build time, in the US store (a prerendered page has no reader yet).
 *
 *   popular     the most watched anime
 *   books       the most watched anime adapted from a book, for the books row
 *   picked      anime with hand-picked products (their own or their source's);
 *               products matched from publisher records are left out
 *   faces       main characters of the most watched anime, for figure searches
 *   total       how many titles could be shelved (the gate counts this)
 */
export function shopOf(titles) {
  const usable = titles.filter((r) => r.cover && recordShopName(r).length >= 2).sort(byPopularity)
  const popular = usable.slice(0, SHOP_POPULAR)
  const shown = new Set(popular.map((r) => r.id))
  const books = usable.filter((r) => BOOK_SOURCES.has(r.source) && !shown.has(r.id)).slice(0, SHOP_BOOKS)
  const picked = usable
    // The shelf is headed "chosen by hand", so matched products stay on
    // their own title pages.
    .filter((r) => r.picks?.picks?.length && r.picks.byHand !== false)
    .slice(0, SHOP_PICKED)
    .map((r) => ({ title: r.title, href: `/anime/${r.slug}`, cover: mediumCover(r.cover), from: r.picks.from || null, picks: r.picks.picks.slice(0, 3) }))

  const faces = []
  const seenFace = new Set()
  for (const r of usable) {
    if (faces.length >= SHOP_FACES) break
    const show = shortName(recordShopName(r), 4)
    let taken = 0
    for (const c of r.cast || []) {
      if (taken >= FACES_PER_SHOW || faces.length >= SHOP_FACES) break
      const key = c.name.toLowerCase()
      if (c.role !== 'MAIN' || !c.image || seenFace.has(key)) continue
      seenFace.add(key)
      faces.push([c.name, c.image, show, r.title, `/anime/${r.slug}`])
      taken++
    }
  }

  return {
    total: usable.length,
    popular: popular.map(shelfRow),
    books: books.map(shelfRow),
    picked,
    faces,
  }
}
