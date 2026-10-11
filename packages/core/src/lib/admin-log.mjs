/**
 * The owner's log: one line for every change made from /my-admin (a review,
 * a message or a comment approved, marked or deleted). Written in the same
 * batch as the change, so the two land together or not at all. The table is
 * in db/migrations/0005-reviews.sql.
 */
export const LOG_INSERT = 'INSERT INTO admin_log (at, action, anilist_id, section, note) VALUES (?, ?, ?, ?, ?)'
