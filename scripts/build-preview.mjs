/**
 * Build a standalone preview of the balance panel.
 *
 * The point is to review the design without installing anything, and to review
 * it in both themes at once with states that are awkward to reproduce live
 * (a signed-out channel, a used-up one, a failed query). The CSS and the copy
 * are extracted from `client.js` rather than copied, so the preview cannot
 * drift away from what ships.
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
      if (depth === 0) {
        return new Function(`return ${text.slice(open, index + 1)}`)()
      }
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

/** Representative rows: the numbers are the ones actually observed on this machine. */
const ROWS = [
  { id: 'lobsterai', name: 'LobsterAI', accent: '#FF6A00', state: 'empty' },
  { id: 'qoder', name: 'Qoder', accent: '#615CED', state: 'empty' },
  { id: 'qodercn', name: 'Qoder 中国版', accent: '#7A6CF0', state: 'empty' },
  { id: 'trae', name: 'TRAE', accent: '#00BFA6', state: 'ok', amount: '356.3', unitShort: '积分', value: 356.2848 },
  { id: 'cline', name: 'Cline', accent: '#5B5BD6', state: 'ok', amount: '0', unitShort: 'USD', value: 0 },
  { id: 'loomy', name: 'Loomy', accent: '#2F6BFF', state: 'ok', amount: '491', unitShort: '积分', value: 491 },
  { id: 'raccoon', name: 'Raccoon', accent: '#00A6A6', state: 'ok', amount: '1839', unitShort: '积分', value: 1839 },
  { id: 'minimax', name: 'MiniMax Code', accent: '#E4007F', state: 'ok', amount: '1056.7', unitShort: '积分', value: 1056.73 },
  { id: 'zcode', name: 'ZCode', accent: '#3B6EF6', state: 'ok', amount: '8000000', unitShort: 'Token', value: 8000000 },
  { id: 'gemini', name: 'Gemini', accent: '#4285F4', state: 'unavailable', reason: '当前界面不提供渠道连接' },
]
const CURRENT = 'loomy'

function rowFigure(row) {
  if (row.state === 'ok') {
    if (row.value === 0) return { text: t('state.spent'), quiet: true }
    return { text: `${row.amount}${row.partial ? '+?' : ''}`, quiet: false }
  }
  if (row.state === 'empty') return { text: t('state.empty'), quiet: true }
  if (row.state === 'unknown') return { text: t('state.unknown'), quiet: true }
  return { text: t('state.failed'), quiet: true }
}

function rowSentence(row) {
  const base = { name: row.name, unit: row.unitShort ?? '', amount: row.amount ?? '' }
  if (row.state === 'ok') return row.value === 0 ? t('row.spent', base) : t('row.ok', base)
  if (row.state === 'empty') return t('row.empty', base)
  if (row.state === 'unknown') return t('row.unknown', { ...base, reason: row.reason ? `（${row.reason}）` : '' })
  return t('row.failed', { ...base, reason: row.reason || t('state.failed') })
}

function panel(rows, current) {
  // Mirrors summaryText in client.js: a real zero is signed in but empty, so it
  // does not count as "has a balance".
  const funded = rows.filter(row => row.state === 'ok' && row.value !== 0).length
  const summary = funded > 0 ? t('foot.some', { count: funded }) : t('foot.signedOut')
  const body = rows.map(row => {
    const figure = rowFigure(row)
    const unit = row.state === 'ok' && row.value !== 0 ? row.unitShort : ''
    return `        <div class="ofm-balance-row" data-current="${row.id === current}" style="--ofm-row-mark: ${row.accent}" title="${rowSentence(row)}">
          <span class="ofm-balance-spine" data-on="${row.id === current}"></span>
          <span class="ofm-balance-name">${row.name}</span>
          ${unit === '' ? '' : `<span class="ofm-balance-unit">${unit}</span>`}
          <span class="${figure.quiet ? 'ofm-balance-quiet' : 'ofm-balance-figure'}">${figure.text}</span>
        </div>`
  }).join('\n')

  return `  <div class="ofm-balance-panel" role="dialog" aria-label="${t('panel.title')}">
    <div class="ofm-balance-head">
      <span class="ofm-balance-title">${t('panel.title')}</span>
      <span class="ofm-balance-stamp" title="${t('panel.stamp', { time: '14:31' })}">14:31</span>
      <button type="button" class="ofm-balance-refresh" title="${t('panel.refresh')}">↻</button>
    </div>
    <div class="ofm-balance-list">
${body}
    </div>
    <div class="ofm-balance-foot">${summary}</div>
  </div>`
}

function chip(row) {
  const figure = row.state === 'ok' && row.value !== 0 ? row.amount : rowFigure(row).text
  const unit = row.state === 'ok' && row.value !== 0 ? `<span class="ofm-balance-chip-unit">${row.unitShort}</span>` : ''
  return `  <span class="ofm-balance-wrap">
    <button type="button" class="ofm-balance-chip" style="--ofm-mark: ${row.accent}" title="${rowSentence(row)}">
      <span class="ofm-balance-mark"></span>
      <span class="ofm-balance-chip-figure">${figure}</span>
      ${unit}
    </button>
${panel(ROWS, row.id)}
  </span>`
}

const loomy = ROWS.find(row => row.id === 'loomy')

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
  p.lede { margin: 0 0 28px; font-size: 12.5px; color: #5c626b; max-width: 62ch; }
  .grid { display: flex; gap: 40px; flex-wrap: wrap; align-items: flex-start; }
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
  .note { margin-top: 28px; font-size: 12px; color: #5c626b; max-width: 62ch; }
  .note code { font-size: 11.5px; background: rgba(128,132,140,.14); padding: 1px 4px; border-radius: 4px; }
</style>
<style>
${CSS}
</style>
</head>
<body>
<h1>渠道余额 —— 界面预览</h1>
<p class="lede">这一页的样式与文案是从 <code>client.js</code> 抽出来的同一份，不是复制品；数字取自本机真实观测值。列出的状态里「未登录」「已用尽」「查询失败」在真机上不容易同时凑齐，所以放在这里一起看。</p>
<div class="grid">
  <div class="stage light">
    <h2>浅色主题</h2>
${chip(loomy)}
  </div>
  <div class="stage dark">
    <h2>深色主题</h2>
${chip(loomy)}
  </div>
</div>
<p class="note">设计要点：名称左对齐、数字右对齐并使用等宽数字（tabular-nums），所以同一列的数字可以纵向比大小；最左侧 3px 的「脊线」只有当前模型所属的渠道才亮起，它是整块界面唯一响亮的地方，芯片上的小方块与之同色呼应。</p>
</body>
</html>
`

const out = path.join(root, 'preview.html')
fs.writeFileSync(out, html)
console.log(`wrote ${out} (${html.length} bytes)`)
