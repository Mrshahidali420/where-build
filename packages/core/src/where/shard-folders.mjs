/**
 * The shard folders of a Where site's entity pages, under public/d/, and how
 * many files each holds. Titles use the core's own folder ('t', TITLE_SHARDS
 * in src/lib/shard-key.js).
 *
 * FIXED, like the core's counts: the build and the Worker hash a key into the
 * same file only while these numbers stay put, so changing one needs a full
 * rebuild. Sized for the anime site's measured pages (September 2026: about
 * 25,000 people, 600 studios, 4,000 artists, 1,100 franchises) with room to
 * grow, and far under the 20,000 static files a Worker may carry.
 */
export const WHERE_SHARDS = {
  person: { folder: 'p', count: 512 },
  studio: { folder: 's', count: 32 },
  artist: { folder: 'a', count: 128 },
  watch: { folder: 'w', count: 64 },
}
