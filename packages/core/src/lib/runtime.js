// REQUEST TIME. What a page needs while it is drawn: its record out of a
// shard (src/lib/shard-read.js does the reading and the retries), the
// Cloudflare runtime, and the 404 and 503 answers.
import config from './site.mjs'

export { ShardUnavailable, loadTitle, loadCharacter, loadRecord } from './shard-read.js'

/** The Cloudflare runtime, whatever Astro version put it there. */
export const envOf = (astro) => astro.locals?.runtime?.env

// Cloudflare stamps every request with the reader's country. It is used to
// pick their own Amazon store. An empty answer is fine: the shop links fall
// back to the US store on their own.
export const countryOf = (astro) => astro.request.headers.get('cf-ipcountry') || ''

/**
 * The real 404 page, with a real 404 status. Astro cannot rewrite to a
 * page that was built as a file, so the file is served directly.
 */
export async function notFound(astro) {
  const env = envOf(astro)
  let body = '<!doctype html><title>Not found</title><h1>Not found</h1>'
  try {
    const res = await env.ASSETS.fetch(new Request('https://assets.local/404.html'))
    if (res.ok || res.status === 404) body = await res.text()
  } catch {
    // fall through to the plain message above
  }
  return new Response(body, {
    status: 404,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      // A 404 must never stick. A title added tomorrow has to work at once,
      // even for a reader whose browser saw the miss today.
      'cache-control': 'no-store',
    },
  })
}

/**
 * The answer when the data could not be read: 503, try again shortly.
 *
 * This is the one status that means "the page exists, the server hiccuped".
 * A crawler keeps the page in its index and comes back; a reader's browser
 * shows the note and a refresh usually works. A 404 here would have told
 * Google the page is gone, which is how real pages fell out of search.
 */
export function unavailable(astro, error) {
  const detail = error instanceof ShardUnavailable ? error.message : 'read failed'
  console.error(`503 ${astro.url?.pathname || ''}: ${detail}`)
  const body =
    '<!doctype html><html lang="en"><head><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<meta name="robots" content="noarchive">' +
    '<title>One moment</title>' +
    `<style>body{font:16px/1.5 system-ui,sans-serif;margin:0;min-height:100vh;display:grid;place-items:center;background:${config.colors.night};color:${config.colors.dawn}}main{max-width:32rem;padding:2rem}h1{font-size:1.4rem;margin:0 0 .5rem}p{margin:0 0 1rem;opacity:.8}a{color:${config.colors.rose}}.brand{display:inline-flex;align-items:center;gap:.5rem;margin-bottom:1.5rem;font-weight:800;font-size:1.2rem;text-decoration:none;color:${config.colors.dawn}}.brand svg{color:${config.colors.rose}}.brand span{color:${config.colors.rose}}</style>` +
    `<link rel="icon" href="/favicon.svg" type="image/svg+xml">` +
    `</head><body><main><a class="brand" href="/"><svg width="28" height="28" viewBox="0 0 32 32" aria-hidden="true">${config.mark}</svg>${config.wordmark[0]}<span>${config.wordmark[1]}</span></a><h1>One moment</h1>` +
    '<p>This page exists, but the data behind it did not load just now. Refresh in a few seconds.</p>' +
    '<p><a href="javascript:location.reload()">Try again</a></p></main></body></html>'
  return new Response(body, {
    status: 503,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'no-store',
      'retry-after': '30',
    },
  })
}
