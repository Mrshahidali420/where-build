/**
 * Song artists, from the opening and ending lists in themes.json
 * (scripts/sync-animethemes.mjs: AnimeThemes and AniSongDB).
 *
 * The sources give an artist as a name, not an id, so the name is the key:
 * "LiSA" and "Lisa" are one artist once folded to a slug, which is also what a
 * reader types. An artist page answers "every OP/ED by X".
 *
 * Pure.
 */
import { slugify } from '../lib/slugify.mjs'

/** The key an artist is filed under: the slug of their name, or '' for a name with no Latin letters. */
export const artistKey = (name) => slugify(name)

/**
 * Map(key -> { key, name, songs: [{ titleId, type, seq, title, episodes }] })
 * over the titles that have a page. `themes` is themes.json's byAnilistId.
 */
export function buildArtists(titles, themes) {
  const artists = new Map()
  for (const title of titles) {
    for (const song of themes[String(title.id)] || []) {
      if (!song?.title || (song.type !== 'OP' && song.type !== 'ED')) continue
      for (const name of new Set(song.artists || [])) {
        const key = artistKey(name)
        if (!key) continue
        let artist = artists.get(key)
        if (!artist) artists.set(key, (artist = { key, name: String(name).trim(), songs: [] }))
        artist.songs.push({ titleId: title.id, type: song.type, seq: song.seq || 0, title: song.title, episodes: song.episodes || '' })
      }
    }
  }
  return artists
}
