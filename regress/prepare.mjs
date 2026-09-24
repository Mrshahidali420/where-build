#!/usr/bin/env node
/**
 * Get both sides of the regression check ready, from one manhwaindex commit.
 *
 *   node regress/prepare.mjs [--repo ../manhwaindex] [--commit dcf561e]
 *
 *   .regress/mi-build        manhwaindex exactly at the commit (git archive, so
 *                            the manhwaindex working tree is only read). Build
 *                            it there with its own `npm run build`.
 *   regress/manhwaindex/     the same site from packages/core. Its public/
 *                            and data/ are filled here from that export: the
 *                            files manhwaindex keeps by hand, never the ones
 *                            its build writes.
 *
 * Both sides then build from the seed catalog (scripts/unseed.sh) and the same
 * themes.json, so the only thing that differs is the code.
 */
import { execFileSync } from 'node:child_process'
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = fileURLToPath(new URL('.', import.meta.url))
const ROOT = resolve(HERE, '..')
const BASELINE = join(ROOT, '.regress', 'mi-build')
const SITE = join(HERE, 'manhwaindex')

function option(name, fallback) {
  const at = process.argv.indexOf(`--${name}`)
  return at > 0 && process.argv[at + 1] ? process.argv[at + 1] : fallback
}
const repo = resolve(ROOT, option('repo', '../manhwaindex'))
const commit = option('commit', 'dcf561e')

// Files the core writes for itself from the config, so the copies are left out.
const GENERATED = new Set(['robots.txt', 'site.webmanifest', 'ads.txt', '_headers', 'brand', 'd'])

if (!existsSync(BASELINE)) {
  mkdirSync(BASELINE, { recursive: true })
  // autocrlf off: the build must see the files exactly as git holds them (LF).
  const tar = execFileSync('git', ['-C', repo, '-c', 'core.autocrlf=false', 'archive', commit], { maxBuffer: 1 << 30 })
  execFileSync('tar', ['-x', '-C', BASELINE], { input: tar })
  console.log(`exported ${commit} to .regress/mi-build`)
}

const key = readdirSync(join(BASELINE, 'public')).find((name) => /^[0-9a-f]{32}\.txt$/.test(name))
rmSync(join(SITE, 'public'), { recursive: true, force: true })
mkdirSync(join(SITE, 'public'), { recursive: true })
for (const name of readdirSync(join(BASELINE, 'public'))) {
  if (GENERATED.has(name) || name === key) continue
  cpSync(join(BASELINE, 'public', name), join(SITE, 'public', name), { recursive: true })
}

// The data manhwaindex keeps in git, plus the song list when the baseline has
// one. The catalog comes from the seed, on both sides.
const tracked = execFileSync('git', ['-C', repo, 'ls-tree', '--name-only', commit, 'data/'])
  .toString()
  .split('\n')
  .filter((path) => path.endsWith('.json'))
rmSync(join(SITE, 'data'), { recursive: true, force: true })
mkdirSync(join(SITE, 'data'), { recursive: true })
for (const path of [...tracked, 'data/themes.json']) {
  const from = join(BASELINE, path)
  if (existsSync(from)) cpSync(from, join(SITE, path))
}
console.log(`regress/manhwaindex: public/ and ${readdirSync(join(SITE, 'data')).length} data files ready`)
