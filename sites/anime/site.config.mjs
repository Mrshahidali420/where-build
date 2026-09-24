// WhereAnime: when an episode airs, who made the show, who voices it, what the
// songs are and what order to watch a franchise in (docs/PLAN.md section 2.1).
import { defineSite } from '@sister/core/site'
import { FAMILY } from '../family.mjs'

// The hubs every page can reach. The same list is the menu, the footer and
// the links a search that finds nothing offers.
const HUBS = [
  { href: '/directory/voice-actors', label: 'Voice actors' },
  { href: '/directory/staff', label: 'Staff' },
  { href: '/directory/studios', label: 'Studios' },
  { href: '/directory/artists', label: 'Songs' },
  { href: '/directory/watch-orders', label: 'Watch orders' },
  { href: '/year', label: 'By year' },
]

export default defineSite({
  ...FAMILY,
  key: 'whereanime',
  name: 'WhereAnime',
  shortName: 'WhereAnime',
  wordmark: ['where', 'anime'],
  tagline: 'Episodes, voices and the people behind them',
  description:
    'Every episode date, every voice actor, every studio and song, and the order to watch each franchise in, for anime from Japan and beyond.',
  // Placeholder mark: a map pin with a play button.
  mark:
    '<path d="M16 3a9 9 0 0 0-9 9c0 6.6 9 17 9 17s9-10.4 9-17a9 9 0 0 0-9-9Z" fill="none" stroke="currentColor" stroke-width="2.5"></path> ' +
    '<path d="M14 8.5v7l6-3.5Z" fill="currentColor"></path>',

  plannedDomain: 'whereanime.com',
  workerName: 'whereanime',

  colors: {
    night: '#0a0612',
    'night-raised': '#150d22',
    'night-sunk': '#05030a',
    cobalt: '#43196e',
    'cobalt-line': '#5a2a8c',
    'cobalt-bright': '#b08cf5',
    rose: '#c3e64f',
    'rose-soft': '#def3a1',
    dawn: '#f7f2ea',
    'dawn-dim': '#c4bcd2',
    'dawn-faint': '#9a90b0',
    day: '#ffffff',
  },

  // Self-hosted type (@fontsource, OFL). Dela Gothic One is a Japanese poster
  // gothic: the section names and the wordmark speak in it. Zen Kaku Gothic New
  // is the body face, from the same tradition, with a calm Latin that holds
  // long credit lists and dated episode tables. Latin and Latin Extended only.
  fonts: {
    display: "'Dela Gothic One', 'Zen Kaku Gothic New', ui-sans-serif, system-ui, sans-serif",
    text: "'Zen Kaku Gothic New', ui-sans-serif, system-ui, sans-serif",
    self: {
      subsets: ['latin', 'latin-ext'],
      faces: [
        { pkg: '@fontsource/dela-gothic-one', file: 'dela-gothic-one', weights: [400], preload: [400], admin: [] },
        { pkg: '@fontsource/zen-kaku-gothic-new', file: 'zen-kaku-gothic-new', weights: [400, 500, 700], preload: [400], admin: [500, 700] },
      ],
    },
  },

  d1: { name: 'whereanime-analytics', id: null },
  adminSalt: 'whereanime',
  rebuildUtc: '04:00',
  r2: { ...FAMILY.r2, statePrefix: 'anime' },

  // The Where entity build (scripts/make-where.mjs): its own pages live in
  // sites/anime/src/pages. From the core it takes only the sitemaps, the
  // search slices and the admin.
  builder: 'where',
  routes: ['sitemaps', 'search', 'searchIndex', 'admin'],

  // Donghua (anime from China and Taiwan) belongs to the manhua site.
  ownedKinds: [{ kind: 'anime', notFrom: ['CN', 'TW'] }],
  entityKinds: ['voice-actor', 'staff', 'studio', 'artist', 'watch-order'],
  // One gate per page type (docs/PLAN.md section 2.1). src/where/gates.mjs
  // applies them; scripts/count-pages.mjs prints what each lets through.
  gates: [
    { page: '/anime/<slug>', count: 'where', type: 'title', credits: 3 },
    { page: '/anime/<slug>/episodes', count: 'where', type: 'episodes', min: 13 },
    { page: '/voice-actor/<slug>', count: 'where', type: 'voiceActor', min: 3 },
    { page: '/staff/<slug>', count: 'where', type: 'staff', min: 2 },
    { page: '/studio/<slug>', count: 'where', type: 'studio', min: 2 },
    { page: '/artist/<slug>', count: 'where', type: 'artist', min: 2 },
    { page: '/watch-order/<slug>', count: 'where', type: 'watchOrder', min: 3 },
  ],

  nav: HUBS,
  footer: {
    ...FAMILY.footer,
    browse: HUBS,
    // This site's own pages (src/pages/about.astro, privacy.astro).
    legal: [
      { href: '/about', label: 'About' },
      { href: '/privacy', label: 'Privacy' },
    ],
    blurb: 'Episode dates, casts, studios and songs for every anime in the catalog, from AniList and AnimeThemes.',
  },
  search: {
    description: 'Search every anime, with its episode dates, cast and staff,',
    pageLinks: HUBS.map((hub) => ({ href: hub.href, label: hub.label.toLowerCase() })),
    emptyLinks: [
      { href: '/directory/voice-actors', label: 'voice actors' },
      { href: '/directory/studios', label: 'studios' },
      { href: '/year', label: 'anime by year' },
    ],
  },
})
