# TruthLens Frontend-Redesign – Implementierungsplan

**Planstand 23.10.2026; Phase A von Shu zur Umsetzung freigegeben.**

Nachtrag von Shu: lokal-first. Es gibt **nur einen lokalen Produktionsbuild**, keine öffentliche Demo-/Preview-Auslieferung. Fixtures ausschließlich für Tests, Screenshots und lokale Entwicklung; keine Fixture im Produktionspaket. Bis Phase B und D34 freigegeben sind, zeigt der Build „Not connected“ und fragt keine Quelle an. Das bestehende Vercel-Projekt/Deployment und seine Plattformkonfiguration bleiben unangetastet; eine spätere Stilllegung/Entfernung braucht Shus separates OK. PR-Nachweise sind Screenshots statt Preview-Links.

Freigabe: Petrol & Porcelain als Standard, Cool Graphite als Alternative; Plus Jakarta Sans/JetBrains Mono bleiben. Ausschließlich Phase A, Demo-Daten, keine Server-/Host-Änderung. Phasen B–F bleiben Planung. Diese dokumentierte Planfassung wird auf Shus Wunsch mit Phase A committed.

**Planungsgrenze:** Shus Entscheidungen gehen dem Material vor. Nur Phase A wurde zur Umsetzung freigegeben. Die späteren Phasen sind kein Umsetzungs-, Merge- oder Deploymentauftrag. Die ursprünglich uncommittete Planfassung wird mit Phase A veröffentlicht.

**Späterer Plan-Nachtrag von Shu:** Die folgenden zusätzlichen Ansichten, Datei-/Hub-Schritte und Architekturpunkte sind für spätere Phasen fachlich freigegeben. Das ist kein Auftrag zu ihrer jetzigen Implementierung. Phase A, ihr Code und ihre Nachweise bleiben unverändert.


**Ziel:** Ein hochwertiger lesender Workspace, in dem Shu einen Lauf öffnet, ein Kriterium prüft, dessen Beleg findet, zwei Quellen vergleicht und den gewünschten Inhalt korrekt exportiert.

**Architektur:** Eine React-/Vite-Oberfläche mit genau einem lokalen Produktionsbuild. Lokale Entwicklung und Tests verwenden ausdrücklich gekennzeichnete Fixtures, keinen zusätzlichen öffentlichen Demo-Build. Reale Serverdaten gelangen ausschließlich über einen SSH-Tunnel zu einem read-only Dienst auf Server-`127.0.0.1`. Kein Vercel-BFF und kein öffentlicher Live-API-Pfad.

**Stack:** Bestehendes React/TypeScript/Vite, vorhandene Radix-/shadcn-Primitives, Renderkit, Vitest, Playwright und axe. Python-Standardbibliothek für den kleinen Lesedienst; keine neue Agentenruntime. Zusätzliche Bibliotheken nur bei nachgewiesenem Bedarf und geklärter Lizenz.

**Referenzen:** Inbox-README; `01-redesign-plan/TruthLens-Workspace-UX-Umbau-SPECC-v1.0.md`; ausgewählte P0-Anforderungen aus `03-work-order/`; lokale Quellen aus 02/04/05. Materialwurzel: `$HOME/truthlens-inbox/2026-10-23-redesign/`.

**Basis:** #155 ist inzwischen auf main integriert (`f30320a`). Phase A startet unabhängig darauf. Eine spätere Backend-Umsetzung beginnt erst nach gesonderter Freigabe auf aktuellem main.

## 1. Umfang: P0 ist lesend

P0 umfasst:

- Laufkatalog, Overview, Kriterien, Claims, Belege, Dateien/Diff, Timeline/Story und lesende Audit-/Freigabeinformationen.
- Workspace-Navigation, schließbare Renderer-Tabs, unabhängig einklappbare Seitenpanels, Inspector und Vergleich zweier konkreter Quellen.
- Zielgebundene lokale Downloads und einen kompakten lokalen Statusbereich.
- Zwei geprüfte Themes; englische UI, unveränderte aufgezeichnete Inhalte.

Nicht enthalten: Start/Stop/Re-run von Agenten, Audit-Enqueue/Registrierung über die Oberfläche, Approve/Reject, Reparatur, neue Signaturen, Chat/LLM, Honcho/Wissenssystem, Factory, Hermes, OpenCode, Cloud-Workspaces, öffentlicher Live-Zugriff oder Betriebseinrichtung. Historische Namen in Originaldaten werden dadurch nicht umgeschrieben und nicht als aktive Integration ausgegeben.

