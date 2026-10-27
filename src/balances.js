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
    partial: false,
    reason: '',
  }
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
    if (typeof account?.balance === 'number' && Number.isFinite(account.balance)) {
      values.push(account.balance)
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
  row.value = Math.min(...values)
  row.partial = partial
  row.reason = reason
  return row
}

/** The value the chip shows: the smallest known figure, flagged if any account was unreadable. */
export function aggregateValue(rows) {
  const values = []
  let partial = false
  for (const row of Array.isArray(rows) ? rows : []) {
    if (typeof row?.value === 'number' && Number.isFinite(row.value)) values.push(row.value)
    if (row?.partial === true) partial = true
  }
  return { value: values.length === 0 ? null : Math.min(...values), partial }
}
