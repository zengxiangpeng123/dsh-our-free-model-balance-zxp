# OFM 余额小图标 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 DSH 输入框工具行最左端加一个常驻小图标，点击展开面板显示 dsh-our-free-model 各渠道余额；不点击时不发任何请求。

**Architecture:** 插件分两半。**宿主半**持有渠道表、会话模型读取、余额归一化——全部是纯函数，用 `node --test` 单测；它通过自己的同源路由 `/api/ofm-balance` 提供数据。**客户端半**只做三件事：读路由、调 `channel-pack` RPC 取原始余额、把结果 POST 回宿主换回可渲染的行。渠道 RPC 只有客户端够得到（OFM 自己的渠道页走同一条路），所以归一化必须由宿主承担。

**Tech Stack:** Node ESM（宿主）、`node:test`（测试）、Cordis slot 注册（Web 客户端）、React 由页面模块表提供。

**Spec:** `docs/superpowers/specs/2026-10-27-ofm-balance-chip-design.md`

## Global Constraints

- 插件目录：`C:\Users\15173\.dsh\local-bundles\dsh-ofm-balance`（**不在工作区**）
- 渠道表固定 10 项，id 必须逐字为：`lobsterai` `qoder` `qodercn` `trae` `cline` `loomy` `raccoon` `minimax` `zcode` `gemini`
- 单位标签逐字取自 OFM：`剩余积分` / `剩余 Token` / `剩余余额（USD）` / `剩余配额`；仅 `cline`=dollars、`zcode`=tokens、`gemini`=quota，其余为积分
- `balance === 0` 是「已用光」，**不是**「查不到」；`balance === null` 才是查不到，且此时必带 `error`
- 挂载槽位：`conversation.input.left`，注册对象 `{ name, id, order }`；**不覆盖**任何原生控件
- **余额**查询只在点击时发生（硬要求）。挂载时允许**一次**轻量 GET 用于判断显隐（取渠道表 + 当前模型，不取余额）；此外不得有任何请求或定时器
- 渠道 RPC 调用形式：`ctx.connection.rpc.call('/api', 'channel-pack', { method, payload }, signal)`，返回信封 `{ok:true,value}` 或 `{ok:false,error:{code,message}}`
- 会话模型来源：`ctx.agents.store`（`Map<sessionId, {agent:{options:{provider,model}}}>`）；**不要**用 `agentDefaultModel.currentSelection()`（那是全局默认，实测为 `newapi/agnes-2.5-flash`，会误判）
- 客户端模块格式：`window.__ModuleLoader__.load({ id, factory(require) {...} })`，factory 内 `return { inject: [...], apply(ctx) {...} }`
- 所有可见文案走 locale 文件，不在组件里硬编码中文

## Review Focus

实现完成后，最可能伤到人的五类输入/故障，按可能性排序：

1. **`connection` 服务缺失** —— 客户端拿不到 `connection` 时（不同 shell 可能没有）。期望：面板显示「渠道不可用」，**不是**空白、不是抛错、不是整块 composer 崩掉。
2. **某渠道一个账号都没登录** —— `accounts` 为空数组。期望：该行显示 `未登录`，不是 `0`，不是 `—`。
3. **全部账号都查不到** —— 全 `balance:null` 带 `error`。期望：折叠图标标未知，不是显示 `0` 或隐藏。
4. **余额恰好为 0** —— 已用光。期望：显示 `已用尽`（与"查不到"区分），图标不标未知。
5. **新会话（无 agent）** —— `agents.store` 里没有该 sessionId。期望：图标不出现，且不报错。

---

### Task 1: 渠道表与单位标签

**Files:**
- Create: `src/channels.js`
- Test: `test/channels.test.js`

**Interfaces:**
- Consumes: 无
- Produces: `CHANNELS: Array<{id,name,org,unit:'credits'|'tokens'|'dollars'|'quota'}>`（10 项）；`channelFor(providerId: string): Channel | undefined`；`unitLabel(unit: string): string`

- [ ] **Step 1: Write the failing test**