Eine öffentliche Vercel-Auslieferung ist nicht mehr vorgesehen. Der einzige Produktionsbuild enthält keine Demo-Fixture und keinen automatischen Live-/Demo-Fallback. Er läuft lokal über den später freizugebenden SSH-Tunnel; Vercel war nur Testumgebung. Allgemeine Dateiimporte aus dem Material sind zunächst kein P0-Pflichtumfang. Der gezielte lokale Ordnerimport eines TruthLens-Ledgers ist dagegen für Phase E geplant; er erzeugt keine D34-Serverregistrierung.

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

### Spätere Ansichten und Tabs (Shu freigegeben)

Die deutschen Namen sind Planbegriffe; die Oberfläche bleibt Englisch. Bestehende Phase-A-Tabs werden jetzt nicht umbenannt oder erweitert.

| Phase | Planbegriff / vorgesehener englischer Tab | Daten und Grenze |
|---|---|---|
| C/D | Kette / Chain | Ledger-Hash-Kette als Glieder in seq-Reihenfolge, ausschließlich aus dem tatsächlichen verify-Ergebnis. Gebrochenes oder ungeprüftes Glied rot, mit verschiedenen sichtbaren Labels Broken / Not checked; keine Unterscheidung nur durch Farbe. |
| C/D | Abdeckung / Coverage | Pro Kriterium die ausdrücklich zugeordneten, bezeugten Belege samt Ergebnis/Quellreferenz zeigen. Fehlende, mehrdeutige oder nicht prüfbare Zuordnung bleibt Unknown; ein Beleg-Link allein beweist kein bestandenes Kriterium. |
| C/D | Eingriffe / Gated actions | Requested / Blocked / Approved / Executed aus vorhandenen Ledger-Ereignissen; Verknüpfung über action_hash und approval_event_id, nicht durch vermutete zeitliche Nähe. Fehlende Schritte bleiben fehlend. |
| D | Änderungen / Changes | Gespeicherter Vorher-/Nachher-Diff mit konkreter Quelle und vorhandenen Hunk-/Dateireferenzen. Kein nachträglich erfundener Ausgangsstand und keine Ausführung des Inhalts. |
| C/D | Behauptet oder bewiesen / Claimed or proven | Bestehendes ClaimedVsProven in das Workspace-Tabmodell übernehmen. Vorhandene Claims, Kriterien und bezeugte Ergebnisse getrennt bewahren; keine neue binäre Erfolgsableitung. |
| Später, nach B und genügend echten Läufen | Agenten-Zeugnis / Agent report card | Je verlässlich identifiziertem Agenten den Anteil unbelegter Behauptungen über berechtigte echte Läufe zeigen: Zähler, Nenner, Zeitraum und Auswahlgrundlage sichtbar. Keine Aussage aus Fixtures, keine Gleichsetzung von nicht prüfbaren Läufen mit belegtem Fehlverhalten; bei zu kleiner/fehlender Grundlage Unknown statt erfundener Quote. |

Chain darf keine Einzelglied-Diagnose erfinden: liefert verify nur ein Gesamtergebnis oder stoppt am ersten Fehler, werden nur tatsächlich ausgewiesene Glieder als geprüft dargestellt; der übrige Bereich bleibt Not checked. Das rote ungeprüfte Kettenglied ist Shus begrenzte Ausnahme von der sonst neutralen Unbekannt-Darstellung. Es bedeutet fehlende technische Prüfung, nicht nachgewiesene Manipulation. Ein konsistenter Hash-Link ist weder HMAC-Authentifizierung noch fachlicher Erfolg oder menschliche Freigabe; der neutrale Hash-only-Hinweis bleibt unabhängig davon erhalten.

Gated actions liest action.requested, action.blocked, approval.granted und action.executed sowie vorhandene Denied/Expired-Zustände unverändert. Approved bezeichnet nur den passenden aufgezeichneten Freigabeschritt; menschliche/simulierte Rolle, Ablauf und Verbrauch bleiben sichtbar, keine neue Approval-Schaltfläche. Eine erteilte Freigabe ist keine Ausführung und keine nachträgliche Genehmigung eines abweichenden action_hash.

