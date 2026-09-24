// Turn a title or a name into the words of a URL.
//
// Moved here from scripts/anilist-core.mjs so the slug registry (reslug.mjs)
// can build alias addresses with exactly the same rule the ingest uses for
// every slug. anilist-core re-exports it, so nothing that imported it from
// there had to change. Do not change the rule itself: every slug on the live
// site was made by it, and a different rule would move pages.
export const slugify = (value) =>
  (value || '')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
