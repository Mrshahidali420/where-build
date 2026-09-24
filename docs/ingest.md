# The shared sister ingest

Phase 1 of `docs/PLAN.md` (section 2.0): the AniList data the four sister
sites share -- credits, staff and airing dates -- fetched once by
`packages/core/scripts/ingest-credits.mjs`, `ingest-staff.mjs` and
`ingest-airing.mjs`, and written to R2 bucket `sister-data`, prefix
`latest/`. Every site reads the same copy; nothing here is scoped to one
site. None of it touches the shared catalog's own bucket
(`manhwaindex-catalog`) except to read it.

## What each file holds

All three are plain JSON (not gzipped -- see `scripts/sister-data-io.mjs`'s
header comment for why) and are written atomically, with `meta.json` pushed
**last**, so a run that dies partway through never leaves a reader trusting a
half-finished file.

### `credits.json`

`{ "<AniList media id>": { staff, studios, characters } }`, one entry per
title in the shared catalog that has been walked so far.

- `staff`: `[{ id, role }]` -- crew ids only. Names live in `staff.json`.
- `studios`: `[{ id, name, isMain }]` -- the one place a name is kept here;
  there is no separate studios file.
- `characters`: `[{ id, role, voiceActors: [{ id, language }] }]` --
  character ids only (names, faces and bios already live in the shared
  catalog's `characters.json`); voice-actor ids only (names live in
  `staff.json` -- AniList's Staff type covers both crew and voice actors).

Alongside it: `credits-seen.json` (`{ "<id>": updatedAt }`, the delta
mode's memory) and `credits-refresh-walk.json` (`{ next, cycles }`, the
full-refresh mode's cursor).

### `staff.json`

`{ "<AniList staff id>": { name, native, aliases, image, description,
language, occupations, birthDate, homeTown, yearsActive, gender, favourites,
anilistUrl, media, characterIds } }` for every id `credits.json` has ever
pointed at (crew and voice actors both). `media` is `[{ id, type, role }]`
(their staffMedia connection); `characterIds` is the voice roles they are
best known for.

Alongside it: `staff-refresh-walk.json` (the full-refresh cursor; there is no
`staff-seen.json` -- a person has no `updatedAt` to compare against, so
freshness is the refresh walk's job, not delta's).

### `airing.json`

`{ window: { from, to }, schedule: [...], history: {...} }`.

- `window`/`schedule`: every episode airing +/-60 days of the run, across all
  of AniList, replaced whole every run (`schedule` is a rolling view, not an
  archive, so there is nothing to merge). Row: `{ at, episode, mediaId }`.
- `history`: `{ "<AniList anime id>": [{ at, episode }, ...] }`, the full
  dated episode list, for anime that earn one (RELEASING, or FINISHED within
  three years and under 200 episodes -- `eligibleForHistory` in
  `scripts/sister-airing.mjs`). Merged: a title's rows stay once fetched.

Alongside it: `airing-refresh-walk.json` (the full-refresh cursor).

## Schedules

| Workflow | When | Mode |
|---|---|---|
| `ingest-credits.yml` | Mondays 00:30 UTC | `full-refresh` (a slice, not the whole catalog every week) |
| `ingest-credits.yml` | daily 03:00 UTC | `delta` (credits), then `delta` (staff: new ids only) |
| `ingest-airing.yml` | daily 03:20 UTC | `delta` (window + RELEASING history + a trickle backfill) |
| `backfill-staff.yml` | hand-run only | `full-refresh` (the slow bio/photo/work-list sweep) |

Each workflow has its own concurrency group, `continue-on-error: true` on
every ingest step, and a health check inside the script that refuses to push
a file that would fall back under a floor it already reached (see
`scripts/sister-health.mjs`), so a bad AniList night leaves the previous R2
copy exactly as it was. Nothing here runs on push to `master`; `test.yml` is
the only workflow that does, and it only runs the workspace tests.

## Batch size and the corrected call estimate

`docs/PLAN.md` estimated one AniList call per anime for the per-anime airing
history (about 1,500 to 2,000 calls once). Probed against the live API on
24 Sep 2026, batching it the same way as everything else here --
`Page(perPage: 50) { media(id_in: [...], type: ANIME) { airingSchedule
(perPage: 200) { ... } } }` -- returned 200 with no complexity error at the
full 50-id batch, so the history walk's main pass costs roughly one call per
50 anime, not one call per anime (see `scripts/sister-airing.mjs`'s header
comment). The credits query (`staff(perPage: 25)`, `characters(perPage: 25)`
with `voiceActorRoles`) and the staff query (bio, `staffMedia(perPage: 25)`,
`characters(perPage: 25)`) both also batch at the full 50 ids per call with
no complexity error. Every walk in this ingest therefore runs at
`IDS_PER_CALL` (50), the same rate as the main catalog ingest, not a smaller
one.

**The eligible-for-history count is also corrected, upward.** The plan
guessed 1,500 to 2,000 RELEASING-or-recent-finished anime under 200 episodes.
The real catalog (24 Sep 2026, `eligibleForHistory` in
`scripts/sister-airing.mjs`) has **2,899** (175 RELEASING), out of 20,813
anime total. At 50 per call that is about 58 calls for the main batched
pass, not 30 to 40.

**One real cost the plan did not anticipate: a rare title's `airingSchedule`
connection holds more rows than its `episodes` count suggests**, even though
`eligibleForHistory` already caps at 200 episodes -- almost certainly
reruns, delayed regional broadcasts or dub entries counted as separate
`airingSchedule` nodes. `fetchOverflow` in `ingest-airing.mjs` follows up
per id, one extra page (200 more rows) at a time, when the batched query's
`airingSchedule.pageInfo.hasNextPage` comes back true. In the local test
sample below, 28 of 60 titles needed this follow-up, at roughly 4 extra
calls each; two of those follow-ups failed mid-way (a transient error) and
were left holding exactly 200 rows rather than the full history. Delta
mode's "still missing" check only looks at whether a title has *any* rows,
not whether its history is complete, so a title truncated this way is not
retried automatically -- a real gap worth closing before this matters (a
manual `full-refresh` run, or a completeness check added to the selection
logic, both work; neither is done in Phase 1). Because the sample that
found this was small and deliberately skewed toward whichever ids the
"still missing" trickle picked first, this is reported as an observed
finding, not extrapolated into a revised total call estimate -- watch the
logged call count on the real GitHub Actions runs instead of trusting a
straight-line multiplication from this sample.

**Measured locally against the real catalog and AniList on 24 Sep 2026,
nothing pushed to R2** (see the session's report for the full numbers):

| Script | Sample | Calls | Wall time | Notes |
|---|---|---|---|---|
| `ingest-credits.mjs` | 100 titles (delta) | 2 | 1m17s total (catalog pull dominates; ~7s of AniList time) | 110 titles now in credits.json after two runs |
| `ingest-staff.mjs` | 562 referenced ids (from the 110 credits titles) | 12 | 41s | no catalog pull needed |
| `ingest-airing.mjs` | window (39 pages) + a 60-id history slice | 155 | 8m37s (catalog pull + a long window sweep + overflow follow-ups) | 1,903 window rows; see the overflow note above |

The dominant local wall-clock cost for `ingest-credits` and `ingest-airing`
is the one-time read-only pull of the ~116,000-title shared catalog at the
start of each run (comics.json + anime.json, gunzipped and parsed), not the
AniList walk itself -- a cost the real GitHub Actions runs also pay once per
job, not per call.

## Running a small test locally

Every script writes to `packages/core/data/sister/` (git-ignored) and never
pushes to R2 unless `PUSH=1` is set. `SITE_CONFIG` must name any one site's
`site.config.mjs` -- every site's `r2.catalogBucket` and `r2.dataBucket`
point at the same two buckets (`sites/family.mjs`), so which one is named
does not matter, but the ingest has no bucket names of its own to fall back
on (see `scripts/sister-data-io.mjs` and `tests/no-brand-leak.test.js`, which
is exactly what forces this).

```
cd packages/core

# credits: a small slice, real AniList, local files only
SITE_CONFIG=../../sites/anime/site.config.mjs node scripts/ingest-credits.mjs --limit=100

# staff: whatever credits.json (just written) points at
SITE_CONFIG=../../sites/anime/site.config.mjs node scripts/ingest-staff.mjs

# airing: a small slice of history, plus the full +/-60 day window
SITE_CONFIG=../../sites/anime/site.config.mjs node scripts/ingest-airing.mjs --limit=50
```

Add `PUSH=1` only when you mean to write `sister-data` in R2 -- do this from
GitHub Actions, not a local machine, once the secrets below exist.
`MODE=full-refresh` runs the weekly-style slice instead of delta;
`--ids=1,2,3` fetches exactly those ids, skipping selection entirely. Never
run a full, unbounded walk locally: the full-catalog credits walk is roughly
2,300 calls (about an hour and a half at AniList's pace), and it belongs in
GitHub Actions once `CLOUDFLARE_API_TOKEN_SISTER` exists, not on this
machine.

The pure logic (query building, batching, delta and slice selection, health
and shrink guards, merging partial results) is tested with `npm test`,
network-free: `tests/sister-credits.test.js`, `tests/sister-staff.test.js`,
`tests/sister-airing.test.js`, `tests/sister-walk.test.js`,
`tests/sister-health.test.js`, `tests/sister-cli.test.js`.

## `CLOUDFLARE_API_TOKEN_SISTER`: exact permissions

Two repo secrets, both still to be created by the owner: `CLOUDFLARE_ACCOUNT_ID`
(the account id, `735d0fbab0757142b2c29917563e0626` -- not a token, just
carried as a secret like every other workflow in this family of repos does)
and `CLOUDFLARE_API_TOKEN_SISTER`, a **new** Cloudflare API token, never the
one `mi-build` uses.

**For Phase 1 (this ingest), the token needs exactly one permission:**

- Account -> **Workers R2 Storage** -> **Edit**
- Account Resources -> Include -> the one Cloudflare account above

That single permission is enough for every read and every write this ingest
does: reading `manhwaindex-catalog/latest/{comics,anime}.json.gz` and writing
`sister-data/latest/*`.

**Cloudflare API tokens cannot be scoped to one R2 bucket.** The "Workers R2
Storage" permission group is granted for the whole account, not per bucket --
there is no dropdown or resource selector that limits it to `sister-data`
alone. This means `CLOUDFLARE_API_TOKEN_SISTER`, once it carries R2 Edit,
is **technically able** to write `manhwaindex-catalog` too, even though
nothing in this repo's code ever calls a write against it
(`scripts/sister-data-io.mjs` only ever calls `r2 object get` on that
bucket; `scripts/catalog-snapshot.mjs`, the only script in this codebase
that pushes to it, is never invoked by the sister ingest at all). The actual
protection is that this token lives only in `where-build`'s secrets and is
never the token `mi-build`'s own workflows use -- two separate tokens in two
separate repos, exactly as `docs/PLAN.md` section 5 item 1 calls for -- not a
permission boundary Cloudflare enforces for us. If that gap matters more
later, the only stronger option is an R2-native S3-compatible token scoped
to one bucket (created from the R2 dashboard, not the account API token
screen), but `wrangler r2 object get/put` -- what every script here shells
out to -- authenticates with an account API token, not S3 credentials, so
adopting that would mean rewriting the R2 calls to the S3 API instead of
wrangler. Out of scope for Phase 1; worth a note if this repo's blast radius
ever needs to shrink further.

**Before Phase 2 (deploying a site), add two more permissions to the same
token** (or mint a second one; the plan does not require a second token,
just names the abilities a deploy needs):

- Account -> **Workers Scripts** -> **Edit** (to `wrangler deploy` a site's
  Worker)
- Account -> **D1** -> **Edit** (to create each site's database and apply
  `db/schema.sql` / `db/migrations`)

Nothing in Phase 1 needs either of these; they are listed here so the owner
can grant everything in one visit to the token screen if they prefer, or add
them later when Phase 2 actually starts.
