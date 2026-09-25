/**
 * The "My list" rows and the "For you" pool, shared by both builds: the
 * catalog build (scripts/make-shards.mjs) and a Where build
 * (scripts/make-where.mjs). The browser side reads them through
 * src/lib/list-data.js; the row positions live in src/lib/list-row.js.
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { LIST_SHARDS, listBucket } from '../src/lib/shard-key.js'
import { ROW_SITES_MAX, ROW_ADAPT_MAX, coverFileOf } from '../src/lib/list-row.js'
import { sectionOf, SECTIONS } from '../src/lib/section.mjs'

const kindOf = sectionOf

/** The same medium? A comic sequel is a comic, an anime sequel is an anime. */
export const sameMedium = (a, b) => (a.kind === 'anime') === (b.kind === 'anime')

export const ADAPT_RELATIONS = new Set(['ADAPTATION', 'SOURCE'])

/*
 * "My list" rows and the "For you" pool.
 *
 * A reader's list lives in their own browser (src/lib/my-list.js). To show a
 * saved title's platforms, its next episode or whether it has finished, the
 * page needs a few live facts about it, and it cannot load the catalog. So
 * each title gets one short row, filed by AniList id into LIST_SHARDS small
 * files. A list page loads only the files its own titles live in.
 *
 * The For you block needs something to recommend FROM. That is one pool
 * file: the most popular titles of every section, with their genres and
 * tags as numbers. Only a reader who has a list ever downloads it.
 *
 * Both are plain static files. Cloudflare serves them without running the
 * Worker, so they cost no Worker requests and no CPU at all.
 */
const FEED_PER_SECTION = 400
const FEED_TOP_TAGS = 150
const FEED_GENRES_PER_TITLE = 4
const FEED_TAGS_PER_TITLE = 6
const FEED_REL_PER_TITLE = 6
const FEED_AIRING_DAYS = 14

const unique = (list) => [...new Set(list)]

/** The official platforms a row names: read links for a comic, watch links for an anime. */
const sitesOf = (item) =>
  unique(((item.kind === 'anime' ? item.watchLinks : item.readLinks) || []).map((l) => l.site))
    .filter(Boolean)
    .slice(0, ROW_SITES_MAX)

/** The anime made from a comic, or the comic behind an anime, as ids we hold. */
export const adaptIdsOf = (item, byId) =>
  unique(
    (item.relations || [])
      .filter((rel) => ADAPT_RELATIONS.has(rel.relation))
      .map((rel) => byId.get(rel.id))
      .filter((found) => found && !sameMedium(item, found))
      .map((found) => found.id)
  )

/** One row; the positions are fixed in src/lib/list-row.js. */
export function listRowOf(item, byId, recsInIndex, nowSec) {
  const isAnime = item.kind === 'anime'
  const adapt = adaptIdsOf(item, byId)
  // An episode time already in the past is stale data, not a countdown.
  const next = item.nextEpisode && item.nextEpisode.at > nowSec ? item.nextEpisode : null
  return [
    kindOf(item),
    item.slug,
    item.status || '',
    next ? next.at : 0,
    next ? next.number || 0 : 0,
    (isAnime ? item.episodes : item.chapters) || 0,
    sitesOf(item),
    item.popularity || 0,
    isAnime ? adapt[0] || 0 : 0,
    isAnime ? [] : adapt.slice(0, ROW_ADAPT_MAX),
    recsInIndex.get(item.id) || [],
  ]
}

export function writeListShards(dir, titles, byId, recsInIndex, nowSec) {
  const shards = Array.from({ length: LIST_SHARDS }, () => ({}))
  for (const item of titles) {
    shards[listBucket(item.id)][item.id] = listRowOf(item, byId, recsInIndex, nowSec)
  }
  mkdirSync(dir, { recursive: true })
  let bytes = 0
  let biggest = 0
  for (let n = 0; n < LIST_SHARDS; n++) {
    const text = JSON.stringify(shards[n])
    writeFileSync(join(dir, `${n}.json`), text)
    bytes += text.length
    biggest = Math.max(biggest, text.length)
  }
  return { count: LIST_SHARDS, bytes, biggest }
}

/** Names most used first, so the commonest genre and tag get the smallest numbers. */
function tallyNames(titles, field) {
  const tally = new Map()
  for (const item of titles) {
    for (const name of item[field] || []) tally.set(name, (tally.get(name) || 0) + 1)
  }
  return [...tally.entries()]
    .sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))
    .map(([name]) => name)
}

export function writeFeedPool(file, titles, byId, recsInIndex, nowSec) {
  const genres = tallyNames(titles, 'genres')
  const tags = tallyNames(titles, 'tags').slice(0, FEED_TOP_TAGS)
  const genreAt = new Map(genres.map((name, i) => [name, i]))
  const tagAt = new Map(tags.map((name, i) => [name, i]))

  const bySection = new Map(SECTIONS.map((ns) => [ns, []]))
  for (const item of titles) {
    if (!item.cover) continue
    bySection.get(kindOf(item))?.push(item)
  }

  const items = []
  for (const [ns, list] of bySection) {
    list.sort((a, b) => (b.popularity || 0) - (a.popularity || 0))
    for (const item of list.slice(0, FEED_PER_SECTION)) {
      items.push([
        item.id,
        SECTIONS.indexOf(ns),
        item.slug,
        item.title,
        coverFileOf(item.cover),
        item.score || 0,
        item.popularity || 0,
        (item.genres || []).filter((g) => genreAt.has(g)).slice(0, FEED_GENRES_PER_TITLE).map((g) => genreAt.get(g)),
        (item.tags || []).filter((t) => tagAt.has(t)).slice(0, FEED_TAGS_PER_TITLE).map((t) => tagAt.get(t)),
        unique([...adaptIdsOf(item, byId), ...(recsInIndex.get(item.id) || [])]).slice(0, FEED_REL_PER_TITLE),
      ])
    }
  }

  // Every anime with an episode due in the next two weeks. The homepage
  // crosses this with the reader's list for "Your list this week", so it
  // never has to load the list rows just to say what airs soon.
  const horizon = nowSec + FEED_AIRING_DAYS * 86400
  const airing = titles
    .filter((item) => item.kind === 'anime' && item.nextEpisode)
    .filter((item) => item.nextEpisode.at > nowSec && item.nextEpisode.at <= horizon)
    .sort((a, b) => a.nextEpisode.at - b.nextEpisode.at)
    .map((item) => [item.id, item.nextEpisode.at, item.nextEpisode.number || 0])

  const text = JSON.stringify({ v: 1, builtAt: nowSec, sections: SECTIONS, genres, tags, items, airing })
  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(file, text)
  return { items: items.length, airing: airing.length, bytes: text.length }
}
