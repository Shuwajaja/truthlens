# TruthLens MVP-Spezifikation (v1)

Zieltermin: **2026-10-25**. Status jeder Zeile steht nur in `docs/STATUS.md`.

**Freeze-Regel:** Sobald Shu diese Spezifikation freigibt, wird nichts mehr hinzugefügt. Neue Ideen kommen in die Liste „Post-v1“ unten (oder als Issue mit Label `post-v1`), nicht in v1. Jede Checkbox wird ein GitHub-Issue mit genau diesen Done-Kriterien als Acceptance criteria, erlaubten Pfaden und Worker-Label.

## 1. Sicherheitsversprechen v1
Das Versprechen (wortgleich in README, Bewerbungsseite und Video):

> Tamper detection holds only while the HMAC key stays with the human and the agent runs as a separate Unix user.
> "met" means: the restored test command that TruthLens started reported success; app code running in the test process can forge it (accepted v1 limit).

**Blocker (verhindern den Merge, nur diese):** Unter den genannten Bedingungen (Key beim Menschen, Agent als eigener User) kann der Agent
- [ ] sich nicht selbst freigeben (keine gültige Approval ohne Key; Approval nicht wiederverwendbar, nicht auf andere Aktion/Ordner/Bytes übertragbar),
- [ ] kein bezeugtes Ergebnis fälschen, das außerhalb des getesteten Prozesses entsteht (Zählung nur aus JUnit-XML des von TruthLens gestarteten Befehls; Exit ≠ 0 ⇒ Fehler; Tests aus sauberer Kopie mit wiederhergestellten geschützten Tests),
- [ ] Ledger, Manifest oder Blobs nicht unbemerkt umschreiben (`verify`, `export`, MCP schlagen fehl).

Done: Für jeden Punkt existiert mindestens ein Angriffstest, der ohne den Fix fehlschlägt; CodexChat hat die Security-PRs freigegeben.
Alles andere (Härtung, Redaktionslücken, Robustheit) = Post-v1-Issue mit Label `security-followup` (#48–#52).

## 2. Viewer
- [ ] Client Lens ist Standard; Developer Lens per Umschalter, Auswahl bleibt gespeichert. *Done:* Build grün; Neuladen behält die Lens.
- [ ] Truth Overview zeigt pro Kriterium Status (met/unmet/unverified) als Zählung, nicht Prozent. *Done:* demo-2 zeigt 1 met, 1 unmet, 1 unverified.
- [ ] „Behauptet vs. bezeugt“ zeigt jeden Agent-Claim mit Befund. *Done:* demo-2-Claim „all done“ = claim_unwitnessed.
- [ ] Timeline mit Drawer: Diff- und Markdown-Ansicht aus exportierten Blobs. *Done:* Diff von demo-2 sichtbar, farbig.
- [ ] „Review required“-Hinweis in beiden Lenses. *Done:* sichtbar in Client und Developer.
- [ ] Unverifizierter Lauf zeigt „Verification failed“ statt Daten. *Done:* manipulierte run.json wird nicht als verifiziert angezeigt.

## 3. Demo-2-Neulauf
- [ ] Neulauf mit echtem OpenCode-Agent als `tl-agent`, Tests als `tl-agent` (`--test-user`). *Done:* `demo/runs/demo-2` neu, `verify` OK, Ergebnis c1 met, c2 unmet, c3 unverified; DEMO-RUNS.md aktualisiert.
- Voraussetzung: Security-Blocker (Abschnitt 1) gemergt.

## 4. Demo (nach DEMO-DREHBUCH v0.5)
- [ ] Demo-Lauf ergibt **c1 met, c2 unmet, c3 unverified** und Claim „all done“ = `claim_unwitnessed`.
- [ ] Die drei Ansichten (Truth Overview, Timeline, Behauptet vs. bezeugt) zeigen genau das, mit echten Screenshots (Mockups als „Konzept“ markiert).
- [ ] `truthlens verify` → OK; nach Ändern von `failed` im Ledger meldet `verify` Zeile und Grund (Verification failed). Einmal mit demo-2 echt aufgenommen.
- [ ] Demo-Skript `demo/run-demo.sh --offline` läuft deterministisch in CI.

## 5. MCP
- [ ] Read-only stdio MCP (`list_runs`, `run_report`, `run_events`) liefert dieselben Status wie der Viewer. *Done:* Test vergleicht MCP-Report mit Export für demo-2; ohne Key `verified:false`, `integrity:"hash-only"`; manipulierter Lauf `verified:false`.

## 6. README
- [ ] Tagline „See what your AI agent really did.“ + „Here's what's actually proven.“; Versprechen aus Abschnitt 1 wortgleich; keine Behauptungen über nicht existierende Features (z. B. Wiederverwendung). *Done:* Review durch Shu.
- [ ] Quickstart in frischem Clone reproduzierbar. *Done:* CI-Schritt bzw. manueller Lauf dokumentiert.

## 7. Video-Vorbereitung
- [ ] Drehbuch v0.5 mit echten Screenshots/Terminal-Aufnahmen der Szenen 2–6. *Done:* Assets in `demo/video/` (oder grokbot-truthlens), Sprache von Shu entschieden.
- [ ] Nur Tools nennen, für die es einen echten Lauf gibt.

## Nicht-Ziele v1 (Post-v1)
- Security-Härtung jenseits der Blocker: Issues #48–#52 (Manifest-Robustheit, Runner-Probe, JUnit pro Aufruf, Redaktionslücken, Gate-Härtung), Fälschung innerhalb des getesteten Prozesses (dokumentierte Grenze), Sandbox/Container statt Unix-User, Cursor als eigener User.
- Zweiter Agent-Adapter (Hermes), Cloud/Hosting, Teams/Accounts, Schreibzugriff über MCP, Remote-MCP, Kommentare zurück an Agenten, Wiederverwendung von Läufen.

## Wer macht was
| Rolle | Aufgaben |
|---|---|
| Hermes | Zerlegt je einen Abschnitt in Issues (Vorlage `agent-config/prompts/hermes-goal.md`), QA-Kommentare. Kein Code. |
| OpenCode (`tl-agent`) | Kleine Tasks, Tests, Doku, Demo-Skript, MCP. |
| Cursor | Viewer (`viewer/` nur). |
| CodexChat | Pflicht-Review aller Security-PRs (nur Blocker blockieren). |
| Admin | Plant, merged nach grüner CI und Freigaben, pflegt STATUS.md. |
| Shu | Gibt Spezifikation, Sprache, Video und Demo-Abnahme frei. |
