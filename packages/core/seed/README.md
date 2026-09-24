# The seed catalog

A small gzipped copy of `comics.json`, `anime.json` and `characters.json`,
shared by every site.

## Why it exists

The live catalog is not in git. At full size `comics.json` is about 141 MB, and
GitHub refuses any file over 100 MB. Each build pulls the live files from the
R2 catalog snapshot (`scripts/catalog-snapshot.mjs pull`, read-only for every
site that does not own the catalog).

If R2 cannot be read, the build must not die. `scripts/unseed.sh`, run from a
site's folder, unpacks this seed into that site's `data/` whenever a live file
is missing. The page counts of a seed build are far below the real ones.

## Rules

- This is a floor, not the live data. Nothing in CI writes back to it.
- It is the same seed the catalog's owner keeps. Refresh it only from there,
  rarely, and only when the shape of a record changes.
