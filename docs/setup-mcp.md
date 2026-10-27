# TruthLens einrichten / Set up TruthLens

This page is for someone setting up TruthLens on their own machine.
The German guide comes first. The English guide repeats the same three steps.
Private key-file creation and checking require POSIX file permissions and locking.

TruthLens can create your signing key in a private file. Keep it outside agent
access. MCP configuration stores only its path, or the legacy environment variable name
`TRUTHLENS_HMAC_KEY`, never the key bytes. Without an available key, a verdict stays
**unklar** / **UNKNOWN**. `TRUE` / bestätigt and `FALSE` / widerlegt need
HMAC. That is TL-003. Integrity is not approval.

## Deutsch

### 1. Installieren

Du brauchst Python 3.12 oder neuer. Im Checkout:

```bash
python3 -m venv .venv
. .venv/bin/activate
pip install -e .
```

### 2. Ordner und eigener Schlüssel

Wähle einen Ordner für deine Läufe. Erzeuge deinen eigenen Schlüssel:

```bash
truthlens key init
```

Der Standardpfad ist `~/.config/truthlens/hmac.key`, mit `XDG_CONFIG_HOME`
entsprechend `$XDG_CONFIG_HOME/truthlens/hmac.key`. Der Befehl zeigt nur Pfad,
Schlüssel-ID und Verwendungshinweis. Er erzeugt 32 zufällige Bytes und speichert
sie hexkodiert im bestehenden Schlüsseldateiformat (nicht selbst dekodieren).
Datei: Modus `0600`; neu angelegte Ordner: `0700`.

```bash
truthlens key init --out /etc/truthlens/hmac.key --key-id server-1
truthlens key rotate --key-file /etc/truthlens/hmac.key --key-id server-2
```

Das Serverbeispiel setzt einen passenden privaten Ordner und die Berechtigung
des TruthLens-Prozessbenutzers voraus. Vorhandene Schlüssel werden nur mit
`--force` ersetzt. Bei Verlust: `truthlens key init --force`, oder bei einem
anderen Pfad `truthlens key init --out /etc/truthlens/hmac.key --force`.
Zum geplanten Austausch dient `key rotate`. Alte Schlüsselbytes werden nicht
aufbewahrt. Alte Läufe sind danach nicht mehr authentisierbar und zeigen
**UNKNOWN / unklar**, bei bekannter alter ID mit dem Grund
`signed with retired key <id>; key no longer available`. Eine beschädigte
Hash-Kette scheitert weiterhin. Die Datei `hmac.key.keyring.json` neben dem
Schlüssel enthält nur aktuelle und ausgemusterte IDs; bewahre sie dort auf.
Bei fehlenden Metadaten kann die alte ID nicht als ausgemustert benannt werden.

Der Schlüssel muss außerhalb von Agent-Ordnern, Containern, Lauf-Ordnern und
Repos liegen, zum Beispiel `/etc/truthlens/hmac.key` auf einem Server. Nur der
TruthLens-Prozessbenutzer darf ihn lesen (`chmod 600`). Agenten sollen TruthLens
um Signieren oder Prüfen bitten und den Schlüssel niemals selbst lesen.
Dateirechte schützen nicht vor einem Agenten mit derselben UID; dafür ist ein
separater Benutzer bzw. eine geprüfte Isolation nötig. Diese Anleitung richtet
keine Isolation und keinen Server ein.

`truthlens run --out <run-dir> --repo <repo> --hmac-key-file <key-path> -- <command>`
übernimmt bei erzeugten Schlüsseldateien die ID automatisch.
`truthlens audit <run-dir> --hmac-key-file <key-path> --json` prüft den HMAC;
`authentication=supported` / `integrity=hmac` bedeutet geprüfte Signatur,
unabhängig vom inhaltlichen Ergebnis. Fehlender alter Schlüssel ergibt
`authentication=not_checkable` und **UNKNOWN**. Integrität ist keine Freigabe.

### 3. Eintrag hinzufügen

Frage die Nutzerin oder den Nutzer, bevor eine Konfigurationsdatei geschrieben wird.
`truthlens setup --write` legt vorher eine `.bak` der vorhandenen Datei an.

```bash
truthlens setup --agent codex --root /path/to/local/runs --hmac-key-file ~/.config/truthlens/hmac.key --write
truthlens doctor
```

Die erste Zeile von `truthlens doctor` ist die Ergebniszeile, zum Beispiel
`RESULT root=ok key=present entries=1`. Sie enthält keinen Schlüssel und
keinen Dateiinhalt.

MCP und Setup akzeptieren `--hmac-key-file PATH` oder
`TRUTHLENS_HMAC_KEY_FILE=PATH`. Die Datei hat Vorrang vor `--hmac-key-env VAR`
(bei Setup auch `--key-env VAR`) und `TRUTHLENS_HMAC_KEY`. Ein ungültiger
Dateipfad fällt nicht auf die Umgebungsvariable zurück. Bei `XDG_CONFIG_HOME`
verwende den von `key init` ausgegebenen Pfad. Nach einem Austausch laufende
MCP-Prozesse neu starten, damit sie den neuen Schlüssel laden.
`setup --write` und `doctor` empfehlen `truthlens key init`, wenn kein
verwendbarer Schlüssel konfiguriert ist; sie erzeugen selbst keinen Schlüssel.

