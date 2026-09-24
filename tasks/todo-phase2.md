# Phase 2: WhereAnime, built and checked locally

Spec: `docs/PLAN.md` section 2.1 (the pages), section 3 (cross-links),
section 5 "Now, on workers.dev", Phase 2 in sections 6 and 8.

## Checklist

- [x] ownedKinds end to end: `ownedOnly()` (src/lib/owned.mjs) in catalog.js,
      make-redirects, make-shards, slug-registry, and the Where build
      (src/where/compute.mjs). The anime site holds anime not from CN/TW only.
- [x] Data: `scripts/where-data.mjs pull` (catalog read only, sister-data
      latest/, site state from `sister-data/anime/`), `push` (PUSH=1, CI only,
      refuses a shrinking registry). Lost-registry guard, `ACCEPT_REGISTRY=1`.
- [x] Builders in src/where/: people, studios, artists, franchises, episodes,
      roles, gates, cross-links, entity slugs (frozen, `p:` `s:` `a:` `f:` keys
      in the same registry as titles), records, hubs, outputs.
- [x] `scripts/make-where.mjs`: gates, addresses, shards (`public/d/`),
      hubs, search rows, sitemap list, redirects, manifest, shrink guard.
- [x] Pages (sites/anime/src/pages): `/anime/<slug>`, `/anime/<slug>/episodes`,
      `/voice-actor/<slug>`, `/staff/<slug>`, `/studio/<slug>`, `/artist/<slug>`,
      `/watch-order/<slug>`, `/directory/<group>[/<letter>[/<page>]]`,
      `/year[/<year>[/<page>]]`, home, about, privacy, 404.
- [x] Nothing from the "not on it" list: no platform table (one card to the
      home site), no free/like/buy/characters pages, no character pages (cast
      faces link home only when that page exists), no genre/mood/season/
      schedule/platform hubs. Cards: proven relations only, max 3, never a
      workers.dev target, never sitewide.
- [x] Brand: WhereAnime name, palette, mark. Fonts self-hosted from
      @fontsource (Dela Gothic One + Zen Kaku Gothic New, latin + latin-ext),
      preload only the first-screen faces, `/_astro/*` immutable.
- [x] No Amazon links. The Associates sentence is config-gated (footer and
      privacy page only, and only once a tag exists).
- [x] `ga4Id` and `turnstileSiteKey` null; analytics degrade (below).
- [x] `scripts/provision-anime.mjs`: prints the D1/Turnstile/secret steps,
      runs nothing.
- [x] `.github/workflows/deploy-anime.yml`: workflow_dispatch only; push
      (paths filter) and the 04:00 UTC schedule are written but commented out.
- [x] count-pages counts a Where site from its data/ with the build's own
      compute, so both numbers always agree.
- [x] Tests: where-builders, where-gates, where-cross, where-config.
- [x] Full build against real R2 data, wrangler dev checks, screenshots.

## How analytics degrade until provisioning

- No `d1.id`: wrangler.jsonc has no ANALYTICS binding. `POST /_a` answers 204
  and writes nothing; `/my-admin` shows its "Not set up yet" hint.
- No `turnstileSiteKey`: the page script never loads Turnstile and never asks
  for a pass, so it sends nothing (its queue is capped so it cannot grow).
  `POST /_p` answers 403.
- No `ga4Id`: Google's script is never fetched.
- To switch on: `node scripts/provision-anime.mjs` prints the steps.

## Review

Page counts, real R2 data of 24 Sep 2026 (count-pages and the built
sitemaps agree on every type):

| Page | Pages |
|---|---|
| /anime/<slug> | 18,576 (of 18,737 owned) |
| /anime/<slug>/episodes | 75 |
| /voice-actor/<slug> | 11,891 |
| /staff/<slug> | 19,631 |
| /studio/<slug> | 593 |
| /artist/<slug> | 3,936 |
| /watch-order/<slug> | 1,216 |
| hubs (directory, year) | 659 |
| home, about, privacy | 3 |
| sitemap total | 56,580 |

Local checks (wrangler dev --local): every page type 200 with its sections;
unknown slugs 404 with no-store; a missing shard 503 with retry-after 30;
on the workers.dev host robots.txt is `Disallow: /`, every response carries
`x-robots-tag: noindex, nofollow, noarchive`, GPTBot and header-less
scripts get 403. Screenshots: tasks/anime-shots/ (390 and 1366 px).

Decisions:
- Watch orders are built in two steps (sequel chains, then extras attached
  to one chain) after a plain union welded Lupin III and Detective Conan
  into one 134-entry list through their crossovers. The main story reads
  a sequel link filed on one side only. A franchise whose entries are not
  sequels of each other (Lupin's many series) becomes several watch orders.
- The core's search and sitemap sources are chosen by the integration
  (`virtual:search-source`, `virtual:sitemap-source`), because a bundler
  follows a dynamic import even behind an `if`: the Where build otherwise
  pulled the catalog in and failed.
- The core 404 links catalog pages this site does not have, so the site
  ships its own.

Open risks:
- Staff pages: 19,631 against the plan's 5,000 to 7,000. The gate is the
  plan's (2+ shows), the data is bigger; 1,324 of them hold only song
  performance credits and repeat an artist page.
- Episode pages: 75. airing.json holds history for 341 anime, so few long
  shows reach 13 dated episodes yet.
- The home site's block list is not in R2, so a card could point at a title
  the home site has blocked.
- Page weight: the core's inline stylesheet is about 110 KB on every page;
  a big voice-actor page is about 560 KB of HTML.
