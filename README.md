# Private work, published for the build service

Copyright (c) 2026 Shahid Ali. All rights reserved.

This repository is public only so a continuous integration service can
build it. It is not open source, and it is not a sample, a template or a
starter.

No licence is granted. You may not copy, run, host, deploy, modify or
reuse this code, its design or its written content. See [LICENSE](LICENSE)
for the full terms.

Permission requests: hello@manhwaindex.com

## Layout

- `packages/core` holds the shared site: pages, Worker, scripts and tests. It
  never names a site; everything comes from the site's config.
- `sites/<site>` holds one site each: `site.config.mjs`, its `public/` brand
  files, and the generated `wrangler.jsonc`.
- `regress/` rebuilds manhwaindex from the core and compares its pages
  with manhwaindex's own build.
- `docs/PLAN.md` is the plan these sites follow.

```
npm test                      the core tests and the site checks
npm run count-pages           pages per site and gate, from the R2 catalog
npm run wrangler              regenerate every sites/<site>/wrangler.jsonc
cd sites/anime && npm run build   build one site (catalog in data/ first)
```