### Beispiele zum Kopieren

Die folgenden älteren Umgebungsvarianten bleiben unterstützt; für eine Datei
ersetze `--key-env TRUTHLENS_HMAC_KEY` durch `--hmac-key-file <key-path>`.
Agenten dürfen den Wert der Umgebungsvariable ebenfalls nicht lesen.

Codex schreibt nach `~/.codex/config.toml`:

```bash
truthlens setup --agent codex --root /path/to/local/runs --key-env TRUTHLENS_HMAC_KEY --print
```

```toml
[mcp_servers.truthlens]
command = "truthlens"
args = ["mcp", "--hmac-key-env", "TRUTHLENS_HMAC_KEY"]
env_vars = ["TRUTHLENS_HMAC_KEY"]

[mcp_servers.truthlens.env]
TRUTHLENS_ROOT = "/path/to/local/runs"
```

Claude Code schreibt nach `~/.claude.json` (`mcpServers`):

```bash
truthlens setup --agent claude-code --root /path/to/local/runs --key-env TRUTHLENS_HMAC_KEY --print
```

Gemini und agy schreiben nach `~/.gemini/settings.json` (`mcpServers`):

```bash
truthlens setup --agent gemini --root /path/to/local/runs --key-env TRUTHLENS_HMAC_KEY --print
```

Cursor schreibt nach `~/.cursor/mcp.json` (`mcpServers`):

```bash
truthlens setup --agent cursor --root /path/to/local/runs --key-env TRUTHLENS_HMAC_KEY --print
```

Agent Zero benutzt `mcp_servers`. TruthLens rät den Ordner nicht.
Setze `TRUTHLENS_AGENT_ZERO_SETTINGS` oder übergib `--config`.

```bash
truthlens setup --agent agent-zero --root /path/to/local/runs --key-env TRUTHLENS_HMAC_KEY --config /path/to/settings.json --write
```

Mausbot benutzt `mcpServers`. Übergib den Dateipfad mit `--config`
oder `TRUTHLENS_MAUSBOT_CONFIG`.

```bash
truthlens setup --agent mausbot --root /path/to/local/runs --key-env TRUTHLENS_HMAC_KEY --config /path/to/mausbot.json --write
```

JSON-Eintrag für Claude Code, Gemini, Cursor und Mausbot:

```json
{
  "mcpServers": {
    "truthlens": {
      "command": "truthlens",
      "args": ["mcp", "--hmac-key-env", "TRUTHLENS_HMAC_KEY"],
      "env": {"TRUTHLENS_ROOT": "/path/to/local/runs"}
    }
  }
}
```

Agent Zero verwendet denselben Eintrag unter `mcp_servers`.

### Konfigurations-Prompt

Diesen Text kannst du einer lokalen Coding-Agentin geben.
`truthlens setup --prompt` druckt die englische Fassung.
Er enthält keinen Schlüssel und keinen echten Pfad.

Frage die Nutzerin oder den Nutzer, bevor eine Konfigurationsdatei geschrieben wird.
Schreibe oder zeige den Schlüsselwert nie. Nur der Variablenname ist erlaubt.

1. Installiere TruthLens (Python 3.12+) aus einem geprüften Checkout: `pip install -e .`
2. Frage nach dem lokalen Lauf-Ordner.
3. Nach dem Ja:

```bash
truthlens setup --agent codex --root <path> --key-env TRUTHLENS_HMAC_KEY --write
```

Der Befehl macht zuerst eine `.bak`. Ohne gesetztes `TRUTHLENS_HMAC_KEY`
bleibt das Urteil unklar. Danach `truthlens doctor` ausführen und die
`RESULT`-Zeile zurückmelden.

Dieselbe Form gilt für `claude-code`, `gemini`, `cursor` und `agent-zero`.

## English

### 1. Install

You need Python 3.12 or newer. From a checkout:

```bash
python3 -m venv .venv
. .venv/bin/activate
pip install -e .
```

### 2. Directory and your own key

Pick a directory for runs, then create your own signing key:

```bash
truthlens key init
```

The default is `~/.config/truthlens/hmac.key`, or
`$XDG_CONFIG_HOME/truthlens/hmac.key` when set. Output contains only the path,
key ID and a usage hint. The command generates 32 random bytes and writes their
hex encoding in the existing key-file format; do not decode it yourself.
Files are `0600`; newly created directories are `0700`.

```bash
truthlens key init --out /etc/truthlens/hmac.key --key-id server-1
truthlens key rotate --key-file /etc/truthlens/hmac.key --key-id server-2
```

