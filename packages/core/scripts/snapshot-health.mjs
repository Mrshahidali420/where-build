/**
 * The checks scripts/catalog-snapshot.mjs runs before it trusts a file, kept
 * apart so they can be tested without R2. Everything here is pure: no disk,
 * no network, no process.env.
 *
 * The rule the whole file serves: a corrupt copy must never reach R2. Eight
 * daily copies of broken data would leave nothing good to restore from.
 */

// A catalog file where more than 1% of records lack an id, a slug or a name
// is broken, whatever its record count says.
export const MIN_VALID_SHARE = 0.99
// A share (records with links, character pages) may not fall by more than
// this many points between two pushes. Real change moves it by fractions.
export const MAX_SHARE_DROP = 0.05
// ...nor lose more than a fifth of itself. Comics sit near 18% with links, so
// five points alone would let over a quarter of them vanish unnoticed.
export const MAX_RELATIVE_DROP = 0.2
// Duplicate ids or slugs: a handful is normal, a lot means a bad merge.
export const MAX_DUP_SHARE = 0.005
// The song list may not lose more than 10% of its anime (same rule as
// scripts/sync-animethemes.mjs).
export const THEMES_KEEP = 0.9
// A share of registry entries that must carry a slug.
export const MIN_REGISTRY_VALID = 0.99

// Retention.
export const KEEP_DAYS = 8
export const MIN_DAILY = 3
export const KEEP_WEEKS = 4
// R2's free tier is 10 GB. Stop adding copies well before it.
export const SIZE_CAP_BYTES = 9e9

const DAY_MS = 86400000
const round = (n) => Math.round(n * 10000) / 10000
const nonEmpty = (v) => Array.isArray(v) && v.length > 0
const text = (v) => typeof v === 'string' && v.trim().length > 0
const pct = (n) => `${(n * 100).toFixed(1)}%`

// ---- catalog files ------------------------------------------------------------

/**
 * A character built from an older title's cast list has no id of its own
 * (anilist-core.mjs, "id: ref.id ?? null"), but its slug still ends in the
 * AniList id. That counts as an identity; anything else does not.
 */
function hasIdentity(record) {
  if (Number.isInteger(record.id) && record.id > 0) return true
  return record.id == null && typeof record.slug === 'string' && /-\d+$/.test(record.slug)
}

function isValidRecord(record, nameField) {
  return !!record && typeof record === 'object' && hasIdentity(record) && text(record.slug) && text(record[nameField])
}

/** The share each catalog file is judged on, besides validShare. */
const CONTENT = {
  'comics.json': { nameField: 'title', share: 'linkShare', has: (r) => nonEmpty(r.readLinks) },
  'anime.json': { nameField: 'title', share: 'linkShare', has: (r) => nonEmpty(r.watchLinks) },
  'characters.json': { nameField: 'name', share: 'pageShare', has: (r) => text(r.image) && nonEmpty(r.appearsIn) },
}

export const isCatalogFile = (name) => Object.hasOwn(CONTENT, name)

/** { count, validShare, dupShare, linkShare | pageShare } for a parsed catalog file. */
export function catalogHealth(name, records) {
  const spec = CONTENT[name]
  if (!spec) throw new Error(`catalogHealth: unknown catalog file ${name}`)
  if (!Array.isArray(records)) return { count: 0, validShare: 0, dupShare: 1, [spec.share]: 0 }
  const count = records.length
  const ids = new Set()
  const slugs = new Set()
  let valid = 0
  let content = 0
  let dupIds = 0
  let dupSlugs = 0
  for (const record of records) {
    if (isValidRecord(record, spec.nameField)) valid++
    if (record && spec.has(record)) content++
    if (Number.isInteger(record?.id)) {
      if (ids.has(record.id)) dupIds++
      ids.add(record.id)
    }
    if (typeof record?.slug === 'string') {
      if (slugs.has(record.slug)) dupSlugs++
      slugs.add(record.slug)
    }
  }
  const of = (n) => (count ? round(n / count) : 0)
  return {
    count,
    validShare: of(valid),
    dupShare: of(Math.max(dupIds, dupSlugs)),
    [spec.share]: of(content),
  }
}

