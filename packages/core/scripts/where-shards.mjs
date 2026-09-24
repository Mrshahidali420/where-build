/**
 * Writing a Where site's shard files: the same format the core writes
 * (scripts/make-shards.mjs) and the Worker reads (src/lib/runtime.js). One
 * record per line, "key<TAB>json", so the Worker finds its line with a string
 * search and parses only that record.
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { bucket } from '../src/lib/shard-key.js'

/** Write `records` ([key, record]) into `count` files under dir. */
export function writeShardFolder(dir, records, count) {
  const shards = Array.from({ length: count }, () => [])
  for (const [key, record] of records) shards[bucket(key, count)].push(`${key}\t${JSON.stringify(record)}`)
  mkdirSync(dir, { recursive: true })
  let bytes = 0
  let biggest = 0
  for (let n = 0; n < count; n++) {
    const text = `\n${shards[n].join('\n')}${shards[n].length ? '\n' : ''}`
    writeFileSync(join(dir, `${n}.txt`), text)
    bytes += text.length
    biggest = Math.max(biggest, text.length)
  }
  return { records: records.length, files: count, bytes, biggest }
}