The server example requires a private directory writable by the TruthLens
process user. Existing keys cannot be overwritten without `--force`.
Lost key: run `truthlens key init --force`, or for a custom path,
`truthlens key init --out /etc/truthlens/hmac.key --force`. Use `key rotate` for
a planned replacement. Old secrets are not retained. Old runs can no longer be
authenticated and show **UNKNOWN**, with the reason
`signed with retired key <id>; key no longer available` when the old ID is known.
A broken hash chain still fails. Keep the adjacent `hmac.key.keyring.json`:
it records current and retired IDs only. Without that metadata the old ID cannot
be named as retired. Rotation requires a file initialized by `key init`;
replace legacy files with `key init --out <key-path> --force`.

The key must live outside agent folders, containers, run folders and repos,
for example `/etc/truthlens/hmac.key` on a server. Only the TruthLens process
user should be able to read it (`chmod 600`). Agents should ask TruthLens to
sign or verify, never read the key themselves. File permissions cannot isolate
an agent running under the same UID; use a separate user and a reviewed
isolation boundary. These commands do not configure isolation or deploy services.

`truthlens run --out <run-dir> --repo <repo> --hmac-key-file <key-path> -- <command>`
uses a generated file's key ID automatically.
`truthlens audit <run-dir> --hmac-key-file <key-path> --json` checks its HMAC;
`authentication=supported` / `integrity=hmac` means the signature was verified,
independently of the content verdict. An unavailable old key gives
`authentication=not_checkable` and **UNKNOWN**. Integrity is not approval.

### 3. Add the entry

Ask the user before writing any config file.
`truthlens setup --write` copies an existing file to `.bak` first.

```bash
truthlens setup --agent codex --root /path/to/local/runs --hmac-key-file ~/.config/truthlens/hmac.key --write
truthlens doctor
```

The first line from `truthlens doctor` is the result line, for example
`RESULT root=ok key=present entries=1`. It has no key and no file contents.

MCP and setup accept `--hmac-key-file PATH` or
`TRUTHLENS_HMAC_KEY_FILE=PATH`. Files take precedence over `--hmac-key-env VAR`
(setup also accepts `--key-env VAR`) and `TRUTHLENS_HMAC_KEY`. An invalid file
never falls back to the environment secret. With `XDG_CONFIG_HOME`, use the
path printed by `key init`. Restart running MCP processes after replacement so
they load the new key. `setup --write` and `doctor` suggest `truthlens key init`
when no usable key is configured; they do not create a key themselves.

### Copy-paste examples

The legacy environment examples below remain supported; to use a file,
replace `--key-env TRUTHLENS_HMAC_KEY` with `--hmac-key-file <key-path>`.
Agents must not read the environment secret either.

Codex writes `~/.codex/config.toml`:

```bash
truthlens setup --agent codex --root /path/to/local/runs --key-env TRUTHLENS_HMAC_KEY --print
```

Claude Code writes `~/.claude.json` (`mcpServers`):

```bash
truthlens setup --agent claude-code --root /path/to/local/runs --key-env TRUTHLENS_HMAC_KEY --print
```

Gemini and agy write `~/.gemini/settings.json` (`mcpServers`):

```bash
truthlens setup --agent gemini --root /path/to/local/runs --key-env TRUTHLENS_HMAC_KEY --print
```

Cursor writes `~/.cursor/mcp.json` (`mcpServers`):

```bash
truthlens setup --agent cursor --root /path/to/local/runs --key-env TRUTHLENS_HMAC_KEY --print
```

Agent Zero uses `mcp_servers`. TruthLens does not guess the folder.
Set `TRUTHLENS_AGENT_ZERO_SETTINGS` or pass `--config`.

```bash
truthlens setup --agent agent-zero --root /path/to/local/runs --key-env TRUTHLENS_HMAC_KEY --config /path/to/settings.json --write
```

Mausbot uses `mcpServers`. Pass `--config` or `TRUTHLENS_MAUSBOT_CONFIG`.

```bash
truthlens setup --agent mausbot --root /path/to/local/runs --key-env TRUTHLENS_HMAC_KEY --config /path/to/mausbot.json --write
```

### Config prompt

Give this to a local coding agent (Codex, Claude Code, Gemini/agy, Cursor,
or Agent Zero). `truthlens setup --prompt` prints it. It has no key and no
real path.

Ask the user before writing any config file.
Never write or print the key value. Only the env var name is allowed.

1. Install TruthLens (Python 3.12+) from a reviewed checkout: `pip install -e .`
2. Ask the user for the local runs directory.
3. After the user agrees, run:

```bash
truthlens setup --agent codex --root <path> --key-env TRUTHLENS_HMAC_KEY --write
```

That write makes a `.bak` of an existing file first.
The user sets `TRUTHLENS_HMAC_KEY` in their own environment.
Without that key, verdicts stay unklar / UNKNOWN.

4. Run `truthlens doctor` and report the RESULT line.

Use `--agent claude-code`, `--agent gemini`, `--agent cursor`, or
`--agent agent-zero` for the other harnesses.
`truthlens setup --prompt --agent claude-code` prints one harness only.
