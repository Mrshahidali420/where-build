#!/usr/bin/env node
/**
 * Compare two builds, or two sets of fetched pages, file by file.
 *
 *   node regress/diff-pages.mjs <baseline dir> <core dir>
 *
 * Every file on either side is paired by its path, with Vite's content hash
 * taken out of the file names under _astro/. The Worker's own bundle
 * (_worker.js/) is left out: it is code, and the pages it renders are
 * compared instead (regress/fetch-pages.mjs). Each pair is compared twice:
 *   exact    byte for byte, after masking what any rebuild of the same code
 *            changes: those hashes wherever they are named, and the build stamp.
 *   content  the same, with the whitespace between and around tags collapsed,
 *            which a browser does not render. A page counts as the same when
 *            this matches.
 *
 * Prints each file that differs, with the first place it differs, and a
 * total. Exits 1 when any file's content differs or is on one side only.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const [baseDir, coreDir] = process.argv.slice(2)
if (!baseDir || !coreDir) {
  console.error('usage: node regress/diff-pages.mjs <baseline dir> <core dir>')
  process.exit(2)
}

const SKIP = new Set(['_worker.js'])
const HASHED = /\.[A-Za-z0-9_-]{8}\.(js|css)\b/g

function walk(dir, root = dir) {
  const out = []
  for (const name of readdirSync(dir)) {
    const path = join(dir, name)
    if (dir === root && SKIP.has(name)) continue
    if (statSync(path).isDirectory()) out.push(...walk(path, root))
    else out.push(relative(root, path).replace(/\\/g, '/'))
  }
  return out
}

/** Path with the hash masked -> real path. */
function filesOf(dir) {
  return new Map(walk(dir).map((path) => [path.replace(HASHED, '.HASH.$1'), path]))
}

/**
 * What a rebuild of the same code changes anyway, plus Astro's scoped-style
 * ids: data-astro-cid-* is a hash of the component's file path, and the core's
 * pages live at another path than manhwaindex's.
 */
function mask(text) {
  return text
    .replace(HASHED, '.HASH.$1')
    .replace(/"builtAt":\s*\d+/g, '"builtAt":0')
    .replace(/astro-cid-[a-z0-9]{8}/g, 'astro-cid-X')
}

/** Whitespace a browser does not render. */
function collapse(text) {
  return text.replace(/\s+/g, ' ').replace(/>\s+/g, '>').replace(/\s+</g, '<').trim()
}

function firstDifference(a, b) {
  let at = 0
  while (at < a.length && at < b.length && a[at] === b[at]) at++
  const from = Math.max(0, at - 100)
  return { at, base: a.slice(from, at + 140), core: b.slice(from, at + 140) }
}

const base = filesOf(baseDir)
const core = filesOf(coreDir)
let exact = 0
let same = 0
const differs = []
for (const [key, path] of base) {
  if (!core.has(key)) continue
  const left = mask(readFileSync(join(baseDir, path), 'utf8'))
  const right = mask(readFileSync(join(coreDir, core.get(key)), 'utf8'))
  if (left === right) exact++
  if (collapse(left) === collapse(right)) same++
  else differs.push([key, firstDifference(collapse(left), collapse(right))])
}
const onlyBase = [...base.keys()].filter((key) => !core.has(key))
const onlyCore = [...core.keys()].filter((key) => !base.has(key))

for (const [key, diff] of differs) console.log(`DIFF ${key} at ${diff.at}\n  base: ${diff.base}\n  core: ${diff.core}`)
for (const key of onlyBase) console.log(`ONLY IN BASELINE ${key}`)
for (const key of onlyCore) console.log(`ONLY IN CORE ${key}`)
console.log(
  `${base.size} baseline files: ${same} same content (${exact} byte-identical after masking), ` +
    `${differs.length} differ, ${onlyBase.length} only in baseline, ${onlyCore.length} only in core`
)
process.exit(differs.length || onlyBase.length || onlyCore.length ? 1 : 0)
