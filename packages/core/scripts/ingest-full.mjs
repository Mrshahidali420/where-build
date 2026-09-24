#!/usr/bin/env node
/**
 * ONE-TIME FULL BACKFILL.
 *
 * Walks the whole AniList id space in batches of 50 ids and writes every
 * non-adult title to data/raw/full.jsonl. There is no popularity limit.
 *
 * Why an id walk and not pagination: AniList clamps pageInfo.total at 5000
 * and refuses any page past 5000 entries, and it has no id cursor. id_in is
 * the only door to the whole catalog.
 *
 * Cost: about 216,800 ids / 50 = ~4,340 calls. At 30 calls a minute that is
 * around 2.5 hours. The run is resumable: it stores the last finished id and
 * picks up there, so you can stop it and start it again any time.
 *
 * Run it:
 *   npm run ingest:full
 *
 * Options (environment variables):
 *   START_ID=1         first id to look at (default: resume point, else 1)
 *   END_ID=250000      last id to look at (default: highest live id + 1000)
 *   MAX_MINUTES=180    stop cleanly after this long, keep the progress
 *   ASSEMBLE_ONLY=1    skip the API, just rebuild the JSON from raw
 *   RESET=1            start the walk again from the first id
 *   SKIP_SEEN=1        do not fetch ids already listed in data/seen.json
 *   FRESH=1            ignore the last build, use only what this walk found
 */

import { appendFileSync, mkdirSync, readFileSync, rmSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import {
  RAW_DIR, BY_IDS_QUERY, MAX_ID_QUERY, IDS_PER_CALL, REQUEST_DELAY_MS,
  gql, sleep, shape, loadRawFiles, loadSeen, loadAssembled, harvestCharacters, assembleAndWrite, CHARACTERS,
  writeJsonAtomic,
} from './anilist-core.mjs'

const RAW_FILE = 'full.jsonl'
const PROGRESS_FILE = join(RAW_DIR, 'full-progress.json')

const num = (name, fallback) => (process.env[name] ? Number(process.env[name]) : fallback)

function readProgress() {
  try {
    return JSON.parse(readFileSync(PROGRESS_FILE, 'utf8'))
  } catch {
    return { lastId: 0, kept: 0, calls: 0 }
  }
}

async function highestId() {
  let top = 0
  for (const type of ['MANGA', 'ANIME']) {
    const data = await gql(MAX_ID_QUERY, { type })
    top = Math.max(top, data?.Page?.media?.[0]?.id || 0)
    await sleep(REQUEST_DELAY_MS)
  }
  return top
}

async function walk() {
  mkdirSync(RAW_DIR, { recursive: true })

  if (process.env.RESET === '1') {
    rmSync(join(RAW_DIR, RAW_FILE), { force: true })
    rmSync(PROGRESS_FILE, { force: true })
    console.log('RESET: raw file and progress removed.')
  }

  const progress = readProgress()
  const startId = num('START_ID', progress.lastId + 1)
  const top = num('END_ID', 0) || (await highestId()) + 1000
  const stopAt = Date.now() + num('MAX_MINUTES', 24 * 60) * 60_000

  console.log(`Walking ids ${startId} to ${top} in steps of ${IDS_PER_CALL}.`)
  const totalCalls = Math.ceil((top - startId + 1) / IDS_PER_CALL)
  console.log(`That is ${totalCalls} calls, about ${Math.round((totalCalls * REQUEST_DELAY_MS) / 60000)} minutes.`)

  // SKIP_SEEN=1 skips any batch whose ids are all in data/seen.json already.
  // Leave it off for the first complete walk, turn it on for a top-up walk.
  const seen = process.env.SKIP_SEEN === '1' ? loadSeen() : new Map()
  if (seen.size) console.log(`SKIP_SEEN on: ${seen.size} titles will not be fetched again.`)

  let kept = progress.kept || 0
  let calls = progress.calls || 0
  let skipped = 0

  for (let id = startId; id <= top; id += IDS_PER_CALL) {
    if (Date.now() > stopAt) {
      console.log('MAX_MINUTES reached. Stopping here. Run the command again to continue.')
      break
    }
    const ids = []
    for (let n = id; n < id + IDS_PER_CALL && n <= top; n++) {
      if (seen.has(n)) continue
      ids.push(n)
    }
    if (!ids.length) {
      skipped += IDS_PER_CALL
      writeJsonAtomic(PROGRESS_FILE, { lastId: Math.min(id + IDS_PER_CALL - 1, top), kept, calls, top })
      continue // no API call at all
    }

    let data
    try {
      data = await gql(BY_IDS_QUERY, { ids })
    } catch (error) {
      console.warn(`  ids ${id}+ failed for good: ${error.message}. skipping this batch.`)
      await sleep(REQUEST_DELAY_MS)
      continue
    }

    const media = data?.Page?.media || []
    if (media.length) {
      let lines = ''
      for (const m of media) lines += JSON.stringify(shape(m)) + '\n'
      appendFileSync(join(RAW_DIR, RAW_FILE), lines)
      kept += media.length
    }
    calls++

    const last = Math.min(id + IDS_PER_CALL - 1, top)
    writeJsonAtomic(PROGRESS_FILE, { lastId: last, kept, calls, top })
    if (calls % 20 === 0) {
      const pct = (((last - 1) / top) * 100).toFixed(1)
      console.log(`  id ${last}/${top} (${pct}%)  kept ${kept} titles  ${calls} calls`)
    }
    await sleep(REQUEST_DELAY_MS)
  }

  console.log(`Walk stopped at id ${readProgress().lastId}. Kept ${kept} titles, skipped ${skipped} known ids.`)
}

async function main() {
  const startedAt = Date.now()
  if (process.env.ASSEMBLE_ONLY !== '1') await walk()

  if (!existsSync(join(RAW_DIR, RAW_FILE))) {
    console.log('No raw file yet. Nothing to assemble.')
    return
  }

  console.log('Assembling...')

  // Start from what the site already holds, unless the old catalog is the
  // pre-id format, and then lay the raw walk on top of it. Nothing already
  // published is lost when a walk is only partly finished.
  const byId = new Map()
  const existing = loadAssembled()
  const oldFormat = [...existing.comics, ...existing.anime]
    .some((x) => (x.characters || []).some((c) => c.id == null))
  if (process.env.FRESH === '1' || oldFormat) {
    CHARACTERS.clear()
    if (oldFormat) console.log('Old catalog is the pre-id format. Building from the walk only.')
  } else {
    for (const item of [...existing.comics, ...existing.anime]) {
      harvestCharacters(item)
      byId.set(item.id, item)
    }
    console.log(`  kept ${byId.size} titles from the last build`)
  }

  for (const item of loadRawFiles([RAW_FILE, 'daily.jsonl'])) byId.set(item.id, item)

  const all = [...byId.values()]
  const comics = all.filter((x) => x.kind === 'comic')
  const anime = all.filter((x) => x.kind === 'anime')
  const stats = assembleAndWrite(comics, anime, startedAt)
  console.log('Done.')
  console.log(JSON.stringify(stats, null, 2))
}

main().catch((error) => {
  console.error('FULL INGEST FAILED:', error.message)
  process.exit(1)
})
