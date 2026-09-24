#!/usr/bin/env node
/**
 * Draw a site's brand files from its site.config.mjs: the mark, the wordmark,
 * the favicons, the app icons and the default share image, every one from the
 * same shapes (src/lib/brand.mjs for the family mark, the site's own display
 * face for the wordmark, turned into outlines so no file depends on a font
 * being installed).
 *
 *   cd sites/anime && node ../../packages/core/scripts/make-site-icons.mjs [--sheet <file.png>]
 *
 * Writes into the site's public/:
 *   logo-mark.svg          the mark alone, in the accent colour
 *   logo.svg               mark and wordmark for a dark ground
 *   logo-light.svg         mark and wordmark for a light ground
 *   favicon.svg            the mark on a night tile
 *   favicon.ico            the tile at 16, 32 and 48 px (PNGs inside one .ico)
 *   icon-192.png, icon-512.png           app icons (rounded tile)
 *   icon-maskable-512.png                full-bleed, mark inside the safe zone
 *   apple-touch-icon.png                 180 px, full-bleed (iOS rounds it)
 *   og-image.png           1200 x 630: mark, wordmark and tagline
 * With --sheet, also a brand sheet PNG showing all of it at a glance.
 *
 * Needs the site's fonts (@fontsource, the config's fonts.self) and fontkitten,
 * which Astro already installs.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import sharp from 'sharp'
import config from '../src/lib/site.mjs'
import { tileSvg, familyMark, FAMILY_SYMBOLS } from '../src/lib/brand.mjs'

const PUBLIC = join(process.cwd(), 'public')
const require = createRequire(join(process.cwd(), 'package.json'))
const { colors, mark, wordmark, tagline } = config
const accent = colors.rose

/** A font from the site's own @fontsource faces, as outlines. */
async function loadFont(face, weight) {
  const { create } = await import('fontkitten')
  const dir = dirname(require.resolve(`${face.pkg}/package.json`))
  return create(readFileSync(join(dir, 'files', `${face.file}-latin-${weight}-normal.woff`)))
}

/** Text as outlined paths: { svg, width } at `size` px, baseline at y = 0, starting at x = 0. */
function outline(font, text, size, fill, tracking = 0) {
  const scale = size / font.unitsPerEm
  let pen = 0
  const parts = []
  for (const ch of text) {
    const glyph = font.glyphForCodePoint(ch.codePointAt(0))
    const d = glyph.path.toSVG()
    if (d) parts.push(`<path transform="translate(${pen.toFixed(2)} 0) scale(${scale.toFixed(5)} ${(-scale).toFixed(5)})" d="${d}"/>`)
    pen += glyph.advanceWidth * scale + tracking
  }
  return { svg: `<g fill="${fill}">${parts.join('')}</g>`, width: pen - tracking }
}

/** The two-part wordmark, "where" + site word, the second in `second`. */
function wordmarkSvg(font, size, first, second) {
  const a = outline(font, wordmark[0], size, first)
  const b = outline(font, wordmark[1], size, second)
  return { svg: `${a.svg}<g transform="translate(${a.width.toFixed(2)} 0)">${b.svg}</g>`, width: a.width + b.width }
}

/** Mark + wordmark on one line, sized by the wordmark's cap height. */
function lockup(font, { first, second, markColor }) {
  const size = 40
  const words = wordmarkSvg(font, size, first, second)
  const markSize = 44
  const gap = 12
  const width = Math.ceil(markSize + gap + words.width + 2)
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} 48" width="${width}" height="48">` +
    `<title>${config.name}</title>` +
    `<g color="${markColor}" transform="translate(0 2) scale(${markSize / 32})">${mark}</g>` +
    `<g transform="translate(${markSize + gap} 36)">${words.svg}</g>` +
    `</svg>\n`
  )
}

/** Wrap words into lines no wider than `max` px at `size`. */
function wrap(font, text, size, max) {
  const lines = []
  let line = ''
  for (const word of text.split(' ')) {
    const next = line ? `${line} ${word}` : word
    if (line && outline(font, next, size, '').width > max) {
      lines.push(line)
      line = word
    } else line = next
  }
  if (line) lines.push(line)
  return lines
}

function ogSvg(display, text) {
  const words = wordmarkSvg(display, 100, colors.dawn, accent)
  const scale = Math.min(1, 640 / words.width)
  const lines = wrap(text, tagline, 36, 640)
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 630" width="1200" height="630">` +
    `<defs><radialGradient id="glow" cx="0.18" cy="0.95" r="0.9"><stop offset="0" stop-color="${colors.cobalt}" stop-opacity="0.95"/>` +
    `<stop offset="0.55" stop-color="${colors.cobalt}" stop-opacity="0.25"/><stop offset="1" stop-color="${colors.night}" stop-opacity="0"/></radialGradient></defs>` +
    `<rect width="1200" height="630" fill="${colors.night}"/><rect width="1200" height="630" fill="url(#glow)"/>` +
    `<g color="${accent}" transform="translate(96 150) scale(10)">${mark}</g>` +
    `<g transform="translate(456 300) scale(${scale.toFixed(4)})">${words.svg}</g>` +
    lines.map((line, i) => `<g transform="translate(460 ${372 + i * 50})">${outline(text, line, 36, colors['dawn-dim']).svg}</g>`).join('') +
    `<rect x="0" y="618" width="1200" height="12" fill="${accent}"/>` +
    `</svg>`
  )
}

