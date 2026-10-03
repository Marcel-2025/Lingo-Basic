## Summary

Stabilisiert Lingo Pro als offline-first App mit optionalem Cloud-Sync, ohne Rewrite. Enthält außerdem den Merge von `main` (Premium/Entitlement-Basis), damit der PR konfliktfrei ist.

**Cloud-Sync & Auth**
- Merge statt „Last write wins“: Lernhistorie wird vereinigt, Zähler (XP/Antworten) per Maximum, Settings vom neueren Stand → keine stillen Datenverluste (`app/lib/progress.ts`)
- Debounced Upload, persistenter „ausstehend“-Marker, Retry mit Backoff, bei `online`-Event und per Button (`app/hooks/use-cloud-sync.ts`)
- Token-Refresh vor Ablauf + erzwungener Refresh bei 401/403; Offline-Start meldet nicht mehr ab (`app/lib/firebase-auth.ts`, `app/hooks/use-auth.ts`)
- Google: One-Tap mit Moment-Auswertung (`origin_mismatch` / `unregistered_origin`), offizieller Button als Fallback, Abbrechen

**Daten & Packs**
- Zentrale Normalisierung für beschädigte LocalStorage-/Firestore-Daten, Migration von `toDateString()`-Daten, zeitzonensichere Streaks
- Lernfortschritt pro Word-ID **und** Zielsprache (Legacy-Einträge bleiben gültig)
- Importierte Packs werden nicht mehr vom Projekt-Pack überschrieben; klare „Level nicht verfügbar“-Meldungen; „Alle Packs löschen“
- Fallback-IDs aus deutschem Slug (sprachübergreifend gleich)
- Platzhalter-Beispielsätze („… ist wichtig im Thema …“) aus A1 entfernt; Validator erkennt sie, prüft Satzübersetzungen, fehlende Dateien und hat einen `--file`-Review-Modus für Entwürfe

**UI**
- Sound/Vibration abschaltbar, `aria-live`-Feedback, eindeutige MC-Optionen, Timer-Cleanup
- Profil: Kalender mit Monats-/Gesamtstatistik, Heute-Markierung, lesbare Themennamen, neue Achievements
- Settings: Pack-Status (Netz/Cache/Import), Logout klar beschriftet, Sync-Status mit Retry

**Premium**
- Eine Entscheidungsstelle `getEffectiveEntitlement` (`app/lib/premium.ts`). `NEXT_PUBLIC_PREMIUM_FOR_ALL` (Default `true`) hält alle Nutzer auf Premium, bis Billing live ist; `false` aktiviert die Free-Limits aus `main`.

**PWA**: App-Shell-Cache wird aktualisiert, SW nur im Production-Build, Manifest mit `id`/`scope`.

## Testing
- `npx tsc --noEmit` ✅
- `npm run lint` ✅
- `npm test` (Vitest, 55 Tests) ✅
- `node scripts/validate-packs.mjs` ✅
- `npm run build` ✅ (auch mit `output: "export"` geprüft – vor dem Merge von main)
- Playwright-E2E gegen Production-Build mit gemocktem Firebase (23/23 ✅): Gastmodus, Themenwechsel, Karte, XP, MC richtig/falsch, Kalender, Wortliste, Sprache/Level, IndexedDB-Keys, fehlendes Pack, kaputte JSON, Import-Persistenz, kaputter LocalStorage, Offline-Neustart, E-Mail-Login, Cloud-Merge, Sync-Puffer + Retry, Token-Refresh, Google-Fehlermeldung

Nicht getestet: echtes Firebase/Google-Projekt, echte Android-Geräte.

## Hinweise
- Firestore-Regeln: `docs/firestore.rules` deployen
- Die API-Routen aus `main` (`app/api/*`) sind nicht mit `output: "export"` (Capacitor) kompatibel

🤖 Generated with [Claude Code](https://claude.com/claude-code)

https://claude.ai/code/session_01VX1m5vGRdURzcopXuf1Y3i
