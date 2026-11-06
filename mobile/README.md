# Lingo Pro – native App (Expo / React Native)

Native Android- und iOS-App von Lingo Pro. Gleiches Design wie die Web-App (Tailwind-Klassen über NativeWind, gleiche Theme-Verläufe Ocean/Sunset/Lime/Grape), aber echte native Oberfläche statt WebView.

## Aufbau

```
mobile/
  src/app/               Screens (Expo Router)
    (tabs)/index.tsx     Heute – Lernkarten
    (tabs)/uebungen.tsx  Übungen – Multiple Choice
    (tabs)/profil.tsx    Profil – Stats, Kalender, gelernte Wörter, Achievements
    (tabs)/settings.tsx  Settings – Sprache/Level/Theme, Pack-Import, Konto (inkl. Löschen)
    login.tsx            Apple (nur iOS), Google, E-Mail/Passwort, Telefon (SMS)
    privacy.tsx          Datenschutzerklärung
  src/state/             App-Zustand (Fortschritt, Sync) und Sprachpaket
  src/lib/               Firebase (React Native Firebase), Speicher, Feedback, gebündelte Packs
```

Die Lernlogik wird **nicht dupliziert**: Normalisierung, Packs, Fortschritt/Merge, Übungen und Lernhistorie kommen aus `../app/lib` (gemeinsam mit der Web-App), die Sprachpakete aus `../public/packs` (werden in die App eingebaut → komplett offline).

- App-ID: `dev.flondy.lingua` (Android und iOS), Name „Lingo Pro“ (App-ID bleibt `dev.flondy.lingua`, weil `dev.flondy.lingo` bei Google Play gesperrt ist)
- Firebase-Projekt `lingo-basic`: Android-App `1:788312123831:android:073de227681704c118e032`, iOS-App `1:788312123831:ios:b19df74cb9cc1c6b18e032`
- `google-services.json` / `GoogleService-Info.plist` liegen hier und werden beim Prebuild eingebunden.

## Entwickeln

```bash
cd mobile
npm install
npx expo run:android        # baut eine Dev-Build-App und startet sie auf Gerät/Emulator
npm start                   # nur Metro starten (Dev-Build schon installiert)
npm run typecheck && npm run lint
```

Expo Go reicht nicht (native Firebase-Module) – es wird immer ein Development Build verwendet.

Neue Sprache oder neues Level: JSON unter `public/packs/{lang}/{level}.json` ablegen, dann im Repo-Root `node scripts/generate-mobile-packs.mjs` ausführen.

## Auf dem Mac weiterarbeiten (iOS)

Einmalig einrichten:

