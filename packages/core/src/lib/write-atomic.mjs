// Write a file so that a reader never sees half of it.
//
// A plain writeFileSync truncates the file first and then fills it. A run
// killed in between (a cancelled job, a runner out of memory, a timeout) left
// a catalog file cut off mid-record, the next job could not parse it, and the
// whole catalog fell back to the small seed copy. Writing to a temporary file
// in the SAME folder and renaming it over the old one is atomic on the same
// disk: the name points at the old whole file or the new whole file, never at
// a torn one.
//
// It lives in src/lib, not in scripts/, because the slug registry reader
// (src/lib/slug-registry.mjs) is imported by catalog.js and must not reach
// into the scripts folder. scripts/anilist-core.mjs re-exports it.
import { writeFileSync, renameSync, rmSync } from 'node:fs'

// Windows can refuse a rename for a moment while a virus scanner or the
// search indexer holds the old file open. A few short waits clear it.
const RENAME_TRIES = 10
const RENAME_WAIT_MS = 100

const pause = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms)

function renameWithRetry(from, to) {
  for (let attempt = 1; ; attempt++) {
    try {
      renameSync(from, to)
      return
    } catch (error) {
      const busy = error.code === 'EPERM' || error.code === 'EBUSY' || error.code === 'EACCES'
      if (!busy || attempt >= RENAME_TRIES) throw error
      pause(RENAME_WAIT_MS)
    }
  }
}

/** Write text to `file` through a temporary file and a rename. */
export function writeFileAtomic(file, text) {
  // The process id keeps two writers of the same file from sharing one
  // temporary file and tearing it that way instead.
  const tmp = `${file}.${process.pid}.tmp`
  writeFileSync(tmp, text)
  try {
    renameWithRetry(tmp, file)
  } catch (error) {
    rmSync(tmp, { force: true })
    throw error
  }
}

/** JSON.stringify(value, null, space) written atomically. */
export function writeJsonAtomic(file, value, space) {
  writeFileAtomic(file, JSON.stringify(value, null, space))
}
