#!/usr/bin/env node
/**
 * Build one site: the four steps every site's build runs, in the site's own
 * folder.
 *
 *   cd sites/anime && npm run build        (ALLOW_SHRINK=1 on a local seed build)
 *
 *   1. make-redirects.mjs  the slug registry and the old-address map
 *   2. make-shards.mjs     the catalog cut into shards, the search slices, the
 *                          few numbers the page shell shows
 *   3. astro build         the pages, through the core integration
 *   4. after-build.mjs     .assetsignore and the 25 MB asset check
 *
 * The catalog must already be in the site's data/: pulled from R2 by
 * scripts/catalog-snapshot.mjs, or unpacked from the seed by scripts/unseed.sh.
 * Every step runs with the site's folder as its working directory and
 * SITE_CONFIG naming its site.config.mjs (src/lib/site.mjs reads it).
 */
import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const SCRIPTS = dirname(fileURLToPath(import.meta.url))
const ASTRO = join(dirname(createRequire(import.meta.url).resolve('astro/package.json')), 'astro.js')

const site = process.cwd()
const config = join(site, 'site.config.mjs')
if (!existsSync(config)) {
  console.error(`No site.config.mjs in ${site}. Run this from a site's folder.`)
  process.exit(1)
}

const steps = [
  ['make-redirects', [join(SCRIPTS, 'make-redirects.mjs')]],
  ['make-shards', ['--max-old-space-size=6000', join(SCRIPTS, 'make-shards.mjs')]],
  ['astro build', [ASTRO, 'build']],
  ['after-build', [join(SCRIPTS, 'after-build.mjs')]],
]

for (const [name, args] of steps) {
  const started = Date.now()
  const run = spawnSync(process.execPath, args, {
    cwd: site,
    stdio: 'inherit',
    env: { ...process.env, SITE_CONFIG: config },
  })
  if (run.status !== 0) {
    console.error(`build-site: ${name} failed (exit ${run.status ?? run.signal})`)
    process.exit(run.status || 1)
  }
  console.log(`build-site: ${name} done in ${((Date.now() - started) / 1000).toFixed(1)}s`)
}
