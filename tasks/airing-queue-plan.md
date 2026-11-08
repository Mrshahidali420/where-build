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

### Phase 3 build plan (7 Nov 2026): trending episode clip reels

Goal: one or two 20-40 s vertical clips a day from the newest trending episode, on WhereAnime first, then Manhwa Index (only anime/donghua made from a manhwa; manhwa itself has no episodes).

1. Pick (pure, tested): newest aired episode (48 h) with the highest popularity from `types/episode.mjs`, or a high score from `ratings/`. Ledger so no episode repeats. Max 2 a day (`FB_CLIPS_PER_DAY`).
2. Fetch: port `fetch_source.py` anime() from `Work/Recap and explainer/tools` (anipy-cli finds the stream, yt-dlp saves it). Runs on GitHub Actions in a new `clip.yml`, never on the PC.
3. Find the peak, no AI: ffmpeg scores every second of the episode. Signals: loudness (ebur128), cut rate (scene changes per 10 s) and music/sound swell. The opening song and ending song are skipped (first ~2 min, last ~3 min, or the chapter marks when the file has them). The best 30-45 s windows win, top 1-3 per episode, never overlapping.
4. Cut ONE continuous slice per short, from anywhere in the episode (start, middle or end). No stitching. The start and end snap to the nearest scene cut or quiet moment so it never opens or ends mid-sentence. 9:16 1080x1920, blurred backdrop, source sound kept, "Episode N" tag. H.264/AAC as `reel/video.mjs` requires.
5. Post: the existing reel upload in `fb.mjs`, then the link comment to the title page. Kind name `clip`, gated by `FB_POST_TYPES`, off until the owner says go.
6. Test: unit tests for the picker and ledger; one dry run that makes the file and does not post; the owner watches the file first.

### Phase 3 research result (7 Nov 2026, ChatGPT + GitHub check)

No single repo does this. Build our own detector (Python, CPU, no generative AI) from parts:
PySceneDetect (BSD, cuts), librosa (ISC, loudness/swell/onsets), pysubs2 (MIT, subtitle density), OpenCV (motion), ffmpeg ebur128.
Per-second score = 0.20 loudness + 0.15 swell + 0.15 speech proxy + 0.15 cut rate + 0.15 motion + 0.20 subtitles, each 0-1. No subtitles (dubs): drop that signal and re-weight. Smooth 3-5 s, score 30/35/40/45 s windows by average AND peak, top 1-3 non-overlapping (10 s gap), snap ends to a scene cut.
OP/ED skip: AniSkip API first (MAL id + episode). Fallback = fixed zones marked uncertain. Never copy `opening-ending-extractor` or `Open Anime Timestamps` (no licence); Needle (MIT) is a later option. Check for cold opens and post-credit scenes.
v1 = single episode, viewer data optional (never blocks), output = clip + small report (scores csv, ranked timestamps, timeline png). Motion sampled at 2-4 fps for speed.
Not used: ClipShow (desktop app), ShortGPT/OpenShorts (AI), Dejavu (old).

Second research pass (7 Nov 2026) changes:
- OP/ED on a SINGLE episode: AniChapters (MIT) method = fetch the theme song from AnimeThemes (they gave permission 23 Sep 2026) and correlate it with the episode audio. Use this before AniSkip; AniSkip is the cheap first lookup.
- Speech signal = voice activity + pitch variation + speech-band energy (no transcript).
- Add a low-frequency energy signal (impacts, explosions). Add a viewer bonus (YouTube heatmap, `youtube-heatmap` is GPL, so optional/outside the repo) only when the source is YouTube.
- Window length: 30-45 s for Facebook reels (owner choice); keep it a setting.
- Reuse ideas from auto-editor (Unlicense) for audio/motion thresholds. Avoid needle (dead), open-anime-timestamps (dead, no licence), ytb-most-replayed (dead).

### Phase 3 as built (8 Nov 2026): no Claude, fully on GitHub

Supersedes the build plan above where they differ. The clips are made in the recap project, posted here.

- Recap repo `xb506ee4dec`, workflow `clips-daily.yml` (every 6 h): `tools/clip_daily.py` takes the most trending episode that aired 3-48 h ago (AniList), skips what is done; `build.yml` downloads it and makes the speech text and cuts; `tools/pick_clips.py` picks the hot stretches from signals (loudness, bass, cuts, motion, subtitles, no OP/ED) and Groq writes the words; `tools/cut_clip.py` cuts 9:16 files with the Page logo, a full clip and a 60 s short each; `tools/publish_clips.py` uploads them to the private `recap-assets` release `clips` and lists them in `clips/<page>.json`.
- Here: `scripts/social/clip/store.mjs` reads that list (needs the secret `CLIPS_TOKEN`, read access to recap-assets); `types/clip.mjs` gives two kinds, `clip-reel` (the short, a Reel, Instagram too) and `clip-video` (the full clip, a normal Facebook video). Both OFF until named in `FB_POST_TYPES`.
- Manhwa Index gets the same episode only when its source is Korean or Chinese (or a donghua); logo copy `manhwaindex`.
- Switch on: set `CLIPS_TOKEN`, dry run with `types=clip-reel,clip-video`, watch the preview, then add the two names to `FB_POST_TYPES`.
