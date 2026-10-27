import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildSnapshot } from '../src/snapshot.js'

const settings = { autoRefreshSec: 60, showSignedOut: false }
const rows = [
  { id: 'loomy', loggedIn: true, state: 'ok', value: 491, amount: '491' },
  { id: 'qoder', loggedIn: false, state: 'empty', value: null, amount: '' },
]

test('成功一轮：带设置、带未登录渠道、计已登录数', () => {
  const snap = buildSnapshot({ at: 1000, polledAt: 1000, rows, failed: false, settings, poller: { state: 'idle' }, previous: null })
  assert.equal(snap.at, 1000)
  assert.equal(snap.stale, false)
  assert.equal(snap.loggedInCount, 1)
  assert.equal(snap.channels.length, 2)
  assert.deepEqual(snap.settings, settings)
})

test('整轮失败但此前有数据：保留旧行、stale 为 true', () => {
  const previous = buildSnapshot({ at: 900, polledAt: 900, rows, failed: false, settings, poller: { state: 'idle' }, previous: null })
  const snap = buildSnapshot({ at: 1000, polledAt: 900, rows: null, failed: true, settings, poller: { state: 'backoff', error: 'boom' }, previous })
  assert.equal(snap.stale, true)
  assert.deepEqual(snap.channels, previous.channels)
  assert.equal(snap.poller.error, 'boom')
})

test('整轮失败且从未成功：channels 为空', () => {
  const snap = buildSnapshot({ at: 1000, polledAt: null, rows: null, failed: true, settings, poller: { state: 'backoff', error: 'boom' }, previous: null })
  assert.deepEqual(snap.channels, [])
  assert.equal(snap.loggedInCount, 0)
})

// ── 审查后新增：进行中 / 重配 不等于失败 ────────────────────────────────────

test('轮询进行中（rows 为 null 但不是失败）：保留旧行，stale 必须为 false', () => {
  const previous = buildSnapshot({ at: 900, polledAt: 900, rows, failed: false, settings, poller: { state: 'idle' }, previous: null })
  const snap = buildSnapshot({ at: 1000, polledAt: 900, rows: null, failed: false, settings, poller: { state: 'polling' }, previous })
  assert.equal(snap.stale, false, '正在查询不是出错，标成 stale 会让面板谎称"数字可能不准"')
  assert.deepEqual(snap.channels, previous.channels, '进行中要继续显示手里已有的数字')
})

test('保存设置后重配：stale 必须为 false', () => {
  const previous = buildSnapshot({ at: 900, polledAt: 900, rows, failed: false, settings, poller: { state: 'idle' }, previous: null })
  const snap = buildSnapshot({ at: 1000, polledAt: 900, rows: null, failed: false, settings, poller: { state: 'idle' }, previous })
  assert.equal(snap.stale, false, '改一个显示开关不该让数字变成"旧数据"')
  assert.deepEqual(snap.channels, previous.channels)
})

test('polledAt 记录最后一次成功取数，不随快照重建而前进', () => {
  const previous = buildSnapshot({ at: 900, polledAt: 900, rows, failed: false, settings, poller: { state: 'idle' }, previous: null })
  const snap = buildSnapshot({ at: 5000, polledAt: 900, rows: null, failed: false, settings, poller: { state: 'polling' }, previous })
  assert.equal(snap.at, 5000, 'at 是快照构建时间')
  assert.equal(snap.polledAt, 900, 'polledAt 才是"上次更新"，客户端的"上次更新"必须读它')
})
