# 宿主轮询 + 设置页 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让余额数字自动保持新鲜（宿主按可配间隔轮询并缓存快照），并给出一个独立设置页控制刷新间隔与显示项。

**Architecture:** 宿主半新增六个纯逻辑模块（设置存储、内核 RPC、单轮取数、快照构建、轮询器、路由分发），全部可单测；`index.js` 只做 HTTP 适配与装配。客户端半从"自己调 RPC"改成"读快照"，并在 `settings.section` 注册一整页设置。

**Tech Stack:** Node ESM（宿主）、`node:test`（测试）、Cordis slot 注册（Web 客户端）、React 由页面模块表提供。

**Spec:** `docs/superpowers/specs/2026-10-27-host-polling-and-settings-design.md`

## Global Constraints

- 插件目录：`C:\Users\15173\.dsh\local-bundles\dsh-our-free-model-balance-zxp`；包名 `dsh-our-free-model-balance-zxp`
- 接口前缀：`/api/our-free-model-balance-zxp`
- 设置文件：`$DSH_HOME/dsh-our-free-model-balance-zxp/settings.json`（`$DSH_HOME = process.env.DSH_HOME ?? ~/.dsh`），**原子写**
- 内核调用：`connection.createSharedFetchHandler('/api')` + owner Peer（`connection.browserPeer ?? connection.operator`）+ 信封 `{ type:'client-request', rpcId, method:'channel-pack', payload:{ method, payload } }`，POST 到 `http://127.0.0.1/api/channel-pack`，应答取 `body.result ?? body`
- 候选渠道集 = 内置 10 个（`src/channels.js` 的 `CHANNELS`）；**不做目录外发现**（内核无枚举接口）
- 轮询：心跳间隔 `min(60s, autoRefreshSec)`；`watchTtl = 150_000ms`；`polling` 期间客户端每 2 秒本地重读；退避上限 `600_000ms`；`autoRefreshSec` 取值 `0` 或 `15..3600`
- 整轮失败保留上一轮数据并置 `stale: true`；单渠道失败不触发退避
- 显示语义沿用第一轮：`value` 精确、`amount` 一位小数、`value === 0` 才是「用尽」
- `hiddenChannels` 只影响面板列表；图标永远显示当前渠道
- 客户端半不可单测（模块加载器交付，Node 无法 import）——能判定的逻辑一律留在宿主半
- 所有可见文案走 locale 字典，不在组件里硬编码

## Review Focus

1. **OFM 未安装或 `channel-pack` 路由不存在** —— 宿主调不通内核 RPC。期望：面板顶部一行可读原因，保留上一轮数字并标记为旧，退避到 10 分钟，不刷错误日志、不狂重试。
2. **内核版本差异导致 owner Peer 缺失**（`browserPeer` 与 `operator` 都没有）—— 期望：明确报「当前 DSH 未提供内核 Peer」，不静默返回空数组冒充"没有渠道"。
3. **设置文件损坏或字段越界** —— 期望：回落到默认值继续工作，坏文件另存 `.bad`，不因一次手改而整个插件失效。
4. **多标签页同时心跳 + 定时触发** —— 期望：同一时刻只发生一轮上游请求（单飞），后到者等同一个 Promise。
5. **整轮失败、或当前渠道被 `hiddenChannels` 隐藏** —— 期望：前者保留旧数字并置 `stale`（Task 4 单测）；后者面板里不出现该行但图标仍在（**纯客户端渲染，只能人工验证**，Task 8 Step 4，不宣称自动化覆盖）。

---

### Task 1: 设置存储

**Files:**
- Create: `src/settings.js`
- Test: `test/settings.test.js`

**Interfaces:**
- Consumes: 无
- Produces: `DEFAULT_SETTINGS`（对象，含 §5.4 的十项）；`AUTO_REFRESH_MIN = 15`、`AUTO_REFRESH_MAX = 3600`；`sanitizeSettings(raw) -> settings`；`settingsFile(home) -> string`；`loadSettings(file) -> Promise<settings>`；`saveSettings(file, settings) -> Promise<void>`

- [ ] **Step 1: Write the failing test**

