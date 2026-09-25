// The /my-list page's behaviour, shared by every site's own page markup (the
// home site's src/pages/my-list.astro and a Where site's). It reads the
// reader's list from their browser (my-list.js), the live facts of each title
// from the list rows (list-data.js), and draws tabs, cards, news and the
// AniList import. The page supplies the elements by class name. Browser only.
import { openStore, statusLabel, STATUSES, pathOfEntry, track } from './my-list.js'
import { loadRows } from './list-data.js'
import { reconcile, thisWeek, alertText } from './feed-core.js'
import { ROW } from './list-row.js'
import { phrase } from './countdown-core.js'
import { fetchAniList, matchEntries, ImportError } from './anilist-import.js'

const store = openStore()
const $ = (selector) => document.querySelector(selector)

const SECTION_WORD = { manhwa: 'Manhwa', manga: 'Manga', manhua: 'Manhua', novel: 'Novel', anime: 'Anime' }
const RELEASE_WORD = {
  RELEASING: 'Ongoing',
  FINISHED: 'Finished',
  NOT_YET_RELEASED: 'Not out yet',
  HIATUS: 'On hiatus',
  CANCELLED: 'Cancelled',
}

// Everything is built with textContent, never innerHTML: list names and
// titles come from the reader or from AniList, and must never run as code.
function el(tag, props = {}, ...children) {
  const node = document.createElement(tag)
  for (const [key, value] of Object.entries(props)) {
    if (value === undefined || value === null || value === false) continue
    if (key === 'text') node.textContent = value
    else if (key === 'class') node.className = value
    else node.setAttribute(key, value === true ? '' : String(value))
  }
  for (const child of children) if (child) node.append(child)
  return node
}

const say = (node, text) => {
  node.textContent = text || ''
}
const nowSec = () => Math.floor(Date.now() / 1000)

// Which tab is open: 'all' or a list id. Kept in the address, so a reload
// or a shared bookmark lands on the same list.
let current = new URLSearchParams(location.search).get('list') || 'all'
// Facts from the list rows, once they arrive. Until then cards draw from
// what the list itself remembers.
let rows = new Map()
// Ids whose shard file loaded, found or not.
let checked = new Set()

const msg = $('.ml-msg')
const warnIfUnsaved = (result) => {
  if (result && result.saved === false) $('.ml-blocked').hidden = false
}

// ---------------------------------------------------------------- tabs

function drawTabs(state) {
  const bar = $('.ml-tabs')
  bar.replaceChildren()
  if (current !== 'all' && !state.lists.some((l) => l.id === current)) current = 'all'
  const tabs = [
    { id: 'all', name: 'All', size: Object.keys(state.titles).length },
    ...state.lists.map((l) => ({ id: l.id, name: l.name, size: l.ids.length })),
  ]
  for (const tab of tabs) {
    const on = tab.id === current
    const button = el(
      'button',
      {
        type: 'button',
        role: 'tab',
        class: 'ml-tab',
        'aria-selected': on ? 'true' : 'false',
        'aria-controls': 'ml-panel',
        tabindex: on ? '0' : '-1',
        'data-tab': tab.id,
      },
      el('span', { text: tab.name }),
      el('em', { text: String(tab.size) })
    )
    button.addEventListener('click', () => select(tab.id))
    bar.append(button)
  }
}

function select(id, focus = true) {
  current = id
  try {
    const url = new URL(location.href)
    if (id === 'all') url.searchParams.delete('list')
    else url.searchParams.set('list', id)
    history.replaceState(null, '', url)
  } catch (e) {
    // An address that cannot change is fine; the tab still opens.
  }
  closeForms()
  draw(store.get())
  if (focus) document.querySelector(`.ml-tab[data-tab="${CSS.escape(id)}"]`)?.focus()
}

// Arrow keys move along the tabs, as a tab list should.
$('.ml-tabs').addEventListener('keydown', (event) => {
  const tabs = [...document.querySelectorAll('.ml-tab')]
  const at = tabs.indexOf(document.activeElement)
  if (at < 0) return
  let to = null
  if (event.key === 'ArrowRight') to = (at + 1) % tabs.length
  if (event.key === 'ArrowLeft') to = (at - 1 + tabs.length) % tabs.length
  if (event.key === 'Home') to = 0
  if (event.key === 'End') to = tabs.length - 1
  if (to === null) return
  event.preventDefault()
  select(tabs[to].dataset.tab)
})

