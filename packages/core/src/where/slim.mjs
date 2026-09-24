/**
 * The shared files, cut down to what a Where site reads.
 *
 * scripts/where-data.mjs pulls the whole shared catalog (116,000 titles,
 * 170,000 characters, 286,000 slugs) and the sister data, and keeps only what
 * this site's build will look at, one file at a time, so the build never holds
 * the full comics and character files in memory at all:
 *
 *   linked-comics.json  the comics and novels an anime is adapted from, for
 *                       the cross-site card (cover, title, one fact)
 *   cast.json           { characterId: [name, image, hasHomePage] } for the
 *                       characters the credits name
 *   home-registry.json  the home site's frozen addresses for those titles and
 *                       characters: { t: { id: [folder, slug] }, c: { id: slug } }
 *   credits.json        the credits of anime only
 *   staff.json          the people those credits name
 *
 * Pure: records in, records out.
 */

/** The relations that make a comic or a novel the source of an anime. */
export const SOURCE_RELATIONS = new Set(['ADAPTATION', 'SOURCE'])

/** Ids of every comic or novel an anime names as its source. */
export function sourceIdsOf(anime) {
  const ids = new Set()
  for (const item of anime) {
    for (const rel of item.relations || []) {
      if (rel.type === 'MANGA' && SOURCE_RELATIONS.has(rel.relation)) ids.add(rel.id)
    }
  }
  return ids
}

/** Just enough of a comic or novel to draw a card and state one fact about it. */
export function slimComic(comic) {
  return {
    id: comic.id,
    kind: comic.kind,
    country: comic.country,
    format: comic.format || null,
    title: comic.title,
    cover: comic.cover || null,
    status: comic.status || null,
    chapters: comic.chapters || null,
    volumes: comic.volumes || null,
    startYear: comic.startYear || null,
  }
}

export function slimComics(comics, wanted) {
  return comics.filter((comic) => wanted.has(comic.id)).map(slimComic)
}

/** Credits of the given anime only. */
export function slimCredits(credits, animeIds) {
  const out = {}
  for (const id of animeIds) {
    const row = credits[String(id)]
    if (row) out[String(id)] = row
  }
  return out
}

/** Every person (crew or voice) and every character the credits name. */
export function namedIn(credits) {
  const people = new Set()
  const characters = new Set()
  for (const row of Object.values(credits)) {
    for (const credit of row.staff || []) if (credit?.id) people.add(credit.id)
    for (const role of row.characters || []) {
      if (role?.id) characters.add(role.id)
      for (const voice of role?.voiceActors || []) if (voice?.id) people.add(voice.id)
    }
  }
  return { people, characters }
}

export function slimStaff(staff, ids) {
  const out = {}
  for (const id of ids) {
    const person = staff[String(id)]
    if (person) out[String(id)] = person
  }
  return out
}

/**
 * The home site draws a character page when it has a face and at least one
 * story (characterHasPage in src/lib/format.js); a face on a Where site links
 * there only then.
 */
export const homeHasCharacterPage = (c) => Boolean(c.image) && (c.appearsIn || []).length > 0

export function slimCast(characters, wanted) {
  const out = {}
  for (const c of characters) {
    if (wanted.has(c.id)) out[String(c.id)] = [c.name || '', c.image || '', homeHasCharacterPage(c)]
  }
  return out
}

/** The home site's addresses for the titles and characters this site may link to. */
export function slimHomeRegistry(registry, titleIds, characterIds) {
  const out = { t: {}, c: {} }
  for (const id of titleIds) {
    const entry = registry.entries[`t:${id}`]
    if (entry?.ns && entry.slug) out.t[String(id)] = [entry.ns, entry.slug]
  }
  for (const id of characterIds) {
    const entry = registry.entries[`c:${id}`]
    if (entry?.slug) out.c[String(id)] = entry.slug
  }
  return out
}
