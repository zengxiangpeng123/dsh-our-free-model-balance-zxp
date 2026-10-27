/**
 * Build a standalone preview of the balance panel.
 *
 * The point is to review the design without installing anything, and to see in
 * both themes at once the states that are awkward to reproduce live (a channel
 * used up, one whose query failed, and a panel with nothing signed in). The
 * stylesheet and the copy are extracted from `client.js` rather than copied, so
 * the preview cannot drift away from what ships. The markup below mirrors the
 * component's render by hand — regenerate this page whenever that render
 * changes.
 *
 * Usage: node scripts/build-preview.mjs
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '..')
const source = fs.readFileSync(path.join(root, 'client.js'), 'utf8')

/** The stylesheet, between its template literal quotes. */
function extractCss(text) {
  const match = text.match(/const CSS = `([\s\S]*?)`;/)
  if (match === null) throw new Error('client.js: could not find the CSS template literal')
  return match[1]
}

/** The dictionary object literal, by brace matching from its opening brace. */
function extractDict(text) {
  const start = text.indexOf('const DICT = ')
  if (start < 0) throw new Error('client.js: could not find DICT')
  const open = text.indexOf('{', start)
  let depth = 0
  for (let index = open; index < text.length; index += 1) {
    const char = text[index]
    if (char === '{') depth += 1
    else if (char === '}') {
      depth -= 1
      if (depth === 0) return new Function(`return ${text.slice(open, index + 1)}`)()
    }
  }
  throw new Error('client.js: DICT braces never balanced')
}

const DICT = extractDict(source).zh
const CSS = extractCss(source)

const t = (key, values) => {
  const template = DICT[key] ?? key
  if (values === undefined) return template
  return template.replace(/\{(\w+)\}/g, (whole, name) => (name in values ? String(values[name]) : whole))
}

/** The numbers are the ones actually observed on this machine. */
const SIGNED_IN = [
  { id: 'trae', name: 'TRAE', accent: '#00BFA6', state: 'ok', amount: '356.3', unitShort: '积分', value: 356.2848 },
  { id: 'cline', name: 'Cline', accent: '#5B5BD6', state: 'ok', amount: '0', unitShort: 'USD', value: 0 },
  { id: 'loomy', name: 'Loomy', accent: '#2F6BFF', state: 'ok', amount: '491', unitShort: '积分', value: 491 },
  { id: 'raccoon', name: 'Raccoon', accent: '#00A6A6', state: 'ok', amount: '1839', unitShort: '积分', value: 1839 },
  { id: 'minimax', name: 'MiniMax Code', accent: '#E4007F', state: 'ok', amount: '1056.7', unitShort: '积分', value: 1056.73 },
  { id: 'zcode', name: 'ZCode', accent: '#3B6EF6', state: 'ok', amount: '8000000', unitShort: 'Token', value: 8000000 },
  { id: 'gemini', name: 'Gemini', accent: '#4285F4', state: 'unknown', reason: '积分查询失败（凭据失效或响应异常）' },
]
const SIGNED_OUT = [
  { id: 'lobsterai', name: 'LobsterAI', accent: '#FF6A00', state: 'empty' },
  { id: 'qoder', name: 'Qoder', accent: '#615CED', state: 'empty' },
  { id: 'qodercn', name: 'Qoder 中国版', accent: '#7A6CF0', state: 'empty' },
]
const ALL_SPENT = SIGNED_IN.filter(row => row.state !== 'unknown').map(row => ({
  ...row, state: 'ok', value: 0, amount: '0',
}))

const isSpent = row => row.state === 'ok' && row.value === 0
const hasFuel = row => row.state === 'ok' && row.value !== 0

function rowSentence(row) {
  const base = { name: row.name, unit: row.unitShort ?? '', amount: row.amount ?? '' }
  if (row.state === 'ok') return row.value === 0 ? t('row.spent', base) : t('row.ok', base)
  if (row.state === 'empty') return t('row.empty', base)
  if (row.state === 'unknown') return t('row.unknown', { ...base, reason: row.reason ? `（${row.reason}）` : '' })
  return t('row.failed', { ...base, reason: row.reason || t('state.failed') })
}

function summaryText(visible) {
  const funded = visible.filter(hasFuel).length
  const spent = visible.filter(isSpent).length
  const failed = visible.length - funded - spent
  const parts = []
  if (funded > 0) parts.push(t('foot.funded', { count: funded }))
  if (spent > 0) parts.push(t('foot.spent', { count: spent }))
  if (failed > 0) parts.push(t('foot.failed', { count: failed }))
  return parts.join(t('foot.join'))
}

function rowHtml(row, current) {
  const spent = isSpent(row)
  const showFigure = hasFuel(row)
  const isCurrent = row.id === current && !spent
  const word = row.state === 'unknown' ? t('state.unknown') : t('state.failed')
  const unit = showFigure ? `<span class="ofm-balance-unit">${row.unitShort}</span>` : ''
  const tail = spent
    ? `<span class="ofm-balance-tag">${t('state.spent')}</span>`
    : (showFigure
      ? `<span class="ofm-balance-figure">${row.amount}</span>`
      : `<span class="ofm-balance-quiet">${word}</span>`)
  return `        <div class="ofm-balance-row" data-current="${isCurrent}" data-spent="${spent}" style="--ofm-row-mark: ${row.accent}" title="${rowSentence(row)}">
          <span class="ofm-balance-spine" data-on="${isCurrent}"></span>
          <span class="ofm-balance-name">${row.name}</span>
          ${unit}
          ${tail}
        </div>`
}