// ---------------------------------------------------------------- cards

function factsLine(entry) {
  const row = rows.get(entry.id)
  const bits = [SECTION_WORD[entry.ns] || entry.ns]
  if (row) {
    if (RELEASE_WORD[row[ROW.STATUS]]) bits.push(RELEASE_WORD[row[ROW.STATUS]])
    const sites = row[ROW.SITES] || []
    if (sites.length) bits.push(`on ${sites.join(', ')}`)
    else bits.push('no official link yet')
  }
  return bits.join(' · ')
}

function card(entry, state) {
  // Only a title whose shard really loaded and still lacks it is gone.
  const gone = checked.has(entry.id) && !rows.has(entry.id)
  const cover = entry.cover
    ? el('img', { src: entry.cover, alt: '', width: '46', height: '66', loading: 'lazy', decoding: 'async' })
    : el('span', { class: 'ml-item__nocover', 'aria-hidden': 'true' })
  const titleNode = gone
    ? el('span', { class: 'ml-item__title', text: entry.title })
    : el('a', { class: 'ml-item__title', href: pathOfEntry(entry), text: entry.title })

  const body = el('div', { class: 'ml-item__body' }, titleNode, el('p', { class: 'ml-item__facts', text: factsLine(entry) }))
  if (gone) body.append(el('span', { class: 'ml-badge', text: 'No longer in the index' }))
  const row = rows.get(entry.id)
  if (row && row[ROW.NEXT_AT] > nowSec()) {
    const num = row[ROW.NEXT_NUM]
    body.append(
      el('p', {
        class: 'ml-item__next',
        text: `${num ? `Episode ${num}` : 'Next episode'} ${phrase(row[ROW.NEXT_AT] - nowSec())}`,
      })
    )
  }

  const selectId = `ml-status-${entry.id}`
  const status = el('select', { id: selectId, class: 'ml-item__status', 'data-key': `status-${entry.id}` })
  for (const s of STATUSES) {
    const option = new Option(statusLabel(s, entry.media), s)
    option.selected = entry.status === s
    status.add(option)
  }
  status.addEventListener('change', () => {
    warnIfUnsaved(store.setStatus(entry.id, status.value))
    track('list_status', { title_id: entry.id, section: entry.ns, status: status.value, title: entry.title })
  })
  const statusBox = el(
    'div',
    { class: 'ml-item__controls' },
    el('label', { for: selectId, class: 'sr-only', text: `Status of ${entry.title}` }),
    status
  )

  const inList = current !== 'all'
  const remove = el('button', {
    type: 'button',
    class: 'ml-btn ml-btn--ghost ml-item__remove',
    'data-key': `remove-${entry.id}`,
    text: inList ? 'Take out' : 'Remove',
    'aria-label': inList ? `Take ${entry.title} out of this list` : `Remove ${entry.title} from my list`,
  })
  remove.addEventListener('click', () => {
    if (inList) {
      const result = store.toggleInList(current, entry)
      if (result && !result.error) {
        warnIfUnsaved(result)
        track('list_toggle', { title_id: entry.id, section: entry.ns, in_list: 0, title: entry.title })
        say(msg, `Took ${entry.title} out of this list. It is still on My list.`)
      }
      return
    }
    warnIfUnsaved(store.remove(entry.id))
    track('list_remove', { title_id: entry.id, section: entry.ns, title: entry.title })
    say(msg, `Removed ${entry.title}.`)
  })
  statusBox.append(remove)

  return el('li', { class: gone ? 'ml-item ml-item--gone' : 'ml-item' }, cover, body, statusBox)
}

