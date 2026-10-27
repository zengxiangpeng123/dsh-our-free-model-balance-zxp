import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createRoutes } from '../src/routes.js'

function deps(overrides = {}) {
  const snapshot = { at: 1, channels: [], poller: { state: 'idle' } }
  return {
    poller: {
      watch: () => ({ snapshot, triggered: false }),
      read: () => snapshot,
      refresh: async () => snapshot,
      reconfigure: () => {},
    },
    getSettings: () => ({ autoRefreshSec: 60 }),
    putSettings: async next => next,
    ...overrides,
  }
}

test('GET /snapshot 返回快照', async () => {
  const out = await createRoutes(deps()).handle({ method: 'GET', route: '/snapshot' })
  assert.equal(out.status, 200)
  assert.equal(out.body.at, 1)
})

test('POST /watch 返回快照并报告是否触发', async () => {
  const out = await createRoutes(deps({ poller: { ...deps().poller, watch: () => ({ snapshot: { at: 2 }, triggered: true }) } })).handle({ method: 'POST', route: '/watch' })
  assert.equal(out.body.at, 2)
  assert.equal(out.body.triggered, true)
})

test('POST /refresh 阻塞到轮询完成', async () => {
  let done = false
  const out = await createRoutes(deps({ poller: { ...deps().poller, refresh: async () => { done = true; return { at: 3 } } } })).handle({ method: 'POST', route: '/refresh' })
  assert.equal(done, true)
  assert.equal(out.body.at, 3)
})

test('GET /settings 返回当前设置', async () => {
  const out = await createRoutes(deps()).handle({ method: 'GET', route: '/settings' })
  assert.equal(out.status, 200)
  assert.equal(out.body.settings.autoRefreshSec, 60)
})

test('PUT /settings 校验后保存并重配轮询器', async () => {
  let saved; let reconfigured
  const out = await createRoutes(deps({
    putSettings: async next => { saved = next; return next },
    poller: { ...deps().poller, reconfigure: s => { reconfigured = s } },
  })).handle({ method: 'PUT', route: '/settings', body: { autoRefreshSec: 5 } })
  assert.equal(out.status, 200)
  assert.equal(saved.autoRefreshSec, 15)
  assert.equal(reconfigured.autoRefreshSec, 15)
})

test('未知路由 404，方法不对 405', async () => {
  assert.equal((await createRoutes(deps()).handle({ method: 'GET', route: '/nope' })).status, 404)
  assert.equal((await createRoutes(deps()).handle({ method: 'PUT', route: '/snapshot' })).status, 405)
})
