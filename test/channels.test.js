import { test } from 'node:test'
import assert from 'node:assert/strict'
import { CHANNELS, channelFor, unitLabel, unitShort } from '../src/channels.js'

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

// ── 界面重设计所需的两项数据 ────────────────────────────────────────────────

test('每个渠道都有厂商品牌色，取自 OFM 自己的渠道表', () => {
  for (const channel of CHANNELS) {
    assert.match(channel.accent, /^#[0-9A-F]{6}$/i, `${channel.id} 缺少合法 accent`)
  }
  assert.equal(channelFor('loomy').accent, '#2F6BFF')
  assert.equal(channelFor('trae').accent, '#00BFA6')
  assert.equal(channelFor('zcode').accent, '#3B6EF6')
})

test('单位短词用于行内后缀（长标签留给悬停说明）', () => {
  assert.equal(unitShort('credits'), '积分')
  assert.equal(unitShort('tokens'), 'Token')
  assert.equal(unitShort('dollars'), 'USD')
  assert.equal(unitShort('quota'), '配额')
})
