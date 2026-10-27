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

test('余额是结构化对象时取 total', () => {
  // 实测形状：Loomy / TRAE / Raccoon / MiniMax / ZCode 返回的是
  // { total, packages, expiredTotal }，不是数字。OFM 自己的面板也读 total。
  const row = normalizeRow('loomy', env([{
    accountId: 'loomy-696e4af0',
    nickname: '夜平静',
    balance: { total: 573, expiredTotal: 0, packages: [{ name: '每日赠送', remaining: 573 }] },
  }]))
  assert.equal(row.state, 'ok')
  assert.equal(row.value, 573)
})

test('多个结构化余额取最小 total', () => {
  const row = normalizeRow('trae', env([
    { accountId: 'a', balance: { total: 356.2848 } },
    { accountId: 'b', balance: { total: 12 } },
  ]))
  assert.equal(row.value, 12)
  assert.equal(row.partial, false)
})

test('结构化余额里 total 不是有限数时算查不到', () => {
  const row = normalizeRow('zcode', env([{ accountId: 'a', balance: { total: null }, error: '无 total' }]))
  assert.equal(row.state, 'unknown')
  assert.equal(row.value, null)
})

test('结构化余额与数字余额混用时不误判', () => {
  const row = normalizeRow('raccoon', env([
    { accountId: 'a', balance: { total: 1864 } },
    { accountId: 'b', balance: null, error: '凭据未配置' },
  ]))
  assert.equal(row.state, 'ok')
  assert.equal(row.value, 1864)
  assert.equal(row.partial, true)
})

test('没有账号可读时保留原因，供面板显示', () => {
  const row = normalizeRow('loomy', env([{ accountId: 'a', balance: null, error: '积分查询失败（凭据失效或响应异常）' }]))
  assert.equal(row.reason, '积分查询失败（凭据失效或响应异常）')
})

// ── 显示精度：面板只显示一位小数 ──────────────────────────────────────────
// value 保持精确值（"已用尽" 的判定依赖它），amount 是给界面看的字符串。

test('小数只显示一位', () => {
  const row = normalizeRow('trae', env([{ accountId: 'a', balance: { total: 356.2848 } }]))
  assert.equal(row.value, 356.2848, '精确值必须保留，供 0 判定使用')
  assert.equal(row.amount, '356.3')
})

test('整数不显示小数点', () => {
  const row = normalizeRow('loomy', env([{ accountId: 'a', balance: { total: 573 } }]))
  assert.equal(row.amount, '573')
})

test('恰好 0 显示为 0', () => {
  const row = normalizeRow('trae', env([{ accountId: 'a', balance: 0 }]))
  assert.equal(row.value, 0)
  assert.equal(row.amount, '0')
})

test('极小余额取整成 0 时，value 仍非 0（不能被误判为已用尽）', () => {
  const row = normalizeRow('cline', env([{ accountId: 'a', balance: 0.04 }]))
  assert.equal(row.value, 0.04)
  assert.notEqual(row.value, 0)
  assert.equal(row.amount, '0')
})

test('小数进位正确', () => {
  assert.equal(normalizeRow('trae', env([{ accountId: 'a', balance: 12.35 }])).amount, '12.4')
  assert.equal(normalizeRow('trae', env([{ accountId: 'a', balance: 4.1 }])).amount, '4.1')
})

// ── 界面重设计：行带上厂商色与短单位，供客户端直接使用 ──────────────────────

test('行携带厂商品牌色与短单位', () => {
  const row = normalizeRow('loomy', env([{ accountId: 'a', balance: { total: 573 } }]))
  assert.equal(row.accent, '#2F6BFF')
  assert.equal(row.unitShort, '积分')
})

test('无数据状态也带品牌色（未登录的行仍属于该厂商）', () => {
  const row = normalizeRow('qoder', env([]))
  assert.equal(row.state, 'empty')
  assert.equal(row.accent, '#615CED')
  assert.equal(row.unitShort, '积分')
})
