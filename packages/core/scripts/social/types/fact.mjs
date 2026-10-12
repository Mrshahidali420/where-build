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
import { byPopularity, streamsLine, top, usable } from './shared.mjs'

export const MIN_POPULARITY = 15_000
const TOP_RANK = 100
const HIGH_SCORE = 80
const LONG_RUN = 100
const COVER = { width: 170, height: 240 }
const FIGURE_STEPS = [[2, 330], [3, 290], [4, 230], [5, 180], [8, 118]]

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
    item: `fact:${title.id}:${fact.kind}`,
    title: title.title,
    path: title.path,
    label: 'Where to watch it',
    genre: title.genres[0],
    say: fact.say,
    about: title.year && title.noun ? sentence(`It is ${/^[aeiou]/i.test(title.noun) ? 'an' : 'a'} ${title.noun} from ${title.year}${title.studio ? `, made by ${title.studio}` : ''}`) : null,
    platforms: top(title.platforms),
    art: { hero: title.image },
    view: { figure: fact.figure, line: fact.line, title: clip(title.title, 60), meta: clip(metaOf(title), 44) },
  }
}

function find(data) {
  return data.titles
    .filter((t) => t.popularity >= MIN_POPULARITY && t.platforms.length && usable(t))
    .sort(byPopularity)
    .flatMap((t) => factsOf(t).map((fact) => toPost(t, fact)))
}

const captions = [
  (p) => [p.say[0], p.about, streamsLine(p.platforms)],
  (p) => [p.say[1], streamsLine(p.platforms, 'You can watch it on')],
  (p) => [p.say[0], streamsLine(p.platforms, 'Official streams:')],
]

function template(v, k) {
  const t = k.tone('light')
  return k.page(
    t,
    k.kicker('Anime fact', { color: t.soft }),
    k.rule(t.line, 2, { marginTop: 20 }),
    k.display({ fontSize: fitSize(v.figure, FIGURE_STEPS), fontWeight: k.f.displayBlack, lineHeight: 1, marginTop: 70, marginLeft: -8 }, v.figure),
    k.box({ width: 220, height: 22, backgroundColor: t.block, marginTop: 26 }),
    k.display({ fontSize: v.line.length > 44 ? 50 : 60, lineHeight: 1.14, marginTop: 34, maxWidth: 920 }, v.line),
    k.fill(),
    k.row(
      { alignItems: 'flex-end', marginBottom: 34 },
      k.art(v.art.hero, COVER.width, COVER.height),
      k.col({ marginLeft: 30, width: 720 }, k.display({ ...k.clamp(3), fontSize: v.title.length > 30 ? 32 : 40, lineHeight: 1.12 }, v.title), k.body({ fontSize: 26, color: t.soft, marginTop: 10 }, v.meta)),
    ),
  )
}

export default { key: 'fact', name: 'Fact card', urgent: false, gapDays: 300, titleGap: true, window: 150, find, captions, tags: (p) => ['anime', p.genre], template }