```js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { DEFAULT_SETTINGS, sanitizeSettings, loadSettings, saveSettings } from '../src/settings.js'

test('空输入得到默认值', () => {
  assert.deepEqual(sanitizeSettings({}), DEFAULT_SETTINGS)
  assert.deepEqual(sanitizeSettings(null), DEFAULT_SETTINGS)
})

test('类型错用默认，数值越界夹取', () => {
  const s = sanitizeSettings({ autoRefreshSec: 5, showUnits: 'yes', chipStyle: 'fancy' })
  assert.equal(s.autoRefreshSec, 15)
  assert.equal(s.showUnits, true)
  assert.equal(s.chipStyle, 'number')
  assert.equal(sanitizeSettings({ autoRefreshSec: 99999 }).autoRefreshSec, 3600)
  assert.equal(sanitizeSettings({ autoRefreshSec: 0 }).autoRefreshSec, 0)
})

test('hiddenChannels 只留字符串并去重', () => {
  assert.deepEqual(sanitizeSettings({ hiddenChannels: ['a', 'a', 3, null] }).hiddenChannels, ['a'])
})

test('文件不存在时给默认值', async () => {
  const file = path.join(await fs.mkdtemp(path.join(os.tmpdir(), 'ofmb-')), 'settings.json')
  assert.deepEqual(await loadSettings(file), DEFAULT_SETTINGS)
})

test('文件损坏时回落默认并把坏文件另存 .bad', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'ofmb-'))
  const file = path.join(dir, 'settings.json')
  await fs.writeFile(file, '{ not json')
  assert.deepEqual(await loadSettings(file), DEFAULT_SETTINGS)
  await assert.doesNotReject(fs.access(`${file}.bad`))
})

test('保存后可读回，且写的是完整设置', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'ofmb-'))
  const file = path.join(dir, 'settings.json')
  await saveSettings(file, { ...DEFAULT_SETTINGS, autoRefreshSec: 0, showUnits: false })
  const back = await loadSettings(file)
  assert.equal(back.autoRefreshSec, 0)
  assert.equal(back.showUnits, false)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/settings.test.js`
Expected: FAIL — `Cannot find module '../src/settings.js'`

- [ ] **Step 3: Implement `src/settings.js`**

导出上述五个名字。`sanitizeSettings` 逐字段：bool 用 `typeof === 'boolean'` 才采纳；`autoRefreshSec` 接受 `0` 或夹到 `[15, 3600]` 的整数；`chipStyle` 仅 `'number' | 'dot'`；`hiddenChannels` 过滤非字符串并去重。`loadSettings`：ENOENT → 默认；解析或校验抛错 → `rename(file, file + '.bad')`（失败忽略）后返回默认。`saveSettings`：`mkdir -p` 目录，写 `file + '.tmp'` 再 `rename`，保证原子。

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/settings.test.js`
Expected: PASS（6 个测试）

- [ ] **Step 5: Commit**

```bash
git add src/settings.js test/settings.test.js
git commit -m "feat(settings): validated settings store with atomic writes"
```

---

### Task 2: 内核 RPC 客户端

**Files:**
- Create: `src/kernel-rpc.js`
- Test: `test/kernel-rpc.test.js`

**Interfaces:**
- Consumes: 无
- Produces: `CHANNEL_PACK_PATH = '/api/channel-pack'`、`CHANNEL_PACK_METHOD = 'channel-pack'`；`ownerPeer(connection) -> object | undefined`；`makeKernelRpc(readConnection) -> { call(method, payload, signal) }`

- [ ] **Step 1: Write the failing test**

```js
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/kernel-rpc.test.js`
Expected: FAIL — `Cannot find module '../src/kernel-rpc.js'`

- [ ] **Step 3: Implement `src/kernel-rpc.js`**

`ownerPeer` 依次取 `browserPeer`、`operator`。`makeKernelRpc(readConnection)` 每次调用**延迟读取** connection（服务可能晚于插件发布）；无 connection / 无 handler / 无 peer 各自抛出定向错误；构造信封、`POST`、读文本、`JSON.parse`、取 `body.result ?? body`、`ok === false` 抛 `error.message ?? error.code`。

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/kernel-rpc.test.js`
Expected: PASS（4 个测试）

- [ ] **Step 5: Commit**

```bash
git add src/kernel-rpc.js test/kernel-rpc.test.js
git commit -m "feat(kernel-rpc): in-process channel-pack caller"
```

---

### Task 3: 单轮取数

**Files:**
- Create: `src/round.js`
- Test: `test/round.test.js`

**Interfaces:**
- Consumes: `channelFor`/`unitLabel`/`unitShort`（`src/channels.js`）、`normalizeRow`（`src/balances.js`）
- Produces: `loggedInFromStatuses(statuses) -> string[]`；`fetchRound({ rpc, catalogue, timeoutMs, now }) -> Promise<{ rows }>`，其中每个 row 是 `normalizeRow` 的结果再加上 `loggedIn: boolean`

- [ ] **Step 1: Write the failing test**

