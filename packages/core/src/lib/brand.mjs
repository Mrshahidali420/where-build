/**
 * The Where family mark: one shape for every Where site, one symbol per site.
 *
 * The shape is a map pin, the "where" of the name: a round head on a short
 * point. Each site cuts its own symbol out of the head (a play button for
 * anime, an open book for manga, a brush stroke for manhua, lines of text for
 * novels), so the family reads as one set and each site is told apart by its
 * symbol and its colour alone. A new sister needs only
 *
 *     mark: familyMark('book')
 *
 * A site may take the screen shape instead of the pin (WhereAnime does:
 * familyMark('play', 'screen')); the symbol is moved to the screen's middle.
 *
 * in its site.config.mjs and its own colours; scripts/make-site-icons.mjs
 * draws every icon, the wordmark and the share image from the same shapes.
 *
 * The symbol is a hole (even-odd fill), not a second colour: the mark is a
 * single path in currentColor, so it takes whatever colour the page gives it
 * and the ground shows through the symbol on dark and light alike.
 *
 * Drawn on a 32 x 32 grid. Pure strings, no dependencies.
 */

/** The pin: a head of radius 11 centred at (16, 13), narrowing to a point at y = 30. */
export const PIN_PATH =
  'M16 2a11 11 0 0 1 11 11c0 7.6-7.7 13.9-10.1 16.9a1.15 1.15 0 0 1-1.8 0C12.7 26.9 5 20.6 5 13A11 11 0 0 1 16 2Z'

/**
 * The screen: a rounded TV screen whose bottom edge drops into the pin's
 * point, with the small camera dot in its top right corner cut out. The
 * "where" is the point, the "watch" is the screen. Chosen for WhereAnime on
 * 25 Sep 2026; it reads at 16 px where the pin's round head blurs.
 */
export const SCREEN_PATH =
  'M7 3.5h18a5 5 0 0 1 5 5v11a5 5 0 0 1-5 5h-5.6l-2.6 3.8a1 1 0 0 1-1.6 0l-2.6-3.8H7a5 5 0 0 1-5-5v-11a5 5 0 0 1 5-5Z' +
  ' M25.2 6.7a1.4 1.4 0 1 1 0 2.8a1.4 1.4 0 1 1 0-2.8Z'

const SHAPES = { pin: PIN_PATH, screen: SCREEN_PATH }

/** The symbols a site cuts out of the head. Each sits inside the circle of radius 7 around (16, 13). */
export const FAMILY_SYMBOLS = {
  // A play button, nudged right of centre so it looks centred.
  play: 'M13.3 8.4a0.9 0.9 0 0 1 1.35-0.78l7.2 4.6a0.9 0.9 0 0 1 0 1.56l-7.2 4.6a0.9 0.9 0 0 1-1.35-0.78Z',
  // An open book: two pages meeting at the spine.
  book: 'M9.8 9.4c2.4-0.4 4.4 0 5.4 1.1v7.6c-1-0.9-3-1.2-5.4-0.8ZM22.2 9.4c-2.4-0.4-4.4 0-5.4 1.1v7.6c1-0.9 3-1.2 5.4-0.8Z',
  // One brush stroke, thick at the press and thin at the lift.
  brush: 'M10.6 17.8c2.6-5.6 6.4-9.2 11-10.4-2.4 3.4-5 7.6-8.4 10.9-0.9 0.8-2 0.7-2.6-0.5Z',
  // Three lines of text, the last one short.
  lines: 'M10 9h12v2.2H10ZM10 12.4h12v2.2H10ZM10 15.8h7.5V18H10Z',
}

/**
 * The mark as SVG content for a 0 0 32 32 viewBox: one even-odd path in
 * currentColor. `shape` is 'pin' (the family default) or 'screen'.
 */
export function familyMark(symbol, shape = 'pin') {
  const cut = FAMILY_SYMBOLS[symbol]
  if (!cut) throw new Error(`familyMark: no symbol "${symbol}" (${Object.keys(FAMILY_SYMBOLS).join(', ')})`)
  const outline = SHAPES[shape]
  if (!outline) throw new Error(`familyMark: no shape "${shape}" (${Object.keys(SHAPES).join(', ')})`)
  // The screen's play sits a touch lower and left than the pin's, in the middle of the screen.
  const symbolPath = shape === 'screen' ? shiftPath(cut, -0.5, 1) : cut
  return `<path fill="currentColor" fill-rule="evenodd" d="${outline} ${symbolPath}"></path>`
}

/** Which shape a mark was drawn with. */
export const shapeOf = (mark) => (mark.includes(SCREEN_PATH) ? 'screen' : 'pin')

/**
 * Moves a symbol path. The symbols use only absolute M, H and V besides
 * relative commands, so moving those three moves the whole shape.
 */
function shiftPath(d, dx, dy) {
  const at = (n, by) => +(Number(n) + by).toFixed(2)
  return d
    .replace(/M([\d.]+) ([\d.]+)/g, (_, x, y) => `M${at(x, dx)} ${at(y, dy)}`)
    .replace(/H([\d.]+)/g, (_, x) => `H${at(x, dx)}`)
    .replace(/V([\d.]+)/g, (_, y) => `V${at(y, dy)}`)
}

/**
 * The mark on a square tile, for favicons and app icons: the pin in `ink`
 * on a `ground` tile. `inset` is how much of the tile the pin's height fills
 * (a maskable icon keeps it inside the middle 80 %, so it asks for less).
 */
export function tileSvg(mark, { size = 32, ground, ink, radius = 7, inset = 0.84 }) {
  // The pin is 22 wide and 28 tall on the 32 grid; scale it to fill `inset` of the height, centred.
  const scale = (32 * inset) / 28
  const shift = (16 - 16 * scale).toFixed(3)
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="${size}" height="${size}">` +
    `<rect width="32" height="32" rx="${radius}" fill="${ground}"/>` +
    `<g color="${ink}" transform="translate(${shift} ${shift}) scale(${scale.toFixed(4)})">${mark}</g>` +
    `</svg>`
  )
}