Alle neuen Tabs verwenden dieselbe Quellenidentität, Inspector-/Belegauflösung und englischen Leer-/Fehlerzustände. Desktop erhält zugängliche Listenalternativen zu Gliedern/Graphen; mobil ein Hauptinhalt mit vertikaler Ketten-/Kriterienliste und Details im Sheet, keine winzigen parallelen Spalten. Alte Ansichtslinks bleiben gültig.

Vorgeschlagene Geometrie aus 01/03: ab 1200px beide Panels möglich, Startbreiten 248/320px; 768–1199px an tatsächlichem Platz orientiert; darunter Sheets und kompakte Tab-Auswahl. Ein Vergleich benötigt nach Abzug der Panels mindestens 360px pro Inhalt. Keine zweite feste mobile Leiste über der Kriterienliste.

Quelle ist nicht nur die Run-ID: lokale Serverreferenzen binden Dienst-/Sichtkontext, Registrierung und Abschlussanker. Andere Bytes oder andere Quellen werden nicht stillschweigend zusammengeführt. Tab-Schließen löscht keine Daten; Pinning, Nachbarauswahl und Restore sind reine Darstellung. Vorschlag: 40 Tabs und 20 geschlossene Referenzen je Workspace, mit erklärter Grenze statt stillem Schließen.

## 3. Komponenten, Tokens und Themes

**Bestehend weiterverwenden:** RunDoc-Vertrag und `validateRunDoc`, Renderkit samt Fehlergrenze/Raw-Fallback, echte Kriterien-/Claim-/Belegzuordnung, Overview/Claims, Timeline/Story, sichere HTML-Vorschau, Graph, Lens, URL-Navigation und vorhandene Primitives. Drawer-Inhalt vom modalen Rahmen lösen und in Inspector, Sheet oder Tab einsetzen.

**Geplant neu beziehungsweise adaptiert:** `viewer/src/workspace/` für Shell, Navigation, Tabs, einen zentralen Präsentations-Reducer, ComparePane und ContextInspector; `viewer/src/data/` für lokale registrierte Quellen und ausdrücklich getrennte Entwicklungs-/Importquellen innerhalb desselben lokalen Builds; zielgebundene Exportaktionen. Namen/Pfade sind Vorschläge, keine bereits implementierten Dateien.

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
| C – Katalog, Tabs und Navigation | Workspace-/Quellenidentitäten, Runs-Ansicht, Tab-Reducer, URL/Back/Forward, begrenzte Metadaten-Persistenz; bestehendes ClaimedVsProven übernehmen und Chain/Coverage/Gated actions im gemeinsamen Tabmodell vorsehen. Fremdbausteine nur nach Quellen-/Lizenzprüfung. | Gleiche Run-ID in getrennten Quellen bleibt getrennt; Close/Pin/Restore/Tablimit und Reload bei fehlender Quelle funktionieren. Speicherfehler führen nicht zu falschem „Saved“. Neue Tab-Zustände behaupten keine ungeprüften Ergebnisse. |
| D – Belege, Diff und Vergleich | Chain/Coverage/Gated actions mit echten Prüfergebnissen/Referenzen fertigstellen, gespeicherten Changes-Diff und Claimed-or-proven-Tab anbinden; Inspector/Sheets und ComparePane. Sichere Vorschau aus dem Hub nur nach Sicherheits-/Lizenzabgleich wiederverwenden. | Fehlendes Blob/alte Antwort/falsche Quelle/Rendererfehler; keine erfundene Einzelglieddiagnose, Approval oder Vorher-Datei. Beide Vergleichsseiten behalten Identität und Vertrauensgrenze; vollständiger Weg ohne Developer-Lens. |
| E – Datei öffnen und zielgebundener Export | Lokalen Ledger-Ordner lesend öffnen und mit TruthLens fail-closed prüfen; Einzeldownloads zuerst: Ledger, Manifest, vorhandene Belege. RunDoc/Ableitungen getrennt benennen. Portable Berichte und optionale lokale Hub-Ablage nach Adapter-/Zugriffsabnahme; ZIP später. | Ungültig oder ungeprüft erhält kein Grün. Keine D34-Registrierung durch Import, keine Änderung der Eingaben. Bytevergleich, Hash-/Zielbindung und sichere Namen; fehlende Inhalte ablehnen. Hub übernimmt niemals ein verified-Urteil. |
| F – Lokaler Green Deck und Qualifikation | Bestehendes Widget/lesenden `/audit status`-Handler aus155 auf dieselbe lokale Projektion ausrichten; neues kompaktes Layout, keine zweite Statuslogik. | Quellen/Regeln/Belege korrelieren, Unterbrechung bleibt sichtbar, kein Modellaufruf/Enqueue. Voller manueller Release-Review und kurzer Nutzerweg mit Shu. Mausbot-Anbindung ohne belegten SSH-Kontext weiterhin „not connected“. |

