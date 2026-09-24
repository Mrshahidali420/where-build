/**
 * Franchises, for the watch-order pages.
 *
 * A franchise is built in two steps, so a crossover can never weld two
 * franchises into one (Lupin III and Detective Conan share crossover
 * specials; a plain union over every relation made them one 134-entry list):
 *
 *   1. the story: every anime joined by PREQUEL or SEQUEL, as one chain.
 *   2. the extras: an anime in no chain (a movie, an OVA, a recap, a
 *      spin-off special) joins the largest chain it is related to by any
 *      other story relation (side story, spin-off, alternative, parent,
 *      summary, compilation). An extra joins one chain only, so two chains
 *      never merge through it. Extras related only to each other form their
 *      own group.
 *
 * Only titles that have a page on the site join a group, so every entry of a
 * watch order is a real link, and a franchise that reaches a donghua or a
 * manga does not pull that in: the anime site's watch order is anime only.
 *
 * The group is keyed by the first release of its story (step 1), which is
 * also the entry its name comes from; a group with no chain is keyed by its
 * own first release. The key goes in the slug registry, so the address holds
 * while new sequels join.
 *
 * Pure.
 */
import { storyName } from '../lib/namesakes.mjs'

/** The relations that make one story. */
export const STORY_RELATIONS = new Set(['PREQUEL', 'SEQUEL'])

/** The relations that attach an extra to a story. */
export const EXTRA_RELATIONS = new Set(['SIDE_STORY', 'SPIN_OFF', 'ALTERNATIVE', 'PARENT', 'SUMMARY', 'COMPILATION'])

/** Every relation that puts two anime in one franchise. */
export const FRANCHISE_RELATIONS = new Set([...STORY_RELATIONS, ...EXTRA_RELATIONS])

/** Sort key of a release: [year, month, day] with unknowns last, then id. */
export function releaseOrder(a, b) {
  const date = (t) => {
    const [y, m, d] = Array.isArray(t.startDate) ? t.startDate : []
    return [y || t.startYear || 9999, m || 13, d || 32]
  }
  const [ay, am, ad] = date(a)
  const [by, bm, bd] = date(b)
  return ay - by || am - bm || ad - bd || a.id - b.id
}

/** Union-find over ids, joining along the relations `joins` accepts. */
function unionBy(titles, byId, joins) {
  const parent = new Map([...byId.keys()].map((id) => [id, id]))
  const find = (id) => {
    while (parent.get(id) !== id) {
      parent.set(id, parent.get(parent.get(id)))
      id = parent.get(id)
    }
    return id
  }
  for (const title of titles) {
    for (const rel of title.relations || []) {
      if (!joins(title, rel) || !byId.has(rel.id)) continue
      const a = find(title.id)
      const b = find(rel.id)
      if (a !== b) parent.set(b, a)
    }
  }
  const groups = new Map()
  for (const id of byId.keys()) {
    const root = find(id)
    if (!groups.has(root)) groups.set(root, [])
    groups.get(root).push(id)
  }
  return [...groups.values()]
}

/** The ids an anime is joined to by an extra relation, both ways. */
function extraLinks(titles, byId) {
  const links = new Map()
  const link = (a, b) => {
    if (!links.has(a)) links.set(a, new Set())
    links.get(a).add(b)
  }
  for (const title of titles) {
    for (const rel of title.relations || []) {
      if (!EXTRA_RELATIONS.has(rel.relation) || !byId.has(rel.id) || rel.id === title.id) continue
      link(title.id, rel.id)
      link(rel.id, title.id)
    }
  }
  return links
}

/** Map(anchorId -> { anchorId, name, ids }) for every group of two or more. */
export function buildFranchises(titles) {
  const byId = new Map(titles.map((t) => [t.id, t]))
  const chains = unionBy(titles, byId, (_, rel) => STORY_RELATIONS.has(rel.relation)).filter((ids) => ids.length > 1)
  const chainOf = new Map()
  chains.forEach((ids, at) => ids.forEach((id) => chainOf.set(id, at)))
  const links = extraLinks(titles, byId)

  // Each extra joins the largest chain it touches (then the one with the lowest first id).
  const members = chains.map((ids) => ({ story: ids, extras: [] }))
  const loose = []
  for (const title of titles) {
    if (chainOf.has(title.id)) continue
    const touched = [...new Set([...(links.get(title.id) || [])].filter((id) => chainOf.has(id)).map((id) => chainOf.get(id)))]
    if (!touched.length) {
      if (links.has(title.id)) loose.push(title)
      continue
    }
    touched.sort((a, b) => chains[b].length - chains[a].length || Math.min(...chains[a]) - Math.min(...chains[b]))
    members[touched[0]].extras.push(title.id)
  }
  // Extras tied only to other loose extras make their own group.
  const looseIds = new Map(loose.map((t) => [t.id, t]))
  for (const ids of unionBy(loose, looseIds, (_, rel) => EXTRA_RELATIONS.has(rel.relation))) {
    if (ids.length > 1) members.push({ story: [], extras: ids })
  }

  const franchises = new Map()
  for (const { story, extras } of members) {
    const anchor = (story.length ? story : extras).map((id) => byId.get(id)).sort(releaseOrder)[0]
    const ids = [...story, ...extras].map((id) => byId.get(id)).sort(releaseOrder).map((t) => t.id)
    franchises.set(anchor.id, { anchorId: anchor.id, name: storyName(anchor.title), ids })
  }
  return franchises
}

/**
 * The main story: from the first release, follow SEQUEL to the next entry of
 * the same group until it ends. Side stories, recaps and alternative versions
 * stay out of it; the release order lists them all. AniList often files the
 * link on one side only, so "B's PREQUEL is A" counts as "A's SEQUEL is B".
 */
export function mainChain(franchise, byId) {
  const members = new Set(franchise.ids)
  const next = new Map()
  const add = (from, to) => {
    if (!members.has(from) || !members.has(to) || from === to) return
    if (!next.has(from)) next.set(from, [])
    next.get(from).push(to)
  }
  for (const id of franchise.ids) {
    for (const rel of byId.get(id)?.relations || []) {
      if (rel.relation === 'SEQUEL') add(id, rel.id)
      else if (rel.relation === 'PREQUEL') add(rel.id, id)
    }
  }
  const chain = [franchise.anchorId]
  const seen = new Set(chain)
  for (let at = franchise.anchorId; ; ) {
    const after = (next.get(at) || []).filter((id) => !seen.has(id)).map((id) => byId.get(id))
    if (!after.length) break
    at = after.sort(releaseOrder)[0].id
    chain.push(at)
    seen.add(at)
  }
  return chain
}
