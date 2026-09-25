// The phone dock's rules (src/lib/dock.js): which link is lit on which page,
// and which links are drawn at all.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { cleanPath, dockItems, isDockActive } from '../src/lib/dock.js'
import { DOCK_ICONS } from '../src/lib/dock-icons.js'

const DOCK = [
  { href: '/', label: 'Home', icon: 'home' },
  { href: '/schedule', label: 'Schedule', icon: 'calendar' },
  { href: '/search', label: 'Search', icon: 'search' },
  { href: '/my-list', label: 'My list', icon: 'list' },
  { href: '/shop', label: 'Shop', icon: 'shop' },
]

test('home is lit on the home page only', () => {
  assert.equal(isDockActive('/', '/'), true)
  assert.equal(isDockActive('/index.html', '/'), true)
  assert.equal(isDockActive('/anime/frieren', '/'), false)
  assert.equal(isDockActive('/shop', '/'), false)
})

test('a section is lit on its own page, with or without .html or a slash', () => {
  assert.equal(isDockActive('/shop', '/shop'), true)
  assert.equal(isDockActive('/shop.html', '/shop'), true)
  assert.equal(isDockActive('/my-list/', '/my-list'), true)
  assert.equal(isDockActive('/my-list?list=abc', '/my-list'), true)
  assert.equal(isDockActive('/schedule', '/schedule'), true)
})

test('a page that only starts with the same letters is not lit', () => {
  assert.equal(isDockActive('/shopping', '/shop'), false)
  assert.equal(isDockActive('/search-help', '/search'), false)
})

test('exactly one link is lit on each of its own pages', () => {
  for (const item of DOCK) {
    const lit = DOCK.filter((other) => isDockActive(item.href, other.href))
    assert.deepEqual(lit.map((x) => x.href), [item.href])
  }
  assert.equal(DOCK.filter((item) => isDockActive('/voice-actor/hanazawa', item.href)).length, 0)
})

test('a hub its gate left out drops out of the dock', () => {
  assert.deepEqual(dockItems(DOCK, ['/schedule']).map((x) => x.href), ['/', '/search', '/my-list', '/shop'])
  assert.equal(dockItems(DOCK, []).length, 5)
})

test('never more than five links', () => {
  assert.equal(dockItems([...DOCK, { href: '/mood', label: 'Moods', icon: 'grid' }]).length, 5)
})

test('every icon the anime dock names exists', () => {
  for (const item of DOCK) assert.ok(DOCK_ICONS[item.icon], item.icon)
})

test('cleanPath', () => {
  assert.equal(cleanPath(''), '/')
  assert.equal(cleanPath('/anime/x.html'), '/anime/x')
  assert.equal(cleanPath('/a/b/'), '/a/b')
})
