#!/usr/bin/env node
/**
 * The one-time Cloudflare setup WhereAnime needs before its visitor counter
 * and /my-admin work. This script only PRINTS the commands, in order, with
 * the values taken from sites/anime/site.config.mjs. It runs nothing and
 * creates nothing: every step is run by hand, from sites/anime.
 *
 *   node scripts/provision-anime.mjs
 *
 * Until these steps are done the site still works. With no d1.id the Worker
 * has no ANALYTICS binding, so /_a answers 204 and writes nothing and
 * /my-admin shows its "database is not set up" hint. With no
 * turnstileSiteKey the page script never asks for a pass and sends nothing.
 */
import site from '../sites/anime/site.config.mjs'

const db = site.d1.name
const schema = '../../packages/core/db/schema.sql'

const steps = [
  {
    title: 'Create the analytics database',
    run: [`npx wrangler d1 create ${db}`],
    then: `Copy the database_id it prints into sites/anime/site.config.mjs as d1: { name: '${db}', id: '<database_id>' }, then run \`npm run wrangler\` so wrangler.jsonc gains the ANALYTICS binding.`,
  },
  {
    title: 'Create the tables',
    run: [`npx wrangler d1 execute ${db} --remote --file ${schema}`],
    then:
      'schema.sql already holds every column migration 0002 adds, so a new database needs no migration: 0002 would stop at "duplicate column name", and 0003 only cleans rows an old database had.',
  },
  {
    title: 'Create the Turnstile widget (Cloudflare dashboard, Turnstile, Add widget)',
    run: [],
    then:
      `Mode: Invisible. Hostnames: ${site.devHost}${site.plannedDomain ? `, and later ${site.plannedDomain} and www.${site.plannedDomain}` : ''}. ` +
      'Put the site key in sites/anime/site.config.mjs as turnstileSiteKey. Keep the secret key for the next step.',
  },
  {
    title: 'Set the Worker secrets (after the first deploy, so the Worker exists)',
    run: ['npx wrangler secret put TURNSTILE_SECRET', 'npx wrangler secret put PASS_KEY', 'npx wrangler secret put ADMIN_SECRET'],
    then:
      'TURNSTILE_SECRET is the widget\'s secret key. PASS_KEY is any long random string (it signs the visitor pass). ADMIN_SECRET is the word that opens /my-admin. Redeploy afterwards so the new config and key ship.',
  },
]

console.log(`${site.name}: one-time setup, run by hand from sites/anime. Nothing below has been run.\n`)
steps.forEach((step, i) => {
  console.log(`${i + 1}. ${step.title}`)
  for (const line of step.run) console.log(`     ${line}`)
  console.log(`   ${step.then}\n`)
})
