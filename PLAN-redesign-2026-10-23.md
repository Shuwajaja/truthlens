# TruthLens Frontend-Redesign – Implementierungsplan

**Planstand 23.10.2026; Phase A von Shu zur Umsetzung freigegeben.**

Nachtrag von Shu: lokal-first. Es gibt **nur einen lokalen Produktionsbuild**, keine öffentliche Demo-/Preview-Auslieferung. Fixtures ausschließlich für Tests, Screenshots und lokale Entwicklung; keine Fixture im Produktionspaket. Bis Phase B und D34 freigegeben sind, zeigt der Build „Not connected“ und fragt keine Quelle an. Das bestehende Vercel-Projekt/Deployment und seine Plattformkonfiguration bleiben unangetastet; eine spätere Stilllegung/Entfernung braucht Shus separates OK. PR-Nachweise sind Screenshots statt Preview-Links.

Freigabe: Petrol & Porcelain als Standard, Cool Graphite als Alternative; Plus Jakarta Sans/JetBrains Mono bleiben. Ausschließlich Phase A, Demo-Daten, keine Server-/Host-Änderung. Phasen B–F bleiben Planung. Diese dokumentierte Planfassung wird auf Shus Wunsch mit Phase A committed.

**Historischer Plantext:** Shus Auftrag und Entscheidungen gehen dem Material vor. Dieser Plan ist kein Umsetzungs-, Merge- oder Deploymentauftrag. Keine Produktdatei wurde dafür geändert; die Plan-Datei bleibt uncommittet.


**Ziel:** Ein hochwertiger lesender Workspace, in dem Shu einen Lauf öffnet, ein Kriterium prüft, dessen Beleg findet, zwei Quellen vergleicht und den gewünschten Inhalt korrekt exportiert.

**Architektur:** Eine React-/Vite-Oberfläche mit genau einem lokalen Produktionsbuild. Lokale Entwicklung und Tests verwenden ausdrücklich gekennzeichnete Fixtures, keinen zusätzlichen öffentlichen Demo-Build. Reale Serverdaten gelangen ausschließlich über einen SSH-Tunnel zu einem read-only Dienst auf Server-`127.0.0.1`. Kein Vercel-BFF und kein öffentlicher Live-API-Pfad.

**Stack:** Bestehendes React/TypeScript/Vite, vorhandene Radix-/shadcn-Primitives, Renderkit, Vitest, Playwright und axe. Python-Standardbibliothek für den kleinen Lesedienst; keine neue Agentenruntime. Zusätzliche Bibliotheken nur bei nachgewiesenem Bedarf und geklärter Lizenz.

**Referenzen:** Inbox-README; `01-redesign-plan/TruthLens-Workspace-UX-Umbau-SPECC-v1.0.md`; ausgewählte P0-Anforderungen aus `03-work-order/`; lokale Quellen aus 02/04/05. Materialwurzel: `/home/codex/truthlens-inbox/2026-10-23-redesign/`.

**Voraussetzung #155:** Die drei Review-Fixes sind im selben PR auf Head `15c34b6`. Schnelle CI und manueller Release-Review sind erfolgreich; nichts wurde gemergt. Eine spätere Backend-Umsetzung beginnt erst auf dem dann aktuellen, durch Shu freigegebenen main einschließlich dieser Änderungen.

## 1. Umfang: P0 ist lesend

P0 umfasst:

- Laufkatalog, Overview, Kriterien, Claims, Belege, Dateien/Diff, Timeline/Story und lesende Audit-/Freigabeinformationen.
- Workspace-Navigation, schließbare Renderer-Tabs, unabhängig einklappbare Seitenpanels, Inspector und Vergleich zweier konkreter Quellen.
- Zielgebundene lokale Downloads und einen kompakten lokalen Statusbereich.
- Zwei geprüfte Themes; englische UI, unveränderte aufgezeichnete Inhalte.

Nicht enthalten: Start/Stop/Re-run von Agenten, Audit-Enqueue/Registrierung über die Oberfläche, Approve/Reject, Reparatur, neue Signaturen, Chat/LLM, Honcho/Wissenssystem, Factory, Hermes, OpenCode, Cloud-Workspaces, öffentlicher Live-Zugriff oder Betriebseinrichtung. Historische Namen in Originaldaten werden dadurch nicht umgeschrieben und nicht als aktive Integration ausgegeben.

