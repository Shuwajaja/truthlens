# Signierdienst auf dem Host

**Nur im Repository vorbereitet. Nichts installiert, gestartet oder aktiviert.**
[English und vollständiges Protokoll](../signer.md).

Der Linux-Dienst `truthlens signer serve --config PATH` läuft als eigener
Benutzer `tl-signer`. Nur dieser darf die HMAC-Schlüsseldatei lesen. Agent Zero
und Mausbot senden Meldungen über einen eingebundenen Unix-Socket; Ledger,
Hashkette, HMAC und Manifest schreibt ausschließlich der Dienst in seinem
privaten Laufverzeichnis. Es gibt keine Kindprozesse und keinen TCP-Listener.

Eine erfolgreiche Signaturprüfung ergibt `authentication=supported` und
`integrity=hmac`. Sie belegt die unveränderte signierte Aufzeichnung und den
zugeordneten Einreicher anhand seiner Zugangsdaten. Sie beweist **nicht**, dass
Agentenaussagen stimmen, Tests ausgeführt wurden, der Bericht vollständig ist
oder ein Mensch zugestimmt hat. **Integrity is not approval.** Ohne beobachtete
Abschlussnachweise bleibt das gesamte Audit `not_checkable` (Exit 2), auch bei
korrekter HMAC-Prüfung. Ein neuer Audit-Status „VERIFIED“ wird nicht eingeführt.

Jedes eingereichte Ereignis landet verschachtelt in `agent.note` unter
`reported_event`, mit `actor.kind=agent`, Caller, Harness und
`provenance: agent-reported`. Auch behauptete Testergebnisse, `approval.granted`
und `criteria.confirmed` werden dadurch weder Nachweise noch Freigaben.
Aufgabe, Kriterien und Zusammenfassung bleiben ebenfalls Agentenmeldungen.
Die eingefrorenen Verträge ändern sich nicht.

## Einrichtung durch den Betreiber (nicht durchgeführt)

1. Paket geschützt unter `/opt/truthlens/venv` installieren. Nicht anmeldbaren
   Benutzer `tl-signer` ohne sudo-/Docker-Rechte und Gruppe `truthlens-callers`
   anlegen. Diese Gruppe ist die primäre Dienstgruppe. Tatsächliche GID statt
   `12345` in den Vorlagen einsetzen; Container-UID-/GID-Mapping prüfen.
2. `/etc/truthlens` samt Unterverzeichnissen `signer/callers` für `tl-signer`
   mit Modus 0700 vorbereiten. Als Dienstbenutzer mit `truthlens key init --out
   /etc/truthlens/hmac.key` einen Schlüssel provisionieren oder einen gesondert
   freigegebenen vorhandenen Schlüssel sicher übernehmen. Schlüssel und
   `.keyring.json`: Eigentümer `tl-signer`, 0600, regulär, ohne weitere Hardlinks.
   Niemals anzeigen, in Umgebungsvariablen setzen oder in Container einbinden.
3. Für beide Harnesses getrennte zufällige Bearer-Tokens erzeugen, ohne sie
   auszugeben. Mindestens 32 Zufallsbytes vor Kodierung, 32–4096 druckbare
   ASCII-Zeichen ohne Leerzeichen. Dienstkopien unter
   `/etc/truthlens/signer/callers/{agent-zero,mausbot}.token`: `tl-signer`, 0600.
   Getrennte Clientkopien unter `/srv/truthlens-client-tokens/`: jeweils nur
   für die zugeordnete Container-MCP-UID lesbar (0600), Host-Elternverzeichnis
   geschützt. Tokens sind keine HMAC-Schlüssel.
4. [Konfiguration](../../deploy/server/signer-config.example.json) nach Prüfung
   als `/etc/truthlens/signer/config.json` installieren (`tl-signer`, 0600).
   Absolute Pfade, Version 1, keine unbekannten Felder; Caller benötigen
   Harnessliste, Authentifizierung und alle vier positiven Quoten. Dateien
   werden begrenzt und ohne Symlinks gelesen. Übergeordnete Verzeichnisse müssen
   root oder dem Dienst gehören und dürfen nicht gruppen-/weltbeschreibbar
   sein (root-eigene Sticky-Tempverzeichnisse für Tests ausgenommen). ACLs prüfen.
5. `/srv/agent-runs/truthlens` als `tl-signer`, 0700 erstellen, Vorfahren schützen.
   [systemd-Vorlage](../../deploy/server/truthlens-signer.service) nach Prüfung
   unter `/etc/systemd/system/` installieren, systemd neu laden und nur mit
   gesonderter Hostfreigabe starten. `RuntimeDirectory` liefert
   `/run/truthlens-signer` (`tl-signer:truthlens-callers`, 0750), Socket 0660.
   Die Vorlage aktiviert nichts und startet nicht automatisch neu.
6. [Compose-Ergänzungen](../../deploy/server/signer-compose.example.yml) in
   **beide** tatsächlichen Dienste übernehmen: Socketverzeichnis und jeweils
   nur eigene Tokenkopie read-only einbinden, Transportgruppe ergänzen.
   Niemals Schlüssel, Dienstkonfiguration, Laufverzeichnis oder Docker-Socket
   freigeben. Reale positive Zugriffe und gegenseitige Zugriffsverbote prüfen.
   Nach Neuerstellung des Runtime-Verzeichnisses Container neu erstellen;
   bestehende Bind-Mounts zeigen sonst auf alte Inodes.