function panel(rows, current) {
  const visible = rows.filter(row => row.state !== 'empty')
  const body = rows.length === 0 || visible.length === 0
    ? `      <div class="ofm-balance-emptywrap">
        <div class="ofm-balance-emptyline">${t('empty.none')}</div>
        <div class="ofm-balance-emptyhint">${t('empty.hint')}</div>
      </div>`
    : `      <div class="ofm-balance-list">
${visible.map(row => rowHtml(row, current)).join('\n')}
      </div>`
  const foot = visible.length === 0 ? '' : `
      <div class="ofm-balance-foot">${summaryText(visible)}</div>`
  return `  <div class="ofm-balance-panel" role="dialog" aria-label="${t('panel.title')}">
      <div class="ofm-balance-head">
        <span class="ofm-balance-title">${t('panel.title')}</span>
        <span class="ofm-balance-stamp" title="${t('panel.stamp', { time: '19:16' })}">19:16</span>
        <button type="button" class="ofm-balance-refresh" title="${t('panel.refresh')}">↻</button>
      </div>
${body}${foot}
  </div>`
}

function chip(rows, current) {
  const row = rows.find(candidate => candidate.id === current)
  const spent = row !== undefined && isSpent(row)
  const figure = row === undefined
    ? '—'
    : spent ? '' : hasFuel(row) ? row.amount : (row.state === 'unknown' ? t('state.unknown') : t('state.failed'))
  const unit = row !== undefined && hasFuel(row) ? `<span class="ofm-balance-chip-unit">${row.unitShort}</span>` : ''
  const mark = spent ? '#D92D33' : (row === undefined ? '#8A8F98' : row.accent)
  const inner = spent
    ? `<span class="ofm-balance-tag">${t('state.spent')}</span>`
    : `<span class="ofm-balance-chip-figure">${figure}</span>${unit}`
  return `  <span class="ofm-balance-wrap">
    <button type="button" class="ofm-balance-chip" data-spent="${spent}" style="--ofm-mark: ${mark}" title="${row === undefined ? '' : rowSentence(row)}">
      <span class="ofm-balance-mark"></span>
      ${inner}
    </button>
${panel(rows, current)}
  </span>`
}

const stages = [
  ['浅色 · 已登录的渠道', 'light', SIGNED_IN, 'loomy'],
  ['深色 · 已登录的渠道', 'dark', SIGNED_IN, 'loomy'],
  ['浅色 · 全部用尽', 'light', ALL_SPENT, 'loomy'],
  ['浅色 · 一个都没登录', 'light', SIGNED_OUT, null],
]

const grid = stages.map(([title, theme, rows, current]) => `  <div class="stage ${theme}">
    <h2>${title}</h2>
${chip(rows, current)}
  </div>`).join('\n')

const html = `<!doctype html>
<html lang="zh">
<head>
<meta charset="utf-8">
<title>渠道余额 · 界面预览</title>
<style>
  :root { color-scheme: light dark; }
  body {
    margin: 0; padding: 40px 32px 56px;
    font: 14px/1.5 -apple-system, "Segoe UI", "Microsoft YaHei", system-ui, sans-serif;
    background: #f2f3f5; color: #1b1d21;
  }
  h1 { font-size: 15px; font-weight: 600; margin: 0 0 4px; }
  p.lede { margin: 0 0 28px; font-size: 12.5px; color: #5c626b; max-width: 64ch; }
  .grid { display: flex; gap: 36px; flex-wrap: wrap; align-items: flex-start; }
  .stage { position: relative; }
  .stage > h2 { font-size: 11px; font-weight: 500; color: #6b7178; margin: 0 0 10px; }
  /* Stand-ins for the host tokens: the panel reads --dsw-alias-*, so giving
     them here exercises exactly the indirection the real shell provides. */
  .light {
    --dsw-alias-bg-layer-1: #ffffff;
    --dsw-alias-label-primary: #1b1d21;
    --dsw-alias-border-l2: rgba(27, 29, 33, .16);
    padding: 16px; border-radius: 14px; background: #ffffff;
    box-shadow: 0 1px 2px rgba(0,0,0,.06);
  }
  .dark {
    --dsw-alias-bg-layer-1: #23262b;
    --dsw-alias-label-primary: #e8eaed;
    --dsw-alias-border-l2: rgba(232, 234, 237, .18);
    padding: 16px; border-radius: 14px; background: #17191c; color: #e8eaed;
  }
  /* The popover floats upward in the real composer; here it just sits. */
  .stage .ofm-balance-panel { position: static; bottom: auto; margin-top: 8px; }
  .note { margin-top: 30px; font-size: 12px; color: #5c626b; max-width: 64ch; line-height: 1.7; }
  .note code { font-size: 11.5px; background: rgba(128,132,140,.14); padding: 1px 4px; border-radius: 4px; }
</style>
<style>
${CSS}
</style>
</head>
<body>
<h1>渠道余额 —— 界面预览</h1>
<p class="lede">样式与文案从 <code>client.js</code> 抽取，不是复制品；数字取自本机真实观测值。四个场景分别是：常规（含一个用尽、一个查询失败）、深色主题、全部用尽、一个都没登录。</p>
<div class="grid">
${grid}
</div>
<p class="note">只有已登录的渠道出现在面板里；未登录的完全不提。用尽的那一行是整块界面唯一饱和的颜色：红底红边加一枚实心红标，标签白字红底所以明暗主题下对比度都成立。数字用等宽字体、15px 加重，沿同一列可以纵向比大小；当前模型所属的渠道用厂商品牌色标出脊线与数字。</p>
</body>
</html>
`

const out = path.join(root, 'preview.html')
fs.writeFileSync(out, html)
console.log(`wrote ${out} (${html.length} bytes)`)