```js
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
    if (method === 'provider.status') return { value: { statuses: { loomy: { accounts: { total: 1 } } } } }
    asked.push(payload.provider)
    return { value: { accounts: [{ accountId: 'a', balance: { total: 491 } }] } }
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
    if (method === 'provider.status') return { value: { statuses: { loomy: { accounts: { total: 1 } }, trae: { accounts: { total: 1 } } } } }
    if (payload.provider === 'trae') throw new Error('boom')
    return { value: { accounts: [{ accountId: 'a', balance: { total: 5 } }] } }
  } }
  const { rows } = await fetchRound({ rpc, catalogue: CATALOGUE, timeoutMs: 1000, now: () => 1 })
  assert.equal(rows.find(r => r.id === 'loomy').state, 'ok')
  assert.equal(rows.find(r => r.id === 'trae').state, 'unavailable')
  assert.match(rows.find(r => r.id === 'trae').reason, /boom/)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/round.test.js`
Expected: FAIL — `Cannot find module '../src/round.js'`

- [ ] **Step 3: Implement `src/round.js`**

`loggedInFromStatuses`：遍历 `Object.entries(statuses ?? {})`，`status?.accounts?.total > 0` 收 id。`fetchRound`：先 `rpc.call('provider.status', { providers: catalogue })` 拿 `value.statuses`；再对**已登录**渠道并发 `credits.balances`，每个包 `AbortController` + `setTimeout(timeoutMs)`（`finally` 清定时器）；成功走 `normalizeRow(channel, reply)`，失败构造 `{ ok:false, error:{ message } }` 交给 `normalizeRow`；最后对未登录渠道用 `{ ok:true, value:{ accounts: [] } }` 得到 `state: 'empty'`。所有 row 补 `loggedIn`。

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/round.test.js`
Expected: PASS（3 个测试）

- [ ] **Step 5: Commit**

```bash
git add src/round.js test/round.test.js
git commit -m "feat(round): discover signed-in channels then read balances"
```

---

### Task 4: 快照构建

**Files:**
- Create: `src/snapshot.js`
- Test: `test/snapshot.test.js`

**Interfaces:**
- Consumes: Task 1 的 `settings` 形状、Task 3 的 `rows` 形状
- Produces: `buildSnapshot({ at, rows, settings, poller, previous }) -> snapshot`，形状见 spec §5.3

- [ ] **Step 1: Write the failing test**

```js
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/snapshot.test.js`
Expected: FAIL — `Cannot find module '../src/snapshot.js'`

- [ ] **Step 3: Implement `src/snapshot.js`**

纯函数，无 I/O。`rows === null` 走保留分支（`previous?.channels ?? []`、`stale: previous !== null`）；否则 `stale: false` 并用新行。`loggedInCount` = 成功分支里 `loggedIn === true` 的数量，失败保留分支沿用 `previous.loggedInCount`。

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/snapshot.test.js`
Expected: PASS（3 个测试）

- [ ] **Step 5: Commit**

```bash
git add src/snapshot.js test/snapshot.test.js
git commit -m "feat(snapshot): pure builder with last-good retention"
```

---

### Task 5: 轮询器

**Files:**
- Create: `src/poller.js`
- Test: `test/poller.test.js`

**Interfaces:**
- Consumes: Task 4 的 `buildSnapshot`
- Produces: `createPoller({ now, setTimer, clearTimer, readSettings, readConnection, fetchRound, catalogue, settings }) -> { watch(), read(), refresh(), reconfigure(settings), stop(), state() }`
  - `watch()` → `{ snapshot, triggered: boolean }`（同步返回，从不阻塞）
  - `refresh(signal)` → `Promise<snapshot>`（单飞：并发调用共享同一个 Promise）
  - `read()` → `snapshot`

- [ ] **Step 1: Write the failing test**

```js
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/poller.test.js`
Expected: FAIL — `Cannot find module '../src/poller.js'`

- [ ] **Step 3: Implement `src/poller.js`**

