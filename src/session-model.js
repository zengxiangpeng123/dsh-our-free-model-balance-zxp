/**
 * Read the model a session is actually using.
 *
 * The composer's model seat writes this per session, on the live agent; the
 * host service `agentDefaultModel` holds only the *default* for new sessions
 * and is therefore the wrong source — on this machine it answers
 * `newapi/agnes-2.5-flash` while the session in question runs `loomy`. Reading
 * the default here would hide the chip for a model that plainly has a channel.
 *
 * `agentsService.store` is a `Map<sessionId, { agent: { options: { provider,
 * model } } }>`. Nothing about a missing service, a missing session or a
 * half-built agent is exceptional: all of them mean "no answer", so every path
 * returns null rather than throwing into the composer.
 */
import { channelFor } from './channels.js'

/**
 * @param {unknown} agentsService the host `agents` service, if the shell has one
 * @param {string} sessionId
 * @returns {{ provider: string, model: string, channelId: string|null } | null}
 */
export function readSessionSelection(agentsService, sessionId) {
  try {
    const store = agentsService?.store
    if (!(store instanceof Map)) return null
    const entry = store.get(sessionId)
    const options = entry?.agent?.options
    const provider = options?.provider
    if (typeof provider !== 'string' || provider === '') return null
    return {
      provider,
      model: typeof options?.model === 'string' ? options.model : '',
      channelId: channelFor(provider) === undefined ? null : provider,
    }
  } catch {
    return null
  }
}
