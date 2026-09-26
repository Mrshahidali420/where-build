/**
 * Turns the amazon-products crawl into a Where anime site's
 * data/product-picks.json.
 *
 * Most Amazon clicks that earned nothing were book searches for stories that
 * were never printed in English. The crawl in the amazon-products folder (a
 * sibling of this repo) checked the most watched shows against publisher
 * records. This script keeps two things from it:
 *   - real products for shows nobody picked by hand: volume 1 and a box set of
 *     the source books, and a disc, so the page names the product instead of
 *     opening a search;
 *   - `noEnglishBooks`, the checked shows whose source has no English print,
 *     so the buy box can stop offering a book search that finds nothing.
 *
 * Run it from the site's folder, like build-picks.mjs:
 *
 *   cd sites/anime
 *   node ../../packages/core/scripts/picks-from-products.mjs [products folder]
 *
 * The folder defaults to ../../../amazon-products/products. data/picks.json,
 * the hand picks, is only read: a show picked by hand is left out here. The
 * rules live in product-picks-core.mjs; make-where.mjs folds the file into
 * each title record.
 */
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { writeJsonAtomic } from '../src/lib/write-atomic.mjs'
import { buildProductPicks } from './product-picks-core.mjs'

const OUT = 'data/product-picks.json'
// The crawl files the shows this site shares with the home site as "both".
// Records marked with the home site's own name are comics with no page here.
const SITES = ['both']

const readJson = (file) => JSON.parse(readFileSync(file, 'utf8'))

function main(folder = '../../../amazon-products/products') {
  const records = readJson(join(folder, 'all.json'))
  const checkedIds = readJson(join(folder, 'title-list.json'))
    .filter((row) => SITES.includes(row.site))
    .map((row) => row.anilist_id)
  const handTitles = existsSync('data/picks.json') ? readJson('data/picks.json').titles || {} : {}

  const { titles, noEnglishBooks } = buildProductPicks({ records, checkedIds, handTitles, sites: SITES })
  writeJsonAtomic(OUT, { updated: new Date().toISOString().slice(0, 10), titles, noEnglishBooks })

  const count = Object.values(titles).reduce((n, list) => n + list.length, 0)
  console.log(
    `${OUT}: ${Object.keys(titles).length} titles, ${count} picks, ` +
      `${noEnglishBooks.length} of ${checkedIds.length} checked titles with no English books`
  )
}

main(process.argv[2])
