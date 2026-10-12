# Facebook Page posting

The workflow **Facebook Page post** (`.github/workflows/fb-post.yml`) shares one
anime page at a time on the site's Facebook Page:

- a post with the cover picture and a short caption made from real facts
- then, straight away, a first comment with the link, for example
  `Where to watch it: https://whereanime.com/anime/frieren?utm_source=facebook&utm_medium=social&utm_campaign=page`

One long workflow run does the posting: it posts, waits and posts again, then
starts the next run (see "How it paces the day"). It never runs on a push.

Nothing goes to Facebook until you finish the steps below **and** switch it on.
Until then every run is green and only shows what it would post.

Do every step from your own phone or PC, by hand. Never let a tool or a
browser robot log in to Facebook for you.

## 1. Make the Page

In the Facebook app: Menu → Pages → Create.

- Name: **WhereAnime**
- Category: **Entertainment website**
- Bio: *Episode dates, where to watch, voice actors and the people behind every anime.*
- Website: `https://whereanime.com`
- Profile picture: the site logo. Cover: any wide site banner.

Leave out your phone number, email, city and any personal detail.

If you already made a developer app for Manhwa Index, you can use the same app
for this Page: skip to step 3 and pick this Page in step 3.4.

## 2. Make a Meta developer app

1. Go to developers.facebook.com and log in with the same Facebook account.
2. My Apps → Create app. Pick the **Business** type (or the use case
   "Manage everything on your Page"). Name it e.g. *WhereAnime poster*.
3. In the app, add the Pages permissions below (App Review is not needed for
   a Page you manage yourself; Standard access is enough):
   - `pages_show_list`
   - `pages_read_engagement`
   - `pages_manage_posts`
   - `pages_manage_engagement`
4. App settings → Basic: set the Privacy Policy URL to
   `https://whereanime.com/privacy`, then switch the app from
   **Development** to **Live** at the top of the dashboard.
   Why: Meta's docs say posts made by an app in Development mode are only
   seen by people who have a role on the app. Live makes them public.

## 3. Get a Page token that does not expire

1. Open the **Graph API Explorer** (developers.facebook.com/tools/explorer).
2. Pick your app. Under "User or Page", choose **Get User Access Token** and
   tick the four permissions from step 2. Approve the pop-up.
3. Copy that token into the **Access Token Debugger**
   (developers.facebook.com/tools/debug/accesstoken) and press
   **Extend Access Token** at the bottom. You now have a long-lived user token.
4. Back in the Explorer, paste the long-lived token and run
   `me/accounts`. Find the Page in the answer. Copy its `id` (the Page ID)
   and its `access_token` (the Page token).
5. Check the Page token in the Debugger: it should say **Expires: Never** and
   list the four permissions.

Keep the token private. Do not paste it in a chat, an email or a file.

## 4. Put it in GitHub

Repo → Settings → Secrets and variables → Actions.

Secrets (tab "Secrets"):

| Name | Value |
|---|---|
| `FB_PAGE_ID` | the Page ID |
| `FB_PAGE_TOKEN` | the Page token |

Variables (tab "Variables"):

| Name | Value |
|---|---|
| `FB_POST_ENABLED` | `false` for now |
| `FB_POSTS_PER_DAY` | `4` to start. Raise it by hand as reach allows; the most it accepts is `24` (one an hour) |

## 5. Test, then switch on

1. Actions → **Facebook Page post** → Run workflow. Tick `dry_run`.
2. Open the run and read the summary. It should say the token works for your
   Page and show sample posts with their first comment.
3. When you like what you see, set the variable `FB_POST_ENABLED` to `true`.
4. Start the chain: Run workflow again with nothing filled in. Within half
   an hour the backstop would start it by itself.

To stop: set `FB_POST_ENABLED` back to `false` **and** cancel the running
"Facebook chain" run in Actions. A run reads the variables when it starts, so
without the cancel it would post until its five and a half hours are up.

