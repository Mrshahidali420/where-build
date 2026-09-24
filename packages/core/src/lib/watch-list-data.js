// BUILD TIME ONLY: this module reads catalog.js, so only prerendered pages and
// the sitemap may import it. The rules live in watch-lists.mjs, which is pure.
//
// The rows of every /where-to-watch/<list> page, worked out once per build.
// The routes, the pages and the sitemap all read the same object, so a page
// the sitemap names always exists and the other way round.
import { comics, novels, anime } from './catalog.js'
import { buildWatchLists, WATCH_LIST_KEYS, watchPageCount, watchListPath } from './watch-lists.mjs'

export const watchLists = buildWatchLists([...comics, ...novels], anime)

/** Every page of every list: { key, page, path }, page 1 first. */
export const watchListPages = () =>
  WATCH_LIST_KEYS.flatMap((key) =>
    Array.from({ length: watchPageCount(watchLists[key]) }, (_, i) => ({
      key,
      page: i + 1,
      path: watchListPath(key, i + 1),
    }))
  )
