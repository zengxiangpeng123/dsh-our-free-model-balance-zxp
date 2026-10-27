import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createPoller } from '../src/poller.js'

function harness({ autoRefreshSec = 60, fetchRound } = {}) {
  let clock = 0
  const timers = []
  const settings = { autoRefreshSec }
  const poller = createPoller({
    now: () => clock,
    setTimer: (fn, ms) => { const t = { fn, at: clock + ms }; timers.push(t); return t },
    clearTimer: t => { const i = timers.indexOf(t); if (i >= 0) timers.splice(i, 1) },
    readSettings: () => settings,
    readConnection: () => ({}),
    fetchRound: fetchRound ?? (async () => ({ rows: [] })),
    catalogue: ['loomy'],
    settings,
  })
  return { poller, advance: ms => { clock += ms }, timers, settings, peek: () => clock }
}

test('watch 立即返回并触发首轮', () => {
  let calls = 0
  const h = harness({ fetchRound: async () => { calls += 1; return { rows: [] } } })
  const out = h.poller.watch()
  assert.equal(out.triggered, true)
  assert.equal(calls, 0, 'watch 本身不等取数')
})

test('单飞：并发 refresh 只产生一次取数', async () => {
  let calls = 0
  let release
  const gate = new Promise(r => { release = r })
  const h = harness({ fetchRound: async () => { calls += 1; await gate; return { rows: [] } } })
  const a = h.poller.refresh()
  const b = h.poller.refresh()
  release()
  await Promise.all([a, b])
  assert.equal(calls, 1)
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

test('autoRefreshSec 为 0 时 watch 不触发取数', () => {
  let calls = 0
  const h = harness({ autoRefreshSec: 0, fetchRound: async () => { calls += 1; return { rows: [] } } })
  const out = h.poller.watch()
  assert.equal(out.triggered, false)
  assert.equal(calls, 0)
})

test('watchTtl 过后 watch 再次触发；Ttl 内不重复触发', () => {
  let calls = 0
  const h = harness({ fetchRound: async () => { calls += 1; return { rows: [] } } })
  h.poller.watch()
  h.advance(100_000)
  assert.equal(h.poller.watch().triggered, false)
  h.advance(60_000)
  assert.equal(h.poller.watch().triggered, true)
})
