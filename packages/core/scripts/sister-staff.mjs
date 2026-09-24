/**
 * Pure parts of the staff walk (scripts/ingest-staff.mjs): the query, shaping
 * one AniList staff record, finding which ids credits.json points at, and
 * picking which of those are new. Kept apart from the script the same way
 * scripts/sister-credits.mjs is.
 *
 * docs/PLAN.md section 2.0. AniList's Staff type covers both crew and voice
 * actors, so "every staff id seen in credits.json" means every id in a
 * record's `staff` list AND every `voiceActors` id on its `characters` list:
 * a voice actor with no other credit is still a Staff row worth a page.
 *
 * Batch size: `Page(perPage: 50) { staff(id_in: [...]) { ... } }` with the
 * full field list below (bio, occupations, staffMedia and a characters
 * connection, both perPage 25) was probed against the live API on 24 Sep 2026
 * at the full 50-id batch and returned 200 with no complexity error, so
 * staff.json walks at IDS_PER_CALL too.
 */
import { IDS_PER_CALL, cutBio } from './anilist-core.mjs'

const MEDIA_PER_STAFF = 25
const CHARACTERS_PER_STAFF = 25

export const STAFF_QUERY = `query ($ids: [Int]) {
  Page(page: 1, perPage: ${IDS_PER_CALL}) {
    staff(id_in: $ids) {
      id
      name { full native alternative }
      image { large }
      description(asHtml: false)
      languageV2
      primaryOccupations
      dateOfBirth { year month day }
      homeTown
      yearsActive
      gender
      favourites
      siteUrl
      staffMedia(sort: POPULARITY_DESC, perPage: ${MEDIA_PER_STAFF}) { edges { staffRole node { id type } } }
      characters(sort: FAVOURITES_DESC, perPage: ${CHARACTERS_PER_STAFF}) { nodes { id } }
    }
  }
}`

/** One AniList staff node (from STAFF_QUERY) -> the record staff.json stores. */
export function shapeStaff(node) {
  return {
    id: node.id,
    name: node.name?.full || null,
    native: node.name?.native || null,
    aliases: (node.name?.alternative || []).filter(Boolean).slice(0, 5),
    image: node.image?.large || null,
    description: cutBio((node.description || '').replace(/<[^>]+>/g, '').trim()),
    language: node.languageV2 || null,
    occupations: node.primaryOccupations || [],
    birthDate: node.dateOfBirth?.year || node.dateOfBirth?.month || node.dateOfBirth?.day
      ? { year: node.dateOfBirth.year ?? null, month: node.dateOfBirth.month ?? null, day: node.dateOfBirth.day ?? null }
      : null,
    homeTown: node.homeTown || null,
    yearsActive: (node.yearsActive || []).filter((y) => Number.isInteger(y)),
    gender: node.gender || null,
    favourites: node.favourites ?? 0,
    anilistUrl: node.siteUrl || null,
    media: (node.staffMedia?.edges || [])
      .map((e) => ({ id: e.node?.id, type: e.node?.type || null, role: e.staffRole || null }))
      .filter((m) => Number.isInteger(m.id)),
    characterIds: (node.characters?.nodes || []).map((n) => n.id).filter((id) => Number.isInteger(id)),
  }
}

/** Every staff and voice-actor id one credits.json byId map points at. */
export function referencedStaffIds(creditsById) {
  const ids = new Set()
  for (const record of Object.values(creditsById)) {
    for (const s of record.staff || []) if (Number.isInteger(s.id)) ids.add(s.id)
    for (const c of record.characters || []) {
      for (const v of c.voiceActors || []) if (Number.isInteger(v.id)) ids.add(v.id)
    }
  }
  return ids
}

/** Referenced ids staff.json does not hold yet. */
export function selectNew(referencedIds, existingById) {
  return [...referencedIds].filter((id) => !Object.hasOwn(existingById, id))
}

/** A new staff.json byId map: `existing` with the freshly fetched records applied. */
export function mergeStaff(existing, fetchedById) {
  const merged = { ...existing }
  for (const [id, record] of fetchedById) merged[id] = record
  return merged
}
