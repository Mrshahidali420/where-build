-- 0002: list, feed and search actions; fewer rows written per event.
--
-- Run ONCE, by hand, BEFORE the Worker that writes the new columns is
-- deployed:
--   npx wrangler d1 execute <d1.name> --remote --file ../../packages/core/db/migrations/0002-actions.sql
-- If the Worker ships first, every insert names columns that do not exist,
-- the batch fails, the error is swallowed, and every row of the day is lost.
--
-- ADD COLUMN cannot be run twice: a second run stops at the first line with
-- "duplicate column name" and changes nothing. That error means it already ran.
-- (0001 is db/schema.sql as it stood before this file.)

-- Three new columns on every event. Old rows get the defaults, and adding a
-- column does not rewrite a single existing row.
--   item   = the title id, the picked result's address, or the words of a
--            search that found nothing
--   detail = one short word: a list status, an import result, a search
--            surface (dropdown / page), a feed position, where an Amazon link
--            sat (pick / buybox / shop / themes)
--   pos    = one small number: a position or a count
ALTER TABLE events ADD COLUMN item TEXT NOT NULL DEFAULT '';
ALTER TABLE events ADD COLUMN detail TEXT NOT NULL DEFAULT '';
ALTER TABLE events ADD COLUMN pos INTEGER NOT NULL DEFAULT 0;

-- Visits that opened this one page, did nothing and left.
ALTER TABLE daily_pages ADD COLUMN quick_exits INTEGER NOT NULL DEFAULT 0;
ALTER TABLE daily_totals ADD COLUMN quick_exits INTEGER NOT NULL DEFAULT 0;

-- One row per action per day: "Solo Leveling was saved by 4 people".
CREATE TABLE IF NOT EXISTS daily_actions (
  day TEXT, name TEXT, item TEXT, detail TEXT, label TEXT,
  n INTEGER DEFAULT 0, people INTEGER DEFAULT 0,
  PRIMARY KEY (day, name, item, detail));

-- D1 counts one written row for the table and one more for every index on
-- it, and the free plan allows 100,000 written rows a day. Measured on 21-23
-- Sep 2026: about 6 rows written per event (the row, 4 indexes and the
-- AUTOINCREMENT counter). One day-and-kind index is all the queries need now
-- (see the notes in db/schema.sql), so three go, and an event costs 3.
DROP INDEX IF EXISTS events_day_type;
DROP INDEX IF EXISTS events_ts;
DROP INDEX IF EXISTS events_session;
