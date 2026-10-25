# Read-only ACP audit status — NOT CONNECTED

This small handler follows the pinned deployed wrapper's existing
`session/update` / `agent_message_chunk` protocol. It lives entirely in TruthLens;
no vps-system wrapper or host service is modified. It is not a new Agent Zero
plugin or a working Mausbot gateway.

Protected gateway code may call `createAuditHandler({resolveSession, readRegistry})`
before forwarding ordinary `session/prompt` to the existing Agent Zero adapter.
A null return means normal delegation; audit responses must be sent verbatim on
the same stdio ACP transport. Other methods, initialization/authentication and
existing context persistence remain with the actual wrapper.

`/audit status RUN_ID` can only read. `/audit check` explains that only the server
pipeline starts audits; it cannot register or enqueue. There is no HTTP write
route, model call, key access, arbitrary subprocess or URL. Session resolution
is an **in-process trusted port** supplied by protected gateway code, never an
ACP argument or environment-derived principal. Defaults deny every request and
emit Not connected. `params.uid`, model text and an ACP `sessionId` alone provide
no authority. `readRegistry` must call the authorized root-side registry view
with the verified UID and bound server-generated session. No port implementation
or production binding is guessed here.

D34 clarification (25 October 2026): the agent-facing result is exclusively
`passed`, `failed`, or `not checkable`, plus the fixed integrity/connection
notice. No run identifiers, raw events, evidence, reports, host paths or keys
are reflected. `passed` requires a completed supported conclusion and the
stored `verified: true`, `integrity: hmac`, `authentication: supported` flags;
this adapter performs no fresh signature check. A contradictory completed
report maps to `failed`; pending, execution failure and unverifiable outcomes
map to `not checkable`. The protected gateway must supply only this status
projection to Agent Zero, never the human reader's event/evidence routes.
Its later container transport is a separate UID-restricted Unix socket;
neither it nor a gateway is provisioned by Phase B.

`node --test integrations/agent-zero-acp/audit-status.test.cjs` checks disconnected
behavior, trusted-port dispatch, session-preserving wire envelopes, no registration
and fixed errors. These tests do not establish deployed Mausbot authentication,
a real Agent Zero run or live source correlation. No ACP heartbeat is proof.
Host/gateway setup and a true Mausbot session remain owner-reviewed later steps;
see [server prerequisites](../../deploy/server/README.md).
