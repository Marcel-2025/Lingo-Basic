# Lingo Pro

Lingo Pro ist eine clientseitige, offline-fähige Sprachlern-App (Deutsch → EN/ES/FR/RU/IT) mit Lernkarten, Multiple Choice, XP, Streaks, Lernkalender, lokaler Lernhistorie und optionalem Firebase-Cloud-Sync. Sie läuft als Web-App/PWA und per Capacitor als Android-App.

## Architektur

```
app/
  page.tsx                 Komposition: Navigation, Fortschritt, Pack-Laden, Sync
  layout.tsx               Metadata, Manifest, Viewport/Theme-Color
  components/              Tabs (Heute, Übungen, Profil, Settings), AuthModal, UI-Bausteine
  hooks/
    use-progress.ts        Stats/Settings/Insights, LocalStorage-Persistenz, updatedAt
    use-language-pack.ts   Offline-first Pack-Laden (IndexedDB → /packs → Legacy → Cache)
    use-learning-history.ts Lernhistorie per Word-ID + Sprache
    use-auth.ts            Firebase-Sitzung inkl. Wiederherstellung + Token-Refresh
    use-cloud-sync.ts      Merge beim Login, debounced Upload, Retry-Puffer
  lib/
    types.ts               Versioniertes Datenmodell
    languages.ts           Zentrale Sprach-/Level-Konfiguration
    pack-normalization.ts  Einzige Stelle für Pack-Validierung/-Normalisierung
    progress.ts            Normalisierung + konfliktfreier Merge von Fortschritt
    indexed-db.ts          Pack-Cache (Key `${lang}:${level}`)
    firebase-auth.ts       Identity Toolkit + Secure Token + Google Identity Services
    cloud-sync.ts          Firestore REST (`userProgress/{uid}`)
    exercises.ts           UI-unabhängige Übungslogik
    premium.ts             Zentrale Premium-Entscheidung (PREMIUM_FOR_ALL + Entitlement)
    entitlements.ts, billing.ts  Entitlement-Status (userEntitlements/{uid}) und RevenueCat-Checkout
content/master/en/         EN-Master (Quelle für Topic- und Word-IDs)
public/packs/{lang}/{level}.json   Ausgelieferte Packs
scripts/                   Pack-Build und Validierung
tests/                     Vitest-Unit-Tests
```

### Datenmodell und IDs

- Word-IDs folgen `topicId + "_" + Slug` (z. B. `food_01_water`) und sind über alle Sprachen identisch. Textkorrekturen ändern keine IDs.
- Fehlt eine ID, erzeugt `normalizePack` sie aus `topicId` + Slug des **deutschen** Worts (gleich in jeder Sprache, auch für Kyrillisch) und meldet eine Warnung.
- `difficulty` ist numerisch (1/2/3); `easy`/`medium`/`hard` werden normalisiert.
- Legacy-Packs mit flacher `vocab`-Liste werden in ein Thema „Allgemein“ (`general`) überführt.
- Ungültige Packs liefern Fehlermeldungen statt Abstürze.
- Lernfortschritt wird pro **Word-ID + Zielsprache** gespeichert (`masteredWordIds`: `EN:food_01_water`). Ältere Einträge ohne Sprache bleiben gültig.

### Neue Sprache hinzufügen

1. Eintrag in `SUPPORTED_LANGUAGES` (`app/lib/languages.ts`) inkl. BCP-47-Code für die Sprachausgabe und Ergänzung des `LanguageCode`-Typs.
2. Packs unter `public/packs/{code}/{level}.json` mit denselben IDs wie der EN-Master.
3. `npm run validate:packs`.

## Lokaler Start und Prüfungen

```bash
npm install
npm run dev
npm run typecheck      # tsc --noEmit
npm run lint
npm test               # Vitest
npm run validate:packs
npm run build
```

## Content-Wartung