```js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { CHANNELS, channelFor, unitLabel } from '../src/channels.js'

test('渠道表恰好 10 项且 id 逐字正确', () => {
  assert.equal(CHANNELS.length, 10)
  assert.deepEqual(CHANNELS.map(c => c.id), [
    'lobsterai','qoder','qodercn','trae','cline','loomy','raccoon','minimax','zcode','gemini',
  ])
})

test('单位只有三个例外', () => {
  assert.equal(channelFor('cline').unit, 'dollars')
  assert.equal(channelFor('zcode').unit, 'tokens')
  assert.equal(channelFor('gemini').unit, 'quota')
  assert.equal(channelFor('loomy').unit, 'credits')
})

test('非渠道 provider 返回 undefined', () => {
  assert.equal(channelFor('newapi'), undefined)
  assert.equal(channelFor('our-free-model'), undefined)
})

test('单位标签与 OFM 面板逐字一致', () => {
  assert.equal(unitLabel('credits'), '剩余积分')
  assert.equal(unitLabel('tokens'), '剩余 Token')
  assert.equal(unitLabel('dollars'), '剩余余额（USD）')
  assert.equal(unitLabel('quota'), '剩余配额')
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/channels.test.js`
Expected: FAIL — `Cannot find module '../src/channels.js'`

- [ ] **Step 3: Implement `src/channels.js`**

导出 `CHANNELS`（id/name/org 从 spec §5 与 OFM 的 `CHANNEL_PROVIDERS` 逐字取；`unit` 按 Global Constraints），`channelFor` 用 `CHANNELS.find(c => c.id === providerId)`，`unitLabel` 用四分支查表。

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/channels.test.js`
Expected: PASS（4 个测试）

- [ ] **Step 5: Commit**

```bash
git add src/channels.js test/channels.test.js
git commit -m "feat: OFM channel table with unit labels"
```

---

### Task 2: 余额归一化

**Files:**
- Create: `src/balances.js`
- Test: `test/balances.test.js`

**Interfaces:**
- Consumes: `channelFor`, `unitLabel` (Task 1)
- Produces: `normalizeRow(channelId: string, envelope: object): { id, name, unit, unitLabel, state: 'ok'|'empty'|'unknown'|'unavailable', value: number|null, partial: boolean, reason: string }`；`aggregateValue(rows): { value: number|null, partial: boolean }`

- [ ] **Step 1: Write the failing test**

```js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { normalizeRow, aggregateValue } from '../src/balances.js'

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