Eine öffentliche Vercel-Auslieferung ist nicht mehr vorgesehen. Der einzige Produktionsbuild enthält keine Demo-Fixture und keinen automatischen Live-/Demo-Fallback. Er läuft lokal über den später freizugebenden SSH-Tunnel; Vercel war nur Testumgebung. Allgemeine Dateiimporte aus dem Material sind zunächst kein P0-Pflichtumfang.

Ereignisschema, Artifact Manifest und Trust-Levels bleiben unverändert. UI-Zustände, Quellenidentitäten und Transportprojektionen liegen außerhalb dieser Verträge. Keine neue Darstellung macht aus einem Claim, Exit 0, einer menschlichen Kriterienbestätigung oder einem technisch beendeten Audit einen bestandenen Test oder eine Freigabe.

## 2. Screens und Nutzerweg: Desktop und Mobil

| Screen/Schritt | Desktop 1440×900 | Mobil 390×844 |
|---|---|---|
| Lauf öffnen | Links Katalog/Quelle; Mitte Laufübersicht; rechts optional Kontext. Quelle, Run-ID/Anker und Prüfgrenze bleiben sichtbar. | Kompakter Kopf, Laufauswahl im Sheet; genau ein Hauptinhalt. Keine permanente zusätzliche Iconleiste. |
| Kriterium wählen | Übersicht zeigt aufgezeichnetes Ergebnis und zugeordnete Claims getrennt. Auswahl aktualisiert den Inspector; ein geschlossenes Panel öffnet nicht ungefragt. | Kriterienliste nutzt die verfügbare Höhe. Kriterium öffnet dasselbe Detail im Sheet; Rückkehr erhält Auswahl und Scrollposition. |
| Beleg öffnen | Exakte Event-/Artefaktreferenz; Datum, Quelle, Hash und vorhandener Inhalt. „Open in tab“ hält den Beleg als Ansicht fest. | Beleg als eigener Tab oder fokussierbares Sheet; lange Inhalte intern scrollbar. Fehlender Inhalt wird erklärt. |
| Vergleich | Höchstens zwei Ansichten; beide mit eigener Quelle und Vertrauensanzeige. Getrennte Scrollpositionen, beschrifteter aktiver Bereich, Tastatur-Splitter. | A/B-Umschalter statt zusammengedrückter Doppelspalte; beide Referenzen bleiben erhalten. |
| Export | Aktion benennt und bindet Quelle/Objekt vor dem Download. Ein Tabwechsel darf das vorbereitete Ziel nicht austauschen. | Dieselbe Aktion im Menü des aktiven Inhalts; Ziel und Umfang vor dem Download sichtbar. |
| Lokaler Status | Green-Deck-inspirierter kompakter Bereich, keine zusätzliche Dashboardseite. | Höchstens 360px breit, geschlossene Ansicht ungefähr 220–280px hoch; Warnungen und Prüfgrenze bleiben außerhalb der Details sichtbar. |

Overview, Claims, Timeline, Story, Graph und Raw bleiben erreichbar; die bisherige Vier-Tab-Headerstruktur wird ersetzt. Alte `?view=`-Links bleiben kompatibel. Der Graph ist eine ergänzende Ansicht mit zugänglicher Record-/Link-Liste.

Vorgeschlagene Geometrie aus 01/03: ab 1200px beide Panels möglich, Startbreiten 248/320px; 768–1199px an tatsächlichem Platz orientiert; darunter Sheets und kompakte Tab-Auswahl. Ein Vergleich benötigt nach Abzug der Panels mindestens 360px pro Inhalt. Keine zweite feste mobile Leiste über der Kriterienliste.

Quelle ist nicht nur die Run-ID: lokale Serverreferenzen binden Dienst-/Sichtkontext, Registrierung und Abschlussanker. Andere Bytes oder andere Quellen werden nicht stillschweigend zusammengeführt. Tab-Schließen löscht keine Daten; Pinning, Nachbarauswahl und Restore sind reine Darstellung. Vorschlag: 40 Tabs und 20 geschlossene Referenzen je Workspace, mit erklärter Grenze statt stillem Schließen.

## 3. Komponenten, Tokens und Themes

**Bestehend weiterverwenden:** RunDoc-Vertrag und `validateRunDoc`, Renderkit samt Fehlergrenze/Raw-Fallback, echte Kriterien-/Claim-/Belegzuordnung, Overview/Claims, Timeline/Story, sichere HTML-Vorschau, Graph, Lens, URL-Navigation und vorhandene Primitives. Drawer-Inhalt vom modalen Rahmen lösen und in Inspector, Sheet oder Tab einsetzen.

