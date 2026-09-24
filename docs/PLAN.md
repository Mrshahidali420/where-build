# Sister sites plan: anime, manga, manhua, novel

Written 24 September 2026 against the live manhwaindex.com and the repo at `C:\Users\SHAHID ALI\Desktop\manga-site-project\manhwaindex` (GitHub `Mrshahidali420/mi-build`, public, master). Planning only. manhwaindex.com is not changed by anything in this plan except one deferred, opt-in item marked in section 3.

## 0. What manhwaindex is today (measured, not assumed)

Live sitemap counts on 24 Sep 2026 (`/sitemap.xml` and its 90 parts), and `/d/manifest.json`:

| Section | URLs |
|---|---|
| core (home, hubs, genres, moods, seasons, platforms, pagination) | 4,572 |
| /manhwa/ titles | 8,602 |
| /manga/ titles (JP plus every other non-KR/CN/TW country) | 72,653 |
| /manhua/ titles | 5,293 |
| /novel/ titles | 8,680 |
| /anime/ titles (all countries, donghua included) | 20,813 |
| /character/ pages | 169,765 |
| answer pages: /free 16,289, /like 79,383, /buy 5,397, /characters 15,783, character /buy 7,198 | 124,050 |
| **Total** | **414,428** |

Manifest: 116,041 titles, 169,765 character pages, 285,810 frozen slugs. The "~104,000 pages" figure in the brief is out of date; the site is four times that, and every title, character and answer page is a Worker request (only the 4,572 core pages and the /d, /search, /brand files are static assets, which Cloudflare serves without running the Worker).

What the code already gives a sister site for free: hybrid Astro 5 SSR on one Worker (`src/worker.js` wraps `dist/_worker.js`), shard runtime (`src/lib/runtime.js`, `src/lib/shard-key.js`, `scripts/make-shards.mjs`), frozen slug registry and redirects (`src/lib/slug-registry.mjs`, `scripts/make-redirects.mjs`), R2 snapshot with health and shrink guards (`scripts/catalog-snapshot.mjs`, `scripts/snapshot-health.mjs`), D1 beacon with Turnstile pass and the `/my-admin` dashboard (`src/worker.js`, `db/schema.sql`, `src/lib/rollup.js`, `src/pages/my-admin*`), sitemaps (`src/lib/sitemap-urls.js`), IndexNow (`scripts/indexnow.mjs`), sliced client search (`src/lib/finder-core.js`, `src/pages/search/*`), Amazon shop links per country (`src/lib/shop-links.js`), the robots.txt crawler policy, `_headers` CSP, 404/503 handling, and 102 passing node tests.

What manhwaindex already owns and the sisters must not copy: title pages for all five kinds, character pages, /free, /like, /buy, /characters answer pages, /genre and /genre/<g>/<kind> listings, /mood, /platform hubs, /where-to-read, /where-to-watch, /schedule (airing this week), /anime/season hubs, /shop, the templated overview prose (`src/lib/prose.mjs`) and the templated FAQ sentences (`src/lib/answers.mjs`). Anime pages on manhwaindex already show director/writer/designer/composer names, Japanese and English voice actor names on the cast strip, and opening/ending song lists. None of those are separate pages, and that is the gap the sisters take.

## 1. Repo strategy: one shared core, four site packages, one public monorepo

### The two options

**(1) Four independent clones.** Copy `mi-build` four times, edit brand strings in place, run four separate ingests.
- For: nothing touches manhwaindex; day one is fast; each site can drift freely.
- Against: the brand surface is 36 files in `src/` alone plus 9 scripts, `public/`, workflows and tests (section 4). Every bug fix and every Cloudflare or AniList change is done five times. Four more full AniList walks (about 4,300 calls each) and four more daily probes against a 30 calls/minute API. Four Actions caches of a 141 MB catalog. Divergence makes it impossible to say what is live where. For one person this decays within months.

