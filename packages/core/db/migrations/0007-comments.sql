-- 0007: reader comments under the title pages, with one level of replies.
--
-- Run ONCE, by hand, from the site's folder, BEFORE the Worker that writes
-- these is deployed:
--   npx wrangler d1 execute <d1.name> --remote --file ../../packages/core/db/migrations/0007-comments.sql
-- If the Worker ships first, nothing breaks: the form answers "not saved",
-- a page shows no comments and /my-admin/comments shows an empty list until
-- this has run.
--
-- Safe to run twice: the table and indexes are IF NOT EXISTS. Additive only.
--
-- Nothing shows on a page until the owner approves it. `page` is the page's
-- address without the leading slash, "<kind>/<slug>" (PAGE_KEY in
-- src/lib/comments.mjs). parent_id is the approved top-level comment on the
-- same page that a reply answers; a reply to a reply is stored against that
-- top-level comment.
--
-- No IP address is ever stored. `sender` is a keyed one-way hash (HMAC with
-- the Worker secret PASS_KEY) of the address and the day. It exists only for
-- the daily limit, and the night job blanks it once it is two days old
-- (src/lib/comments-api.js, forgetCommentSenders).
--
-- name and body are plain text that passed checkComment: no links, no
-- addresses, no handles, no HTML. They are escaped wherever they are drawn.
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