The same holds for every variable (`FB_POSTS_PER_DAY`, `FB_POST_TYPES`,
`FB_MIN_GAP_MINUTES`, `FB_AFFILIATE_COMMENT`): a change takes effect when the
next run of the chain starts. To apply it at once, cancel the running chain
and start the workflow by hand.

## If something goes wrong

- **"the Page token was refused"**: the token died (password change, Page role
  removed, or Meta reset it). Do step 3 again and update `FB_PAGE_TOKEN`.
- **"Post failed"**: the post did not go out and the title is marked failed.
  It is not retried, so nothing posts twice. The next run picks another title.
- **"the link comment failed"**: the post is up but the link is missing. Add
  the comment by hand on Facebook.

## How it paces the day

Owner decision, 12 Oct 2026: **as many posts as is safe, under Facebook's
daily limit, never closer than five minutes apart.** Meta publishes no daily
post cap for a Page (the only official limit is a call budget), and third
parties report about 25 a day for business Pages. So the cap starts at 24 and
is raised by hand, with evidence.

Three rules, all read from the ledger's own timestamps:

| Rule | Variable | Unset | Limits |
|---|---|---|---|
| The gap: least minutes between two posts | `FB_MIN_GAP_MINUTES` | 5 | never under 5 |
| The cap: most posts in any 24 hours | `FB_POSTS_PER_DAY` | 24 | never over 288 |
| The pace: posts are spread evenly over the cap | (none) | 24 a day is one an hour | never closer than the gap |

- The day is a **rolling 24 hours**, counted back from now. Midnight never
  opens the door to a burst.
- A claim, a post and a failed post all count. A dry run never does.

### The chain

One workflow run posts, waits and posts again for about five and a half hours,
then starts the next run and ends. GitHub's hourly schedule dropped runs for
over three hours on 12 Oct 2026, so posting does not depend on it any more.

- **Start it:** Actions → Facebook Page post → Run workflow, nothing filled
  in. (`gh workflow run fb-post.yml` does the same.)
- **The backstop:** a cron job looks every 30 minutes and starts a chain only
  when none is running or waiting. It posts nothing itself.
- **No overlap:** chain runs share one concurrency group, so a second one
  waits for the first to end. The gap is kept from the ledger whatever
  started the run.
- **Two posts by hand:** Run workflow with `count` = 2. It keeps the gap and
  the cap, ignores the even pace, and never starts a chain.
- **A dry run** (`dry_run` ticked) shows what it would post and never starts
  a chain.
- The data (three R2 objects) is read again every hour inside the run.

### What stops it, and what does not

- **One failed post does not.** It is logged, marked failed in the ledger
  (never retried), the gap passes, and the chain goes on.
- **A refused token, or five failures in a row, do.** The run ends red and
  leaves a note in the ledger; the backstop does not restart a halted chain.
  Fix the cause, then start the workflow by hand.
- **Nothing fresh to post:** it waits 20 minutes and looks again. It never
  repeats an item to fill the time.

### The limit watch

Every sign of a limit is written to the ledger (`health` in `ledger.json` on
the `social-state` branch) and printed in the run's summary:

- **Throttling** (Graph codes 4, 17, 32, 341, 613, 80000 to 80014, HTTP 429,
  or a usage header at 90% and up): the chain backs off, doubling the wait
  each time, an hour at most.
- **A block** (code 368, or a message about being blocked, spam or going too
  fast): no posts for 24 hours, and the cap drops to **75% of what the Page
  had reached** in the last 24 hours.
- Each run's summary ends with **"Highest usage seen this run"**, read from
  Facebook's usage headers.

**Raising the cap** is done by hand, never by the code: when the summaries
show no limit signal and low usage for a few days, set `FB_POSTS_PER_DAY` a
step higher. Changing that number also lifts a cut left by a block.

## Template posts (off until you switch them on)

Besides the classic post (a cover and a caption) there are template posts: an
image drawn for the post, 1080 x 1350, with the cover placed whole inside it,
so Facebook never crops the art. Each kind of post has its own design.