- `node scripts/build-a1-packs.mjs` / `node scripts/build-content-packs.mjs` erzeugen die Packs neu.
- `npm run validate:packs` prüft JSON, Pflichtfelder, doppelte Word-/Sentence-/Topic-IDs, Difficulty-Werte, Platzhalter-Beispielsätze, Zielsprachen-Übersetzungen von Sätzen und die ID-Konsistenz gegenüber dem EN-Master (mit Dateiname und JSON-Pfad).
- Entwürfe (z. B. KI-generiert) vor der Übernahme prüfen: `node scripts/validate-packs.mjs --file pfad/zum/draft.json`. Generierte Inhalte gehören erst nach Review nach `public/packs`.

Hinweis: Die früheren automatisch erzeugten A1-Beispielsätze („Wasser ist wichtig im Thema …“) wurden entfernt, weil sie keinen Lernwert hatten. `ex`/`exTr` sind optional und sollten mit echten Sätzen neu gepflegt werden.

## Firebase und Google Login (optional)

Kopiere `.env.example` nach `.env.local` und setze die Werte nur dort:

```bash
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_GOOGLE_CLIENT_ID=
# Premium für alle, solange Billing nicht live ist; "false" erzwingt echte Entitlements
NEXT_PUBLIC_PREMIUM_FOR_ALL=true
```

Billing/RevenueCat-Variablen und Entitlements: siehe [docs/monetization.md](docs/monetization.md). Die Premium-Entscheidung läuft ausschließlich über `getEffectiveEntitlement` in `app/lib/premium.ts`.

Ohne diese Werte läuft die App vollständig im Gastmodus.

Einrichtung:

1. Firebase Authentication: Provider **E-Mail/Passwort** und **Google** aktivieren; Entwicklungs- und Produktionsdomain unter *Authorized domains* eintragen.
2. Google Cloud Console → OAuth-Client (Web): alle Origins (z. B. `http://localhost:3000`, Produktionsdomain) als *Authorized JavaScript origins* eintragen. Fehlt eine Origin, meldet die App `origin_mismatch` verständlich.
3. Firestore anlegen und die Regeln aus [docs/firestore.rules](docs/firestore.rules) deployen.

Sitzungen: Gespeichert werden nur `localId`, E-Mail, Anzeigename, ID-Token, Refresh-Token und Ablaufzeit. Das ID-Token wird fünf Minuten vor Ablauf über `securetoken.googleapis.com` mit dem Refresh-Token erneuert; bei 401/403 von Firestore wird einmal erzwungen erneuert. Ein Offline-Start meldet niemanden ab.

## Cloud-Sync

- Dokument `userProgress/{uid}` mit `schemaVersion`, `statsJson`, `settingsJson`, `learningInsightsJson`, `updatedAt`.
- Beim Login werden lokaler und Cloud-Stand **zusammengeführt**: Settings vom neueren Stand, Lernhistorie (Tage, Wörter, gemeisterte IDs) als Vereinigung, Zähler (XP, Antworten, gelernte Wörter) als Maximum, Streak vom Stand mit dem späteren Aktivitätsdatum. Es werden keine Daten still gelöscht.
- Änderungen werden lokal sofort gespeichert und nach 1,2 s in die Cloud geschrieben. Fehlgeschlagene Uploads bleiben „ausstehend“ (Marker in LocalStorage überlebt Neustarts) und werden mit Backoff, beim Wiederherstellen der Verbindung oder per „Erneut versuchen“ nachgeholt.

## Offline und PWA

- `public/manifest.webmanifest`, Icons 192/512, Apple-Touch-Icon, Metadata in `app/layout.tsx`.
- `public/sw.js` cached nur die App-Shell und die gehashten `/_next/static`-Assets und wird nur im Production-Build registriert. Packs liegen ausschließlich in IndexedDB, damit es keinen zweiten Pack-Cache gibt.
- Für Capacitor wird `output: "export"` benötigt. Achtung: Die API-Routen aus `app/api/` (Entitlement-Restore, RevenueCat-Webhook) sind mit einem statischen Export nicht kompatibel und müssen dafür separat (z. B. auf Vercel) gehostet werden.
