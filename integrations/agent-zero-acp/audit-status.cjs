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
          // D34: this adapter emits a closed status vocabulary, never a run,
          // report, event, evidence reference, path or arbitrary server field.
          let result = 'not checkable';
          if (status?.state === 'completed' && status.conclusion === 'contradictory') result = 'failed';
          if (status?.state === 'completed' && status.conclusion === 'supported_within_scope'
              && status.verified === true && status.integrity === 'hmac'
              && status.authentication === 'supported') result = 'passed';
          output = `${result}. Integrity is not approval. Tracker not connected.`;
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
