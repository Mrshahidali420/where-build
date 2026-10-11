#!/usr/bin/env node
/**
 * Measures a Where site's pages from its built shards (public/d): how many
 * words each page type prints, how much of it the site wrote, how often two
 * pages are near twins, the sentences repeated on the most pages, how many
 * pages are flagged noindex, and the internal link graph.
 *
 *   cd sites/anime && node ../../packages/core/scripts/measure-where.mjs --label baseline
 *
 * Read-only. Prints a small markdown table and writes the full numbers to
 * tasks/measure/<date>-<label>.json at the repo root.
 */
import { readdirSync, readFileSync, mkdirSync, writeFileSync, existsSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { sample, summarize, wordCount } from './measure-core.mjs'
import { titleText, voiceText, staffText, artistText } from '../src/where/page-text.mjs'
import { dataBlocks } from '../src/where/title-depth.mjs'
import { linkGraph } from '../src/where/link-graph.mjs'
import { WHERE_SHARDS } from '../src/where/shard-folders.mjs'
import config from '../src/lib/site.mjs'

const SAMPLE = 2500
const SEED = 20261011
const ROOT = process.cwd()
const OUT = join(ROOT, 'public', 'd')
const arg = (name, fallback) => {
  const at = process.argv.indexOf(`--${name}`)
  return at > 0 ? process.argv[at + 1] : fallback
}
const label = arg('label', 'local')

function readFolder(folder) {
  const dir = join(OUT, folder)
  const records = []
  for (const file of readdirSync(dir)) {
    for (const line of readFileSync(join(dir, file), 'utf8').split('\n')) {
      const tab = line.indexOf('\t')
      if (tab > 0) records.push(JSON.parse(line.slice(tab + 1)))
    }
  }
  return records
}

const titles = readFolder('t')
const people = readFolder(WHERE_SHARDS.person.folder)
const studios = readFolder(WHERE_SHARDS.studio.folder)
const artists = readFolder(WHERE_SHARDS.artist.folder)
const watch = readFolder(WHERE_SHARDS.watch.folder)
const now = Math.floor(Date.now() / 1000)

const groups = {
  title: titles.filter((r) => !r.noindex).map((r) => titleText(r, { siteName: config.name, now })),
  'title (0-1 blocks)': titles.filter((r) => dataBlocks(r) < 2).map((r) => titleText(r, { siteName: config.name, now })),
  voice: people.filter((p) => p.voicePage && !p.noindexVoice).map(voiceText),
  staff: people.filter((p) => p.staffPage && !p.noindexStaff).map(staffText),
  artist: artists.filter((a) => !a.noindex).map(artistText),
}

const report = {}
for (const [name, rows] of Object.entries(groups)) {
  const picked = sample(rows, SAMPLE, SEED)
  const words = rows.map((r) => wordCount(r.site) + wordCount(r.other))
  report[name] = { ...summarize(picked), all: rows.length, under100: words.filter((w) => w < 100).length }
}
const links = linkGraph({ titles, people, studios, artists, watch })
const noindex = {
  voice: people.filter((p) => p.voicePage && p.noindexVoice).length,
  staff: people.filter((p) => p.staffPage && p.noindexStaff).length,
  artist: artists.filter((a) => a.noindex).length,
}

const pct = (n) => `${Math.round(n * 1000) / 10}%`
const lines = [`## Measure: ${label}`, '', '| page type | indexable pages | words median | words p10 | own words median | under 100 words | near-dup | top repeated sentence |', '|---|---|---|---|---|---|---|---|']
for (const [name, r] of Object.entries(report)) {
  const top = r.topSentences[0]
  lines.push(`| ${name} | ${r.all} | ${r.medianWords} | ${r.p10Words} | ${r.medianSiteWords} | ${r.under100} | ${pct(r.nearDupRate)} | ${top ? `${pct(top.share)} "${top.sentence.slice(0, 70).replace(/\|/g, '/')}"` : '-'} |`)
}
lines.push('', `Noindexed: voice ${noindex.voice}, staff ${noindex.staff}, artist ${noindex.artist}.`, '', '| link target | indexable | no link from a title page | no link at all | one link | most links in |', '|---|---|---|---|---|---|')
for (const [type, s] of Object.entries(links.types)) lines.push(`| ${type} | ${s.pages} | ${s.noTitleLink} | ${s.noLink} | ${s.oneLink} | ${s.max} (${s.top}) |`)
lines.push('', `You may also like: the most shown title is on ${links.similar.max} pages (${links.similar.top}); ${links.similar.never} titles are never shown.`, `Links to other sites from page bodies: ${links.outside}. Links from indexable pages to noindexed pages: ${links.toNoindex}.`)
console.log(lines.join('\n'))

const dir = resolve(ROOT, '..', '..', 'tasks', 'measure')
if (existsSync(resolve(ROOT, '..', '..', 'tasks'))) {
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, `${new Date().toISOString().slice(0, 10)}-${label}.json`), JSON.stringify({ label, report, links, noindex }, null, 1))
}
