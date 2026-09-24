/**
 * Which pages a Where site builds: one gate per page type.
 *
 * The thresholds live in the site's config (`gates`, docs/PLAN.md section
 * 2.1): { page, count: 'where', type, ... }. The rules live here, and every
 * reader goes through them: the build decides which pages get a shard record,
 * a slug, a sitemap line and a search row, and every link on every page is
 * drawn only to a page that passed. A page below its gate does not exist, so
 * nothing ever links to a 404.
 *
 * A gate needs the data it counts. A person with no staff.json record has no
 * name to print, so no page, however many roles the credits give them: more
 * data only ever adds pages.
 *
 * Pure.
 */

/** Every Where page type, and what it needs by default (the plan's thresholds). */
export const WHERE_GATE_DEFAULTS = {
  title: { credits: 3 },
  episodes: { min: 13 },
  voiceActor: { min: 3 },
  staff: { min: 2 },
  studio: { min: 2 },
  artist: { min: 2 },
  watchOrder: { min: 3 },
}

/** One gate's settings: the site's own, over the defaults. */
export function gateOf(site, type) {
  const own = (site.gates || []).find((gate) => gate.count === 'where' && gate.type === type)
  return { ...WHERE_GATE_DEFAULTS[type], ...(own || {}) }
}

/** Every gate of the site, by type. */
export function gatesOf(site) {
  return Object.fromEntries(Object.keys(WHERE_GATE_DEFAULTS).map((type) => [type, gateOf(site, type)]))
}

/**
 * A title page needs a cover and at least one thing to say that the home
 * site does not: an episode count or list, an air date, or credits.
 *   facts: { episodes: boolean, airing: boolean, credits: number }
 */
export function passesTitle(item, facts, gate) {
  if (!item.cover) return false
  return facts.episodes || facts.airing || facts.credits >= gate.credits
}

/** The full episode list earns its own page only past what the title page shows. */
export const passesEpisodes = (dated, gate) => dated >= gate.min

/** A voice actor: a name to print and enough distinct roles. */
export const passesVoiceActor = (person, gate) => Boolean(person.name) && person.voiceRoleCount >= gate.min

/** Staff: a name to print and credits on enough different shows. */
export const passesStaff = (person, gate) => Boolean(person.name) && person.staffWorkCount >= gate.min

export const passesStudio = (studio, gate) => Boolean(studio.name) && studio.titleIds.length >= gate.min

export const passesArtist = (artist, gate) => Boolean(artist.name) && artist.songs.length >= gate.min

export const passesWatchOrder = (franchise, gate) => franchise.ids.length >= gate.min
