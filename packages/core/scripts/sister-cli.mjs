/**
 * The options every sister ingest script (ingest-credits.mjs, ingest-staff.mjs,
 * ingest-airing.mjs) takes, read the same way in each:
 *
 *   MODE=delta|full-refresh   env, or --mode=...        (default 'delta')
 *   PUSH=1                    env only, like ALLOW_SHRINK elsewhere in this
 *                              repo -- pushes the result to R2 (default: the
 *                              run writes its local files and stops there)
 *   LIMIT=n                   env, or --limit=n          caps the id list
 *                              after selection, for a small local test run
 *   IDS=1,2,3                 env, or --ids=1,2,3        fetch exactly these
 *                              ids, skipping selection entirely
 */

/** `--key=value` and bare `--key` (value '1') from an argv list. */
export function parseFlags(argv) {
  const flags = {}
  for (const arg of argv) {
    const m = /^--([a-z-]+)(?:=(.*))?$/.exec(arg)
    if (m) flags[m[1]] = m[2] ?? '1'
  }
  return flags
}

const asIds = (text) =>
  text
    ? text.split(',').map((s) => Number(s.trim())).filter(Number.isInteger)
    : null

/** `{ mode, push, limit, ids }` from argv (process.argv.slice(2)) and env (process.env). */
export function readOptions(argv, env) {
  const flags = parseFlags(argv)
  const mode = flags.mode || env.MODE || 'delta'
  const limitRaw = flags.limit ?? env.LIMIT
  const limit = limitRaw ? Number(limitRaw) || null : null
  const ids = asIds(flags.ids ?? env.IDS ?? '')
  return { mode, push: env.PUSH === '1', limit, ids }
}
