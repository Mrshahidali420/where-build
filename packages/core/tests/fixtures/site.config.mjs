// The site the tests run as. Every value is made up: example.com, no real ids,
// so a test that passes here proves nothing about any one real site's ids.
import { defineSite } from '../../src/lib/define-site.mjs'
import { ALL_ROUTES } from '../../src/lib/routes.mjs'

export default defineSite({
  key: 'fixture',
  name: 'Fixture Index',
  shortName: 'Fixture',
  wordmark: ['fixture', 'index'],
  tagline: 'Where to find it, legally',
  description: 'A made-up site for the tests.',
  mark: '<path d="M4 4h24v24H4Z" fill="currentColor"></path>',

  domain: 'example.com',
  plannedDomain: null,
  workerName: 'fixture',
  workersSubdomain: 'tests',

  email: 'hello@example.com',
  dmcaEmail: 'dmca@example.com',
  ga4Id: null,
  adsensePub: null,
  turnstileSiteKey: null,
  amazon: { stores: { us: 'fixture-tag', uk: '', de: '', fr: '', it: '', es: '', ca: '', jp: '' } },
  indexNow: { key: null },

  colors: {
    night: '#101010',
    'night-raised': '#181818',
    'night-sunk': '#080808',
    cobalt: '#203060',
    'cobalt-line': '#304070',
    'cobalt-bright': '#6080e0',
    rose: '#e06080',
    'rose-soft': '#f0a0b0',
    dawn: '#f0f0f0',
    'dawn-dim': '#b0b0b0',
    'dawn-faint': '#909090',
    day: '#ffffff',
  },
  fonts: {
    stylesheet: 'https://fonts.example.com/css',
    adminStylesheet: 'https://fonts.example.com/admin.css',
    display: 'serif',
    text: 'sans-serif',
  },

  d1: { name: 'fixture-analytics', id: null },
  cron: ['10 0 * * *'],
  r2: { catalogBucket: 'fixture-catalog', catalogWrite: false, dataBucket: null },
  adminSalt: 'fixture',
  rebuildUtc: '03:00',

  ownedKinds: [{ kind: 'comic' }, { kind: 'novel' }, { kind: 'anime' }],
  routes: ALL_ROUTES,
  entityKinds: [],
  gates: [],
  sisterSites: {},
  dev: { blockBots: true },
  malExtras: false,

  nav: [{ href: '/manga', label: 'Manga' }],
  footer: { blurb: 'Made up.', browse: [{ href: '/manga', label: 'Manga' }], bar: 'Tests only.' },
  dock: [{ href: '/', label: 'Home', icon: 'home' }],
  search: { emptyLinks: [{ href: '/manga', label: 'manga' }] },
})
