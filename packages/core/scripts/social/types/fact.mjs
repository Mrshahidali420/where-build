/**
 * "Fact card": one fact from a title's record, set very large.
 *
 * Data: only what the record states. Its all-time rank on AniList (rated or
 * popular), its average score, a long finished run, or that it is an
 * original story. A fact the record lacks is never offered. One post per
 * title and fact, and the title then rests for the 30-day title gap.
 *
 * Image: cream paper and type. The figure, a flat bar of the accent colour,
 * the sentence, and the title with a small cover at the foot.
 */
import { clip, fitSize, sentence } from '../text.mjs'
import { aboutOf, byPopularity, ctaOf, genresLine, akaLine, single, streamsLine, top, usable } from './shared.mjs'

export const MIN_POPULARITY = 15_000
const TOP_RANK = 100
const HIGH_SCORE = 80
const LONG_RUN = 100
const COVER = { width: 270, height: 382 }
const FIGURE_STEPS = [[2, 290], [3, 250], [4, 206], [5, 164], [8, 108]]
const CTA = 'More about it and where to watch: link in the first comment'

/** "#12" needs a spoken form in a sentence. */
const place = (rank) => (rank === 1 ? 'the' : `number ${rank} among the`)

/** Every fact the record supports: [{ kind, figure, line, say: [two wordings] }]. */
export function factsOf(t) {
  const facts = []
  const rated = t.ranks.find((r) => r.type === 'RATED' && r.rank <= TOP_RANK)
  const popular = t.ranks.find((r) => r.type === 'POPULAR' && r.rank <= TOP_RANK)
  if (rated)
    facts.push({
      kind: 'rated',
      figure: `#${rated.rank}`,
      line: 'highest rated anime of all time on AniList',
      say: [`${t.title} is ${place(rated.rank)} highest rated anime of all time on AniList.`, `On AniList's all-time rating chart, ${t.title} sits at number ${rated.rank}.`],
    })
  if (popular)
    facts.push({
      kind: 'popular',
      figure: `#${popular.rank}`,
      line: 'most popular anime of all time on AniList',
      say: [`${t.title} is ${place(popular.rank)} most popular anime of all time on AniList.`, `On AniList's all-time popularity chart, ${t.title} sits at number ${popular.rank}.`],
    })
  if (t.score >= HIGH_SCORE)
    facts.push({
      kind: 'score',
      figure: `${t.score}%`,
      line: 'average score from AniList users',
      say: [`AniList users give ${t.title} an average score of ${t.score}%.`, `${t.title} holds an average score of ${t.score}% on AniList.`],
    })
  if (t.status === 'FINISHED' && t.episodes >= LONG_RUN && t.year && t.endYear)
    facts.push({
      kind: 'run',
      figure: String(t.episodes),
      line: `episodes, from ${t.year} to ${t.endYear}`,
      say: [`${t.title} ran for ${t.episodes} episodes, from ${t.year} to ${t.endYear}.`, `${t.episodes} episodes: that is how long ${t.title} ran, from ${t.year} to ${t.endYear}.`],
    })
  if (t.source === 'ORIGINAL')
    facts.push({
      kind: 'original',
      figure: 'Original',
      line: 'story: not adapted from a manga, a novel or a game',
      say: [`${t.title} is an original anime, not an adaptation of a manga, a novel or a game.`, `No manga or novel came first: ${t.title} is an original anime.`],
    })
  return facts
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
    platforms: top(title.platforms),
    art: { hero: title.image },
    view: { figure: fact.figure, line: fact.line, title: clip(title.title, 60), meta: clip(metaOf(title), 44), about: { ...aboutOf(title, { genres: 2, alt: false }), rating: fact.kind === 'score' ? null : title.rating } },
  }
}

function find(data) {
  return data.titles
    .filter((t) => t.popularity >= MIN_POPULARITY && t.platforms.length && usable(t))
    .sort(byPopularity)
    .flatMap((t) => factsOf(t).map((fact) => toPost(t, fact)))
}

const captions = [
  (p) => ({ hook: `💡 Did you know? ${p.say[0]}`, facts: [p.about, streamsLine(p.platforms), ...p.more], cta: ctaOf('watch', 0) }),
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
    k.display({ fontSize: fitSize(v.figure, FIGURE_STEPS), fontWeight: k.f.displayBlack, lineHeight: 1, marginTop: 44, marginLeft: -8 }, v.figure),
    k.box({ width: 220, height: 22, backgroundColor: t.block, marginTop: 26 }),
    k.display({ ...k.clamp(3), fontSize: v.line.length > 44 ? 48 : 58, lineHeight: 1.14, marginTop: 30, maxWidth: 920 }, v.line),
    k.fill(),
    k.row(
      { alignItems: 'flex-end', marginBottom: 26 },
      k.art(v.art.hero, COVER.width, COVER.height),
      k.col({ marginLeft: 34, width: 650 }, k.display({ ...k.clamp(2), fontSize: v.title.length > 26 ? 40 : 52, lineHeight: 1.1 }, v.title), k.body({ fontSize: 26, color: t.soft, marginTop: 8 }, v.meta), k.about(v.about, t, { size: 26, width: 650, style: { marginTop: 14 } })),
    ),
  )
}

export default { key: 'fact', name: 'Fact card', urgent: false, gapDays: 300, titleGap: true, window: 150, find, captions, questions, tags: (p) => p.tags, template }
