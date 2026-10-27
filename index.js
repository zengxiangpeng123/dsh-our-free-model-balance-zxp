/**
 * Host half: answer "which channel is this session on, and what are the
 * channels" plus "turn this raw balance data into rows".
 *
 * Everything decidable lives here, not in the browser half: the channel table,
 * the session lookup and the balance normalization. The browser half cannot be
 * unit-tested in this deployment (it is delivered through the page's module
 * loader, not imported by Node), so it is kept to fetching and drawing.
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { CHANNELS, unitLabel } from './src/channels.js'
import { normalizeRow } from './src/balances.js'
import { readSessionSelection } from './src/session-model.js'

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

/** `ctx.get` is the optional-access form; a shell without it must not throw. */
function optionalService(ctx, key) {
  try {
    const viaGet = typeof ctx.get === 'function' ? ctx.get(key) : undefined
    if (viaGet !== undefined && viaGet !== null) return viaGet
  } catch { /* fall through */ }
  try {
    return ctx[key] ?? null
  } catch {
    return null
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
        const sessionId = url.searchParams.get('sessionId') ?? ''
        json(res, 200, {
          current: readSessionSelection(optionalService(ctx, 'agents'), sessionId),
          channels: publicChannels,
        })
        return
      }

      if (req.method === 'POST' && route === '/rows') {
        const payload = await readJson(req)
        const raw = payload && typeof payload.raw === 'object' && payload.raw !== null ? payload.raw : {}
        // TEMPORARY DIAGNOSTIC: the balance queries come back empty and the
        // reason only exists inside this reply, which the browser half would
        // otherwise be the only place to see. Dropped on disk so it can be
        // read back without asking anyone to transcribe a screen. Remove once
        // the empty-balance cause is understood.
        try {
          fs.writeFileSync(path.join(os.tmpdir(), 'ofm-balance-raw.json'), JSON.stringify({ at: Date.now(), raw }, null, 2))
        } catch { /* diagnostics must never break the request */ }
        const rows = CHANNELS.map(channel => normalizeRow(channel.id, raw[channel.id]))
        json(res, 200, { rows })
        return
      }

      json(res, 404, { error: 'not found' })
    },
  }), 'ofm-balance: channel, model and row routes')
}
