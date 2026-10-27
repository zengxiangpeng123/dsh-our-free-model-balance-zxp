/**
 * Host half: publish the channel table and turn raw balance replies into rows.
 *
 * Everything decidable lives here, not in the browser half: the channel table
 * and the balance normalization are pure and unit-tested. The browser half
 * cannot be tested in this deployment (the page's module loader delivers it,
 * so Node never imports it), so it is kept to fetching and drawing.
 *
 * The session's *current* model is deliberately not served here. It is not
 * `agent.options` (captured at agent creation, stale after a model switch) and
 * it is not `agentDefaultModel` (the default for new sessions). The composer's
 * own seat reads it from the `modelSelection` projection, and the browser half
 * reads that same projection — one source of truth, already reactive.
 */
import { CHANNELS, unitLabel } from './src/channels.js'
import { normalizeRow } from './src/balances.js'

export const name = 'dsh-ofm-balance'
export const inject = ['webServer']

const BASE = '/api/ofm-balance'

function json(res, status, body) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' })
  res.end(JSON.stringify(body))
}

async function readJson(req) {
  const chunks = []
  for await (const chunk of req) chunks.push(chunk)
  const text = Buffer.concat(chunks).toString('utf8')
  if (text === '') return {}
  try {
    return JSON.parse(text)
  } catch {
    return {}
  }
}

export function apply(ctx) {
  const publicChannels = CHANNELS.map(channel => ({ ...channel, unitLabel: unitLabel(channel.unit) }))

  ctx.effect(() => ctx.webServer.register({
    kind: 'prefix',
    path: BASE,
    handler: async (req, res) => {
      const url = new URL(req.url ?? '/', 'http://localhost')
      const route = url.pathname.replace(/^\/api\/ofm-balance/, '').replace(/\/+$/, '')

      if (req.method === 'GET' && route === '') {
        json(res, 200, { channels: publicChannels })
        return
      }

      if (req.method === 'POST' && route === '/rows') {
        const payload = await readJson(req)
        const raw = payload && typeof payload.raw === 'object' && payload.raw !== null ? payload.raw : {}
        const rows = CHANNELS.map(channel => normalizeRow(channel.id, raw[channel.id]))
        json(res, 200, { rows })
        return
      }

      json(res, 404, { error: 'not found' })
    },
  }), 'ofm-balance: channel table and row routes')
}
