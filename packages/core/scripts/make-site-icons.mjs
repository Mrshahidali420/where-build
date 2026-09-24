#!/usr/bin/env node
/**
 * Draw a site's placeholder brand files from its site.config.mjs: the mark,
 * the wordmark, the favicon and the icons every page and the web manifest
 * name (src/layouts/Base.astro, src/pages/site.webmanifest.js).
 *
 *   cd sites/anime && node ../../packages/core/scripts/make-site-icons.mjs
 *
 * Writes into the site's public/:
 *   logo-mark.svg         the mark alone, in currentColor
 *   logo.svg              the mark and the two-part wordmark, in the palette
 *   favicon.svg           the mark on an accent tile
 *   favicon.ico           the same tile at 32 px (a PNG inside an .ico)
 *   icon-192.png, icon-512.png, apple-touch-icon.png
 *   og-image.png          1200 x 630: wordmark and tagline on the night ground
 *
 * Placeholders only, so a site has no broken icon before its brand is drawn.
 * Once real files are in public/, do not run this again: it overwrites them.
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import sharp from 'sharp'
import config from '../src/lib/site.mjs'

const PUBLIC = join(process.cwd(), 'public')
const { colors, mark, wordmark, tagline } = config

const escape = (text) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const FONT = "Saira, 'Segoe UI', sans-serif"

const markSvg =
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="32" height="32">\n` +
  `  <!-- ${escape(config.name)} mark (placeholder). -->\n  ${mark}\n</svg>\n`

const logoSvg =
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 220 32" width="220" height="32">\n` +
  `  <!-- Full wordmark (placeholder): the mark plus the name. -->\n` +
  `  <g color="${colors.dawn}">${mark}</g>\n` +
  `  <text x="38" y="22.5" font-family="${FONT}" font-size="17" font-weight="800" letter-spacing="0.5" fill="${colors.dawn}">` +
  `${escape(wordmark[0])}<tspan fill="${colors.rose}">${escape(wordmark[1])}</tspan></text>\n</svg>\n`

// The mark sits on a tile of the accent colour, drawn in the night colour.
const tile = (size) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="${size}" height="${size}">\n` +
  `  <rect x="1" y="1" width="30" height="30" rx="6" fill="${colors.rose}"/>\n` +
  `  <g color="${colors.night}" transform="translate(3 3) scale(0.8125)">${mark}</g>\n</svg>\n`

const ogSvg =
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 630" width="1200" height="630">\n` +
  `  <rect width="1200" height="630" fill="${colors.night}"/>\n` +
  `  <rect y="600" width="1200" height="30" fill="${colors.rose}"/>\n` +
  `  <g color="${colors.dawn}" transform="translate(120 205) scale(4.5)">${mark}</g>\n` +
  `  <text x="300" y="320" font-family="${FONT}" font-size="96" font-weight="800" fill="${colors.dawn}">` +
  `${escape(wordmark[0])}<tspan fill="${colors.rose}">${escape(wordmark[1])}</tspan></text>\n` +
  `  <text x="304" y="390" font-family="${FONT}" font-size="36" fill="${colors['dawn-dim']}">${escape(tagline)}</text>\n</svg>\n`

/** One PNG inside an .ico container: every browser since 2012 reads it. */
function icoOf(png) {
  const head = Buffer.alloc(22)
  head.writeUInt16LE(0, 0) // reserved
  head.writeUInt16LE(1, 2) // type: icon
  head.writeUInt16LE(1, 4) // one image
  head.writeUInt8(32, 6) // width
  head.writeUInt8(32, 7) // height
  head.writeUInt16LE(1, 10) // colour planes
  head.writeUInt16LE(32, 12) // bits per pixel
  head.writeUInt32LE(png.length, 14)
  head.writeUInt32LE(22, 18) // the PNG starts right after this header
  return Buffer.concat([head, png])
}

const png = (svg, size, flatten) => {
  const image = sharp(Buffer.from(svg), { density: 72 * (size / 32) }).resize(size, size)
  return (flatten ? image.flatten({ background: colors.night }) : image).png().toBuffer()
}

mkdirSync(PUBLIC, { recursive: true })
writeFileSync(join(PUBLIC, 'logo-mark.svg'), markSvg)
writeFileSync(join(PUBLIC, 'logo.svg'), logoSvg)
writeFileSync(join(PUBLIC, 'favicon.svg'), tile(32))
writeFileSync(join(PUBLIC, 'favicon.ico'), icoOf(await png(tile(32), 32)))
writeFileSync(join(PUBLIC, 'icon-192.png'), await png(tile(192), 192))
writeFileSync(join(PUBLIC, 'icon-512.png'), await png(tile(512), 512))
writeFileSync(join(PUBLIC, 'apple-touch-icon.png'), await png(tile(180), 180, true))
writeFileSync(join(PUBLIC, 'og-image.png'), await sharp(Buffer.from(ogSvg)).png().toBuffer())
console.log(`${config.key}: placeholder logo, favicon and icons written to public/`)
