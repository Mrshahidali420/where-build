// The Worker's addresses follow the one `domain` setting
// (src/lib/wrangler-config.mjs): a site without a domain lives only on its
// dev address, a site with one never answers there.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { wranglerConfig, wranglerJsonc } from '../src/lib/wrangler-config.mjs'
import { defineSite } from '../src/lib/define-site.mjs'
import fixture from './fixtures/site.config.mjs'

const withChanges = (changes) => defineSite({ ...structuredClone(fixture), ...changes })
const devOnly = withChanges({ domain: null })

test('no domain: the dev address only, and robots.txt runs the Worker first', () => {
  const config = wranglerConfig(devOnly)
  assert.equal(config.name, 'fixture')
  assert.equal(config.workers_dev, true)
  assert.equal(config.routes, undefined)
  assert.deepEqual(config.assets.run_worker_first, ['/robots.txt'])
  assert.equal(config.assets.not_found_handling, 'none')
  assert.equal(devOnly.siteUrl, 'https://fixture.tests.workers.dev')
})

test('a domain: custom domains for the apex and www, the dev address off, assets first', () => {
  const config = wranglerConfig(fixture)
  assert.equal(config.workers_dev, false)
  assert.deepEqual(config.routes, [
    { pattern: 'example.com', custom_domain: true },
    { pattern: 'www.example.com', custom_domain: true },
  ])
  assert.equal('run_worker_first' in config.assets, false)
})

test('the database is bound only once it exists', () => {
  assert.equal(wranglerConfig(fixture).d1_databases, undefined)
  const withDb = withChanges({ d1: { name: 'fixture-analytics', id: '00000000-0000-0000-0000-000000000000' } })
  assert.deepEqual(wranglerConfig(withDb).d1_databases, [
    { binding: 'ANALYTICS', database_name: 'fixture-analytics', database_id: '00000000-0000-0000-0000-000000000000' },
  ])
})

test('the cron lines come from the config', () => {
  assert.deepEqual(wranglerConfig(fixture).triggers, { crons: ['10 0 * * *'] })
})

test('the written file says where it comes from and is valid JSON after its header', () => {
  const text = wranglerJsonc(devOnly)
  assert.match(text, /^\/\/ Written by packages\/core\/scripts\/make-wrangler\.mjs/)
  const json = text.split('\n').filter((line) => !line.startsWith('//')).join('\n')
  assert.deepEqual(JSON.parse(json), wranglerConfig(devOnly))
})
