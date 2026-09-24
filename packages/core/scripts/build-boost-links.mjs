/**
 * Builds data/boost-links.json: the "Readers also look for" links, and
 * data/home-boost.json: the home page's "Popular characters right now".
 *
 * A page Google already ranks near the top (a source) gets up to three plain
 * links to related pages Google nearly ranks, at position 8 to 20 (targets).
 * The rules, and what "related" means, are in src/lib/boost-core.mjs. The
 * page side is src/lib/boost-links.js and src/components/AlsoLookFor.astro.
 *
 * Most targets have no such source. The home page links the best twenty of
 * those instead: ranked by impressions times closeness to page one, only
 * targets that got no pair this month, never one whose top search names
 * another story, and only pages that answer 200 on the live site today. The
 * page side is src/components/PopularNow.astro.
 *
 * WHERE THE DATA COMES FROM
 *
 * 1. Search Console, last 28 days, web search, two files in --in
 *    (default tasks/gsc-data/):
 *    - pages.json       rows with dimension ["page"]
 *    - query_page.json  rows with dimensions ["query", "page"]
 *    Both are the Search Analytics API's own rows ({ keys, clicks,
 *    impressions, position }), saved as a JSON array or as { rows }. The
 *    gsc-mcp tool gsc_performance (site sc-domain:<the domain>, dim
 *    "page", limit 25000) gives pages.json. query_page.json needs the two
 *    dimensions at once, which gsc_performance does not do: pull it with the
 *    Search Analytics API (searchanalytics.query, dimensions query+page,
 *    rowLimit 25000). Without it the script still runs, but every anchor is
 *    the page's plain name and the "query names another story" check is off.
 * 2. The live catalog shards (/d/c/*.txt, /d/t/*.txt) on the site itself,
 *    read over HTTP. The repo only holds a small seed catalog, so the live
 *    shards are the only full copy on the owner's PC. Plain static files:
 *    they cost no Worker requests. Cached in the temp folder per build.
 * 3. Each candidate source page's live HTML, to drop pairs the page already
 *    links. The page's own "Readers also look for" block is cut out first.
 *
 * MONTHLY REFRESH (docs/boost-links.md has the same steps)
 *
 *   1. Pull the two Search Console files into tasks/gsc-data/.
 *   2. node scripts/build-boost-links.mjs
 *   3. Read the printed pairs and the home list. Commit data/boost-links.json,
 *      data/home-boost.json and the baseline file, then deploy as usual.
 *   4. Three to four weeks later, pull again and compare each target's
 *      position with tasks/gsc-data/boost-baseline-<date>.json.
 *
 * Options: --in <dir>  --out <file>  --home <file>  --site <origin>
 *          --dry (print, write nothing)
 *
 * Reads only. It never writes to the site.
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { tmpdir } from 'node:os'
import { bucket, titleKey, TITLE_SHARDS, CHARACTER_SHARDS } from '../src/lib/shard-key.js'
import { displayName } from '../src/lib/names.mjs'
import { sectionOf } from '../src/lib/section.mjs'
import { wordOf, verbOf } from '../src/lib/answers.mjs'
import {
  RULES,
  pageOf,
  pagesFromGsc,
  topQueries,
  pickTargets,
  pickSources,
  relatedToCharacter,
  relatedToTitle,
  queryMismatch,
  anchorFor,
  choosePairs,
  linksTo,
  HOME_MAX,
  rankHomeTargets,
  homeItemFor,
} from '../src/lib/boost-core.mjs'
import { writeFileAtomic } from '../src/lib/write-atomic.mjs'
import config from '../src/lib/site.mjs'

// The site being built is the working directory (scripts/build-site.mjs), so
// its data/ and dist/ are found from there, not from this file.
const ROOT = process.cwd()

function option(name, fallback) {
  const at = process.argv.indexOf(`--${name}`)
  return at > 0 && process.argv[at + 1] ? process.argv[at + 1] : fallback
}
// resolve, not join: a full path given on the command line stays as it is.
const IN = resolve(ROOT, option('in', 'tasks/gsc-data'))
const OUT = resolve(ROOT, option('out', 'data/boost-links.json'))
const HOME_OUT = resolve(ROOT, option('home', 'data/home-boost.json'))
const SITE = option('site', config.siteUrl).replace(/\/+$/, '')
const DRY = process.argv.includes('--dry')

// A character in forty anime films would need forty title reads. The most
// popular appearances carry the cast anyone searches for.
const APPEARANCES_READ = 15
const PARALLEL = 6
// Bot Fight Mode answers a bare script with a challenge page.
const HEADERS = {
  'user-agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36',
}

const readJson = (file) => JSON.parse(readFileSync(file, 'utf8'))

async function fetchText(url) {
  const res = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(30000) })
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`)
  return res.text()
}

/** Runs `work` on every item, a few at a time. */
async function eachLimited(items, work) {
  const queue = [...items]
  const workers = Array.from({ length: PARALLEL }, async () => {
    while (queue.length) await work(queue.shift())
  })
  await Promise.all(workers)
}

