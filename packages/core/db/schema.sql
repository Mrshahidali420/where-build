-- The analytics database, as it stands.
--
-- This file is the written record. It is NOT run by the build. The tables live
-- in each site's Cloudflare D1 database (d1.name and d1.id in its
-- site.config.mjs), bound to the Worker as ANALYTICS.
-- To apply a change by hand, from the site's folder:
--   npx wrangler d1 execute <d1.name> --remote --file ../../packages/core/db/schema.sql
-- Every statement below is safe to run twice, on an EMPTY database. An
-- existing database is changed by the files in db/migrations/ instead, once
-- each, in number order (0002 onwards; this file is 0001).
--
-- The shape of the thing: `events` holds one row per page view, per outbound
-- click and per page exit, and is kept for 30 days only. Every night a cron
-- squeezes the closed day into the small `daily_*` tables, which are kept
-- forever. So "last 7 days" reads a few hundred rows instead of a few hundred
-- thousand, and the free allowance of 5 million row reads a day is never at
-- risk.

CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ts INTEGER NOT NULL,                  -- Date.now() when it happened
  day TEXT NOT NULL,                    -- 'YYYY-MM-DD', UTC
  name TEXT NOT NULL,                   -- page_view, affiliate_amazon_books, read_webtoon, ...
  kind TEXT NOT NULL,                   -- view | read | watch | buy | other | leave | missing | act | search
  path TEXT NOT NULL DEFAULT '',
  page_type TEXT NOT NULL DEFAULT '',   -- first path part: manhwa|manga|manhua|anime|character|shop|home
  label TEXT NOT NULL DEFAULT '',       -- page title, or the words on the button
  platform TEXT NOT NULL DEFAULT '',    -- WEBTOON, Netflix, Amazon, ...
  shop_kind TEXT NOT NULL DEFAULT '',   -- books | discs | figures | prints | apparel | merch
  target TEXT NOT NULL DEFAULT '',      -- the outside address the click went to
  country TEXT NOT NULL DEFAULT '',     -- two letters, from Cloudflare
  referrer TEXT NOT NULL DEFAULT '',    -- the sending site's host name only
  device TEXT NOT NULL DEFAULT '',      -- phone | desktop
  visitor TEXT NOT NULL DEFAULT '',     -- random id, kept in the browser
  session TEXT NOT NULL DEFAULT '',     -- random id, one visit, dies after 30 idle minutes
  step INTEGER NOT NULL DEFAULT 0,      -- 1, 2, 3 ... page number inside the visit
  prev TEXT NOT NULL DEFAULT '',        -- the page they came from, on this site
  prev_type TEXT NOT NULL DEFAULT '',   -- that page's type, or 'entry' if they arrived here
  dwell INTEGER NOT NULL DEFAULT 0,     -- milliseconds the page was on screen
  campaign TEXT NOT NULL DEFAULT '',   -- utm_source/utm_medium/utm_campaign, if the link had them
  item TEXT NOT NULL DEFAULT '',        -- act/search: title id, picked address, or no-result search words
  detail TEXT NOT NULL DEFAULT '',      -- a status, a result, dropdown|page, pick|buybox|shop|themes
  pos INTEGER NOT NULL DEFAULT 0        -- a position or a count
);

-- ONE index, on purpose. D1 counts a written row for the table and one more
-- for every index, and the free plan allows 100,000 written rows a day, so
-- each index is paid for on every single event. Every query that reads
-- `events` (src/lib/rollup.js, src/lib/admin-data.js, src/pages/my-admin*)
-- filters on `day`, or reads the newest rows by id, which needs no index.
-- Before 0002 there were four (plus ts, session+step, day+page_type+kind):
-- about 6 written rows per event instead of 3.
CREATE INDEX IF NOT EXISTS events_day_kind ON events(day, kind);

-- ---------------------------------------------------------------- the rollups

-- quick_exits: visits that opened one page, did nothing on it and left.
CREATE TABLE IF NOT EXISTS daily_totals (
  day TEXT PRIMARY KEY, views INTEGER DEFAULT 0, people INTEGER DEFAULT 0,
  sessions INTEGER DEFAULT 0, bounces INTEGER DEFAULT 0, clicks INTEGER DEFAULT 0,
  buys INTEGER DEFAULT 0, reads INTEGER DEFAULT 0, watches INTEGER DEFAULT 0,
  dwell_sum INTEGER DEFAULT 0, dwell_n INTEGER DEFAULT 0,
  quick_exits INTEGER NOT NULL DEFAULT 0);

CREATE TABLE IF NOT EXISTS daily_types (
  day TEXT, page_type TEXT, views INTEGER DEFAULT 0, people INTEGER DEFAULT 0,
  entries INTEGER DEFAULT 0, clicks INTEGER DEFAULT 0, buys INTEGER DEFAULT 0,
  reads INTEGER DEFAULT 0, watches INTEGER DEFAULT 0, dwell_sum INTEGER DEFAULT 0,
  dwell_n INTEGER DEFAULT 0, PRIMARY KEY (day, page_type));

