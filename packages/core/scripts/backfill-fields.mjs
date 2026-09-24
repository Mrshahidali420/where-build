#!/usr/bin/env node
/**
 * Refetch every title we already hold, once, to fill in NEW AniList fields.
 *
 * Why this exists: the daily ingest only fetches a title whose updatedAt moved.
 * That is the right rule for normal days, but it means a field we did not ask
 * for yesterday never appears on the ~107,000 titles already in data/. This job
 * asks for all of them again, by id, so the new fields land everywhere at once.
 *
 * It is cheap because we already own the ids. The slow part of a full ingest is
 * hunting the whole AniList id space, and this skips that entirely:
 * 50 ids per call at about 3s per call, so a touch under two hours.
 *
 * Run it by hand, once, after adding a field to MEDIA_FIELDS:
 *   node --max-old-space-size=6000 scripts/backfill-fields.mjs
 *
 * BACKFILL_KINDS=anime (or comic, novel, or a comma list) refetches only those
 * kinds. A field only an anime carries (staff credits, English voices) needs
 * ~420 calls instead of ~2,150. Every other title keeps the row it has.
 */

import {
  IDS_PER_CALL,
  REQUEST_DELAY_MS,
  BY_IDS_QUERY,
  sleep,
  gql,
  shape,
  harvestCharacters,
  loadAssembled,
  assembleAndWrite,
} from './anilist-core.mjs'

const startedAt = Date.now()
const { comics, anime } = loadAssembled()
const known = [...comics, ...anime]
console.log(`holding ${comics.length} comics and ${anime.length} anime`)

const KINDS = ['anime', 'comic', 'novel']
const wantKinds = String(process.env.BACKFILL_KINDS || '')
  .split(',')
  .map((k) => k.trim().toLowerCase())
  .filter(Boolean)
const unknownKind = wantKinds.find((k) => !KINDS.includes(k))
if (unknownKind) throw new Error(`BACKFILL_KINDS: unknown kind "${unknownKind}". Use ${KINDS.join(', ')}.`)
const wanted = wantKinds.length ? known.filter((item) => wantKinds.includes(item.kind)) : known
if (wantKinds.length) console.log(`BACKFILL_KINDS=${wantKinds.join(',')}: refetching ${wanted.length} of ${known.length} titles`)

// One bucket per call. AniList takes 50 ids at a time.
const ids = wanted.map((item) => item.id)
const batches = []
for (let i = 0; i < ids.length; i += IDS_PER_CALL) batches.push(ids.slice(i, i + IDS_PER_CALL))

const fresh = new Map()
for (const [index, batch] of batches.entries()) {
  const data = await gql(BY_IDS_QUERY, { ids: batch })
  for (const media of data?.Page?.media || []) {
    const item = shape(media)
    harvestCharacters(item)
    fresh.set(item.id, item)
  }
  if ((index + 1) % 20 === 0 || index + 1 === batches.length) {
    console.log(`  ${index + 1}/${batches.length} calls, ${fresh.size} titles refreshed`)
  }
  if (index + 1 < batches.length) await sleep(REQUEST_DELAY_MS)
}

// A title AniList no longer returns (deleted, or now marked adult) keeps the
// row we already had. Losing a page is worse than an old page.
const merge = (list) => list.map((item) => fresh.get(item.id) || item)

const stats = assembleAndWrite(merge(comics), merge(anime), startedAt)
console.log(`done in ${stats.durationSeconds}s`)
console.log(`${stats.comics} comics, ${stats.anime} anime, ${stats.characters} characters`)
