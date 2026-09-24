#!/usr/bin/env node
/**
 * NOVEL WALK. Fetch every light and web novel AniList has, once, then only
 * the new ones each night. Nothing is ever removed.
 *
 * Why: the catalog was built with format_not_in: [NOVEL], so it holds no
 * novels at all. Now that the daily probes ask for novels too, new and
 * edited ones arrive every night, but the ones that already existed never
 * change and so never show up. This walk goes and gets them.
 *
 * A novel is a MANGA record on AniList, so its ids are spread through the
 * whole manga id space. AniList caps page counts at 5,000 and has no id
 * cursor, so the only door to the whole list is a walk over the ids, 50 per
 * call, asking only for format NOVEL.
 *
 * How it keeps its place: data/novels-walk.json holds the next id to look
 * at. The nightly job spends NOVEL_MAX_CALLS calls, saves the catalog, and
 * saves the next id. When the walk reaches the newest id it is finished; from
 * then on the daily probes carry the new novels, so each later run costs one
 * call.
 *
 * Where novels live: in data/comics.json beside the comics, with kind
 * 'novel'. The site splits them into their own /novel section by that kind.
 * The catalog cache path list never changes.
 *
 *   node --max-old-space-size=6000 scripts/ingest-novels.mjs
 *
 * Options (environment variables):
 *   NOVEL_MAX_CALLS=1600  hard ceiling on API calls for this run (default 1600)
 */
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  gql,
  sleep,
  shape,
  harvestCharacters,
  loadAssembled,
  assembleAndWrite,
  CHARACTERS,
  DATA_DIR,
  IDS_PER_CALL,
  REQUEST_DELAY_MS,
  NOVELS_BY_IDS_QUERY,
  MAX_ID_QUERY,
  writeFileAtomic,
} from './anilist-core.mjs'

export const STATE_FILE = join(DATA_DIR, 'novels-walk.json')

const num = (key, fallback) => Number(process.env[key]) || fallback
const MAX_CALLS = num('NOVEL_MAX_CALLS', 1600)

/** Where the walk stands. A missing file means it has not started. */
export function loadState() {
  if (!existsSync(STATE_FILE)) return { next: 1, newest: 0, finishedAt: null }
  try {
    const raw = JSON.parse(readFileSync(STATE_FILE, 'utf8'))
    const next = Number(raw.next)
    return {
      next: Number.isInteger(next) && next > 0 ? next : 1,
      newest: Number(raw.newest) || 0,
      finishedAt: raw.finishedAt || null,
    }
  } catch (error) {
    throw new Error(`data/novels-walk.json is not valid JSON: ${error.message}`)
  }
}

function saveState(state) {
  writeFileAtomic(STATE_FILE, JSON.stringify(state, null, 2) + '\n')
}

/**
 * Fold one fetched novel into the comics list. A record we already hold is
 * replaced in place; a new one is appended. Returns 'added' or 'refreshed'.
 */
export function absorbNovel(media, comics, indexById) {
  const item = shape(media)
  harvestCharacters(item)
  const at = indexById.get(item.id)
  if (at === undefined) {
    indexById.set(item.id, comics.length)
    comics.push(item)
    return 'added'
  }
  comics[at] = item
  return 'refreshed'
}

async function main() {
  const startedAt = Date.now()
  const { comics, anime } = loadAssembled()
  const indexById = new Map(comics.map((c, i) => [c.id, i]))
  const state = loadState()

  let calls = 0
  const top = await gql(MAX_ID_QUERY, { type: 'MANGA' })
  calls++
  const newest = top?.Page?.media?.[0]?.id
  if (!Number.isInteger(newest)) throw new Error('AniList did not return the newest manga id')
  console.log(`Newest manga id on AniList: ${newest}. Novel walk resumes at ${state.next}.`)

  const tally = { seen: 0, added: 0, refreshed: 0 }
  let from = state.next
  while (from <= newest) {
    if (calls >= MAX_CALLS) {
      console.log(`Call budget of ${MAX_CALLS} used up at id ${from}. The rest waits for tomorrow.`)
      break
    }
    const ids = Array.from({ length: IDS_PER_CALL }, (_, i) => from + i).filter((id) => id <= newest)
    let page
    try {
      page = await gql(NOVELS_BY_IDS_QUERY, { ids })
    } catch (error) {
      console.log(`  ids ${from}-${from + IDS_PER_CALL - 1}: ${error.message}. Stopping here; tomorrow retries this block.`)
      break
    }
    calls++
    for (const media of page?.Page?.media || []) {
      tally.seen++
      tally[absorbNovel(media, comics, indexById)]++
    }
    from += IDS_PER_CALL
    if (((from - state.next) / IDS_PER_CALL) % 100 === 0) {
      console.log(`  at id ${from}: ${tally.added} added, ${tally.refreshed} refreshed`)
    }
    await sleep(REQUEST_DELAY_MS)
  }

  const finished = from > newest
  const stats = assembleAndWrite(comics, anime, startedAt)
  saveState({
    next: finished ? newest + 1 : from,
    newest,
    finishedAt: finished ? new Date().toISOString() : state.finishedAt,
  })

  console.log(
    `Novel walk: ${calls} calls, ${tally.seen} novels seen, ${tally.added} added, ${tally.refreshed} refreshed. ` +
      (finished ? `Walk complete up to id ${newest}.` : `Next run starts at id ${from}.`)
  )
  console.log(
    `Catalog now: ${stats.comics} comics, ${stats.novels} novels, ${stats.anime} anime, ${stats.characters ?? CHARACTERS.size} characters.`
  )
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
