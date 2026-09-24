// This site's Worker: the core's front door (packages/core/src/worker.js)
// around this site's own build. All three imports are written by the build.
import { makeWorker } from '@sister/core/worker'
import site from './site.config.mjs'
import redirects from './data/redirects.json'
import shards from './data/shards.json'
import astro from './dist/_worker.js/index.js'

export default makeWorker(site, { astro, redirects, shards })