1. **Xcode** aus dem Mac App Store installieren, einmal öffnen (Komponenten installieren lassen) und unter Xcode → Settings → Accounts mit der Apple-ID anmelden.
2. **Homebrew** (https://brew.sh), dann `brew install node watchman cocoapods`.
3. Repo klonen: `git clone https://github.com/Marcel-2025/Lingo-Basic.git` und `git checkout live-version`.

App auf Simulator oder iPhone starten:

```bash
cd Lingo-Basic/mobile
npm install
npx expo run:ios                 # Simulator
npx expo run:ios --device        # angeschlossenes iPhone (einmalig in Xcode Signing-Team wählen)
```

Der Ordner `ios/` wird von `expo prebuild` erzeugt und ist nicht im Repo – Änderungen an nativen Einstellungen gehören in `app.json`, nicht in Xcode. `npm run prebuild` erzeugt ihn bei Bedarf neu.

Vor dem ersten App-Store-Upload:

- Apple Developer Program (kostenpflichtig, jährlich) und in App Store Connect eine App mit Bundle-ID `dev.flondy.lingua` anlegen.
- Firebase: Anbieter **Apple** aktivieren. Für Telefon-Login auf iOS zusätzlich einen APNs-Schlüssel (Apple Developer → Keys) in Firebase → Projekteinstellungen → Cloud Messaging hochladen; ohne ihn fällt Firebase auf eine reCAPTCHA-Prüfung zurück.
- Build + Upload: `npx eas-cli@latest build --platform ios --profile production` und `npx eas-cli@latest submit --platform ios` – oder in Xcode über Product → Archive.

## Tablets

- Ab 600 dp kürzerer Bildschirmseite gilt ein Gerät als Tablet (`src/lib/responsive.ts`). Tablets drehen frei, Handys bleiben im Hochformat.
- Querformat: Navigationsleiste links, kompakter Kopf, einklappbare Seitenleiste (Heute: Tagesziel, Sitzung, Themen, Wortliste, Beispielsätze; Übungen: Serie, Treffer, letzte Antworten), Profil und Settings zweispaltig.
- Hochformat: Navigation unten, Inhalt mittig mit maximaler Breite; Lernkarten bleiben bewusst kompakt (max. 520 dp).
- Lernhilfen: Richtung DE ↔ Zielsprache, automatisches und langsames Vorlesen, Wort aus der Liste als Nächstes lernen, Wortbilder.

## Spiel, Motivation, Erinnerungen

- **Deine Stadt** (Tab „Stadt“, Logik in `app/lib/city.ts`, geteilt mit der Web-App): 13 Gebäude mit je 3 Stufen, jedes an Lernthemen gebunden. Münzen: 5 XP = 1 Münze, jedes gelernte Wort = 3 Münzen, dazu Tagesaufgaben und Streak-Truhe. Gebäude brauchen gelernte Wörter aus ihrem Thema **und** Münzen. Nach 2 Tagen ohne Lernen „schläft“ die Stadt (nur optisch). Stand wird in `learningInsights.city` gespeichert und beim Sync zusammengeführt (höhere Stufe gewinnt).
- **Tagesaufgaben**: 3 pro Tag, deterministisch aus dem Datum, erledigen sich automatisch.
- **Feiern** (`src/components/celebration.tsx`, Reanimated): Konfetti und Karte bei Level-Up, Tagesziel, Serie, Aufgabe, Gebäude, Truhe; animierte Streak-Flamme im Kopf.
- **Erinnerungen** (`src/lib/reminders.ts`, expo-notifications, nur lokal): tägliche Nachricht zur Wunschzeit, abends Serien-Warnung, wenn heute noch nicht gelernt wurde. Einstellungen unter Settings → Tägliche Erinnerung. Android-Kanal „lernen“, Icon `assets/notification-icon.png`.

## Inhalte und Bilder

600 Wörter (A1/A2/B1 × 10 Themen × 20) in 9 Sprachen mit Beispielsätzen; Vokabeln, Lernmodus und Level werden in `content/vokabeln.csv` gepflegt (Anleitung: `content/LIESMICH.md`).
Wortbilder erzeugt `scripts/generate_word_images.py` mit dem lokalen ComfyUI; danach `node scripts/generate-mobile-packs.mjs`.

## Builds für die Stores

Empfohlen ist EAS (Cloud-Builds, auch iOS ohne Mac):

```bash
npx eas-cli@latest login
npx eas-cli@latest build --platform android   # AAB für Google Play
npx eas-cli@latest build --platform ios       # IPA für App Store / TestFlight
```

Wichtig: EAS signiert mit eigenen Schlüsseln. Deren SHA-1/SHA-256 (sowie der Play-App-Signing-Schlüssel aus der Play Console) müssen in Firebase bei der Android-App eingetragen werden, sonst funktioniert der Google-Login nur im Debug-Build.

Lokal (Android): `npx expo prebuild --platform android` und dann `cd android && ./gradlew assembleRelease` (Windows: `gradlew.bat`). Der Release-Build ist dabei mit dem Debug-Schlüssel signiert – nur zum Testen, nicht für den Store.

## Store-Hinweise

- Kontolöschung in der App (Settings → Konto) und Datenschutzerklärung (Settings, Login) sind vorhanden – Pflicht bei Google Play und Apple.
- Keine Käufe, keine Werbung, kein Werbe-ID-Zugriff (`AD_ID` ist blockiert). Store-Eintrag darf nichts anderes versprechen.
- iOS: „Mit Apple anmelden“ ist eingebaut (Guideline 4.8, Pflicht neben Google-Login). In Firebase muss dafür unter Authentication → Sign-in method der Anbieter **Apple** aktiviert werden.
