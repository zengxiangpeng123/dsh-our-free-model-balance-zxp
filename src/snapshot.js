/**
 * The one JSON the browser ever reads.
 *
 * Pure on purpose: given a round's rows, the current settings and the poller's
 * own state, the snapshot is a function — no clock, no I/O, no cache. That is
 * what lets the retention rule below be tested instead of hoped for.
 *
 * Retention is the interesting decision. A round that fails *after* a good one
 * keeps the previous channels and is marked stale, because wiping ten correct
 * rows over a transient hiccup is a worse answer than showing slightly old
 * numbers with a timestamp that says so. Only a round that never succeeded
 * produces an empty channel list.
 */

/**
 * @param {object} input
 * @param {number} input.at Snapshot build time (epoch ms).
 * @param {any[] | null} input.rows This round's rows, or null when the round failed.
 * @param {object} input.settings Current settings, embedded for the client.
 * @param {object} input.poller Poller state (`state`, `delayMs`, `error`, `nextPollAt`).
 * @param {object | null} input.previous The last snapshot, if any.
 * @returns {object} The snapshot described by the spec (§5.3).
 */
export function buildSnapshot({ at, rows, settings, poller, previous }) {
  const failed = rows === null || rows === undefined
  const channels = failed ? (previous?.channels ?? []) : rows
  const loggedInCount = failed
    ? (previous?.loggedInCount ?? 0)
    : rows.filter(row => row.loggedIn === true).length

  return {
    at,
    stale: failed && previous !== null && previous !== undefined,
    poller: { ...poller },
    settings: { ...settings },
    channels,
    loggedInCount,
  }
}
