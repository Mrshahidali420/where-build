/**
 * The words on the buy pages.
 *
 * A buy page answers one question: "I want to own this, where do I get it?"
 * That is a different question from "where can I read it", so it gets its own
 * page rather than a box at the bottom of another one.
 *
 * Every sentence here is written from the record we already hold, so a title
 * added tomorrow gets a full page with no hand editing. Nothing here invents a
 * price, a stock level or an edition: we hold no product data and we are not
 * allowed to hold any until Amazon opens their API to us. See shop-links.js.
 *
 * It imports only the small word helpers. No catalog, no network.
 */
import { wordOf, verbOf, listWords } from './answers.mjs'

/**
 * How popular a story must be before it earns a buy page.
 *
 * Under this line the story was almost certainly never printed in English, so
 * every shop link would open an empty shelf. An empty shelf earns nothing,
 * helps nobody, and a few thousand of them would make the site look like a
 * doorway farm. The title page still carries its buy box, so nothing is lost.
 */
export const BUY_POPULARITY = 10000

/**
 * A story is sold under more than one name.
 *
 * "Solo Leveling" is printed as "Na Honjaman Level Up" and as "Only I Level
 * Up". A buyer who knows only the fan name types that name, and a page that
 * never says that name cannot answer them. AniList already keeps the list, so
 * every buy page can carry it at no cost.
 *
 * Only Latin-script names are kept. The native name gets its own line, and a
 * Russian or Chinese alias helps nobody reading this page in English.
 */
