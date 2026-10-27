import { test } from 'node:test'
import assert from 'node:assert/strict'
import { loggedInFromStatuses, fetchRound } from '../src/round.js'

const CATALOGUE = ['loomy', 'trae', 'qoder']

test('只有账号数大于 0 的渠道算已登录', () => {
  assert.deepEqual(
    loggedInFromStatuses({ loomy: { accounts: { total: 2 } }, trae: { accounts: { total: 0 } } }),
    ['loomy'],
  )
  assert.deepEqual(loggedInFromStatuses({}), [])
  assert.deepEqual(loggedInFromStatuses(undefined), [])
})

test('只对已登录渠道查余额，其余标记 loggedIn:false', async () => {
  const asked = []
  const rpc = { async call(method, payload) {
    if (method === 'provider.status') return { ok: true, value: { statuses: { loomy: { accounts: { total: 1 } } } } }
    asked.push(payload.provider)
    return { ok: true, value: { accounts: [{ accountId: 'a', balance: { total: 491 } }] } }
  } }
  const { rows } = await fetchRound({ rpc, catalogue: CATALOGUE, timeoutMs: 1000, now: () => 1 })
  assert.deepEqual(asked, ['loomy'])
  assert.equal(rows.length, 3)
  assert.equal(rows.find(r => r.id === 'loomy').value, 491)
  assert.equal(rows.find(r => r.id === 'loomy').loggedIn, true)
  assert.equal(rows.find(r => r.id === 'qoder').loggedIn, false)
  assert.equal(rows.find(r => r.id === 'qoder').state, 'empty')
})

test('单渠道报错只影响该渠道', async () => {
  const rpc = { async call(method, payload) {
    if (method === 'provider.status') return { ok: true, value: { statuses: { loomy: { accounts: { total: 1 } }, trae: { accounts: { total: 1 } } } } }
    if (payload.provider === 'trae') throw new Error('boom')
    return { ok: true, value: { accounts: [{ accountId: 'a', balance: { total: 5 } }] } }
  } }
  const { rows } = await fetchRound({ rpc, catalogue: CATALOGUE, timeoutMs: 1000, now: () => 1 })
  assert.equal(rows.find(r => r.id === 'loomy').state, 'ok')
  assert.equal(rows.find(r => r.id === 'trae').state, 'unavailable')
  assert.match(rows.find(r => r.id === 'trae').reason, /boom/)
})