function draw(state) {
  drawTabs(state)
  const list = current === 'all' ? null : state.lists.find((l) => l.id === current)
  // Newest saved first, by when it was ADDED: a status change must never
  // move a card out from under the reader's cursor or keyboard.
  const entries = list
    ? list.ids.map((id) => state.titles[id]).filter(Boolean)
    : Object.values(state.titles).sort((a, b) => b.addedAt - a.addedAt || a.id - b.id)

  const bar = $('.ml-listbar')
  bar.hidden = !list
  say($('.ml-listbar__name'), list ? list.name : '')

  // A redraw replaces the cards, so the control that had focus is found
  // again by its key and focused. If its card is gone (it was removed),
  // focus goes to the panel instead of falling to the top of the page.
  const ul = $('.ml-items')
  const focusKey = ul.contains(document.activeElement) ? document.activeElement.dataset.key : null
  ul.replaceChildren(...entries.map((entry) => card(entry, state)))
  if (focusKey) {
    const again = ul.querySelector(`[data-key="${CSS.escape(focusKey)}"]`)
    if (again) again.focus()
    else $('#ml-panel').focus()
  }

  const total = Object.keys(state.titles).length
  say($('.ml-count'), entries.length ? `${entries.length} ${entries.length === 1 ? 'title' : 'titles'}` : '')
  $('.ml-empty').hidden = entries.length > 0
  say(
    $('.ml-empty__text'),
    list
      ? total
        ? 'This list is empty. Open any title, tap "Lists" next to Add to my list, and tick this one.'
        : 'This list is empty, and so is My list.'
      : 'Your list is empty.'
  )
  $('.ml-clear').hidden = total === 0
  drawNews(state)
}

// ------------------------------------------------- alerts and this week

// Built from the rows, which the page loads once. A change the reader has
// not been shown yet is news; see reconcile() in src/lib/feed-core.js.
let alerts = []

function drawNews(state) {
  const alertList = $('.ml-alerts__list')
  alertList.replaceChildren(
    // The entry is read from the state now, not from when the alert was
    // made, so a title whose address moved links to where it is today.
    ...alerts
      .filter(({ id }) => state.titles[id])
      .map(({ id, alert }) => {
        const entry = state.titles[id]
        return el('li', {}, el('a', { href: pathOfEntry(entry), text: alertText(alert, entry, phrase) }))
      })
  )
  $('.ml-alerts').hidden = alertList.children.length === 0

  const airing = [...rows].map(([id, row]) => [id, row[ROW.NEXT_AT], row[ROW.NEXT_NUM]]).filter(([, at]) => at > 0)
  const week = thisWeek(Object.values(state.titles), airing, nowSec())
  $('.ml-week__list').replaceChildren(
    ...week.map(({ entry, at, num }) =>
      el(
        'li',
        {},
        el('a', { href: pathOfEntry(entry) }, el('b', { text: entry.title }), el('span', { text: `${num ? `Episode ${num}` : 'New episode'} ${phrase(at - nowSec())}` }))
      )
    )
  )
  $('.ml-week').hidden = week.length === 0
}

async function loadFacts() {
  const state = store.get()
  const ids = Object.keys(state.titles).map(Number)
  if (!ids.length) return
  let result
  try {
    result = await loadRows(ids)
  } catch (e) {
    return
  }
  rows = result.rows
  checked = new Set(ids.filter((id) => !result.unknown.has(id)))

  const now = nowSec()
  const updates = []
  alerts = []
  for (const entry of Object.values(store.get().titles)) {
    const row = rows.get(entry.id)
    if (!row) continue
    const done = reconcile(entry.seen, row, now)
    for (const alert of done.alerts) alerts.push({ id: entry.id, alert })
    const moved = row[ROW.NS] !== entry.ns || row[ROW.SLUG] !== entry.slug
    if (done.changed || moved) {
      updates.push({ id: entry.id, seen: done.changed ? done.seen : null, ns: row[ROW.NS], slug: row[ROW.SLUG] })
    }
  }
  if (updates.length) warnIfUnsaved(store.applyRowUpdates(updates))
  else draw(store.get())
}

// ---------------------------------------------------------------- forms

const newBtn = $('.ml-newbtn')
const newForm = $('#ml-newlist')
const renameForm = $('.ml-renameform')

function closeForms() {
  newForm.hidden = true
  renameForm.hidden = true
  newBtn.setAttribute('aria-expanded', 'false')
}

newBtn.addEventListener('click', () => {
  const opening = newForm.hidden
  closeForms()
  newForm.hidden = !opening
  newBtn.setAttribute('aria-expanded', String(opening))
  if (opening) newForm.querySelector('input').focus()
})

newForm.addEventListener('submit', (event) => {
  event.preventDefault()
  const input = newForm.querySelector('input')
  const result = store.createList(input.value)
  if (result && result.error) return say(msg, result.error)
  warnIfUnsaved(result)
  track('list_create', { lists: store.get().lists.length })
  input.value = ''
  say(msg, `Made "${result.list.name}".`)
  select(result.list.id)
})