/**
 * Problems with a catalog file, as plain sentences; empty when it may be
 * pushed. `prev` is the health R2 recorded last time (null on the first push
 * after this check existed). `allowDrop` lets a share fall on purpose; it never
 * relaxes the validShare floor or the duplicate cap.
 */
export function checkCatalog(name, health, prev, { allowDrop = false } = {}) {
  const problems = []
  if (!health.count) problems.push(`${name} has no records`)
  if (health.validShare < MIN_VALID_SHARE) {
    problems.push(`${name}: only ${pct(health.validShare)} of records have an id, a slug and a name (need ${pct(MIN_VALID_SHARE)})`)
  }
  if (health.dupShare >= MAX_DUP_SHARE) {
    problems.push(`${name}: ${pct(health.dupShare)} of records repeat an id or slug (limit ${pct(MAX_DUP_SHARE)})`)
  }
  if (prev && !allowDrop) {
    for (const key of ['linkShare', 'pageShare', 'validShare']) {
      if (typeof health[key] !== 'number' || typeof prev[key] !== 'number') continue
      const drop = prev[key] - health[key]
      if (drop > MAX_SHARE_DROP || (prev[key] > 0 && drop / prev[key] > MAX_RELATIVE_DROP)) {
        problems.push(
          `${name}: ${key} fell from ${pct(prev[key])} to ${pct(health[key])} ` +
            `(limit ${MAX_SHARE_DROP * 100} points or ${MAX_RELATIVE_DROP * 100}% of itself)`
        )
      }
    }
  }
  return problems
}

// ---- state files ----------------------------------------------------------------

/**
 * Checks a parsed state file. Returns { health, problems, fatal }.
 *   fatal: a failure that must stop the whole push (the slug registry).
 *   Otherwise a failing file is skipped and R2 keeps its last good copy.
 * `prev` is the previous meta.json (null on a first push). With prev null only
 * the shape is checked, which is what a pull does.
 */
export function checkState(name, value, prev, { allowRegistryShrink = false } = {}) {
  const obj = value && typeof value === 'object' && !Array.isArray(value) ? value : null
  if (name === 'slug-registry.json') return checkRegistry(obj, prev, allowRegistryShrink)
  if (name === 'themes.json') return checkThemes(obj, prev)
  if (name.endsWith('-walk.json')) return checkWalk(name, obj)
  return { health: { count: 1 }, problems: [], fatal: false }
}

function checkRegistry(obj, prev, allowShrink) {
  const entries = obj?.entries && typeof obj.entries === 'object' && !Array.isArray(obj.entries) ? obj.entries : null
  const list = entries ? Object.values(entries) : []
  const count = list.length
  const valid = list.filter((e) => e && typeof e === 'object' && text(e.slug)).length
  const health = { count, validShare: count ? round(valid / count) : 0 }
  const problems = []
  if (!entries || !count) problems.push('slug-registry.json has no entries')
  else if (health.validShare < MIN_REGISTRY_VALID) {
    problems.push(`slug-registry.json: only ${pct(health.validShare)} of entries carry a slug`)
  }
  const before = prev?.registryEntries
  // Slugs are reserved forever, so the registry only grows. ALLOW_SHRINK does
  // not cover this; only ALLOW_REGISTRY_SHRINK does.
  if (typeof before === 'number' && count < before && !allowShrink) {
    problems.push(`slug-registry.json has ${count} entries, R2 has ${before}; the registry is append-only`)
  }
  return { health, problems, fatal: problems.length > 0 }
}

function checkThemes(obj, prev) {
  const map = obj?.byAnilistId && typeof obj.byAnilistId === 'object' ? obj.byAnilistId : null
  const count = map ? Object.keys(map).length : 0
  const problems = []
  if (!count) problems.push('themes.json has no anime (byAnilistId is empty or missing)')
  const before = prev?.health?.['themes.json']?.count
  if (typeof before === 'number' && count < before * THEMES_KEEP) {
    problems.push(`themes.json covers ${count} anime, R2 has ${before} (floor ${pct(THEMES_KEEP)})`)
  }
  return { health: { count }, problems, fatal: false }
}

