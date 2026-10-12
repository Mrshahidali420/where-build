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
- [x] New episode today (one per episode)
- [x] Airing right now
- [x] New anime starting (premiere)
- [x] Coming next week (list)
- [x] Coming next month (list)
- [x] Most anticipated (ranking)
- [x] Character spotlight
- [x] Fact card
- [x] Where to watch

Manhwa Index types
- [x] Where to read
- [x] New title (no new-volume post: the catalog has no volume dates)
- [x] Ranking (top by genre, top ongoing)
- [x] Character spotlight
- [x] Fact card
- [x] What to read next

Built and pushed, switched OFF. Gate: samples of every template are shown to
the owner before a type goes live (repo variable `FB_POST_TYPES`).

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

### Phase 2 (12 Oct 2026): built, not live

- One renderer in each repo (`scripts/social/render/`): satori lays the
  image out with the site's own font files, sharp turns it into a picture. No
  browser. 1080x1350, sent to `/photos` as a file. The cover is always whole.
- One file per post type (`scripts/social/types/`): how it finds its posts,
  three wordings of the caption, and its own design.
- Switch: the repo variable `FB_POST_TYPES`, a comma list. Unset means the
  classic posts only, exactly as before. `classic` is a name in the list too.
  WhereAnime names: `episode`, `premiere`, `onair`, `next-week`,
  `next-month`, `anticipated`, `character`, `fact`, `where`.
  Manhwa Index names: `where`, `new-title`, `ranking`, `character`, `fact`,
  `next`.
- The ledger keeps the type and the item of each template post, so the same
  episode, list, ranking, character or fact does not come back inside its gap.
- Samples: `npm run social:samples` (see docs/facebook-posting.md in each
  repo). The first set is in `Desktop\Facebook Page Logos\template-samples`.
- Not done, on purpose: a "new volume" post. The catalog holds a volume
  count and no volume dates.
- Open: the file upload to `/photos` has only been tested against a stand-in,
  never the real Graph API. The first real template post should be watched.
- Open: character portraits from AniList are 230 px wide, so they are a little
  soft at the size the spotlight uses.
