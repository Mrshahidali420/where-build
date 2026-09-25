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

## Polish pass: design, hubs, brand (25 Sep 2026)

- [x] Own Where layout and stylesheets (where-base.css + where.css), no
      inline CSS: 111,678 bytes inline per page before, 0 after; two hashed
      /_astro/*.css files (45.7 KB + 11.9 KB, 12.5 + 8.0 KB gzipped), cached
      immutable. Home 146 KB to 47 KB of HTML; Takehito Koyasu 560 KB to 313 KB.
- [x] Header (logo, search, eight-link nav, phone menu that scrolls inside
      the viewport), footer (columns, about/contact/privacy/DMCA, one credit
      line, family link). Amazon sentence only when a tag exists; none now.
- [x] Homepage: hero, search, airing next with countdowns, this season,
      voice actors, watch-order starters, studios, most watched, doors.
- [x] Title pages: synopsis, trailer (click to load), official streams,
      OP/ED, folded FAQ + FAQPage schema, facts, related, fans also watch,
      next-episode countdown. Cast with faces and JP/EN voices; a character
      name links to manhwaindex only when its registry has the page.
- [x] Hubs: /schedule (this week by day), /season index + one page per
      season (gate 12), /genre index + paged genres (gate 60), /anime.
- [x] Staff gate: 3+ shows with real crew credits (song performance and
      "produced" do not count), or 2+ shows in a key role. 19,631 to 12,776.
- [x] Brand: family mark (shared pin, per-site symbol) in core/src/lib/brand.mjs,
      full icon set, manifest, theme-color, 1200x630 OG, brand sheet in
      tasks/anime-shots-v2/brand-sheet.png.

Counts (real R2 data): title 18,576, episodes 75, voice actor 11,891,
staff 12,776, studio 593, artist 3,936, watch order 1,216, schedule 1,
season 192, genre pages 171. Sitemap about 50,000 URLs.

Open risks: prerendered hubs carry the build host's noindex when built on
the dev host (the deploy build sets the real host); schedule is one page
that goes stale between builds (countdowns run in the browser from UTC).

## Hub upgrade and font options (25 Sep 2026)

- [x] Directories (voice actors, staff, studios, song artists, watch orders):
      portrait or cover cards with the count, the years and what each is best
      known for (src/where/hub-cards.mjs); ranked lists as plain-link tabs
      (most popular, most roles/shows/songs, longest, newest) at
      /directory/<group>/by/<sort>[/<page>], capped at 480; the A to Z at 96
      cards a page, letters under 12 names folded into '#'.
- [x] Staff "most popular" ranks by how watched the shows they hold a key
      credit on are, so directors and creators lead, not singers.
- [x] Years: busy years keep a page, the thin early years share
      /year/before-1961 (yearPlan); the far-future handful is dropped. Index
      by decade with cover cards.
- [x] Seasons: now and next, six recent seasons as cover cards, the full
      chart; a season page split by format with jump links.
- [x] Genres and moods: three-cover cards with the count, top show and one
      line; a genre page opens with its newest shows.
- [x] Schedule: day tabs with counts, today lit, cover cards with the time in
      the reader's zone and a countdown; each episode moves to the reader's
      own day.
- [x] /anime: ways in, top of this season, genres, moods, recent years.
- [x] One search box at a time: none in the header on home and /search, none
      in the phone header when the dock has Search; /search focuses its box.
- [x] /voice-actor, /staff, /studio, /artist, /watch-order and plurals 301 to
      their directories.
- [x] Fonts: one-line swap, `fonts: fontPair('dela-zen')` in site.config.mjs
      (packages/core/src/lib/font-pairs.mjs); every pair installed; sheet in
      tasks/font-options.png. Live pair unchanged.
- [x] Tests: where-hub-cards (directory, paths, year plan, cards, format
      groups, newest), font pairs in where-config.
