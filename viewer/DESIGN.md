# TruthLens Viewer – Design-Regelwerk („Midnight Command“)
Für alle Agenten (Codex u. a.). Ziel-Ort im Repo: `viewer/DESIGN.md`. Vorlage: `vorschlag-v3.html` (nach Shus Zielbild `refs/shu-zielbild.png`).
Leitidee: **Kontrollraum für Beweise.** Dicht, ruhig, präzise. Farbe heißt immer etwas; sonst ist alles Grau/Weiß.

## 1. Tokens (einzige Farbquelle: `src/theme.css`)
| Token | Hex | Bedeutung |
|---|---|---|
| `--bg` | #070A0D | Seitenhintergrund |
| `--surface` | #0F151B | Hover, Zitat-/Detailflächen |
| `--surface-2` | #161E26 | aktive Tabs, Popover |
| `--border` | #22303A | alle 1px-Linien |
| `--text` | #E6EDF3 | Haupttext, Zahlen (15:1) |
| `--text-2` | #A9B4C2 | Erklärtext (8.5:1) |
| `--text-3` | #8592A3 | Meta, Labels, Zeiten (≥5:1) – nie für Inhalt |
| `--ok` | #3FCF8E | belegt / Test bestanden. „verified/HMAC geprüft“ **nur** bei `verified:true` |
| `--brand` | #22C55E | ausschließlich Logo: Auge/Haken und „Truth“; nie Status, Navigation oder Fokus |
| `--fail` | #FF7B72 | fehlgeschlagen, unmet, Exit ≠ 0 |
| `--info` | #79B8FF | Fokus, Links, Datei-/Artefakt- und Kriterien-Ereignisse (Vorgang, kein Urteil) |
| `--neutral` | #97A3B3 | **offen / pending / unbelegt / Review nötig**, „Nur Hash“-Siegel, System-Ereignisse |
Keine Hex-Werte außerhalb `theme.css`. Kein Tailwind `amber/green/red/...`. **Kein Orange/Gelb im Status-System.** Status = Grün (belegt/bestanden/verified), Rot (fehlgeschlagen/widerspricht), Grau (alles andere). Farbe nie allein: immer + Wort/Form.

## 2. Schrift
Fonts: Inter (Text), JetBrains Mono (Zahlen, IDs, Zeiten, Labels). Mono immer mit `tabular-nums`.
| Größe | Einsatz |
|---|---|
| 12 | Labels (Mono, CAPS, +0.08em), Meta, Pills, Zeiten, Hash |
| 14 | Standardtext, Tabellen, Zeitachse |
| 16 | Abschnittstitel (600), Urteilssatz |
| 20 | Mobil-Titel, Mobil-Zähler |
| 28 | Lauf-Titel (600), Ledger-Zähler (Mono 600) |
Gewichte nur 400 (Text) / 500 (Labels, Pills, aktive Nav) / 600 (Titel, Zahlen). Zeilenhöhe 1.5, Titel 1.25.

## 3. Abstände & Form
Raster 4px: 4/8/12/16/24/32. Panels: `--surface`, 1px `--border`, Radius 8, Innenabstand 14/16, Abstand 12–16. Pills/Siegel Radius 4. Icon-Kreise 28px (Timeline/Drawer), 36px (Graph). Keine Schatten.

## 4. Status-Pills & Siegel
- Pill: Mono 12/600 CAPS, 1px Rahmen + 10% Füllung in Statusfarbe: `PASSED/BELEGT` grün, `FAILED/UNMET` rot, `REVIEW/PENDING/OFFEN` grau.
- Siegel (gestrichelt, grau): „◇ Nur Hash · HMAC nicht geprüft“ und „Integrität ≠ fachliche Freigabe“ – immer sichtbar (Desktop: Kopf der Übersicht; Mobil: „Nur Hash“-Siegel im Kopf + volle Texte im Drawer).
- Grünes „Integrity Verified“-Siegel **nur** bei `verified:true`.
- Don't: Grün für exit 0, „Agent fertig“, „Healthy“. Don't: Rot für „unbelegt“ (das ist grau).

