#!/usr/bin/env node
/**
 * Serve one built site with `wrangler dev` and save what it answers for a
 * list of pages, so two builds can be compared by regress/diff-pages.mjs.
 *
 *   node regress/fetch-pages.mjs <site dir> <out dir> [--port 8791]
 *
 * The site dir holds wrangler.jsonc and a built dist/. The page list is picked
 * once from that site's data/ (the answer lists the build wrote) and kept in
 * .regress/pages/paths.txt, so the second run asks the other build for exactly
 * the same pages. Both runs must use the same port: a page rendered by the
 * Worker may carry its own address.
 *
 * Saved per page: the body, as <out dir>/<path>.html (or its own extension),
 * and one line in <out dir>/_answers.txt with the status and the headers that
 * matter to a crawler.
 *
 * Only one wrangler runs at a time, and it is stopped for real at the end:
 * its whole process tree is killed and the port is checked free.
 */
import { execFileSync, spawn } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const WRANGLER = join(dirname(createRequire(join(ROOT, 'package.json')).resolve('wrangler/package.json')), 'bin', 'wrangler.js')
const PATHS = join(ROOT, '.regress', 'pages', 'paths.txt')
const HEADERS = ['content-type', 'x-robots-tag', 'location', 'cache-control']

const [siteArg, outArg] = process.argv.slice(2)
if (!siteArg || !outArg) {
  console.error('usage: node regress/fetch-pages.mjs <site dir> <out dir> [--port 8791]')
  process.exit(2)
}
const siteDir = resolve(siteArg)
const outDir = resolve(outArg)
const portAt = process.argv.indexOf('--port')
const port = portAt > 0 ? Number(process.argv[portAt + 1]) : 8791

// Pages every build has, then a sample of the pages only the Worker renders.
const STATIC = [
  '/', '/manhwa', '/manga', '/manhua', '/novel', '/anime', '/genre', '/genre/action', '/mood', '/schedule',
  '/where-to-read', '/where-to-watch', '/shop', '/about', '/privacy', '/contact', '/dmca', '/character',
  '/anime/season', '/my-list', '/search', '/sitemap.xml', '/sitemap-core.xml', '/robots.txt', '/site.webmanifest',
  '/ads.txt', '/manhwa/page/2', '/no-such-page',
]

function pickPaths(dataDir) {
  const answers = JSON.parse(readFileSync(join(dataDir, 'answer-urls.json'), 'utf8'))
  const picked = new Set(STATIC)
  for (const list of Object.values(answers)) {
    // Two from the top of every answer list and two from its middle, and the
    // page each one hangs under.
    const middle = Math.floor(list.length / 2)
    for (const path of [...list.slice(0, 2), ...list.slice(middle, middle + 2)]) {
      picked.add(path)
      picked.add(path.replace(/\/[^/]+$/, ''))
    }
  }
  // One title of every kind, from the lists that cover them.
  for (const kind of ['manhwa', 'manga', 'manhua', 'novel', 'anime']) {
    const path = Object.values(answers).flat().find((p) => p.startsWith(`/${kind}/`))
    if (path) picked.add(path.split('/').slice(0, 3).join('/'))
  }
  picked.add('/manga/no-such-title-anywhere')
  picked.add('/character/no-such-character-anywhere')
  const [from] = Object.entries(JSON.parse(readFileSync(join(dataDir, 'redirects.json'), 'utf8')))[0] || []
  if (from) picked.add(from)
  return [...picked]
}

function fileFor(path) {
  const clean = path === '/' ? '/index' : path
  return /\.[a-z]+$/.test(clean) ? clean : `${clean}.html`
}

function listeners() {
  const out = execFileSync('netstat', ['-ano'], { encoding: 'utf8' })
  return out
    .split('\n')
    .filter((line) => line.includes(`:${port} `) && /LISTENING/.test(line))
    .map((line) => line.trim().split(/\s+/).pop())
}

function killTree(pid) {
  try {
    execFileSync('taskkill', ['/PID', String(pid), '/T', '/F'], { stdio: 'ignore' })
  } catch {
    // Already gone.
  }
}

async function waitUntilUp(child) {
  for (let i = 0; i < 180; i++) {
    if (child.exitCode !== null) throw new Error(`wrangler dev exited (${child.exitCode})`)
    try {
      const res = await fetch(`http://127.0.0.1:${port}/robots.txt`)
      if (res.ok) return
    } catch {
      // Not listening yet.
    }
    await new Promise((done) => setTimeout(done, 1000))
  }
  throw new Error('wrangler dev did not answer in 180 s')
}

if (listeners().length) {
  console.error(`port ${port} is already in use; pick another with --port`)
  process.exit(1)
}
mkdirSync(dirname(PATHS), { recursive: true })
if (!existsSync(PATHS)) writeFileSync(PATHS, pickPaths(join(siteDir, 'data')).join('\n') + '\n')
const paths = readFileSync(PATHS, 'utf8').split('\n').filter(Boolean)

const child = spawn(process.execPath, [WRANGLER, 'dev', '--port', String(port), '--ip', '127.0.0.1', '--log-level', 'warn'], {
  cwd: siteDir,
  env: { ...process.env, CI: '1', WRANGLER_SEND_METRICS: 'false' },
  stdio: ['ignore', 'inherit', 'inherit'],
})

let failed = false
try {
  await waitUntilUp(child)
  const answers = []
  for (const path of paths) {
    const res = await fetch(`http://127.0.0.1:${port}${path}`, {
      redirect: 'manual',
      headers: { accept: 'text/html,*/*', 'user-agent': 'Mozilla/5.0 (regress/fetch-pages)' },
    })
    const body = await res.text()
    const file = join(outDir, fileFor(path))
    mkdirSync(dirname(file), { recursive: true })
    writeFileSync(file, body)
    answers.push([path, res.status, ...HEADERS.map((name) => `${name}=${res.headers.get(name) ?? ''}`)].join(' '))
  }
  writeFileSync(join(outDir, '_answers.txt'), answers.join('\n') + '\n')
  console.log(`fetched ${paths.length} pages from ${siteDir} into ${outDir}`)
} catch (error) {
  console.error(error.message)
  failed = true
} finally {
  killTree(child.pid)
  // workerd can outlive its parent for a moment; anything still on the port
  // is ours, since the port was free when we started.
  await new Promise((done) => setTimeout(done, 1500))
  for (const pid of listeners()) killTree(pid)
  await new Promise((done) => setTimeout(done, 1000))
  const left = listeners()
  console.log(left.length ? `port ${port} STILL IN USE by ${left.join(', ')}` : `port ${port} is free`)
  if (left.length) failed = true
}
process.exit(failed ? 1 : 0)