**(2) One shared core with per-site config, building separate Workers.** A new public repo, npm workspaces: `packages/core` (a copy of manhwaindex's `src/`, `scripts/`, `tests/` made config-driven) and `sites/anime`, `sites/manga`, `sites/manhua`, `sites/novel`, each holding only `site.config.mjs`, `wrangler.jsonc`, `astro.config.mjs`, brand assets and its own extra pages. Each site is its own Worker, D1 database and R2 prefix. manhwaindex stays in `mi-build` untouched.
- For: fix once for four. One credits/staff ingest shared by all four. Sister builds read the catalog manhwaindex already keeps in R2 (`manhwaindex-catalog/latest/`), so there is no second AniList catalog walk at all. Config swap is one file per site.
- Against: a one-time extraction of core from manhwaindex (about a week of careful work), and the core drifts from manhwaindex's copy over time (fix once for four, twice for five).

**Recommendation: option 2, as a monorepo, not a published npm package.** A template-plus-package needs versioning and publishing for no gain to a solo owner. The monorepo also keeps one Actions setup and one place to look.

### Shape

    sister-build/                          public GitHub repo, same LICENSE and README wording as mi-build
      package.json                         npm workspaces: packages/*, sites/*
      packages/core/
        src/{layouts,components,lib,styles}   from manhwaindex, brand and URLs replaced by config
        src/worker.js                       exports makeWorker(config) (redirects, edge cache, /_a, /_p, dev-host guard, cron)
        integration.mjs                     Astro integration: injectRoute() for every core page the site's config enables
        scripts/                            build-site.mjs, make-shards.mjs, make-redirects.mjs, sitemap, indexnow, snapshot pull/push,
                                            ingest-credits.mjs, ingest-staff.mjs, ingest-airing.mjs, count-pages.mjs
        tests/                              the 102 existing tests plus new ones
        db/schema.sql, db/migrations/       identical to manhwaindex
      sites/anime/  sites/manga/  sites/manhua/  sites/novel/
        site.config.mjs                     everything in section 4
        wrangler.jsonc                      name, main, assets, d1 id, cron, workers_dev / routes
        astro.config.mjs                    site URL from config; integrations: [sisterCore(config)]
        public/                             logos, favicons, og-image, webmanifest, indexnow key file, llms.txt
        src/pages/                          only pages unique to this site (entity pages), or empty
      .github/workflows/
        deploy-anime.yml ... deploy-novel.yml   push (paths filter on packages/core and sites/<x>) plus nightly cron
        ingest-credits.yml                  weekly plus daily delta, writes R2 sister-data/latest/
        ingest-airing.yml                   daily, anime schedule
        backfill-staff.yml                  hand-run

Astro cannot import `.astro` pages across packages, so the core ships an integration that calls `injectRoute({ pattern, entrypoint })` for each page the config switches on (Astro 5.18 supports this). Site-local `src/pages` holds only what is unique to that site.

Data flow per site build:
1. Pull `comics.json`, `anime.json`, `characters.json`, `themes.json`, `slug-registry.json` from R2 bucket `manhwaindex-catalog/latest/` with a **read-only** token. This is the same `catalog-snapshot.mjs pull` that manhwaindex uses; `latest/meta.json` is written last, so a half-finished push is never read.
2. Pull `credits.json`, `staff.json`, `airing.json` from R2 bucket `sister-data/latest/`.
3. Pull the site's own state from `sister-data/<site>/`: `slug-registry.json`, `live-manifest.json`, `indexnow-sent.json`.
4. Filter to `config.ownedKinds`, derive entities (people, studios, artists, franchises), gate pages, write the site's shards, build, deploy, push state back to `sister-data/<site>/`.

Actions cache is used only as a speed layer; R2 is the source of truth, which avoids the 10 GB per-repo cache eviction manhwaindex already fights.

**GitHub Actions minutes: this plan assumes a public repo (unlimited minutes), exactly as `mi-build` is public for that reason.** Four nightly builds of catalogs this size will run 1 to 3 hours a day; a private repo's 2,000 free minutes a month would be gone in ten days.

**No AniList catalog re-walk.** Sisters never fetch title records; they read manhwaindex's R2 snapshot. The only new AniList traffic is the credits/staff walk and the airing schedule (section 2.0), which manhwaindex does not fetch.

### What is not changed in manhwaindex

Nothing in `mi-build`. The sister ingest fetches ids on its own (a lean walk, section 2.0) rather than adding fields to `scripts/anilist-core.mjs` MEDIA_FIELDS. Adding `id` and `image` to the staff and voice-actor sub-queries there would be smaller (one backfill-fields run), but it changes manhwaindex's catalog records and its ingest, which the decisions rule out. Revisit only if the owner lifts that rule.

## 2. Per site

### 2.0 Data the sisters add (shared, one workflow)

AniList only. Three files, one shared workflow, written to R2 `sister-data/latest/`:

- `credits.json` (`ingest-credits.mjs`): for every title id in the shared catalog, `Media(id_in) { id staff(perPage: 25, sort: RELEVANCE) { edges { role node { id } } } studios { edges { isMain node { id name } } } characters(perPage: 25) { edges { role node { id } voiceActorRoles { voiceActor { id languageV2 } } } } }`. Ids only, so the walk is light: 116,041 titles / 50 = 2,321 calls, about 1.7 hours once; then daily only ids whose `updatedAt` moved (the same probe pattern as `ingest-daily.mjs`, 5 to 20 calls a night). Keep `id -> updatedAt` in `sister-data/latest/credits-seen.json`.
- `staff.json` (`ingest-staff.mjs`): every staff id seen in credits.json, `Page { staff(id_in) { id name { full native alternative } image { large } description languageV2 primaryOccupations dateOfBirth { year month day } homeTown yearsActive gender favourites siteUrl staffMedia(sort: POPULARITY_DESC, perPage: 25) { edges { staffRole node { id type } } } characters(sort: FAVOURITES_DESC, perPage: 25) { nodes { id } } } }`. Roughly 40,000 to 60,000 distinct people; 50 per call, about 1,000 calls, under an hour. Daily: new ids only, plus a slow refresh slice like `enrich-characters.mjs`.
- `airing.json` (`ingest-airing.mjs`): `Page { airingSchedules(airingAt_greater, airingAt_lesser, sort: TIME) { airingAt episode mediaId } }` for the last 60 and next 60 days (about 40 calls), plus per-anime `airingSchedule` history for shows that are RELEASING or finished within three years and have under 200 episodes (about 1,500 to 2,000 calls once, then only RELEASING ones nightly, about 300). This gives every episode's air date, which no manhwaindex page shows.

Same rules as the existing scripts: 2.2 s between calls, retries, atomic writes, a shrink guard, health check before push, and `continue-on-error` so a bad AniList night never blocks a deploy.

### 2.1 Anime site (pilot)

**Owned kind:** AniList ANIME whose countryOfOrigin is not CN or TW (donghua goes to the manhua site, section 2.3). Roughly 18,500 to 19,000 titles today.

**The different question.** manhwaindex answers "where can I watch X legally". This site answers "when, who and what": when the next episode airs and when every past one aired, who made it and who voices it, what the songs are, and what order to watch a franchise in. Search intents: "X episode 8 release date", "X season 2 release date", "how many episodes is X", "who voices Y in X", "X voice actors", "X opening song", "anime by studio Z", "X watch order", "anime directed by W".

**Full page types it owns**

| Route | What is on it | Gate (no page below it) | Estimate |
|---|---|---|---|
| `/anime/<slug>` | countdown to next episode; full episode table (number, title from `streamingEpisodes`, air date from airing.json); studio, director, writer, designer, composer, original creator, each linked; cast table JP and EN voices linked to voice-actor pages; OP/ED list with artist links; watch-order block; synopsis with source credit; facts (format, episodes, duration, season, status, source) | cover and at least one of: episodes, airing data, 3 credits | 18,500 |
| `/anime/<slug>/episodes` | the complete dated episode list (the title page shows the first 12) | 13+ episodes with dates | 5,000 to 6,000 |
| `/voice-actor/<slug>` | photo, bio, birthday, hometown, years active; every role (character face, show, language); shows by year | 3+ credited roles | 12,000 to 18,000 |
| `/staff/<slug>` | photo, bio; works by role (directed, wrote, designed, composed); collaborators | 2+ credits | 5,000 to 7,000 |
| `/studio/<slug>` | every work by year, status, episode counts; frequent directors and composers | 2+ works | 500 to 800 |
| `/artist/<slug>` | every OP/ED by an artist, with the show and episode range | 2+ songs | 2,500 to 3,500 |
| `/watch-order/<slug>` | release order and a same-medium chain incl. movies, OVAs, specials, with years and episode counts | 3+ entries in the franchise | 2,000 to 3,000 |
| hubs | A to Z of voice actors, staff, studios, artists; anime by year; studio and year pagination | | 1,500 |
| **Total** | | | **45,000 to 55,000** |

**Deliberately not on it:** the platform table (a one-line card "Where to watch X legally" links to manhwaindex), free/like/buy/characters answer pages, character pages, genre listings, moods, season hubs, this-week schedule, platform hubs. Character faces on the cast table link to the voice-actor page on this site and, for the character's own page, to manhwaindex.

**Carries over from core:** shell, search, sitemaps, IndexNow, D1 beacon and admin, slug registry, shards, R2 snapshot, Countdown and Themes components, `season-core.mjs` (for labels only), BuyBox (discs; per-site tag), MyList (optional, off at launch), robots.txt policy, `_headers`.

**Dropped:** everything in "deliberately not on it", `prose.mjs` overviews, `answers.mjs` FAQ text, picks.json, boost-links (until GSC data exists), platform logos folder (only the few streaming ones needed by the card, or none).

**Unique data:** airing.json (episode dates), staff.json (people), credits with ids, studio ids, song artists from themes.json. None of it is rendered as a page anywhere on manhwaindex.

### 2.2 Manga site

**Owned kind:** comics (kind `comic`) with countryOfOrigin JP, plus the "other" countries manhwaindex files under /manga (not KR, CN, TW; not novels). 72,653 records today, but most are obscure one-shots with no chapters, no author id and no readers.

**The different question.** manhwaindex answers "where do I read X". This site answers "who made it and what is the state of it": the author and artist as people with their whole body of work, how long it ran and in how many volumes, whether it is finished, what its spin-offs and side stories are, and what it was adapted into. Search intents: "X mangaka", "manga by Tatsuki Fujimoto", "is X finished", "how many volumes does X have", "X spin-off", "X side story", "X publication history", "X author other works".

**Full page types it owns**

| Route | What is on it | Gate | Estimate |
|---|---|---|---|
| `/manga/<slug>` | author and artist cards linked; serialisation span (start to end year, years running); chapters and volumes; status in plain words; every relation by type (side story, spin-off, alternative, compilation, adaptation) with years; tags; AniList rankings by year; readers split (reading, completed, dropped); synopsis with credit | popularity 300+, or chapters/volumes known, or an author with 2+ works | 35,000 to 45,000 |
| `/author/<slug>`, `/artist/<slug>` | photo, bio, birthday, hometown, years active; every work by role and year; frequent collaborators; adaptations of their work | 2+ works, or 1 work with popularity 5,000+ | 12,000 to 18,000 |
| `/series/<slug>` | the franchise map: main story, prequels, sequels, spin-offs, side stories, art books, and which were adapted | 3+ same-medium entries | 3,000 to 4,000 |
| hubs | authors A to Z, manga by year, longest-running, by volume count | | 2,000 |
| **Total** | | | **55,000 to 70,000** |

**Deliberately not on it:** platform table (card to manhwaindex), free/like/buy/characters, character pages, genre listings, moods, platform hubs, where-to-read. The cast strip shows faces and names only, each linking to manhwaindex's character page.

**Risk note.** This is the site with the most overlap in raw records, so its title page must be visibly about people and publication, not about reading. Launch the author and series pages first and the title pages second (section 6), and compare Search Console impressions of `manhwaindex.com/manga/*` before and after.

### 2.3 Manhua site (manhua and donghua)

**Owned kinds:** comics with countryOfOrigin CN or TW (5,293), plus ANIME with countryOfOrigin CN or TW (donghua, about 1,800 to 2,200; the exact number is printed by `count-pages.mjs`). Chinese comics and Chinese animation are one fandom with its own vocabulary, and "donghua" searches are not served by anime sites.

**The different question.** "Which manhua has a donghua, and vice versa; who draws it; what is its cultivation/xianxia lineage." Search intents: "X donghua season 3", "X manhua vs donghua", "cultivation manhua", "xianxia donghua list", "X manhua author", "donghua by studio Z".

**Full page types it owns**

| Route | What is on it | Gate | Estimate |
|---|---|---|---|
| `/manhua/<slug>` | creator cards; its donghua (seasons, episode counts, air dates from airing.json); chapters, status, span; relations; tags | cover and (chapters or a donghua or a creator page) | 4,500 to 5,300 |
| `/donghua/<slug>` | episode table with dates; studio; its manhua or novel source; seasons chain | cover and episodes or dates | 1,800 to 2,200 |
| `/creator/<slug>` | Chinese authors, artists and studios as people/companies; works by year | 2+ works | 1,500 to 2,500 |
| `/studio/<slug>` | donghua studios | 2+ works | 100 to 200 |
| `/tag/<slug>` | tag hubs from AniList tags (Cultivation, Xianxia, Wuxia, Reincarnation, System...) across both kinds | 12+ titles | 100 to 150 |
| hubs | by year, by status, A to Z | | 300 |
| **Total** | | | **9,000 to 11,000** |

**Deliberately not on it:** platform tables, answer pages, character pages, genre listings, moods. Tag hubs are new (manhwaindex has 18 curated moods and genre pages, never tag pages).

### 2.4 Novel site (light and web novels)

**Owned kind:** kind `novel` (AniList MANGA format NOVEL), 8,680 today, all countries.

**The different question.** "Who wrote and illustrated it, how many volumes, what was it adapted into, and how do the web novel, light novel, manga and anime versions relate." Search intents: "X light novel volumes", "X web novel vs light novel", "X light novel author", "novels by Y", "X illustrator", "X light novel anime adaptation", "is X light novel finished".

**Full page types it owns**

| Route | What is on it | Gate | Estimate |
|---|---|---|---|
| `/novel/<slug>` | author and illustrator cards; volumes and chapters; span and status; the version tree (web novel, light novel, manga, anime, with years and episode/chapter counts, from relations); tags; synopsis | cover and (volumes or an author page or an adaptation) | 7,000 to 8,500 |
| `/author/<slug>`, `/illustrator/<slug>` | people pages as in 2.2 | 2+ works, or 1 with popularity 5,000+ | 3,000 to 5,000 |
| `/adaptations/<slug>` | the full lineage of one story across media | 3+ entries | 1,500 to 2,500 |
| hubs | authors A to Z, by year, by volume count, by publisher platform (from readLinks site names as text, no platform page) | | 300 |
| **Total** | | | **14,000 to 17,000** |

**Deliberately not on it:** the reading platform table (card to manhwaindex), answer pages, character pages, genre listings, moods, platform hubs. No claims about which volume an anime ends at: AniList does not hold it and the plan forbids fabricated facts.

### 2.5 Page counts and what they mean for the account

Sisters together: roughly 125,000 to 155,000 pages, of which about 110,000 to 140,000 are Worker-rendered. Today manhwaindex alone is 414,428 URLs, about 410,000 of them Worker-rendered. All five sites share one account.

- Workers Paid (10M requests a month, about 333,000 a day): comfortable. Real readers are a few thousand requests a day; crawlers are the cost, and the sisters' robots.txt keeps the manhwaindex bot policy, plus Googlebot will take weeks to crawl 150,000 new URLs at a few thousand a day.
- Workers Free (100,000 a day for the whole account): manhwaindex alone exceeded it on 14 Sep 2026 (GPTBot 50,135, AhrefsBot 29,880, YandexBot 9,243 in one day). Five sites cannot share it. **Do not drop to Free while any sister site is live on a real domain.** A dev site on workers.dev costs almost nothing because robots.txt disallows everything and there is no zone to attract traffic.
- While a sister is on workers.dev it has no WAF, so a rogue crawler that ignores robots.txt would spend Worker requests. Mitigation in the dev-host guard (section 5): the Worker answers known bad user agents and any request without an Accept header with a static 403 before rendering (cheap, still one request, no CPU), and the daily `/my-admin` shows the count.

The first script to write in Phase 0 is `count-pages.mjs`: it reads the R2 catalog and prints the exact per-site counts under each gate, so the table above becomes measured before anything is built.

## 3. Cross-linking rules

1. **A link exists only when the catalog proves the relation**: an AniList relation (ADAPTATION, SOURCE, PREQUEL, SEQUEL, SIDE_STORY, SPIN_OFF, ALTERNATIVE), a cast row, a staff credit, or the same AniList id on the other site. Never a "similar" list, never a genre, never a blanket "our other sites" block.
2. **A cross-site link is a short card**: cover thumbnail, title, one fact, one anchor. It answers the reader's next question ("Where to watch X legally", "Who voices Y", "X's manga"), it never reproduces the other site's page. At most three cross-site cards per page.
3. **Each site links only to a kind it does not own.** The anime site never links a manga to itself; it links to the manga site (once that domain exists) or, until then, to manhwaindex, which holds every kind. manhwaindex character pages are the canonical character pages for all five sites: a cast face on a sister site links there.
4. **No link ever points at a workers.dev host.** `config.sisterSites` holds `null` until a domain is bought; a card whose target is null is not rendered. This also means the four sisters link to each other only after each has a domain.
5. **Not in the footer, not in the nav, not sitewide.** The About page may name the family in one sentence. No shared "network" bar, no reciprocal-by-rule links.
6. **Plain links**: `rel="noopener"`, no `nofollow`, no `sponsored`, no UTM parameters, no redirect hops. Every link is counted by the D1 beacon under `kind: 'other'` with the target host, so the owner can see whether readers use them.
7. **Canonical stays on the site that renders the page.** No cross-domain canonicals, no hreflang games, no shared sitemaps.
8. **manhwaindex linking back is a separate, deferred, opt-in change**: a `SISTER_SITES` map in manhwaindex rendering a card only for a domain that is set, added after the sister has a domain and at least four weeks of clean GSC data. It is the only change to manhwaindex in this plan, it is off by default, and it needs the owner's yes.

## 4. Brand and config surface

Everything below collapses into one `sites/<site>/site.config.mjs`, imported by `astro.config.mjs`, the core integration, `worker.js` and every script. A name swap is then that one file plus the assets in `sites/<site>/public/`.

| Config key | Where it is hard-coded in manhwaindex today |
|---|---|
| `name`, `shortName`, `wordmark` parts, `tagline` | `src/layouts/Base.astro` (Organization JSON-LD, og:site_name, wordmark, footer), `src/layouts/Admin.astro`, `public/site.webmanifest`, `public/llms.txt`, `src/pages/{about,contact,dmca,privacy,404,index,search,my-list,shop}.astro`, `src/pages/genre/*.astro`, `src/pages/[kind]/*.astro`, `src/pages/where-to-*.astro`, `src/lib/answers.mjs` (brand inside sentences), `package.json`, `README.md`, `LICENSE`, `DESIGN.md`, `src/styles/app.css` header comment |
| `domain` (nullable) and derived `siteUrl` | `astro.config.mjs` (`site`), `src/layouts/Base.astro` (`const site`), `src/lib/sitemap-urls.js` (`SITE`), `src/lib/listing-jsonld.js`, `src/lib/boost-core.mjs`, `src/lib/own-count.js`, `src/components/WatchList.astro`, `src/pages/{anime/season/index,character/index,genre/index,genre/[slug],[kind]/index,mood/index,schedule,shop,where-to-read,where-to-watch}.astro`, every `[slug].astro` and answer page (`@id` and `url` in JSON-LD), `public/robots.txt` (Sitemap line), `public/llms.txt`, `scripts/make-shards.mjs` (`LIVE_MANIFEST`, user-agent), `scripts/build-boost-links.mjs` (`SITE`), `scripts/sync-animethemes.mjs` (`USER_AGENT`), `tests/boost-core.test.js`, `tests/own-count.test.js` |
| `workerName`, `workersDevHost` | `wrangler.jsonc` (`name`, `routes`) |
| `email`, `dmcaEmail` | `src/layouts/Base.astro`, `src/pages/{about,contact,dmca,privacy}.astro`, `public/llms.txt`, `README.md`, `LICENSE` |
| `ga4Id` | `src/layouts/Base.astro` lines 156 and 482 (`G-R1V6DJN1L3`) |
| `adsensePub` | `src/layouts/Base.astro` lines 640 and 644 (`ca-pub-2789392733984505`); `public/ads.txt` |
| `turnstileSiteKey` | `src/layouts/Base.astro` line 177 (`MI_SITEKEY`); secret `TURNSTILE_SECRET` and `PASS_KEY`, `ADMIN_SECRET` in `.dev.vars` and Worker secrets |
| `amazon.stores` (tag per store) | `src/lib/shop-links.js` `STORES` (eight tags `manhwaindex-20`, `manhwaindex-21`, ...), Amazon disclosure sentence in `shop-links.js`, `src/pages/privacy.astro`, `Base.astro` footer |
| `indexNow.key` | `scripts/indexnow.mjs` (`KEY`, `HOST`), `public/368b5571dfe5413a9a435c04fac12b49.txt` |
| `colors` (12 tokens) and `fonts` | `src/styles/app.css` `:root`, `DESIGN.md`, `public/site.webmanifest` (`theme_color`, `background_color`), `Base.astro` (`<meta name="theme-color">`, Google Fonts link for Saira), `src/lib/runtime.js` (503 page inline colours), `src/pages/404.astro` |
| brand assets | `public/{logo.svg,logo-mark.svg,favicon.svg,favicon.ico,icon-192.png,icon-512.png,apple-touch-icon.png,og-image.png}`, the inline SVG mark in `Base.astro` |
| `d1.name`, `d1.id`, `cron` | `wrangler.jsonc`, `db/schema.sql` header comments, `db/migrations/*` comments |
| `r2.catalogBucket` (read), `r2.dataBucket` and prefix (write) | `scripts/catalog-snapshot.mjs` (`BUCKET`), workflows (`CLOUDFLARE_ACCOUNT_ID` is the same account for all five and stays) |
| `adminSalt` | `src/lib/admin.js` line 22 (`manhwaindex:${word}`) |
| `ownedKinds`, `routes` (which core pages to inject), `entityKinds`, `gates` | new; today implicit in `src/lib/section.mjs` (`SECTIONS`) and `Base.astro` `nav` |
| `sisterSites` map (`{ manhwa: 'https://manhwaindex.com', anime: null, manga: null, manhua: null, novel: null }`) | new |
| `dev.blockBots` | new |

Rule for the core: no string from the table above may appear in `packages/core` outside `site.config` reads; a test (`tests/no-brand-leak.test.js`) greps the core for `manhwaindex`, `G-`, `ca-pub-`, `-20'`, `-21'` and fails on a hit.

## 5. Infrastructure checklist per site

### Now, on workers.dev

Cloudflare account `735d0fbab0757142b2c29917563e0626` for everything.

1. GitHub: create public repo `sister-build` (LICENSE and README as in `mi-build`). Repo secrets: `CLOUDFLARE_API_TOKEN_SISTER` (Workers Scripts edit, D1 edit, R2 read on `manhwaindex-catalog`, R2 read/write on `sister-data`; **not** the manhwaindex token, so a sister job can never write the manhwaindex bucket). Per-site: none extra.
2. R2: create bucket `sister-data`. Prefixes `latest/` (shared credits, staff, airing) and `<site>/` (registry, live manifest, indexnow-sent). Free tier is 10 GB per account and `manhwaindex-catalog` is capped at 9 GB by its script; the sister bucket needs under 1 GB, so either accept a few cents a month or lower manhwaindex's cap later (not now).
3. Worker per site: `wrangler.jsonc` with `name: "<site>"`, `workers_dev: true`, **no** `routes`, `main`, `assets` (`not_found_handling: "none"`, binding `ASSETS`), `triggers.crons: ["10 0 * * *"]`, `observability.enabled`. Secrets via `wrangler secret put`: `TURNSTILE_SECRET`, `PASS_KEY`, `ADMIN_SECRET` (fresh values per site).
4. Turnstile: one widget per site, hostname `<site>.<account-subdomain>.workers.dev`; sitekey into config. (When the domain arrives, add it to the same widget.)
5. D1 per site: `wrangler d1 create <site>-analytics`, id into `wrangler.jsonc`, apply `db/schema.sql` then `db/migrations/0002`, `0003`.
6. **Dev-host guard** (in core `worker.js`, always on, keyed on the request host): when `hostname` ends with `.workers.dev`: `/robots.txt` answers `User-agent: *\nDisallow: /` from the Worker; every response gets `X-Robots-Tag: noindex, nofollow, noarchive`; `Base.astro` adds `<meta name="robots" content="noindex,nofollow">` when the request host is a dev host (the layout reads `Astro.url.hostname`; prerendered pages cannot, so see next point); requests from user agents on the robots.txt block list get a static 403. Because static assets bypass the Worker, `wrangler.jsonc` sets `"run_worker_first": true` **only while `domain` is null** (the config generator writes it; the dev site is low traffic so the extra Worker invocations do not matter). Verify whether Workers static-assets `_headers` accepts host-scoped rules (`https://<host>/*` as in Pages); if it does, that replaces `run_worker_first` at zero cost. When `domain` is set, `run_worker_first` is dropped, `workers_dev` becomes `false`, and the guard lifts on the real host by itself because it only ever keyed on `.workers.dev`.
7. Ingest schedule: shared `ingest-credits.yml` (Mondays 00:30 UTC full-refresh slice, daily 03:00 delta), `ingest-airing.yml` (daily 03:20), `backfill-staff.yml` (hand-run once, then daily new ids inside ingest-credits). Site deploys nightly at 04:00, 04:30, 05:00, 05:30 UTC (after manhwaindex's 02:00 run has pushed to R2), one concurrency group per site.
8. GA4: create the property now (a data stream does not need domain ownership), id into config; change the stream URL when the domain arrives. Optional: leave `ga4Id` null on dev so no junk data is collected.
9. Sitemaps and IndexNow: built, but `indexnow.mjs` skips when `domain` is null (announcing a noindexed dev host would be harmful).
10. `/my-admin` reachable on the dev host with the site's `ADMIN_SECRET`.

### After the domain is bought (per site)

1. Add the zone to the account; DNS to Cloudflare; SSL Full (strict).
2. Config: `domain: "example.com"`; regenerate `wrangler.jsonc`: `routes: [{ pattern: "example.com", custom_domain: true }, { pattern: "www.example.com", custom_domain: true }]`, `workers_dev: false`, no `run_worker_first`. Push; the deploy attaches the custom domain.
3. WAF custom rules on the new zone (per zone, 5 on free): copy manhwaindex's two existing rules, and keep `docs/blocking-the-crawler.md`'s challenge rule ready but off. Bot Fight Mode as on manhwaindex.
4. Turnstile: add the domain to the site's widget.
5. Search Console: domain property; submit `/sitemap.xml`.
6. IndexNow: generate a key, `public/<key>.txt`, config `indexNow.key`; the nightly job starts announcing.
7. GA4: update the stream URL; link Search Console.
8. AdSense: add the site (workers.dev subdomains cannot be added); `ads.txt` from config. Do not enable the challenge WAF rule during review.
9. Amazon Associates: add the site to the account's site list, create a tracking ID per store per site (for example `animesite-20`), paste into `config.amazon.stores`; until then the site's stores have empty tags and `storeFor()` falls back to the US tag exactly as manhwaindex does today (an empty tag is never used).
10. `sisterSites` on the other sisters (and, when the owner says yes, the deferred map in manhwaindex) gets the new domain.
11. Old workers.dev URL: with `workers_dev: false` it answers 404; nothing to redirect because nothing was indexed.

## 6. Build order

**Pilot: the anime site.** Reasons: it has the clearest distinct data (episode dates, people, studios, songs, watch order: none of these are pages on manhwaindex, so the "genuinely different pages" test is easiest to pass and to judge), the largest search demand of the four, and it forces the two shared pieces every other sister needs (the credits/staff walk and the config-driven core). Its 45,000 to 55,000 pages are a real load test without being the 70,000-page manga case. The manhua site would be the cheapest proof of plumbing, but it would prove nothing about the strategy.

Then: **manga** (largest, reuses staff.json for author pages; its title-page gate is the one to watch), then **novel** (small, reuses author/illustrator pages and the lineage builder), then **manhua and donghua** (smallest; needs the airing and studio work from the anime pilot).

### Phases

**Phase 0: core extraction (no deploy).** Create the monorepo; copy manhwaindex `src/`, `scripts/`, `tests/`, `db/` into `packages/core`; introduce `site.config.mjs` and replace every item in section 4; write the Astro integration with `injectRoute`; `makeWorker(config)` with the dev-host guard; `count-pages.mjs`; move the R2 pull to read-only mode. Regression check: build core with a throwaway `manhwaindex` config against the local seed catalog and diff 30 sample pages against a build of `mi-build` at the same commit (ignoring `builtAt`): zero content differences.

**Phase 1: shared ingest.** `ingest-credits.mjs`, `ingest-staff.mjs`, `ingest-airing.mjs`, their workflows, health checks, R2 push to `sister-data/latest/`. Run the credits walk and the staff backfill once.

**Phase 2: anime site on workers.dev.** Config, D1, Turnstile, secrets; entity builders (people, studios, artists, franchises); pages; gates; sitemaps; deploy nightly. Owner reviews 20 pages of each type.

**Phase 3: anime domain.** Section 5 "after the domain" list; four weeks of GSC before any cross-links back from manhwaindex.

**Phase 4: manga site** (entity pages first, title pages behind the gate two weeks later, on workers.dev then domain). **Phase 5: novel. Phase 6: manhua and donghua.** Each repeats Phases 2 and 3.

## 7. Risks and open questions for the owner

1. **Manga title pages overlap manhwaindex's 72,653 /manga pages in raw records.** Recommended: gate to about 35,000 to 45,000 (popularity 300+, or known chapters/volumes, or an author with a page), lead with author and series pages, keep the platform table off the page, and hold the title pages back until author pages have four weeks of GSC data. If GSC shows `manhwaindex.com/manga/*` impressions falling after launch, pause the manga title pages.
2. **Who owns donghua (Chinese anime)?** Recommended: the manhua site, so the anime site is JP and other, and the manhua site is the one place for Chinese comics and animation together. This is a config line (`ownedKinds`) and can be flipped later, but flipping after indexing moves pages, so decide before Phase 2.
3. **Workers plan.** Recommended: stay on Workers Paid for the whole rollout and at least three months after the fourth domain; a fall to Free (100,000 requests a day for all five sites) would take manhwaindex down on its own crawl load.
4. **Domains and names.** Recommended: buy all four domains before Phase 3 (cheap, and it removes the workers.dev period for the later sites entirely, since a site can launch straight onto its domain once the pilot proves the pipeline). Names are the owner's; the plan needs them only as config values.
5. **Amazon and analytics identities.** Recommended: one Associates account, one tracking ID per store per site (added after each domain), one GA4 property per site, one Search Console domain property per site, one D1 per site, one Turnstile widget per site. Nothing shared except the Cloudflare account and the R2 catalog. Also confirm the owner accepts the one deferred manhwaindex change in section 3 rule 8 (off by default).

## 8. Acceptance criteria and tests per phase

**Phase 0**
- `npm test` in `packages/core` passes the 102 existing tests plus `no-brand-leak.test.js` (core contains no manhwaindex string, GA4 id, AdSense id, Amazon tag or Turnstile key).
- `count-pages.mjs` prints per-site counts per gate from the R2 catalog; the numbers replace the estimates in section 2.
- The regression diff against `mi-build` (30 sample pages, `builtAt` masked) is empty.
- A config with `domain: null` generates `wrangler.jsonc` with `workers_dev: true`, `run_worker_first: true`, no routes; with a domain it generates routes, `workers_dev: false`, no `run_worker_first` (unit test on the generator).

**Phase 1**
- `credits.json` covers 99% of catalog ids; `staff.json` covers 99% of ids referenced by credits; `airing.json` has a row for every RELEASING anime with `nextAiringEpisode`. Health script refuses a push under those floors (test with a truncated file).
- Workflow runs under 3 hours, retries a 429, and `continue-on-error` leaves the previous R2 copy intact on failure (simulate by pointing at a bad endpoint).

**Phase 2 (anime on workers.dev)**
- `curl -I https://<host>/` shows `x-robots-tag: noindex, nofollow, noarchive`; `curl https://<host>/robots.txt` is `Disallow: /`; the same two checks on a static listing page and on a title page.
- `curl -A GPTBot` gets 403; a normal browser UA gets 200.
- A title, a voice actor, a staff, a studio, an artist and a watch-order page each render 200 with the expected sections; an unknown slug is 404 with `cache-control: no-store`; a deliberately missing shard answers 503 with `retry-after`.
- No page renders a platform table; every cross-site card targets `manhwaindex.com` and none targets a `workers.dev` host (a crawl script over 500 random pages asserts both).
- Every gated page in the sitemap answers 200 (sample 1,000); no URL outside the sitemap is linked from a page (link-checker over the sample).
- `/_a` without a pass writes nothing (D1 row count unchanged); with a pass, one row per event; the 00:10 cron fills `daily_totals`.
- Worker bundle under 3 MB gzipped; biggest shard lookup under 1 ms in `wrangler dev`; nightly build under 60 minutes.
- Owner has read 20 pages of each type and confirmed they answer a question manhwaindex does not.

**Phase 3 (domain)**
- `curl -I https://example.com/` has no `x-robots-tag`; `robots.txt` is the real policy with the Sitemap line; canonical tags carry the domain; `https://<old>.workers.dev/` answers 404.
- Search Console verified, sitemap accepted, coverage report shows zero "excluded by noindex".
- IndexNow key file served; the nightly job logs 200 or 202.
- GA4 receives `page_view` and the outbound click events; `/my-admin` matches within 10%.
- Amazon links carry the site's own tag in each store (test one URL per store).
- After four weeks: GSC impressions on manhwaindex's anime title pages and anime character pages have not fallen beyond seasonal noise; if they have, stop and review before Phase 4.

**Phases 4 to 6**
- Same as Phases 2 and 3 for each site, plus: the manga gate count matches `count-pages.mjs`; author pages link every work that exists on the site and nothing else; the manhua site renders a donghua's manhua source as a card and the manhua's donghua as an episode table; the novel site never prints a "the anime ends at volume N" claim.