## 5. Layout & Signatur (Desktop ≥ 1024)
1. **Berg-Header** 150px: Logo-Schild + „TruthLens“ (28/600, „Truth“ `--brand`, „Lens“ weiß) + Tagline (Mono-CAPS); rechts „Belege · Transparenz · Vertrauen“ + „Belege statt Behauptungen.“
2. **Sidebar links** 200px (Übersicht, Behauptet vs. belegt, Zeitachse, Agent-Verlauf; Export-Hinweis). Aktiv: Innenkante in `--info` (Vorgang, kein Prüfergebnis).
3. **Status-Karten** (4): Gesamtstatus, Kriterien belegt X/Y, Fehlgeschlagen, Unbelegt – jeweils Punkt+Mono-Label, Wert 28/600. **Sparklines nur bei ≥ 2 Läufen** mit echten Werten; sonst weglassen.
4. **Läufe-Liste** mit Status-Pill; bei 1 Lauf Detaildaten (Start/Ende/Dauer/Exit) + ehrlicher Leerzustand.
5. **Code-Diff** (Mono 12, Zeilennr., +-Spalte grün); Pill „nicht signiert“ grau statt „Verified change“.
6. **Beleg-Schublade** rechts 300px, sticky; Tabs Übersicht/Tests/Artefakte/Zeit; Liste aus Icon-Kreis + Titel + Kurzbeleg.
7. **Detail-Panel (Node-Editor-Stil)**: Schlüssel/Wert-Liste des gewählten Kriteriums/Knotens + Status-Pill.

## Responsive (≤ 760px, eigenes Layout statt geschrumpft)
- Kompakter Kopf 52px (kleines Logo + „Nur Hash“-Siegel), **kein Berg-Header**.
- Reihenfolge: Urteil/Status-Karten (2×2) → Läufe → Beleg-Ledger/Kriterien → Zeitachse → Diff → Detail.
- Graph als **Liste** (Kriterium ← Aussage/Test + Status), kein Canvas.
- **Untere Tab-Leiste** (64px, 4 Tabs) statt Sidebar; Inhalt hat 84px Abstand unten.
- Beleg-Schublade als **Bottom-Sheet** (Griff oben, Radius 16 oben), öffnet beim Tippen auf Lauf/Kriterium.
- Werte 20 statt 28; nie Text < 12.

## 6. Zeitachse
Vertikale Schiene (1px), Icon-Kreis 28px je Ereignis (▶ Start, ✎ Auftrag, ✓/✕ Test, ◆ Datei, " Aussage, ● Ende). Farbe nach Typ: run.* neutral · requirement/criterion info · agent.claim neutral · evidence/artifact info · test.reported ok/fail nach Zahlen. Phasen „01 Auftrag“ / „02 Ergebnis“ mit Startzeit + Dauer; Zeiten relativ (`+251 ms`). Pausen > 1 s als graue Zeile „··· Agent arbeitet 20,2 s ···“. Gleichartige Claims bündeln (aufklappbar). Developer-Lens: seq/type/actor als Mono-Meta. Klick → Drawer.
## 7. Beleg-Graph
Knoten min. Schrift 12, Rahmen `--border`; Claim/Kriterium ohne Beleg: gestrichelter grauer Rahmen; Kanten: grün = belegt, rot = widerspricht, grau gestrichelt = ohne Beleg; Legende oben rechts; ok/fail-Punkt am Kriterium. Kein Grün an Knoten ohne verknüpften Test.

## 8. Ehrlichkeit (nicht verhandelbar)
- Nie „verified“, „HMAC geprüft“ oder `--ok` für Integrität ohne `verified:true`.
- „Nur Hash · HMAC nicht geprüft“ und „Integrität ≠ fachliche Freigabe“ immer sichtbar.
- Nur echte Felder aus dem RunDoc anzeigen; keine Platzhalter-Zahlen, keine erfundenen Trends.
- Zeiten in Lokalzeit mit Zonenkürzel (z. B. MESZ) oder relativ.

## 9. Logo
Quelle: `logo/logo-wortmarke.jpg` (Schild + Auge + Haken, „Truth“ grün, „Lens“ weiß) und `logo/logo-icon.jpg`. Als saubere SVGs nachbauen: `viewer/public/logo-wordmark.svg`, `logo-icon.svg`; daraus `favicon.svg`, `favicon.ico` (32), `apple-touch-icon.png` (180). Einsatz: Berg-Header (Wortmarke), Sidebar-Kopf + Mobil-Kopf (Icon).

Logo-Grün ist ausschließlich `--brand` #22C55E. „Truth“, Auge und Haken verwenden `--brand`; „Lens“ und Schildkontur verwenden `--text`/Weiß. `--brand` darf nirgends sonst eingesetzt werden: keine Status-Pills, Ergebnisse, Graph-Kanten, Navigation oder Fokusmarkierungen. Status-Grün bleibt `--ok` #3FCF8E für echte Ergebnisse (belegt/bestanden; Integrität nur bei `verified:true`). Alle Farbwerte kommen aus `src/theme.css`; eigenständig darstellbare SVG-/ICO-/PNG-Dateien werden daraus generiert.
