// One hash, used by the build script and by the Worker. A slug must always
// land in the same shard on both sides, so this file must never change
// without rebuilding every shard.
export function bucket(key, count) {
  let h = 0x811c9dc5
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return h % count
}

// How many shard files there are. FIXED, never derived from the catalog size.
// The count used to grow with the catalog, so every build moved almost every
// record to a different file, and a Worker isolate holding the previous
// manifest read the wrong shard. At ~107,000 titles and ~100,000 character
// pages this is about 105 and 195 records per file: 1,536 files in total,
// far under the 20,000 the free plan allows, and one file parses in a few ms.
// Changing either number rehashes everything: only do it with a full rebuild.
export const TITLE_SHARDS = 1024
export const CHARACTER_SHARDS = 512

export const titleKey = (kind, slug) => `${kind}/${slug}`

// The "My list" rows, one small JSON file per bucket at /d/l/<n>.json. They
// are keyed by AniList id, not by slug: an id never changes, and an AniList
// import only knows ids. The id is already a number, so the bucket is a plain
// remainder, which the browser can work out with no hash at all. Fixed for
// the same reason as the counts above: changing it moves every row.
// 512 files at ~110,000 titles is about 215 rows, a few KB gzipped, per file,
// so a 100-title list downloads a few hundred KB, not megabytes. Total files
// stay far under the free plan's 20,000.
export const LIST_SHARDS = 512
export const listBucket = (id) => Math.abs(Math.trunc(Number(id)) || 0) % LIST_SHARDS