**Geplant neu beziehungsweise adaptiert:** `viewer/src/workspace/` für Shell, Navigation, Tabs, einen zentralen Präsentations-Reducer, ComparePane und ContextInspector; `viewer/src/data/` für getrennte Demo-/lokale Quellen; zielgebundene Exportaktionen. Namen/Pfade sind Vorschläge, keine bereits implementierten Dateien.

Es gibt genau einen Besitzer des Tab-Lebenszyklus. Weder die komplette fremde Renderer-Registry noch ein zweiter globaler Host werden parallel zum TruthLens-Renderkit eingeführt. Mount, Restore und Navigation dürfen keine Domainbefehle auslösen.

**Abgelöst:** Der Stitch-Gestaltungsvertrag in `viewer/DESIGN.md` wird an derselben Stelle durch den neuen Workspace-Vertrag ersetzt. Ehrlichkeit, englische UI, Nachweispflichten und Regeln gegen dekorative Verläufe/Glow bleiben erhalten. Keine Änderungen daran jetzt; erst im ersten beauftragten UI-PR.

**Von Shu für Phase A freigegebene Theme-Richtung:**

| Rolle | Petrol & Porcelain – vorgeschlagener Standard | Cool Graphite – dunkle Alternative |
|---|---|---|
| Rahmen / Lesefläche | `#102F38` / `#F1F4EF` | `#0D0F13` / `#181B22` |
| Haupttext | auf Papier `#183A42`, auf Rahmen `#F1F4EF` | `#EDF1F7` |
| Sekundärtext | auf Papier vorgeschlagen `#46656C` | `#ABB5C5` |
| Interaktionsakzent | `#97DCD2` auf dunklem Rahmen; dunkle Variante auf Papier erforderlich | `#A5B4FC` |

Farben ausschließlich zentral als semantische Variablen: Rahmen, Papier/Arbeitsfläche, erhöhte Fläche, Trenner, Text je Fläche, Auswahl, Fokus, Lens und Status. Erfolg/Fehler/offene menschliche Prüfung behalten getrennte Bedeutungen und passende AA-Textvarianten für beide Themes. Green Deck führt keinen dritten unkontrollierten Token-Satz ein; grüner Bedienakzent ist kein Prüfurteil.

Empfehlung: vorhandene selbst gehostete Plus Jakarta Sans und JetBrains Mono behalten; Zahlen/IDs in Mono. Keine Google-Fonts-Imports aus den Demos. Ausgangsskala12/14/16/20/28px,8px-Abstände, einheitliche Kontroll-/Panelradien; mobile Ziele möglichst44×44px. Kleine Texte nicht durch winzige Demo-Labels ersetzen.

Nur die angegebenen Einzelpaare wurden rechnerisch geprüft: Petrol Rahmen12,74:1, Papier-Haupttext10,99:1, vorgeschlagenes Papier-Sekundärtextpaar5,67:1; Graphite Haupttext15,20:1 und Sekundärtext8,33:1. Das ist keine UI-AA-Abnahme. Alle tatsächlich verwendeten Texte, Fokus-/Auswahlindikatoren und Mischflächen werden später separat geprüft.

Persistenz enthält nur validierte Präsentationsmetadaten; keine Runs, Belegtexte, Credentials, Auditberichte oder API-Adressen. Private Quellen bleiben im Arbeitsspeicher, nicht in Service Worker/IndexedDB oder öffentlichem Storage. Auf dem lokalen Origin gespeicherte Namen/IDs sind ebenfalls sensibel; minimale Speicherung und klarer lokaler Rücksetzweg.

## 4. Phasen und spätere PR-Zuschnitte

Jede Zeile beschreibt einen späteren, in sich prüfbaren PR. Keine PRs werden jetzt angelegt. Neue Branches starten erst auf integriertem main; keine gestapelten PRs. Zusammengehörige Teilaufgaben werden innerhalb dieses Zuschnitts gebündelt.