状态机 `stopped | idle | polling | backoff`，全部时间取自注入的 `now()`。`refresh` 用模块内 `inflight` Promise 做单飞。失败时 `delayMs = min(delayMs * 2, 600_000)`，成功复位为 `max(1000 * autoRefreshSec, 1000)`。`autoRefreshSec === 0` 时不装定时器、`watch` 返回 `triggered: false`。`watch()` 更新 `lastWatchAt`；距上次成功轮询超过 `autoRefreshSec` 才触发。`watchTtl = 150_000`：距 `lastWatchAt` 超过该值视为 `stopped`。`reconfigure(settings)` 换设置并重排定时器。`stop()` 清定时器。

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/poller.test.js`
Expected: PASS（5 个测试）

- [ ] **Step 5: Commit**

```bash
git add src/poller.js test/poller.test.js
git commit -m "feat(poller): single-flight polling with backoff and idle stop"
```

---

### Task 6: 路由分发

**Files:**
- Create: `src/routes.js`
- Test: `test/routes.test.js`

**Interfaces:**
- Consumes: Task 5 的 `poller`、Task 1 的 `loadSettings`/`saveSettings`/`sanitizeSettings`
- Produces: `createRoutes({ poller, getSettings, putSettings }) -> async handle({ method, route, body }) -> { status, body }`，其中 `route` 已去掉前缀（`''`、`'/snapshot'`、`'/watch'`、`'/refresh'`、`'/settings'`）

- [ ] **Step 1: Write the failing test**

```js
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/routes.test.js`
Expected: FAIL — `Cannot find module '../src/routes.js'`

- [ ] **Step 3: Implement `src/routes.js`**

按 `route` + `method` 分派，返回 `{ status, body }`；`PUT /settings` 必须先 `sanitizeSettings(body)` 再 `putSettings`，成功后再 `poller.reconfigure(saved)`；未知路由 404、方法不匹配 405。

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/routes.test.js`
Expected: PASS（5 个测试）

- [ ] **Step 5: Commit**

```bash
git add src/routes.js test/routes.test.js
git commit -m "feat(routes): pure HTTP dispatch for snapshot/watch/refresh/settings"
```

---

### Task 7: 宿主装配（`index.js`）

**Files:**
- Modify: `index.js`（整份替换）
- Test: 手动（实机 HTTP）

**Interfaces:**
- Consumes: Task 1–6 的全部导出
- Produces: 运行中的 `/api/our-free-model-balance-zxp/*` 五个接口；删掉旧的 `GET /` 与 `POST /rows`

- [ ] **Step 1: 重写 `index.js`**

保留 `export const name` / `export const inject = ['webServer']`。`apply(ctx)` 内按以下**精确依赖名**装配（Task 5 与 Task 6 的签名以此为准）：

```js
const settingsPath = settingsFile(process.env.DSH_HOME ?? path.join(os.homedir(), '.dsh'))
const readConnection = () => { try { return ctx.get('connection') ?? ctx.connection } catch { return undefined } }
const rpc = makeKernelRpc(readConnection)
let settings = await loadSettings(settingsPath)
const poller = createPoller({
  now: () => Date.now(),
  setTimer: (fn, ms) => setTimeout(fn, ms),
  clearTimer: t => clearTimeout(t),
  readSettings: () => settings,
  readConnection,
  fetchRound: signal => fetchRound({ rpc, catalogue: CHANNELS.map(c => c.id), timeoutMs: 20_000, now: Date.now }),
  catalogue: CHANNELS.map(c => c.id),
  settings,
})
const routes = createRoutes({
  poller,
  getSettings: () => settings,
  putSettings: async next => { settings = next; await saveSettings(settingsPath, next); return next },
})
```

`webServer.register({ kind:'prefix', path: BASE })` 里：读 body → `routes.handle({ method, route, body })` → 按 `status` 写 JSON。`ctx.effect(() => () => poller.stop(), '...')`。失落路径 404 JSON。

- [ ] **Step 2: 语法与套件**

Run: `node --check index.js && node --test`
Expected: `node --check` 退出 0；既有 25 个测试加新增测试全绿

- [ ] **Step 3: 装回并实机验证五个接口**

Run: `plugin_manager remove_bundle dsh-our-free-model-balance-zxp` → `install_bundle <同目录>`，然后对 `<GUI 端口>` 依次请求：
- `GET /api/our-free-model-balance-zxp/snapshot` → 200，`channels` 长度 10
- `POST /api/our-free-model-balance-zxp/refresh` → 200 且 `at` 变大
- `GET /api/our-free-model-balance-zxp/settings` → 200，含 `autoRefreshSec: 60`
- `PUT .../settings` body `{"autoRefreshSec":15}` → 200 且回读为 15
- `GET /api/our-free-model-balance-zxp`（旧路径） → 404

Expected: 全部符合

- [ ] **Step 4: Commit**

```bash
git add index.js
git commit -m "feat(host): wire poller, settings and routes into the web server"
```

---

### Task 8: 客户端读快照

**Files:**
- Modify: `client.js`
- Test: 手动（实机目视 + 结构性检查）

**Interfaces:**
- Consumes: Task 7 的五个接口
- Produces: 图标与面板完全由快照驱动；不再持有 `channel-pack` RPC 调用

