import { test } from 'node:test'
import assert from 'node:assert/strict'
import { toOwnRow, searchPickRow, searchNoneRow, missNextRow } from '../src/lib/own-count.js'
import { normalizeQuery } from '../src/lib/finder-core.js'

test('toOwnRow maps a list add to id, status and title name', () => {
  assert.deepEqual(toOwnRow('list_add', { title_id: 101517, section: 'manhwa', status: 'PLANNING', title: 'Solo Leveling' }), {
    name: 'list_add', kind: 'act', item: '101517', detail: 'PLANNING', pos: 0, label: 'Solo Leveling',
  })
})

test('toOwnRow never passes a key that is not on the allow-list', () => {
  const row = toOwnRow('list_create', { lists: 2, name: 'My secret list', list_name: 'x', user: 'anilistname', title: 'x' })
  assert.deepEqual(row, { name: 'list_create', kind: 'act', item: '', detail: '', pos: 2, label: '' })
  const imp = toOwnRow('anilist_import', { result: 'ok', matched: 40, user: 'anilistname', username: 'anilistname' })
  assert.equal(JSON.stringify(imp).includes('anilistname'), false)
  assert.equal(imp.detail, 'ok')
  assert.equal(imp.pos, 40)
  assert.equal(JSON.stringify(toOwnRow('list_rename', { name: 'New name' })).includes('New name'), false)
})

test('toOwnRow drops unknown actions and title actions with no id', () => {
  assert.equal(toOwnRow('something_new', { title_id: 1 }), null)
  assert.equal(toOwnRow('list_add', { status: 'PLANNING' }), null)
})

test('toOwnRow says in or out for a list toggle, and position for a feed click', () => {
  assert.equal(toOwnRow('list_toggle', { title_id: 1, in_list: 1 }).detail, 'in')
  assert.equal(toOwnRow('list_toggle', { title_id: 1, in_list: 0 }).detail, 'out')
  const feed = toOwnRow('feed_click', { title_id: 9, position: 3, section: 'manga', related: 1, title: 'A' })
  assert.equal(feed.detail, '3')
  assert.equal(feed.pos, 3)
  assert.equal(feed.label, 'A')
})

test('normalizeQuery keeps ordinary titles, lower case and tidy', () => {
  assert.equal(normalizeQuery('  Solo   Leveling '), 'solo leveling')
  assert.equal(normalizeQuery('Re:Zero'), 're zero')
  assert.equal(normalizeQuery('86'), '86')
  assert.equal(normalizeQuery('Dr. Stone'), 'dr stone')
  assert.equal(normalizeQuery('2001 nights'), '2001 nights')
})

test('normalizeQuery rejects e-mails, links and phone numbers whole', () => {
  for (const bad of [
    'me@example.com',
    'contact me at john@x',
    'https://mangasite.to/read',
    'www.something',
    'mangadex.org',
    'site.com solo leveling',
    'a/b',
    '03001234567',
    '0300 123 4567',
    '+92-300-123-4567',
    '(555) 123.4567',
  ]) {
    assert.equal(normalizeQuery(bad), '', bad)
  }
})

test('normalizeQuery keeps only 2 to 40 characters', () => {
  assert.equal(normalizeQuery('a'), '')
  assert.equal(normalizeQuery(''), '')
  assert.equal(normalizeQuery(null), '')
  assert.equal(normalizeQuery('x'.repeat(41)), '')
  assert.equal(normalizeQuery('x'.repeat(40)), 'x'.repeat(40))
})

test('search rows', () => {
  assert.deepEqual(searchPickRow('https://example.com/manga/berserk?x=1', 'dropdown', 1, ' Berserk '), {
    name: 'search_pick', kind: 'search', item: '/manga/berserk', detail: 'dropdown', pos: 1, label: 'Berserk',
  })
  assert.equal(searchNoneRow('my@mail.com', 'page'), null)
  assert.equal(searchNoneRow('Unknown Title', 'page').item, 'unknown title')
  assert.equal(missNextRow('/anime').item, '/anime')
  assert.equal(missNextRow('/').item, '/')
})