function checkWalk(name, obj) {
  const problems = []
  if (!obj) problems.push(`${name} is not an object`)
  else {
    if (!Number.isInteger(obj.next) || obj.next < 1) problems.push(`${name}: next is ${JSON.stringify(obj.next)}, not a positive whole number`)
    if (typeof obj.newest !== 'number' || !Number.isFinite(obj.newest) || obj.newest < 0) problems.push(`${name}: newest is not a number`)
    if (obj.finishedAt != null && typeof obj.finishedAt !== 'string') problems.push(`${name}: finishedAt is neither null nor a date`)
  }
  return { health: { count: 1, next: obj?.next ?? null }, problems, fatal: false }
}

// ---- the push decision -----------------------------------------------------------

export const CATALOG_FILES = ['comics.json', 'anime.json', 'characters.json']
export const STATE_FILES = ['characters-walk.json', 'novels-walk.json', 'slug-registry.json', 'themes.json']
// Same 2% the build's shrink guard allows.
export const SHRINK_LIMIT = 0.98
const keyOfCatalog = (name) => name.replace(/\.json$/, '')

/**
 * Decide what a push may upload. Pure apart from `read`.
 *
 *   read(name)  -> { state: 'missing' | 'corrupt' | 'ok', count, value }
 *                  called once per wanted file, one at a time, so a 140 MB
 *                  catalog can be dropped before the next one is parsed.
 *   prev        latest/meta.json from R2, or null.
 *   opts        { wanted(name), partial, allowShrink, allowHealthDrop,
 *                 allowRegistryShrink, registryRecovered, registryNotLive, now }
 *
 * Returns { refusals, warnings, notes, upload, counts, health, registryEntries,
 * fullyPassing }. Any refusal means: upload nothing, delete nothing.
 */
export function judgeFiles(read, prev, opts = {}) {
  const wanted = opts.wanted || (() => true)
  const stamp = new Date(opts.now ?? Date.now()).toISOString()
  const prevHealth = prev?.health || {}
  const refusals = []
  const warnings = []
  const notes = []
  const upload = []
  const counts = {}
  const health = {}
  let registryEntries = prev?.registryEntries ?? null
  let complete = !opts.partial
  let registryUploaded = false

  for (const name of CATALOG_FILES) {
    if (!wanted(name)) continue
    const local = read(name)
    if (local.state !== 'ok') {
      warnings.push(`data/${name} is ${local.state}; not uploaded (R2 keeps its last copy)`)
      complete = false
      continue
    }
    const before = prev?.counts?.[keyOfCatalog(name)] || 0
    if (local.count < before * SHRINK_LIMIT && !opts.allowShrink) {
      refusals.push(`data/${name} has ${local.count} records, R2 has ${before} (set ALLOW_SHRINK=1 if intended)`)
      continue
    }
    const fileHealth = catalogHealth(name, local.value)
    const problems = checkCatalog(name, fileHealth, prevHealth[name], { allowDrop: opts.allowHealthDrop })
    refusals.push(...problems)
    notes.push(`${name}: ${JSON.stringify(fileHealth)}${problems.length ? ' FAILED' : ' ok'}`)
    counts[keyOfCatalog(name)] = local.count
    health[name] = { ...fileHealth, ok: problems.length === 0, checkedAt: stamp }
    upload.push(name)
  }

  for (const name of STATE_FILES) {
    if (!wanted(name)) continue
    const isRegistry = name === 'slug-registry.json'
    if (isRegistry && opts.registryRecovered) {
      warnings.push('data/slug-registry.recovered exists: the stand-in registry is not uploaded')
      continue
    }
    const local = read(name)
    if (local.state === 'missing') continue
    if (local.state !== 'ok') {
      if (isRegistry) refusals.push('data/slug-registry.json is not valid JSON')
      else warnings.push(`data/${name} is ${local.state}; skipped (R2 keeps its last good copy)`)
      complete = false
      continue
    }
    const verdict = checkState(name, local.value, prev, { allowRegistryShrink: opts.allowRegistryShrink })
    if (verdict.problems.length) {
      if (verdict.fatal) refusals.push(...verdict.problems)
      else {
        for (const problem of verdict.problems) warnings.push(`${problem}; skipped (R2 keeps its last good copy)`)
        complete = false
      }
      continue
    }
    // The build writes new addresses into the registry before it deploys. If
    // the deploy did not happen, those addresses are not live, and a copy of
    // them in R2 would describe a site nobody can visit. It is still checked
    // above: a shrunken registry on disk is a problem either way.
    if (isRegistry && opts.registryNotLive) {
      notes.push('deploy did not succeed: the slug registry is not uploaded')
      continue
    }
    if (isRegistry) {
      registryEntries = verdict.health.count
      registryUploaded = true
    }
    health[name] = { ...verdict.health, ok: true, checkedAt: stamp }
    upload.push(name)
  }

  // Weekly copies and deletions need a push that carried the whole catalog
  // and the registry, and skipped nothing for being broken.
  const fullyPassing =
    !refusals.length && complete && CATALOG_FILES.every((n) => upload.includes(n)) && registryUploaded
  return { refusals, warnings, notes, upload, counts, health, registryEntries, fullyPassing }
}

