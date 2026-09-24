/**
 * Which answer pages a title or a character has earned.
 *
 * A page that cannot answer its own question is a thin page: "0 similar
 * titles", a cast list of two faces, a shop page for a story that was never
 * printed in English. Google finds those and counts them against the site.
 *
 * These gates are the one place that decides. Three readers use them:
 *   - scripts/make-shards.mjs, to pick the answer pages for the sitemap.
 *   - each answer page, which answers 404 when its own gate says no.
 *   - every page that links to an answer page, so we never link to a 404.
 * If they ever disagreed, the sitemap would list pages the Worker refuses,
 * or a title page would send readers to a dead end.
 *
 * Every gate reads only the one record, and every field it reads travels
 * inside the shard record, so the Worker can run them at request time. No
 * catalog and no files: this module must stay safe to load in the Worker.
 */
import { freeSplit, linksOf } from './answers.mjs'
import { shopName, isFigureWorthy } from './shop-links.js'
import { BUY_POPULARITY } from './buy.mjs'

/** "Where to read X free": only when at least one platform gives some away. */
export function hasFreePage(item) {
  return freeSplit(linksOf(item)).free.length > 0
}

/** "Manhwa like X": a list of fewer than four picks is not a list. */
export function hasLikePage(item) {
  return (item.similar || []).length >= 4
}

/**
 * "All characters in X". "all members of X" and "X characters" are real
 * searches and the title page only shows the first twelve faces. Under six
 * faces the title page already shows them all, so a separate page would say
 * nothing new.
 */
export function hasCastPage(item) {
  const faces = (item.characters || []).filter((c) => c.image)
  return faces.length >= 6
}

/**
 * "Where to buy X". Only worth having for a story people search for. Under
 * the line it was almost certainly never printed in English, so every shop
 * link would open an empty shelf. A name under two letters finds nothing.
 */
export function hasBuyPage(item) {
  return (item.popularity || 0) >= BUY_POPULARITY && shopName(item).length >= 2
}

/**
 * "Where to buy X merch", for one character. A figure of one named person only
 * gets made when enough people want it: either the person is a fan favourite
 * in their own right (FIGURE_FAVOURITES), or the BIGGEST story they are in sold
 * enough to pay for the mould (FIGURE_POPULARITY). See isFigureWorthy in
 * shop-links.js, which the shop rows use too.
 *
 * It used to judge the title the profile page leads with: a main role first,
 * a comic over its anime. For a side character that is often a spin-off nobody
 * bought, so Erwin Smith was judged on "Attack on Titan: No Regrets" (16,239)
 * and Kento Nanami on a Jujutsu Kaisen light novel, and both had no merch page.
 */
export function hasCharacterBuyPage(person) {
  if (!(person?.appearsIn || []).length) return false
  if (String(person.name || '').trim().length < 2) return false
  return isFigureWorthy(person)
}
