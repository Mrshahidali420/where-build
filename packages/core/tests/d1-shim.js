// A stand-in for a Cloudflare D1 binding, over Node's own SQLite, so the real
// SQL of the night job and the dashboard runs in a test. Only the calls this
// code base makes are here: prepare().bind().all() / first() / run(), and
// batch(), which D1 runs as one transaction.
import { readFileSync } from 'node:fs'
import { DatabaseSync } from 'node:sqlite'

export function openD1() {
  const db = new DatabaseSync(':memory:')
  const statement = (sql, args = []) => ({
    bind: (...values) => statement(sql, values),
    all: async () => ({ results: db.prepare(sql).all(...args) }),
    first: async () => db.prepare(sql).get(...args) ?? null,
    run: async () => {
      const out = db.prepare(sql).run(...args)
      return { meta: { changes: Number(out.changes) } }
    },
  })
  return {
    raw: db,
    prepare: (sql) => statement(sql),
    async batch(list) {
      db.exec('BEGIN')
      try {
        const out = []
        for (const one of list) out.push(await one.run())
        db.exec('COMMIT')
        return out
      } catch (e) {
        db.exec('ROLLBACK')
        throw e
      }
    },
  }
}

/** A D1 stand-in with the analytics schema from db/schema.sql. */
export function analyticsD1() {
  const d1 = openD1()
  d1.raw.exec(readFileSync(new URL('../db/schema.sql', import.meta.url), 'utf8'))
  return d1
}
