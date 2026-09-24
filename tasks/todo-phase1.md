# Phase 1: shared ingest

Spec: `docs/PLAN.md` section 2.0 (credits.json, staff.json, airing.json), Phase 1
in sections 6 and 8, and section 5 items 1, 2 and 7.

## Checklist

- [x] `packages/core/scripts/ingest-credits.mjs`: ids-only staff/studios/cast walk
- [x] `packages/core/scripts/ingest-staff.mjs`: every id credits.json points at
- [x] `packages/core/scripts/ingest-airing.mjs`: +/-60 day window + per-anime history
- [x] Shared pure modules (query, shape, select, merge): `sister-credits.mjs`,
      `sister-staff.mjs`, `sister-airing.mjs`, `sister-walk.mjs`, `sister-health.mjs`,
      `sister-cli.mjs`
- [x] R2 IO: `sister-data-io.mjs` (read-only catalog pull, sister-data
      push/pull, meta.json written last)
- [x] Delta mode (probe against the pulled catalog's own `updatedAt`, no
      extra AniList calls), full-refresh slice mode (wraps forever via
      `sister-walk.mjs`), `--limit`/`--ids` test flags
- [x] Health checks with coverage floors from section 8, refusing a push that
      drops a mature file below its floor; bootstrap runs are not held to a
      floor they have not reached yet
- [x] `.github/workflows/ingest-credits.yml` (weekly full-refresh + daily delta,
      plus a staff delta step), `ingest-airing.yml` (daily delta),
      `backfill-staff.yml` (hand-run full-refresh)
- [x] `.github/workflows/test.yml`: the only workflow on push to master
- [x] Tests for the pure parts (`node --test`), no network
- [x] `docs/ingest.md`: file formats, schedules, local test instructions,
      exact token permissions, the R2-cannot-scope-per-bucket caveat
- [x] `.gitignore`: `packages/core/data/` (the ingest's local output)
- [x] Verified locally against the real catalog and AniList, `--limit`
      only, nothing pushed to R2
- [x] All workspace tests pass (`npm test`)
- [x] manhwaindex working tree untouched; no write call against its bucket
      exists anywhere in this ingest

## Review

**Batch size.** The plan's example queries were probed against the live
AniList API on 24 Sep 2026 at the full 50-id batch (`IDS_PER_CALL`, the same
batch size the main catalog ingest uses): `staff(perPage: 25)` +
`characters(perPage: 25)` with `voiceActorRoles` for credits, the full staff
field list (bio, `staffMedia(perPage: 25)`, `characters(perPage: 25)`) for
staff, and -- the one real surprise -- `airingSchedule(perPage: 200)` batched
the same way for the per-anime history, which the plan had estimated at one
call per anime. All returned HTTP 200 with no AniList complexity error, so
every walk here runs at 50 ids per call, not a smaller batch.

**Corrected estimate.** The catalog holds 2,899 eligible-for-history anime
today (175 RELEASING), not the plan's guessed 1,500 to 2,000 -- a real,
upward correction. At 50 ids per call the main batched pass is about 58
calls, not 1,500 to 2,000. A real cost the plan missed: a rare title's
`airingSchedule` connection holds more rows than its episode count implies,
needing a per-id overflow follow-up; a 60-title local sample hit this on 28
titles (two follow-ups failed and were left truncated, a real gap in the
"still missing" retry logic worth closing later). See `docs/ingest.md`'s
"Batch size and the corrected call estimate" section for the full numbers.

**Tests.** `npm test` at the repo root: the existing 131 core tests plus 42
new ones (`sister-health`, `sister-walk`, `sister-credits`, `sister-staff`,
`sister-airing`, `sister-cli`) -- 173 in `packages/core`, plus 4 site checks.
All pass. `tests/no-brand-leak.test.js` caught a real mistake early: the R2
bucket name was first hard-coded in `sister-data-io.mjs`; fixed to read
`config.r2.catalogBucket` / `config.r2.dataBucket` from `site.mjs`, the same
way `catalog-snapshot.mjs` does, with every site's config pointing at the
same two bucket names.

**Local verification, against the real catalog and AniList, nothing pushed.**
See the session's report for exact numbers: credits.json at a 100-title
slice, staff.json for the titles' referenced people, airing.json's window
plus a small history slice.

**Deviations from the brief's literal reading.**

- The airing history walk is batched (`id_in`, 50 at a time) rather than one
  call per anime, once the probe showed the batch works (see above). This
  only shrinks the call count; the eligibility rule and the data shape are
  unchanged.
- Staff's "slow refresh slice" (a changed bio, photo or work list with no
  signal that it changed) runs only from `backfill-staff.yml`, hand-triggered,
  not on its own nightly schedule: the brief's workflow list names three
  files, and the daily staff step inside `ingest-credits.yml` only fetches
  ids new to `staff.json`, which is the part that must run every night for
  new people to get a page at all.
- `ingest-airing.mjs`'s delta mode carries a small nightly trickle backfill
  (`AIRING_BACKFILL`, default 200 ids) of eligible-but-uncovered finished
  anime, so the one-time history backfill for that bucket completes over the
  first several nights without a dedicated workflow (the brief does not list
  one for airing, unlike credits and staff).

## Open risks for Phase 2

- A title truncated by a failed overflow follow-up (see above) is not
  retried by delta mode's "still missing" check, since that check only asks
  whether a title has any history rows, not whether it is complete. Only a
  manual `full-refresh` run currently re-covers it.

- The coverage floors (credits 99%, staff 99%, airing's RELEASING coverage)
  are enforced as shrink guards against the *previous* push's recorded
  health, not as absolute gates from run one -- a brand new push is never
  refused for being partial, only for regressing once it has already reached
  the floor. The floors themselves are only reached once the full walks
  (weekly credits slices, the hand-run staff backfill, nightly airing
  trickle) have had enough time or enough manual runs.
- `CLOUDFLARE_API_TOKEN_SISTER`, once granted R2 Edit, can technically write
  `manhwaindex-catalog` too -- Cloudflare cannot scope an API token to one R2
  bucket. The protection is that this token is never the one `mi-build`
  itself uses, not a Cloudflare-enforced boundary. See `docs/ingest.md`.
- No secrets exist in `where-build` yet, so every scheduled ingest workflow
  will fail its ingest step (gracefully, `continue-on-error: true`, nothing
  pushed) until the owner creates `CLOUDFLARE_API_TOKEN_SISTER` and
  `CLOUDFLARE_ACCOUNT_ID`.