| Phase / PR | Umfang und vorgesehene Änderungsflächen | Abnahme |
|---|---|---|
| A – Design und erster Prüfweg | Neuer `viewer/DESIGN.md`, zentrale Tokens, Primitives, Shell/Inspector; vorhandenen Demo-Lauf→Kriterium→Beleg anbinden. | Zwei Themes, beide Linsen, Desktop/Mobil; die vier genannten UI-Fehler bereits als Regressionen abdecken. Keine Attrappen für spätere Aktionen. |
| B – Lokale Lesegrenze | Geplant `src/truthlens/read_service.py` und `read_projection.py`, passende Python-Tests, lokaler Source-Adapter für den einzigen lokalen Build. Nur inaktive Betriebsbeispiele. | Erst nach Klärung des D34-Konflikts aus Abschnitt5. Echter registrierter Snapshot lesbar; unregistrierte/fremde Quelle und Schreibmethoden abgewiesen; keine Schlüssel-/Audit-/Prozessaufrufe und keine Serveränderung durch Lesen. Eigenes Security-Review. |
| C – Katalog, Tabs und Navigation | Workspace-/Quellenidentitäten, Runs-Ansicht, Tab-Reducer, URL/Back/Forward, begrenzte Metadaten-Persistenz; RunsRenderer aus05 adaptieren. | Gleiche Run-ID in getrennten Quellen bleibt getrennt; Close/Pin/Restore/Tablimit und Reload bei fehlender Quelle funktionieren. Speicherfehler führen nicht zu falschem „Saved“. |
| D – Belege, Diff und Vergleich | Evidence-/Diff-Bausteine aus05 an echte Referenzen anbinden; Inspector/Sheets und ComparePane fertigstellen. | Fehlendes Blob/alte Antwort/falsche Quelle/Rendererfehler; beide Vergleichsseiten behalten ihre Identität und Vertrauensgrenze. Vollständiger Weg ohne Developer-Lens. |
| E – Zielgebundener Export | Exakter Download verfügbarer Quellen/Belege und ausdrücklich abgeleitete Datensätze; zunächst JSON und gespeicherte Belegbytes. | Bytevergleich, Hash/Quelle/Zielbindung, sichere Dateinamen, klare Ablehnung fehlender Inhalte. Neues Paket ist weder Originalmanifest noch neu signiert. ZIP nur bei bestätigtem P0-Bedarf. |
| F – Lokaler Green Deck und Qualifikation | Bestehendes Widget/lesenden `/audit status`-Handler aus155 auf dieselbe lokale Projektion ausrichten; neues kompaktes Layout, keine zweite Statuslogik. | Quellen/Regeln/Belege korrelieren, Unterbrechung bleibt sichtbar, kein Modellaufruf/Enqueue. Voller manueller Release-Review und kurzer Nutzerweg mit Shu. Mausbot-Anbindung ohne belegten SSH-Kontext weiterhin „not connected“. |

Vor A: Basiscommit, geänderte Abhängigkeiten, Quellen-/Lizenznachweise und Referenzzustände erfassen. Vor B: Hostfreigabe, SSH-Lesebetrieb und Sichtmodell beschließen. Vor Übernahme aus05: fehlende Typen/Styles/Testabdeckung vervollständigen. Kein Infrastruktur-Betrieb wird aus der Planfreigabe abgeleitet.

Jeder spätere PR nennt Allowed paths, Akzeptanzfälle und tatsächlich ausgeführte Checks; passende Doku/`docs/STATUS.md` wird im selben PR aktualisiert. Neue dauerhafte Doku wird indexiert. Gefrorene Verträge bleiben außerhalb der Änderungsflächen.

## 5. Lokaler Lesedienst über SSH

### Transport und Zugriff: vor Live-Betrieb zu klären

Server und clientseitige Tunnelöffnung binden ausschließlich an IPv4-`127.0.0.1`, vorgeschlagen Port8765. Kein `0.0.0.0`, IPv6-Wildcard, öffentlicher Proxy oder Vercel-Zugriff. Der Dienst liefert den lokalen statischen UI-Build und die Lese-API über denselben getunnelten Origin; deshalb keine freigegebene Cross-Origin-API erforderlich.

**Konflikt mit D34:** SSH authentifiziert den Tunnelzugang, aber ein gewöhnlicher Loopback-TCP-Dienst kennt weder den SSH-Nutzer noch seine Sitzung. Andere lokale Serverprozesse – insbesondere tl-agent – könnten denselben Port direkt erreichen. Auf der Clientseite müssen zusätzlich fremde Webseiten/DNS-Rebinding abgewehrt werden. „127.0.0.1“ allein erfüllt daher nicht die bestehende Nutzer-/Run-Grenze.

Empfohlener P0-Betrieb ist eine einzige, fest konfigurierte Shu-Lesesicht. Der berechtigte numerische Nutzer und die Sicht kommen aus geschützter Serverkonfiguration/SSH-Betriebszuordnung, niemals aus HTTP-Headern des Browsers, URL-Parametern oder `on_behalf_of`-Text. Jeder Run muss für diese Sicht tatsächlich berechtigt und serverregistriert sein. Mehrbenutzerbetrieb ist nicht P0.

