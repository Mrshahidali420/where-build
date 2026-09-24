// WhereAnime: when an episode airs, who made the show, who voices it, what the
// songs are and what order to watch a franchise in (docs/PLAN.md section 2.1).
import { defineSite } from '@sister/core/site'
import { FAMILY } from '../family.mjs'

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

  d1: { name: 'whereanime-analytics', id: null },
  adminSalt: 'whereanime',
  rebuildUtc: '04:00',

  // Donghua (anime from China and Taiwan) belongs to the manhua site.
  ownedKinds: [{ kind: 'anime', notFrom: ['CN', 'TW'] }],
  entityKinds: ['voice-actor', 'staff', 'studio', 'artist', 'watch-order'],
  gates: [
    { page: '/anime/<slug>', count: 'titles', any: ['episodes'] },
    { page: '/anime/<slug>/episodes', count: 'episodes', min: 13 },
    { page: '/voice-actor/<slug>', count: 'credits', min: 3 },
    { page: '/staff/<slug>', count: 'credits', min: 2 },
    { page: '/studio/<slug>', count: 'studios', min: 2 },
    { page: '/artist/<slug>', count: 'artists', min: 2 },
    { page: '/watch-order/<slug>', count: 'franchises', types: ['ANIME'], min: 3 },
  ],

  footer: {
    ...FAMILY.footer,
    blurb: 'Episode dates, casts, studios and songs for every anime in the catalog, from AniList and AnimeThemes.',
  },
})
