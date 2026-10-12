/**
 * "Fact card": the one fact about a title that is worth stopping for.
 *
 * Data: only what the record states. Every fact a title supports is given a
 * strength, and only the strongest is offered: a place in the top 50 of
 * AniList's all-time charts, a long run counted in episodes or in years, or
 * a very high average score. A title with no strong fact gets no card. (The
 * record holds no trustworthy yearly or seasonal rank, so those are not
 * used.) One post per title and fact, and the title then rests for the
 * 30-day title gap.
 *
 * Image: cream paper and type. The figure is the surprising part; the
 * sentence under it names the title; the cover and the labelled lines sit
 * at the foot.
 */
import { clip, fitSize, sentence } from '../text.mjs'
import { akaLine, aboutOf, byPopularity, ctaOf, genresLine, single, streamsLine, top, usable } from './shared.mjs'

export const MIN_POPULARITY = 15_000
export const TOP_RANK = 50
export const LONG_RUN = 100
export const LONG_YEARS = 8
export const HIGH_SCORE = 88
const NAME_MAX = 46
const COVER = { width: 290, height: 410 }
const FIGURE_STEPS = [[2, 290], [3, 250], [4, 206], [5, 164], [8, 124], [10, 104]]
const CTA = 'More about it and where to watch: link in the first comment'

const nth = (rank) => (rank === 1 ? 'the' : `the number ${rank}`)

/**
 * Every strong fact the record supports, strongest first:
 * [{ kind, strength, figure, line, say: [two wordings] }]. `line` goes on
 * the image and names the title; `say` opens the caption.
 */
export function factsOf(t) {
  const name = clip(t.title, NAME_MAX)
  const facts = []
  const rated = t.ranks.find((r) => r.type === 'RATED' && r.rank <= TOP_RANK)
  const popular = t.ranks.find((r) => r.type === 'POPULAR' && r.rank <= TOP_RANK)
  const years = t.status === 'FINISHED' && t.year && t.endYear ? t.endYear - t.year : 0
  if (rated)
    facts.push({
      kind: 'rated',
      strength: 100 - rated.rank,
      figure: `#${rated.rank}`,
      line: `${name} is ${nth(rated.rank)} highest rated anime of all time on AniList`,
      say: [`${t.title} is ${nth(rated.rank)} highest rated anime of all time on AniList.`, `On AniList's all-time rating chart, ${t.title} sits at number ${rated.rank}.`],
    })
  if (popular)
    facts.push({
      kind: 'popular',
      strength: 95 - popular.rank,
      figure: `#${popular.rank}`,
      line: `${name} is ${nth(popular.rank)} most popular anime of all time on AniList`,
      say: [`${t.title} is ${nth(popular.rank)} most popular anime of all time on AniList.`, `On AniList's all-time popularity chart, ${t.title} sits at number ${popular.rank}.`],
    })
  if (t.status === 'FINISHED' && t.episodes >= LONG_RUN && t.year && t.endYear)
    facts.push({
      kind: 'run',
      strength: 55 + Math.min(35, Math.round(t.episodes / 25)),
      figure: String(t.episodes),
      line: `episodes of ${name}, aired from ${t.year} to ${t.endYear}`,
      say: [`${t.title} ran for ${t.episodes} episodes, from ${t.year} to ${t.endYear}.`, `${t.episodes} episodes: that is how long ${t.title} ran, from ${t.year} to ${t.endYear}.`],
    })
  if (years >= LONG_YEARS)
    facts.push({
      kind: 'years',
      strength: 50 + Math.min(35, years),
      figure: `${years} years`,
      line: `on air: ${name} ran from ${t.year} to ${t.endYear}`,
      say: [`${t.title} was on air for ${years} years, from ${t.year} to ${t.endYear}.`, `${years} years: ${t.title} ran from ${t.year} to ${t.endYear}.`],
    })
  if (t.score >= HIGH_SCORE)
    facts.push({
      kind: 'score',
      strength: 45 + (t.score - HIGH_SCORE) * 3,
      figure: t.rating,
      line: `out of 10: the average score AniList users give ${name}`,
      say: [`AniList users give ${t.title} an average score of ${t.rating} out of 10.`, `${t.title} holds an average score of ${t.rating} out of 10 on AniList.`],
    })
  return facts.sort((x, y) => y.strength - x.strength)
}

