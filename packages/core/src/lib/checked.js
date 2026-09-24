// The date the catalog was last checked against AniList.
//
// The daily job rebuilds the site every night, and every build rewrites
// builtAt in data/shards.json. So this date moves once a day on every page,
// including a page whose own record did not change. It is a build stamp, not
// the request time: if the nightly job ever fails, the pages say the honest
// older date instead of pretending they were checked today.
import shards from '@site/data/shards.json'

export const checkedAt = new Date(shards.builtAt || Date.now())

/** 2026-09-21, for JSON-LD dateModified. */
export const checkedISO = checkedAt.toISOString().slice(0, 10)

/** September 21, 2026, for the title and character pages. */
export const checkedLong = checkedAt.toLocaleDateString('en-US', {
  year: 'numeric',
  month: 'long',
  day: 'numeric',
})

/** 21 September 2026, for the platform table. */
export const checkedText = checkedAt.toLocaleDateString('en-GB', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
})