$('.ml-rename').addEventListener('click', () => {
  const list = store.get().lists.find((l) => l.id === current)
  if (!list) return
  closeForms()
  renameForm.hidden = false
  const input = renameForm.querySelector('input')
  input.value = list.name
  input.focus()
  input.select()
})

renameForm.addEventListener('submit', (event) => {
  event.preventDefault()
  const result = store.renameList(current, renameForm.querySelector('input').value)
  if (result && result.error) return say(msg, result.error)
  warnIfUnsaved(result)
  track('list_rename')
  closeForms()
  say(msg, 'Renamed.')
  document.querySelector('.ml-tab[aria-selected="true"]')?.focus()
})

// Escape or Cancel closes an open form and returns to where the reader was.
for (const form of [newForm, renameForm]) {
  const back = () => {
    closeForms()
    ;(form === newForm ? newBtn : $('.ml-rename')).focus()
  }
  form.querySelector('.ml-cancel').addEventListener('click', back)
  form.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') back()
  })
}

$('.ml-delete').addEventListener('click', () => {
  const list = store.get().lists.find((l) => l.id === current)
  if (!list) return
  if (!confirm(`Delete the list "${list.name}"? The titles in it stay on My list.`)) return
  const result = store.deleteList(list.id)
  if (result && result.error) return say(msg, result.error)
  warnIfUnsaved(result)
  track('list_delete', { lists: store.get().lists.length })
  say(msg, `Deleted "${list.name}". Its titles are still on My list.`)
  select('all')
})

$('.ml-clear').addEventListener('click', () => {
  if (!confirm('Clear your whole list, every named list and every status? This cannot be undone.')) return
  warnIfUnsaved(store.clear())
  alerts = []
  say(msg, 'Your list is cleared.')
})

// --------------------------------------------------------------- import

const importForm = $('.ml-importform')
const importMsg = $('.ml-import__msg')
importForm.addEventListener('submit', async (event) => {
  event.preventDefault()
  const button = importForm.querySelector('button')
  const name = importForm.querySelector('input').value
  button.disabled = true
  say(importMsg, 'Reading your AniList list…')
  try {
    const { user, entries } = await fetchAniList(name)
    if (!entries.length) {
      say(importMsg, `${user}'s AniList list is empty, so there was nothing to bring across.`)
      track('anilist_import', { result: 'empty', matched: 0, skipped: 0 })
      return
    }
    say(importMsg, `Found ${entries.length} titles. Matching them to our pages…`)
    const found = await loadRows(entries.map((e) => e.id))
    const unchecked = entries.filter((e) => found.unknown.has(e.id)).length
    const { matched, skipped } = matchEntries(entries, found.rows)
    const merged = store.mergeImport(matched, user)
    warnIfUnsaved(merged)
    store.noteImport({ user, matched: matched.length, skipped })
    const notHeld = skipped - unchecked
    const parts = [`Imported ${merged.added} new ${merged.added === 1 ? 'title' : 'titles'}`]
    if (merged.updated) parts.push(`updated ${merged.updated} you already had`)
    if (merged.listsMade) parts.push(`made ${merged.listsMade} ${merged.listsMade === 1 ? 'list' : 'lists'}`)
    let words = `${parts.join(', ')}.`
    if (notHeld > 0) words += ` ${notHeld} ${notHeld === 1 ? 'is' : 'are'} not in our index yet.`
    if (unchecked > 0) words += ` ${unchecked} could not be checked; try again later.`
    if (merged.full > 0) words += ` ${merged.full} did not fit: My list holds 500 titles.`
    if (merged.listsSkipped > 0) {
      words += ` ${merged.listsSkipped} AniList ${merged.listsSkipped === 1 ? 'list was' : 'lists were'} not made: you can have up to 20 lists.`
    }
    say(importMsg, words)
    track('anilist_import', { result: 'ok', matched: matched.length, skipped, lists_skipped: merged.listsSkipped })
    loadFacts()
  } catch (e) {
    const known = e instanceof ImportError
    say(importMsg, known ? e.message : 'Something went wrong. Try again in a minute.')
    track('anilist_import', { result: known ? e.code : 'error', matched: 0, skipped: 0 })
  } finally {
    button.disabled = false
  }
})

// ---------------------------------------------------------------- start

if (!store.persistent) $('.ml-blocked').hidden = false
store.subscribe((state) => draw(state))
draw(store.get())
track('my_list_view', { titles: store.count(), lists: store.get().lists.length })
loadFacts()