const metaOf = (t) => [t.noun, t.year, t.studio].filter(Boolean).join(' · ')

function toPost(title, fact) {
  return {
    ...single(title),
    item: `fact:${title.id}:${fact.kind}`,
    label: 'Where to watch it',
    say: fact.say,
    // The score is the fact itself on a score card, so it is not said twice.
    more: [fact.kind !== 'score' && title.rating && `It holds ${title.rating} out of 10 on AniList.`, genresLine(title), akaLine(title)],
    about: title.year && title.noun ? sentence(`It is ${/^[aeiou]/i.test(title.noun) ? 'an' : 'a'} ${title.noun} from ${title.year}${title.studio ? `, made by ${title.studio}` : ''}`) : null,
    streams: streamsLine(top(title.platforms)),
    platforms: top(title.platforms),
    art: { hero: title.image },
    view: { figure: fact.figure, line: fact.line, meta: clip(metaOf(title), 44), about: { ...aboutOf(title, { genres: 2, alt: false }), rating: fact.kind === 'score' ? null : title.rating } },
  }
}

function find(data) {
  return data.titles
    .filter((t) => t.popularity >= MIN_POPULARITY && t.platforms.length && usable(t))
    .sort(byPopularity)
    .flatMap((t) => factsOf(t).slice(0, 1).map((fact) => toPost(t, fact)))
}

const captions = [
  (p) => ({ hook: `💡 Did you know? ${p.say[0]}`, facts: [p.streams, p.about, ...p.more], cta: ctaOf('watch', 0) }),
  (p) => ({ hook: `📊 ${p.say[1]}`, facts: [streamsLine(p.platforms, 'You can watch it on'), ...p.more], cta: ctaOf('watch', 1) }),
  (p) => ({ hook: `💡 Anime fact: ${p.say[0]}`, facts: [streamsLine(p.platforms, 'Official streams:'), ...p.more], cta: ctaOf('watch', 2) }),
]

const questions = [(p) => `Did you know that about ${p.title}?`, (p) => `Where does ${p.title} sit on your own list?`, (p) => `Has ${p.title} earned its place, in your view?`]

function template(v, k) {
  const t = k.tone('light')
  return k.page(
    t,
    { cta: CTA },
    k.kicker('Anime fact', { color: t.soft }),
    k.rule(t.line, 2, { marginTop: 20 }),
    k.display({ fontSize: fitSize(v.figure, FIGURE_STEPS), fontWeight: k.f.displayBlack, lineHeight: 1, marginTop: 40, marginLeft: -8 }, v.figure),
    k.box({ width: 220, height: 22, backgroundColor: t.block, marginTop: 24 }),
    k.display({ ...k.clamp(4), fontSize: v.line.length > 70 ? 46 : 54, lineHeight: 1.14, marginTop: 28, maxWidth: 936 }, v.line),
    k.fill(),
    k.row(
      { alignItems: 'flex-end', marginBottom: 26 },
      k.art(v.art.hero, COVER.width, COVER.height),
      k.col({ marginLeft: 34, width: 612 }, k.body({ fontSize: 26, color: t.soft, fontWeight: k.f.textBold }, v.meta), k.about(v.about, t, { size: 26, width: 612, style: { marginTop: 14 } })),
    ),
  )
}

export default { key: 'fact', name: 'Fact card', urgent: false, gapDays: 300, titleGap: true, window: 150, find, captions, questions, tags: (p) => p.tags, template }
