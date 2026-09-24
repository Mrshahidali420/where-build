import {
  comics,
  novels,
  novelsByPopularity,
  anime,
  charactersWithPages,
  genres,
  comicsOfCountry,
  animeByPopularity,
  platformHubs,
} from './catalog.js'
import { filtersFor } from './filters.js'
import { genreDeepPaths } from './genre-lists.js'
import { seasonHubs } from './seasons.mjs'
import { sectionOf } from './section.mjs'
import { MOODS } from './moods.mjs'
import { watchListPages } from './watch-list-data.js'
// Written by scripts/make-shards.mjs on every build. It holds only the answer
// pages that passed their own gate, so the sitemap never offers a thin page.
import answerUrls from '@site/data/answer-urls.json'
import config from './site.mjs'
import { hasRoute } from './define-site.mjs'

export const SITE = config.siteUrl

// The listing routes build every page now, so the sitemap lists every page.
// The old cap of 100 matched a cap in the routes; both went on 22 Sep 2026.
const PER_PAGE = 60
const CHARACTERS_PER_PAGE = 120

// Google accepts 50,000 URLs per file. We stay far below that so each file
// downloads fast and a crawler can finish one in a single pass.
const CHUNK = 5000

// Only what this site builds is listed: a group of pages it does not switch
// on in its config (`routes`, see src/lib/routes.mjs) never reaches a sitemap.
const on = (key) => hasRoute(config, key)

/** Hubs, browse shelves, filters, genres and pagination: the site's skeleton. */
function coreUrls() {
  const urls = []
  if (on('home')) urls.push({ loc: SITE, priority: '1.0' })
  if (on('titles')) {
    for (const kind of ['manhwa', 'manga', 'manhua', 'novel', 'anime']) {
      urls.push({ loc: `${SITE}/${kind}`, priority: '0.9' })
    }
  }
  if (on('characters')) urls.push({ loc: `${SITE}/character`, priority: '0.9' })
  if (on('genres')) urls.push({ loc: `${SITE}/genre`, priority: '0.9' })
  if (on('whereToRead')) urls.push({ loc: `${SITE}/where-to-read`, priority: '0.9' })
  if (on('whereToWatch')) {
    urls.push({ loc: `${SITE}/where-to-watch`, priority: '0.9' })
    // The "with an anime" lists under it, and their deeper pages.
    urls.push(...watchListPages().map(({ path, page }) => ({ loc: `${SITE}${path}`, priority: page === 1 ? '0.8' : '0.4' })))
  }
  if (on('schedule')) urls.push({ loc: `${SITE}/schedule`, priority: '0.9' })
  if (on('moods')) {
    urls.push({ loc: `${SITE}/mood`, priority: '0.9' })
    urls.push(...MOODS.map((mood) => ({ loc: `${SITE}/mood/${mood.slug}`, priority: '0.8' })))
  }
  if (on('shop')) urls.push({ loc: `${SITE}/shop`, priority: '0.7' })
  if (on('about')) urls.push({ loc: `${SITE}/about`, priority: '0.5' })
  if (on('contact')) urls.push({ loc: `${SITE}/contact`, priority: '0.4' })
  if (on('privacy')) urls.push({ loc: `${SITE}/privacy`, priority: '0.3' })
  if (on('dmca')) urls.push({ loc: `${SITE}/dmca`, priority: '0.3' })

  if (on('titles')) {
    const shelves = {
      manhwa: comicsOfCountry('KR'),
      manga: comicsOfCountry('JP'),
      manhua: comicsOfCountry('CN'),
      novel: novelsByPopularity,
      anime: animeByPopularity,
    }
    for (const [kind, items] of Object.entries(shelves)) {
      for (const [filter, def] of filtersFor(kind)) {
        if (items.some((item) => def.keep(item, kind))) {
          urls.push({ loc: `${SITE}/${kind}/only/${filter}`, priority: '0.6' })
        }
      }
    }
  }

  // One hub per official platform. These are the pages that answer
  // "what can I read on X", so they sit high in the crawl order.
  if (on('platforms')) {
    for (const hub of platformHubs) {
      urls.push({ loc: `${SITE}/platform/${hub.slug}`, priority: '0.8' })
    }
  }

  // One hub per anime season, plus its deeper pages, for searches like
  // "fall 2025 anime". Only seasons that earned a hub are listed.
  if (on('seasons')) {
    urls.push({ loc: `${SITE}/anime/season`, priority: '0.8' })
    for (const hub of seasonHubs) {
      urls.push({ loc: `${SITE}${hub.path}`, priority: '0.7' })
      for (let page = 2; page <= hub.pages; page++) {
        urls.push({ loc: `${SITE}${hub.path}/${page}`, priority: '0.4' })
      }
    }
  }

  if (on('genres')) {
    for (const g of genres) {
      urls.push({ loc: `${SITE}/genre/${g.slug}`, priority: '0.7' })
    }
    // The deeper genre pages: per-kind listings and their numbered pages, and
    // the four picks. genreDeepPaths() is the same list the routes build from.
    for (const { path, page } of genreDeepPaths()) {
      urls.push({ loc: `${SITE}${path}`, priority: page === 1 ? '0.6' : '0.4' })
    }
  }

  if (on('titles')) {
    const counts = {
      manhwa: comics.filter((c) => c.country === 'KR').length,
      manga: comics.filter((c) => c.country === 'JP').length,
      manhua: comics.filter((c) => c.country === 'CN' || c.country === 'TW').length,
      novel: novels.length,
      anime: anime.length,
    }
    for (const [kind, total] of Object.entries(counts)) {
      for (let page = 2; page <= Math.ceil(total / PER_PAGE); page++) {
        urls.push({ loc: `${SITE}/${kind}/page/${page}`, priority: '0.4' })
      }
    }
  }
  if (on('characters')) {
    for (let page = 2; page <= Math.ceil(charactersWithPages.length / CHARACTERS_PER_PAGE); page++) {
      urls.push({ loc: `${SITE}/character/page/${page}`, priority: '0.4' })
    }
  }

  return urls
}

