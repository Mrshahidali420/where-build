/**
 * Turns the hand-picked Amazon products into data/picks.json.
 *
 * The picks are chosen by hand in the "Amazon Top Picks" page on claude.ai,
 * one document per series or character. That page cannot be read from CI, so
 * its documents are exported to a folder first (one JSON file per document,
 * named `s-<slug>-<anilistId>.json` or `c-<slug>-<anilistId>.json`) and this
 * script turns that folder into the small file the site reads.
 *
 *   node scripts/build-picks.mjs <folder of exported documents>
 *
 * Only what the site needs is kept: the ASIN, a short name and what kind of
 * thing it is. No price, no image, no rating. Those belong to Amazon and are
 * only allowed through its API (see src/lib/shop-links.js).
 */
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { writeJsonAtomic } from '../src/lib/write-atomic.mjs'

const OUT = 'data/picks.json'

// Amazon titles are written for Amazon's search, not for a reader: "Dorohedoro
// Anime Fabric Wall Scroll Poster (32 x 24) Inches". Past this length the
// card wraps to four lines on a phone, so the name is cut at a word.
const NAME_MAX = 70

const ASIN = /\/dp\/([A-Z0-9]{10})(?:[/?]|$)/
// A book's ASIN is its ISBN-10: nine digits and a digit or X.
const ISBN10 = /^\d{9}[\dX]$/

// What the product is, read from its own title. Merch words are tested first,
// because "Berserk Manga Poster" is a poster, not a book.
const TYPES = [
  ['figure', /\b(figures?|figurine|statue|nendoroid|figma|funko|pop!|pop up parade|banpresto|figuarts|luminasta|artfx|play arts|excellent model|chibi figure)\b/i],
  ['plush', /\b(plush|plushie|stuffed)\b/i],
  ['poster', /\b(posters?|wall scroll|art print|canvas|tapestry|wall art)\b/i],
  ['apparel', /\b(t-shirt|shirt|hoodie|tee|sweatshirt|hat|cap|socks)\b/i],
  // Small goods whose titles often carry a number or the word "edition".
  ['merch', /\b(cards?|tcg|keychain|keyring|stickers?|mug|lanyard|bookmark|mouse pad|blind box|acrylic)\b/i],
]

// "Here U Are 2", "Sweet Home T02", "tomo 1": a number or a French/Spanish
// tome number at the end is a volume too.
const BOOK =
  /\b(vol\.?|volume|tomo?|box set|omnibus|anthology|light novel|novel|manga|graphic novel|edition|collection)\b|\s(t\d+|\d+)(?::|$)/i

function typeOf(asin, title) {
  for (const [type, test] of TYPES) if (test.test(title)) return type
  if (ISBN10.test(asin) || BOOK.test(title)) return 'book'
  return 'merch'
}

function shortTitle(title) {
  const clean = String(title || '').replace(/\s+/g, ' ').trim()
  if (clean.length <= NAME_MAX) return clean
  const cut = clean.slice(0, NAME_MAX)
  return cut.slice(0, cut.lastIndexOf(' ')).replace(/[\s,:;\-–(]+$/, '') + '…'
}

// Books first, the first volume leading, then the rest in the order picked.
const ORDER = { book: 0, figure: 1, plush: 2, poster: 3, apparel: 4, merch: 5 }
// "Vol. 1", "Volume 1", "T01", "tomo 1", "Attack on Titan 1", "Tokyo Ghoul, Vol. 1: ...".
const FIRST_VOLUME = /\b(vol\.?|volume|tomo?|t)\s*0?1\b|\s0?1(?::|$)/i
const rank = (pick, title) => ORDER[pick.t] * 2 + (pick.t === 'book' && !FIRST_VOLUME.test(title) ? 1 : 0)

function picksOf(doc) {
  const seen = new Set()
  const out = []
  ;(doc.links || []).forEach((link, at) => {
    const asin = (String(link).match(ASIN) || [])[1]
    if (!asin || seen.has(asin)) return
    seen.add(asin)
    const title = (doc.titles || [])[at] || ''
    if (!title) return
    const pick = { a: asin, n: shortTitle(title), t: typeOf(asin, title) }
    out.push({ pick, key: rank(pick, title) })
  })
  // Array sort is stable, so picks of the same rank keep the order they were picked in.
  return out.sort((x, y) => x.key - y.key).map((row) => row.pick)
}

function main(folder) {
  if (!folder) {
    console.error('Usage: node scripts/build-picks.mjs <folder of exported documents>')
    process.exit(1)
  }
  const titles = {}
  const characters = {}
  let count = 0
  for (const file of readdirSync(folder).sort()) {
    const m = file.match(/^([sc])-.*-(\d+)\.json$/)
    if (!m) continue
    const doc = JSON.parse(readFileSync(join(folder, file), 'utf8'))
    const picks = picksOf(doc)
    if (!picks.length) continue
    ;(m[1] === 's' ? titles : characters)[m[2]] = picks
    count += picks.length
  }
  writeJsonAtomic(OUT, { updated: new Date().toISOString().slice(0, 10), titles, characters })
  console.log(
    `${OUT}: ${Object.keys(titles).length} titles, ${Object.keys(characters).length} characters, ${count} picks`
  )
}

main(process.argv[2])
