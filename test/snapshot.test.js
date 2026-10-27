import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildSnapshot } from '../src/snapshot.js'

const settings = { autoRefreshSec: 60, showSignedOut: false }
const rows = [
  { id: 'loomy', loggedIn: true, state: 'ok', value: 491, amount: '491' },
  { id: 'qoder', loggedIn: false, state: 'empty', value: null, amount: '' },
]

test('成功一轮：带设置、带未登录渠道、计已登录数', () => {
  const snap = buildSnapshot({ at: 1000, rows, settings, poller: { state: 'idle' }, previous: null })
  assert.equal(snap.at, 1000)
  assert.equal(snap.stale, false)
  assert.equal(snap.loggedInCount, 1)
  assert.equal(snap.channels.length, 2)
  assert.deepEqual(snap.settings, settings)
})

test('整轮失败但此前有数据：保留旧行、stale 为 true', () => {
  const previous = buildSnapshot({ at: 900, rows, settings, poller: { state: 'idle' }, previous: null })
  const snap = buildSnapshot({ at: 1000, rows: null, settings, poller: { state: 'backoff', error: 'boom' }, previous })
  assert.equal(snap.stale, true)
  assert.deepEqual(snap.channels, previous.channels)
  assert.equal(snap.poller.error, 'boom')
})

test('整轮失败且从未成功：channels 为空', () => {
  const snap = buildSnapshot({ at: 1000, rows: null, settings, poller: { state: 'backoff', error: 'boom' }, previous: null })
  assert.deepEqual(snap.channels, [])
  assert.equal(snap.loggedInCount, 0)
})
