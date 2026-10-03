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
    use-auth.ts            Firebase-Sitzung (onIdTokenChanged)
    use-cloud-sync.ts      Merge beim Login, debounced Upload, Retry-Puffer
  lib/
    types.ts               Versioniertes Datenmodell
    languages.ts           Zentrale Sprach-/Level-Konfiguration
    pack-normalization.ts  Einzige Stelle für Pack-Validierung/-Normalisierung
    progress.ts            Normalisierung + konfliktfreier Merge von Fortschritt
    indexed-db.ts          Pack-Cache (Key `${lang}:${level}`)
    firebase.ts            Firebase-Initialisierung (App, Auth, Firestore)
    firebase-auth.ts       E-Mail, Google, Telefon (JS SDK + native Capacitor-Plugin)
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

## Firebase-Backend (Projekt `lingo-basic`)

Firebase ist optional: Ohne Konfiguration läuft die App vollständig im Gastmodus. Mit Konfiguration nutzt sie das **Firebase JS SDK (v12, modular)** für Authentication und Cloud Firestore.

| Datei | Zweck |
|-|-|
| `app/lib/firebase.ts` | Initialisierung von App, Auth (IndexedDB-Persistenz) und Firestore (Offline-Cache) |
| `app/lib/firebase-auth.ts` | E-Mail/Passwort, Google, Telefonnummer; deutsche Fehlermeldungen |
| `app/lib/cloud-sync.ts` | Lesen/Schreiben von `userProgress/{uid}` |
| `firebase.json`, `.firebaserc` | CLI-Konfiguration: Auth-Provider, Firestore-Regeln, Datenbank-Region `eur3` |
| `firestore.rules` | Sicherheitsregeln (nur der Besitzer darf seine Daten lesen/schreiben) |
| `android/app/google-services.json` | Konfiguration der Android-App `dev.flondy.lingo` |

### Anmeldemethoden

- **E-Mail/Passwort**: JS SDK auf allen Plattformen.
- **Google**: im Browser per Popup; in der Android-App nativ über `@capacitor-firebase/authentication` (Credential Manager). Das native ID-Token wird per `signInWithCredential` an das JS SDK übergeben (`skipNativeAuth`).
- **Telefonnummer**: im Browser mit unsichtbarem reCAPTCHA, in der Android-App nativ (Play Integrity, SMS-Auto-Erkennung). Nummern im deutschen Format (`0151 …`) werden nach E.164 (`+49151…`) umgewandelt.

Das JS SDK ist die einzige Quelle der Sitzung: Token-Refresh, Offline-Start und Logout funktionieren überall gleich.

### Einrichtung

`.env.example` nach `.env.local` kopieren und die Werte der Web-App „Lingo-Basic“ eintragen (`npx -y firebase-tools@latest apps:sdkconfig WEB <APP_ID>`):

```bash
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
# Premium für alle, solange Billing nicht live ist; "false" erzwingt echte Entitlements
NEXT_PUBLIC_PREMIUM_FOR_ALL=true
```

Backend-Konfiguration deployen (E-Mail/Passwort, Google, Firestore-Regeln):

```bash
npx -y firebase-tools@latest deploy --only auth,firestore
```

Nur in der Firebase-Konsole möglich:

- **Telefon-Login aktivieren**: Authentication → Sign-in method → Phone.
- **Web-Domain freigeben**: Authentication → Settings → Authorized domains (z. B. die Vercel-Domain).

Android-Signatur: Debug-Builds verwenden `android/app/lingo-debug.keystore` (SHA-1 `2E:9B:4A:E3:AB:5E:16:43:88:A6:13:7F:46:18:90:EE:53:87:62:EF`, in Firebase hinterlegt). Für Play-Store-Releases muss der SHA-1/SHA-256 des Release- bzw. Play-App-Signing-Schlüssels zusätzlich hinterlegt werden.

Billing/RevenueCat-Variablen und Entitlements: siehe [docs/monetization.md](docs/monetization.md). Die Premium-Entscheidung läuft ausschließlich über `getEffectiveEntitlement` in `app/lib/premium.ts`.

## Cloud-Sync

- Firestore-Dokument `userProgress/{uid}` (Firebase SDK, Offline-Cache) mit `schemaVersion`, `statsJson`, `settingsJson`, `learningInsightsJson`, `updatedAt`.
- Beim Login werden lokaler und Cloud-Stand **zusammengeführt**: Settings vom neueren Stand, Lernhistorie (Tage, Wörter, gemeisterte IDs) als Vereinigung, Zähler (XP, Antworten, gelernte Wörter) als Maximum, Streak vom Stand mit dem späteren Aktivitätsdatum. Es werden keine Daten still gelöscht.
- Änderungen werden lokal sofort gespeichert und nach 1,2 s in die Cloud geschrieben. Fehlgeschlagene Uploads bleiben „ausstehend“ (Marker in LocalStorage überlebt Neustarts) und werden mit Backoff, beim Wiederherstellen der Verbindung oder per „Erneut versuchen“ nachgeholt.

## Offline und PWA

- `public/manifest.webmanifest`, Icons 192/512, Apple-Touch-Icon, Metadata in `app/layout.tsx`.
- `public/sw.js` cached nur die App-Shell und die gehashten `/_next/static`-Assets und wird nur im Production-Build registriert. Packs liegen ausschließlich in IndexedDB, damit es keinen zweiten Pack-Cache gibt.
- Für Capacitor wird `output: "export"` benötigt. Achtung: Die API-Routen aus `app/api/` (Entitlement-Restore, RevenueCat-Webhook) sind mit einem statischen Export nicht kompatibel und müssen dafür separat (z. B. auf Vercel) gehostet werden.