/**
 * The live shards, one file per bucket, kept on disk for this build of the
 * site (the manifest's builtAt), so a second run the same day reads nothing.
 */
function shardReader(builtAt) {
  const dir = join(tmpdir(), `${config.key}-shards-${builtAt}`)
  mkdirSync(dir, { recursive: true })
  const files = new Map()
  async function file(folder, n) {
    const key = `${folder}-${n}`
    if (!files.has(key)) {
      files.set(key, (async () => {
        const cached = join(dir, `${key}.txt`)
        const text = existsSync(cached)
          ? readFileSync(cached, 'utf8')
          : await fetchText(`${SITE}/d/${folder}/${n}.txt`)
        if (!existsSync(cached)) writeFileSync(cached, text)
        const rows = new Map()
        for (const line of text.split('\n')) {
          const tab = line.indexOf('\t')
          if (tab > 0) rows.set(line.slice(0, tab), line.slice(tab + 1))
        }
        return rows
      })())
    }
    return files.get(key)
  }
  async function record(folder, count, key) {
    const raw = (await file(folder, bucket(key, count))).get(key)
    return raw ? JSON.parse(raw) : null
  }
  return {
    character: (slug) => record('c', CHARACTER_SHARDS, slug),
    title: (section, slug) => record('t', TITLE_SHARDS, titleKey(section, slug)),
  }
}

/** Everything the rules need to know about one target page. */
async function describeTarget(target, shards) {
  const page = pageOf(target.path)
  if (page.type === 'character') {
    const person = await shards.character(page.slug)
    if (!person) return null
    const rows = [...(person.appearsIn || [])]
      .sort((a, b) => (b.popularity || 0) - (a.popularity || 0))
      .slice(0, APPEARANCES_READ)
    const titles = new Map()
    await eachLimited(rows, async (row) => {
      const section = sectionOf(row)
      const found = await shards.title(section, row.slug).catch(() => null)
      if (found) titles.set(`/${section}/${row.slug}`, found)
    })
    const { primary } = displayName(person)
    return {
      page,
      name: primary,
      names: [person.name, person.native, ...(person.aliases || [])].filter(Boolean),
      seriesTitles: rows.map((r) => r.title),
      ownText: person.description || '',
      image: person.image || '',
      related: relatedToCharacter({ ...person, appearsIn: rows }, titles),
    }
  }
  const title = await shards.title(page.section, page.slug)
  if (!title) return null
  return {
    page,
    name: title.title,
    // Every name the title goes by is its own name, not another story.
    names: [title.titleRomaji, ...(title.synonyms || [])].filter(Boolean),
    seriesTitles: [title.title, title.titleRomaji, ...(title.synonyms || [])].filter(Boolean),
    ownText: title.description || '',
    word: wordOf(page.section),
    verb: verbOf(page.section),
    image: title.cover || '',
    related: relatedToTitle(title, page.base),
  }
}

