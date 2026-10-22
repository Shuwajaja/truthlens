# Stitch Overview + preview toolbar integration

Tested source `47740d6ad17a2e6e5ec7aa10752579e10a6c494a`, tree `a3000455d4ca8507fce901af5dfca7af62a3b85e`. Tests/scans ran on the exact staged integration tree, committed unchanged afterward. Raw report preserves scan-start HEAD separately.

PR #135 is the Stitch implementation PR as well as its DESIGN.md changes; there is no separate docs-only #135 versus Stitch PR. Branch: `w4/issue-134-stitch-overview`.

## Branch compatibility

Checked heads: Toolbar #127 `f1849ee6f531de7a88c89f653f1bd2852fc7def7`, Stitch #135 `e34e3501e2f625e68f494e1dde5fb73b64d572c1`, main `40dbb8c4f9521a56280c8b17a69e03216e1ba105`.

`git merge-tree --write-tree` found conflicts in viewer/package.json and viewer/scripts/audit-a11y.mjs. Resolved only on the Stitch branch by integrating the exact #127 head as a second parent. Kept language + theme + toolbar checks in npm test; kept the local screenshot output default and the Stitch sandbox-denial classification in the full axe script. DESIGN.md merged cleanly, preserving the final Stitch palette and toolbar rules. No edits to the WERK branch, main, or #127.

After resolution, merge-tree checks against both #127 and main returned exit0 and tree a3000455d4ca8507fce901af5dfca7af62a3b85e. This establishes source compatibility at those heads; no PR was merged into main.

## Executed verification

- 227 tests in21 files passed, including the preview-only build gate, root theme lifecycle, real-data Overview and toolbar reuse.
- Lint, styles, English-language check and production build passed; 108 AA colour pairs passed across existing profiles. Final Overview colours/fonts remain Stitch / Plus Jakarta Sans + JetBrains Mono, centrally tokenized. No further WERK theme development.
- 28 Playwright screenshots across four views/both lenses and affected sheets at1440×900 and390×844; four dedicated Overview states, twelve real criterion selections, real painted preview and hostile-content isolation passed. Desktop/mobile screenshots below visually inspected.
- 36 unrestricted axe-core4.14.0 scans, **zero violations**, including zero serious/critical. Seven keyboard scroll checks passed. Chromium156.0.8078.4. No unexpected browser errors; four expected exact sandbox script denials retained separately.
- Actual production/preview builds checked: only preview includes toolbar code. Chromium checks at both viewports verified one loader, availability failure leaves navigation working, existing platform loader/component reused, including async platform script after </html>. No authenticated commenting or hosted integration test is claimed.
- Incomplete manual follow-up: color-contrast24 scans/553 node occurrences, aria-hidden-focus20/140. This is not blanket WCAG certification.

[Raw axe](axe-results.json) · [Layout/theme checks](stitch-check.json) · [Toolbar checks](toolbar-checks.json)

| Desktop1440×900 | Mobile390×844 |
|---|---|
| ![Overview desktop](overview-1440-client.png) | ![Overview mobile](overview-390-client.png) |

Real run.json data only; visible hash-only/signature-not-checked and Integrity is not approval. Approval OPEN remains distinct from recorded criterion results. UI English. Preview artifact retains its historical appearance. No merge without Shu’s explicit OK.
