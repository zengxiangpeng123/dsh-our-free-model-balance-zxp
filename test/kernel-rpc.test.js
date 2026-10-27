import { test } from 'node:test'
import assert from 'node:assert/strict'
import { ownerPeer, makeKernelRpc } from '../src/kernel-rpc.js'

const peer = { principal: { kind: 'owner' } }

function fakeConnection({ browserPeer, operator, handler }) {
  return { browserPeer, operator, createSharedFetchHandler: () => handler }
}

test('ownerPeer 依次取 browserPeer / operator', () => {
  assert.equal(ownerPeer({ browserPeer: peer, operator: 'old' }), peer)
  assert.equal(ownerPeer({ operator: 'old' }), 'old')
  assert.equal(ownerPeer({}), undefined)
  assert.equal(ownerPeer(null), undefined)
})

test('信封形状与响应解包', async () => {
  let seen
  const handler = {
    async fetch(request) {
      seen = { url: request.url, body: JSON.parse(await request.text()) }
      return new Response(JSON.stringify({ result: { ok: true, value: { accounts: [] } } }))
    },
  }
  const rpc = makeKernelRpc(() => fakeConnection({ browserPeer: peer, handler }))
  const result = await rpc.call('credits.balances', { provider: 'loomy' })
  assert.equal(seen.url, 'http://127.0.0.1/api/channel-pack')
  assert.equal(seen.body.type, 'client-request')
  assert.equal(seen.body.method, 'channel-pack')
  assert.deepEqual(seen.body.payload, { method: 'credits.balances', payload: { provider: 'loomy' } })
  assert.equal(typeof seen.body.rpcId, 'string')
  assert.deepEqual(result.value, { accounts: [] })
})

test('没有 Peer 时明确报错（不静默返回空）', async () => {
  const rpc = makeKernelRpc(() => fakeConnection({ handler: { async fetch() { return new Response('{}') } } }))
  await assert.rejects(() => rpc.call('x', {}), /owner peer/i)
})

test('403 与 ok:false 都转成可读错误', async () => {
  const forbidden = makeKernelRpc(() => fakeConnection({ browserPeer: peer, handler: { async fetch() { return new Response('', { status: 403 }) } } }))
  await assert.rejects(() => forbidden.call('x', {}), /403/)
  const refused = makeKernelRpc(() => fakeConnection({ browserPeer: peer, handler: { async fetch() { return new Response(JSON.stringify({ result: { ok: false, error: { message: 'no pack' } } })) } } }))
  await assert.rejects(() => refused.call('x', {}), /no pack/)
})

// ── 审查 I5：非 2xx 与不对劲的信封都不能当成功 ─────────────────────────────

test('404 + JSON 正文必须算失败，不能被当成"没有渠道"', async () => {
  const handler = {
    async fetch() {
      return new Response(JSON.stringify({ error: 'not found' }), { status: 404 })
    },
  }
  const rpc = makeKernelRpc(() => fakeConnection({ browserPeer: peer, handler }))
  await assert.rejects(() => rpc.call('provider.status', { providers: ['loomy'] }), /404/)
})

test('缺 ok 字段的信封必须算失败', async () => {
  const handler = {
    async fetch() {
      return new Response(JSON.stringify({ result: { value: { accounts: [] } } }))
    },
  }
  const rpc = makeKernelRpc(() => fakeConnection({ browserPeer: peer, handler }))
  await assert.rejects(() => rpc.call('credits.balances', { provider: 'loomy' }), /unexpected envelope/)
})
