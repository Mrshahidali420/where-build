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
import { shopUrl, shopName, shortName, VIDEO, BOOKS, TOYS, ALL, FIGURE_POPULARITY } from '../lib/shop-links.js'
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

/** How many AniList members a show needs before figures of it are likely to exist. */
export const MERCH_FROM = 10000
/** Posters and apparel are made for fewer shows than figures are. */
export const PRINTS_FROM = FIGURE_POPULARITY
/** Formats that are sold on disc as a matter of course; a web series needs an audience first. */
const DISC_FORMATS = new Set(['TV', 'TV_SHORT', 'MOVIE', 'OVA', 'SPECIAL'])

const creatorOf = (r) => (r.key || []).find((k) => k.label === 'Original creator')?.people?.[0]?.name || ''
const popular = (r, from) => (r.popularity || 0) >= from

/** Whether a disc of this show can exist yet: it has aired, in a format that gets one. */
function hasDiscs(r) {
  if (r.status === 'NOT_YET_RELEASED') return false
  return DISC_FORMATS.has(r.format) || (r.format === 'ONA' && popular(r, MERCH_FROM))
}

/** What the disc row says about this show: the film, the whole run, or the volumes so far. */
function discNote(r) {
  if (r.format === 'MOVIE') return r.startYear ? `The ${r.startYear} film on disc, where one was made` : 'The film on disc, where one was made'
  if (r.status === 'RELEASING') return 'The first volumes, as they come out'
  if (r.episodes > 1) return `All ${r.episodes} episodes, where a set was made`
  return 'The disc release, where one was made'
}

/** A book row for this source, or null when the source is not sold as a book. */
function sourceRow(r, name, country, stores) {
  const known = SOURCE_ROWS[r.source]
  if (known) {
    // An original anime only has art books once it has an audience.
    if (r.source === 'ORIGINAL' && !popular(r, MERCH_FROM)) return null
    const creator = r.source === 'ORIGINAL' ? '' : creatorOf(r)
    return { kind: 'books', icon: 'book', label: known.label, note: creator ? `${known.note}, by ${creator}` : known.note, cta: 'Shop books', url: shopUrl(`${name} ${known.terms}`, BOOKS, country, stores) }
  }
  if (GAME_SOURCES.has(r.source)) {
    return { kind: 'games', icon: 'disc', label: 'The game it came from', note: 'The original game and its editions', cta: 'Shop games', url: shopUrl(`${name} game`, ALL, country, stores) }
  }
  return null
}

/** The soundtrack row, named after the first opening (else the first song) the page lists. */
function musicRow(r, name, country, stores) {
  const songs = r.songs || []
  const song = songs.find((s) => s.type === 'OP') || songs[0]
  if (!song?.title) return null
  const by = song.artists?.[0]?.name
  return { kind: 'music', icon: 'music', label: 'Soundtrack and theme songs', note: `With “${song.title}”${by ? ` by ${by}` : ''}`, cta: 'Shop music', url: shopUrl(`${name} soundtrack`, ALL, country, stores) }
}

/** The figures row, named after the show's first two main characters when it has them. */
function merchRow(r, name, country, stores) {
  const mains = (r.cast || []).filter((c) => c.role === 'MAIN' && c.name).slice(0, 2).map((c) => c.name)
  const note = mains.length ? `${mains.join(' and ')}, as scale figures and plushies` : 'Scale figures, plushies and collectibles'
  return { kind: 'merch', icon: 'figure', label: 'Figures and plushies', note, cta: 'Shop figures', url: shopUrl(`${name} anime`, TOYS, country, stores) }
}

/**
 * The buy rows of one anime title page (a title shard record,
 * src/where/record-title.mjs). Empty when the record has no usable name.
 * Each row is there because this record earns it, and its note is written
 * from the record:
 *
 *   discs    the show has aired, in a format that is sold on disc
 *   books    the source is sold as books (and was not checked and found
 *            unprinted), or the game it came from
 *   music    the page lists a theme song
 *   merch    enough people follow the show for figures to exist
 *   prints   the same, for the few shows big enough for posters and apparel
 *
 * Discs lead, because an anime page is about the show itself. A show that
 * earns no row at all still gets the figures search, so the box never
 * renders empty where the page draws it.
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
  const rows = [
    hasDiscs(r) ? { kind: 'discs', icon: 'disc', label: 'Blu-ray and DVD', note: discNote(r), cta: 'Shop discs', url: shopUrl(`${name} anime`, VIDEO, country, stores) } : null,
    noBooks ? null : sourceRow(r, name, country, stores),
    musicRow(r, name, country, stores),
    popular(r, MERCH_FROM) ? merchRow(r, name, country, stores) : null,
    popular(r, PRINTS_FROM) ? { kind: 'prints', icon: 'poster', label: 'Posters and apparel', note: 'Wall scrolls, prints, shirts and hoodies', cta: 'Shop posters', url: shopUrl(`${name} anime poster`, ALL, country, stores) } : null,
  ].filter(Boolean)
  return rows.length ? rows : [merchRow(r, name, country, stores)]
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
