/**
 * Turn one channel's `credits.balances` reply into a row the panel renders.
 *
 * The envelope is the pack's own shape: `{ ok: true, value: { accounts: [...] } }`
 * on success, `{ ok: false, error: { code, message } }` on refusal. Each account
 * row is `{ accountId, nickname, balance: number|null, error?: string }`.
 *
 * The one distinction that matters: `balance === 0` means the quota is used up,
 * while `balance === null` means it could not be read. OFM's own source calls
 * this out — showing 0 for an unreadable account would tell the user they have
 * nothing when the truth is that we do not know.
 */
import { channelFor, unitLabel } from './channels.js'

/** @typedef {'ok'|'empty'|'unknown'|'unavailable'} RowState */

function blank(id, name, unit) {
  return {
    id,
    name,
    unit,
    unitLabel: unitLabel(unit),
    state: /** @type {RowState} */ ('unavailable'),
    value: null,
    amount: '',
    partial: false,
    reason: '',
  }
}

/**
 * The number to show for one account, or null when the reply carries none.
 *
 * The pack answers in two shapes: a bare number, and a structured
 * `{ total, packages, expiredTotal }` — the latter is what every logged-in
 * channel actually returns (Loomy, TRAE, Raccoon, MiniMax, ZCode). OFM's own
 * panel reads `balance.total`, so this does too. Reading only the numeric shape
 * is what made every signed-in channel report "no balance returned".
 */
function balanceTotal(balance) {
  if (typeof balance === 'number' && Number.isFinite(balance)) return balance
  if (balance !== null && typeof balance === 'object' && Number.isFinite(balance.total)) return balance.total
  return null
}

/**
 * @param {string} channelId
 * @param {{ ok?: boolean, value?: { accounts?: any[] }, error?: { message?: string } }} envelope
 */
export function normalizeRow(channelId, envelope) {
  const channel = channelFor(channelId)
  if (channel === undefined) {
    // A channel this build does not know: report the absence, never a number.
    return { ...blank(channelId, channelId, 'credits'), reason: '未知渠道' }
  }

  const row = blank(channel.id, channel.name, channel.unit)

  if (!envelope || envelope.ok !== true) {
    row.reason = envelope?.error?.message ?? '查询失败'
    return row
  }

  const accounts = Array.isArray(envelope.value?.accounts) ? envelope.value.accounts : []
  if (accounts.length === 0) {
    row.state = 'empty'
    return row
  }

  const values = []
  let partial = false
  let reason = ''
  for (const account of accounts) {
    const value = balanceTotal(account?.balance)
    if (value !== null) {
      values.push(value)
      continue
    }
    partial = true
    if (reason === '' && typeof account?.error === 'string' && account.error !== '') reason = account.error
  }

  if (values.length === 0) {
    row.state = 'unknown'
    row.reason = reason
    return row
  }

  row.state = 'ok'
  // `value` stays exact: the "used up" decision is `value === 0`, and a
  // rounded value would turn a real 0.04 into 0 and report a false "used up".
  // `amount` is the display form only.
  const exact = Math.min(...values)
  row.value = exact
  row.amount = formatAmount(exact)
  row.partial = partial
  row.reason = reason
  return row
}

/**
 * The display form of a balance: one decimal place, and no decimal point at
 * all for whole numbers. The chip and each panel row are narrow, so a raw
 * 356.2848 becomes "356.3" while 573 stays "573".
 */
function formatAmount(value) {
  if (!Number.isFinite(value)) return ''
  const rounded = Math.round(value * 10) / 10
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1)
}