| Name | What it posts |
|---|---|
| `episode` | New episode today, one post per episode on today's schedule |
| `premiere` | Episode 1 of a show airs today or tomorrow |
| `onair` | A show in the middle of its run and the day of its next episode |
| `next-week` | The shows starting next week (Monday to Sunday), as a dated list |
| `next-month` | The shows starting next month, as a sheet of covers |
| `anticipated` | Top 5 shows still to come, by AniList planning lists |
| `character` | One lead character and their voice actors |
| `fact` | One fact from the record, set very large |
| `where` | The official streaming sites of one show |

**Nothing above posts until its name is in the repo variable `FB_POST_TYPES`**
(Settings → Secrets and variables → Actions → Variables). The variable is a
comma list, and the list is exactly what runs:

| `FB_POST_TYPES` | What the Page gets |
|---|---|
| not set, or empty | classic posts only (as before) |
| `classic,episode` | classic posts, plus an episode post for today's episodes |
| `classic,episode,premiere,where` | those four kinds, in turns |
| `episode,premiere,onair,next-week,next-month,anticipated,character,fact,where` | template posts only |

Leave `classic` in the list for as long as you want the plain cover posts too.
A name that is misspelt is ignored and named in the run summary; a list with
no usable name falls back to classic posts.

How the kinds share the day:

- News first. `episode` and `premiere` go before everything else while they
  have something new. When today's episodes are at least as many as the posts
  left today, every post is an episode; otherwise an episode post and another
  kind take turns.
- The rest rotate: the kind that posted longest ago goes next.
- Nothing repeats too soon. An episode is posted once. A show comes back as
  `onair` after 4 weeks, a ranking after 3 weeks, a character after 6 months,
  `where` and `fact` after the usual 30 days per title. Two posts about the
  same show never go out on one day.

Look before you switch a type on:

- On the PC, from the repo folder:
  `npm run social:samples -w @sister/anime -- --out "C:\some\folder"`
  writes two sample images per type and `captions.md` with every wording of
  each caption. Add `--long` to see the longest titles.
- On GitHub: Actions → **Facebook Page post** → Run workflow, keep `dry_run`
  ticked and write the names in `types` (for example `fact,where`). The run
  summary shows the captions, and the images are in the run's `fb-preview`
  artifact. The `types` box works for dry runs only; it can never post.

The images use the site's own fonts and colours and are made on the runner
(`packages/core/scripts/social/render/`), with no browser. The words on them
come from the same catalog as the pages; a fact the record lacks is left out.

## Reels (off until you switch them on)

A reel is a short vertical video (1080x1920, 8 to 20 seconds, no music) made
on the runner: slides drawn like the post images, held a few seconds each
with a slow zoom, cross-faded with ffmpeg (installed on the runner only for a run that can make a reel). An opening slide, one slide per
item, and a closing slide with the site name and "Link in the first comment".
Nothing is re-uploaded from anyone: the slides are our own.

| Name in `FB_POST_TYPES` | What it is |
|---|---|
| `reel-today` | Today's new episodes, in order of air time (needs three) |
| `reel-next-week` | The premieres of next week, in day order |
| `reel-anticipated` | Top 5 most anticipated, counted down from five to one |

- **Off by default.** A reel posts only when its name is written in
  `FB_POST_TYPES`, like every template type.
