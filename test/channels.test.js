import { test } from 'node:test'
import assert from 'node:assert/strict'
import { CHANNELS, channelFor, unitLabel } from '../src/channels.js'

test('渠道表恰好 10 项且 id 逐字正确', () => {
  assert.equal(CHANNELS.length, 10)
  assert.deepEqual(CHANNELS.map(c => c.id), [
    'lobsterai', 'qoder', 'qodercn', 'trae', 'cline', 'loomy', 'raccoon', 'minimax', 'zcode', 'gemini',
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
