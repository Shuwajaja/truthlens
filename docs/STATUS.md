## Wrapper #49/#50/#51 scoped follow-ups — 23 October 2026

Configured pytest probes now use the configured entry point/interpreter and test environment/user, fixed probe arguments, a bounded timeout and static diagnostics. Valid JUnit failures survive a failed probe; a confirmed unavailable runner without valid XML stays unverified. Unsupported forms are not guessed. Post-agent capture failures attach informational evidence, skip artifacts/tests, close with failed status and a manifest, preserve the agent exit code, and return `capture_failed: true` with CLI exit 2. Gate shutdown and wrapper-owned temporary cleanup cover agent spawn errors too.

The #51 parent-symlink follow-up routes repository byte reads through descriptor-relative `O_NOFOLLOW` opens. Unsafe parents are refused before bytes are read or hashed; final symlink text and legitimate deleted/nonregular handling are preserved. Post-agent capture and test-copy source refusals close with a failed manifest. Multi-command pytest strings using `;`, `&&` or newline are regression-tested to retain a failed report rather than a later passing invocation overwriting it.

Local verification for #51: 47 focused wrapper and adjacent textconv/non-UTF-8/FIFO/symlink tests passed; seven new refusal/closure regressions were observed red before the fix. Earlier #49/#50 verification: 39 focused wrapper/CLI/gate tests, 157 fast CI Python tests, and Ruff passed. Regressions were observed failing before implementation. Separate-UID probe boundaries were mocked; no real user/host/service changes or full release suite run. Independent security review remains pending. Issue #49 remains scoped: gate response conflicts are outside this batch; broader arbitrary script/close behavior is also outside scope. Frozen contracts unchanged; no push or merge.

## Viewer Phase A: local workspace redesign — 23 October 2026

