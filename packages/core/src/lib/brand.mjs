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

/** The mark as SVG content for a 0 0 32 32 viewBox: one even-odd path in currentColor. */
export function familyMark(symbol) {
  const cut = FAMILY_SYMBOLS[symbol]
  if (!cut) throw new Error(`familyMark: no symbol "${symbol}" (${Object.keys(FAMILY_SYMBOLS).join(', ')})`)
  return `<path fill="currentColor" fill-rule="evenodd" d="${PIN_PATH} ${cut}"></path>`
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
