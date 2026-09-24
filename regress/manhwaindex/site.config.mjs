// A throwaway site: manhwaindex itself, rebuilt from packages/core.
//
// It exists for one job: it and mi-build (manhwaindex's own repo, exported by
// regress/prepare.mjs) are built from the same seed catalog, and
// regress/fetch-pages.mjs plus regress/diff-pages.mjs compare their pages, to
// prove the core renders manhwaindex exactly as manhwaindex does. It is never
// deployed.
//
// These are manhwaindex's real ids. They live here and nowhere else in this
// repo; packages/core must never hold them (tests/no-brand-leak.test.js).
import { defineSite } from '@sister/core/site'
import { ALL_ROUTES } from '@sister/core/routes'

export default defineSite({
  key: 'manhwaindex',
  name: 'manhwaindex',
  shortName: 'Manhwa Index',
  wordmark: ['manhwa', 'index'],
  tagline: 'Where to read it, legally',
  description:
    'An index of manhwa, manga, manhua and anime that lists only the official platforms licensed to carry each title.',
  mark:
    '<path d="M4 4h24v17.5L21.5 28H4Z" fill="none" stroke="currentColor" stroke-width="2.5"></path> ' +
    '<path d="M9 22V10h2.8L16 15.2 20.2 10H23v12h-2.8v-7.4L16 19.6l-4.2-5V22Z" fill="currentColor"></path>',

  domain: 'manhwaindex.com',
  plannedDomain: null,
  workerName: 'manhwaindex',
  workersSubdomain: 'mr-shahidali-sa',

  email: 'hello@manhwaindex.com',
  dmcaEmail: 'dmca@manhwaindex.com',
  ga4Id: 'G-R1V6DJN1L3',
  adsensePub: 'ca-pub-2789392733984505',
  turnstileSiteKey: '0x4AAAAAAE8pcD79Cqtyp6rS',
  amazon: {
    stores: {
      us: 'manhwaindex-20',
      uk: 'manhwaindex-21',
      de: 'manhwaindex06-21',
      fr: 'manhwainde0f6-21',
      it: 'manhwaindex04-21',
      es: 'manhwaindex0a-21',
      ca: 'manhwaindex01-20',
      jp: 'manhwaindex-22',
    },
  },
  indexNow: { key: '368b5571dfe5413a9a435c04fac12b49' },

  colors: {
    night: '#050508',
    'night-raised': '#0b0d1a',
    'night-sunk': '#030306',
    cobalt: '#16337d',
    'cobalt-line': '#24418f',
    'cobalt-bright': '#5f7fe0',
    rose: '#e0688a',
    'rose-soft': '#f0a3b8',
    dawn: '#f5ecdd',
    'dawn-dim': '#b8b3c9',
    'dawn-faint': '#8d87a6',
    day: '#ffffff',
  },
  fonts: {
    stylesheet: 'https://fonts.googleapis.com/css2?family=Saira:wght@400;600;700;800&family=Saira+Stencil+One&display=swap',
    adminStylesheet: 'https://fonts.googleapis.com/css2?family=Saira:wght@500;600;700&display=swap',
    display: "'Saira Stencil One', 'Saira', sans-serif",
    text: "'Saira', ui-sans-serif, system-ui, sans-serif",
  },

  d1: { name: 'manhwaindex-analytics', id: 'a31cde34-a594-4430-b415-79869e4f4435' },
  cron: ['10 0 * * *'],
  r2: { catalogBucket: 'manhwaindex-catalog', catalogWrite: true, dataBucket: null },
  adminSalt: 'manhwaindex',
  rebuildUtc: '02:00',

  ownedKinds: [{ kind: 'comic' }, { kind: 'novel' }, { kind: 'anime' }],
  routes: ALL_ROUTES,
  entityKinds: [],
  gates: [],
  sisterSites: { manhwa: null, anime: null, manga: null, manhua: null, novel: null },
  dev: { blockBots: true },
  malExtras: true,

  nav: [
    { href: '/manhwa', label: 'Manhwa' },
    { href: '/manga', label: 'Manga' },
    { href: '/manhua', label: 'Manhua' },
    { href: '/novel', label: 'Novels' },
    { href: '/anime', label: 'Anime' },
    { href: '/shop', label: 'Shop' },
    { href: '/genre', label: 'Genres' },
    { href: '/where-to-read', label: 'Where to Read' },
    { href: '/where-to-watch', label: 'Where to Watch' },
    { href: '/schedule', label: 'Schedule' },
    { href: '/mood', label: 'Moods' },
    { href: '/character', label: 'Characters' },
    { href: '/my-list', label: 'My list' },
  ],
  footer: {
    blurb:
      'The official-sources index. Look up a manhwa, manga, manhua or anime and get the apps and platforms that legally carry it. We host no chapters and no episodes — every link goes to the rights holder.',
    browse: [
      { href: '/manhwa', label: 'Manhwa' },
      { href: '/manga', label: 'Manga' },
      { href: '/manhua', label: 'Manhua' },
      { href: '/novel', label: 'Novels' },
      { href: '/anime', label: 'Anime' },
      { href: '/character', label: 'Characters' },
      { href: '/schedule', label: 'Airing this week' },
      { href: '/anime/season', label: 'Anime by season' },
      { href: '/mood', label: 'What to read next' },
      { href: '/where-to-read', label: 'Where to read' },
      { href: '/where-to-watch', label: 'Where to watch' },
      { href: '/shop', label: 'Shop merch' },
    ],
    bar: 'Official sources only. No mirrors, no scans.',
  },
  dock: [
    { href: '/', label: 'Home', icon: 'home' },
    { href: '/where-to-read', label: 'Read', icon: 'read' },
    { href: '/where-to-watch', label: 'Watch', icon: 'watch' },
    { href: '/genre', label: 'Genres', icon: 'grid' },
    { href: '/shop', label: 'Shop', icon: 'shop' },
  ],
  search: {
    emptyLinks: [
      { href: '/manhwa', label: 'manhwa' },
      { href: '/manga', label: 'manga' },
      { href: '/anime', label: 'anime' },
    ],
  },
})
