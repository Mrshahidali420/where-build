#!/usr/bin/env node
/**
 * CHARACTER WALK. Fetch every character AniList has, once, then only the new
 * ones each night. Nothing is ever removed.
 *
 * Why: a title fetch carries only its top ten cast members. A show with forty
 * characters gives us ten, and search sends readers for the other thirty.
 * AniList clamps every page count at 5,000 and has no id cursor, so the only
 * door to the whole list is a walk over the id space, 50 ids per call.
 *
 * How it keeps its place: data/characters-walk.json holds the next id to look
 * at. The nightly job spends CHAR_MAX_CALLS calls, saves the catalog, and
 * saves the next id. When the walk reaches the newest id it is finished; from
 * then on each night only covers ids above the last one seen, which is a call
 * or two.
 *
 * What it keeps: a character is added when it appears in a title we hold, or
 * when we already hold a record for it. A character whose titles are all
 * outside the catalog (adult, novel-only, or unknown) is left out, so no page
 * is ever built with an empty cast list. A record we already hold is refreshed
 * with the full AniList body; its cast links are rebuilt by assembleAndWrite,
 * which also restores every link held before.
 *
 *   node --max-old-space-size=6000 scripts/ingest-characters.mjs
 *
 * Options (environment variables):
 *   CHAR_MAX_CALLS=1600  hard ceiling on API calls for this run (default 1600)
 */
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  gql,
  sleep,
  loadAssembled,
  assembleAndWrite,
  CHARACTERS,
  DATA_DIR,
  IDS_PER_CALL,
  REQUEST_DELAY_MS,
  writeFileAtomic,
} from './anilist-core.mjs'
import { KEEP_CHARACTERS_QUERY, keepCharacterRecord, linkKeptCharacter } from './keep-list.mjs'

export const STATE_FILE = join(DATA_DIR, 'characters-walk.json')

const num = (key, fallback) => Number(process.env[key]) || fallback
const MAX_CALLS = num('CHAR_MAX_CALLS', 1600)

const NEWEST_ID_QUERY = `{ Page(perPage: 1) { characters(sort: ID_DESC) { id } } }`

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
    throw new Error(`data/characters-walk.json is not valid JSON: ${error.message}`)
  }
}

function saveState(state) {
  writeFileAtomic(STATE_FILE, JSON.stringify(state, null, 2) + '\n')
}

/** True when at least one of the character's titles is in the catalog and not adult. */
function appearsInCatalog(node, titleById) {
  return (node.media?.edges || []).some((edge) => edge.node && !edge.node.isAdult && titleById.has(edge.node.id))
}

/**
 * Fold one fetched character into CHARACTERS and the title cast lists.
 * Returns 'added', 'refreshed' or 'skipped'.
 */
export function absorbCharacter(node, titleById) {
  const record = keepCharacterRecord(node)
  const existing = CHARACTERS.get(node.id)
  if (!existing && !appearsInCatalog(node, titleById)) return 'skipped'
  linkKeptCharacter(node, record, titleById)
  CHARACTERS.set(node.id, { ...record, appearsIn: [] })
  return existing ? 'refreshed' : 'added'
}

async function main() {
  const startedAt = Date.now()
  const { comics, anime } = loadAssembled()
  const titleById = new Map([...comics, ...anime].map((x) => [x.id, x]))
  const state = loadState()

  let calls = 0
  const top = await gql(NEWEST_ID_QUERY)
  calls++
  const newest = top?.Page?.characters?.[0]?.id
  if (!Number.isInteger(newest)) throw new Error('AniList did not return the newest character id')
  console.log(`Newest character id on AniList: ${newest}. Walk resumes at ${state.next}.`)

  const tally = { seen: 0, added: 0, refreshed: 0, skipped: 0 }
  let from = state.next
  while (from <= newest) {
    if (calls >= MAX_CALLS) {
      console.log(`Call budget of ${MAX_CALLS} used up at id ${from}. The rest waits for tomorrow.`)
      break
    }
    const ids = Array.from({ length: IDS_PER_CALL }, (_, i) => from + i).filter((id) => id <= newest)
    let page
    try {
      page = await gql(KEEP_CHARACTERS_QUERY, { ids })
    } catch (error) {
      console.log(`  ids ${from}-${from + IDS_PER_CALL - 1}: ${error.message}. Stopping here; tomorrow retries this block.`)
      break
    }
    calls++
    for (const node of page?.Page?.characters || []) {
      tally.seen++
      tally[absorbCharacter(node, titleById)]++
    }
    from += IDS_PER_CALL
    if (((from - state.next) / IDS_PER_CALL) % 100 === 0) {
      console.log(`  at id ${from}: ${tally.added} added, ${tally.refreshed} refreshed, ${tally.skipped} outside the catalog`)
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
    `Character walk: ${calls} calls, ${tally.seen} characters seen, ${tally.added} added, ` +
      `${tally.refreshed} refreshed, ${tally.skipped} outside the catalog. ` +
      (finished ? `Walk complete up to id ${newest}.` : `Next run starts at id ${from}.`)
  )
  console.log(`Catalog now: ${stats.comics} comics, ${stats.anime} anime, ${stats.characters ?? CHARACTERS.size} characters.`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
