/**
 * "Where to watch": every official streaming site of one popular title.
 *
 * Data: the official streaming links the title page lists (how many, and how
 * many are free to start), how much of the show is out, its rating, genres
 * and other name. The title then rests for the 30-day title gap.
 *
 * Image: the cover whole on the left; on the right the counted list of
 * sites, how much is out, and the rating, genres and other name. The title
 * under both, and the line that points at the first comment.
 */
import { clip, fitSize, listMore } from '../text.mjs'
import { INNER } from '../render/parts.mjs'
import { aboutOf, byPopularity, ctaOf, keyFacts, onPlatform, placeRows, placesColumn, placesHead, single, usable } from './shared.mjs'

export const MIN_POPULARITY = 15_000
const COVER = { width: 520, height: 740 }
const SIDE = INNER - COVER.width - 40
const CTA = 'Every official place to watch it: link in the first comment'

function stateOf(t) {
  if (t.status === 'FINISHED') return t.episodes > 1 ? `All ${t.episodes} episodes are out.` : 'It is out in full.'
  if (t.status === 'RELEASING') return 'It is currently airing.'
  return null
}

/** The year it came out, for a title with no episode count to show. */
const yearOf = (t) => (t.year ? { count: String(t.year), countLine: t.noun, byYear: true } : { count: null, countLine: null })

/** How much there is to watch, as a figure and a line; only what the record states. */
function lengthOf(t) {
  if (t.status === 'FINISHED') return t.episodes > 1 ? { count: String(t.episodes), countLine: 'episodes, completed' } : yearOf(t)
  if (t.status === 'RELEASING') return t.episodes > 1 ? { count: String(t.episodes), countLine: 'episodes planned, currently airing' } : yearOf(t)
  return yearOf(t)
}

function toPost(title) {
  const free = title.places.filter((p) => p.free).length
  const { rows, more } = placeRows(title.places)
  const { byYear, ...length } = lengthOf(title)
  return {
    ...single(title),
    item: String(title.id),
    label: 'Where to watch it',
    state: stateOf(title),
    names: title.places.slice(0, 3).map((p) => p.site),
    total: title.places.length,
    free: free > 0 ? `${free} of them ${free === 1 ? 'is' : 'are'} free to start.` : null,
    facts: keyFacts(title),
    art: { hero: title.image },
    view: {
      title: clip(title.title, 80),
      head: placesHead(title.places.length, free),
      sites: rows,
      more,
      ...length,
      about: aboutOf(title),
      meta: [title.noun, !byYear && title.year].filter(Boolean).join(' · '),
      // One line under the title: the story in a sentence, or else what the page counts.
      tagline: title.tagline || [stateOf(title), free > 0 && `${free} of its ${title.places.length} official ${title.places.length === 1 ? 'site is' : 'sites are'} free to start.`].filter(Boolean).join(' ') || null,
    },
  }
}

const find = (data) =>
  data.titles
    .filter((t) => t.popularity >= MIN_POPULARITY && t.platforms.length && (t.status === 'FINISHED' || t.status === 'RELEASING') && usable(t))
    .sort(byPopularity)
    .map(toPost)

const sites = (p) => listMore(p.names, p.total)

const captions = [
  (p) => ({ hook: `📺 Where can you watch ${p.title} legally?`, facts: [`It streams on ${sites(p)}.`, p.free, p.state, ...p.facts], cta: ctaOf('watch', 0) }),
  (p) => ({ hook: `🔎 Looking for ${p.title}? Here is every official stream.`, facts: [`Official streams: ${sites(p)}.`, p.free, p.state, ...p.facts], cta: ctaOf('watch', 1) }),
  (p) => ({ hook: `🍿 ${p.title}: where to watch it, officially.`, facts: [`You can watch it on ${sites(p)}.`, p.state, p.free, ...p.facts], cta: ctaOf('watch', 2) }),
]

const questions = [(p) => `Have you watched ${p.title} yet?`, (p) => onPlatform(p, 'Are you watching'), (p) => `Would you recommend ${p.title} to a friend?`]

function template(v, k) {
  const t = k.tone('dark')
  return k.page(
    t,
    { cta: CTA },
    k.row({ justifyContent: 'space-between', alignItems: 'flex-end' }, k.kicker('Where to watch', { color: t.pop }), k.kicker(v.meta, { color: t.soft, fontSize: 22, letterSpacing: 3 })),
    k.rule(t.line, 2, { marginTop: 20 }),
    k.row(
      { marginTop: 32, height: COVER.height, justifyContent: 'space-between' },
      k.box({ width: COVER.width, height: COVER.height, alignItems: 'flex-start' }, k.art(v.art.hero, COVER.width, COVER.height)),
      placesColumn(v, k, t, { width: SIDE, height: COVER.height }),
    ),
    k.display({ ...k.clamp(2), fontSize: fitSize(v.title, [[14, 84], [24, 68], [40, 54], [80, 42]]), marginTop: 30, maxWidth: INNER }, v.title),
    k.tagline(v.tagline, t, { marginTop: 10 }),
    k.fill(),
  )
}

export default { key: 'where', name: 'Where to watch', urgent: false, gapDays: 30, titleGap: true, window: 400, find, captions, questions, tags: (p) => p.tags, samples: (posts) => [posts.find((p) => p.total === 1), posts.find((p) => p.total >= 4)], template }
