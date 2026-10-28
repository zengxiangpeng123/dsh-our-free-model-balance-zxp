import { test } from 'node:test'
import assert from 'node:assert/strict'
import { normalizeRow } from '../src/balances.js'

const env = accounts => ({ ok: true, value: { accounts } })

test('全部账号有数 → ok，取总和（与 OFM 面板口径一致）', () => {
  const row = normalizeRow('loomy', env([
    { accountId: 'a', balance: 12.3 }, { accountId: 'b', balance: 4.1 },
  ]))
  assert.equal(row.state, 'ok')
  assert.equal(row.value, 16.4)
  assert.equal(row.partial, false)
  assert.equal(row.unitLabel, '剩余积分')
})

test('三个账号也求和', () => {
  const row = normalizeRow('loomy', env([
    { accountId: 'a', balance: { total: 573 } },
    { accountId: 'b', balance: { total: 356.2848 } },
    { accountId: 'c', balance: { total: 0 } },
  ]))
  assert.equal(row.value, 929.2848)
  assert.equal(row.amount, '929.3')
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

test('多个结构化余额取总和', () => {
  const row = normalizeRow('trae', env([
    { accountId: 'a', balance: { total: 356.2848 } },
    { accountId: 'b', balance: { total: 12 } },
  ]))
  assert.equal(row.value, 368.2848)
  assert.equal(row.amount, '368.3')
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

// ── 千以上的缩写：与 OFM 自己的 kilo() 同口径 ─────────────────────────────
// OFM 的规则：≥1e7 → 0 位小数的 M；≥1e6 → 1 位小数的 M；
// ≥10K → 0 位小数的 K；≥1K → 1 位小数的 K；其余按原数。
// 千以下我们保留需求方要过的一位小数，不用 OFM 的取整。

test('千以上按 OFM 口径缩写', () => {
  assert.equal(normalizeRow('loomy', env([{ accountId: 'a', balance: { total: 15000 } }])).amount, '15K')
  assert.equal(normalizeRow('raccoon', env([{ accountId: 'a', balance: { total: 7510 } }])).amount, '7.5K')
  assert.equal(normalizeRow('zcode', env([{ accountId: 'a', balance: { total: 8000000 } }])).amount, '8.0M')
  assert.equal(normalizeRow('zcode', env([{ accountId: 'a', balance: { total: 12000000 } }])).amount, '12M')
})

test('千以下保留一位小数（不改口径）', () => {
  assert.equal(normalizeRow('trae', env([{ accountId: 'a', balance: { total: 356.2848 } }])).amount, '356.3')
  assert.equal(normalizeRow('loomy', env([{ accountId: 'a', balance: { total: 573 } }])).amount, '573')
})

// ── 悬浮显示逐账号明细 ────────────────────────────────────────────────────

test('行携带逐账号明细（昵称 + 余额 + 读不到的原因），供悬浮弹出', () => {
  const row = normalizeRow('raccoon', env([
    { accountId: 'r1', nickname: 'RaccoonElizabeth (6491)', balance: { total: 380 } },
    { accountId: 'r2', nickname: '151******91', balance: { total: 7130 } },
    { accountId: 'r3', nickname: '第三个', balance: null, error: '凭据未配置' },
  ]))
  assert.equal(row.value, 7510, '总和不变')
  assert.equal(row.partial, true)
  assert.equal(row.accounts.length, 3)
  assert.equal(row.accounts[0].name, 'RaccoonElizabeth (6491)')
  assert.equal(row.accounts[0].amount, '380')
  assert.equal(row.accounts[1].amount, '7.1K')
  assert.equal(row.accounts[2].note, '凭据未配置')
  assert.equal(row.accounts[2].amount, '')
})

test('昵称缺失时退回账号 id', () => {
  const row = normalizeRow('loomy', env([{ accountId: 'loomy-abc', balance: { total: 100 } }]))
  assert.equal(row.accounts[0].name, 'loomy-abc')
})

test('没有账号时 accounts 为空数组', () => {
  assert.deepEqual(normalizeRow('qoder', env([])).accounts, [])
})

// ── 悬浮卡片：总额与逐账号都要两位小数的精确值 ────────────────────────────

test('精确值格式化到两位小数，供悬浮卡片使用', () => {
  const row = normalizeRow('raccoon', env([
    { accountId: 'r1', nickname: 'A', balance: { total: 380 } },
    { accountId: 'r2', nickname: 'B', balance: { total: 7130.004 } },
  ]))
  assert.equal(row.exact, '7510.00', '总额两位小数')
  assert.equal(row.accounts[0].exact, '380.00')
  assert.equal(row.accounts[1].exact, '7130.00', '多余的小数位要进位/截断')
  assert.equal(row.amount, '7.5K', '行内仍是缩写，两种表示并存')
})

test('零与小额也保留两位小数', () => {
  assert.equal(normalizeRow('trae', env([{ accountId: 'a', balance: 0 }])).exact, '0.00')
  assert.equal(normalizeRow('cline', env([{ accountId: 'a', balance: 0.04 }])).exact, '0.04')
  assert.equal(normalizeRow('zcode', env([{ accountId: 'a', balance: { total: 8000000 } }])).exact, '8000000.00')
})
