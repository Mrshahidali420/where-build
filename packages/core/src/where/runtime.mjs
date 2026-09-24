// REQUEST TIME. A Where page's record, read out of its shard through the
// ASSETS binding (src/lib/runtime.js does the reading, the retries and the 503).
import { loadTitle, loadRecord } from '../lib/runtime.js'
import { WHERE_SHARDS } from './shard-folders.mjs'

const load = (type) => (env, slug) => loadRecord(env, WHERE_SHARDS[type].folder, WHERE_SHARDS[type].count, slug)

export const loadAnime = (env, slug) => loadTitle(env, 'anime', slug)
export const loadPerson = load('person')
export const loadStudio = load('studio')
export const loadArtist = load('artist')
export const loadWatchOrder = load('watch')
