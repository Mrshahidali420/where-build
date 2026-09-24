// Cloudflare serves everything in dist/ as a static file. The adapter's own
// worker code lives there too and must never be downloadable, so it is
// listed in .assetsignore.
import { writeFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

// The site being built is the working directory (scripts/build-site.mjs), so
// its data/ and dist/ are found from there, not from this file.
const DIST = join(process.cwd(), 'dist')
writeFileSync(join(DIST, '.assetsignore'), '_worker.js\n_routes.json\n')
console.log('wrote dist/.assetsignore')

// Cloudflare refuses to serve any single asset over 25 MiB, and it only says so
// at deploy time, after the build has already been paid for. One 28 MB
// search-index.json cost a whole CI run that way. Fail here instead, where the
// message names the file and nothing has been uploaded yet.
const LIMIT = 25 * 1024 * 1024
const IGNORED = new Set(['_worker.js', '_routes.json', '.assetsignore'])

function walk(dir) {
  const tooBig = []
  for (const name of readdirSync(dir)) {
    if (dir === DIST && IGNORED.has(name)) continue
    const path = join(dir, name)
    const stat = statSync(path)
    if (stat.isDirectory()) tooBig.push(...walk(path))
    else if (stat.size > LIMIT) tooBig.push([relative(DIST, path), stat.size])
  }
  return tooBig
}

// The search slices are the one part of dist that grows with the catalog, so
// their weight is printed on every build. A surprise here is worth catching in
// the log rather than in a visitor's data plan.
const SEARCH = join(DIST, 'search')
try {
  const files = readdirSync(SEARCH)
  let total = 0
  let biggest = ['', 0]
  for (const name of files) {
    const size = statSync(join(SEARCH, name)).size
    total += size
    if (size > biggest[1]) biggest = [name, size]
  }
  const mb = (n) => (n / 1024 / 1024).toFixed(1)
  console.log(
    `search slices: ${files.length} files, ${mb(total)} MB, biggest ${biggest[0]} ${(biggest[1] / 1024).toFixed(0)} KB`
  )
} catch {
  console.log('search slices: none')
}

const oversized = walk(DIST)
if (oversized.length) {
  for (const [path, size] of oversized) {
    console.error(`asset too large: ${path} is ${(size / 1024 / 1024).toFixed(1)} MB (limit 25 MB)`)
  }
  process.exit(1)
}
