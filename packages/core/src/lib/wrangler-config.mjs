/**
 * One site's wrangler.jsonc, worked out from its site.config.mjs.
 *
 * Written by scripts/make-wrangler.mjs, never by hand, so the Worker's
 * addresses always follow the one `domain` setting:
 *
 *   domain null   the site lives only on <workerName>.<subdomain>.workers.dev.
 *                 workers_dev is on and there are no routes. The Worker runs
 *                 first for /robots.txt, so the dev-host guard can answer
 *                 "Disallow: /" there (src/lib/dev-guard.js). Every other
 *                 static file is marked noindex by the host rule in
 *                 public/_headers, which Workers static assets honour, so the
 *                 Worker does not have to run for them.
 *   domain set    custom domains for the apex and www, workers_dev off (the
 *                 old dev address then answers 404), and no run_worker_first:
 *                 static files go straight from the asset store, at no cost.
 *
 * Pure, so tests/wrangler-config.test.js can check both shapes.
 */

// The Workers runtime date every site is built against.
export const COMPATIBILITY_DATE = '2026-09-01'

export function wranglerConfig(site) {
  const config = {
    $schema: '../../node_modules/wrangler/config-schema.json',
    name: site.workerName,
    main: 'worker.js',
    compatibility_date: COMPATIBILITY_DATE,
    workers_dev: !site.domain,
  }
  if (site.domain) {
    config.routes = [
      { pattern: site.domain, custom_domain: true },
      { pattern: `www.${site.domain}`, custom_domain: true },
    ]
  }
  config.assets = {
    directory: './dist',
    // Must stay "none". With "404-page" the asset server answers every page
    // navigation itself, and a title page that has no static file gets 404.html
    // without the Worker ever running. The Worker owns the misses.
    not_found_handling: 'none',
    html_handling: 'auto-trailing-slash',
    binding: 'ASSETS',
    ...(site.domain ? {} : { run_worker_first: ['/robots.txt'] }),
  }
  config.observability = { enabled: true }
  // The visitor counter's database (db/schema.sql). A site whose database is
  // not created yet runs without it: the beacon then writes nothing.
  if (site.d1.id) {
    config.d1_databases = [{ binding: 'ANALYTICS', database_name: site.d1.name, database_id: site.d1.id }]
  }
  // Ten minutes after midnight UTC the Worker adds up the day that just ended
  // (src/lib/rollup.js).
  config.triggers = { crons: [...site.cron] }
  return config
}

/** The file as written to disk: a header that says where it comes from, then the JSON. */
export function wranglerJsonc(site) {
  return (
    `// Written by packages/core/scripts/make-wrangler.mjs from site.config.mjs.\n` +
    `// Do not edit it by hand: change the config and run \`npm run wrangler\`.\n` +
    `${JSON.stringify(wranglerConfig(site), null, 2)}\n`
  )
}
