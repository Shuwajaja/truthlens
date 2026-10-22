'use strict';

// In-process ports belong to protected gateway code. Nothing in ACP/agent text
// can configure them. Without verified gateway binding this handler is inert.
function createAuditHandler({ resolveSession = async () => null, readRegistry = async () => null } = {}) {
  return async function handle(message) {
    if (message?.method !== 'session/prompt') return null;
    const params = message.params || {};
    const prompt = Array.isArray(params.prompt) ? params.prompt : [];
    const text = prompt.filter(item => item.type === 'text').map(item => item.text).join('\n').trim();
    if (!/^\/audit(?:\s|$)/.test(text)) return null;
    const request = /^\/audit (status|check) ([A-Za-z0-9_-]{1,80})$/.exec(text);
    let output = 'Audit unavailable · not connected. Gateway identity is not configured.';
    if (!request || request[1] === 'check') {
      output = 'Audits start only from the server pipeline. Use /audit status RUN_ID to read a registered result.';
    } else {
      try {
        const identity = await resolveSession(params.sessionId);
        if (identity && Number.isSafeInteger(identity.uid) && identity.uid >= 0 &&
            typeof identity.serverSession === 'string' && identity.serverSession.length > 0) {
          const status = await readRegistry({ runId: request[2], uid: identity.uid, sessionId: identity.serverSession });
          const states = new Set(['pending', 'queued', 'running', 'completed', 'failed', 'unavailable']);
          const conclusions = new Set(['supported_within_scope', 'contradictory', 'not_checkable']);
          if (status && states.has(status.state)) {
            output = `Run ${request[2]} · audit ${status.state}`;
            if (status.state === 'completed' && conclusions.has(status.conclusion)) output += ` · ${status.conclusion}`;
            output += '. Integrity is not approval. Tracker not connected.';
          }
        }
      } catch {
        output = 'Audit unavailable · not connected. No result could be read.';
      }
    }
    return [
      { jsonrpc: '2.0', method: 'session/update', params: {
        sessionId: params.sessionId,
        update: { sessionUpdate: 'agent_message_chunk', content: { type: 'text', text: output } },
      } },
      { jsonrpc: '2.0', id: message.id, result: { stopReason: 'end_turn' } },
    ];
  };
}

module.exports = { createAuditHandler };
