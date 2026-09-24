// WhereManga: who made a manga and how it ran, from first chapter to last
// volume, and what it became (docs/PLAN.md section 2.2).
import { defineSite } from '@sister/core/site'
import { FAMILY } from '../family.mjs'

export default defineSite({
  ...FAMILY,
  key: 'wheremanga',
  name: 'WhereManga',
  shortName: 'WhereManga',
  wordmark: ['where', 'manga'],
  tagline: 'Who made it, and how it ran',
  description:
    'The mangaka behind every series, how long each one ran and in how many volumes, whether it is finished, and every spin-off and adaptation.',
  // Placeholder mark: a map pin with a comic panel.
  mark:
    '<path d="M16 3a9 9 0 0 0-9 9c0 6.6 9 17 9 17s9-10.4 9-17a9 9 0 0 0-9-9Z" fill="none" stroke="currentColor" stroke-width="2.5"></path> ' +
    '<path d="M12.5 8.5h7v7h-7Z" fill="currentColor"></path>',

  plannedDomain: 'wheremanga.com',
  workerName: 'wheremanga',

  colors: {
    night: '#0b0908',
    'night-raised': '#151110',
    'night-sunk': '#060504',
    cobalt: '#103338',
    'cobalt-line': '#163f44',
    'cobalt-bright': '#5ec9c4',
    rose: '#f46c4d',
    'rose-soft': '#f8ab97',
    dawn: '#f8f3ea',
    'dawn-dim': '#c2baad',
    'dawn-faint': '#9b9285',
    day: '#ffffff',
  },

  d1: { name: 'wheremanga-analytics', id: null },
  adminSalt: 'wheremanga',
  rebuildUtc: '04:30',

  // Japanese comics and every other country manhwaindex files under /manga:
  // everything but Korea (manhwa) and China and Taiwan (the manhua site).
  ownedKinds: [{ kind: 'comic', notFrom: ['KR', 'CN', 'TW'] }],
  entityKinds: ['author', 'artist', 'series'],
  gates: [
    { page: '/manga/<slug>', count: 'titles', any: ['popularity', 'chapters', 'volumes', 'author'], popularity: 300 },
    { page: '/author/<slug> and /artist/<slug>', count: 'people', min: 2, popular: 5000 },
    { page: '/series/<slug>', count: 'franchises', types: ['MANGA'], min: 3 },
  ],

  footer: {
    ...FAMILY.footer,
    blurb: 'Authors, artists, publication runs and adaptations for every manga in the catalog, from AniList.',
  },
})