Vor Aktivierung muss eine OS-seitige Erreichbarkeitsgrenze zwischen autorisiertem SSH-Forwarder und Worker-Prozessen feststehen, beispielsweise eine geprüfte Netzwerk-Namespace-/UID-Regel. Das wäre Teil einer gesondert freigegebenen Hosteinrichtung, kein jetzt ausgeführter Schritt. Soll darauf verzichtet werden, braucht es eine ausdrückliche D34-Entscheidung; der Plan unterstellt diese Lockerung nicht. Es wird auch kein zusätzlicher Browser-Token gegen Shus Tunnelvorgabe eingeführt.

Zusätzlich: feste Host-Allowlist, kein permissives CORS, Ablehnung fremder Origins/Fetch-Metadaten, `no-store`, `nosniff`, `no-referrer` und restriktive CSP. Diese Header ersetzen weder SSH noch die OS-/Sichtgrenze. Lokale Auslieferung lädt keine Toolbar, Analytics, externen Fonts oder Skripte.

### Datenquelle und geplante Endpunkte

Quelle sind ausschließlich Registry, registrierte read-only Snapshots und separat gespeicherte Auditberichte aus155. Kein beliebiger Dateipfad und keine Dateiübernahme als Serverlauf. Root-Berechtigungen der bestehenden Registry werden nicht für einen Webprozess pauschal aufgeweicht: der Lesepfad braucht ein geprüftes read-only Dienstprofil, gegebenenfalls einen gehärteten privilegierten Leser mit schreibgeschützten Mounts und verborgenem Key-Pfad.

| Nur GET/HEAD | Bedeutung |
|---|---|
| `/v1/health` | Lesedienst-/Quellenverfügbarkeit; keine Behauptung eines erfolgreichen Runs oder verifizierten SSH-Kanals. |
| `/v1/runs?cursor=…&limit=…` | Berechtigter Katalog aus Registry-Metadaten; keine Re-Audits aller alten Läufe. |
| `/v1/runs/{run_id}/document` | RunDoc-kompatible Leseprojektion; bestehender Validator, keine Änderung des Domainvertrags. |
| `/v1/runs/{run_id}/events?after_seq=…&limit=…` | Begrenzte Ereignisse mit echten IDs/seq/Hashes; keine als vollständiges RunDoc ausgegebene Teilmenge. Widget startet mit den letzten fünf. |
| `/v1/runs/{run_id}/events/{event_id}` | Exakt das zu diesem registrierten Lauf gehörende Ereignis. |
| `/v1/runs/{run_id}/artifacts/{artifact_id}` und `/blobs/{sha}` unter demselben Run-Präfix | Metadaten beziehungsweise ausschließlich referenzierte gespeicherte Bytes; Name im Manifest ist kein freier Hostpfad. Auch Testreport-/Evidence-Referenzen berücksichtigen. |
| `/v1/audits/{audit_id}` und `/report` darunter | Zugehöriger Jobzustand beziehungsweise gespeicherter Originalbericht; Pfadbindung und Digest prüfen. |
| `/v1/runs/{run_id}/export` | Klar bezeichnete Ableitung aus vorhandenen Daten, soweit keine ursprüngliche Exportdatei vorliegt. Keine neue Signatur. |

Neue Endpunkte sind Planung. Bestehende `registry_view.events()` lässt sich nicht blind als HTTP-Endpunkt verwenden: sie ruft momentan `check_snapshot()` inklusive Audit/Key-Zugriff auf. Der neue Lesepfad verwendet geschützte Referenzen, gespeicherte Auditbefunde und Hash-/Dateiprüfungen; er startet weder Audit noch Test und benötigt keinen HMAC-Key. Ein gespeicherter HMAC-Befund wird als solcher zitiert, nicht als frisch vom Browser/Export geprüfte Signatur. RunDoc-Felder werden dafür nicht künstlich auf `verified/hmac` gesetzt.

Unbekannte, fremde und nicht registrierte Ressourcen werden ohne Existenz-/Hostpfad-Leck abgewiesen. POST/PUT/PATCH/DELETE sowie Auditstart, Registrierung, Pipeline- und Approvaloperationen sind nicht vorhanden. Reader-GETs dürfen keine Registry-Datei anlegen, keinen Job einplanen und keine Dateien ändern.

### Grenzen und Kosten

Vorgeschlagene Startlimits: 50 Runs beziehungsweise 100 Events pro Seite, höchstens 2 gleichzeitige Datenanfragen; Viewer-Textpreview 1MiB. RunDoc im Browser höchstens 10MiB, insgesamt 50MiB geladene Exportbytes. Größere Inhalte nicht still kürzen oder als vollständig markieren: begrenzte Record-/Dateiansicht oder erklärter Größenfehler; große Voll-RunDoc-Ansichten sind nicht P0.

