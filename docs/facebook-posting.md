# Facebook Page posting

The workflow **Facebook Page post** (`.github/workflows/fb-post.yml`) shares one
anime page at a time on the site's Facebook Page:

- a post with the cover picture and a short caption made from real facts
- then, straight away, a first comment with the link, for example
  `Where to watch it: https://whereanime.com/anime/frieren?utm_source=facebook&utm_medium=social&utm_campaign=page`

It starts every hour (17 minutes past, a few random minutes late) and sends at
most one post per run. Most runs send nothing: a run posts only when the day is
behind its even pace (see "How it paces the day"). It never runs on a push.

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

1. Actions → **Facebook Page post** → Run workflow. Leave `dry_run` ticked.
2. Open the run and read the summary. It should say the token works for your
   Page and show sample posts with their first comment.
3. When you like what you see, set the variable `FB_POST_ENABLED` to `true`.
   The next hourly run that is due posts for real.

To stop at any time, set `FB_POST_ENABLED` back to `false`.

## If something goes wrong

- **"the Page token was refused"**: the token died (password change, Page role
  removed, or Meta reset it). Do step 3 again and update `FB_PAGE_TOKEN`.
- **"Post failed"**: the post did not go out and the title is marked failed.
  It is not retried, so nothing posts twice. The next run picks another title.
- **"the link comment failed"**: the post is up but the link is missing. Add
  the comment by hand on Facebook.

## How it paces the day

The day is the US Eastern day. It is cut into as many equal parts as
`FB_POSTS_PER_DAY`, and one post is due at the start of each part.

| `FB_POSTS_PER_DAY` | A post about every | Due at (US Eastern) |
|---|---|---|
| `4` | 6 hours | 00:00, 06:00, 12:00, 18:00 |
| `8` | 3 hours | 00:00, 03:00, 06:00 ... 21:00 |
| `15` | 96 minutes | 00:00, 01:36, 03:12 ... |
| `24` | 1 hour | every hour |

- Each hourly run checks how many posts went out today. Behind the line: it
  sends one. On the line: it writes "On pace" in the summary and stops.
- A run that GitHub starts late or drops is made up one post per later run,
  never as a burst.
- A manual run (Run workflow) ignores the pace and sends `count` posts, but
  never more than the day has left.

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
