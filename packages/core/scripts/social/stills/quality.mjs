/**
 * Is a still good enough to post? Each one is looked at, small:
 *
 *   size        at least MIN_WIDTH wide (a 1080 px post shows it nearly whole)
 *   dark        not mostly black (a fade, a night scene with nothing in it)
 *   letterbox   no black bars at the top and the bottom
 *   soft        sharp enough (the spread of a Laplacian, sharp's own measure)
 *
 * and a fingerprint (a difference hash) lets near-identical stills of one
 * show be told apart, so a post never shows the same frame twice.
 */
export const MIN_WIDTH = 960
const PROBE = { width: 256, edge: 0.08 }
const DARK_MEAN = 35
const BAR_MEAN = 20
/** sharp's sharpness of the still at 960 px: below this it looks soft on a phone. */
export const MIN_SHARPNESS = 0.45
/** Two stills whose fingerprints differ in fewer bits than this are the same frame. */
export const SAME_FRAME_BITS = 6

const meanOf = (data, width, from, to) => {
  let sum = 0
  for (let i = from * width; i < to * width; i += 1) sum += data[i]
  return sum / Math.max(1, (to - from) * width)
}

/** Why a still may not be used, or null; with its shape and fingerprint when it may. */
export async function judgeStill(bytes, sharp) {
  const meta = await sharp(bytes).metadata()
  if (!meta.width || meta.width < MIN_WIDTH) return { reason: `too small (${meta.width || 0} px wide)` }
  const { data, info } = await sharp(bytes).greyscale().resize(PROBE.width).raw().toBuffer({ resolveWithObject: true })
  const rows = info.height
  const edge = Math.max(1, Math.round(rows * PROBE.edge))
  if (meanOf(data, info.width, 0, rows) < DARK_MEAN) return { reason: 'mostly black' }
  if (meanOf(data, info.width, 0, edge) < BAR_MEAN && meanOf(data, info.width, rows - edge, rows) < BAR_MEAN) return { reason: 'black bars' }
  const { sharpness } = await sharp(bytes).resize(MIN_WIDTH).stats()
  if (sharpness < MIN_SHARPNESS) return { reason: `soft (${sharpness.toFixed(2)})` }
  return { reason: null, ratio: meta.width / meta.height, hash: await fingerprint(bytes, sharp) }
}

/** A 64-bit difference hash, as 16 hex digits. */
export async function fingerprint(bytes, sharp) {
  const { data } = await sharp(bytes).greyscale().resize(9, 8, { fit: 'fill' }).raw().toBuffer({ resolveWithObject: true })
  let bits = ''
  for (let y = 0; y < 8; y += 1) for (let x = 0; x < 8; x += 1) bits += data[y * 9 + x] > data[y * 9 + x + 1] ? '1' : '0'
  return BigInt(`0b${bits}`).toString(16).padStart(16, '0')
}

/** How many bits two fingerprints differ in. */
export function distance(a, b) {
  let x = BigInt(`0x${a}`) ^ BigInt(`0x${b}`)
  let n = 0
  while (x) {
    n += Number(x & 1n)
    x >>= 1n
  }
  return n
}

/** The stills with no near-twin before them. */
export const distinct = (stills) => stills.filter((s, i) => !stills.slice(0, i).some((t) => distance(s.hash, t.hash) < SAME_FRAME_BITS))
