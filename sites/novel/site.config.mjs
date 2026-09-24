// WhereNovel: who wrote and illustrated a light or web novel, how many volumes
// it has, and how its versions relate (docs/PLAN.md section 2.4).
import { defineSite } from '@sister/core/site'
import { FAMILY } from '../family.mjs'

export default defineSite({
  ...FAMILY,
  key: 'wherenovel',
  name: 'WhereNovel',
  shortName: 'WhereNovel',
  wordmark: ['where', 'novel'],
  tagline: 'Light and web novels, and what they became',
  description:
    'The authors and illustrators of light and web novels, their volume counts, and how each web novel, light novel, manga and anime version of a story relate.',
  // Placeholder mark: a map pin with lines of text.
  mark:
    '<path d="M16 3a9 9 0 0 0-9 9c0 6.6 9 17 9 17s9-10.4 9-17a9 9 0 0 0-9-9Z" fill="none" stroke="currentColor" stroke-width="2.5"></path> ' +
    '<path d="M12 9h8M12 12h8M12 15h5" fill="none" stroke="currentColor" stroke-width="1.8"></path>',

  plannedDomain: 'wherenovel.com',
  workerName: 'wherenovel',

  colors: {
    night: '#10060a',
    'night-raised': '#1f0c14',
    'night-sunk': '#080305',
    cobalt: '#561831',
    'cobalt-line': '#6e2442',
    'cobalt-bright': '#ec9f5f',
    rose: '#62bdf2',
    'rose-soft': '#a9d9f8',
    dawn: '#f8f0e6',
    'dawn-dim': '#c9b9b3',
    'dawn-faint': '#a08d88',
    day: '#ffffff',
  },

  d1: { name: 'wherenovel-analytics', id: null },
  adminSalt: 'wherenovel',
  rebuildUtc: '05:00',

  ownedKinds: [{ kind: 'novel' }],
  entityKinds: ['author', 'illustrator', 'adaptations'],
  gates: [
    { page: '/novel/<slug>', count: 'titles', any: ['volumes', 'author', 'adaptation'] },
    { page: '/author/<slug> and /illustrator/<slug>', count: 'people', min: 2, popular: 5000 },
    { page: '/adaptations/<slug>', count: 'franchises', lineage: true, min: 3 },
  ],

  footer: {
    ...FAMILY.footer,
    blurb: 'Light novels, web novels and every version made from them, from AniList.',
  },
})