Nach Phase B, erst bei ausreichender echter Datenbasis: Agent report card als eigener, zusammenhängender Folgeschritt auf integriertem main. Mindestdatenbasis, eindeutige Agentenidentität und Nenner werden vorher festgelegt; dieser Plan verspricht noch keine belastbare agentenübergreifende Statistik.

### Phase E: Datei öffnen und Einzelexporte

„Datei öffnen“ wählt in der lokalen App einen Ledger-Ordner mit ledger.jsonl, manifest.json und blobs/. TruthLens liest die ausgewählten Bytes begrenzt und ohne Änderung der Quelle; kein Start von Agenten, Skripten, Reparatur oder stilles Nachladen beliebiger Hostpfade. Die konkrete browser-/hostseitige Importgrenze wird vor Umsetzung festgelegt, nicht als beliebiger Pfadparameter des Phase-B-Lesedienstes ergänzt.

TruthLens prüft die tatsächlichen Inhalte fail-closed mit den bestehenden Verify-/Manifest-/Blob-Regeln. Hash-only ohne vertrauenswürdigen Schlüssel bleibt nicht authentifiziert; Formatgültigkeit, Dateiname, ein Hub-Digest oder ein importiertes verified-Feld ersetzt keine Prüfung. Ungültig, abgebrochen, übergroß oder nicht prüfbar: kein grünes Urteil. Eine abgelehnte Quelle darf allenfalls eindeutig als ungeprüfte lokale Diagnose erscheinen und nicht in den vertrauenswürdigen Laufkatalog gelangen.

**D34-Grenze:** Ein selbst geöffneter externer/hochgeladener oder sogar extern signierter Ordner wird niemals dadurch ein zugelassener Serverlauf oder Audit-Queue-Job. Falls „Datei öffnen“ auch D34-Zulassung bedeuten soll, besteht ein Widerspruch, der einen gesonderten Owner-Entscheid erfordert. Dieser Plan sieht ausschließlich eine isolierte lokale Prüfung außerhalb der Serverregistrierung vor.

Exportreihenfolge ist entschieden: zuerst exakte Einzeldownloads der vorhandenen Ledger-/Manifest-/Belegbytes, anschließend bei Bedarf ZIP als späterer Schritt. Neu erzeugte RunDoc-/Berichtsdokumente sind Ableitungen, keine Originale und keine neu signierten Pakete. „Original“ bezeichnet die tatsächlich gespeicherten, gegebenenfalls bereits redigierten Capture-Bytes.

Vor A: Basiscommit, geänderte Abhängigkeiten, Quellen-/Lizenznachweise und Referenzzustände erfassen. Vor B: Hostfreigabe, SSH-Lesebetrieb und Sichtmodell beschließen. Vor Übernahme aus05: fehlende Typen/Styles/Testabdeckung vervollständigen. Kein Infrastruktur-Betrieb wird aus der Planfreigabe abgeleitet.

Jeder spätere PR nennt Allowed paths, Akzeptanzfälle und tatsächlich ausgeführte Checks; passende Doku/`docs/STATUS.md` wird im selben PR aktualisiert. Neue dauerhafte Doku wird indexiert. Gefrorene Verträge bleiben außerhalb der Änderungsflächen.

## 5. Lokaler Lesedienst über SSH

### Transport und Zugriff: feste private Sicht (Owner-Entscheidung 23.10.2026)

Shu hat die Vorbereitung einer festen Lesesicht über einen geschützten Unix-Socket und SSH ausdrücklich freigegeben. Dies ersetzt den vorgeschlagenen serverseitigen Loopback-TCP-Port. Installation und Aktivierung auf dem VPS bleiben separat; Repository-Code und synthetische Tests sind kein Nachweis einer aktiven Verbindung oder Worker-Isolation.

