// Loaded before every test file (see "test" in package.json). src/lib/site.mjs
// reads the site from SITE_CONFIG, so the tests run as the made-up fixture
// site unless a caller names another one.
import { fileURLToPath } from 'node:url'

process.env.SITE_CONFIG ??= fileURLToPath(new URL('./site.config.mjs', import.meta.url))
