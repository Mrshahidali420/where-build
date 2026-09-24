/**
 * The address of every page a Where record may link to, or null when that
 * page does not exist. Every link a record carries is made here, from the
 * pages that passed their gates and the slugs the registry gave them, so a
 * record can never point at a 404.
 *
 * Pure.
 */

/** The URL folder of each entity page type. */
export const ROUTES = {
  title: 'anime',
  voice: 'voice-actor',
  staff: 'staff',
  studio: 'studio',
  artist: 'artist',
  watch: 'watch-order',
}

/**
 * slugs: { title: Map(id -> slug), person: Map(id -> slug), studio: Map(id ->
 * slug), artist: Map(key -> slug), watch: Map(anchorId -> slug) }
 * pages: computeWhere's `pages` (the ids that passed each gate)
 */
export function makeLinker(slugs, pages) {
  const at = (folder, slug) => (slug ? `/${folder}/${slug}` : null)
  const voice = (id) => (pages.voice.has(id) ? at(ROUTES.voice, slugs.person.get(id)) : null)
  const staff = (id) => (pages.staff.has(id) ? at(ROUTES.staff, slugs.person.get(id)) : null)
  return {
    title: (id) => at(ROUTES.title, slugs.title.get(id)),
    episodes: (id) => {
      const page = at(ROUTES.title, slugs.title.get(id))
      return page ? `${page}/episodes` : null
    },
    voice,
    staff,
    /** A crew credit: the staff page, else the voice page of the same person. */
    crew: (id) => staff(id) || voice(id),
    /** A voice credit: the voice page, else the staff page. */
    cast: (id) => voice(id) || staff(id),
    studio: (id) => (pages.studio.has(id) ? at(ROUTES.studio, slugs.studio.get(id)) : null),
    artist: (key) => (pages.artist.has(key) ? at(ROUTES.artist, slugs.artist.get(key)) : null),
    watch: (anchorId) => (pages.watch.has(anchorId) ? at(ROUTES.watch, slugs.watch.get(anchorId)) : null),
  }
}
