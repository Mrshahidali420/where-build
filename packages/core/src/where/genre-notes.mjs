/**
 * One line per AniList genre, for the genre cards and pages: what a reader
 * gets from it, in plain words. A genre not listed here gets no line.
 */
export const GENRE_NOTES = {
  Action: 'Fights, chases and big set pieces, from shonen battles to heists.',
  Adventure: 'Journeys into the unknown: new worlds, long roads and found families.',
  Comedy: 'Shows built to make you laugh, from gag series to warm sitcoms.',
  Drama: 'Stories that lean on character and emotion, and hit hard.',
  Ecchi: 'Fan service and risqué humour, often mixed with comedy or romance.',
  Fantasy: 'Magic, other worlds and isekai, from sword and sorcery to cosy spells.',
  Horror: 'Monsters, curses and dread, made to unsettle.',
  'Mahou Shoujo': 'Magical girls who transform to fight, from classic to dark.',
  Mecha: 'Giant robots and the pilots inside them, from real robot war to super robots.',
  Music: 'Bands, idols and performers, with the songs at the heart of the story.',
  Mystery: 'Crimes, secrets and puzzles to solve alongside the characters.',
  Psychological: 'Mind games, obsession and minds under pressure.',
  Romance: 'Love stories, from first crushes to grown-up relationships.',
  'Sci-Fi': 'Space, future tech and speculative worlds.',
  'Slice of Life': 'Everyday life told gently: school, work, food and friendship.',
  Sports: 'Teams, rivals and the big match, whatever the sport.',
  Supernatural: 'Ghosts, spirits and powers hidden in the everyday world.',
  Thriller: 'High stakes and tension that keep you watching the next episode.',
}

export const genreNote = (name) => GENRE_NOTES[name] || ''
