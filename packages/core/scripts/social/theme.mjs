/**
 * How the site's template images look: its colours, its two type faces and
 * its mark, all read from the site's own site.config.mjs (the core never
 * names a site). render/engine.mjs draws with it.
 *
 * The site config names the faces it self-hosts (fonts.self.faces: display
 * first, text second). The images use heavier cuts of the same two families
 * than the pages do, which the same @fontsource packages already carry.
 */
import { join } from 'node:path'
import config from '../../src/lib/site.mjs'

/** "'Unbounded', 'Figtree', ui-sans-serif" -> "Unbounded" */
const firstFamily = (stack) => String(stack || '').split(',')[0].replace(/['"]/g, '').trim()

const WEIGHTS = { displayBold: 700, displayBlack: 900, textRegular: 400, textMedium: 500, textBold: 800 }

const [displayFace, textFace] = config.fonts?.self?.faces || []
const display = firstFamily(config.fonts?.display)
const text = firstFamily(config.fonts?.text)

export const THEME = {
  name: config.name,
  domain: config.domain,
  color: {
    night: config.colors.night,
    raised: config.colors['night-raised'],
    accent: config.colors.rose,
    paper: config.colors.dawn,
  },
  font: { display, text, ...WEIGHTS },
  fonts: [
    displayFace && { name: display, pkg: displayFace.pkg, file: displayFace.file, weights: [WEIGHTS.displayBold, WEIGHTS.displayBlack] },
    textFace && { name: text, pkg: textFace.pkg, file: textFace.file, weights: [WEIGHTS.textRegular, WEIGHTS.textMedium, WEIGHTS.textBold] },
  ].filter(Boolean),
  // The site's own icon: it carries its background, so it sits on any tone.
  mark: { file: join(process.cwd(), 'public', 'favicon.svg'), tones: { dark: null, light: null, accent: null } },
}