Der Dienst bindet ausschließlich einen Unix-Socket. Eine geschützte, root-eigene Konfiguration bestimmt die numerische SSH-Forwarder-UID, die feste Sicht und Registry-/Build-Pfade. Linux-Peer-Credentials müssen diese UID bestätigen, bevor HTTP gelesen wird. Die UID bestimmt die berechtigten Registry-Registrierungen; HTTP-Header und Parameter verleihen keine Identität oder Rechte. Mehrbenutzerbetrieb ist nicht P0. Socket-Dateirechte und geschützte Elternverzeichnisse ergänzen diese Grenze; root-äquivalente Prozesse sind damit nicht isoliert.

Der SSH-Client leitet ausschließlich IPv4-`127.0.0.1:8765` an den entfernten Socket weiter. UI und Lese-API haben denselben Origin. Kein öffentlicher Proxy, keine freigegebene Cross-Origin-API und kein zusätzlicher Browser-Token. Der Browser stellt erst nach ausdrücklichem Connect eine Verbindung her. Fremde lokale Webseiten und DNS-Rebinding werden zusätzlich über Host-/Origin-/Fetch-Metadata-Prüfungen begrenzt.

Zusätzlich: feste Host-Allowlist, kein permissives CORS, Ablehnung fremder Origins/Fetch-Metadaten, `no-store`, `nosniff`, `no-referrer` und restriktive CSP. Diese Header ersetzen weder SSH noch die OS-/Sichtgrenze. Lokale Auslieferung lädt keine Toolbar, Analytics, externen Fonts oder Skripte.

### Agent Zero als späteres lokales Werkzeug — Entscheidung in Phase B

Shu plant Agent Zero perspektivisch als Ersatz für Codex im arbeitenden Agentenpfad. Das ändert weder Akteursrollen noch menschliche Freigaben. Prüf-Agent und arbeitender Agent erhalten getrennte OS-Identitäten, Credentials und Berechtigungsprofile: der Prüf-Agent übernimmt niemals die Tool-/Ausführungsrechte des arbeitenden Agenten; Agent Zero erhält keine Audit-Schreib-, Registry-, Schlüssel- oder Freigaberechte. Die heutige Root-Äquivalenz von codex ist weiterhin eine bekannte Grenze, keine fertige Isolation.

Agent Zero läuft im Container, TruthLens auf dem Host. Daher lokales MCP über eine **geschützte interne Host-/Container-Schnittstelle statt stdio**. Kandidaten wie ein eng berechtigter durchgereichter Unix-Socket oder ein isolierter interner Transport werden erst in Phase B geprüft. Container erreichen Host-127.0.0.1 nicht automatisch; kein pauschales Host-Networking, keine öffentliche/0.0.0.0-Bindung und kein privilegierter Container als Abkürzung. Transport, authentifizierte Identität, zulässige Run-Sicht und D34-Prozessgrenze brauchen vor Freigabe eine konkrete Abnahme. Die menschliche Oberfläche bleibt über SSH-Tunnel erreichbar; keine Logins/Seiten für weitere Nutzer, kein öffentlicher Dienst.

Das Agentenwerkzeug soll ausschließlich einen Ergebnisstatus bestanden/nicht bestanden liefern, keine Prüfdetails, Rohereignisse, Berichte, Schlüssel, Pfade oder Beleginhalte. Autorisierte Run-/Sitzungsbindung und Fail-closed-Verhalten bleiben erforderlich. Die Zuordnung des vorhandenen mehrwertigen Auditergebnisses (insbesondere not_checkable/not_applicable, laufender Job oder Verbindungsfehler) zum minimalen Werkzeugvertrag wird **in Phase B entschieden**. Unknown darf weder zu Passed noch zu der falschen Aussage „ein Test ist nachweislich fehlgeschlagen“ werden. Die vollständige menschliche Ansicht behält diese Unterschiede; kein Modell/Chat darf das Prüfurteil erzeugen oder überschreiben.

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

### Artifact Hub als späterer Baustein

