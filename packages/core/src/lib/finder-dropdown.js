// The header search box's dropdown, shared by every page shell (Base.astro,
// Where.astro). It runs once when a page imports it. It expects the header
// markup those shells print: #finder, #finder-input, #finder-results and
// #finder-status.
// Header search. The index is cut into slices, so typing "to" downloads
// one small file and nothing else. One slice is a few hundred
// kilobytes; the whole index would be tens of megabytes. A slice stays
// in memory once it has been fetched. The matching/ranking/fetching
// logic itself lives in src/lib/finder-core.js, shared with the full
// results page at /search — see that module for what each piece does
// and why it must agree with the build side.
import {
  fold,
  escapeHtml,
  coverUrl,
  loadManifest,
  isManifestLoaded,
  loadSlice,
  isSliceLoaded,
  longestWord,
  slicePathFor,
  rankMatches,
} from './finder-core.js'
import { noneWatcher, searchPickRow, sendOwn } from './own-count.js'

const input = document.getElementById('finder-input')
const list = document.getElementById('finder-results')
const status = document.getElementById('finder-status')

let active = -1

// Our own counter hears which result was picked, and the words of a
// search that found nothing (cleaned first; see normalizeQuery in
// src/lib/finder-core.js and /privacy). Nothing else typed here leaves
// the browser.
const misses = noneWatcher('dropdown')
function countPick(link) {
  const rows = [...list.querySelectorAll('li[role="option"] a')]
  const name = link.querySelector('b')
  sendOwn(searchPickRow(link.getAttribute('href'), 'dropdown', rows.indexOf(link) + 1, name ? name.textContent : ''))
}

const optionId = (i) => `finder-option-${i}`

function announce(text) {
  status.textContent = text
}

// Nothing to show: hides the box entirely (empty input, or a query
// too short to search on). Distinct from renderEmpty(), which shows a
// "no match" row for a real, completed search.
function clearResults() {
  active = -1
  list.hidden = true
  list.innerHTML = ''
  input.setAttribute('aria-expanded', 'false')
  input.removeAttribute('aria-activedescendant')
  announce('')
}

// A record is [ title, url, cover file, year, alternate names ]. `total`
// is how many rows matched before this was cut down to 8 — the "See
// all" row at the bottom always links to the full /search page, using
// that count, so a query with more matches than the dropdown shows has
// somewhere to go.
function renderResults(matches, query, total) {
  active = -1
  input.removeAttribute('aria-activedescendant')
  const rows = matches
    .map(([title, url, cover, year], i) => {
      const kind = url.split('/')[1]
      const src = coverUrl(kind, cover)
      return `<li id="${optionId(i)}" role="option" aria-selected="false"><a href="${escapeHtml(url)}"><img src="${escapeHtml(src)}" alt="Cover of ${escapeHtml(title)}" loading="lazy" width="34" height="48" /><span><b>${escapeHtml(title)}</b><em>${escapeHtml(kind)}${year ? ' · ' + year : ''}</em></span></a></li>`
    })
    .join('')
  const seeAll = total > 0
    ? `<li class="finder-seeall" role="presentation"><a href="/search?q=${encodeURIComponent(query)}">See all ${total} result${total === 1 ? '' : 's'} for “${escapeHtml(query)}”</a></li>`
    : ''
  list.innerHTML = rows + seeAll
  list.hidden = false
  input.setAttribute('aria-expanded', 'true')
  announce(matches.length === 1 ? '1 result' : `${matches.length} results`)
}

// No rows matched a real, completed search. A dead end with no way
// out reads as a broken box, so point at the browse pages instead.
// Which pages is the site's own choice (search.emptyLinks in its
// config), filled in at build time by integration.mjs.
function renderEmpty(query) {
  active = -1
  input.removeAttribute('aria-activedescendant')
  list.innerHTML =
    `<li class="finder-empty" role="presentation">No match for “${escapeHtml(query)}”. ` +
    `${import.meta.env.SITE_SEARCH_EMPTY}</li>`
  list.hidden = false
  input.setAttribute('aria-expanded', 'true')
  announce('No results')
}

