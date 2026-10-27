# TruthLens

Prüft, was KI-Coding-Agenten behaupten.

Die englische Übersicht steht in der [README](../../README.md).
Diese Seite ist der deutsche Einstieg. Sie richtet nichts auf einem Server ein
und speichert keinen Schlüssel.

## Wozu

Ein Agent kann sagen, die Tests seien grün, eine Datei sei geändert oder ein
Fehler sei behoben. TruthLens behält die Aufzeichnung und zeigt, welche
Behauptung die Aufzeichnung stützt. Eine gestützte Behauptung ist keine
Freigabe. Integrität ist keine Freigabe.

## Wie die Prüfung arbeitet

1. Die CLI zeichnet Befehl, Ausgaben, Dateiänderungen, Testberichte und
   Behauptungen auf.
2. Geheimnisse werden vor dem Hashen durch `[REDACTED]` ersetzt. Die Ereignisse
   bilden eine Hash-Kette. Ein optionaler HMAC-Schlüssel bleibt bei der
   Person und steht nicht im Ledger.
3. Die Prüfung rechnet die Kette nach und, wenn ein Schlüssel da ist, den HMAC.
   Eine gebrochene Kette scheitert geschlossen. Nur ein Hash ist keine
   Authentisierung.
4. Bestätigt und widerlegt gibt es nur mit HMAC. Ohne HMAC bleibt das Ergebnis
   unklar, auch wenn die gespeicherte Zusammenfassung bestätigt oder widerlegt
   lautet. Der Browser rechnet den HMAC nicht.

In der Oberfläche und bei `truthlens runs list` heißen die Wörter
bestätigt, widerlegt und unklar. Bericht und Katalog-MCP sagen `TRUE`,
`FALSE` und `UNKNOWN`.

## Schnellstart

Im Checkout, mit Python 3.12 oder neuer, ohne Installation und ohne Schlüssel:

```bash
PYTHONPATH=src python3 -m truthlens report demo/runs/demo-2
PYTHONPATH=src python3 -m truthlens verify demo/runs/demo-2/ledger.jsonl
```

Erwartet werden `c1 met`, `c2 unmet` und `c3 unverified`. Die Ledger-Prüfung
meldet `OK 16 events, anchored`. Beide Befehle prüfen Hashes. Sie
authentisieren die Aufzeichnung nicht.

### Eigenen Harness einrichten

Der Platzhalter `/path/to/local/runs` ist kein echter Ordner. Den Schlüssel
setzt du selbst. TruthLens speichert nur den Namen der Variable.

```bash
python3 -m venv .venv
. .venv/bin/activate
pip install -e .
truthlens setup --agent cursor --root /path/to/local/runs --key-env TRUTHLENS_HMAC_KEY --print
truthlens doctor
```

`--print` schreibt keine Datei. `--write` legt vorher eine `.bak` an.
Frage, bevor eine Konfigurationsdatei geschrieben wird. Ohne
`TRUTHLENS_HMAC_KEY` bleibt das Urteil unklar. Dieselben Flags gelten für
`codex`, `claude-code`, `gemini`, `agent-zero` und `mausbot`. Agent Zero und
Mausbot brauchen `--config`.

Die Kopiervorlagen und der Konfigurations-Prompt stehen auf der
[Einrichtungsseite](../setup-mcp.md#deutsch).

## MCP

`truthlens mcp` liest `TRUTHLENS_ROOT` und spricht JSON-RPC auf stdio.
Es öffnet keinen Socket und schreibt nicht. Die Werkzeuge sind `list_runs`,
`get_run`, `verify_run` und `doctor`. `TRUE` und `FALSE` nur bei HMAC.
`truthlens mcp-status` ist ein anderer Dienst und liefert nur einen Status.

## Lizenz

[MIT](../../LICENSE).
