import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseJsonObject } from '../src/body.js'

test('空 body 视为"没有字段"，是合法的', () => {
  assert.deepEqual(parseJsonObject(''), { ok: true, value: {} })
  assert.deepEqual(parseJsonObject('   '), { ok: true, value: {} })
})

test('合法对象原样返回', () => {
  assert.deepEqual(parseJsonObject('{"a":1}'), { ok: true, value: { a: 1 } })
})

test('坏 JSON 必须被拒绝，不能退化成空对象', () => {
  const out = parseJsonObject('{ not json')
  assert.equal(out.ok, false)
  assert.match(out.error, /JSON/)
})

test('数组与标量不是对象，必须被拒绝（否则会被当成"全部默认"写回）', () => {
  assert.equal(parseJsonObject('[1,2]').ok, false)
  assert.equal(parseJsonObject('"text"').ok, false)
  assert.equal(parseJsonObject('null').ok, false)
  assert.equal(parseJsonObject('42').ok, false)
})