/** PNGs inside one .ico container (every browser since 2012 reads PNG icons). */
function icoOf(pngs) {
  const head = Buffer.alloc(6 + 16 * pngs.length)
  head.writeUInt16LE(0, 0)
  head.writeUInt16LE(1, 2)
  head.writeUInt16LE(pngs.length, 4)
  let offset = head.length
  pngs.forEach(({ size, data }, i) => {
    const at = 6 + 16 * i
    head.writeUInt8(size >= 256 ? 0 : size, at)
    head.writeUInt8(size >= 256 ? 0 : size, at + 1)
    head.writeUInt16LE(1, at + 4)
    head.writeUInt16LE(32, at + 6)
    head.writeUInt32LE(data.length, at + 8)
    head.writeUInt32LE(offset, at + 12)
    offset += data.length
  })
  return Buffer.concat([head, ...pngs.map((p) => p.data)])
}

const png = (svg, size) => sharp(Buffer.from(svg), { density: Math.max(72, 72 * (size / 32)) }).resize(size, size).png().toBuffer()

const displayFace = config.fonts.self.faces[0]
const textFace = config.fonts.self.faces[1] || displayFace
const display = await loadFont(displayFace, displayFace.weights[0])
const text = await loadFont(textFace, textFace.weights.includes(500) ? 500 : textFace.weights[0])

const tile = (size, options = {}) => tileSvg(mark, { size, ground: colors.night, ink: accent, ...options })
const files = {
  'logo-mark.svg': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="32" height="32"><title>${config.name}</title><g color="${accent}">${mark}</g></svg>\n`,
  'logo.svg': lockup(display, { first: colors.dawn, second: accent, markColor: accent }),
  'logo-light.svg': lockup(display, { first: colors.night, second: colors.cobalt, markColor: colors.cobalt }),
  'favicon.svg': `${tile(32)}\n`,
}
mkdirSync(PUBLIC, { recursive: true })
for (const [name, body] of Object.entries(files)) writeFileSync(join(PUBLIC, name), body)

const icoSizes = [16, 32, 48]
const ico = await Promise.all(icoSizes.map(async (size) => ({ size, data: await png(tile(size, size <= 16 ? { inset: 0.92, radius: 6 } : {}), size) })))
writeFileSync(join(PUBLIC, 'favicon.ico'), icoOf(ico))
writeFileSync(join(PUBLIC, 'icon-192.png'), await png(tile(192), 192))
writeFileSync(join(PUBLIC, 'icon-512.png'), await png(tile(512), 512))
writeFileSync(join(PUBLIC, 'icon-maskable-512.png'), await png(tile(512, { radius: 0, inset: 0.6 }), 512))
writeFileSync(join(PUBLIC, 'apple-touch-icon.png'), await png(tile(180, { radius: 0, inset: 0.7 }), 180))
const og = await sharp(Buffer.from(ogSvg(display, text))).png().toBuffer()
writeFileSync(join(PUBLIC, 'og-image.png'), og)
console.log(`${config.key}: logo, favicons, app icons and share image written to public/`)

const sheetAt = process.argv.indexOf('--sheet')
if (sheetAt > 0) {
  const out = process.argv[sheetAt + 1]
  const W = 1400
  const H = 980
  const label = (x, y, words) => `<g transform="translate(${x} ${y})">${outline(text, words, 18, colors['dawn-faint']).svg}</g>`
  const embed = (name) => `data:image/svg+xml;base64,${Buffer.from(files[name]).toString('base64')}`
  const sheet =
    `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">` +
    `<rect width="${W}" height="${H}" fill="${colors['night-sunk']}"/>` +
    `<g color="${accent}" transform="translate(60 70) scale(7.5)">${mark}</g>` +
    label(60, 330, 'The mark') +
    Object.keys(FAMILY_SYMBOLS)
      .map((symbol, i) => `<g color="${familyMark(symbol) === mark ? accent : colors['dawn-dim']}" transform="translate(${760 + i * 150} 450) scale(3.5)">${familyMark(symbol)}</g>`)
      .join('') +
    label(760, 590, 'The family: one pin, one symbol per site') +
    `<rect x="420" y="60" width="920" height="120" rx="16" fill="${colors.night}"/>` +
    `<image x="460" y="84" width="${Math.round((72 / 48) * 400)}" height="72" href="${embed('logo.svg')}"/>` +
    `<rect x="420" y="200" width="920" height="120" rx="16" fill="#f7f4ee"/>` +
    `<image x="460" y="224" width="${Math.round((72 / 48) * 400)}" height="72" href="${embed('logo-light.svg')}"/>` +
    label(420, 350, 'Wordmark on dark and on light grounds') +
    label(60, 420, 'Favicon at 16, 32 and 48 px, and the app icons') +
    label(60, 930, 'Default share image, 1200 x 630') +
    `</svg>`
  const icons = await Promise.all([
    ...ico.map((i, n) => ({ input: i.data, left: 60 + n * 70, top: 450 })),
    { input: await png(tile(192), 120), left: 280, top: 450 },
    { input: await png(tile(512, { radius: 0, inset: 0.6 }), 120), left: 420, top: 450 },
    { input: await png(tile(180, { radius: 0, inset: 0.7 }), 120), left: 560, top: 450 },
    { input: await sharp(og).resize(600, 315).png().toBuffer(), left: 60, top: 590 },
  ])
  await sharp(Buffer.from(sheet)).composite(icons).png().toFile(out)
  console.log(`brand sheet written to ${out}`)
}
