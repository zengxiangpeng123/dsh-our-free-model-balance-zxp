/**
 * Who polls, and when.
 *
 * The rule that keeps this honest: **the timer owns the interval, the watch
 * owns "is anyone looking".** A heartbeat never refreshes on its own — if it
 * did, every open tab would become a second scheduler and the configured
 * interval would mean nothing. A watch only refreshes when the freshest data
 * has gone older than the resume threshold, which is the larger of the idle
 * timeout and the configured interval: shorter than the interval would poll
 * more often than the user asked, longer than the idle timeout would leave a
 * returning user looking at numbers the poller itself considered stale.
 *
 * Everything here takes its clock, its timers and its round-fetcher from the
 * caller, so the whole state machine is testable without waiting on wall time.
 */
import { buildSnapshot } from './snapshot.js'

/** No watch for this long means nobody is looking; polling stops. */
export const WATCH_TTL_MS = 150_000

/** Ceiling for the failure backoff. */
export const MAX_BACKOFF_MS = 600_000

/** @typedef {'stopped'|'idle'|'polling'|'backoff'} PollerState */

/**
 * @param {object} options
 * @param {() => number} options.now
 * @param {(fn: () => void, ms: number) => any} options.setTimer
 * @param {(handle: any) => void} options.clearTimer
 * @param {() => { autoRefreshSec: number }} options.readSettings
 * @param {(signal?: AbortSignal) => Promise<{ rows: any[] }>} options.fetchRound
 * @param {readonly string[]} options.catalogue
 * @param {{ autoRefreshSec: number }} options.settings
 */
export function createPoller(options) {
  const { now, setTimer, clearTimer, readSettings, fetchRound } = options

  let settings = { ...options.settings }
  /** @type {PollerState} */
  let state = 'stopped'
  let delayMs = intervalMs(settings)
  let error = /** @type {string|null} */ (null)
  let lastWatchAt = /** @type {number|undefined} */ (undefined)
  let lastPollAt = /** @type {number|undefined} */ (undefined)
  let nextPollAt = /** @type {number|undefined} */ (undefined)
  let timer = /** @type {any} */ (undefined)
  let inflight = /** @type {Promise<object>|null} */ (null)
  let snapshot = /** @type {object|undefined} */ (undefined)
  let stopped = false

  /** The configured interval, floored so a tiny value cannot spin. */
  function intervalMs(current) {
    return Math.max(1000, Math.round((current?.autoRefreshSec ?? 0) * 1000))
  }

  function automatic(current) {
    return (current?.autoRefreshSec ?? 0) > 0
  }

  /** Data older than this makes a returning watch refresh immediately. */
  function resumeAfterMs(current) {
    return Math.max(WATCH_TTL_MS, intervalMs(current))
  }

  function publish(rows) {
    snapshot = buildSnapshot({
      at: now(),
      rows,
      settings,
      poller: { state, delayMs, error, nextPollAt },
      previous: snapshot ?? null,
    })
    return snapshot
  }

  function schedule() {
    if (timer !== undefined) { clearTimer(timer); timer = undefined }
    if (stopped || !automatic(settings)) { nextPollAt = undefined; return }
    nextPollAt = now() + delayMs
    timer = setTimer(() => { timer = undefined; tick() }, delayMs)
  }

  /** Drop to stopped once nobody has looked for the idle timeout. */
  function idleOut() {
    if (lastWatchAt === undefined) return true
    return now() - lastWatchAt > WATCH_TTL_MS
  }

  function tick() {
    if (stopped) return
    if (idleOut()) {
      state = 'stopped'
      nextPollAt = undefined
      publish(null)
      return
    }
    void refresh()
  }

  /**
   * Run one round. Concurrent callers share the round in flight, so a timer, a
   * heartbeat and a manual refresh landing together cost one upstream round.
   * @returns {Promise<object>} The snapshot after this round.
   */
  function refresh() {
    if (inflight !== null) return inflight
    state = 'polling'
    lastPollAt = now()
    publish(null)
    inflight = (async () => {
      // Claim the round synchronously (so a watch in the same tick already sees
      // `lastPollAt` and does not fire a second one), but start the upstream
      // call on the next microtask: `watch()` promises never to block its
      // caller, and calling fetchRound here would run before watch returns.
      await Promise.resolve()
      try {
        const round = await fetchRound()
        const rows = round?.rows ?? null
        if (rows === null) throw new Error('round returned no rows')
        error = null
        delayMs = intervalMs(settings)
        state = 'idle'
        const next = publish(rows)
        return next
      } catch (failure) {
        error = failure instanceof Error ? failure.message : String(failure)
        delayMs = Math.min(delayMs * 2, MAX_BACKOFF_MS)
        state = 'backoff'
        const next = publish(null)
        return next
      } finally {
        inflight = null
        schedule()
      }
    })()
    return inflight
  }

  return {
    /**
     * A client reports it is still on screen. Never blocks, and only refreshes
     * when what it would be shown is older than the resume threshold.
     * @returns {{ snapshot: object, triggered: boolean }}
     */
    watch() {
      const at = now()
      const stale = lastPollAt === undefined || at - lastPollAt >= resumeAfterMs(settings)
      lastWatchAt = at
      const shouldTrigger = automatic(settings) && !stopped && stale
      if (shouldTrigger) {
        state = 'idle'
        void refresh()
      } else if (snapshot === undefined) {
        publish(null)
      }
      return { snapshot: /** @type {object} */ (snapshot), triggered: shouldTrigger }
    },

    /** The current snapshot, built on demand if this poller never published one. */
    read() {
      if (snapshot === undefined) publish(null)
      return snapshot
    },

    refresh,

    /** Apply saved settings and re-arm the timer. */
    reconfigure(next) {
      settings = { ...next }
      delayMs = intervalMs(settings)
      if (!automatic(settings)) { if (timer !== undefined) { clearTimer(timer); timer = undefined } nextPollAt = undefined }
      schedule()
      publish(null)
      return snapshot
    },

    /** Hand back the poller's own view, for the snapshot and the settings page. */
    state() {
      return { state, delayMs, error, nextPollAt }
    },

    /** Stop for good; the plugin is unloading. */
    stop() {
      stopped = true
      if (timer !== undefined) { clearTimer(timer); timer = undefined }
      nextPollAt = undefined
      state = 'stopped'
    },
  }
}
