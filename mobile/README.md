# Lingua – native App (Expo / React Native)

Native Android- und iOS-App von Lingo Pro. Gleiches Design wie die Web-App (Tailwind-Klassen über NativeWind, gleiche Theme-Verläufe Ocean/Sunset/Lime/Grape), aber echte native Oberfläche statt WebView.

## Aufbau

```
mobile/
  src/app/               Screens (Expo Router)
    (tabs)/index.tsx     Heute – Lernkarten
    (tabs)/uebungen.tsx  Übungen – Multiple Choice
    (tabs)/profil.tsx    Profil – Stats, Kalender, gelernte Wörter, Achievements
    (tabs)/settings.tsx  Settings – Sprache/Level/Theme, Pack-Import, Konto (inkl. Löschen)
    login.tsx            E-Mail/Passwort, Google, Telefon (SMS)
    privacy.tsx          Datenschutzerklärung
  src/state/             App-Zustand (Fortschritt, Sync) und Sprachpaket
  src/lib/               Firebase (React Native Firebase), Speicher, Feedback, gebündelte Packs
```

Die Lernlogik wird **nicht dupliziert**: Normalisierung, Packs, Fortschritt/Merge, Übungen und Lernhistorie kommen aus `../app/lib` (gemeinsam mit der Web-App), die Sprachpakete aus `../public/packs` (werden in die App eingebaut → komplett offline).

- App-ID: `dev.flondy.lingua` (Android und iOS), Name „Lingua“
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
- iOS: Wer „Mit Google anmelden“ anbietet, muss laut App Review Guideline 4.8 auch „Mit Apple anmelden“ anbieten. Das ist vor einer App-Store-Einreichung noch einzubauen.