const comicUrls = (country) =>
  comics
    .filter((c) => (country === 'CN' ? c.country === 'CN' || c.country === 'TW' : c.country === country))
    .map((item) => ({
      loc: `${SITE}/${sectionOf(item)}/${item.slug}`,
      // Pages that answer the question get crawled first.
      priority: item.readLinks.length > 0 ? '0.8' : '0.5',
      image: item.cover,
      caption: `Cover of ${item.title}`,
    }))

const otherComicUrls = () =>
  comics
    .filter((c) => !['KR', 'JP', 'CN', 'TW'].includes(c.country))
    .map((item) => ({
      loc: `${SITE}/manga/${item.slug}`,
      priority: item.readLinks.length > 0 ? '0.8' : '0.5',
      image: item.cover,
      caption: `Cover of ${item.title}`,
    }))

const novelUrls = () =>
  novels.map((item) => ({
    loc: `${SITE}/novel/${item.slug}`,
    priority: item.readLinks.length > 0 ? '0.8' : '0.5',
    image: item.cover,
    caption: `Cover of ${item.title}`,
  }))

const animeUrls = () =>
  anime.map((item) => ({
    loc: `${SITE}/anime/${item.slug}`,
    priority: item.watchLinks.length > 0 ? '0.8' : '0.5',
    image: item.cover,
    caption: `Cover of ${item.title}`,
  }))

const characterUrls = () =>
  charactersWithPages.map((person) => ({
    loc: `${SITE}/character/${person.slug}`,
    priority: '0.6',
    image: person.image,
    caption: `${person.name} portrait`,
  }))

/** Split a long list into numbered parts, so no single file is huge. */
function split(name, urls) {
  if (urls.length <= CHUNK) return urls.length ? [{ name, urls }] : []
  const parts = []
  for (let i = 0; i < urls.length; i += CHUNK) {
    parts.push({ name: `${name}-${parts.length + 1}`, urls: urls.slice(i, i + CHUNK) })
  }
  return parts
}

/**
 * Every sub-sitemap, in crawl order: skeleton first, then titles, then
 * characters. Each entry becomes one /sitemap-<name>.xml file.
 */
export const sitemapParts = [
  ...split('core', coreUrls()),
  ...(on('titles')
    ? [
        ...split('manhwa', comicUrls('KR')),
        ...split('manga', [...comicUrls('JP'), ...otherComicUrls()]),
        ...split('manhua', comicUrls('CN')),
        ...split('novel', novelUrls()),
        ...split('anime', animeUrls()),
      ]
    : []),
  ...(on('characters') ? split('character', characterUrls()) : []),
  ...(on('answers')
    ? [
        ...split('answers-free', answerUrls.free.map((path) => ({ loc: `${SITE}${path}`, priority: '0.7' }))),
        ...split('answers-like', answerUrls.like.map((path) => ({ loc: `${SITE}${path}`, priority: '0.6' }))),
        ...split('answers-buy', (answerUrls.buy || []).map((path) => ({ loc: `${SITE}${path}`, priority: '0.7' }))),
      ]
    : []),
  ...(on('characters')
    ? split('character-buy', (answerUrls.charBuy || []).map((path) => ({ loc: `${SITE}${path}`, priority: '0.6' })))
    : []),
  ...(on('answers')
    ? split('answers-cast', (answerUrls.cast || []).map((path) => ({ loc: `${SITE}${path}`, priority: '0.6' })))
    : []),
]

export const today = () => new Date().toISOString().slice(0, 10)

// A title, a cover URL or a character name can hold a character XML treats as
// markup. One unescaped "&" makes the whole file unparseable, so every value
// that reaches the XML goes through here first.
const xml = (text) =>
  String(text == null ? '' : text)
    .split('&')
    .join('&amp;')
    .split('<')
    .join('&lt;')
    .split('>')
    .join('&gt;')
    .split('"')
    .join('&quot;')
    .split("'")
    .join('&apos;')

/**
 * One <image:image> child per URL that owns a picture.
 *
 * Every cover and every portrait is a real picture people search for by the
 * name of the story. Left alone, Google must find ~107,000 of them by
 * crawling each page. Naming them here hands Google Images the list.
 */
const imageTag = (u) =>
  u.image
    ? `<image:image><image:loc>${xml(u.image)}</image:loc><image:title>${xml(u.caption)}</image:title></image:image>`
    : ''

export function urlsetXml(urls) {
  const day = today()
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${urls
  .map(
    (u) =>
      `  <url><loc>${xml(u.loc)}</loc><lastmod>${day}</lastmod><priority>${u.priority}</priority>${imageTag(u)}</url>`,
  )
  .join('\n')}
</urlset>
`
}
