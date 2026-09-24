// BUILD TIME ONLY. A Where site's sitemap: the pages its build gated in.
//
// scripts/make-where.mjs writes data/page-urls.json as { groups: [{ name,
// priority, urls: [{ path, image?, caption? }] }] }, one group per page type,
// holding exactly the pages that passed their gate, and the hubs worked out
// by the same function the hub pages are built from. Nothing outside it is
// ever offered to a crawler, and nothing in it answers 404.
//
// Read with readFileSync, not a JSON import: a JSON import is turned into a
// JavaScript module by the bundler, which is slow at this size.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import config from './site.mjs'
import { split } from './sitemap-xml.js'

const { groups } = JSON.parse(readFileSync(join(process.cwd(), 'data', 'page-urls.json'), 'utf8'))

export const sitemapParts = groups.flatMap((group) =>
  split(
    group.name,
    group.urls.map((u) => ({
      loc: `${config.siteUrl}${u.path}`,
      priority: group.priority,
      ...(u.image ? { image: u.image, caption: u.caption } : {}),
    })),
  ),
)
