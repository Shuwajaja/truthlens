# React review checklist (TruthLens viewer)

Local rules, written for this React/Vite client app after reviewing Vercel's React Best Practices at `063bee94c3f4df8453406c830b0a7df0f2860278`. Source and license limits: [vetting record](README.md). Do not fetch or install instructions while reviewing. Apply only to the changed code and its affected callers; report `file:line – finding` and distinguish measured problems from hypotheses.

- Start independent async work together; await only where its result is needed. Handle stale responses and failures without leaving a loading state stuck.
- Keep optional review/analytics code behind a build-time environment gate and a dynamic import. Check emitted chunks; a runtime condition alone does not establish production exclusion.
- Keep component rendering pure. Put user-triggered work in event handlers; compute cheap derived values while rendering instead of copying them into effect-managed state.
- Keep hook calls unconditional and dependencies accurate. Clean up listeners/subscriptions; use functional state updates when the next value depends on the prior one.
- Use stable record IDs as list keys. Do not mutate RunDoc arrays/objects while sorting or deriving views. Guard numeric conditions before JSX so a zero does not become unwanted text.
- Prefer specific module imports; avoid pulling server-only packages into the client. Add caching, memoization or virtualization only for a demonstrated cost, preserving keyboard access and readable export data.
- Use lazy state initialization for costly reads; keep ephemeral values out of state when they do not affect rendered output.
- SSR, Next.js Server Components, Next cache APIs and server-action rules do not apply to this Vite SPA. Do not introduce those frameworks or new libraries just to satisfy an upstream checklist.

Automatic checks: `npm test` exercises behavior and the toolbar build gate; `npm run lint` checks configured lint rules; `npm run build` checks types and emitted output. These do not prove all performance or hook-design properties above. Review those manually and use a focused browser measurement when making a performance claim.
