# TruthLens — Status

## PR147: Voll-Audit nur manuell, main aktualisiert — 22.10.2026

Shus neue Regeln umgesetzt: Branch w4/issue-146-full-a11y integriert mainf1f6074 ohne Force-Push. aria-modal=true im Drawer und sämtliche48 axe/AX-Zustände bleiben unverändert. Der volle Audit läuft ausschließlich im manuellen workflow_dispatch release-review, nie automatisch pro PR. Schnelle PR-CI: Build/Lint/Vitest sowie schnelle Python-Units. Alte Vollprüfungen und Testdateien bleiben erhalten. Workflow-Dateien stimmen mit dem unabhängigen Story-PR151 überein; keine Abhängigkeit oder gestapelte PR.

Bisherige axe/AX-/Screenshot-Nachweise unten sind historisch für die jeweils genannten Quellstände. Der Voll-Audit wurde für die reine Planungskorrektur nicht erneut ausgeführt. Neuer Fast-CI-Status steht im PR. PR151 (Agent Story/Timeline) ist bereits umgesetzt und war mit seiner schnellen CI grün; kein Agent-Merge. Screenreader-Sprachlauf weiterhin offen.

## Historischer Nachweis: vollständiger A11y-Audit und technische Prüfung — 22.10.2026

[Issue #146](https://github.com/Shuwajaja/truthlens/issues/146), [PR #147](https://github.com/Shuwajaja/truthlens/pull/147), eigener Branch `w4/issue-146-full-a11y`, jetzt mit main776212c integriert. Der Owner hat PR141/143 gemergt; PR145 wurde anschließend durch den Owner als Squash776212c gemergt; dieser Branch integriert den aktuellen main-Stand ohne Force-Push. Kein Agent-Merge, PR95 unberührt.

Geprüfter Quellstand `abd38f13a7dffd725c4efe2cc520151e158a90d5`:277 Tests/26 Dateien, Lint, Hard-Color-/Sprach-/116 Kontrastprüfungen und Build bestanden.48 uneingeschränkte axe-Scans bei1440×900/390×844, beiden Linsen, allen vier Ansichten und relevanten Beleg-Tabs:keine Verstöße.9 Code-Scrollprüfungen;32 Modal-/Tab-AX-Prüfungen mit530 Tab/Shift+Tab-Schritten,12 ArrowRight-Tabwechseln und Escape/Fokusrückgabe. Fehlerhafte Abdeckung, jede axe-Verletzung und Browser-/Tastaturfehler lassen den manuellen Release-Audit scheitern; Rohberichte/Screenshots werden auch im Fehlerfall hochgeladen.

Bestätigter Fehler behoben: Drawer war trotz Fokusfalle im AX-Baum nicht modal; jetzt explizites aria-modal=true,32 Zustände als modal nachgewiesen. Bestehende incomplete-Knoten technisch eingeordnet:205 Vorkommen aktiver Textknoten bestehen die zusammengesetzte CSS-Kontrastprüfung (Minimum6,91:1 in dieser Teilmenge),892 Einträge gehören zum ausgeblendeten/deaktivierten Modal-Hintergrund (656 Kontrast,236 aria-hidden-focus). Alle16 Scroll-Stichproben sind anschließend per Hit-Test erreichbar; aria-prohibited-attr besteht48-mal. Unbekannte Fälle würden im Rohbericht offen bleiben. Keine Regel abgeschaltet oder als bestanden umgeschrieben.

[32 Screenshots, vollständige Berichte, AX-Vorher/Nachher und Grenzen](screenshots/w4/issue-146-full-a11y/axe-summary.md). Das ist technische Browser-/AX-Prüfung und agentische Sichtprüfung, kein durchgeführter NVDA-/VoiceOver-Sprachlauf. Dieser menschliche AT-Schritt bleibt ausdrücklich offen; kein pauschales WCAG-Zertifikat. CI zum endgültigen Head im PR. Schema, Rohdaten, Freigaberegeln, Stitch-Layout und sichtbare Texte unverändert.

## Viewer: Modusfarben zur Prüfung — 22.10.2026

[Issue #148](https://github.com/Shuwajaja/truthlens/issues/148), eigener Branch `w4/issue-148-mode-colours`, Basis main776212c nach den Owner-Merges von PR143/145. Client in entsättigtem Graugrün, Developer in kühlem Slate; eigene zentrale Tokens für gewählten Umschalter, schmalen Header-Streifen, dauerhaft sichtbares mobiles Moduslabel und beschriftete technische Zusatzbereiche. Keine Aussage über Prüfergebnis, Signatur oder menschliche Freigabe; tatsächliche Rollen und Daten unverändert.

Quellstand `69767fa0a0fbabb5517b554e0a11b360ce22ec2d`:272 Tests/25 Dateien, Lint, Hard-Color-/Sprach-/134 Kontrastprüfungen und Build bestanden.16 Browser-Modusfälle,32 Vorher-/Nachher-Bilder aller vier Ansichten/beider Modi bei1440×900/390×844, je36 vollständige axe-Scans vorher/nachher ohne Verstöße, je7 Tastatur-Scrollprüfungen. Neue Text-/UI-Kennfarben mindestens6,46:1;88 gezielte Scroll-/Hit-Test-Prüfungen bestehen. [Nachweise und offene incomplete-Grenzen](screenshots/w4/issue-148-mode-colours/axe-summary.md). CI zum endgültigen Head im PR. Kein Merge/Force-Push; echter Screenreader-Sprachlauf bleibt offen, PR95 unberührt. Der vollständige48-Zustands-Audit liegt separat in PR147 und wird nach Shus neuer Regel nur manuell gestartet.

## Viewer: Hauptansicht per URL zur Prüfung — 22.10.2026

[Issue #144](https://github.com/Shuwajaja/truthlens/issues/144) / [PR #145](https://github.com/Shuwajaja/truthlens/pull/145), Branch `w4/issue-144-view-urls` auf main6c66473, nach den PR141-/PR143-Squashes. Die vier bestehenden Ansichten sind über `?view=overview`, `claimed-vs-proven`, `timeline` und `agent-story` direkt teilbar; Neuladen und Zurück/Vorwärts stellen sie wieder her. Unbekannte/fehlende Werte führen zu Overview; sonstige URL-Teile und gespeicherte Linse bleiben unabhängig. Keine neuen Share- oder Layout-Elemente, keine Stil-/Rohdaten-/Schema-/Freigabeänderung.

Geprüfter Quellstand `78681d8d90de41d01f0e8c2354e01643eb729748`:272 Tests/25 Dateien, Lint, Sprach-/Stil-/bestehende Kontrastprüfungen und Build erfolgreich.16 echte Direktlink-/Neuladen-/Kopierfälle plus4 Tastatur-/History-/Fallback-Fälle bei1440×900/390×844 und beiden Linsen;36 vollständige axe-Scans ohne Verstöße,7 Tastatur-Scrollprüfungen. Bestehende Layout-Snapshots unverändert. [Aktualisierte Screenshots, vollständige Berichte und Grenzen](screenshots/w4/issue-144-view-urls/flow-integration/axe-summary.md). Incomplete-Ergebnisse bleiben manuell offen. CI zum endgültigen Head im PR; keine pauschale WCAG- oder Nutzungsabnahme.

PR141 ist als Squashcc9929e auf main gemergt. PR143 ist inzwischen durch den Owner als Squash6c66473 auf main gemergt, einschließlich Statusakzenten. PR145 integriert denselben main-Stand ohne Force-Push; URL-Hook, URL-Tests und Browserprüfung bleiben bytegleich. Dieser P2-Branch dupliziert PR143 nicht. Kein Agent-Merge, PR95 unberührt.

## Viewer: gemeinsamer Stitch-Stil und Prüfweg auf main — 22.10.2026

[Issue #142](https://github.com/Shuwajaja/truthlens/issues/142) / [PR #143](https://github.com/Shuwajaja/truthlens/pull/143), eigener Branch `w4/issue-142-stitch-flow`. PR139 ist als Squash31dbf35 auf main gemergt. PR141 (zentrale Stitch-Farben) ist inzwischen als Squashcc9929e auf main gemergt. Sein Inhalt ist identisch zum bereits integrierten Stand ec1079a; maincc9929e ist zusätzlich als Vorfahr integriert, ohne weitere Viewer-Änderung. Main ist Vorfahr beider Branches; kein Force-Push. Der Rebase hat die Viewer-Inhalte erhalten; Shus anschließender Auftrag ergänzt semantische Statusleisten/-tönungen und Emerald-Auswahlakzente. Keine weiteren PRs gemergt. Keine menschliche Abnahme; PR95 unberührt.

Komponenten-Inventar und einzeln begründete Entscheidungen zu UX3–8 stehen in viewer/DESIGN.md. Alle vier Ansichten verwenden ein gemeinsames Seitengerüst und gemeinsame Komponenten; die dauerhafte doppelte Belegspalte samt inaktivem Navigator entfällt. Laufdetails sind global zugänglich. Ergebnis-Karte -> echtes passendes Kriterium -> vorhandener Beleg ist per Tastatur und mobil geprüft; leere Kategorien/Belege werden nicht erfunden. Auswahl führt zum Detail, Rückweg zur Overview setzt Fokus, Drawer nennt das ausgewählte Objekt. Schema, Rohdaten und Freigaberegeln unverändert.

Geprüfter Quellstand `52ed0975cc12e09e4760d22ac02cb97c17673794`:263 Tests/24 Dateien, Lint, Sprach-/Stil-/Kontrastprüfung und Build erfolgreich. Je36 vollständige axe-Scans vorher/nachher ohne Verstöße, je7 Tastatur-Scrollprüfungen, Vorher-/Nachher-Screenshots aller vier Ansichten bei1440×900/390×844. Zwölf echte Tastatur-Prüfwege und zwölf Rückwege in beiden Linsen/Größen bestanden. [Neueste Statusakzente:32 Vorher-/Nachher-Bilder,116 Kontrastpaare und volle axe-Berichte](screenshots/w4/issue-142-stitch-flow/status-accents/axe-summary.md); [Vorher/Nachher und Grenzen](screenshots/w4/issue-142-stitch-flow/axe-summary.md). Story als Liste statt Karte pro Ereignis; Ziffern zentral in JetBrains Mono, Diff-Markierungen neutral. Eigener verbindlicher Regelabschnitt in DESIGN.md aus Farb-PR141 übernommen. Incomplete-Ergebnisse bleiben manuelle Prüfpunkte; keine behauptete Nutzungsstudie, keine pauschale WCAG-Abnahme.

Dritter P1 aus PR143 durch den Owner als Squash6c66473 auf main ausgeliefert. Weitergehende Graph-Layouts, neue Story-Zusammenfassung, authentifizierte Kommentare sind ausdrücklich nicht erledigt; URL-Wiederherstellung ist aus PR145 auf main. CI zum endgültigen Head steht im PR.

## Viewer: Client-Behauptung und Prüfergebnis zur Prüfung — 22.10.2026

Ausgangspunkt: `main` bei `29e930bd318dd8305e1dc6bb00e7cb6d11257669`, nach dem Squash-Merge von #137. [Issue #138](https://github.com/Shuwajaja/truthlens/issues/138) / [PR #139](https://github.com/Shuwajaja/truthlens/pull/139) ergänzt den nächsten P1: Im Client zeigt „Claimed vs proven“ Behauptung, aufgezeichnetes Kriteriumsergebnis und vorhandene Belege gemeinsam. Die Overview zeigt beim gewählten Kriterium die tatsächlich zugeordneten Behauptungstexte. Der Demo-Lauf hat einen belegten Erfolg, einen fehlgeschlagenen Test und ein ungeprüftes Kriterium mit ehrlichem Leerzustand. Kein Developer-Wechsel nötig.

Zuordnung ausschließlich über exportierte Kriterien-/Ereignis-IDs; fehlende oder teilweise fehlende Referenzen werden benannt. Keine erfundenen Belege, keine Änderung von Schema, Rohdaten, Freigaberegeln oder Integritätsgrenzen. Englische UI und Stitch-Design beibehalten. PR #95 unberührt.

Geprüfter Quellstand `c1883d531c37b137ddaea4b6496c47b68376e21e`: 237 Tests/22 Dateien, Lint, Stil-/Sprachprüfung und Build erfolgreich. 36 vollständige Baseline-axe-Scans plus8 zusätzliche Event-Drawer-Scans ohne Verstöße; sieben Tastaturprüfungen. Screenshots bei1440×900/390×844 und12 gezielte echte Client-Zustände. [Nachweise, Screenshots und Grenzen](screenshots/w4/issue-138-client-results/axe-summary.md). Incomplete-Ergebnisse bleiben manuelle Prüfpunkte. PR #139 offen, noch nicht gemergt: dieser P1 ist zur Prüfung bereit, nicht auf main ausgeliefert. Keine menschliche Abnahme. CI zum endgültigen Head steht im PR.

## Vorheriger P1: Kriterienbestätigung — Nachweis vom 22.10.2026

Aktueller Ausgangspunkt: `main` bei `980d8b7ea6be946080bbfcc2b84048af3ff85cbd`, nach den Merges von #133/#135. Dieser Auftrag ändert nur die Anzeige von `criteria.confirmed`; keine menschliche Abnahme, keine Änderung von Ereignisschema, Rohdaten oder Freigaberegeln. PR #95 bleibt unberührt.

[Issue #136](https://github.com/Shuwajaja/truthlens/issues/136) / [PR #137](https://github.com/Shuwajaja/truthlens/pull/137): In Timeline und eingebetteter Overview steht jetzt „Criteria confirmed by human“ ausschließlich bei aufgezeichnetem menschlichem Akteur, sonst „Criteria confirmation recorded“. „Confirmation is not a test result.“ grenzt die Bestätigung von tatsächlich bestandenen Prüfungen ab. Englische UI und Stitch-Design bleiben erhalten; der Drawer erhält das unveränderte Originalereignis.

Geprüfter Quellstand `961a00e083d36a663c34f12465dbc15db759b2f2`: 230 Tests/21 Dateien, Lint, Stil-/Sprachprüfung und Build erfolgreich; 36 vollständige axe-Scans ohne Verstöße, sieben Tastaturprüfungen und Screenshots bei 1440×900/390×844. [Nachweise und Grenzen](screenshots/w4/issue-136-criteria-confirmed/axe-summary.md). Axe-Incomplete-Ergebnisse bleiben manuelle Prüfpunkte. PR #137 wurde inzwischen als Squash29e930b auf main gemergt; der erste P1 ist damit dort enthalten. Die hier verlinkten Prüfungen bleiben historische Nachweise dieses früheren Quellstands. Die übrigen historischen P1/P2-Punkte wurden in diesem begrenzten Auftrag nicht neu bewertet. CI-Status zum aktuellen PR-Head steht im PR.

## Historischer Viewer-Prüfstand vor den UI-Merges vom 22.10.2026

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
| P1 · gemergt | „Criteria met“ bei `criteria.confirmed`: Korrektur aus [PR #137](https://github.com/Shuwajaja/truthlens/pull/137) auf main (29e930b). | Menschliche Kriterienbestätigung und bestandene Prüfungen getrennt; Tests, Screenshots und vollständiger axe-Nachweis siehe aktuellen Abschnitt oben. Ereignisschema, Rohdaten und Freigaberegeln unverändert. |
| P1 · gemergt | Client-Behauptung und tatsächliches Prüfergebnis: [PR #139](https://github.com/Shuwajaja/truthlens/pull/139) auf main (Squash31dbf35). | Demo-Erfolg, fehlgeschlagener Test und ungeprüftes Kriterium ohne Developer-Wechsel mit echten bzw. ausdrücklich fehlenden Belegen; Nachweise im aktuellen Abschnitt. |
| P1 · gemergt | Gemeinsamer Stitch-Stil und Hauptweg „Ergebnis → Kriterium → Beleg“ aus [PR #143](https://github.com/Shuwajaja/truthlens/pull/143) auf main (6c66473). | Vorher-/Nachher-Nachweise und begründete UX3–8-Entscheidungen im aktuellen Abschnitt; weitergehende Graph-/Story-Arbeit bleibt separat. |
| P2 · gemergt | Gewählte Hauptansicht per URL wiederherstellbar aus [PR #145](https://github.com/Shuwajaja/truthlens/pull/145), auf main776212c. | Ein geteilter Link bzw. Neuladen öffnet die beabsichtigte Ansicht; der beobachtete Rücksprung von Timeline zu Overview ist behoben. |
| P2 · PR offen / Sprachlauf offen | Vollständiger manueller Release-Audit und technische A11y-Prüfpunkte in [Issue #146](https://github.com/Shuwajaja/truthlens/issues/146) zur Prüfung bereit. | 48 volle axe-Zustände, Modal-/Fokus-/AX- und Kontrast-Triage nachgewiesen. Echter NVDA-/VoiceOver-Sprachlauf bleibt offen; keine pauschale WCAG-Abnahme. |
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
