# Workspace navigation review — 23 October 2026

Tested application and review script: `5ae5c6fd3a1469aae13174f58da597a8ec2d0cd3`. Local Vite development and freshly built production preview; no deployment or host changes.

24 full, unrestricted axe scans and 24 PNG screenshots cover Petrol & Porcelain and Cool Graphite at **1440×900** and **390×844**. Each combination covers restored/pinned tabs, final criterion, Runs, unavailable references, unavailable storage and disconnected production. All scans reported **zero violations**. Twelve incomplete contrast groups were reviewed with the existing computed/composited CSS contrast helper: 40 node checks passed, no unresolved low-contrast result. This is scoped evidence for changed states, not a whole-product accessibility claim. [Machine-readable results](review.json).

In all four development combinations, native keyboard activation selected/pinned/closed/restored a tab; closing focused its neighbor and restoring focused the restored tab with pin state retained. The final criterion was scrolled into view, hit-tested and keyboard-activated. Unavailable references remained unavailable after reload, then Return to Runs worked. Runs displayed exactly the one supplied record. Initial load retained body focus. Captured development page errors: zero. Shared self-hosted fonts were explicitly loaded before every scan.

All four production combinations loaded an explicit unavailable source URL and displayed **Not connected**. The script asserted **zero fetch/XHR requests** and no fixture run ID in the page. Production exposes no run details action or source registry. This does not test a reader, live source or server connection.

Representative screenshots:

- [Desktop Runs, Graphite](cool-graphite-1440-runs.png)
- [Mobile restored tab, Porcelain](petrol-porcelain-390-restored.png)
- [Mobile final criterion, Graphite](cool-graphite-390-criteria.png)
- [Mobile unavailable reference](petrol-porcelain-390-unavailable.png)
- [Mobile unavailable storage](cool-graphite-390-unsaved.png)
- [Desktop disconnected production](petrol-porcelain-1440-production.png)

Manual visual inspection of desktop Runs and mobile restored-tab captures confirmed the restrained token-based layout, visible focus and bounded horizontal strip. The strip scrolls in flow and does not overlay criteria. Existing unrelated evidence/preview/dialog flows were not exhaustively rerun; their unit/integrity/isolation checks remain intact.

Reproduction from `viewer/`:

```sh
LD_LIBRARY_PATH=$PWD/node_modules/.browser-deps/usr/lib/x86_64-linux-gnu \
REVIEW_BROWSER_EXECUTABLE=$HOME/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome \
node scripts/review-navigation.mjs
```

The cached browser libraries and existing dependency symlink were reused. Preliminary harness attempts found blocked fonts outside Vite's symlinked allowlist and init scripts running inside opaque preview iframes. The final script allows only its existing real dependency directory and guards storage initialization to the top window. Preliminary failed captures were replaced by this final passing capture; no dependencies were installed in this worktree and no host configuration changed.
