/**
 * The type pairs a site can wear, each a display face (section names, the
 * wordmark, big numbers) and a text face (everything else), self-hosted from
 * @fontsource under the OFL, Latin and Latin Extended only.
 *
 * A site picks one in its site.config.mjs with a single line:
 *
 *   fonts: fontPair('dela-zen'),
 *
 * Every face named here must be installed in the site's package.json, so the
 * swap is that line and nothing else. The comparison sheet the owner chose
 * from is tasks/font-options.png.
 */

const SUBSETS = ['latin', 'latin-ext']
const STACK = 'ui-sans-serif, system-ui, sans-serif'

/** A text face: regular for reading, 500 and 700 for names and the admin. */
const textFace = (pkg, file) => ({ pkg, file, weights: [400, 500, 700], preload: [400], admin: [500, 700] })
const displayFace = (pkg, file, weight) => ({ pkg, file, weights: [weight], preload: [weight], admin: [] })

export const FONT_PAIRS = {
  // The launch pair. Dela Gothic One is a Japanese poster gothic; Zen Kaku
  // Gothic New is the calm body face from the same tradition.
  'dela-zen': {
    label: 'Dela Gothic One + Zen Kaku Gothic New',
    display: "'Dela Gothic One', 'Zen Kaku Gothic New'",
    text: "'Zen Kaku Gothic New'",
    displayWeight: '400',
    faces: [displayFace('@fontsource/dela-gothic-one', 'dela-gothic-one', 400), textFace('@fontsource/zen-kaku-gothic-new', 'zen-kaku-gothic-new')],
  },
  // A wide, rounded geometric display over a text face with a tall x-height
  // and open shapes, the one that reads best in long dense lists.
  'unbounded-figtree': {
    label: 'Unbounded + Figtree',
    display: "'Unbounded', 'Figtree'",
    text: "'Figtree'",
    displayWeight: '700',
    faces: [displayFace('@fontsource/unbounded', 'unbounded', 700), textFace('@fontsource/figtree', 'figtree')],
  },
  // A contemporary grotesque with some bite over a friendly geometric sans.
  'bricolage-jakarta': {
    label: 'Bricolage Grotesque + Plus Jakarta Sans',
    display: "'Bricolage Grotesque', 'Plus Jakarta Sans'",
    text: "'Plus Jakarta Sans'",
    displayWeight: '800',
    faces: [displayFace('@fontsource/bricolage-grotesque', 'bricolage-grotesque', 800), textFace('@fontsource/plus-jakarta-sans', 'plus-jakarta-sans')],
  },
}

/** A site config's `fonts` for one pair. */
export function fontPair(key) {
  const pair = FONT_PAIRS[key]
  if (!pair) throw new Error(`fontPair: no pair "${key}". Pick one of: ${Object.keys(FONT_PAIRS).join(', ')}`)
  return {
    display: `${pair.display}, ${STACK}`,
    text: `${pair.text}, ${STACK}`,
    displayWeight: pair.displayWeight,
    self: { subsets: [...SUBSETS], faces: pair.faces.map((face) => ({ ...face })) },
  }
}
