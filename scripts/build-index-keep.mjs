#!/usr/bin/env node
/**
 * Writes a site's data/index-keep.json from a Search Console export: every
 * page with at least one Google impression in the window. A page on the list
 * is never noindexed (packages/core/src/where/thin.mjs). With no list, or an
 * empty one, nothing is noindexed at all.
 *
 *   node scripts/build-index-keep.mjs <export.csv|export.json> [--site anime] [--start 2026-07-12 --end 2026-10-10]
 *
 * The export may be:
 *   - a CSV with the page address in the first column (Search Console's
 *     "Pages" export: "Top pages,Clicks,Impressions,..."); a row is kept when
 *     it has no impressions column or the impressions are 1 or more
 *   - a JSON array of addresses or of { page | keys: [page], impressions }
 *   - a JSON object { paths: [...] }
 * Addresses may be full URLs or paths; only the path is kept.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

/** '/anime/x' from a URL or a path, or '' when it is neither. */
export function pathOf(value) {
  const raw = String(value ?? '').trim().replace(/^"|"$/g, '')
  if (!raw) return ''
  try {
    const path = raw.startsWith('/') ? raw : new URL(raw).pathname
    const clean = path.split(/[?#]/)[0].replace(/(.)\/+$/, '$1')
    return clean.startsWith('/') ? clean : ''
  } catch {
    return ''
  }
}

/** The paths of an export's text, sorted, each once. */
export function pathsOf(text, isJson) {
  const rows = []
  if (isJson) {
    const json = JSON.parse(text)
    for (const row of Array.isArray(json) ? json : json.paths || json.rows || []) {
      if (typeof row === 'string') rows.push([row, 1])
      else rows.push([row.page || row.path || row.url || row.keys?.[0], row.impressions ?? 1])
    }
  } else {
    const lines = text.split(/\r?\n/).filter(Boolean)
    const head = lines[0].split(',').map((cell) => cell.trim().toLowerCase())
    const at = head.indexOf('impressions')
    for (const line of lines) {
      const cells = line.split(',')
      rows.push([cells[0], at > 0 ? Number(cells[at]) : 1])
    }
  }
  return [...new Set(rows.filter(([, shown]) => !(shown < 1)).map(([page]) => pathOf(page)).filter(Boolean))].sort()
}

function main() {
  const args = process.argv.slice(2)
  const flag = (name, fallback = '') => (args.includes(`--${name}`) ? args[args.indexOf(`--${name}`) + 1] : fallback)
  const file = args.find((a, i) => !a.startsWith('--') && !(args[i - 1] || '').startsWith('--'))
  if (!file) {
    console.error('Usage: node scripts/build-index-keep.mjs <export.csv|export.json> [--site anime] [--start YYYY-MM-DD --end YYYY-MM-DD]')
    process.exit(1)
  }
  const paths = pathsOf(readFileSync(file, 'utf8'), /\.json$/i.test(file))
  const out = join(dirname(fileURLToPath(import.meta.url)), '..', 'sites', flag('site', 'anime'), 'data', 'index-keep.json')
  const about = 'Every page with at least one Google impression in the window. A page on this list is never noindexed. Refresh by hand: Actions has no Search Console login.'
  writeFileSync(out, `${JSON.stringify({ about, window: { start: flag('start'), end: flag('end') }, paths }, null, 1)}\n`)
  console.log(`${paths.length} paths written to ${out}`)
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main()
