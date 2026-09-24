# Phase 0: core extraction (no deploy)

Spec: `docs/PLAN.md` sections 1, 4, 5 ("now, on workers.dev"), 6 and 8 (Phase 0).
Source: manhwaindex (`mi-build`) at dcf561e. Nothing there is changed.

## Checklist

- [x] Monorepo: npm workspaces `packages/*`, `sites/*`; `docs/PLAN.md`; this file
- [x] `packages/core` holds manhwaindex `src/`, `scripts/`, `tests/`, `db/` (and the seed catalog)
- [x] `site.config.mjs` per site, checked by `defineSite()`; every section 4 key read from it
- [x] Brand, URL, ids, colours and fonts in the core replaced by config reads
- [x] Core Astro integration: `injectRoute()` for each page group the config enables
- [x] `makeWorker(config)`: redirects, edge cache, `/_a`, `/_p`, cron, dev-host guard
- [x] Dev-host guard checked against Cloudflare docs (host-scoped `_headers`)
- [x] `make-wrangler.mjs` generator plus unit test (null domain vs domain)
- [x] R2 catalog pull read-only for sisters (`r2.catalogBucket` read, `r2.dataBucket` write)
- [x] `tests/no-brand-leak.test.js`
- [x] `count-pages.mjs`: per-site counts under each gate
- [x] Four sister configs (Where family), palettes, placeholder SVG marks
- [x] 102 existing tests pass in `packages/core`, plus the new ones
- [x] Regression: core + throwaway manhwaindex config vs mi-build at dcf561e, 30+ pages, zero content differences
- [x] manhwaindex working tree unchanged (`git status --short`)

## Review

**Tests.** `npm test`: 131 in packages/core (the 102 from manhwaindex plus
29 new: define-site, dev-guard, wrangler-config, page-counts, no-brand-leak)
and 4 site checks in `sites/sites.test.js`. All pass.

**Regression** (both sides built from the seed catalog, same themes.json):

- Static build: every file of mi-build's dist/ paired with the core's
  (3,346 files, `_worker.js` left out). All 770 HTML pages have the same
  content. Under HTML's own whitespace rule the only differences are six
  kinds of whitespace, none rendered: between footer list items (a grid),
  between legal links (a flex row), between dock links (a grid), inside the
  inline SVG mark and at the start of the inline counter script.
- Worker: `regress/fetch-pages.mjs` served both builds with `wrangler dev`
  on the same port and fetched 68 paths: 28 static, and 40 the Worker
  answers (37 rendered pages: titles of every kind in the seed,
  free/like/buy/characters answer pages, character pages and their buy
  pages; plus two unknown slugs that 404 and one old address that 301s).
  Status codes and crawler headers match; every body has the same content,
  with the same six whitespace kinds as the static pages.
- Differences that remain, all deliberate:
  - `site.webmanifest` description: one `description` feeds the manifest and
    the Organization JSON-LD; manhwaindex had two texts.
  - `_headers` gains the workers.dev noindex host rule.
  - `_astro/own-count.*.js` parses relative links against
    `https://site.invalid` instead of manhwaindex's origin (same result);
    the Base script differs only in minified names that follow from it.
  - `_routes.json` lists other files in its 100-entry cap. It is a Pages
    file; Workers ignore it (it is in `.assetsignore`).
  - The 503 page (not a built page) takes its colours from the palette.

**Dev guard, live** (`wrangler dev --host whereanime...workers.dev` on the
anime build): robots.txt is `Disallow: /` for every agent, every answer
(static files included, via `_headers`) carries
`X-Robots-Tag: noindex, nofollow, noarchive`, pages carry the noindex meta,
GPTBot gets 403.

**count-pages** (R2 `manhwaindex-catalog/latest`, read only, 116,041 titles):
see `npm run count-pages`. Voice-actor and staff pages need credits.json
(Phase 1). The manga title gate lets 71,150 of 72,653 through, because most
records carry a chapter or volume count: the gate in the plan is looser than
its 35,000 to 45,000 estimate and needs tightening before Phase 4.

**Deviations from the plan.**

- `run_worker_first` is `["/robots.txt"]`, not `true`, while `domain` is
  null: `_headers` supports host rules, so static files get the noindex
  header without running the Worker. robots.txt is also built as
  `Disallow: /` when there is no domain.
- `scripts/enrich-mal.mjs` (Jikan/MAL) was left out of the core. `malExtras`
  stays true only in the throwaway manhwaindex config.
- The sisters build only `sitemaps`, `admin` and `notFound` for now: the
  core's pages are manhwaindex's reading and watching pages, which the plan
  keeps off the sisters. make-shards still shards the whole catalog for them.

**Open for Phase 1/2.**

- Six gradient stops and 14 non-palette rgb values in `app.css` are still
  manhwaindex's; they need tokens once the sister pages are designed.
- make-shards, search slices and the sitemap must learn `ownedKinds`.
- Fonts are shared placeholders (Saira) in `sites/family.mjs`.
