# Inhalte von Lingo Pro

Alle Sprachpakete werden aus diesen zwei Tabellen erzeugt. Beide lassen sich direkt in Excel öffnen (Semikolon, UTF-8).

| Datei | Inhalt |
| --- | --- |
| `vokabeln.csv` | ein Wort pro Zeile, alle Sprachen nebeneinander |
| `saetze.csv` | Beispielsätze pro Level |

## Spalten in `vokabeln.csv`

| Spalte | Bedeutung |
| --- | --- |
| `level` | Content-Level: A1, A2, B1 (B2, C1, C2 möglich) |
| `thema_id`, `thema`, `thema_icon` | Thema, z. B. `food_01`, „Essen & Trinken“, 🍎 |
| `thema_lernmodus` | Schwierigkeit des Themas: 1 Einfach, 2 Mittel, 3 Schwer |
| `wort_id` | eindeutige ID, nur a–z, 0–9, `_` (gleiche ID = gleiches Wort in allen Sprachen) |
| `lernmodus` | Schwierigkeit des Worts: 1 Einfach, 2 Mittel, 3 Schwer (Settings → Lernmodus) |
| `tags` | Stichwörter, mit Komma getrennt |
| `de` | deutsches Wort |
| `en`, `es`, `fr`, `it`, `ru` | Übersetzung je Zielsprache; leer = Wort fehlt in dieser Sprache |
| `beispiel_<sprache>`, `beispiel_de` | optional: Beispielsatz in der Zielsprache und auf Deutsch |
| `bild` | vorhandenes Bild (wird beim Export eingetragen) |
| `bild_prompt` | was ComfyUI malen soll (Englisch); `-` = kein Bild |

## Ablauf zum Erweitern

```powershell
node scripts/content.mjs export     # aktuelle Packs → CSV (überschreibt die CSVs)
# CSV in Excel bearbeiten: Zeilen/Wörter/Sprachspalten ergänzen, speichern als "CSV UTF-8 (Trennzeichen-getrennt)"
node scripts/content.mjs check      # prüfen (Fehler und fehlende Übersetzungen)
node scripts/content.mjs import     # CSV → public/packs + App-Packs neu erzeugen

# Bilder mit ComfyUI (START_ComfyUI.bat vorher starten)
S:\ArtIsFantasy-AI-Studio\app\ComfyUI_windows_portable\python_embeded\python.exe scripts\generate_word_images.py --limit 10
node scripts/generate-mobile-packs.mjs
```

Eine neue Sprache braucht zusätzlich einen Eintrag in `app/lib/languages.ts` (Name und Sprachausgabe-Code).
