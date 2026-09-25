// "For you" on a Where page (src/components/where/ForYou.astro): picks from
// the reader's own list, worked out in their browser from the For you pool
// (/d/feed.v1.json) by the home site's own ranking (feed-core.js), and the
// shows on their list that air this week. Browser only.
//
// Nothing is drawn for a reader with no list, and a pool that does not load
// leaves the page exactly as it was. Every text goes in with textContent:
// titles come from data and must never run as markup.
import { openStore, track } from './my-list.js'
import { loadFeed } from './list-data.js'
import { pickFeed, thisWeek } from './feed-core.js'
import { coverFrom } from './list-row.js'
import { phrase } from './countdown-core.js'

function el(tag, props = {}, ...children) {
  const node = document.createElement(tag)
  for (const [key, value] of Object.entries(props)) {
    if (value === undefined || value === null) continue
    if (key === 'text') node.textContent = value
    else if (key === 'class') node.className = value
    else node.setAttribute(key, String(value))
  }
  for (const child of children) if (child) node.append(child)
  return node
}

// Nothing to show after all: take the reserved space away again.
const giveUp = () => document.documentElement.classList.remove('mi-has-list')

function weekRow({ entry, at, num }, now) {
  return el(
    'li',
    {},
    el(
      'a',
      { href: `/${entry.ns}/${entry.slug}` },
      entry.cover ? el('img', { src: entry.cover, alt: '', width: '36', height: '52', loading: 'lazy', decoding: 'async' }) : el('span'),
      el('span', {}, el('b', { text: entry.title }), el('em', { text: `${num ? `Episode ${num}` : 'New episode'} · ${phrase(at - now)}` })),
    ),
  )
}

function pickCard(item, i) {
  return el(
    'li',
    {},
    el(
      'a',
      { href: `/${item.ns}/${item.slug}`, 'data-pos': i + 1, 'data-id': item.id, 'data-rel': item.related ? '1' : '0', 'data-title': item.title },
      el('span', { class: 'w-covers__art' }, el('img', { src: coverFrom(item.ns, item.cover), alt: '', width: '160', height: '228', loading: 'lazy', decoding: 'async' })),
      el('b', { text: item.title }),
      el('small', { class: 'foryou__why', text: item.reason }),
    ),
  )
}

async function fill(section) {
  const entries = Object.values(openStore().get().titles)
  if (!entries.length) return giveUp()
  let pool
  try {
    pool = await loadFeed()
  } catch (e) {
    return giveUp()
  }
  const now = Math.floor(Date.now() / 1000)
  const picks = pickFeed(entries, pool)
  const week = thisWeek(entries, pool.airing, now)
  if (!picks.length && !week.length) return giveUp()

  section.querySelector('.foryou__weeklist').replaceChildren(...week.map((row) => weekRow(row, now)))
  section.querySelector('.foryou__week').hidden = week.length === 0
  const grid = section.querySelector('.foryou__grid')
  grid.replaceChildren(...picks.map(pickCard))
  grid.hidden = picks.length === 0
  grid.addEventListener('click', (event) => {
    const link = event.target.closest && event.target.closest('a[data-pos]')
    if (!link) return
    track('feed_click', {
      position: Number(link.dataset.pos),
      title_id: Number(link.dataset.id),
      section: 'anime',
      related: Number(link.dataset.rel),
      title: link.dataset.title,
    })
  })
  section.hidden = false
  track('feed_view', { picks: picks.length, this_week: week.length, titles: entries.length })
}

const section = document.getElementById('for-you')
if (section) fill(section)
