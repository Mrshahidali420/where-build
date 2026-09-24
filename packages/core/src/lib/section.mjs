// Which section of the site a title lives in. This is the one place that
// turns a catalog record into a URL folder, so /manhwa, /manga, /manhua,
// /novel and /anime never disagree about where a title belongs.
//
// Pure and tiny on purpose: scripts import it at ingest time, catalog.js at
// build time and the Worker at request time.

/** URL folder by country, for comics. Anything else is filed under manga. */
const SECTION_OF_COUNTRY = { KR: 'manhwa', JP: 'manga', CN: 'manhua', TW: 'manhua' }

/** Every section that owns a browse page and a title folder, in nav order. */
export const SECTIONS = ['manhwa', 'manga', 'manhua', 'novel', 'anime']

/** The sections whose titles are read rather than watched. */
export const READ_SECTIONS = ['manhwa', 'manga', 'manhua', 'novel']

/** The comic sections: the read sections without novels. */
export const COMIC_SECTIONS = ['manhwa', 'manga', 'manhua']

/**
 * The section a record belongs to: 'anime', 'novel', or one of the three
 * comic sections by country of origin. A novel is a light or web novel
 * (AniList format NOVEL); it is a MANGA record on AniList, so kind decides
 * before country does.
 */
export const sectionOf = (item) => {
  if (item.kind === 'anime') return 'anime'
  if (item.kind === 'novel') return 'novel'
  return SECTION_OF_COUNTRY[item.country] || 'manga'
}

/** The public path of a title. */
export const pathOfTitle = (item) => `/${sectionOf(item)}/${item.slug}`
