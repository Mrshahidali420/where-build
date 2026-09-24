#!/usr/bin/env bash
# Make sure the three catalog files exist before a build.
#
# They are not in git: at full size comics.json is 141 MB and GitHub refuses
# any file over 100 MB. They live in the GitHub Actions cache (and in R2, see
# scripts/catalog-snapshot.mjs) instead. A cache is deleted after 7 days
# without use, so this script unpacks the small seed copy in packages/core/seed
# whenever a file is missing.
#
# The seed is a floor, never the live data. Nothing writes back to it.
#
# "Exists" used to mean "is not zero bytes". A file holding `[]`, or one cut
# off mid-write, passed that test and went on to build an empty or broken
# site. Now each file is parsed:
#   parses, and is a non-empty list -> kept ("from the cache")
#   missing, zero bytes, or []      -> the seed is unpacked
#   there but does not parse        -> stop. A torn catalog is a bug to look
#                                      at, not something to paper over with
#                                      the seed, which is far smaller.
set -euo pipefail

# Run from the site being built: its data/ is filled. The seed itself is shared
# by every site and lives in packages/core/seed.
SEED_DIR="$(cd "$(dirname "$0")/../seed" && pwd)"
mkdir -p data

for name in comics anime characters; do
  live="data/$name.json"
  seed="$SEED_DIR/$name.json.gz"

  state=$(node --max-old-space-size=6000 -e '
    const fs = require("fs")
    const file = process.argv[1]
    if (!fs.existsSync(file) || fs.statSync(file).size === 0) { console.log("missing"); process.exit(0) }
    let value
    try {
      value = JSON.parse(fs.readFileSync(file, "utf8"))
    } catch (error) {
      console.log("corrupt " + error.message)
      process.exit(0)
    }
    console.log(Array.isArray(value) && value.length > 0 ? "ok " + value.length : "empty")
  ' "$live")

  case "$state" in
    ok*)
      echo "$live: from the cache (${state#ok } records)"
      continue
      ;;
    corrupt*)
      echo "::error::$live is there but is not valid JSON (${state#corrupt }). Refusing to build from it." >&2
      exit 1
      ;;
  esac

  if [ ! -s "$seed" ]; then
    echo "$live is $state and $seed does not exist either." >&2
    exit 1
  fi

  echo "$live: $state, unpacking the seed"
  gzip -dc "$seed" > "$live"
done

ls -la data/*.json
