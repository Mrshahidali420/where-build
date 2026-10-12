# Facebook posting plan (12 Oct 2026)

Covers both Pages: WhereAnime (where-build) and Manhwa Index (manhwaindex).
The poster itself is live since 12 Oct 2026. This plan grows it.

## Owner decisions

- **Pace, changed 12 Oct 2026 (later the same day):** as many posts as is
  safely possible, under Facebook's daily limit, minimum 5 minutes apart. No
  ramp. The owner does not know Facebook's limit, so the cap starts at 24 in
  any rolling 24 hours (under the 25 a day third parties report; Meta
  publishes no number) and is raised by hand while the health record in the
  ledger stays clean. The code never raises it.
- Superseded: the slow build-up of 8, then 15, then 24 a day.
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

### Round 2 after the first live post (12 Oct 2026)

- Images: labelled lines (score, genre, status, alt title), a thin line round
  every cover, a line that points at the first comment. "Where to read / watch"
  lists every platform the page lists, with the free-to-start count.
- Captions: hook, synopsis, key facts, question, comment line, up to seven
  hashtags from the record. The classic posts got the same treatment.
- First comment: the site link, then (only with the repo variable
  `FB_AFFILIATE_COMMENT` set to `true`) the Amazon product of that title
  from the site's own picks and tag. Off by default.
- Manhwa Index genre rankings now link the site's genre page.

### Refinement round (12 Oct 2026)

Fifteen points from the coordinator's own review, both sites, one commit each. Bugs: new-title takes only running series; next-month in date order; blank covers found and left out of grids; no line ends on a separator and a short last word is tied to the one before; the synopsis never ends loose; the title hashtag drops season and part suffixes. Content: fact cards scored and named; the episode card leads with the title; a one-line tagline under titles; scores under the three "read next" picks; the comment line and the Amazon line say what the link really is. Polish: portraits capped at 400 px; no kind three times in a row; the most useful fact on line 2 of the caption. Not done on purpose: a title is never dropped from a ranking for a blank cover (the ranking would be wrong), and yearly, seasonal and genre ranks are not used for facts (the record does not hold them reliably).

### Task A: the chain and the limit watch (12 Oct 2026)

GitHub's hourly schedule fired no run for over three hours in either repo, so
posting moved off it. One workflow run loops (post, wait, post) and starts its
successor; a cron job every 30 minutes is only the backstop. The gap (5
minutes at least), the cap (24 in any rolling 24 hours, ceiling 288) and the
even pace are read from the ledger's timestamps. Limit signals from Facebook
are written to the ledger: throttling backs off (doubling, an hour at most), a
block stops posting for 24 hours and cuts the cap to 75% of what was reached.
One failed post does not stop the chain; a refused token or five failures in a
row do. Manhwa Index runs two-hour links so each one restores a fresh catalog
cache; WhereAnime reads R2 again every hour inside a five-and-a-half-hour link.

### Later

- Tagging official pages in posts (@Crunchyroll and the like). Not built: it
  needs the Page Mentions feature, which the app does not have, and automated
  brand tags from a new Page look like spam. The platform and studio hashtags
  stand in for now.
- Pinning the link comment: the API cannot pin a comment.
- A CJK font for the images, so the native title can be drawn too (today the
  image shows a Latin alt title and the caption carries the native one).

