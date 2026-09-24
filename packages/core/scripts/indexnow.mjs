// IndexNow: tell Bing, Yandex, Seznam and Naver about new pages.
//
// Google ignores IndexNow and uses the sitemaps instead. Everyone else reads
// this, and it is the only way a brand new page gets picked up the same day
// rather than whenever a crawler happens to come back.
//
// Ownership is proven by a key file served from the site root. The key is the
// site's own (indexNow.key in its config) and src/pages/indexnow-key.txt.js
// publishes the file, so a deploy carries it automatically.
//
// A site with no domain yet announces nothing: its only address is a Workers
// dev host that is kept out of every index, and telling search engines about
// it would be exactly wrong.
//
// Only pages we have never announced are sent. Re-announcing the same 24,000
// URLs every night is what earns a 429 and, eventually, being ignored. The
// list of what has already gone out is kept in data/indexnow-sent.json, which
// rides in the GitHub Actions cache next to the catalog.
import { readFileSync, existsSync, readdirSync } from 'node:fs'
import { writeJsonAtomic } from '../src/lib/write-atomic.mjs'
import { join } from 'node:path'
import config from '../src/lib/site.mjs'

if (!config.domain || !config.indexNow.key) {
  console.log(`${config.key}: no domain or no IndexNow key yet. Nothing announced.`)
  process.exit(0)
}

const KEY = config.indexNow.key
const HOST = config.domain
const KEY_LOCATION = `https://${HOST}/${KEY}.txt`
const SENT_FILE = 'data/indexnow-sent.json'

/** IndexNow accepts 10,000 URLs per request. Stay under it. */
const BATCH = 9000

/** Politeness gap between batches, in milliseconds. */
const GAP = 2000

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/** Every URL the site publishes, read out of the sitemaps the build wrote. */
function urlsFromDist() {
  const dist = 'dist'
  if (!existsSync(dist)) {
    console.log('no dist/. Run the build first.')
    return []
  }
  const urls = new Set()
  for (const name of readdirSync(dist)) {
    // sitemap.xml is only an index of the others, so it holds no page URLs.
    if (!name.startsWith('sitemap-') || !name.endsWith('.xml')) continue
    const xml = readFileSync(join(dist, name), 'utf8')
    for (const m of xml.matchAll(/<loc>([^<]+)<\/loc>/g)) urls.add(m[1])
  }
  return [...urls]
}

async function submit(urlList) {
  const res = await fetch('https://api.indexnow.org/IndexNow', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({ host: HOST, key: KEY, keyLocation: KEY_LOCATION, urlList }),
  })
  // 200 and 202 both mean accepted. Anything else is worth seeing in the log.
  const ok = res.status === 200 || res.status === 202
  console.log(`  ${urlList.length} URLs -> HTTP ${res.status}${ok ? '' : ' ' + (await res.text()).slice(0, 200)}`)
  return ok
}

const all = urlsFromDist()
console.log('pages in sitemaps:', all.length)

const sent = new Set(existsSync(SENT_FILE) ? JSON.parse(readFileSync(SENT_FILE, 'utf8')) : [])
const todo = all.filter((u) => !sent.has(u))
console.log('already announced:', sent.size, '| new:', todo.length)

if (todo.length === 0) {
  console.log('nothing new. Done.')
  process.exit(0)
}

for (let i = 0; i < todo.length; i += BATCH) {
  const batch = todo.slice(i, i + BATCH)
  const ok = await submit(batch)
  // A failed batch is not marked as sent, so the next run tries it again.
  if (ok) for (const u of batch) sent.add(u)
  // Write after every batch: a run that dies halfway must not re-announce
  // the part that already went out.
  writeJsonAtomic(SENT_FILE, [...sent])
  if (i + BATCH < todo.length) await sleep(GAP)
}

console.log('DONE. announced so far:', sent.size, '/', all.length)
