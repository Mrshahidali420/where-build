// WhereAnime: when an episode airs, who made the show, who voices it, what the
// songs are and what order to watch a franchise in (docs/PLAN.md section 2.1).
import { defineSite } from '@sister/core/site'
import { familyMark } from '@sister/core/src/lib/brand.mjs'
import { FAMILY } from '../family.mjs'

// The main menu. A hub that its gate did not build this time (a week with too
// few dated episodes has no schedule) is left out of the menu by the layout,
// from data/site-stats.json.
const NAV = [
  { href: '/anime', label: 'Anime' },
  { href: '/schedule', label: 'Schedule' },
  { href: '/season', label: 'Seasons' },
  { href: '/directory/voice-actors', label: 'Voice actors' },
  { href: '/directory/staff', label: 'Staff' },
  { href: '/directory/studios', label: 'Studios' },
  { href: '/directory/artists', label: 'Songs' },
  { href: '/directory/watch-orders', label: 'Watch orders' },
]

const LEGAL = [
  { href: '/about', label: 'About' },
  { href: '/contact', label: 'Contact' },
  { href: '/privacy', label: 'Privacy' },
  { href: '/dmca', label: 'Copyright and DMCA' },
]

export default defineSite({
  ...FAMILY,
  key: 'whereanime',
  name: 'WhereAnime',
  shortName: 'WhereAnime',
  wordmark: ['where', 'anime'],
  tagline: 'Episode dates, voice actors and the people behind every anime',
  description:
    'Every episode date, every voice actor, every studio and song, and the order to watch each franchise in, for anime from Japan and beyond.',
  // The Where family pin with the anime symbol, a play button, cut out of it
  // (packages/core/src/lib/brand.mjs). The icons, the wordmark and the share
  // image are drawn from it by packages/core/scripts/make-site-icons.mjs.
  mark: familyMark('play'),

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

  d1: { name: 'whereanime-analytics', id: 'cf342163-4a44-42b2-b427-49196cf9d333' },
  adminSalt: 'whereanime',
  rebuildUtc: '04:00',
  r2: { ...FAMILY.r2, statePrefix: 'anime' },

  // The Where entity build (scripts/make-where.mjs): its own pages live in
  // sites/anime/src/pages, the results page included. From the core it takes
  // only the sitemaps, the search slices and the admin.
  builder: 'where',
  routes: ['sitemaps', 'searchIndex', 'admin'],

  // Donghua (anime from China and Taiwan) belongs to the manhua site.
  ownedKinds: [{ kind: 'anime', notFrom: ['CN', 'TW'] }],
  entityKinds: ['voice-actor', 'staff', 'studio', 'artist', 'watch-order'],
  // One gate per page type (docs/PLAN.md section 2.1). src/where/gates.mjs
  // applies them; scripts/count-pages.mjs prints what each lets through.
  gates: [
    { page: '/anime/<slug>', count: 'where', type: 'title', credits: 3 },
    { page: '/anime/<slug>/episodes', count: 'where', type: 'episodes', min: 13 },
    { page: '/voice-actor/<slug>', count: 'where', type: 'voiceActor', min: 3 },
    // Real crew work on 3+ shows, or a key credit (director, writer, creator,
    // designer, composer) on 2+. Song performances and producer seats do not count.
    { page: '/staff/<slug>', count: 'where', type: 'staff', min: 3, keyMin: 2 },
    { page: '/studio/<slug>', count: 'where', type: 'studio', min: 2 },
    { page: '/artist/<slug>', count: 'where', type: 'artist', min: 2 },
    { page: '/watch-order/<slug>', count: 'where', type: 'watchOrder', min: 3 },
    { page: '/schedule', count: 'where', type: 'schedule', min: 10 },
    { page: '/season/<year>/<season>', count: 'where', type: 'season', min: 12 },
    { page: '/genre/<slug>[/<page>]', count: 'where', type: 'genre', min: 60, per: 60, maxPages: 10 },
  ],

  nav: NAV,
  footer: {
    ...FAMILY.footer,
    browse: NAV,
    // The footer's columns (packages/core/src/layouts/Where.astro).
    columns: [
      {
        title: 'Anime',
        links: [
          { href: '/anime', label: 'Browse anime' },
          { href: '/schedule', label: 'Airing schedule' },
          { href: '/season', label: 'Seasons' },
          { href: '/genre', label: 'Genres' },
          { href: '/year', label: 'Anime by year' },
        ],
      },
      {
        title: 'People and studios',
        links: [
          { href: '/directory/voice-actors', label: 'Voice actors' },
          { href: '/directory/staff', label: 'Directors and staff' },
          { href: '/directory/studios', label: 'Studios' },
          { href: '/directory/artists', label: 'Song artists' },
          { href: '/directory/watch-orders', label: 'Watch orders' },
        ],
      },
    ],
    // This site's own pages (src/pages/about.astro, contact, privacy, dmca).
    legal: LEGAL,
    blurb: 'When every episode airs, who voices each character, who made the show, its songs and the order to watch it in.',
    credit: 'Anime data from AniList. Opening and ending songs from AnimeThemes.',
  },
  search: {
    description: 'Search every anime, with its episode dates, cast and staff,',
    pageLinks: NAV.map((hub) => ({ href: hub.href, label: hub.label.toLowerCase() })),
    emptyLinks: [
      { href: '/anime', label: 'anime' },
      { href: '/directory/voice-actors', label: 'voice actors' },
      { href: '/directory/studios', label: 'studios' },
    ],
  },
})