Die Core-Obergrenzen bleiben unverändert: Ledger 64MiB, Manifest/Auditbericht jeweils 8MiB, 100.000 Events, 20.000 Blob-Referenzen, 512MiB Run-Gesamtbudget. Große zulässige Blob-Downloads werden bei Bedarf mit kleinen Puffern gestreamt, nicht vollständig in den RAM kopiert; Identität/Digest und veränderter Inhalt müssen vor einem zugesagten erfolgreichen Download geklärt sein. Keine neuen höheren Limits.

Registry-Metadaten begrenzt/streamend indexieren, nur ausgewählte Berichte laden, keinen Voll-Audit je GET. Cache nur kleine Projektionen im RAM, anfänglich höchstens 16MiB; tatsächlichen Spitzenverbrauch vor Hostfreigabe messen. Keine dauerhaften privaten UI-Caches. `no-store` betrifft auch Downloads/Statusantworten.

Statuspolling höchstens alle 2 s, nur eine laufende Anfrage je Anzeige, gemeinsame Quelle für Workspace/Widget, Pause bei verborgenem Tab; nach drei Fehlern sichtbar unterbrochen und bis 15 s Backoff. Letzte Daten bleiben als veraltet markiert. Zeit des Empfangs ist nicht Zeit der letzten aufgezeichneten Aktivität. P0 zeigt geschlossene registrierte Läufe und vorhandene Auditzustände; keine erfundene laufende Toolaktivität.

## 6. Konkrete Übernahme aus 02/04/05

| Material | Übernehmen/adaptieren | Nicht übernehmen und warum |
|---|---|---|
| 02 Klick-Prototyp | Panel-Aufteilung, Tab-/Inspector-Bedienung, Split-Geometrie, aktives Exportziel und Theme-Idee. Nach React übertragen und mit echten Quellen verbinden. | Globaler Demo-Store, `innerHTML`-Rendering, synthetische TL-IDs/Erfolge, Demo-Chat, generische Dateiimporte, Remote-Fonts und ungeprüfter ZIP-Code. Die Demo hat andere Tab-/Importgrenzen als 01/03. |
| 04 Green Deck | Kompakte Meldung, sichtbare Warnung, native Details, Trennung von Job/Befund/Verbindung/Mensch; Belegaufruf aus Status. Nur lokale Datenquelle. | Sieben synthetische Events, Replay/Pause als Agentensteuerung, vorgegebener TL-AUD-005, 380 ms-Laufbandbewegung und POST-Auditanforderung. Die Demo-Typen sind kein Ersatz für #155; z.B. ihre Authentifizierungs-Enums unterscheiden sich. |
| 05 RunsRenderer / run-state | Listen-/Fehler-/Stale-Zustände, unbekannt bleibt unbekannt; Runs ausschließlich aus dem TruthLens-Katalog. | Fremde Core-/Projekt-/Mission-API, Stop-/Resume-Fähigkeiten und Erfolg aus „completed“. Ein technischer Zustand ist kein Kriterienergebnis. |
| 05 EvidenceRenderer | Kompakte Messwerte, Execution/Verification/Acceptance getrennt, Raw-Details aufklappbar. | `exitCode === 0` als „Check succeeded“ und beliebige Strings als „measured“. Nur echte berichtete Zähler/Belege zählen; nicht aufgezeichnete Felder bleiben unbekannt. |
| 05 DiffRenderer / ReviewRenderer | Gespeicherter Diff, klare Quell-/Resultatidentität; höchstens lesende Review-Zusammenfassung. | Accept/Reject-Callbacks, pauschales „verified“-Badge und fremde Result-/Approval-Schemata. Fehlende Diff-Zähler werden nicht erfunden. |
| 05 Shell/Layout/Host | Einzelne Geometrie-/Lifecycle-Funktionen und zugängliche Controls nach Schnittstellenabgleich. | Komplettimport von WorkspaceShell, zweiter Host, Discord-Kanäle, fremde Command-Grenze, Desktop-/Deno-/Proxy-Laufzeit. Breakpoints aus 01/03 haben Vorrang. |
| 03 OFI | P0-Muster für Identitäten, Lade-Rennen, UI-Persistenz, zielgebundenen Export und Abnahme. | Honcho-/SDK-/Chat-/Vercel-Live-/BFF-Aufgaben T06–T09 und daraus abgeleitete Infrastruktur. Sie sind nicht beauftragt. |