// The slice fetch failed outright (not a 404 — a real network error).
function renderError() {
  active = -1
  input.removeAttribute('aria-activedescendant')
  list.innerHTML =
    '<li class="finder-error" role="presentation">Search did not load. ' +
    '<button type="button" class="finder-retry">Try again</button></li>'
  list.hidden = false
  input.setAttribute('aria-expanded', 'true')
  announce('Search did not load')
  // stopPropagation: search() replaces this button, and the page-wide
  // click handler would then see a detached target and close the box.
  list.querySelector('.finder-retry').addEventListener('click', (e) => {
    e.stopPropagation()
    search(input.value.trim())
  })
}

// Ranking and slice lookup are shared with /search — see
// src/lib/finder-core.js. This wraps that with the dropdown's own
// loading/error UI and its 8-row cap.
//
// `turn` guards against a slow slice landing after the person has typed
// on. Only the newest search is allowed to draw.
let turn = 0

async function search(q) {
  const needle = fold(q)
  // Bump `turn` unconditionally, before any early return below.
  // Otherwise a short query that bails out immediately never
  // invalidates a slower fetch already in flight for a previous,
  // longer query — and that stale slice can render under this short
  // query once it lands.
  const mine = ++turn

  if (needle.length < 2) return clearResults()

  const word = longestWord(needle)
  if (!word) return renderEmpty(q)

  // The manifest and the first search for a slice both download
  // something. On a phone that is a few hundred milliseconds of
  // nothing, which reads as a broken box. Say what is happening
  // instead, whichever of the two is still in flight.
  if (!isManifestLoaded()) {
    list.innerHTML = '<li class="finder-wait" role="presentation">Searching…</li>'
    list.hidden = false
    input.setAttribute('aria-expanded', 'true')
  }

  let splitPrefixes
  try {
    splitPrefixes = await loadManifest()
  } catch {
    if (mine !== turn) return
    return renderError()
  }
  if (mine !== turn) return

  const prefix = slicePathFor(needle, splitPrefixes)
  if (!isSliceLoaded(prefix)) {
    list.innerHTML = '<li class="finder-wait" role="presentation">Searching…</li>'
    list.hidden = false
    input.setAttribute('aria-expanded', 'true')
  }

  let rows
  try {
    rows = await loadSlice(prefix)
  } catch {
    if (mine !== turn) return
    return renderError()
  }
  if (mine !== turn) return

  const matched = rankMatches(rows, needle)
  misses.saw(q, matched.length > 0)
  if (!matched.length) renderEmpty(q)
  else renderResults(matched.slice(0, 8), q, matched.length)
}

function highlight(delta) {
  const rows = list.querySelectorAll('li[role="option"]')
  if (!rows.length) return
  if (active >= 0) rows[active].setAttribute('aria-selected', 'false')
  active = (active + delta + rows.length) % rows.length
  rows.forEach((row, i) => row.classList.toggle('is-active', i === active))
  rows[active].setAttribute('aria-selected', 'true')
  input.setAttribute('aria-activedescendant', rows[active].id)
  rows[active].scrollIntoView({ block: 'nearest' })
}

input.addEventListener('input', () => search(input.value.trim()))
input.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowDown') {
    e.preventDefault()
    highlight(1)
  }
  if (e.key === 'ArrowUp') {
    e.preventDefault()
    highlight(-1)
  }
  if (e.key === 'Enter') {
    // A highlighted row (arrowed to, by hand): open it, same as a
    // click. Nothing highlighted: let the surrounding <form
    // role="search"> submit natively to /search?q=... — that also
    // makes the phone keyboard's Go/search key work with no JS at
    // all. Guard only the too-short case, so Enter on an empty or
    // 1-letter box does not send the reader to a query-less page.
    const rows = list.querySelectorAll('li[role="option"] a')
    const pick = active >= 0 ? rows[active] : null
    if (pick) {
      e.preventDefault()
      countPick(pick)
      location.href = pick.href
      return
    }
    if (fold(input.value.trim()).length < 2) e.preventDefault()
  }
  if (e.key === 'Escape') clearResults()
})
input.addEventListener('blur', () => misses.flush())
list.addEventListener('click', (e) => {
  const link = e.target.closest && e.target.closest('li[role="option"] a')
  if (link) countPick(link)
})
document.addEventListener('click', (e) => {
  if (!document.getElementById('finder').contains(e.target)) clearResults()
})