[Issue #156](https://github.com/Shuwajaja/truthlens/issues/156), independent branch `w5/issue-156-workspace-phase-a`, base main `f30320a` after #155. Owner-approved Petrol & Porcelain default / Cool Graphite alternative, existing self-hosted fonts, shared shell with independent desktop panels and mobile sheets; local fixture run → criterion → exact record. No foreign example/Agent-Plane code copied because complete provenance is absent. [Approved plan](../PLAN-redesign-2026-10-23.md) committed; phases B–F remain deferred.

Latest owner decision: **one local production build, no public demo delivery**. Historical demo bytes moved unchanged from public assets to `viewer/fixtures/demo-run.json`; Vite development alone serves the fixture. Production contains no fixture and makes no source request; it remains **Not connected** until the reader/D34 boundary is approved. No host/services/keys, local reader, private import, frozen contract or Vercel project/deployment configuration changed. Legacy Vercel toolbar/provisioning can be considered for later separately approved removal.

294 Viewer units passed locally; build, lint, language, hard-colour guard and 210 rounded contrast pairs passed. Fresh review reproduced two desktop focus-loss cases; failing tests were witnessed, then fixed (record heading/back-to-criterion and persistent Inspector control). Existing hostile preview, modal AX/keyboard, evidence-tab, overflow-scroll and incomplete-review checks are carried into the local manual workflow; no test file removed. Tested source `f55dc987`: 100 full fixture axe scans plus 4 offline-build scans, zero violations/browser errors; 32 modal AX/trap checks and 12 overflowing-code keyboard checks passed. [Screenshots and exact scope](screenshots/w5/issue-156-workspace-phase-a/review-summary.md). Final source fast CI: all four jobs green; evidence-only head CI is reported in the PR. PR CI remains build/lint/fast unit only. Security check and Shu approval remain merge prerequisites; no merge.

## PR155: Review-Nacharbeiten — 23.10.2026

Die drei Review-Punkte zu Head `7399dbf` werden im selben [PR #155](https://github.com/Shuwajaja/truthlens/pull/155) korrigiert: sudo-Leerpolicy mit Exit0 wird anhand der eindeutigen C-Meldung erkannt; unbekannte/grantierende Ausgaben bleiben abgelehnt. Worker-Ticks lassen bereits vorhandene Audits vor der Zulassung aus, statt alte Snapshots neu zu prüfen; die inaktive Timer-Vorlage steht auf1min. Vollständige Berichte liegen separat in root-only `audits/`; die32MiB-Registry enthält nur relativen Pfad und Digest. Lesen prüft Pfadbindung, sichere Datei und SHA-256. Optional ebenfalls behoben: genau ein Wiederholungsversuch nach Unterbrechung, begrenztes Budget und tatsächlicher Jobstatus bei `admit`.

157 gezielte Python-Tests lokal bestanden (2,57s), Ruff `src tests` grün. Für sudo, Idle-Verhalten, Berichtsablage, Wiederaufnahme und CLI-Status wurden Fehler jeweils zuerst reproduziert und die Korrekturen anschließend erfolgreich geprüft; zusätzlicher Pfad-/Symlinktest schützt neue Berichtsreferenzen. Ein frischer gezielter Review meldet keine Blocker und führt36 betroffene Tests unabhängig erfolgreich aus. Der abschließende CI-Head und manuelle Release-Ergebnisse stehen im PR. Viewer-Code unverändert; kein neuer lokaler Browserlauf behauptet. Frühere Security-Freigabe laut Owner für7399dbf ersetzt nicht den Check dieser Änderungen. Live bleibt **not connected**, keine Host-Änderungen und kein Merge/Force-Push.

## Prüf-Agent Teil 2: Server-Pipeline und lesende Ansichten zur Prüfung — Owner-Stand23.10.2026

[Issue #154](https://github.com/Shuwajaja/truthlens/issues/154), Branch `w5/issue-154-server-audit-integration`, Basis main `4d2907c46912ec845e9b1994729c4e9c138fbbbb` nach unabhängig geprüftem PR153-Squash. Alles in einem TruthLens-PR, keine Änderungen in vps-system. Neuer Launcher mit festem root-only Agent-Zero-Profil, getrenntem `tl-agent`, privatem Schlüssel, serverseitiger Sitzung und geschütztem Dispatch/Initiator plus `on_behalf_of=Shu`. Nur eigene signierte Server-Captures werden als read-only Snapshot registriert und automatisch in die persistente, serielle Audit-Queue übernommen. CLI `pipeline run/worker`, `admit`, `status`; keine Chat-/HTTP-Registrierung. Fremde, externe, unsignierte oder veränderte Pakete werden abgelehnt. Root-Registry-Leseports, lesender ACP-Handler und separates kompaktes Widget sind vorbereitet; Gateway-/Mausbot-Identität ist nicht konfiguriert.

144 gezielte Python-Tests lokal bestanden (2,44s), Ruff `src tests` grün. Darin28 neue Server-/Admission-/Queue-/Leseportfälle; privilegierte Grenzen in Fixtures ausdrücklich simuliert. Ein echter lokaler Audit-CLI-Subprozess und echter Timeout des eigenen Testprozesses wurden geprüft.3 Node-ACP-Units bestanden.286 Viewer-Units/29 Dateien bestanden (26,30s), Lint, Sprache, Hard-Color-/Stilprüfung,134 bestehende Kontrastpaare und Build bestanden. Ein zusätzlicher Rot/Grün-Test korrigiert den direkten Modulaufruf `python -m truthlens.cli status`: Der Einstieg steht jetzt nach den neuen Hilfsfunktionen. Der endgültige CI-Head wird im PR ausgewiesen. Voller Python-/Browser-/axe-Release-Review nur manuell oder per Label `release`, vor Owner-Merge; neue Widget-Prüfung in diesen Workflow aufgenommen. Noch keine ausgeführten Screenshots/axe für dieses neue Widget behauptet.

Frischer Whole-Branch-Review fand einen reproduzierten Root-Leserace mit Fake-Schlüssel und fehlende Verzeichnis-fsyncs. Additiver privater Root-Supervisor bereinigt reale/effektive `tl-agent`-UID-Prozesse vor und nach der Agentphase; bei unbestätigter Bereinigung kehrt er nicht in unsichere Root-Leseoperationen zurück. Parent-PID ist an den geschützten Dispatch gebunden. Profile sind vorerst auf einen Testaufruf beschränkt (darin darf eine ganze Suite laufen), weil der unveränderte Wrapper keinen sicheren Callback zwischen mehreren Kopierphasen besitzt. Verzeichnisse werden vor der Registrierung bottom-up synchronisiert; Regressionen prüfen Reihenfolge und Fehlerpfad. Gezielter Reviewer-Nachcheck: keine verbleibenden konkreten Blocker in diesen beiden Korrekturen. Das ersetzt nicht die unabhängige CodexChat-Sicherheitsabnahme.

**Live: NOT CONNECTED.** Laut Serverbefund sind TruthLens, Key, Run-Verzeichnis und aktive Capture-Pipeline noch nicht eingerichtet; bestehender ACP-Wrapper liefert keine Principal-Quelle. `codex` ist root-äquivalent (sudo/docker), daher keine D34-Isolation für bisherige codex-Workerläufe. Neues `tl-agent`-Konto, keine privilegierten Gruppen/sudo/Subuid-Delegation, dedizierter Prozesslebenszyklus, geschützte Installation/Verzeichnisse und echte Agent-Zero-Toolrechte müssen nach Shus gesonderter Host-Freigabe geprüft werden. [Inaktive Vorlagen und Voraussetzungen](../deploy/server/README.md). Keine Dienste/Benutzer/Schlüssel/öffentlichen Ports angelegt oder aktiviert, keine Host-Änderungen, kein Merge/Force-Push. PR95 unberührt.

## Prüf-Agent: SPECC v1.2 abgeglichen — 22.10.2026

[PR #153](https://github.com/Shuwajaja/truthlens/pull/153) wird nach Eingang von `/home/codex/specs/truthlens-pruef-agent-specc-v1.2.md` ergänzt: verbindliche TL-AUD-001–012-Zuordnung, `not_applicable`, `ledger_last_hash`, `limitations` einschließlich XML-/Semantik-/Capture-Grenzen und Abbildung aller 18 Core-Abnahmefälle auf tatsächlich ausgeführte Tests. Die frühere Annahme einer fehlenden SPECC ist damit überholt. Keine Änderung der eingefrorenen Ereignisse, Rohdaten oder Freigaberegeln.

116 gezielte Tests lokal bestanden (1,87s), Ruff `src tests` grün. Neue JSON-Vertragstest-Anforderung vor Anpassung fehlgeschlagen und danach bestanden; unveränderte Ledger-Freigaberegeln zusätzlich unter TL-AUD-012 geprüft. Aktualisierter CI-Head und Ergebnis im PR; bisherige 113/CI-Grün beziehen sich auf den vorherigen Stand. Plan/SPECC nennen volle Suite in CI, abweichend von Shus neueren Fast-CI-Regeln; Abweichung gemeldet, Trigger nicht geändert. Tasks 7–9 warten weiterhin auf den vertrauenswürdigen Capture-/Snapshot-/Principal-Pfad, den der Nutzer gerade erfragt. Frischer SPECC-Abgleich fand zusätzlich den echten Wrapper-Typ `test_files_changed` statt des synthetischen Test-Typs; korrigiert und mit Fundstelle/geschützter Konfiguration getestet. Echte demo-2-Kopie und zwei beschädigte Kopien extern geprüft, jeweils Eingaben unverändert; intakte Kopie zeigt den realen widersprüchlichen Abschlussclaim, keine Authentifizierung. Kein Merge, kein Force-Push.

## Prüf-Agent: Tasks 1–6 zur Prüfung — 22.10.2026

[Issue #152](https://github.com/Shuwajaja/truthlens/issues/152), Branch `w5/issue-152-audit-verifier`, Basis main `a47ab739`. Deterministischer read-only Audit und CLI nach Plan v1.2: begrenzte sichere Dateizugriffe, wiederverwendete Chain-/Manifest-Verifikation, sämtliche Belegreferenzen, Testmetadaten und exakter Wrapper-Header, getrennte Behauptungsbefunde. Hash-only bleibt nicht prüfbar; Integrität ist keine Freigabe. Keine Änderung von Ledger, Manifest, Wrapper, Gate, Viewer, Rohdaten oder bestehenden Freigaberegeln. Additiver Entscheid D33 dokumentiert die Grenze.

Lokal 113 gezielte Audit-/Reader-/Ledger-/Tamper-/Manifest-/CLI-/Export-/MCP-Tests bestanden (1,85s), Ruff `src tests` bestanden. Frischer Whole-Branch-Review fand zwei fehlerhafte Eingabeformen mit Ausnahme statt JSON; beide mit beobachtetem Rot/Grün-Regressionstest behoben. Historisches demo-2 nur kopiert, Original unverändert und ohne vorhandenen Originalschlüssel nicht authentifiziert. Fast-PR-CI um die neuen Units ergänzt; kein voller Release-/Browser-/axe-Lauf. Der endgültige CI-Head wird im PR ausgewiesen. Sicherheitspfad: `needs-codex-review`, unabhängige CodexChat-Abnahme und Shus Merge-OK bleiben erforderlich.

SPECC v1.0 fehlt: Report-/Outcome-Vertrag und Zuordnung zu den 18 SPECC-Kriterien können nicht bestätigt werden. [Abgeleiteter Vertrag und Grenzen](spec/audit-verifier-v1.md). Tasks 7–9 sind nicht live angebunden: im geprüften ACP-Wrapper fehlt der belegte vertrauenswürdige Capture-/Snapshot-/Principal-Pfad. Rückfrage läuft; keine Live-Erfolge, Host-/Routing-Änderungen oder Widget-Abnahme behauptet. Nichts gemergt, kein Force-Push, PR95 unberührt.

# TruthLens — Status

## Issue #51: wrapper redaction follow-ups — 23.10.2026

Wrapper known-secret substitution now includes every nonempty value. Before storage and claim extraction, each valid recognized `TRUTHLENS_CLAIMS` JSON trailer is recursively redacted and serialized; malformed trailers retain ordinary text scrubbing, and claim extraction still selects the last trailer. The output blob is hashed from its sanitized stored bytes. Focused regressions cover a configured three-character secret, Unicode-escaped secret keys and values across multiple trailers, preserved neighboring output/fields, a valid signed ledger, and blob digest consistency. No ledger, gate, schema, or generic JSON decoding behavior changed.

## Viewer: Story/Timeline und schnelle PR-CI — 22.10.2026

[Issue #150](https://github.com/Shuwajaja/truthlens/issues/150), eigener Branch w4/issue-150-readable-chronology auf mainf1f6074. PR149 mit den Modusfarben wurde während der Arbeit extern gemergt; deshalb jetzt eigener unabhängiger PR, kein Stapel. Story und Timeline zeigen reale Zeit in Mono, Akteur und getrenntes Ergebnis, gruppiert nach zusammenhängenden aufgezeichneten Task/Result-Typen. Lange Texte und explizit referenzierte Originalinhalte lassen sich nativ aufklappen. Zeitlücken behaupten keine Agent-Aktivität; Behauptung/Bestätigung/Exit0 werden nicht als Erfolg gewertet. Daten, Schema und Freigaberegeln unverändert.

Quellstand `6ceb61e43071f0bf29c2027f9f9d86111311fc1e`:277 Unit-Tests lokal bestanden,22 abschließende betroffene Fälle ebenfalls; Lint/Stil/Sprache/134 Kontrastpaare/Build bestanden.66 schnelle Python-Units in0,60s. Manuell1440×900/390×844, beide Modi und beide Chronologien:8 Vorher-/16 Nachher-axe-Scans (geschlossen/geöffnet), keine Verstöße oder incomplete in diesem Umfang;8 originale3863-Zeichen-Inhalte per Tastatur geöffnet/gescrollt, keine Seitenüberläufe. [24 Bilder, Rohberichte und alte CI-Konfiguration](screenshots/w4/issue-150-readable-chronology/review-summary.md).

Shus neue Regel umgesetzt: pro PR nur Build/Lint/schnelle Units; volle Python-/UID-/Demo-/Toolbar-/Playwright-/axe-Prüfungen bleiben im manuellen workflow_dispatch release-review erhalten. Keine Tests gelöscht. Der manuelle Workflow wurde nicht ausgeführt; CI-Grün ist keine Release-/Screenreader-Abnahme. Fast-CI-Status zum endgültigen Head im PR; bei Grün merge-bereit melden, nicht selbst mergen. PR147s spätere Integration muss diese manuelle Planung beachten, keine automatische Voll-axe-PR-Schleife. PR95 unberührt.

## Viewer: Modusfarben zur Prüfung — 22.10.2026

[Issue #148](https://github.com/Shuwajaja/truthlens/issues/148), eigener Branch `w4/issue-148-mode-colours`, Basis main776212c nach den Owner-Merges von PR143/145. Client in entsättigtem Graugrün, Developer in kühlem Slate; eigene zentrale Tokens für gewählten Umschalter, schmalen Header-Streifen, dauerhaft sichtbares mobiles Moduslabel und beschriftete technische Zusatzbereiche. Keine Aussage über Prüfergebnis, Signatur oder menschliche Freigabe; tatsächliche Rollen und Daten unverändert.

Quellstand `69767fa0a0fbabb5517b554e0a11b360ce22ec2d`:272 Tests/25 Dateien, Lint, Hard-Color-/Sprach-/134 Kontrastprüfungen und Build bestanden.16 Browser-Modusfälle,32 Vorher-/Nachher-Bilder aller vier Ansichten/beider Modi bei1440×900/390×844, je36 vollständige axe-Scans vorher/nachher ohne Verstöße, je7 Tastatur-Scrollprüfungen. Neue Text-/UI-Kennfarben mindestens6,46:1;88 gezielte Scroll-/Hit-Test-Prüfungen bestehen. [Nachweise und offene incomplete-Grenzen](screenshots/w4/issue-148-mode-colours/axe-summary.md). CI zum endgültigen Head im PR. Kein Merge/Force-Push; echter Screenreader-Sprachlauf bleibt offen, PR95 unberührt. Der vollständige48-Zustands-CI-Ausbau liegt separat in PR147.

## Viewer: Hauptansicht per URL zur Prüfung — 22.10.2026

[Issue #144](https://github.com/Shuwajaja/truthlens/issues/144) / [PR #145](https://github.com/Shuwajaja/truthlens/pull/145), Branch `w4/issue-144-view-urls` auf main6c66473, nach den PR141-/PR143-Squashes. Die vier bestehenden Ansichten sind über `?view=overview`, `claimed-vs-proven`, `timeline` und `agent-story` direkt teilbar; Neuladen und Zurück/Vorwärts stellen sie wieder her. Unbekannte/fehlende Werte führen zu Overview; sonstige URL-Teile und gespeicherte Linse bleiben unabhängig. Keine neuen Share- oder Layout-Elemente, keine Stil-/Rohdaten-/Schema-/Freigabeänderung.

Geprüfter Quellstand `78681d8d90de41d01f0e8c2354e01643eb729748`:272 Tests/25 Dateien, Lint, Sprach-/Stil-/bestehende Kontrastprüfungen und Build erfolgreich.16 echte Direktlink-/Neuladen-/Kopierfälle plus4 Tastatur-/History-/Fallback-Fälle bei1440×900/390×844 und beiden Linsen;36 vollständige axe-Scans ohne Verstöße,7 Tastatur-Scrollprüfungen. Bestehende Layout-Snapshots unverändert. [Aktualisierte Screenshots, vollständige Berichte und Grenzen](screenshots/w4/issue-144-view-urls/flow-integration/axe-summary.md). Incomplete-Ergebnisse bleiben manuell offen. CI zum endgültigen Head im PR; keine pauschale WCAG- oder Nutzungsabnahme.

PR141 ist als Squashcc9929e auf main gemergt. PR143 ist inzwischen durch den Owner als Squash6c66473 auf main gemergt, einschließlich Statusakzenten. PR145 integriert denselben main-Stand ohne Force-Push; URL-Hook, URL-Tests und Browserprüfung bleiben bytegleich. Dieser P2-Branch dupliziert PR143 nicht. Kein Agent-Merge, PR95 unberührt.

## Viewer: gemeinsamer Stitch-Stil und Prüfweg auf main — 22.10.2026

[Issue #142](https://github.com/Shuwajaja/truthlens/issues/142) / [PR #143](https://github.com/Shuwajaja/truthlens/pull/143), eigener Branch `w4/issue-142-stitch-flow`. PR139 ist als Squash31dbf35 auf main gemergt. PR141 (zentrale Stitch-Farben) ist inzwischen als Squashcc9929e auf main gemergt. Sein Inhalt ist identisch zum bereits integrierten Stand ec1079a; maincc9929e ist zusätzlich als Vorfahr integriert, ohne weitere Viewer-Änderung. Main ist Vorfahr beider Branches; kein Force-Push. Der Rebase hat die Viewer-Inhalte erhalten; Shus anschließender Auftrag ergänzt semantische Statusleisten/-tönungen und Emerald-Auswahlakzente. Keine weiteren PRs gemergt. Keine menschliche Abnahme; PR95 unberührt.

Komponenten-Inventar und einzeln begründete Entscheidungen zu UX3–8 stehen in viewer/DESIGN.md. Alle vier Ansichten verwenden ein gemeinsames Seitengerüst und gemeinsame Komponenten; die dauerhafte doppelte Belegspalte samt inaktivem Navigator entfällt. Laufdetails sind global zugänglich. Ergebnis-Karte -> echtes passendes Kriterium -> vorhandener Beleg ist per Tastatur und mobil geprüft; leere Kategorien/Belege werden nicht erfunden. Auswahl führt zum Detail, Rückweg zur Overview setzt Fokus, Drawer nennt das ausgewählte Objekt. Schema, Rohdaten und Freigaberegeln unverändert.

Geprüfter Quellstand `52ed0975cc12e09e4760d22ac02cb97c17673794`:263 Tests/24 Dateien, Lint, Sprach-/Stil-/Kontrastprüfung und Build erfolgreich. Je36 vollständige axe-Scans vorher/nachher ohne Verstöße, je7 Tastatur-Scrollprüfungen, Vorher-/Nachher-Screenshots aller vier Ansichten bei1440×900/390×844. Zwölf echte Tastatur-Prüfwege und zwölf Rückwege in beiden Linsen/Größen bestanden. [Neueste Statusakzente:32 Vorher-/Nachher-Bilder,116 Kontrastpaare und volle axe-Berichte](screenshots/w4/issue-142-stitch-flow/status-accents/axe-summary.md); [Vorher/Nachher und Grenzen](screenshots/w4/issue-142-stitch-flow/axe-summary.md). Story als Liste statt Karte pro Ereignis; Ziffern zentral in JetBrains Mono, Diff-Markierungen neutral. Eigener verbindlicher Regelabschnitt in DESIGN.md aus Farb-PR141 übernommen. Incomplete-Ergebnisse bleiben manuelle Prüfpunkte; keine behauptete Nutzungsstudie, keine pauschale WCAG-Abnahme.

Dritter P1 als Squash6c66473 aus PR143 auf main ausgeliefert. Weitergehende Graph-Layouts, neue Story-Zusammenfassung, URL-Wiederherstellung und authentifizierte Kommentare sind ausdrücklich nicht erledigt. CI zum endgültigen Head steht im PR.

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
| P2 | Manuelle Barrierefreiheits-Prüfpunkte abschließen und vollständigen axe-Check dauerhaft absichern. | `aria-hidden-focus`, `aria-prohibited-attr` und `color-contrast`-Incomplete werden manuell geklärt; sie sind keine bestätigten Verstöße. Fokus, Screenreader und relevante Detail-Tabs prüfen. Shus neue Regel: vollständiges axe bei1440×900/390×844 im manuellen Release-Workflow, schnelle PR-CI separat; Integration aus PR147 muss dies beachten. Echter Screenreader-Sprachlauf bleibt offen. |
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