async function main() {
  const pagesFile = join(IN, 'pages.json')
  if (!existsSync(pagesFile)) throw new Error(`no ${pagesFile}: pull Search Console first (see the header)`)
  const pages = pagesFromGsc(readJson(pagesFile))
  const pairFile = join(IN, 'query_page.json')
  const queries = existsSync(pairFile) ? topQueries(readJson(pairFile)) : new Map()
  if (!queries.size) console.log('  no query_page.json: anchors fall back to page names')

  const targets = pickTargets(pages)
  const sources = pickSources(pages)
  const sourcesByBase = new Map()
  for (const source of sources) {
    const base = pageOf(source.path).base
    sourcesByBase.set(base, [...(sourcesByBase.get(base) || []), source])
  }
  console.log(`${pages.size} pages: ${targets.length} targets (position ${RULES.targetMinPos}-${RULES.targetMaxPos}), ${sources.length} sources`)

  const manifest = JSON.parse(await fetchText(`${SITE}/d/manifest.json`))
  const shards = shardReader(manifest.builtAt)

  const candidates = []
  // Every target that passed the checks below, for the home block.
  const described = new Map()
  const skipped = { unreadable: 0, mismatch: 0 }
  await eachLimited(targets, async (target) => {
    const facts = await describeTarget(target, shards).catch((e) => {
      console.log(`  ${target.path}: not read (${e.message})`)
      return null
    })
    if (!facts) {
      skipped.unreadable++
      return
    }
    const query = queries.get(target.path)?.query || ''
    if (query && queryMismatch(query, [facts.name, ...facts.names], facts.seriesTitles, facts.ownText)) {
      skipped.mismatch++
      console.log(`  ${target.path}: top query "${query}" names another story, skipped`)
      return
    }
    described.set(target.path, { ...facts, query, target })
    const anchor = anchorFor({ ...facts, query })
    for (const [base, why] of facts.related) {
      for (const source of sourcesByBase.get(base) || []) {
        if (source.path !== target.path) candidates.push({ source, target, anchor, why, query })
      }
    }
  })
  console.log(`${candidates.length} related pairs (${skipped.unreadable} targets unreadable, ${skipped.mismatch} query mismatches)`)

  // Drop pairs the source page already links. A page that cannot be read is
  // kept: one more link to a related page does no harm.
  const html = new Map()
  await eachLimited([...new Set(candidates.map((c) => c.source.path))], async (path) => {
    html.set(path, await fetchText(`${SITE}${path}`).catch(() => null))
  })
  const fresh = candidates.filter((c) => {
    const page = html.get(c.source.path)
    return page === null || !linksTo(page, c.target.path, SITE)
  })
  const unchecked = [...html.values()].filter((v) => v === null).length
  console.log(`${fresh.length} not linked yet (${candidates.length - fresh.length} already linked, ${unchecked} source pages not readable)`)

  const { links, kept } = choosePairs(fresh)
  for (const pair of kept) {
    console.log(`  ${pair.source.path} (${pair.source.pos.toFixed(1)}) -> ${pair.target.path} (${pair.target.pos.toFixed(1)}, ${pair.target.impr} impr) "${pair.anchor}"  [${pair.why}]`)
  }
  console.log(`${kept.length} links on ${Object.keys(links).length} source pages`)

  const home = await homeItems(described, kept)
  console.log(`home page, "Popular characters right now": ${home.length} links`)
  for (const item of home) console.log(`  ${item.path}  "${item.name}" · ${item.story}${item.image ? '' : '  (no face)'}`)
  if (DRY) return

  const updated = new Date().toISOString().slice(0, 10)
  writeFileAtomic(OUT, JSON.stringify({ updated, links }, null, 2) + '\n')
  writeFileAtomic(HOME_OUT, JSON.stringify({ updated, items: home }, null, 2) + '\n')
  // What each target looked like the day it got its link: the thing to beat.
  const baseline = kept.map((p) => ({
    target: p.target.path,
    source: p.source.path,
    query: p.query,
    pos: Number(p.target.pos.toFixed(2)),
    impr: p.target.impr,
    clicks: p.target.clicks,
  }))
  writeFileAtomic(join(IN, `boost-baseline-${updated}.json`), JSON.stringify({ updated, baseline }, null, 2) + '\n')
  console.log(`wrote ${OUT}, ${HOME_OUT} and the baseline`)
}

/** The status a URL answers with, redirects not followed. 0 when it cannot be read. */
async function statusOf(url) {
  try {
    const res = await fetch(url, { headers: HEADERS, redirect: 'manual', signal: AbortSignal.timeout(30000) })
    await res.body?.cancel()
    return res.status
  } catch {
    return 0
  }
}

/**
 * The home block's rows: the best targets that got no pair this month, in
 * rank order, each page checked live. A page that moved (301) or went away is
 * skipped rather than linked from the home page. A face that does not load is
 * dropped and the row keeps its name.
 */
async function homeItems(described, kept) {
  const linked = new Set(kept.map((pair) => pair.target.path))
  const ranked = rankHomeTargets([...described.values()].map((d) => d.target), linked)
  // A few spares, so a page that fails the check still leaves twenty.
  const shortlist = ranked.slice(0, HOME_MAX + 10)
  const rows = new Map()
  await eachLimited(shortlist, async (target) => {
    const item = homeItemFor({ ...described.get(target.path), path: target.path })
    const status = await statusOf(`${SITE}${target.path}`)
    if (status !== 200) {
      console.log(`  home: ${target.path} answers ${status}, skipped`)
      return
    }
    if (item.image && (await statusOf(item.image)) !== 200) {
      console.log(`  home: face for ${target.path} did not load, dropped`)
      const { image, ...bare } = item
      rows.set(target.path, bare)
      return
    }
    rows.set(target.path, item)
  })
  return shortlist.filter((t) => rows.has(t.path)).slice(0, HOME_MAX).map((t) => rows.get(t.path))
}

main().catch((e) => {
  console.error('BUILD BOOST LINKS FAILED:', e.message)
  process.exit(1)
})