- [ ] **Step 1: 删掉 RPC 路径、改成读快照**

移除 `loadRows` 里对 `channel-pack` 的 `Promise.all` 与 `POST /rows`；改为：挂载时 `POST /watch` 取 `{ snapshot, triggered }`；`snapshot.poller.state === 'polling'` 时每 2 秒 `GET /snapshot` 直到不是；心跳按 `min(60, settings.autoRefreshSec)`（0 时 60 秒）再 `POST /watch`；页面隐藏时停心跳、可见时恢复并立即 `POST /watch`。`↻` 改调 `POST /refresh`（期间显示旋转）。

- [ ] **Step 2: 按设置渲染**

面板行：跳过 `loggedIn === false` 除非 `settings.showSignedOut`；跳过 `hiddenChannels` 中的 id；`showTimestamp` 控制时间戳；`showUnits` 控制单位后缀；`showSpine` 控制脊线与彩色数字；`showFooter` 控制页脚；`redWhenSpent === false` 时"用尽"退化为灰字（图标与面板一致）；`chipStyle === 'dot'` 时图标只渲染色点不渲染数字。`stale === true` 时时间戳降到 50% 不透明并在面板顶部加一行原因。

- [ ] **Step 3: 结构性验证**

Run: `node --check client.js`；再 `Select-String client.js -Pattern 'channel-pack|readConnection'` 期望 **0 命中**；`Select-String client.js -Pattern 'setInterval|setTimeout'` 期望只出现在心跳/重读这两处。
Expected: 语法通过；RPC 与 `readConnection` 已彻底移除；定时器只有计划内的两处

- [ ] **Step 4: 实机目视**

刷新页面后确认：图标数字与面板一致；点 ↻ 有旋转并在完成后更新；切模型图标跟着变；把设置改成「关闭自动刷新」（Task 9 完成后）后数字不再自己变。

- [ ] **Step 5: Commit**

```bash
git add client.js
git commit -m "feat(client): render from host snapshot instead of calling RPC"
```

---

### Task 9: 设置页

**Files:**
- Modify: `client.js`（新增一个组件与 `settings.section` 注册）
- Test: 手动（实机目视）

**Interfaces:**
- Consumes: Task 7 的 `GET/PUT /settings`
- Produces: `settings.section` 上的新条目 `id: 'our-free-model-balance'`、`order: 36`、`label: '渠道余额'`

- [ ] **Step 1: 实现设置页组件**

挂载时 `GET /settings` 取全量与默认值；六项显示开关 + 自动刷新下拉（关闭/30/60/300/自定义 15–3600）+ 逐渠道隐藏（仅已登录）+ `showSignedOut` 总开关 + 「恢复默认」+ 「立即刷新」与上次更新时间、轮询器状态。**改动即 `PUT /settings`**；失败在页内显示原因（不静默）。

- [ ] **Step 2: 注册进 `settings.section`**

`ctx.slots.inject('settings.section', () => ctx.slots.register({ name:'settings.section', id:'our-free-model-balance', order:36, label:'渠道余额' }, SettingsPage))`。文案全部走 locale 字典。

- [ ] **Step 3: 实机验证**

Run: `node --check client.js`；重装；打开 设置 → 渠道余额（应位于 OFM 的「Our Free Model」区块之后一条）
Expected: 改任一项后当前标签页的图标立刻反映；第二个标签页 ≤60 秒跟上；`GET /settings` 回读与界面一致

- [ ] **Step 4: Commit**

```bash
git add client.js
git commit -m "feat(client): dedicated settings page for refresh interval and display"
```

---

### Task 10: 版本、文档与收尾

**Files:**
- Modify: `package.json`（`version` → `1.1.0`）
- Modify: `docs/superpowers/specs/2026-10-27-host-polling-and-settings-design.md`（状态改为"已实现"）
- Test: 全套

**Interfaces:**
- Consumes: 前九个任务
- Produces: 可提交的 v1.1.0

- [ ] **Step 1: 版本与状态**

`package.json` 版本 `1.1.0`；设计文档顶部状态加一行「已实现（v1.1.0）」。

- [ ] **Step 2: 全套验证**

Run: `node --check index.js && node --check client.js && node --test`
Expected: 全绿；把实际通过的测试数写进提交信息

- [ ] **Step 3: 按 §8 逐条过验收**

spec §8 的九条逐条核对，**客户端那几条只能靠目视**——在提交信息里如实写"客户端项为人工验证"，不宣称自动化覆盖。

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore: release v1.1.0 with host polling and settings page"
```
