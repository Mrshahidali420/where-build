/**
 * data/index-keep.json in a site's folder: the pages Google showed at least
 * once in the window the file names. A thin page on this list keeps its place
 * in the index (src/where/thin.mjs).
 *
 * Build time only (scripts/make-where.mjs): read from disk, never part of the
 * Worker. The file is made by hand from Search Console with
 * scripts/build-index-keep.mjs, because GitHub Actions has no Search Console
 * login. A missing or empty file means an empty list, and an empty list turns
 * the thin-page rule off: nothing is noindexed without it.
 */
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

export function loadIndexKeep(root = process.cwd()) {
  const file = join(root, 'data', 'index-keep.json')
  if (!existsSync(file)) return new Set()
  const paths = JSON.parse(readFileSync(file, 'utf8')).paths
  return new Set(Array.isArray(paths) ? paths.filter((p) => typeof p === 'string' && p.startsWith('/')) : [])
}
