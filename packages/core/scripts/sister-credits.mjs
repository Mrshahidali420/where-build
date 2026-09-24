/**
 * Pure parts of the credits walk (scripts/ingest-credits.mjs): the query,
 * shaping one AniList media record down to ids, and picking which ids a run
 * should ask for. Kept apart from the script so they can be tested without
 * AniList or R2, the way scripts/snapshot-health.mjs sits apart from
 * scripts/catalog-snapshot.mjs.
 *
 * docs/PLAN.md section 2.0. Ids only: character names, faces and bios already
 * live in the shared catalog's characters.json; staff and voice-actor names
 * are staff.json's job (scripts/ingest-staff.mjs), built from the ids this
 * file collects. Studio names are the one exception -- AniList gives them for
 * free on the same edge, and there is no separate studios ingest to hold them.
 *
 * Batch size: AniList's `Page(perPage: 50) { media(id_in: [...]) { ... } }`
 * (there is no `Media(id_in)`) with this exact shape -- staff(perPage: 25),
 * studios, characters(perPage: 25) with voiceActorRoles -- was probed against
 * the live API on 24 Sep 2026 at the full 50-id batch and returned 200 with
 * no complexity error, so credits.json walks at the same 50-ids-per-call rate
 * as the main catalog (IDS_PER_CALL in anilist-core.mjs) rather than a
 * smaller one.
 */
import { IDS_PER_CALL } from './anilist-core.mjs'

const STAFF_PER_TITLE = 25
const CHARACTERS_PER_TITLE = 25

export const CREDITS_QUERY = `query ($ids: [Int]) {
  Page(page: 1, perPage: ${IDS_PER_CALL}) {
    media(id_in: $ids) {
      id
      staff(perPage: ${STAFF_PER_TITLE}, sort: [RELEVANCE]) { edges { role node { id } } }
      studios { edges { isMain node { id name } } }
      characters(perPage: ${CHARACTERS_PER_TITLE}, sort: [ROLE, RELEVANCE]) {
        edges { role node { id } voiceActorRoles(sort: [RELEVANCE]) { voiceActor { id languageV2 } } }
      }
    }
  }
}`

/** One AniList media node (from CREDITS_QUERY) -> { staff, studios, characters }, ids only. */
export function shapeCredits(media) {
  const staff = (media.staff?.edges || [])
    .map((e) => ({ id: e.node?.id, role: e.role || null }))
    .filter((s) => Number.isInteger(s.id))
  const studios = (media.studios?.edges || [])
    .map((e) => ({ id: e.node?.id, name: e.node?.name || null, isMain: !!e.isMain }))
    .filter((s) => Number.isInteger(s.id))
  const characters = (media.characters?.edges || [])
    .map((e) => ({
      id: e.node?.id,
      role: e.role || null,
      voiceActors: (e.voiceActorRoles || [])
        .map((v) => ({ id: v.voiceActor?.id, language: v.voiceActor?.languageV2 || null }))
        .filter((v) => Number.isInteger(v.id)),
    }))
    .filter((c) => Number.isInteger(c.id))
  return { staff, studios, characters }
}

/**
 * Ids whose credits are worth fetching: new to `seen`, or whose catalog
 * `updatedAt` no longer matches what `seen` has on record. `catalog` is
 * [{ id, updatedAt }] (every title in the shared catalog); `seen` is
 * Map(id -> updatedAt), credits-seen.json loaded. No AniList probe call is
 * spent on this: the shared catalog already carries `updatedAt` for every id,
 * refreshed nightly by the site that owns it, so comparing against it
 * locally is free.
 */
export function selectDelta(catalog, seen) {
  const wanted = []
  for (const { id, updatedAt } of catalog) {
    const have = seen.get(id)
    if (have === undefined || have !== (updatedAt ?? 0)) wanted.push(id)
  }
  return wanted
}

/** A new credits-seen.json: `seen` with every fetched id's current updatedAt recorded. */
export function mergeSeen(seen, catalogById, fetchedIds) {
  const next = new Map(seen)
  for (const id of fetchedIds) next.set(id, catalogById.get(id)?.updatedAt ?? 0)
  return next
}

/** A new credits.json byId map: `existing` with the freshly fetched records applied. */
export function mergeCredits(existing, fetchedById) {
  const merged = { ...existing }
  for (const [id, record] of fetchedById) merged[id] = record
  return merged
}
