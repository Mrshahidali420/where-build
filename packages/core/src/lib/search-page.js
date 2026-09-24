// The full search results page (/search), shared by the core's page and a
// Where site's own. It runs once when a page imports it, and expects the
// markup both pages print: #search-input, #search-summary, #search-results.
// Everything that decides WHAT matches — folding, slice lookup, ranking —
// is shared with the header dropdown. See src/lib/finder-core.js. This
// script only owns how the full page is drawn: the query box, the states
// (hint / loading / empty / error / results), and the grid.
import { runSearch, escapeHtml, coverUrl } from './finder-core.js'
import { searchNoneRow, searchPickRow, sendOwn } from './own-count.js'

const MAX_SHOWN = 200

const input = document.getElementById('search-input')
const summary = document.getElementById('search-summary')
const results = document.getElementById('search-results')

// The browse pages a search that finds nothing points at: the site's own
// (search.pageLinks in its config), filled in at build time by integration.mjs.
const BROWSE_LINKS = import.meta.env.SITE_SEARCH_PAGE_LINKS

function setSummary(text) {
  summary.textContent = text
}

function showHint() {
  setSummary('')
  results.innerHTML =
    '<div class="search-state">Type at least 2 letters to search.</div>'
}

function showLoading() {
  setSummary('Searching…')
  results.innerHTML = '<div class="search-state">Searching…</div>'
}

function showEmpty(query) {
  setSummary(`0 results for “${query}”`)
  results.innerHTML =
    `<div class="search-state">No match for “${escapeHtml(query)}”.<br />` +
    `Browse all ${BROWSE_LINKS}.</div>`
}

function showError(query) {
  setSummary('Search did not load')
  results.innerHTML =
    '<div class="search-state search-state--error">Search did not load. ' +
    '<button type="button" id="search-retry">Try again</button></div>'
  document.getElementById('search-retry').addEventListener('click', () => run(query))
}

// A record is [ title, url, cover file, year, alternate names ].
function cardHtml([title, url, cover, year]) {
  const kind = url.split('/')[1]
  const src = coverUrl(kind, cover, 'medium')
  return (
    `<li class="search-card"><a href="${escapeHtml(url)}">` +
    `<img src="${escapeHtml(src)}" alt="Cover of ${escapeHtml(title)}" loading="lazy" width="230" height="325" decoding="async" />` +
    `<span><b>${escapeHtml(title)}</b><em>${escapeHtml(kind)}${year ? ' · ' + year : ''}</em></span>` +
    `</a></li>`
  )
}

// `partial`: the query only reached a capped file (a very short word such as
// "dr"), so the count is the file's size, not the catalog's. Say that.
function showResults(matches, query, partial) {
  const total = matches.length
  setSummary(
    partial
      ? `The most popular matches for “${query}”. Type more letters to narrow it down.`
      : `${total} result${total === 1 ? '' : 's'} for “${query}”`,
  )
  const shown = matches.slice(0, MAX_SHOWN)
  const note =
    total > MAX_SHOWN && !partial
      ? `<p class="search-note">Showing the first ${MAX_SHOWN} of ${total} results.</p>`
      : ''
  results.innerHTML = `<ul class="search-grid">${shown.map(cardHtml).join('')}</ul>${note}`
}

// `turn` guards against a slow, retried fetch landing after the person has
// already typed a new query and reloaded — same guard the header box uses.
let turn = 0

async function run(q) {
  const mine = ++turn
  const query = q.trim()
  if (!query) return showHint()

  showLoading()
  let outcome
  try {
    outcome = await runSearch(query)
  } catch {
    if (mine !== turn) return
    return showError(query)
  }
  if (mine !== turn) return

  const { needle, matches, partial } = outcome
  if (needle.length < 2) return showHint()
  if (!matches.length) {
    // This page only runs a search that was submitted, so a miss here is a
    // settled one. The words are cleaned before they leave (see /privacy),
    // and one query is counted once however often "Try again" is pressed.
    if (!countedMiss.has(query)) {
      countedMiss.add(query)
      sendOwn(searchNoneRow(query, 'page'))
    }
    return showEmpty(query)
  }
  showResults(matches, query, partial)
}

const countedMiss = new Set()

// Which result was picked, and how far down the grid it sat.
results.addEventListener('click', (event) => {
  const link = event.target.closest && event.target.closest('.search-card a')
  if (!link) return
  const cards = [...results.querySelectorAll('.search-card a')]
  const name = link.querySelector('b')
  sendOwn(searchPickRow(link.getAttribute('href'), 'page', cards.indexOf(link) + 1, name ? name.textContent : ''))
})

const params = new URLSearchParams(location.search)
const q = params.get('q') || ''
input.value = q
if (q.trim()) run(q)
else showHint()