-- Only the best 300 pages of each day are kept. A page nobody looked at twice
-- is not worth a row forever.
CREATE TABLE IF NOT EXISTS daily_pages (
  day TEXT, path TEXT, page_type TEXT, label TEXT, views INTEGER DEFAULT 0,
  people INTEGER DEFAULT 0, entries INTEGER DEFAULT 0, clicks INTEGER DEFAULT 0,
  buys INTEGER DEFAULT 0, reads INTEGER DEFAULT 0, watches INTEGER DEFAULT 0,
  dwell_sum INTEGER DEFAULT 0, dwell_n INTEGER DEFAULT 0,
  quick_exits INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (day, path));

-- The only place "all time" comes from. One row per page, ever.
CREATE TABLE IF NOT EXISTS total_pages (
  path TEXT PRIMARY KEY, page_type TEXT, label TEXT, views INTEGER DEFAULT 0,
  clicks INTEGER DEFAULT 0, buys INTEGER DEFAULT 0, reads INTEGER DEFAULT 0,
  watches INTEGER DEFAULT 0, dwell_sum INTEGER DEFAULT 0, dwell_n INTEGER DEFAULT 0,
  last_day TEXT);

CREATE TABLE IF NOT EXISTS daily_countries (
  day TEXT, country TEXT, page_type TEXT, views INTEGER DEFAULT 0,
  people INTEGER DEFAULT 0, clicks INTEGER DEFAULT 0,
  PRIMARY KEY (day, country, page_type));

CREATE TABLE IF NOT EXISTS daily_clicks (
  day TEXT, kind TEXT, platform TEXT, shop_kind TEXT, page_type TEXT,
  clicks INTEGER DEFAULT 0, people INTEGER DEFAULT 0,
  PRIMARY KEY (day, kind, platform, shop_kind, page_type));

CREATE TABLE IF NOT EXISTS daily_sources (
  day TEXT, source TEXT, views INTEGER DEFAULT 0, entries INTEGER DEFAULT 0,
  PRIMARY KEY (day, source));

-- Section to section moves, so the shape of a visit survives the 30 day prune.
CREATE TABLE IF NOT EXISTS daily_edges (
  day TEXT, from_type TEXT, to_type TEXT, moves INTEGER DEFAULT 0,
  PRIMARY KEY (day, from_type, to_type));

-- One row per action per day, from the act, search and buy rows. The top 200
-- per action are kept. A search that found nothing is kept only when two or
-- more different people typed the same words; see /privacy.
--   list_* / feed_* / anilist_import / miss_next / search_*: item, detail as
--     in `events` (feed_click: detail is the position in the feed)
--   buy: item = the page address, detail = where the link sat,
--     label = the shop kind
CREATE TABLE IF NOT EXISTS daily_actions (
  day TEXT, name TEXT, item TEXT, detail TEXT, label TEXT,
  n INTEGER DEFAULT 0, people INTEGER DEFAULT 0,
  PRIMARY KEY (day, name, item, detail));

-- Page views that arrived from a search engine, per page and engine. Top 300
-- a day. The "People are searching for" shelf and the Search tab read it.
-- See 0004-search-and-bots.sql and src/lib/search-signals.js.
CREATE TABLE IF NOT EXISTS daily_search_arrivals (
  day TEXT, path TEXT, engine TEXT, views INTEGER DEFAULT 0, people INTEGER DEFAULT 0,
  PRIMARY KEY (day, path, engine));

-- Hits the beacon and the pass desk refused (and let in), by reason. Counts
-- only, written in batches by src/lib/reject-count.js. WITHOUT ROWID: one
-- written row per upsert. Kept 180 days.
CREATE TABLE IF NOT EXISTS daily_rejects (
  day TEXT NOT NULL, reason TEXT NOT NULL, place TEXT NOT NULL, country TEXT NOT NULL,
  n INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (day, reason, place, country)) WITHOUT ROWID;

CREATE TABLE IF NOT EXISTS rollup_log (day TEXT PRIMARY KEY, ran_at INTEGER, rows INTEGER);

CREATE INDEX IF NOT EXISTS total_pages_views ON total_pages(views DESC);

-- ---------------------------------------------------------------- readers
-- What readers write: star votes and reviews (0005-reviews.sql), messages
-- from the forms (0006-messages.sql) and page comments (0007-comments.sql).
-- No IP address is stored anywhere; see each migration for the rules.

-- One row per accepted star vote. UNIQUE blunts repeat voting: the same
-- browser on the same address can vote once per title per day. A blanked
-- (NULL) voter never collides, so old days keep their votes.
CREATE TABLE IF NOT EXISTS rating_votes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  anilist_id INTEGER NOT NULL CHECK (anilist_id > 0),
  stars INTEGER NOT NULL CHECK (stars BETWEEN 1 AND 5),
  day TEXT NOT NULL,
  voter TEXT,
  created_at TEXT NOT NULL,
  UNIQUE (anilist_id, day, voter));

