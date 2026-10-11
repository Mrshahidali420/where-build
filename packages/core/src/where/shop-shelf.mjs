/**
 * The shop shelf of a Where anime title page: its Amazon links as cards a
 * reader can see, the home site's way.
 *
 * Each card carries a drawn object (a book, a disc case, a record sleeve, a
 * figure on its stand, a framed print, a screen) made in CSS around art the
 * record already holds: the cover, the banner and a main character's
 * portrait. No Amazon product photo is ever used: those only come through the
 * Product Advertising API, and copying them breaks the Associates agreement.
 *
 * This file only decides what each card is: which object, which words, which
 * link and which tracking names. Shop.astro draws it. Which rows a show earns
 * and what they say still come from shop.mjs (animeShopRows), and the product
 * links from picks.js, so the tags are the site's own.
 *
 * Pure: `stores` defaults to the site's own, and a test hands in its own.
 */
import { storeFor } from '../lib/shop-links.js'
import { PICK_LABELS } from '../lib/picks-core.js'
import { mediumCover } from '../lib/list-row.js'

/**
 * Amazon's own sign-up page for Prime. Amazon pays a bounty for a trial
 * started from a tagged link, and only for the landing page its rate card
 * names: /prime, not the Prime Video sign-up. The words never name a number
 * of days: the length changes by country and by offer.
 */
export const PRIME_TRIAL = {
  kind: 'trial-prime',
  path: '/prime',
  object: 'screen',
  label: 'Watch with Prime Video',
  cta: 'Start free trial',
}

/** The names AniList gives Amazon's video service in a show's stream list. */
const ON_PRIME = /^amazon|prime video/i

/**
 * The Prime trial card of one anime, in the reader's store with the site's
 * tag. Null on a site with no tag: an untagged trial earns nothing, so the
 * card would only be an advert. The note says the show is listed on Prime
 * Video only when the record's own stream list says so.
 */
export function primeTrial(r, country, stores) {
  const store = storeFor(country, stores)
  if (!store?.tag) return null
  const listed = (r?.watchOn || []).some((w) => ON_PRIME.test(w.site || ''))
  return {
    ...PRIME_TRIAL,
    note: listed ? 'Listed on Prime Video. Free trial for new members' : 'Free trial for new members, on Amazon',
    url: `https://${store.host}${PRIME_TRIAL.path}?tag=${encodeURIComponent(store.tag)}`,
  }
}

// The object drawn for each shop kind and each pick type. Anything unknown
// stands on a base, because a figure is what the merch searches mostly find.
const OBJECT_OF = {
  books: 'book',
  book: 'book',
  discs: 'case',
  disc: 'case',
  games: 'case',
  music: 'sleeve',
  prints: 'frame',
  poster: 'frame',
  apparel: 'tee',
}
export const objectOf = (kind) => OBJECT_OF[kind] || 'stand'

/** The word on the band across a case: a disc case says Blu-ray, a game case Game. */
const stripOf = (kind) => (kind === 'games' ? 'Game' : 'Blu-ray')

// Which of our own pictures each object is drawn around. The portrait is a
// face, so it goes on the figure, the print and the shirt; a book, a case and
// a sleeve show the cover; a screen shows the wide banner.
const ART_OF = {
  book: ['cover'],
  case: ['cover'],
  sleeve: ['cover'],
  screen: ['banner', 'cover'],
  stand: ['portrait', 'cover'],
  frame: ['portrait', 'cover'],
  tee: ['portrait', 'cover'],
}
export function artFor(object, art = {}) {
  for (const key of ART_OF[object] || ['cover']) if (art[key]) return art[key]
  return null
}

/** The pictures a title record holds for its shelf: all our own, none Amazon's. */
export function artOf(r) {
  const face = (r?.cast || []).find((c) => c.role === 'MAIN' && c.image)
  return { cover: mediumCover(r?.cover) || '', banner: r?.banner || '', portrait: face?.image || '' }
}

// The volume number a pick's name gives: "Vol. 1", "Volume 2", or a bare
// number at the end ("My Dress-Up Darling 01"). Null when it names none.
export function volumeOf(name) {
  const text = String(name || '')
  const found = text.match(/\bvol(?:ume)?\.?\s*0*(\d{1,3})\b/i) || text.match(/\s0*(\d{1,2})\s*$/)
  return found ? Number(found[1]) : null
}