const LATIN = /^[ -~À-ɏ'’!?.,:&()-]+$/

const sameWord = (a, b) => String(a || '').toLowerCase() === String(b || '').toLowerCase()

/** Every other name this story is sold under, best first. */
export function otherNames(item) {
  const out = []
  for (const name of [item.titleRomaji, ...(item.synonyms || [])]) {
    const clean = String(name || '').trim()
    if (!clean || !LATIN.test(clean)) continue
    if (sameWord(clean, item.title)) continue
    if (out.some((kept) => sameWord(kept, clean))) continue
    out.push(clean)
  }
  return out.slice(0, 5)
}

/** The same job for a person. AniList calls their list `aliases`. */
export function otherCharNames(person) {
  const out = []
  for (const name of person.aliases || []) {
    const clean = String(name || '').trim()
    if (!clean || !LATIN.test(clean)) continue
    if (sameWord(clean, person.name)) continue
    if (out.some((kept) => sameWord(kept, clean))) continue
    out.push(clean)
  }
  return out.slice(0, 4)
}

/**
 * One alias, set beside the real name in the title tag.
 *
 * Only while the pair still fits what a phone shows. A bracket that opens on
 * screen and never closes reads as broken, so a long alias is dropped whole
 * rather than cut in half.
 */
const withAlias = (name, names, room = 46) =>
  names.length && name.length + names[0].length <= room
    ? `${name} (${names[0]})`
    : name

const unquote = (text) =>
  String(text || '')
    .split('"')
    .join('')
    .split('“')
    .join('')
    .split('”')
    .join('')
    .replace(/\s+/g, ' ')
    .trim()

const capitalise = (text) => String(text || '').charAt(0).toUpperCase() + String(text || '').slice(1)

/** Trim a description to what a search result will actually print. */
const fit = (lines, cap = 165) => lines.find((line) => line.length <= cap) || lines[lines.length - 1]

// ------------------------------------------------------------------- a title

/**
 * Everything the title buy page prints.
 *
 * `item` is the full title record. `kind` is the url word: manhwa, manga,
 * manhua or anime.
 */
export function buyAnswer(item, kind) {
  const title = unquote(item.title)
  const word = wordOf(kind)
  const verb = verbOf(kind)
  const isComic = item.kind !== 'anime'
  const authors = (item.authors || []).map((a) => a.name).filter(Boolean).slice(0, 2)
  const by = authors.length ? ` by ${listWords(authors)}` : ''
  const volumes = isComic && item.volumes ? item.volumes : 0
  const chapters = isComic && item.chapters ? item.chapters : 0
  const episodes = !isComic && item.episodes ? item.episodes : 0
  const studio = !isComic && item.studios && item.studios[0] ? item.studios[0] : ''
  const running = item.status === 'RELEASING'
  const names = otherNames(item)

  // The title tag. The story's whole name stays in it however long it runs:
  // Google cuts what it shows on a phone but still reads the rest, and the
  // rest is what decides which search this page answers.
  // The alias rides along in the title tag, because "buy na honjaman level
  // up" is a different search from "buy solo leveling" and both are buyers.
  const sold = withAlias(title, names)
  const pageTitle = isComic
    ? `Buy ${sold} — ${word} volumes, figures and merch`
    : `Buy ${sold} — Blu-ray, DVD, figures and merch`

  const heading = `Where to buy ${title}`

  const goods = isComic
    ? 'Printed volumes, figures, art books and posters'
    : 'Discs, figures, art books and posters'

  // Honest claims only. The links open Amazon's live search, which can show
  // other sellers and other editions, so we never promise "official" or "no
  // fakes". And AniList's volume count is the ORIGINAL release, not an English
  // print run, so it is always called that.
  const description = fit([
    `${goods} for ${title}${by}. Opens Amazon's live search in your own country's store. ${
      volumes ? `${volumes} volumes in the original release.` : ''
    }`.trim(),
    `${goods} for ${title}. Opens Amazon's live search in your own country's store.`,
    `Where to buy ${title}: books, discs, figures and merch.`,
  ])

  // The opening line. It says what exists before it asks for a tap.
  const lede = isComic
    ? volumes
      ? `${title}${by} runs to ${volumes} ${volumes === 1 ? 'volume' : 'volumes'} in its original release${
          running ? ' so far' : ''
        }. The links below open Amazon's live search for them, and for the figures and merch made for the story.`
      : `${title} is a ${word}${by}. The links below open Amazon's live search for it in print, and for the figures and merch made for the story.`
    : `${title} is an anime${studio ? ` from ${studio}` : ''}${
        episodes ? `, ${episodes} ${episodes === 1 ? 'episode' : 'episodes'} long` : ''
      }. The links below open Amazon's live search for the disc release, and for the figures and merch made for it.`

  const paragraphs = []

  paragraphs.push({
    heading: `What you can own of ${title}`,
    text: isComic
      ? `${
          volumes
            ? `The original release stands at ${volumes} ${volumes === 1 ? 'volume' : 'volumes'}${
                running ? ', and it is still going' : ''
              }. An English edition, where one exists, can have fewer.`
            : `We do not hold a volume count for ${title} yet.`
        } ${
          chapters ? `There are ${chapters} chapters in all. ` : ''
        }Whether an English edition exists depends on the publisher, not on us, so the book link opens a live search rather than a page we wrote. If the shelf comes back empty, that is the honest answer: nobody has printed it in your language yet. The merch link searches the figure shelf instead, which is often stocked even when the books are not.`
      : `${
          episodes ? `There are ${episodes} ${episodes === 1 ? 'episode' : 'episodes'}. ` : ''
        }A disc set only exists if a distributor licensed ${title} for your region, and that is their decision, not ours. The disc link opens a live search so you see what is really in print today. The merch link searches the figure shelf, which usually stays stocked long after the discs go out of print.`,
  })

  if (names.length) {
    paragraphs.push({
      heading: `Other names for ${title}`,
      text: `${title} is also sold as ${listWords(names)}${
        item.titleNative ? `, and as ${item.titleNative} in its own language` : ''
      }. A publisher picks one name for the cover, and a shop copies whatever the cover says, so the same story can sit under two names in the same shop. If a search below comes back empty, type one of these other names into the shop own box instead. It is the same story and the same volumes.`,
    })
  }

  paragraphs.push({
    heading: 'Why there are no prices on this page',
    text: `We are an index, not a shop. We hold no stock, take no payment and ship nothing. Showing a price would mean keeping our own copy of Amazon's data, and a kept price goes wrong within hours. So every link here opens the shop itself with the name already typed in. The price, the edition and the stock you see are the shop's own, and they are right at the second you look.`,
  })

  const faq = []

  faq.push({
    q: `Where can I buy ${title}?`,
    a: isComic
      ? `Through the Amazon links on this page. They open Amazon in your own country's store with ${title} already searched, so you see the editions on sale today. Check the seller and the publisher on the listing before you buy.`
      : `Through the Amazon links on this page. They open Amazon in your own country's store and search for the ${title} disc release and merch.`,
  })

  if (volumes) {
    faq.push({
      q: `How many volumes of ${title} are there?`,
      a: `${volumes} ${volumes === 1 ? 'volume' : 'volumes'} in the original release${
        running
          ? ', and more are still coming: the story has not finished yet.'
          : `, and the story is complete at that.`
      }${chapters ? ` That is ${chapters} chapters in all.` : ''}`,
    })
  }

  if (names.length) {
    faq.push({
      q: `Is ${title} the same as ${names[0]}?`,
      a: `Yes. One story, more than one name. ${title} is also sold as ${listWords(
        names,
      )}. Whichever name is printed on the cover, the story inside is the same one, and the shop links on this page cover all of them.`,
    })
  }

  faq.push({
    q: `Are there ${title} figures?`,
    a: `Figures are only made for stories that sold enough to pay for the mould, so we cannot promise one exists. The merch link on this page searches the figure shelf for ${title}, and what comes back is what is really being sold.`,
  })

  faq.push({
    q: `Can I ${verb} ${title} for free instead?`,
    a: `Sometimes, yes, and legally. Some official platforms give part of a story away to bring readers in. Our free page for ${title} lists every one that does, and says plainly when none does.`,
  })

  return { pageTitle, heading, description, lede, paragraphs, faq, word, verb, isComic, names }
}

// --------------------------------------------------------------- a character

/**
 * Everything the character buy page prints.
 *
 * `merchIsCharacter` says whether the shop rows are really about this person
 * (figures, prints, apparel) or fell back to the story's own books. The page
 * must not promise a figure when it is offering a paperback.
 */
export function characterBuyAnswer(person, lead, series, leadKind, merchIsCharacter) {
  const who = unquote(person.name)
  const from = unquote(lead.title)
  const word = wordOf(leadKind)
  const verb = verbOf(leadKind)
  const isMain = lead.role === 'MAIN'
  const names = otherCharNames(person)

  // Only the AniList name rides in the title tag ("Sung Jin-Woo (Jin-U
  // Seong)"), and only when the page leads with a different one. A first
  // alias is often a nickname ("Erwin Smith (Eyebrow)"), which reads as a
  // joke in a search result. The nicknames still show on the page itself.
  const called = person.formalName ? withAlias(who, [unquote(person.formalName)], 34) : who
  const pageTitle = merchIsCharacter
    ? `Buy ${called} figures and merch — ${from}`
    : `Buy ${called} merch — ${from} ${word} and figures`

  const heading = `Where to buy ${who} merch`

  const description = fit([
    `${
      merchIsCharacter ? 'Figures, posters and apparel' : 'Books, figures and posters'
    } of ${who} from the ${word} ${from}. Opens Amazon's live search in your own country's store.`,
    `${who} merch from ${from}: figures, posters and apparel, on Amazon.`,
    `Where to buy ${who} merch from ${from}.`,
  ])

  const lede = merchIsCharacter
    ? `${who} is ${isMain ? 'a main character' : 'a character'} in the ${word} ${from}, and ${from} is big enough that merch of ${who} is really made. The links below search Amazon for figures, wall art and apparel.`
    : `${who} is ${isMain ? 'a main character' : 'a character'} in the ${word} ${from}. ${from} is not big enough for figures of one named character yet, so the honest offer is the story itself: the printed volumes and the merch made for the series.`

  const paragraphs = []

  paragraphs.push({
    heading: merchIsCharacter ? `What ${who} merch exists` : `What you can own of ${from}`,
    text: merchIsCharacter
      ? `A figure of one named character only gets made when the story sold enough copies to pay for the mould. ${from} passed that line, so ${who} shows up on the figure shelf, on posters and on shirts. What we cannot promise is which pose, which scale or which price: those change week to week. Each link opens a live search of the shop so you see what is really being sold today, not a listing we wrote months ago.`
      : `Nobody has made a figure of ${who} that we can find, and we would rather say so than send you to an empty shelf. What does exist is ${from} itself: the printed volumes, and whatever merch carries the series name. Those links are below. If ${from} grows, this page grows with it: the shelves are chosen from the story's own numbers and are re-checked every day.`,
  })

  if (names.length) {
    paragraphs.push({
      heading: `Other names for ${who}`,
      text: `${who} is also written as ${listWords(names)}${
        person.native ? `, and as ${person.native} in the original` : ''
      }. A name that crosses from one language to another rarely arrives spelled the same way twice, and a box in a shop carries whichever spelling that shop used. If one spelling finds nothing on the shelf, try the next one.`,
    })
  }

  paragraphs.push({
    heading: 'Why there are no prices on this page',
    text: `We are an index, not a shop. We hold no stock, take no payment and ship nothing. A price copied out of a shop goes stale within hours, so we keep none. Every link opens the shop itself with the name already typed in, and the price, the edition and the stock you see are the shop's own at the second you look.`,
  })

  const faq = []

  faq.push({
    q: `Is there a ${who} figure?`,
    a: merchIsCharacter
      ? `${from} is popular enough that figures of its cast are made and sold, so a ${who} figure is likely. We hold no stock list, so the figure link on this page searches the real shelf and shows you what is there right now.`
      : `We cannot find one. ${from} has not sold at the level that pays for a character figure. The links on this page search for the story itself instead.`,
  })

  if (names.length) {
    faq.push({
      q: `Is ${who} the same person as ${names[0]}?`,
      a: `Yes. ${who} is also written as ${listWords(
        names,
      )}. One character, more than one spelling of the same name.`,
    })
  }

  faq.push({
    q: `What is ${who} from?`,
    a: `${who} is ${isMain ? 'a main character' : 'a character'} in ${from}, a ${word}${
      series && series.startYear ? ` that started in ${series.startYear}` : ''
    }. You can see every title ${who} appears in, and where to ${verb} each one legally, on their profile page.`,
  })

  faq.push({
    q: `Where can I buy a ${who} poster?`,
    a: merchIsCharacter
      ? `The wall art link on this page searches posters, canvases and art books for ${who} in your own country's Amazon store.`
      : `Posters of one character are rare for a story this size. The merch link on this page searches the ${from} shelf, which is where art of ${who} would sit if it exists.`,
  })

  return { pageTitle, heading, description, lede, paragraphs, faq, word, verb, names }
}

export { capitalise }