-- The night job finds the hashes still to blank without walking every vote.
CREATE INDEX IF NOT EXISTS rating_votes_day ON rating_votes(day) WHERE voter IS NOT NULL;

-- The running total per title, so a title page reads one row instead of
-- every vote. It is recounted from rating_votes in the same batch as each
-- vote, so it can never drift from the votes themselves.
CREATE TABLE IF NOT EXISTS rating_totals (
  anilist_id INTEGER PRIMARY KEY CHECK (anilist_id > 0),
  votes INTEGER NOT NULL DEFAULT 0,
  total INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL);

-- Written reviews. Every one starts as 'pending' and nothing pending is ever
-- shown on the site; the owner approves or deletes it on /my-admin/reviews.
-- body is plain text that passed the link and spam checks in
-- src/lib/reviews.mjs, and it is escaped again wherever it is drawn. kind,
-- slug and title are copied from the catalog at the moment of writing, so the
-- admin list reads as names without a catalog in the Worker.
CREATE TABLE IF NOT EXISTS reviews (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  anilist_id INTEGER NOT NULL CHECK (anilist_id > 0),
  kind TEXT NOT NULL,
  slug TEXT NOT NULL,
  title TEXT NOT NULL DEFAULT '',
  name TEXT NOT NULL DEFAULT 'A reader',
  body TEXT NOT NULL,
  stars INTEGER CHECK (stars IS NULL OR stars BETWEEN 1 AND 5),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved')),
  created_at TEXT NOT NULL,
  approved_at TEXT);

-- The title page asks "approved reviews of this title, newest first".
CREATE INDEX IF NOT EXISTS reviews_title ON reviews(anilist_id, status, approved_at DESC);
-- The admin tab asks "everything pending" and counts it for the tab badge.
CREATE INDEX IF NOT EXISTS reviews_status ON reviews(status, created_at DESC);

-- How many reviews one address sent today, for the daily limit. A separate
-- counter, so deleting a spam review does not hand its sender a fresh slot.
-- Rows older than two days are thrown away by the night job.
CREATE TABLE IF NOT EXISTS review_sends (
  day TEXT NOT NULL,
  sender TEXT NOT NULL,
  n INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (day, sender)) WITHOUT ROWID;

-- The name and page of every title that has star votes, so /my-admin/reviews
-- lists "Solo Leveling" instead of "AniList #151807". The Worker holds no
-- catalog to look ids up in, so the vote copies them in, as a review does.
CREATE TABLE IF NOT EXISTS rated_titles (
  anilist_id INTEGER PRIMARY KEY CHECK (anilist_id > 0),
  kind TEXT NOT NULL,
  slug TEXT NOT NULL,
  title TEXT NOT NULL DEFAULT '');

-- The owner's log: one line per change made from /my-admin (a review, a
-- message or a comment approved, marked or deleted), written in the same
-- batch as the change (src/lib/admin-log.mjs).
CREATE TABLE IF NOT EXISTS admin_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  at TEXT NOT NULL,
  action TEXT NOT NULL,
  anilist_id INTEGER,
  section TEXT NOT NULL DEFAULT '',
  note TEXT NOT NULL DEFAULT '');

CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  kind TEXT NOT NULL CHECK (kind IN ('feedback', 'contact', 'sponsor')),
  name TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  topic TEXT NOT NULL DEFAULT '',
  page TEXT NOT NULL DEFAULT '',
  company TEXT NOT NULL DEFAULT '',
  website TEXT NOT NULL DEFAULT '',
  budget TEXT NOT NULL DEFAULT '',
  body TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'done')),
  day TEXT NOT NULL,
  sender TEXT,
  created_at TEXT NOT NULL);

-- The admin tab asks "everything new, newest first" and counts it for the
-- tab badge and the pause.
CREATE INDEX IF NOT EXISTS messages_status ON messages(status, created_at DESC);
-- The daily limit and the night job find a day's hashes without a full walk.
CREATE INDEX IF NOT EXISTS messages_day ON messages(day) WHERE sender IS NOT NULL;

CREATE TABLE IF NOT EXISTS page_comments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  page TEXT NOT NULL,
  parent_id INTEGER,
  name TEXT NOT NULL,
  body TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved')),
  day TEXT NOT NULL,
  sender TEXT,
  created_at TEXT NOT NULL,
  approved_at TEXT);

-- A page asks for its approved comments, oldest first; the admin tab
-- and the pause count the pending ones.
CREATE INDEX IF NOT EXISTS page_comments_page ON page_comments(page, status, created_at);
CREATE INDEX IF NOT EXISTS page_comments_status ON page_comments(status, created_at DESC);
-- The daily limit and the night job find a day's hashes without a full walk.
CREATE INDEX IF NOT EXISTS page_comments_day ON page_comments(day) WHERE sender IS NOT NULL;