05 enthält hier 38 Dateien, aber keine eigenen Lizenz-/Provenance-Manifeste oder Tests, obwohl seine README auf ein umfangreicheres Archiv verweist. `SOURCE-LOCK.md` in 02 beschreibt eine historische, eng begrenzte Importfreigabe; daraus folgt keine pauschale heutige Lizenz für alle Dateien. Vor Codeübernahme Quellstand, Dateihash, Notices und Rechtezuordnung dokumentieren; fehlende Tests gezielt neu erstellen. Keine bestandene App-/Browserprüfung aus dem Paket behaupten und kein AGPL-Origin-/coss-Code übernehmen.

## 7. Test- und Abnahmeplan

**Vitest:** Quellen-/Ankertrennung, Deduplizierung nach Quelle/Ziel/Renderer, Close/Pin/Restore/Tablimit, Back/Forward, Speicherfehler, verspätete Antworten, exakte Belegauflösung, Renderer-Fallback, Exportziel nach Tabwechsel, unveränderte Exportbytes, separate Audit-/Approval-Achsen. Kein Reload/Mount darf einen Domaincommand auslösen. Produktionsbuild enthält keine Fixtures und fragt ohne konfigurierte lokale Verbindung keine Quelle an.

**Python-Lesedienst:** Nur 127.0.0.1 binden; fremde Methoden/Origins/Hostwerte ablehnen; feste Sicht durchsetzen; andere Runs/Session-Kontexte und unregistrierte Pakete verweigern; Traversal, Symlinks, Digestmismatch, übergroße Antworten und unterbrochene Reads. Vor/nach jedem Leseweg Registry-/Run-/Audit-Inhalte und relevante Metadaten vergleichen. Null Subprozess-, Enqueue-, HMAC-Key- oder Schreibzugriffe im Requestpfad nachweisen. Zugriff von tl-agent direkt auf den Dienst muss in der freigegebenen Betriebsumgebung scheitern.

**Playwright/axe – manuell beziehungsweise Release-Label:** 1440×900 und 390×844, beide Themes und Linsen; zusätzlich 320px und 200% Textvergrößerung. Referenzzustände: gemischte Overview, Fehlkriterium, Beleg/Diff, lange Timeline, Vergleich, fehlende/ungültige Quelle und Verbindungsausfall. Tastaturweg vollständig durchspielen, Desktop-Panels unabhängig, mobile Sheets/Fokusrückkehr, Splitter und Export prüfen. Vollständige axe-Scans; serious/critical beheben, incomplete einzeln bewerten.

| Offener UI-Fehler | Konkrete Regression |
|---|---|
| Mobile Projekt-Vorschau weiß | Dasselbe vorhandene Artefakt auf Desktop/Mobil sichtbar; Frame-/Leer-/Ladehintergrund aus passenden Tokens. Fehlender Blob bleibt ehrlicher Leerzustand. Tatsächlich weißes Original-HTML wird nicht verfälscht, um den Test „dunkel“ zu machen. Sandbox und Netzwerkblock erhalten. |
| Mobile Tab-Leiste verdeckt Kriterien | Letztes Kriterium per Scroll und Tastatur erreichbar und tatsächlich anklickbar; Hit-Test/Fokus nicht von Tabs, Sheet oder Safe-Area überdeckt. Beide Panels und lange Listen prüfen. |
| Grauer Kleintext unter 4,5:1 | Alle sekundären UI-Texte auf ihren tatsächlichen hellen/dunklen Hintergründen messen, einschließlich Tints. Kein globales Muted-Token quer über Papier und Rahmen. Funktionale Grenzen/Fokus mindestens3:1. |
| Weißer Rand um Überschrift beim Laden | Verzögerte Daten/Fonts, kalter/warm gestarteter Build und erste Frames vor Benutzereingabe prüfen. Kein dekorativer oder unbeabsichtigter Autofokus-Rahmen; Tastaturfokus bleibt sichtbar. `focusView()` in der aktuellen App ist ein zu prüfender Anknüpfungspunkt, keine bereits bewiesene Ursache. |

Fast-PR-CI bleibt Build/Lint/Unit samt statischen Stil-/Sprach-/Theme-Guards. Alte exakte Stitch-Farbassertionen werden fachlich durch den neuen Designvertrag ersetzt, nicht Tests pauschal gelöscht. Volle Python-/Browser-/axe-Suiten bleiben manuell oder per `release` vor Merge. Nachweise nennen tatsächlichen Commit, Quelle/Fixture, Viewport, Theme, Lens und Grenzen. Simulierte Quellen sind als solche markiert; sie beweisen keine Tunnel-/Hostintegration.

