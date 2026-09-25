/**
 * Anime by mood: "what do I want to feel tonight", answered from the tags and
 * genres AniList already gives every show. The same idea as the home site's
 * mood lists (src/lib/moods.mjs, whose scoring this uses), with recipes and
 * words written for anime: a viewer picks a show by its episodes, its studio
 * and how it looks in motion, not by its chapters.
 *
 * A show appears under a mood only because it carries those exact tags, and
 * a mood whose recipe finds fewer than its gate's `min` shows gets no page.
 *
 *   slug    the address, /mood/<slug>
 *   title   the heading, "Anime for ..." in the page title
 *   ask     the button words on the index, in a viewer's voice
 *   tags    AniList tags that count toward the match
 *   genres  AniList genres that count toward the match
 *   need    how many of those a show must carry
 *   avoid   tags that keep a show out
 *   intro   the page's own opening, different for every mood
 *
 * Pure.
 */
import { moodScore } from '../lib/moods.mjs'

export const ANIME_MOODS = [
  {
    slug: 'revenge',
    title: 'Revenge anime',
    ask: 'Someone has to pay',
    tags: ['Revenge', 'Anti-Hero', 'Tragedy', 'Assassins'],
    genres: ['Action', 'Drama', 'Thriller'],
    need: 3,
    intro:
      'Shows built around a debt that gets collected. A family is lost, a friend betrays the lead, and every episode after that is one more step of the plan. Expect cold leads, slow burns and finales that land hard.',
  },
  {
    slug: 'overpowered-hero',
    title: 'Anime with an overpowered main character',
    ask: 'The hero is already the strongest',
    tags: ['Super Power', 'Magic', 'Anti-Hero', 'Swordplay', 'Isekai'],
    genres: ['Action', 'Fantasy'],
    need: 3,
    avoid: ['Tragedy'],
    intro:
      'No training arc, no losing the first big fight. The lead walks in already far above everyone, and the fun is watching the rest of the cast slowly work that out. Good for an evening when you want the fights to feel easy.',
  },
  {
    slug: 'isekai',
    title: 'Isekai anime: pulled into another world',
    ask: 'Drop me into another world',
    tags: ['Isekai', 'Reincarnation', 'Virtual World', 'Video Games'],
    genres: ['Fantasy', 'Adventure'],
    need: 2,
    intro:
      'An ordinary person from our world wakes up somewhere with magic, levels, a status screen or a throne, and has to learn the rules fast. Some play it for laughs, some for strategy, a few for real horror.',
  },
  {
    slug: 'second-chance',
    title: 'Anime about a second chance at life',
    ask: 'Let them live it again',
    tags: ['Reincarnation', 'Time Manipulation', 'Time Loop', 'Age Regression'],
    genres: [],
    need: 1,
    intro:
      'Someone dies, rewinds or wakes up years younger, and runs their life again knowing how it went the first time. Loops, do-overs and reincarnations, from fantasy kingdoms to high school.',
  },
  {
    slug: 'quiet-and-warm',
    title: 'Calm, cosy anime to unwind with',
    ask: 'Something calm and warm',
    tags: ['Iyashikei', 'Cute Girls Doing Cute Things', 'Food', 'Rural', 'Camping', 'Family Life'],
    genres: ['Slice of Life'],
    need: 2,
    avoid: ['Gore', 'Tragedy', 'Torture'],
    intro:
      'Low stakes and soft colours. Tea, camping trips, small towns, good meals and friends who talk about nothing much. The kind of episode you put on to slow your heart rate down at the end of a day.',
  },
  {
    slug: 'dark-and-heavy',
    title: 'Dark and heavy anime',
    ask: 'Something dark and heavy',
    tags: ['Tragedy', 'Gore', 'Survival', 'Death Game', 'Dystopian', 'Suicide'],
    genres: ['Psychological', 'Horror', 'Drama'],
    need: 3,
    intro:
      'Shows that do not look away. Characters die and stay dead, choices cost something, and the world is usually worse than the lead thought. Worth it when you want a story to stay with you after the credits.',
  },
  {
    slug: 'make-me-laugh',
    title: 'Funny anime to make you laugh',
    ask: 'Just make me laugh',
    tags: ['Parody', 'Satire', 'Surreal Comedy', 'Slapstick'],
    genres: ['Comedy'],
    need: 2,
    avoid: ['Tragedy'],
    intro:
      'Gag shows, parodies and comedies built on timing. Short episodes you can watch three of in a row, and casts whose whole job is to make each other look ridiculous.',
  },
  {
    slug: 'romance',
    title: 'Romance anime that make your heart race',
    ask: 'A love story',
    tags: ['Love Triangle', 'Heterosexual', 'Female Protagonist', 'Coming of Age', 'School'],
    genres: ['Romance'],
    need: 3,
    intro:
      'Confessions that take twelve episodes, rivals in love, and the one moment the two leads finally say it. From school rom-coms to grown-up dramas, every show here puts the relationship first.',
  },
  {
    slug: 'love-that-hurts',
    title: 'Sad romance anime',
    ask: 'A love story that hurts',
    tags: ['Tragedy', 'Love Triangle', 'Coming of Age', 'Disability', 'Time Manipulation'],
    genres: ['Romance', 'Drama'],
    need: 3,
    intro:
      'Romances that do not promise a happy ending. Illness, distance, time or bad timing gets between the two leads, and the show is honest about what that costs. Keep tissues close.',
  },
  {
    slug: 'sword-fights',
    title: 'Anime with great sword fights',
    ask: 'Blades and duels',
    tags: ['Swordplay', 'Samurai', 'Martial Arts', 'Historical', 'Ninja'],
    genres: ['Action'],
    need: 2,
    intro:
      'Katanas, duels and the choreography that makes a single clash last a whole minute. Samurai eras, demon hunters and fantasy knights, chosen for how the fights are animated as much as for the story.',
  },
  {
    slug: 'giant-robots',
    title: 'Mecha anime with giant robots',
    ask: 'Giant robots',
    tags: ['Real Robot', 'Super Robot', 'Military', 'Space', 'War'],
    genres: ['Mecha'],
    need: 2,
    intro:
      'Pilots, cockpits and machines the size of buildings. Some are about the war the robots are built for, some about the kids made to fly them. Real robot or super robot, the mecha is the point.',
  },
  {
    slug: 'survive-the-end',
    title: 'Survival and post-apocalyptic anime',
    ask: 'Survive the end of the world',
    tags: ['Survival', 'Post-Apocalyptic', 'Zombie', 'Death Game', 'Dystopian'],
    genres: [],
    need: 2,
    intro:
      'The world has ended, or a game has started that only one side walks out of. Every episode is about staying alive one more day, and about who the characters turn into while they do it.',
  },
  {
    slug: 'solve-a-mystery',
    title: 'Mystery and detective anime',
    ask: 'A mystery to solve',
    tags: ['Detective', 'Crime', 'Conspiracy', 'Police'],
    genres: ['Mystery'],
    need: 2,
    intro:
      'A body, a locked room, a conspiracy or a game of wits between two geniuses. Shows that hand you the clues and dare you to get there before the reveal.',
  },
  {
    slug: 'sports',
    title: 'Sports anime that get you fired up',
    ask: 'A team to cheer for',
    tags: ['Basketball', 'Volleyball', 'Football', 'Baseball', 'Tennis', 'Swimming', 'Boxing', 'Cycling'],
    genres: ['Sports'],
    need: 2,
    intro:
      'Tournaments, rivals and the training montage before the big match. You will care about a volleyball serve more than you thought possible, and you do not need to know the rules to feel every point.',
  },
  {
    slug: 'found-family',
    title: 'Found family anime',
    ask: 'A crew that becomes family',
    tags: ['Found Family', 'Ensemble Cast', 'Pirates', 'Travel', 'Adoption'],
    genres: ['Adventure'],
    need: 2,
    intro:
      'A ship, a guild or a strange household that was never meant to be a family and becomes one anyway. Long journeys, loyal friends and the episode where one of them finally says it out loud.',
  },
  {
    slug: 'mind-bending',
    title: 'Mind-bending psychological anime',
    ask: 'Something that messes with my head',
    tags: ['Time Manipulation', 'Philosophy', 'Denpa', 'Dissociative Identities', 'Memory Manipulation'],
    genres: ['Psychological', 'Sci-Fi', 'Mystery'],
    need: 3,
    intro:
      'Time loops, unreliable narrators, and endings that send you straight back to episode one to check what you missed. For when you want to argue about a show afterwards.',
  },
  {
    slug: 'music-and-idols',
    title: 'Music and idol anime',
    ask: 'Songs, bands and stages',
    tags: ['Idol', 'Band'],
    genres: ['Music'],
    need: 1,
    intro:
      'Bands in garages, idol groups on their first stage, and the practice it takes to get there. Shows where the songs are half the reason to watch, and the openings are worth not skipping.',
  },
  {
    slug: 'space-and-sci-fi',
    title: 'Space and sci-fi anime',
    ask: 'Out into space',
    tags: ['Space', 'Space Opera', 'Aliens', 'Cyberpunk', 'Time Manipulation', 'Artificial Intelligence'],
    genres: ['Sci-Fi'],
    need: 2,
    intro:
      'Starships, far colonies, androids and neon cities. Science fiction in every size, from space operas that cross a galaxy to small stories about one person and one machine.',
  },
]

export const findAnimeMood = (slug) => ANIME_MOODS.find((m) => m.slug === slug)

/**
 * One mood's shows. A show must reach the recipe's `need`; past one point
 * more than that, a closer fit no longer outranks a show people actually
 * watch, so the list opens with the well-known answers rather than an obscure
 * short that happens to carry every tag.
 */
export function animeForMood(items, mood, limit) {
  const cap = mood.need + 1
  return items
    .map((item) => ({ item, score: Math.min(moodScore(item, mood), cap) }))
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score || (b.item.popularity || 0) - (a.item.popularity || 0) || a.item.id - b.item.id)
    .slice(0, limit)
    .map((row) => row.item)
}

/**
 * The moods that pass their gate: [{ mood, items }], each list at most
 * gate.per shows. A mood that finds fewer than gate.min shows in all is not
 * built (counted before the cap, so the cap never hides a real mood).
 */
export function buildMoods(items, gate, moods = ANIME_MOODS) {
  return moods
    .map((mood) => ({ mood, items: animeForMood(items, mood, Infinity) }))
    .filter((row) => row.items.length >= gate.min)
    .map((row) => ({ mood: row.mood, items: row.items.slice(0, gate.per) }))
}
