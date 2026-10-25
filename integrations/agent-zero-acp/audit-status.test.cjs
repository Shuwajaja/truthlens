const test = require('node:test');
const assert = require('node:assert/strict');
const { createAuditHandler } = require('./audit-status.cjs');

test('unmapped ACP session stays disconnected without reading registry or invoking model', async () => {
  let reads = 0;
  const handle = createAuditHandler({ readRegistry: async () => { reads++; } });
  const messages = await handle({ id: 3, method: 'session/prompt', params: {
    sessionId: 'untrusted-session', prompt: [{ type: 'text', text: '/audit status run_123' }],
  }});
  assert.equal(reads, 0);
  assert.equal(messages[0].params.sessionId, 'untrusted-session');
  assert.match(messages[0].params.update.content.text, /not connected/);
  assert.equal(messages[1].result.stopReason, 'end_turn');
});

test('trusted in-process gateway port can read status only; ACP text supplies no principal', async () => {
  let args;
  const handle = createAuditHandler({
    resolveSession: async sid => sid === 'gateway-owned-session' ? { uid: 1234, serverSession: 'server-session' } : null,
    readRegistry: async value => { args = value; return { state: 'completed', conclusion: 'contradictory' }; },
  });
  const messages = await handle({ id: 1, method: 'session/prompt', params: {
    sessionId: 'gateway-owned-session', uid: 0,
    prompt: [{ type: 'text', text: '/audit status run_123' }],
  }});
  assert.deepEqual(args, { runId: 'run_123', uid: 1234, sessionId: 'server-session' });
  assert.match(messages[0].params.update.content.text, /failed/);
  assert.match(messages[0].params.update.content.text, /Integrity is not approval/);
});

test('D34 emits only the three status outcomes and never reflects private fields', async () => {
  const read = async status => {
    const handle = createAuditHandler({
      resolveSession: async () => ({ uid: 1234, serverSession: 'trusted' }),
      readRegistry: async () => ({ ...status, events: ['private event'], evidence: ['private evidence'],
        path: '/private/snapshot', key: 'sk-test-never-reflect' }),
    });
    const result = await handle({ id: 1, method: 'session/prompt', params: {
      sessionId: 's', prompt: [{ type: 'text', text: '/audit status run_123' }],
    }});
    const text = result[0].params.update.content.text;
    assert.doesNotMatch(text, /run_123|private|sk-test|events|evidence/);
    return text.split('.')[0];
  };
  assert.equal(await read({ state: 'completed', conclusion: 'supported_within_scope', signature_checked: true }), 'passed');
  assert.equal(await read({ state: 'completed', conclusion: 'contradictory' }), 'failed');
  assert.equal(await read({ state: 'completed', conclusion: 'supported_within_scope', signature_checked: false }), 'not checkable');
  for (const state of ['pending', 'queued', 'running', 'failed', 'unavailable']) {
    assert.equal(await read({ state }), 'not checkable');
  }
});

test('check cannot register/enqueue; normal chat stays delegated; unavailable errors are fixed', async () => {
  const handle = createAuditHandler({ resolveSession: async () => ({uid: 1234, serverSession: 'trusted'}),
    readRegistry: async () => { throw new Error('sk-test-private-path'); } });
  const request = text => ({ id: 1, method: 'session/prompt', params: {sessionId: 's1', prompt: [{type:'text', text}]} });
  assert.equal(await handle(request('ordinary task')), null);
  assert.match((await handle(request('/audit check run_123')))[0].params.update.content.text, /server pipeline/);
  const failed = await handle(request('/audit status run_123'));
  assert.match(failed[0].params.update.content.text, /unavailable/);
  assert.doesNotMatch(JSON.stringify(failed), /sk-test/);
});
