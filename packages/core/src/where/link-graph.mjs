/**
 * The internal link graph of a Where site, from its shard records: which
 * page links to which, counted once per pair. The directories and the year,
 * season and genre lists are left out on purpose: the question is whether a
 * page is linked from the pages that are about something.
 *
 * Pure. Used by scripts/measure-where.mjs.
 */

const TYPES = { anime: 'title', 'voice-actor': 'voice', staff: 'staff', studio: 'studio', artist: 'artist', 'watch-order': 'watch' }

/** 'title', 'voice', ... for an internal path, or null. */
export const typeOfPath = (path) => TYPES[String(path || '').split('/')[1]] || null

const hrefs = (list, key = 'href') => (list || []).map((row) => row && row[key]).filter(Boolean)

/** Every link a title record's page draws: { internal: [paths], similar: [paths], outside: n }. */
export function titleLinks(r) {
  const cast = r.cast || []
  const watch = r.watch
  const internal = [
    ...cast.flatMap((c) => hrefs(c.voices)),
    ...(r.dubs || []).flatMap((d) => hrefs(d.voices)),
    ...(r.key || []).flatMap((k) => hrefs(k.people)),
    ...hrefs(r.crew),
    ...hrefs(r.studios),
    ...(r.songs || []).flatMap((s) => hrefs(s.artists)),
    ...(watch ? [watch.href, watch.prev?.href, watch.next?.href, ...hrefs(watch.thread?.steps)] : []),
    ...hrefs(r.related),
    ...hrefs(r.recs),
    ...hrefs(r.similar),
  ].filter(Boolean)
  return { internal, similar: hrefs(r.similar), outside: cast.filter((c) => c.face).length + (r.cross || []).length }
}

/** A person record's links, from the pages it has. */
export function personLinks(p) {
  const voice = p.voicePage ? hrefs(p.roles) : []
  const staff = p.staffPage ? [...(p.works || []).flatMap((g) => hrefs(g.items)), ...hrefs(p.collaborators)] : []
  return { internal: [...voice, ...staff], outside: p.voicePage ? (p.roles || []).filter((r) => r.character?.face).length : 0 }
}

const blankStat = () => ({ pages: 0, noindex: 0, noTitleLink: 0, noLink: 0, oneLink: 0, max: 0, top: '' })

/**
 * records: { titles, people, studios, artists, watch } (shard records).
 * Returns { types: { title: { pages, noindex, noTitleLink, noLink, oneLink,
 * max, top }, ... }, similar: { max, top, never, shown }, outside, toNoindex }.
 * A noindexed page is counted in `noindex` and left out of the other columns.
 */
export function linkGraph({ titles = [], people = [], studios = [], artists = [], watch = [] }) {
  const pages = new Map() // path -> { type, noindex }
  const add = (path, noindex = false) => path && pages.set(path, { type: typeOfPath(path), noindex: !!noindex })
  for (const t of titles) add(`/anime/${t.slug}`, t.noindex)
  for (const p of people) {
    if (p.voicePage) add(p.voiceHref, p.noindexVoice)
    if (p.staffPage) add(p.staffHref, p.noindexStaff)
  }
  for (const s of studios) add(`/studio/${s.slug}`, s.noindex)
  for (const a of artists) add(`/artist/${a.slug}`, a.noindex)
  for (const w of watch) add(`/watch-order/${w.slug}`)

  const fromTitles = new Map()
  const fromAll = new Map()
  const similarIn = new Map()
  let outside = 0
  let toNoindex = 0
  const count = (map, from, links) => {
    for (const to of new Set(links)) {
      if (to === from || !pages.has(to)) continue
      map.set(to, (map.get(to) || 0) + 1)
    }
  }
  const walk = (from, links, isTitle) => {
    if (pages.get(from)?.noindex) return
    toNoindex += [...new Set(links.internal)].filter((to) => pages.get(to)?.noindex).length
    outside += links.outside || 0
    count(fromAll, from, links.internal)
    if (isTitle) count(fromTitles, from, links.internal)
  }
  for (const t of titles) {
    const links = titleLinks(t)
    walk(`/anime/${t.slug}`, links, true)
    count(similarIn, `/anime/${t.slug}`, links.similar)
  }
  for (const p of people) {
    const links = personLinks(p)
    // One record, up to two pages: the voice page carries the roles, the staff page the works.
    if (p.voicePage) walk(p.voiceHref, { internal: [...hrefs(p.roles), ...hrefs(p.costars), ...hrefs(p.voiceStudios)], outside: links.outside }, false)
    if (p.staffPage) walk(p.staffHref, { internal: [...(p.works || []).flatMap((g) => hrefs(g.items)), ...hrefs(p.collaborators), ...hrefs(p.staffStudios)] }, false)
  }
  for (const s of studios) walk(`/studio/${s.slug}`, { internal: [...hrefs(s.works), ...hrefs(s.directors), ...hrefs(s.composers)] }, false)
  for (const a of artists) walk(`/artist/${a.slug}`, { internal: (a.songs || []).map((song) => song.anime?.href).filter(Boolean) }, false)
  for (const w of watch) walk(`/watch-order/${w.slug}`, { internal: hrefs(w.entries) }, false)

  const types = {}
  for (const [path, page] of pages) {
    const stat = (types[page.type] ||= blankStat())
    if (page.noindex) {
      stat.noindex++
      continue
    }
    stat.pages++
    const all = fromAll.get(path) || 0
    if (!fromTitles.get(path)) stat.noTitleLink++
    if (!all) stat.noLink++
    if (all === 1) stat.oneLink++
    if (all > stat.max) {
      stat.max = all
      stat.top = path
    }
  }
  const similarTop = [...similarIn].sort((a, b) => b[1] - a[1])[0] || ['', 0]
  return {
    types,
    similar: { max: similarTop[1], top: similarTop[0], shown: similarIn.size, never: titles.length - similarIn.size },
    outside,
    toNoindex,
  }
}
