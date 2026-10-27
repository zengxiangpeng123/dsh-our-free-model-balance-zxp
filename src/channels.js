/**
 * The ten account channels dsh-our-free-model offers, and their credit units.
 *
 * The ids, names and orgs are copied verbatim from OFM's own channel grid
 * (`CHANNEL_PROVIDERS` in its client.js) so both surfaces name a channel the
 * same way. The units come from its `CHANNEL_CREDITS` table: only Cline bills
 * in dollars, ZCode in tokens and Gemini in quota; everything else reports
 * credits.
 *
 * This table is deliberately a copy. OFM publishes no channel-enumeration RPC
 * (its `provider.status` needs the caller to pass ids), so a copy is the only
 * way to reach it — which means an upstream channel change makes this table
 * stale silently. `normalizeRow` covers that: an id it does not know is
 * reported as unknown rather than guessed at.
 */

/** @typedef {'credits'|'tokens'|'dollars'|'quota'} CreditUnit */
/** @typedef {{ id: string, name: string, org: string, unit: CreditUnit }} Channel */

/** @type {ReadonlyArray<Channel>} */
export const CHANNELS = Object.freeze([
  { id: 'lobsterai', name: 'LobsterAI', org: '有道', unit: 'credits' },
  { id: 'qoder', name: 'Qoder', org: '阿里系', unit: 'credits' },
  { id: 'qodercn', name: 'Qoder 中国版', org: '阿里系', unit: 'credits' },
  { id: 'trae', name: 'TRAE', org: '字节', unit: 'credits' },
  { id: 'cline', name: 'Cline', org: 'Cline', unit: 'dollars' },
  { id: 'loomy', name: 'Loomy', org: '讯飞', unit: 'credits' },
  { id: 'raccoon', name: 'Raccoon', org: '商汤', unit: 'credits' },
  { id: 'minimax', name: 'MiniMax Code', org: 'MiniMax', unit: 'credits' },
  { id: 'zcode', name: 'ZCode', org: '智谱', unit: 'tokens' },
  { id: 'gemini', name: 'Gemini', org: 'Google Code Assist', unit: 'quota' },
])

/** The channel a model provider id belongs to, or undefined for a non-channel provider. */
export function channelFor(providerId) {
  return CHANNELS.find(channel => channel.id === providerId)
}

/** The localized label for a unit, spelled exactly as OFM's own panel spells it. */
export function unitLabel(unit) {
  if (unit === 'tokens') return '剩余 Token'
  if (unit === 'dollars') return '剩余余额（USD）'
  if (unit === 'quota') return '剩余配额'
  return '剩余积分'
}
