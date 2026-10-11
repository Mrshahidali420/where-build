-- 0005: reader ratings and written reviews on the title pages, and the
-- owner's log.
--
-- Run ONCE, by hand, from the site's folder, BEFORE the Worker that writes
-- these is deployed:
--   npx wrangler d1 execute <d1.name> --remote --file ../../packages/core/db/migrations/0005-reviews.sql
-- If the Worker ships first, nothing breaks: a title page reads no rating and
-- no reviews and simply shows "be the first to rate", and a vote or a review
-- answers "not saved" until this has run.
--
-- Safe to run twice: every table and index is IF NOT EXISTS. Additive only;
-- nothing here touches a table that holds numbers.
--
-- No IP address is ever stored. `voter` and `sender` are a keyed one-way hash
-- (HMAC with the Worker secret PASS_KEY) of the address, the day and, for a
-- vote, the browser name and the title. They exist only to stop the same
-- person counting twice on one day, and the night job blanks them once they
-- are two days old (src/lib/reviews-api.js, forgetSenders).

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
