#!/usr/bin/env node
/**
 * Write wrangler.jsonc for one site, or for every site, from site.config.mjs.
 *
 *   node packages/core/scripts/make-wrangler.mjs            every sites/<site>
 *   node packages/core/scripts/make-wrangler.mjs anime      one site
 *   (or `npm run wrangler` inside a site folder: that site only)
 *
 * What goes in the file, and why the dev and domain shapes differ, is in
 * src/lib/wrangler-config.mjs.
 */
import { existsSync, readdirSync, writeFileSync } from 'node:fs'
import { basename, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { wranglerJsonc } from '../src/lib/wrangler-config.mjs'

const SITES = fileURLToPath(new URL('../../../sites/', import.meta.url))

async function write(dir) {
  const file = join(dir, 'site.config.mjs')
  if (!existsSync(file)) return
  const { default: site } = await import(pathToFileURL(file).href)
  writeFileSync(join(dir, 'wrangler.jsonc'), wranglerJsonc(site))
  console.log(`${basename(dir)}: wrangler.jsonc for ${site.host}${site.domain ? '' : ' (dev host only)'}`)
}

const named = process.argv[2]
if (named) {
  await write(join(SITES, named))
} else if (existsSync(join(process.cwd(), 'site.config.mjs'))) {
  await write(process.cwd())
} else {
  for (const name of readdirSync(SITES)) await write(join(SITES, name))
}
