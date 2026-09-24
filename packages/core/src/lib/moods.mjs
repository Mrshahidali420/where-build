/**
 * "What are you in the mood for?"
 *
 * A reader almost never arrives knowing the title. They arrive knowing the
 * feeling: they want revenge, or they want something quiet, or they want the
 * hero to already be strong. Genres do not say that. Tags nearly do.
 *
 * So each mood below is a small hand-written recipe over the tags and genres
 * AniList already gives us. Nothing here is fetched, and nothing is a guess:
 * a title appears under a mood only because it carries those exact tags.
 *
 * This file imports nothing, so the Worker can run it at request time.
 */

/**
 * Every mood.
 *
 *   ask     the words on the quiz button, in a reader's voice
 *   title   the heading, and the thing a search engine sees
 *   tags    AniList tags that count toward the match
 *   genres  AniList genres that count toward the match
 *   need    how many of those a title must carry to qualify
 *   avoid   tags that disqualify a title outright
 *   blurb   one plain sentence that explains the mood on the page
 */
export const MOODS = [
  {
    slug: 'revenge',
    ask: 'I want someone to get even',
    title: 'Revenge',
    tags: ['Revenge', 'Anti-Hero', 'Tragedy', 'Assassins'],
    genres: ['Action', 'Drama'],
    need: 2,
    blurb:
      'Somebody was wronged, and the whole story is them paying it back. Cold heads, long plans, and a debt that gets collected.',
  },
  {
    slug: 'overpowered-hero',
    ask: 'I want the hero to already be strong',
    title: 'An overpowered main character',
    tags: ['Super Power', 'Cultivation', 'Martial Arts', 'Anti-Hero', 'Swordplay'],
    genres: ['Action'],
    need: 2,
    blurb:
      'No long training arc. The lead is already far above everyone else, and the fun is watching the room work that out.',
  },
  {
    slug: 'second-chance',
    ask: 'I want a second chance at life',
    title: 'A second chance at life',
    tags: ['Reincarnation', 'Time Manipulation', 'Age Regression', 'Time Skip'],
    genres: [],
    need: 1,
    blurb:
      'The lead dies, or wakes up years younger, and gets to run their life again knowing how it ended the first time.',
  },
  {
    slug: 'another-world',
    ask: 'I want to be dropped into another world',
    title: 'Pulled into another world',
    tags: ['Isekai', 'Reincarnation', 'Virtual World', 'Video Games'],
    genres: ['Fantasy'],
    need: 2,
    blurb:
      'An ordinary person from our world wakes up somewhere with magic, levels or a throne, and has to learn the rules fast.',
  },
  {
    slug: 'villainess',
    ask: 'I want palace scheming',
    title: 'Villainesses and royal courts',
    tags: ['Villainess', 'Royal Affairs', 'Politics', 'Historical', 'Female Protagonist'],
    genres: ['Romance', 'Drama'],
    need: 3,
    blurb:
      'Dresses, titles and knives under the table. The fight is won with a sentence at dinner, not a sword.',
  },
  {
    slug: 'quiet-and-warm',
    ask: 'I want something calm',
    title: 'Quiet and warm',
    tags: ['Iyashikei', 'Cute Girls Doing Cute Things', 'Rural', 'Family Life', 'Found Family'],
    genres: ['Slice of Life'],
    need: 2,
    avoid: ['Gore', 'Body Horror', 'Tragedy'],
    blurb:
      'Nothing terrible happens. People cook, work, talk and grow up. Read it when the day was already hard enough.',
  },
  {
    slug: 'dark-and-heavy',
    ask: 'I want something dark',
    title: 'Dark and heavy',
    tags: ['Gore', 'Body Horror', 'Tragedy', 'Dystopian', 'Philosophy'],
    genres: ['Horror', 'Psychological', 'Thriller'],
    need: 2,
    blurb:
      'Cruel worlds and people who do not get out clean. Strong stories, but not a light evening.',
  },
  {
    slug: 'love-that-hurts',
    ask: 'I want a romance that hurts',
    title: 'Romance that hurts',
    tags: ['Tragedy', 'Love Triangle', 'Age Gap', 'Heterosexual'],
    genres: ['Romance', 'Drama'],
    need: 3,
    blurb:
      'Two people who want each other and keep missing. Expect to be annoyed at them and to keep reading anyway.',
  },
  {
    slug: 'make-me-laugh',
    ask: 'I want to laugh',
    title: 'Something funny',
    tags: ['Slapstick', 'Parody', 'Surreal Comedy', 'Meta'],
    genres: ['Comedy'],
    need: 2,
    avoid: ['Gore', 'Tragedy'],
    blurb:
      'Jokes first, plot second. Short chapters, silly people, and nothing that needs you to remember last week.',
  },
  {
    slug: 'sword-fights',
    ask: 'I want sword fights',
    title: 'Swords and martial arts',
    tags: ['Swordplay', 'Martial Arts', 'Wuxia', 'Cultivation', 'Medieval'],
    genres: ['Action'],
    need: 2,
    blurb:
      'Schools, styles, duels and a ranking everyone argues about. The whole story is people getting better at fighting.',
  },
  {
    slug: 'survive-the-end',
    ask: 'I want to survive the end of the world',
    title: 'Surviving the end of the world',
    tags: ['Survival', 'Post-Apocalyptic', 'Dystopian', 'Monsters', 'Gore'],
    genres: ['Horror', 'Action'],
    need: 2,
    blurb:
      'The world already broke. Food, shelter and who you trust matter more than any power the lead picks up.',
  },
  {
    slug: 'solve-a-mystery',
    ask: 'I want to solve a mystery',
    title: 'Mysteries and detectives',
    tags: ['Detective', 'Crime', 'Philosophy', 'Gangs'],
    genres: ['Mystery', 'Thriller', 'Psychological'],
    need: 2,
    blurb:
      'A question at the start and an answer at the end. Clues on the page, so you can try to get there first.',
  },
  {
    slug: 'school-days',
    ask: 'I want school life',
    title: 'School days',
    tags: ['School', 'School Club', 'Coming of Age', 'Primarily Teen Cast', 'Bullying'],
    genres: [],
    need: 2,
    blurb:
      'Classrooms, clubs, exams and the people you are stuck with for three years. Growing up is the whole plot.',
  },
  {
    slug: 'dungeons-and-levels',
    ask: 'I want dungeons and levels',
    title: 'Dungeons, gates and levels',
    tags: ['Dungeon', 'Video Games', 'Virtual World', 'Super Power', 'Urban Fantasy'],
    genres: ['Action', 'Fantasy'],
    need: 2,
    blurb:
      'Monsters come through a gate, the lead gets a status window, and the numbers go up. The core manhwa shape.',
  },
  {
    slug: 'found-family',
    ask: 'I want a group I can root for',
    title: 'A group worth rooting for',
    tags: ['Found Family', 'Ensemble Cast', 'Coming of Age'],
    genres: ['Adventure', 'Drama'],
    need: 2,
    blurb:
      'People who did not start out together and end up carrying each other. The friendships are the point.',
  },
  {
    slug: 'gods-and-myths',
    ask: 'I want gods and old myths',
    title: 'Gods, demons and old myths',
    tags: ['Gods', 'Mythology', 'Demons', 'Youkai', 'Philosophy'],
    genres: ['Supernatural', 'Fantasy'],
    need: 2,
    blurb:
      'Old powers with their own rules, and humans caught between them. Big scale, long memory.',
  },
  {
    slug: 'power-and-politics',
    ask: 'I want power and politics',
    title: 'Power, war and politics',
    tags: ['Politics', 'War', 'Military', 'Historical', 'Royal Affairs'],
    genres: ['Drama', 'Action'],
    need: 2,
    blurb:
      'Armies, borders and rooms where a few people decide what happens to everyone else.',
  },
  {
    slug: 'lgbtq-stories',
    ask: 'I want an LGBTQ+ story',
    title: 'LGBTQ+ stories',
    tags: ['LGBTQ+ Themes', "Boys' Love", 'Yuri'],
    genres: [],
    need: 1,
    blurb:
      'Romance and friendship between men, or between women, told as the main story rather than a side note.',
  },
]

export const findMood = (slug) => MOODS.find((m) => m.slug === slug)

/**
 * How well one title fits one mood.
 *
 * One point per matching tag, one per matching genre. A title must reach
 * `need` points or it does not belong on the page at all. We would rather
 * show 30 right answers than 300 loose ones.
 */
export function moodScore(item, mood) {
  const tags = item.tags || []
  const genres = item.genres || []
  if (mood.avoid && mood.avoid.some((t) => tags.includes(t))) return 0

  let score = 0
  for (const t of mood.tags) if (tags.includes(t)) score += 1
  for (const g of mood.genres) if (genres.includes(g)) score += 1
  return score >= mood.need ? score : 0
}

/**
 * The list for one mood, best fit first.
 *
 * Ties are broken by how many people read it, because between two titles that
 * match the mood equally well, the popular one is the safer recommendation.
 */
export function pickForMood(items, mood, limit = 24) {
  return items
    .map((item) => ({ item, score: moodScore(item, mood) }))
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score || (b.item.popularity || 0) - (a.item.popularity || 0))
    .slice(0, limit)
    .map((row) => row.item)
}