const BOX_SET = /box\s*set|collection|books?\s+set|\bset\s+of\b|\bvol(?:ume)?s?\.?\s*\d+\s*-\s*\d+|\bvolumes\s+\d+\s*-\s*\d+/i
export const isBoxSet = (name) => BOX_SET.test(String(name || ''))

// What a book pick is, told from its own name first ("(Light Novel)",
// "(Manga)") and else from the show's source when that is a manga. A light
// novel show's pick can be the novel or its manga, so there nothing is
// guessed and the card says "English edition".
const NOVEL_NAME = /light\s*novel|\(novel\)|\bnovel\s+\d/i
const COMIC_NAME = /\(manga\)|\bmanga\b|\bcomic\b/i
export function bookType(pick, r) {
  const name = String(pick?.n || '')
  if (NOVEL_NAME.test(name)) return 'Light novel'
  if (COMIC_NAME.test(name)) return 'Manga'
  return r?.source === 'MANGA' ? 'Manga' : null
}

/**
 * The small line above a picked product: what it is, in a reader's words.
 * "Manga · Vol. 1", "Manga box set", "Blu-ray", "Figure".
 */
export function pickKicker(pick, r) {
  if (!pick) return ''
  if (pick.t === 'disc') {
    if (/blu-?ray/i.test(pick.n)) return 'Blu-ray'
    if (/\bdvd\b/i.test(pick.n)) return 'DVD'
    return PICK_LABELS.disc
  }
  if (pick.t !== 'book') return PICK_LABELS[pick.t] || 'Merch'
  const type = bookType(pick, r)
  if (isBoxSet(pick.n)) return type ? `${type} box set` : 'Box set'
  const what = type || 'English edition'
  const vol = volumeOf(pick.n)
  return vol ? `${what} · Vol. ${vol}` : what
}

const isFirstVolume = (name) => volumeOf(name) === 1 && !isBoxSet(name)

/**
 * Every card for one title page, in order: the real product first (a pick
 * chosen by hand or matched from publisher records), then one card per search
 * row the show earned, then the trial. `rest` holds the picks after the
 * first, listed under the cards.
 *
 * `pickUrl` is passed in, so the one link builder in picks.js stays the only
 * one. With no pick the first search card carries the lead weight, so the
 * row always opens on its strongest card.
 */
export function shelfCards({ r = null, buys = [], picks = [], trial = null, art = {}, pickUrl }) {
  const cards = []
  const [lead, ...rest] = pickUrl ? picks : []

  if (lead) {
    const object = objectOf(lead.t)
    cards.push({
      aff: `pick_${lead.t}`,
      src: 'pick',
      url: pickUrl(lead.a),
      object,
      strip: 'Blu-ray',
      art: artFor(object, art),
      kicker: pickKicker(lead, r),
      label: lead.n,
      note: 'The exact product, not a search',
      cta: 'View on Amazon',
      tab: object === 'book' && isFirstVolume(lead.n) ? 'Vol. 1' : null,
      lead: true,
    })
  }

  for (const row of buys) {
    const object = objectOf(row.kind)
    cards.push({
      aff: row.kind,
      src: 'buybox',
      url: row.url,
      object,
      strip: stripOf(row.kind),
      art: artFor(object, art),
      kicker: null,
      label: row.label,
      note: row.note,
      cta: row.cta || 'Shop',
      // A books search starts a reader at volume 1; an art book has no volumes.
      tab: object === 'book' && r?.source !== 'ORIGINAL' ? 'Vol. 1' : null,
      lead: false,
    })
  }

  if (trial?.url) {
    cards.push({
      aff: trial.kind,
      src: 'trial',
      url: trial.url,
      object: trial.object,
      strip: '',
      art: artFor(trial.object, art),
      kicker: null,
      label: trial.label,
      note: trial.note,
      cta: trial.cta,
      tab: null,
      lead: false,
    })
  }

  if (cards.length && !cards.some((card) => card.lead)) cards[0] = { ...cards[0], lead: true }

  return { cards, rest: pickUrl ? rest : [] }
}