Planreferenz: Repo Shuwajaja/artifact-hub. „Hub-Schritt 7“ ist der von Shu benannte Zielpunkt für einen TruthLens-Report-Adapter, keine hier bereits geprüfte oder angeschlossene API. Vor Übernahme: versionierten Quellstand, Lizenz, Schnittstelle und tatsächliche Sicherheitsprüfungen abgleichen. Jetzt keine Repo-/Schema-/Codeänderung und keine Installation/Integration.

- **Portable Berichte:** Über den Report-Adapter lokale HTML-/PDF-Berichte erzeugen. TruthLens-Schemas bleiben unverändert. Herkunft, Datenumfang, vorhandene Prüfbefunde und Grenzen ausdrücklich angeben; der Hub erbt und behauptet niemals verified. HTML/PDF ist eine Ableitung, kein neuer Signatur- oder Freigabenachweis; keine externen Ressourcen oder aktive Berichtsinhalte.
- **Eine sichere Vorschau:** Den passenden Hub-Viewer-Baustein für Belegvorschau wiederverwenden statt eine zweite Engine zu bauen, sofern Lizenz und Schutzumfang passen. HTML nur im opaque sandboxed iframe ohne Skripte, mit restriktiver CSP und blockierten Formularen/Netzverbindungen. TruthLens darf die bestehenden strengeren Schutzregeln nicht verlieren; Phase-A-Vorschau bleibt jetzt unverändert.
- **Importschutz:** Geeignete Hub-Prüfungen gegen Pfadausbruch, Symlinks, Größenüberschreitung und Bild-Bomben für Phase E nutzen. Das bleibt eine zu belegende Wiederverwendung, keine angenommene Sicherheitsgarantie. Vor Dekodierung/Rendering: Mengen-/Byte-/Pixel-/Dekodierlimits und sichere Referenzauflösung; Hub-Checks ersetzen TruthLens-Verifikation und D34 nicht.
- **Optionale lokale Ablage:** Exporte mit SHA-256 im lokalen Hub ablegen und für Agent Zero auffindbar machen; kein öffentlicher Speicher. Digest bedeutet Inhaltsidentität, nicht Signatur, Serverherkunft oder Freigabe. Auffindbarkeit und Leserecht getrennt behandeln: bis zur Phase-B-Entscheidung keine Prüfdetails oder vollständigen TruthLens-Berichte über diesen Umweg an Agent Zero herausgeben. Welche freigegebenen Export-Metadaten/Artefakte es später lesen darf, ist ausdrücklich offen.

## 7. Test- und Abnahmeplan

**Zusätzliche spätere Abnahmen:** Chain mit intakter, gebrochener und nur teilweise geprüfter Kette; keine erfundene Diagnose aus globalem verify-Fehler. Coverage mit leerer/mehrdeutiger Zuordnung und fehlenden Blobs. Gated actions mit Requested/Blocked/Approved/Executed, denied/expired/simulated, fehlender oder verbrauchter Approval und falschem action_hash. Changes mit nur tatsächlich gespeichertem Diff. ClaimedVsProven-Befunde unverändert. Agent report card mit ausreichenden echten Läufen, kleinem/leerem Nenner und unsicherer Agentenidentität.

**Phase E/Hub:** Gültigen und beschädigten Ordner, Hash-only/fehlenden Schlüssel, Traversal/Symlink, Größen-/Dateizahlgrenze, Bild-Bombe, abgebrochenes Lesen und manipuliertes verified testen. Quelle bleibt unverändert; Import erzeugt keine Registry-/Queue-Einträge. Einzeldownloads bytegenau; Bericht/Hub-Digest verleiht kein verified. Sandbox-Denials aus Phase A bei Hub-Wiederverwendung erneut tatsächlich ausführen. MCP-Status darf weder direkt noch über Logs, Fehlermeldungen oder Hub-Links Prüfdetails offenlegen; fremde Container-/Run-Sicht ablehnen. Das sind zukünftige Tests, keine ausgeführten Nachweise.

**Vitest:** Quellen-/Ankertrennung, Deduplizierung nach Quelle/Ziel/Renderer, Close/Pin/Restore/Tablimit, Back/Forward, Speicherfehler, verspätete Antworten, exakte Belegauflösung, Renderer-Fallback, Exportziel nach Tabwechsel, unveränderte Exportbytes, separate Audit-/Approval-Achsen. Kein Reload/Mount darf einen Domaincommand auslösen. Produktionsbuild enthält keine Fixtures und fragt ohne konfigurierte lokale Verbindung keine Quelle an.

