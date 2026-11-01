# Airing queue for the WhereAnime Facebook Page (1 Nov 2026)

## Why

Facebook visits per 100 posts, 28 Oct - 1 Nov 2026 (D1 landings matched to
ledger posts by title, within 3 days after the post):

| type | posts | visits | per 100 |
|---|---|---|---|
| episode | 34 | 28 | 82 |
| airtime | 4 | 1 | 25 |
| stills | 4 | 1 | 25 |
| character | 441 | 8 | 1.8 |
| where | 443 | 6 | 1.4 |
| scenes | 111 | 1 | 0.9 |
| fact, fanart, cosplay, birthday, share | 237 | 0 | 0 |

Airing shows bring the clicks. The rotation is filled by where and character
because they never run out of items. Done 1 Nov: fact, fanart, cosplay and
birthday removed from FB_POST_TYPES.

Style to copy (owner's screenshots, Page "Anime 二十四"): a big episode
still, huge number, a yellow pill "TITLE S:2 | EPISODE 5", ALL-CAPS caption
starting with 🔥, a question, hashtags; follow-up posts when the number
moves.

## Phase 1: the Airing queue (urgent types) + caps on the old queue

- [ ] `FB_TYPE_CAPS` (e.g. `where:30,character:30`): a type at its cap in the
      rolling 24 hours is left out of the rotation (attempt.mjs kindsNow).
- [ ] `out-now`: "EPISODE N OUT NOW", posted from air time to 4 h after.
      Episode still (stills/load.mjs) else banner else cover, full bleed,
      yellow pill with title + episode. Urgent.
- [ ] `finale`: the last episode (episode == episodes) airs today. Urgent.
- [ ] `today`: "Episodes out today" list picture (up to 6, by popularity),
      plus a swipe post for Instagram. Once a day.
- [ ] Popularity floor for the airing types: 2000 (episode was 3000).
- [ ] Samples shown to the owner before switching on.

## Phase 2: episode ratings (built 2 Nov 2026: types rating, rating-move, rating-week; scripts/social/ratings/)

- TMDB episode `vote_average` / `vote_count` (we already call TMDB for
  stills), or IMDb's free daily files (title.ratings + title.episode, the
  episode found through TMDB external_ids). Post only high scores with
  enough votes; a follow-up when the score climbs.

## Phase 3: short highlight clip reels (owner's decision 1 Nov 2026)

- Only top-rated or trending episodes, short highlight clips (never a full
  episode). The owner accepts the Rights Manager risk.
- Source and cutting to be decided (the explainer project's fetch_source.py
  pattern).