7. In beiden MCP-Launchern `truthlens mcp --signer-socket
   /run/truthlens-signer/signer.sock` und
   `TRUTHLENS_SIGNER_TOKEN_FILE=/run/secrets/truthlens-signer.token` setzen.
   Alternativ `TRUTHLENS_SIGNER_SOCKET` verwenden; CLI hat Vorrang.
   Umgebungsweitergabe des Launchers prüfen. Der Signer-Modus lädt keinen
   HMAC-Schlüssel. Der optionale Lesekatalog bleibt ohne Hostprüfung hash-only.

Werkzeuge: `start_signed_run(harness, task, criteria?)`,
`append_signed_event(run_id, token, event)`,
`finish_signed_run(run_id, token, summary)` und
`signed_run_status(run_id, token)`. Die Rückgabe `token` ist eine separate
Laufberechtigung. Das Caller-Token stammt aus der privaten Clientdatei. Ohne
Signer-Konfiguration bleiben vorhandene MCP-Werkzeuge unverändert.

## Sicherheit und Betriebsgrenzen

`SO_PEERCRED` prüft konfigurierte hostseitige UID und primäre GID. Bei zusätzlich
konfiguriertem Token müssen alle Bedingungen stimmen. Token-only unterstützt
Container mit gemeinsamer UID; getrennte Caller/Tokens trennen Harnesses.
Token-Hashes werden konstantzeitlich verglichen. Unbekannte oder mehrdeutige
Caller und doppelte Tokens werden abgewiesen. Ein gestohlenes Token erlaubt
Meldungen unter diesem Caller; es beweist keine Container- oder Menschenidentität.
Root, Dienstkonto, Kernel, privilegierte Container und Docker-Zugriff liegen
außerhalb der Zusicherung. Gleiche UID ist durch chmod nicht isoliert.
Wer den symmetrischen HMAC-Schlüssel kennt, kann selbst signieren.

Pro Verbindung ein JSON-Objekt plus LF, höchstens 65536 Bytes einschließlich LF,
Timeout 2 Sekunden, serieller Schreiber. Keine Floats, doppelten Schlüssel oder
unbekannten Protokollfelder. Quoten begrenzen Läufe/Stunde, Events/Lauf,
Wire-Bytes/Lauf und Wire-Bytes/Stunde; zusätzlich 20000 authentifizierte
Anfragen pro Caller/Stunde und global 32 offene/fehlgeschlagene Läufe.
Maximal 1024 Laufberechtigungen bleiben im Speicher. Ledger-Payloads bleiben
auf 64 KiB begrenzt. Quoten sind keine Speicherplatzbegrenzung; Aufbewahrung und
Speicher überwachen. Langsame Socket-Clients können andere Anfragen verzögern.

Das Request-Journal enthält nur konfigurierten Caller, Operation und festes
Ergebnis, niemals Inhalte, Zugangsdaten oder Exception-Texte. systemd versieht
es mit Zeitstempeln. Neustart verwirft Tokens, Status und Quoten; vorhandene
fertige Läufe bleiben auf Platte prüfbar. Unfertige Läufe werden nicht automatisch
fortgesetzt. Schreibfehler sperren weitere Änderungen am betreffenden Lauf.
Ein Absturz kann ein fertiges Ledger ohne vollständiges Manifest hinterlassen;
das Audit muss geschlossen fehlschlagen. Keine automatische Wiederholung,
Wiederherstellung oder Bereinigung; verlorene Startantworten können verwaiste
Läufe erzeugen. Temporäre Socket-Tests belegen keine reale Hostisolation.

## Rotation und Sicherung

Der Dienst lädt Schlüssel und Caller-Token-Hashes einmal beim Start. Neue Läufe
anhalten, offene abschließen, Dienst stoppen, als Dienstkonto
`truthlens key rotate --key-file /etc/truthlens/hmac.key` ausführen, danach
neu starten. Laufender Dienst verwendet sonst weiterhin den alten Schlüssel.
Der Keyring behält alte IDs, keine alten Geheimnisse. Alte Läufe ergeben mit
nur dem neuen Schlüssel `not_checkable`/hash-only samt Hinweis. Für frühere
Authentifizierung braucht es gesondert geschützte alte Schlüsselsicherungen.
Bei Tokenrotation Dienst- und Clientkopien ersetzen und beide Seiten neu starten.

Geschützt sichern: Schlüssel **und** `.keyring.json`, Dienstkonfiguration,
Dienst-/Clienttokens samt Eigentümerzuordnung, systemd-/Compose-/MCP-Dateien,
komplette Laufverzeichnisse und Request-Journal. Geheimnisse nicht in
agentenzugänglichen Backups oder Laufartefakten ablegen; transienten Socket
nicht als wiederherstellbaren Dienstzustand behandeln. Wiederherstellung und
Berechtigungen getrennt prüfen. Keine dieser Hostmaßnahmen wurde ausgeführt.
