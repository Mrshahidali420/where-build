// WhereManhua: Chinese comics and Chinese animation as one fandom, which
// manhua has a donghua and the other way round (docs/PLAN.md section 2.3).
import { defineSite } from '@sister/core/site'
import { FAMILY } from '../family.mjs'

export default defineSite({
  ...FAMILY,
  key: 'wheremanhua',
  name: 'WhereManhua',
  shortName: 'WhereManhua',
  wordmark: ['where', 'manhua'],
  tagline: 'Manhua and donghua, side by side',
  description:
    'Chinese comics and the donghua made from them: creators, studios, seasons and episode dates, and the cultivation and xianxia lines they belong to.',
  // Placeholder mark: a map pin with a jade diamond.
  mark:
    '<path d="M16 3a9 9 0 0 0-9 9c0 6.6 9 17 9 17s9-10.4 9-17a9 9 0 0 0-9-9Z" fill="none" stroke="currentColor" stroke-width="2.5"></path> ' +
    '<path d="M16 7.5 20.5 12 16 16.5 11.5 12Z" fill="currentColor"></path>',

  plannedDomain: 'wheremanhua.com',
  workerName: 'wheremanhua',

  colors: {
    night: '#03100c',
    'night-raised': '#07180f',
    'night-sunk': '#020a07',
    cobalt: '#093a2c',
    'cobalt-line': '#0f4636',
    'cobalt-bright': '#52d6a5',
    rose: '#ebbd33',
    'rose-soft': '#f5da88',
    dawn: '#f2f9f0',
    'dawn-dim': '#b5cabf',
    'dawn-faint': '#89a499',
    day: '#ffffff',
  },

  d1: { name: 'wheremanhua-analytics', id: null },
  adminSalt: 'wheremanhua',
  rebuildUtc: '05:30',

  // Comics from China and Taiwan, and the donghua: anime from the same two.
  ownedKinds: [
    { kind: 'comic', from: ['CN', 'TW'] },
    { kind: 'anime', from: ['CN', 'TW'] },
  ],
  entityKinds: ['creator', 'studio', 'tag'],
  gates: [
    { page: '/manhua/<slug>', count: 'titles', kind: 'comic', any: ['chapters', 'anime', 'author'] },
    { page: '/donghua/<slug>', count: 'titles', kind: 'anime', any: ['episodes'] },
    { page: '/creator/<slug>', count: 'people', min: 2 },
    { page: '/studio/<slug>', count: 'studios', kind: 'anime', min: 2 },
    { page: '/tag/<slug>', count: 'tags', min: 12 },
  ],

  footer: {
    ...FAMILY.footer,
    blurb: 'Manhua, donghua and the people and studios behind them, from AniList.',
  },
})