Zusätzlich: Ein tatsächlicher SSH-Nutzerweg mit autorisiertem registriertem Run und verweigertem Workerzugriff ist Voraussetzung für die lokale Live-Freigabe. Ohne diesen Nachweis bleibt „not connected“. Neuer UI-Code hat in diesem Plan noch keine Tests bestanden.

## 8. Risiken und Grenzen

- **D34 und Tunnel:** Fehlende OS-/Sichtgrenze würde Root-Belege für lokale Worker oder falsche Nutzer öffnen. Blockiert Phase B/Live, nicht die Gestaltung mit lokalen Test-Fixtures. Codex bleibt root-äquivalenter Administrator; Isolation vor diesem Administrator wird nicht behauptet.
- **Privilegierter Leser:** Root-only Registry passt nicht automatisch zu einem unprivilegierten HTTP-Dienst. Rechteaufweichung oder Key-Zugriff nur zur UI-Anbindung sind keine zulässige Abkürzung; separates Security-Review und Hostprofil erforderlich.
- **Wiederverwendung:**05 ist ein unvollständiger, fremd gekoppelter Ausschnitt ohne eigene Tests. Layout übernehmen heißt nicht, seine Domainzustände oder Erfolgskriterien zu übernehmen.
- **Datenschutz:** Lokaler Origin kann durch fremde Webseiten, Remote-Fonts, Telemetrie, Referrer oder Browserpersistenz Daten verlieren. Ein lokaler Build ohne Fixtures, inerte Inhalte, restriktive Header und kein privater Public-Import sind erforderlich.
- **RAM/Leistung:** Große Journale, Berichte, Graphen und 100.000 Events dürfen nicht gleichzeitig als vollständige Dokumente im Browser/Server liegen. Paginierung, Speichergrenzen und Messung gehen einer Performancebehauptung voraus.
- **Mobile reale Nutzung:** Ein SSH-Forward am Desktop macht den Dienst nicht auf dem Handy verfügbar. Kein Ausweichen auf LAN-Bindung; echtes Handy benötigt einen eigenen geeigneten Tunnel.
- **Ablösung des Designs:** Snapshot-/Theme-Tests und alte Links können brechen. Neue Referenzzustände zuerst festlegen; Rückschaltung betrifft UI/Präsentation, niemals Runs oder Auditberichte.
- **Umfang:** Vergleich, Export und Widget teilen Quellen-/Zielauflösung. Keine drei unabhängigen Datenadapter und keine neue Runtime nur für das Aussehen.

## 9. Offene Fragen an Shu

1. **D34-Betriebsentscheidung, blockierend für Live:** Ist eine einzige feste Shu-Lesesicht der P0-Standard? Welche geprüfte OS-Grenze soll direkte Workerzugriffe auf den Loopback-Dienst verhindern? Ohne diese Entscheidung keine Live-Aktivierung; Mehrbenutzerbetrieb würde einen eigenen Entwurf benötigen.
2. **Design entschieden:** Petrol & Porcelain ist Standard, Cool Graphite Alternative; Plus Jakarta Sans/JetBrains Mono bleiben. Green Deck ist weiterhin Phase F und nicht Bestandteil der Phase-A-Freigabe.
3. **`/audit status`, blockierend für die konkrete Anbindung:** Genügt P0 als lokaler Befehl/Commandbar beziehungsweise bestehende CLI über SSH, oder ist ausdrücklich eine ebenfalls lokal getunnelte Mausbot-Sitzung gemeint? Eine ungeprüfte ACP-Principal-Quelle wird nicht ergänzt.
4. **Exportumfang:** Sind RunDoc/ausgewählter gespeicherter Beleg für P0 ausreichend, oder ist ein ZIP-Nachweispaket zwingend? Empfehlung: erst exakte Einzel-Downloads, dann ZIP bei Bedarf. „Original“ bezeichnet nur tatsächlich vorhandene Originalbytes; erfasste redigierte Blobs sind keine unredigierten Ursprungsdateien.
5. **Reuse und Betrieb:** Gibt es eine aktuelle Rechte-/Quellenzuordnung für die gelieferten05-Dateien? Welches RAM-Budget und welcher echte mobile Tunnelweg sollen vor der lokalen Betriebsabnahme gelten?

Bis diese Fragen entschieden sind, ist dies ein prüfbarer Plan mit benannten Grenzen, keine fertige Implementierung oder vorweggenommene Betriebsfreigabe.
