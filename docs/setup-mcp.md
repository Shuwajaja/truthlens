# TruthLens einrichten / Set up TruthLens

This page is for someone setting up TruthLens on their own machine.
The German guide comes first. The English guide repeats the same three steps.

TruthLens does not store your key. It stores only the name of an environment
variable, `TRUTHLENS_HMAC_KEY`. Without that variable, a verdict stays
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

Wähle einen Ordner für deine Läufe. Den Schlüssel erzeugst du selbst und
lässt ihn in der Umgebung. Schreibe ihn nicht in eine Datei und nicht in
den Chat.

```bash
export TRUTHLENS_HMAC_KEY='eigener-schluessel'
```

Ohne diesen Schlüssel bleibt das Urteil **unklar**.

### 3. Eintrag hinzufügen

Frage die Nutzerin oder den Nutzer, bevor eine Konfigurationsdatei geschrieben wird.
`truthlens setup --write` legt vorher eine `.bak` der vorhandenen Datei an.

```bash
truthlens setup --agent codex --root /path/to/local/runs --key-env TRUTHLENS_HMAC_KEY --write
truthlens doctor
```

Die erste Zeile von `truthlens doctor` ist die Ergebniszeile, zum Beispiel
`RESULT root=ok key=present entries=1`. Sie enthält keinen Schlüssel und
keinen Dateiinhalt.

### Beispiele zum Kopieren

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

Pick a directory for runs. Create the key yourself and leave it in the
environment. Do not put it in a file or in the chat.

```bash
export TRUTHLENS_HMAC_KEY='your-own-key'
```

Without that key the verdict stays **UNKNOWN** (unklar).

### 3. Add the entry

Ask the user before writing any config file.
`truthlens setup --write` copies an existing file to `.bak` first.

```bash
truthlens setup --agent codex --root /path/to/local/runs --key-env TRUTHLENS_HMAC_KEY --write
truthlens doctor
```

The first line from `truthlens doctor` is the result line, for example
`RESULT root=ok key=present entries=1`. It has no key and no file contents.

### Copy-paste examples

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
