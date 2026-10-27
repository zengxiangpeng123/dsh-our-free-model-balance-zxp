import { test } from 'node:test'
import assert from 'node:assert/strict'
import { normalizeRow } from '../src/balances.js'

const env = accounts => ({ ok: true, value: { accounts } })

test('全部账号有数 → ok，取最小值', () => {
  const row = normalizeRow('loomy', env([
    { accountId: 'a', balance: 12.3 }, { accountId: 'b', balance: 4.1 },
  ]))
  assert.equal(row.state, 'ok')
  assert.equal(row.value, 4.1)
  assert.equal(row.partial, false)
  assert.equal(row.unitLabel, '剩余积分')
})

test('余额 0 是已用光，不是查不到', () => {
  const row = normalizeRow('trae', env([{ accountId: 'a', balance: 0 }]))
  assert.equal(row.state, 'ok')
  assert.equal(row.value, 0)
})

test('部分账号查不到 → partial', () => {
  const row = normalizeRow('raccoon', env([
    { accountId: 'a', balance: 8 }, { accountId: 'b', balance: null, error: '凭据未配置' },
  ]))
  assert.equal(row.state, 'ok')
  assert.equal(row.value, 8)
  assert.equal(row.partial, true)
  assert.equal(row.reason, '凭据未配置')
})

test('全部查不到 → unknown', () => {
  const row = normalizeRow('zcode', env([{ accountId: 'a', balance: null, error: '积分查询失败' }]))
  assert.equal(row.state, 'unknown')
  assert.equal(row.value, null)
})

test('没有任何账号 → empty（未登录）', () => {
  assert.equal(normalizeRow('qoder', env([])).state, 'empty')
})

test('RPC 失败 → unavailable', () => {
  const row = normalizeRow('trae', { ok: false, error: { code: 'bad-request', message: '不支持' } })
  assert.equal(row.state, 'unavailable')
  assert.equal(row.reason, '不支持')
})

test('不认识的渠道 → unavailable，不猜数字', () => {
  const row = normalizeRow('some-new-channel', env([{ accountId: 'a', balance: 99 }]))
  assert.equal(row.state, 'unavailable')
  assert.equal(row.value, null)
  assert.equal(row.name, 'some-new-channel')
  assert.equal(row.reason, '未知渠道')
})

test('没有账号可读时保留原因，供面板显示', () => {
  const row = normalizeRow('loomy', env([{ accountId: 'a', balance: null, error: '积分查询失败（凭据失效或响应异常）' }]))
  assert.equal(row.reason, '积分查询失败（凭据失效或响应异常）')
})
