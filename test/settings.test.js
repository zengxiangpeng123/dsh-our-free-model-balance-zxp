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

test('负数与小数是手误，夹到最小值而不是当成"关闭"', () => {
  assert.equal(sanitizeSettings({ autoRefreshSec: -1 }).autoRefreshSec, 15)
  assert.equal(sanitizeSettings({ autoRefreshSec: 0.5 }).autoRefreshSec, 15)
  assert.equal(sanitizeSettings({ autoRefreshSec: 0 }).autoRefreshSec, 0, '显式的 0 仍然是关闭')
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
