// What the four "Where" sites share. Each sites/<site>/site.config.mjs
// spreads this, then adds its own name, colours, kinds and gates.
//
// Every id is empty on purpose. The sites live on their workers.dev address
// until each domain is bought (docs/PLAN.md section 5), and nothing is created
// for them before then: no analytics, no ads, no shop tags, no IndexNow key,
// no Turnstile widget, no database. Each value is filled when its step in
// section 5 is done, never copied from another site.

export const FAMILY = {
  domain: null,
  workersSubdomain: 'mr-shahidali-sa',

  email: null,
  dmcaEmail: null,
  ga4Id: null,
  adsensePub: null,
  turnstileSiteKey: null,
  amazon: { stores: { us: '', uk: '', de: '', fr: '', it: '', es: '', ca: '', jp: '' } },
  indexNow: { key: null },

  // Placeholder type: the family shares one pair until the brand is designed.
  fonts: {
    stylesheet: 'https://fonts.googleapis.com/css2?family=Saira:wght@400;600;700;800&family=Saira+Stencil+One&display=swap',
    adminStylesheet: 'https://fonts.googleapis.com/css2?family=Saira:wght@500;600;700&display=swap',
    display: "'Saira Stencil One', 'Saira', sans-serif",
    text: "'Saira', ui-sans-serif, system-ui, sans-serif",
  },

  cron: ['10 0 * * *'],
  // The catalog is read from the bucket the first site writes, never written.
  // The sisters' own data (credits, staff, airing) goes to their own bucket.
  r2: { catalogBucket: 'manhwaindex-catalog', catalogWrite: false, dataBucket: 'sister-data' },

  // manhwaindex holds every kind and is the one sister with a domain today.
  // The others stay null until theirs are bought (docs/PLAN.md section 3).
  sisterSites: { manhwa: 'https://manhwaindex.com', anime: null, manga: null, manhua: null, novel: null },
  dev: { blockBots: true },
  malExtras: false,

  // Phase 0 builds only what every site carries. Each site's own pages come in
  // Phase 2 (docs/PLAN.md section 2); the core's reading and watching pages
  // (platform tables, answers, characters, genres, moods) are never built here.
  routes: ['sitemaps', 'admin', 'notFound'],
  nav: [],
  footer: { browse: [], bar: 'Built from AniList data. We host nothing.' },
  dock: [],
  search: { emptyLinks: [] },
}
