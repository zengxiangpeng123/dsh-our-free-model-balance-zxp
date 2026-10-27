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
