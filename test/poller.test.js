import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createPoller } from '../src/poller.js'

/**
 * A fake scheduler that actually runs due callbacks. Without this the whole
 * scheduling / idle-stop / resume machine is untested — the 52-test suite this
 * replaces asserted booleans on a clock nobody advanced.
 */
function harness({ autoRefreshSec = 60, fetchRound } = {}) {
  let clock = 0
  let sequence = 0
  const timers = new Map()
  let release = null
  let gate = null
  const settings = { autoRefreshSec }
  const calls = { count: 0 }

  const poller = createPoller({
    now: () => clock,
    setTimer: (fn, ms) => { const id = ++sequence; timers.set(id, { fn, at: clock + ms }); return id },
    clearTimer: id => { timers.delete(id) },
    fetchRound: async signal => {
      calls.count += 1
      if (gate !== null) await gate
      return fetchRound === undefined ? { rows: [] } : fetchRound(signal)
    },
    settings,
  })

  return {
    poller,
    calls,
    timers,
    advance: ms => { clock += ms },
    /** Run every timer whose due time has passed, earliest first. */
    fireDue() {
      let fired = 0
      for (;;) {
        const due = [...timers.entries()].filter(([, entry]) => entry.at <= clock).sort((a, b) => a[1].at - b[1].at)
        if (due.length === 0) return fired
        const [id, entry] = due[0]
        timers.delete(id)
        entry.fn()
        fired += 1
      }
    },
    gate() { gate = new Promise(resolve => { release = resolve }) },
    release() { if (release !== null) release(); release = null; gate = null },
    async flush() { for (let i = 0; i < 10; i += 1) await Promise.resolve() },
  }
}

test('watch 立即返回并触发首轮', () => {
  const h = harness()
  const out = h.poller.watch()
  assert.equal(out.triggered, true)
  assert.equal(h.calls.count, 0, 'watch 本身不等取数')
})

test('单飞：并发 refresh 只产生一次取数', async () => {
  const h = harness()
  const a = h.poller.refresh()
  const b = h.poller.refresh()
  await Promise.all([a, b])
  assert.equal(h.calls.count, 1)
})

test('整轮失败后下一次间隔翻倍，成功后复位', async () => {
  let fail = true
  const h = harness({ fetchRound: async () => { if (fail) throw new Error('boom'); return { rows: [] } } })
  await h.poller.refresh()
  assert.equal(h.poller.state().state, 'backoff')
  assert.equal(h.poller.state().delayMs, 120_000)
  fail = false
  await h.poller.refresh()
  assert.equal(h.poller.state().state, 'idle')
  assert.equal(h.poller.state().delayMs, 60_000)
})

test('autoRefreshSec 为 0 时 watch 不触发取数', async () => {
  const h = harness({ autoRefreshSec: 0 })
  const out = h.poller.watch()
  assert.equal(out.triggered, false)
  await h.flush()
  assert.equal(h.calls.count, 0)
})

test('正常路径：Ttl 与间隔的较大者之内不重复触发，超过后才触发', async () => {
  const h = harness()
  h.poller.watch()
  await h.flush()
  h.advance(100_000)
  assert.equal(h.poller.watch().triggered, false)
  h.advance(60_000)
  assert.equal(h.poller.watch().triggered, true)
})

// ── 审查 I8：定时器真的被驱动 ──────────────────────────────────────────────

test('定时器到点会自己再轮询一次', async () => {
  const h = harness()
  h.poller.watch()
  await h.flush()
  assert.equal(h.calls.count, 1)
  h.advance(60_000)
  h.fireDue()
  await h.flush()
  assert.equal(h.calls.count, 2, '定时器必须能驱动第二轮')
})

test('闲置超过 Ttl 后定时器不再轮询，状态变为 stopped', async () => {
  const h = harness()
  h.poller.watch()
  await h.flush()
  h.advance(200_000)
  h.fireDue()
  await h.flush()
  assert.equal(h.poller.state().state, 'stopped')
  const before = h.calls.count
  h.advance(60_000)
  h.fireDue()
  await h.flush()
  assert.equal(h.calls.count, before, '停止后不该再有任何上游请求')
})

// ── 审查 I2：停止之后必须能被一次 watch 唤醒 ───────────────────────────────

test('闲置停止后，watch 回来立即恢复轮询并重装定时器', async () => {
  const h = harness()
  h.poller.watch()
  await h.flush()
  // 让定时器走到"停止"：数据只比 Ttl 旧一点，因此正常路径不会判它过期。
  h.advance(60_000); h.fireDue(); await h.flush()
  h.advance(60_000); h.fireDue(); await h.flush()
  h.advance(60_000); h.fireDue(); await h.flush()
  assert.equal(h.poller.state().state, 'stopped')

  const before = h.calls.count
  const out = h.poller.watch()
  assert.equal(out.triggered, true, '停止后的 watch 必须无条件唤醒轮询器')
  await h.flush()
  assert.equal(h.calls.count, before + 1, '唤醒必须真的取一次数')
  assert.equal(h.poller.state().state, 'idle')
  assert.ok(h.timers.size > 0, '唤醒后必须重新装上定时器')
})

// ── 审查 I1：进行中 / 重配 不是失败 ────────────────────────────────────────

test('轮询进行中的快照 stale=false，且继续显示旧数字', async () => {
  const h = harness({ fetchRound: async () => ({ rows: [{ id: 'loomy', loggedIn: true }] }) })
  h.poller.watch()
  await h.flush()
  h.gate()
  h.advance(60_000)
  h.fireDue()
  await h.flush()
  const mid = h.poller.read()
  assert.equal(mid.poller.state, 'polling')
  assert.equal(mid.stale, false, '正在查询不是出错')
  assert.deepEqual(mid.channels, [{ id: 'loomy', loggedIn: true }])
  h.release()
  await h.flush()
})

test('保存设置后 stale=false，polledAt 不变（数据没有变新）', async () => {
  const h = harness({ fetchRound: async () => ({ rows: [{ id: 'loomy', loggedIn: true }] }) })
  h.poller.watch()
  await h.flush()
  const before = h.poller.read()
  h.advance(5)
  h.poller.reconfigure({ autoRefreshSec: 30 })
  const after = h.poller.read()
  assert.equal(after.stale, false, '改显示开关不该让数字变成"旧数据"')
  assert.equal(after.polledAt, before.polledAt, 'polledAt 只由成功取数推进')
  assert.notEqual(after.poller.nextPollAt, undefined, 'nextPollAt 必须在本次发布里就是新的')
})
