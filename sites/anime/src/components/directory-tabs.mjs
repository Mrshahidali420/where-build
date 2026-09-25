// The tabs of a directory page (DirectoryRank.astro, DirectoryLetter.astro):
// each ranked list, then the A to Z, the one on show marked.
import { GROUPS, LETTERS, letterPath, sortPath } from '@sister/core/src/where/hubs.mjs'

/** `current`: a sort key, or 'az' on a letter page. */
export function directoryTabs(group, dir, current) {
  const sorts = Object.entries(GROUPS[group].sorts).map(([sort, label]) => ({ label, href: sortPath(group, sort), current: sort === current }))
  const first = LETTERS.slice(1).find((letter) => dir.letters[letter]?.length) || '0'
  return [...sorts, { label: 'A to Z', href: letterPath(group, dir, first), current: current === 'az' }]
}