- **Few.** `FB_REELS_PER_DAY` reels in any 24 hours (3 unless set, 10 at
  most; Facebook's own limit is 30 by API), counted inside the overall cap.
  Never two reels in a row.
- **Look first.** `npm run social:reels -- --out reel-samples` writes one MP4
  per type and a contact sheet of six frames. A manual dry run with `types`
  set to a reel name keeps the MP4 in the run's `fb-preview` artifact.
- **How it is published** (Reels Publishing API, read 12 Oct 2026): start an
  upload, send the file to `rupload.facebook.com`, finish with
  `video_state=PUBLISHED` and the caption as the description. The poster
  waits until Facebook has processed the reel, then adds the site link as the
  first comment on it.

## What every post carries

A post exists to send people to the site, so each one is built the same way:

- **The image** shows quick context as labelled lines (score, genre, status,
  alt title), has a thin line round the cover so it stands off the page, and
  ends on one line that points at the first comment.
- **The caption**: a hook with an emoji, a short synopsis from the record (cut
  at a sentence end, no credits, no spoiler text), the key facts, a question
  that names the title, the line about the first comment, then up to seven
  hashtags built from the record (title, platform, season, sub-genre, kind,
  genre, one or two community tags). A part the record lacks is left out.
- **The first comment**: the site link, always first, so the preview card is
  the site.

### The Amazon line in the first comment (off)

Set the repo variable `FB_AFFILIATE_COMMENT` to `true` and the first comment
gets a second line for titles the site has a product for:

```
Where to watch it: https://.../the-title?utm_source=facebook...
Get the book on Amazon: https://www.amazon.com/dp/XXXXXXXXXX?tag=whereanime-20
```

- The link is the same product the title page shows (`packages/core/scripts/social/shop.mjs` reads the
  site's own picks and its own tag). A title with no pick gets no Amazon line;
  nothing is ever a search link.
- The tag is always `whereanime-20`. A test fails if any other tag could be written.
- Nothing else is added to the post or the comment about it.
- Any other value, or no variable, keeps the comment to the one site line.

## How it chooses

- Episodes first. When there are at least as many episodes still to air today
  as posts left today, the next post is an episode airing today, the most
  popular first.
- Otherwise about two new items for each older one. New: an episode airing
  today or tomorrow (from the airing schedule), or a show still airing. Older:
  popular anime ("where to watch it", plain facts, "if you liked it").
- The picture is the largest cover the source has. Older titles only have a
  small cover (230 px wide), which looks soft in the feed, so a title with a
  large cover is always taken first.
- Never the same caption style twice in a row, never the same title within
  30 days, never an adult title, never a page that is noindexed or has no official streaming site.
- The record of what was posted lives on the `social-state` branch
  (`ledger.json`). A post is written there before it is sent, so two runs can
  never post the same title.
- Data comes from the files the nightly deploy already keeps in Cloudflare R2
  (the anime catalog, the list of live pages and the airing schedule). The
  runner never loads the live site.

## Rules added in the refinement round (12 Oct 2026)

- **The mix.** The same kind of post never goes out twice running while another kind has something to post. News (an episode, a premiere) may outrank the rotation, but never a third time in a row unless nothing else is left (`plan.mjs`, `MAX_STREAK`).
- **Above the fold.** Line 1 of a caption is the hook with the title. Line 2 is the single most useful fact (the platform, the air time or the score). The synopsis, the other facts, the question and the line about the first comment follow.
- **The synopsis** never ends on a teaser question, a lead-in colon, a scrap of a few words or an ellipsis. The image carries one line about the story (the first sentence, 110 characters at most) only when that sentence is whole.
- **The title hashtag** leaves out a season or part suffix and a subtitle ("2nd Cour", "Season 3", the text after a colon).
- **Fact cards** name the title in the sentence on the image, offer one fact per title (the strongest), and skip a title with no strong fact: top 50 of an all-time chart, a long finished run, or a score of 8.8 and up. The record holds no trustworthy yearly, seasonal or genre rank, so those are not used.
- **Blank covers.** A cover that is a logo on plain white or black is found with a 48 px probe. A grid or list leaves that tile out when it has another title to show; a post whose main picture is blank is skipped for the run. A ranking keeps its order: a title is never dropped from a ranking for its cover.
- **Small portraits** (AniList characters are 230 px wide) are enlarged at most 1.75 times, with lanczos and a light sharpen, and shown no wider than 400 px.
- **The line about the first comment** on a list post says "Start with #1" when the comment opens the title in first place, and names the list only when the comment opens a list page.
- **The Amazon line** fits the product: "Read the manga it is based on" under an anime post with a manga volume, "Get the Blu-ray on Amazon", "Get the figure on Amazon". Never "the book" for something that is not one, and never "based on" for an original anime.