// ---- retention and size ---------------------------------------------------------

export const dayOf = (ms) => new Date(ms).toISOString().slice(0, 10)

/** ISO-8601 week label, e.g. 2026-W39 (weeks start Monday, week 1 holds the first Thursday). */
export function isoWeek(ms) {
  const d = new Date(ms)
  const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
  const weekday = date.getUTCDay() || 7
  date.setUTCDate(date.getUTCDate() + 4 - weekday)
  const yearStart = Date.UTC(date.getUTCFullYear(), 0, 1)
  const week = Math.ceil(((date - yearStart) / DAY_MS + 1) / 7)
  return `${date.getUTCFullYear()}-W${String(week).padStart(2, '0')}`
}

/**
 * Which keys to delete, given every key in the bucket. Only the caller
 * decides whether to act on it: after a push that passed every check.
 *   daily/<day>/  kept for KEEP_DAYS days, but the newest MIN_DAILY complete
 *                 days (with a meta.json) are never deleted, however old.
 *   weekly/<wk>/  the newest KEEP_WEEKS weeks are kept.
 */
export function planRetention(keys, nowMs, { keepDays = KEEP_DAYS, minDaily = MIN_DAILY, keepWeeks = KEEP_WEEKS } = {}) {
  const daily = new Map()
  const weekly = new Map()
  for (const key of keys) {
    let m = /^daily\/(\d{4}-\d{2}-\d{2})\//.exec(key)
    if (m) {
      if (!daily.has(m[1])) daily.set(m[1], [])
      daily.get(m[1]).push(key)
      continue
    }
    m = /^weekly\/(\d{4}-W\d{2})\//.exec(key)
    if (m) {
      if (!weekly.has(m[1])) weekly.set(m[1], [])
      weekly.get(m[1]).push(key)
    }
  }
  const complete = [...daily.keys()].filter((day) => daily.get(day).some((k) => k.endsWith('/meta.json'))).sort().reverse()
  const protectedDays = new Set(complete.slice(0, minDaily))
  const cutoff = dayOf(nowMs - keepDays * DAY_MS)
  const remove = []
  for (const [day, dayKeys] of daily) {
    if (day <= cutoff && !protectedDays.has(day)) remove.push(...dayKeys)
  }
  const weeks = [...weekly.keys()].sort().reverse()
  for (const week of weeks.slice(keepWeeks)) remove.push(...weekly.get(week))
  return remove.sort()
}

/** Bucket total after `writes` ([{ key, size }]) replace or add to `objects` (Map key -> size). */
export function projectSize(objects, writes) {
  const after = new Map(objects)
  for (const { key, size } of writes) after.set(key, size)
  let total = 0
  for (const size of after.values()) total += size
  return total
}

/** wrangler's "293 MB" / "1.2 GB" / "0 B" into bytes (decimal units), or null. */
export function parseHumanSize(value) {
  if (typeof value === 'number') return value
  const m = /^\s*([\d.]+)\s*([kKMGT]?i?B)\s*$/.exec(String(value || ''))
  if (!m) return null
  const unit = m[2].toUpperCase().replace('I', '')
  const power = { B: 0, KB: 1, MB: 2, GB: 3, TB: 4 }[unit]
  if (power == null) return null
  return Math.round(Number(m[1]) * (m[2].includes('i') ? 1024 : 1000) ** power)
}