test('有账号查不到时聚合值标 partial', () => {
  assert.deepEqual(aggregateValue([{ value: 5, partial: false }]), { value: 5, partial: false })
  assert.deepEqual(aggregateValue([{ value: 5, partial: true }]), { value: 5, partial: true })
  assert.deepEqual(aggregateValue([{ value: null, partial: false }]), { value: null, partial: false })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/balances.test.js`
Expected: FAIL — `Cannot find module '../src/balances.js'`

- [ ] **Step 3: Implement `src/balances.js`**

`normalizeRow`：信封 `ok !== true` → `unavailable`（`reason` 取 `error.message`）；`accounts` 为空 → `empty`；有数取最小值、`partial` = 存在 `balance === null`、`reason` 取第一个非空 `error`；全为 null → `unknown`。`aggregateValue`：忽略 `null` 取最小；只要有一行 `partial` 就 `partial`。

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/balances.test.js`
Expected: PASS（7 个测试）

- [ ] **Step 5: Commit**

```bash
git add src/balances.js test/balances.test.js
git commit -m "feat: normalize OFM credit balances into display rows"
```

---

### Task 3: 会话模型读取

**Files:**
- Create: `src/session-model.js`
- Test: `test/session-model.test.js`

**Interfaces:**
- Consumes: `channelFor` (Task 1)
- Produces: `readSessionSelection(agentsService, sessionId: string): { provider, model, channelId: string|null } | null`

- [ ] **Step 1: Write the failing test**

```js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readSessionSelection } from '../src/session-model.js'

const fake = entries => ({ store: new Map(entries) })

test('读到会话级 provider/model，并映射到渠道', () => {
  const agents = fake([['s1', { agent: { options: { provider: 'loomy', model: 'DeepSeek-V4.1-Flash' } } }]])
  assert.deepEqual(readSessionSelection(agents, 's1'), {
    provider: 'loomy', model: 'DeepSeek-V4.1-Flash', channelId: 'loomy',
  })
})

test('provider 不是渠道时 channelId 为 null', () => {
  const agents = fake([['s1', { agent: { options: { provider: 'newapi', model: 'agnes-2.5-flash' } } }]])
  assert.equal(readSessionSelection(agents, 's1').channelId, null)
})

test('新会话没有 agent → null', () => {
  assert.equal(readSessionSelection(fake([]), 's1'), null)
})

test('服务缺失 → null，不抛', () => {
  assert.equal(readSessionSelection(null, 's1'), null)
  assert.equal(readSessionSelection({}, 's1'), null)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/session-model.test.js`
Expected: FAIL — `Cannot find module '../src/session-model.js'`

- [ ] **Step 3: Implement `src/session-model.js`**

从 `agentsService.store` 取 `sessionId`；取不到或缺 `agent.options.provider` 返回 `null`；`channelId` = `channelFor(provider) ? provider : null`。全程 try/catch，任何异常返回 `null`。

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/session-model.test.js`
Expected: PASS（4 个测试）

- [ ] **Step 5: Commit**

```bash
git add src/session-model.js test/session-model.test.js
git commit -m "feat: read the session's own model selection"
```

---

### Task 4: 宿主半插件骨架与路由

**Files:**
- Create: `package.json`、`cordis.patch.yml`、`index.js`
- Test: 手动（安装后 GET）

**Interfaces:**
- Consumes: Task 1–3 的全部导出
- Produces: HTTP 路由 `/api/ofm-balance`：
  - `GET ?sessionId=<id>` → `{ current: {provider,model,channelId}|null, channels: [{id,name,org,unit,unitLabel}] }`
  - `POST /rows`，body `{ sessionId, raw: { <channelId>: <rpcEnvelope> } }` → `{ rows: [normalizeRow 结果], aggregate: {value,partial} }`

- [ ] **Step 1: 写清单与补丁**

`package.json`：`name: dsh-ofm-balance`、`private: true`、`type: module`、`exports` 含 `.`/`./client`、`files` 列出实际产物、`dsh.bundle.patch` 指 `./cordis.patch.yml`、`dsh.client` 为 `{ platform:'web', immediately:true, inject:[] }`。
`cordis.patch.yml`：`- insert: - id: ofm-balance` / `name: dsh-ofm-balance`。

- [ ] **Step 2: 实现 `index.js`**

`export const inject = ['webServer']`；`apply(ctx)` 内 `ctx.effect(() => ctx.webServer.register({ kind:'prefix', path:'/api/ofm-balance', handler }))`。handler 按上表分发；`agents` 用 `ctx.get('agents')` 取（**判空**，可能不存在）。

- [ ] **Step 3: 安装并验证路由存在**

Run: `plugin_manager install_bundle C:\Users\15173\.dsh\local-bundles\dsh-ofm-balance`，随后
`Invoke-WebRequest 'http://127.0.0.1:<GUI端口>/api/ofm-balance?sessionId=session-91e8e34f-b067-434d-a1d7-660ab87b794a'`
Expected: 200，JSON 里 `channels` 有 10 项，`current.channelId` 为 `loomy`

> **对照**：不存在的路由在本版本返回 401，存在且无鉴权返回 200 —— 用这个区分"没挂上"和"挂上了"。

- [ ] **Step 4: Commit**

```bash
git add package.json cordis.patch.yml index.js
git commit -m "feat: host half with channel/model route"
```

---

### Task 5: 客户端半 —— 图标

**Files:**
- Create: `client.js`
- Test: 手动（插槽检查 + 目视）

**Interfaces:**
- Consumes: Task 4 的 `GET /api/ofm-balance`
- Produces: 注册进 `conversation.input.left` 的组件，id `ofm-balance`，order `40`

- [ ] **Step 1: 实现 `client.js`**

`window.__ModuleLoader__.load({ id:'dsh-ofm-balance', factory(require){ ... } })`；组件只做：挂载时 GET `/api/ofm-balance?sessionId=...` → `current.channelId === null` 时 `return null`（不渲染），否则渲染 `⛁ —`。整个组件包在错误边界内（参考探针 `dsh-ofm-balance-spike` 的 `Boundary`，逐字复用其做法）。

> 这一次 GET **只取渠道表与当前模型，不取任何余额**，且是"图标该不该出现"的唯一依据——不先问就没法判断显隐。它是本设计里唯一一处非点击请求，已在 Global Constraints 与 spec §11 写明。

- [ ] **Step 2: 安装并确认注册**

Run: `plugin_manager install_bundle`，然后
`cordis_inspect_query client/Slots listSubTree {"root":"conversation.input.left"}`
Expected: `occupants` 里出现 `id: "ofm-balance"`、`active: true`

- [ ] **Step 3: 目视确认显隐**

选中 `loomy/DeepSeek-V4.1-Flash`（当前会话就是）→ 图标出现；切到 `newapi` 的模型 → 图标消失。

- [ ] **Step 4: Commit**

```bash
git add client.js
git commit -m "feat: OFM balance chip in the composer tool row"
```

---

### Task 6: 客户端半 —— 面板与手动刷新

**Files:**
- Modify: `client.js`
- Test: 手动（网络面板 + 目视）

**Interfaces:**
- Consumes: Task 2 的归一化（经 Task 4 的 `POST /rows`）、`channel-pack` RPC
- Produces: 点击图标展开面板；面板行含 `{name, unitLabel, state, value, partial, reason}`

- [ ] **Step 1: 实现点击取数**

点击时：对渠道表每一项调
`ctx.connection.rpc.call('/api','channel-pack',{ method:'credits.balances', payload:{ provider: id } }, signal)`
（`connection` 用 `ctx.get('connection')` 取并判空；缺失则直接置所有行为 `unavailable`，**不抛错**），把信封汇总为 `raw`，`POST /api/ofm-balance/rows`，用返回的 `rows` 渲染。面板行按 spec §9：`已用尽`（value 0）/ `未登录`（empty）/ `未返回余额数据`（unknown）/ `余额查询失败：{reason}`（unavailable）；当前渠道那行高亮。

- [ ] **Step 2: 接上面板内的刷新按钮**

面板右上角 `↻` 重跑 Step 1。**除点击外不得有任何定时器**。

- [ ] **Step 3: 验证"未点击零请求"**

打开浏览器网络面板，清空记录，静置 60 秒不点图标。
Expected: 除图标显隐那一次 GET 外，**没有** `channel-pack` RPC、没有 `/rows` 请求。

- [ ] **Step 4: 验证聚合与异常态**

把某渠道账号退出登录（或断网）后点开面板。
Expected: 该行显示 `未登录` 或 `余额查询失败：…`，其余行正常；图标若显示当前渠道则带 `+?` 标记。

- [ ] **Step 5: Commit**

```bash
git add client.js
git commit -m "feat: balance panel with manual refresh"
```

---

### Task 7: 显示资源与收尾

**Files:**
- Create: `locale/zh.json`、`locale/en.json`、`icon.svg`
- Modify: `client.js`（文案改走 locale）、`package.json`（补 `files`）

**Interfaces:**
- Consumes: 前六个任务
- Produces: 通过 host-plugin 显示清单（标题/描述/图标）

- [ ] **Step 1: 加 locale 与图标**

`zh.json` 含标题「Our Free Model 余额」与描述；`en.json` 同义；`icon.svg` 自绘（不用默认图）。`client.js` 中所有可见文案改从 locale 取。

- [ ] **Step 2: 验证显示元数据**

`cordis_inspect_query host/Config listConfigs {"name":"dsh-ofm-balance"}` 取到 entry 后看 `packageDir`，确认 README/元数据可读；插件页确认标题与图标不是默认。

- [ ] **Step 3: 卸载探针**

Run: `plugin_manager remove_bundle dsh-ofm-balance-spike`
Expected: 输入框上那条虚线探针消失

- [ ] **Step 4: 终验并提交**

按 spec §11 逐条过一遍（槽位注册 / 未点击零请求 / 面板 10 行 / 非渠道模型不显示 / 卸载复原）。

```bash
git add -A
git commit -m "chore: display metadata and final verification"
```
