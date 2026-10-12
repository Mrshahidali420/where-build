# Facebook posting plan (12 Oct 2026)

Covers both Pages: WhereAnime (where-build) and Manhwa Index (manhwaindex).
The poster itself is live since 12 Oct 2026. This plan grows it.

## Owner decisions

- Slow build-up, not "no limit from day one". Both Pages are new and the
  account was locked twice the same week.
- Target pace: 8 a day now, 15 a day from 19 Oct, one an hour (24) from 26 Oct,
  if reach stays healthy. Raise `FB_POSTS_PER_DAY` by hand at each step.
- Many templates: a different image design per post type, not one for all.
- Link stays in the first comment.
- No re-uploaded trailers. Reels are made from our own images and rankings.

## Phase 1: pace and image quality (ship first)

- [x] Hourly cron, one post per run, paced across the day up to the daily cap.
- [x] Daily cap ceiling raised from 12 to 24.
- [x] Largest cover image, never the small one.
- [x] Episode releases go first when slots are short.

## Phase 2: template images and post types

One renderer, one template per post type, 1080x1350, built on Actions and
uploaded as a file. Site fonts and colours. Editorial look: no pill badges, no
glows.

WhereAnime types
- [ ] New episode today (one per episode)
- [ ] Airing right now
- [ ] New anime starting (premiere)
- [ ] Coming next week (list)
- [ ] Coming next month (list)
- [ ] Most anticipated (ranking)
- [ ] Character spotlight
- [ ] Fact card
- [ ] Where to watch

Manhwa Index types
- [ ] Where to read
- [ ] New title or new volume
- [ ] Ranking (top by genre, top ongoing)
- [ ] Character spotlight
- [ ] Fact card
- [ ] What to read next

Gate: samples of every template are shown to the owner before a type goes live.

## Phase 3: reels

- [ ] Short vertical video from our own images: "Top 5 airing this week",
      "Coming next month", rankings. Built with ffmpeg on Actions.
- [ ] Publish through the Page Reels API.

## Phase 4: replies and stats

- [ ] Auto-reply to comments, few and varied.
- [ ] Facebook tab in /my-admin: posts, reach, link clicks per Page.
- [ ] Check what switching the Meta app to Live needs.

## Review

(filled in as phases ship)

### Phase 1 (12 Oct 2026)

- Hourly cron at 17 past in both repos. A scheduled run sends one post, and
  only while the day is behind the even pace (`pace.mjs`). 8 a day is a post
  every 3 hours on the US Eastern clock. The cap ceiling is 24.
- Covers: the catalog already holds the biggest file AniList has. Checked
  against live addresses: every `medium` cover is an older title with no
  `large` file (404), so those stay 230 px wide. The picker now takes a title
  with a large cover first, and `resolveCover()` asks for the large file
  before a small one is ever used.
- Facebook still crops a bare tall cover to 4:5. Only the Phase 2 templates
  fix that (the art sits whole inside a 1080x1350 image).
- WhereAnime: when today's episodes are at least as many as the posts left
  today, the next post is an episode airing today, most popular first.
