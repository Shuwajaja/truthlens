# TruthLens — Status

## Viewer: geprüft am 22.10.2026

Stand durch Codex (`actor.kind = agent`), keine menschliche Abnahme. `origin/main` steht bei `40dbb8c4f9521a56280c8b17a69e03216e1ba105`. **Im Rahmen dieses Auftrags wurde nichts gemergt.** Die nachfolgenden P0-Angaben vom 21.10. sind historische Einzelbranch-Nachweise und beschreiben nicht den heutigen Viewer-/PR-Stand.

### Erledigt bzw. zur Prüfung bereit

| Arbeit | Nachgewiesener Stand | Referenz |
| --- | --- | --- |
| Preview-only Toolbar | Technisch abgeschlossen; PR offen, nicht gemergt. CI auf `f1849ee` erfolgreich. Plattform-Script hinter `</html>` wird wiederverwendet: ein Script, ein Request; Production ohne Loader. Kein zusätzlicher Vercel-Zugriff von Shu nötig. | [PR #127](https://github.com/Shuwajaja/truthlens/pull/127), [CI #438](https://github.com/Shuwajaja/truthlens/actions/runs/39725711739), [Nachweise](https://github.com/Shuwajaja/truthlens/blob/f1849ee6f531de7a88c89f653f1bd2852fc7def7/docs/screenshots/w4/issue-126-toolbar-rules/axe-summary.md) |
| `label-content-name-mismatch` und `scrollable-region-focusable` | Mit PR #125 bereits behoben und in `main`. Kein weiterer Fix-PR nötig. Der ursprüngliche Nachweis umfasst 36 vollständige axe-Scans ohne bestätigte Verstöße und sieben erfolgreiche Tastatur-Scrollprüfungen. | [PR #125](https://github.com/Shuwajaja/truthlens/pull/125), [Fix-Nachweise](https://github.com/Shuwajaja/truthlens/blob/2e7191409b69a65de5fa3946ed231e0d67d7bbb9/docs/screenshots/w4/issue-124-axe-fixes/axe-summary.md) |
| UX-Bestandsaufnahme der Live-Seite | Fertiger Dokumentations-PR mit neun priorisierten Befunden und 28 neuen Screenshots. CI auf `d89a789` erfolgreich; PR offen. Der Live-Audit umfasst 18 vollständige axe-Scans bei 1440×900/390×844 ohne bestätigte Verstöße. | [PR #129](https://github.com/Shuwajaja/truthlens/pull/129), [Bericht](https://github.com/Shuwajaja/truthlens/blob/d89a789ce8c0ffc650831b5b43b2ba6f1ba992fa/docs/ux/review-2026-10-22.md), [CI #440](https://github.com/Shuwajaja/truthlens/actions/runs/39727154498) |

Die Live-Produktion lädt weiterhin `index-4429mvGn.js`; derselbe Bundle-Name wie beim dokumentierten Live-Audit wurde erneut per HTTP geprüft. Die verlinkten Browser-/Testnachweise stammen aus den angegebenen Läufen, nicht aus einem neu behaupteten vollständigen Testlauf. Diese Statusänderung verändert keinen Anwendungscode.

### Was für einen fertigen Viewer noch fehlt

Priorisierte Arbeitsliste aus dem Live-Review und den dokumentierten Prüflücken; Vorschläge für die nächsten Aufträge, keine Behauptung einer bereits erfolgten Produktabnahme.

| Priorität | Offene Arbeit | Woran die Erledigung erkennbar wäre |
| --- | --- | --- |
| P1 | Irreführendes „Criteria met“ beim Ereignis `criteria.confirmed` korrigieren. | Die Anzeige unterscheidet menschlich bestätigte Prüfkriterien von tatsächlich bestandenen Prüfungen. Ereignisschema, Rohdaten und Freigaberegeln bleiben unverändert. |
| P1 | In Client Behauptung und tatsächliches Prüfergebnis gemeinsam zeigen. | Für den realen Demo-Lauf sind Erfolg, fehlgeschlagener Test und ungeprüftes Kriterium ohne Developer-Wechsel samt vorhandenem Beleg auffindbar. Fehlende Belege werden nicht erfunden. |
| P1 | Ergebnis und Kriterien nach vorn stellen; Hauptweg vereinfachen. | Bei beiden Bildschirmgrößen ist der Weg „Ergebnis → Kriterium → Beleg“ klar. Statuskarten, Laufdaten, Graph, Story und Detailbereiche konkurrieren weniger. Vorschläge aus den UX-Punkten 3–8 einzeln abstimmen; Designregeln vor UI-Änderungen aktualisieren. Den statischen Navigator nicht als fertige Funktion behandeln. |
| P2 | Gewählte Hauptansicht wiederherstellbar machen. | Ein geteilter Link bzw. Neuladen öffnet die beabsichtigte Ansicht; der beobachtete Rücksprung von Timeline zu Overview ist behoben. |
| P2 | Manuelle Barrierefreiheits-Prüfpunkte abschließen und vollständigen axe-Check dauerhaft absichern. | `aria-hidden-focus`, `aria-prohibited-attr` und `color-contrast`-Incomplete werden manuell geklärt; sie sind keine bestätigten Verstöße. Fokus, Screenreader und relevante Detail-Tabs prüfen. CI sollte vollständiges axe bei 1440×900/390×844 erzwingen; derzeit prüft ihr Screenshot-Schritt nur Kontrast bei anderen Größen. |
| P2 | Abschließende Bedienungsprüfung mit realen Daten und Preview-Kommentaren belegen. | Eine Person kann das fehlgeschlagene Kriterium und seinen Beleg finden und die Integritäts-/Abnahmegrenze erklären. Andere gültige Exporte sowie Lade-/Fehlerfälle gezielt prüfen. Für die Toolbar ist die authentifizierte Kommentar-Abgabe noch nicht getestet; die letzte Änderung prüfte nur Laden/Reuse/Fallback. Keine Testkommentare ohne ausdrücklichen Auftrag senden. |
| Freigabe | Eigentümerprüfung der offenen PRs und des späteren Gesamtstands. | Shu gibt die gewünschten PRs ausdrücklich frei; CI und Nachweise passen zum dann geprüften Stand. Kein Agent-Merge im Rahmen dieses Auftrags. Der P0-Gesamtproduktstatus wird dadurch nicht automatisch als erledigt erklärt. |

Unverändert erforderlich: englische UI, echte Exportdaten, neutraler Hash-only-Hinweis, sichtbares „Integrity is not approval“ und „Signature checked“ ausschließlich bei `verified === true && integrity === 'hmac'`. Die Web-Oberfläche prüft keine Signaturen selbst. Neue Produktfunktionen wie ein echter Navigator sind nicht automatisch Voraussetzung dieses begrenzten Auftrags.

## Historischer P0-Stand vom 21.10.2026

Die folgenden Messungen und Integrationsaussagen bleiben als damalige Nachweise erhalten. Insbesondere „all changes are local“ und die damalige CI-Beschreibung gelten für diesen historischen Abschnitt, nicht für die oben verlinkten aktuellen PRs.

Updated: **2026-10-21 UTC** · by Codex (`actor.kind=agent`). Target: **2026-10-25**.

Scope is v1 stabilization and documentation. Event Schema v1 and Artifact Manifest v1 remain frozen. TruthLens is MIT-licensed under [LICENSE](../LICENSE), as confirmed by Shu. New product features remain outside P0.

### Repository and integration state

The baseline is local `main` at `9f7d636`. All changes below are local: no push, merge, pull request or deployment was performed. Items 1–5 were accepted by VPSMan on Shu's behalf in the task conversation. Items 6–7 have local checks; owner integration and the required HMAC security review remain open. No combined, merged P0 tree has been tested.

The hashes below identify implementation commits. Later status-only commits may follow on the same branch.

| Item | Change | Branch | Implementation commit | Observed local checks |
|---|---|---|---|---|
| 1 | Preserve old diff content; remove duplicate functions | `p0/bug-1-diff` | `f32578a` | Python: 176 passed; Ruff; offline demo. |
| 2 | Reject dictionary keys that collide after NFC normalization | `p0/bug-2-canonical` | `3e9e5c9` | Python: 173 passed; Ruff; offline demo; existing demo hashes unchanged. |
| 3 | Validate the complete RunDoc shape before rendering | `p0/bug-3-viewer-validate` | `3ee4a7b` | Vitest: 66 passed; Viewer lint/build; Python: 170 passed; Ruff. |
| 4 | Reject non-object MCP requests and keep processing | `p0/bug-4-mcp` | `663dbc1` | MCP: 9 passed; Python: 175 passed; Ruff; real stdio continuation check. |
| 5 | Repair corrupted existing blobs using atomic replacement | `p0/bug-5-store` | `37a8ae3` | Store: 3 passed; Python: 172 passed; Ruff; offline demo. |
| 7 | Report actual export integrity and the browser trust boundary | `p0/viewer-honest` | `90f6dc6` | Export integrity: 10 cases; Python: 180 passed; Vitest: 77 passed; Ruff; Viewer lint/build; offline demo. |
| 6 | MIT license text, this status and Viewer CI | `p0/docs` | `f3d29f2` | Python: 170 passed; Ruff; Viewer install/build/lint; test-script guard skips on main. |

Every listed Python suite also reported **2 skipped, 1 xfailed**. The differing pass counts are from separate branches, not a cumulative test run. No remote CI result is claimed for these unpushed commits.

### Measurements on the documentation branch

Python 3.12.3, with the clone's `.venv/bin` on the command's `PATH`:

```text
pytest -q -rs
170 passed, 2 skipped, 1 xfailed
ruff check src tests
All checks passed!
```

The two skips require a separate Unix user `tl-agent`, sudo access and its dedicated environment. The expected failure records the known same-UID key-access risk; none of these results proves OS-level isolation. Running tests from an unactivated temporary extract can instead fail `test_r6_gate_config_file_outside_refused_even_if_missing` because the `python` executable cannot be found; use the intended virtual environment.

The Viewer CI job uses Node 24 and runs, from `viewer/`:

```sh
npm ci
npm test --if-present
npm run build
```

On this branch from `main`, there is no `npm test` script yet, so the middle command deliberately skips tests; install and production build are checked locally. After `p0/bug-3-viewer-validate` is integrated, the same command runs Vitest and test failures fail CI. The flag accommodates either merge order; it does not claim tests exist on the old baseline. The script-present path was also exercised on `p0/viewer-honest`: 77 tests passed.

### Integration order and export compatibility

- `p0/viewer-honest` is based on `p0/bug-3-viewer-validate` (`3ee4a7b`), not directly on `main`; integrate bug-3 before its Item 7 follow-up.
- Items 1, 2, 4, 5 and this documentation branch are based independently on `main`. The owner controls integration; no branch has been merged by Codex.
- Item 7 changes the existing Viewer export `verified` meaning: only a real HMAC check with a key produces `true` / `hmac`; without a key, a consistent run is `false` / `hash-only`. Failed checks are `false` / `failed` and fail closed.
- The Viewer in Item 7 renders hash-only runs, rejects failed/inconsistent exports and labels the export-time check. Legacy exports without an explicit `integrity` field must be regenerated. That branch regenerates `viewer/public/run.json` from the committed `demo/runs/demo-2` without a key.
- Stored event/manifest formats and their hashes are unchanged. Item 7 records the metadata correction as D32 in the spec changelog and [TRUST-LEVELS.md](TRUST-LEVELS.md).

### Known limits

- The browser checks document shape, integrity-label consistency, card/status rules and counts. It does **not** verify ledger/blob hashes, HMAC or signatures. A consistently forged export can still be displayed.
- A same-UID agent and HMAC key holder do not form an isolation boundary: the agent can read the key and forge records. Separate-user/container isolation remains necessary; this P0 work makes no server or security-configuration changes.
- A witnessed test means the restored test command reported success. Code inside the test process can forge its result; this is the accepted v1 limit.
- The approval gate is not a sandbox. It controls capabilities routed through the gate, not everything an agent can do with its own account.

### Open work

- Owner review/integration, including the required review for wrapper/HMAC changes, and CI on the eventual combined tree.
- Prepare the 3-minute product demo. Existing scripted offline demo and tamper detection pass locally; this does not replace that product demo.
- Ledger append performance (quadratic re-read) is **post-v1**, not a P0 optimization task.
- No RenderKit, Factory, new capture features, remote hosting or deployment work is included.