**Python-Lesedienst:** Nur geschützten Unix-Socket binden, Peer-UID vor HTTP prüfen; fremde Methoden/Origins/Hostwerte ablehnen; feste Sicht durchsetzen; andere Runs/Session-Kontexte und unregistrierte Pakete verweigern; Traversal, Symlinks, Digestmismatch, übergroße Antworten und unterbrochene Reads. Vor/nach jedem Leseweg Registry-/Run-/Audit-Inhalte und relevante Metadaten vergleichen. Null Subprozess-, Enqueue-, HMAC-Key- oder Schreibzugriffe im Requestpfad nachweisen. Zugriff von tl-agent direkt auf den Dienst muss in der freigegebenen Betriebsumgebung scheitern.

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
- **Import-/Vertrauensverwechslung:** Lokale Ordnerprüfung und SHA-256-Ablage verleihen keine D34-Herkunft, HMAC-Authentifizierung oder menschliche Freigabe. Hub-Bericht und echte Prüffeststellung müssen unterscheidbar bleiben.
- **Agentenkanal:** Status-only MCP und für Agent Zero auffindbare Hub-Exporte können bei ungeklärten Leserechten widersprüchlich werden. Kein Details-Bypass; die Phase-B-Entscheidung bleibt Voraussetzung.
- **Chain-Farbe und Statistik:** Rot bei ungeprüften Links muss sichtbar von bewiesener Manipulation unterschieden werden. Kleine oder verzerrte Laufmengen erlauben kein belastbares Agenten-Zeugnis.

## 9. Offene Fragen an Shu

1. **D34-Betriebsentscheidung, blockierend für Live:** Ist eine einzige feste Shu-Lesesicht der P0-Standard? Welche geprüfte OS-Grenze soll direkte Workerzugriffe auf den Loopback-Dienst verhindern? Ohne diese Entscheidung keine Live-Aktivierung; Mehrbenutzerbetrieb würde einen eigenen Entwurf benötigen.
2. **Design entschieden:** Petrol & Porcelain ist Standard, Cool Graphite Alternative; Plus Jakarta Sans/JetBrains Mono bleiben. Green Deck ist weiterhin Phase F und nicht Bestandteil der Phase-A-Freigabe.
3. **`/audit status`, blockierend für die konkrete Anbindung:** Genügt P0 als lokaler Befehl/Commandbar beziehungsweise bestehende CLI über SSH, oder ist ausdrücklich eine ebenfalls lokal getunnelte Mausbot-Sitzung gemeint? Eine ungeprüfte ACP-Principal-Quelle wird nicht ergänzt.
4. **Exportreihenfolge entschieden:** Einzeldownloads von Ledger, Manifest und vorhandenen Belegen zuerst; ZIP später. „Datei öffnen“ in Phase E bedeutet isolierte lokale Ordnerprüfung, keine D34-Zulassung. „Original“ bezeichnet nur vorhandene Capture-Bytes, nicht unredigierte Ursprungsdateien.
5. **Reuse und Betrieb:** Gibt es eine aktuelle Rechte-/Quellenzuordnung für die gelieferten05-Dateien? Welches RAM-Budget und welcher echte mobile Tunnelweg sollen vor der lokalen Betriebsabnahme gelten?

6. **Phase B, Agent-Zero-Vertrag:** Welcher geschützte Host-/Container-Transport und welcher authentifizierte Run-Kontext gelten? Wie werden not_checkable/not_applicable, laufende Jobs und Verbindungsfehler ohne falsche Passed-/Failed-Behauptung in den Status-only-Vertrag abgebildet?
7. **Hub-Leserechte und Zeugnis:** Darf Agent Zero nur Exportreferenzen/-Metadaten finden, oder auch bestimmte Inhaltsarten lesen? Prüfdetails bleiben bis zur Entscheidung gesperrt. Welche Mindestdatenbasis und autoritative Agentenidentität gelten später für das Agenten-Zeugnis? Hub-Adapter/Viewer/Schutzprüfungen müssen vorher konkret gegen Quellstand und Lizenz geprüft werden.

Bis diese Fragen entschieden sind, ist dies ein prüfbarer Plan mit benannten Grenzen, keine fertige Implementierung oder vorweggenommene Betriebsfreigabe.
