// The sitemap files themselves: how a list of URLs becomes XML. Pure, so every
// source of URLs (src/lib/sitemap-urls.js for a site built from the catalog,
// src/lib/where-sitemap.js for a Where site) writes the same files.

// Google accepts 50,000 URLs per file. We stay far below that so each file
// downloads fast and a crawler can finish one in a single pass.
export const CHUNK = 5000

/** Split a long list into numbered parts, so no single file is huge. */
export function split(name, urls) {
  if (urls.length <= CHUNK) return urls.length ? [{ name, urls }] : []
  const parts = []
  for (let i = 0; i < urls.length; i += CHUNK) {
    parts.push({ name: `${name}-${parts.length + 1}`, urls: urls.slice(i, i + CHUNK) })
  }
  return parts
}

export const today = () => new Date().toISOString().slice(0, 10)

// A title, a cover URL or a character name can hold a character XML treats as
// markup. One unescaped "&" makes the whole file unparseable, so every value
// that reaches the XML goes through here first.
const xml = (text) =>
  String(text == null ? '' : text)
    .split('&')
    .join('&amp;')
    .split('<')
    .join('&lt;')
    .split('>')
    .join('&gt;')
    .split('"')
    .join('&quot;')
    .split("'")
    .join('&apos;')

/**
 * One <image:image> child per URL that owns a picture.
 *
 * Every cover and every portrait is a real picture people search for by the
 * name of the story. Left alone, Google must find ~107,000 of them by
 * crawling each page. Naming them here hands Google Images the list.
 */
const imageTag = (u) =>
  u.image
    ? `<image:image><image:loc>${xml(u.image)}</image:loc><image:title>${xml(u.caption)}</image:title></image:image>`
    : ''

export function urlsetXml(urls) {
  const day = today()
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${urls
  .map(
    (u) =>
      `  <url><loc>${xml(u.loc)}</loc><lastmod>${day}</lastmod><priority>${u.priority}</priority>${imageTag(u)}</url>`,
  )
  .join('\n')}
</urlset>
`
}
