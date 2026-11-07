# Lingo Pro – native App (Expo / React Native)

Native Android- und iOS-App von Lingo Pro. Gleiches Design wie die Web-App (Tailwind-Klassen über NativeWind, gleiche Theme-Verläufe Ocean/Sunset/Lime/Grape), aber echte native Oberfläche statt WebView.

## Aufbau

```
mobile/
  src/app/               Screens (Expo Router)
    (tabs)/index.tsx     Heute – Lernkarten
    (tabs)/uebungen.tsx  Übungen – Multiple Choice
    (tabs)/profil.tsx    Profil – Stats, Kalender, gelernte Wörter, Achievements
    (tabs)/settings.tsx  Settings – Sprache/Level/Theme, Erinnerungen, Pack-Import, Sicherung/Löschen
    privacy.tsx          Datenschutzerklärung
  src/state/             App-Zustand (Fortschritt, Sync) und Sprachpaket
  src/lib/               Speicher, Feedback, Erinnerungen, gebündelte Packs
```

Die Lernlogik wird **nicht dupliziert**: Normalisierung, Packs, Fortschritt/Merge, Übungen und Lernhistorie kommen aus `../app/lib` (gemeinsam mit der Web-App), die Sprachpakete aus `../public/packs` (werden in die App eingebaut → komplett offline).

- App-ID: `dev.flondy.lingo.pro` (Android und iOS), Name „Lingo Pro“ (`dev.flondy.lingo` ist bei Google Play gesperrt und kann nicht wiederverwendet werden)
- **Kein Login, kein Server:** Fortschritt liegt nur auf dem Gerät (AsyncStorage). Sicherung als JSON-Datei über Settings → Deine Daten (Export per Teilen-Dialog, Import mit Merge). Der frühere Firebase-Login liegt in der Git-Historie (Commit vor „Remove login“), falls er wieder gebraucht wird.

## Entwickeln

```bash
cd mobile
npm install
npx expo run:android        # baut eine Dev-Build-App und startet sie auf Gerät/Emulator
npm start                   # nur Metro starten (Dev-Build schon installiert)
npm run typecheck && npm run lint
```

Expo Go reicht nicht (native Module für Audio, Benachrichtigungen, Reanimated) – es wird immer ein Development Build verwendet.

Die App bündelt alle Inhalte aus `content/vokabeln.csv`, `content/saetze.csv` und `content/themen.csv` (alle 10 Sprachen) in `mobile/src/content/words.json`. Nach dem Bearbeiten der CSVs im Repo-Root `node scripts/generate-mobile-content.mjs` ausführen. Basis- und Zielsprache werden erst in der App kombiniert (App-Sprache = Basis).

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

- Apple Developer Program (kostenpflichtig, jährlich) und in App Store Connect eine App mit Bundle-ID `dev.flondy.lingo.pro` anlegen.
- Build + Upload: `npx eas-cli@latest build --platform ios --profile production` und `npx eas-cli@latest submit --platform ios` – oder in Xcode über Product → Archive.

## Tablets

- Ab 600 dp kürzerer Bildschirmseite gilt ein Gerät als Tablet (`src/lib/responsive.ts`). Tablets drehen frei, Handys bleiben im Hochformat.
- Querformat: Navigationsleiste links, kompakter Kopf, einklappbare Seitenleiste (Heute: Tagesziel, Sitzung, Themen, Wortliste, Beispielsätze; Übungen: Serie, Treffer, letzte Antworten), Profil und Settings zweispaltig.
- Hochformat: Navigation unten, Inhalt mittig mit maximaler Breite; Lernkarten bleiben bewusst kompakt (max. 520 dp).
- Lernhilfen: Richtung DE ↔ Zielsprache, automatisches und langsames Vorlesen, Wort aus der Liste als Nächstes lernen, Wortbilder.

## Spiel, Motivation, Erinnerungen

- **Deine Stadt** (Tab „Stadt“, Logik in `app/lib/city.ts`, geteilt mit der Web-App): 13 Gebäude mit je 3 Stufen, jedes an Lernthemen gebunden. Münzen: 5 XP = 1 Münze, jedes gelernte Wort = 3 Münzen, dazu Tagesaufgaben und Streak-Truhe. Gebäude brauchen gelernte Wörter aus ihrem Thema **und** Münzen. Nach 2 Tagen ohne Lernen „schläft“ die Stadt (nur optisch). Stand wird in `learningInsights.city` gespeichert und beim Sync zusammengeführt (höhere Stufe gewinnt).
- **Lernpfad** (`app/lib/lessons.ts`, getestet; `src/components/learning-path.tsx`, `src/app/lesson.tsx`): jedes Thema in Lektionen à 5 Wörter, die nacheinander freigeschaltet werden. Lektion = 5 neue Wörter + Quiz (Wort wählen, Bedeutung wählen, Hören); Fehler kommen am Ende wieder. Abschluss mit Sternen (0/≤2/mehr Fehler = 3/2/1), +20 XP Bonus, XP-Levelbalken und Serien-Flamme. Sterne in `learningInsights.lessons` (Backup-Merge: beste Wertung). „Freies Üben“ = die bisherigen Lernkarten.
- **Tagesaufgaben**: 3 pro Tag, deterministisch aus dem Datum, erledigen sich automatisch.
- **Feiern** (`src/components/celebration.tsx`, Reanimated): Vollbild mit Konfetti bei Level-Up, Serie, Gebäude, Truhe; Aufgaben und Tagesziel nur als kleiner Hinweis oben (blockiert die Karten nicht), während einer Lektion pausiert; animierte Streak-Flamme im Kopf.
- **Erinnerungen** (`src/lib/reminders.ts`, expo-notifications, nur lokal): 1–4× täglich (Standard 3×: 9:00, 13:00 und Wunschzeit), die nächsten 7 Tage als Einzel-Benachrichtigungen geplant; nach erreichtem Tagesziel ist für heute Ruhe, abends Serien-Warnung. Karte „Erinnerungen einschalten?“ auf dem Lernpfad. Einstellungen unter Settings → Tägliche Erinnerung. Android-Kanal „lernen“, Icon `assets/notification-icon.png`.

## Käufe (Premium, Herzen, Münzen)

Abwicklung **direkt über die Stores** mit `expo-iap`: Google Play Billing auf Android, StoreKit auf iOS – kein Drittanbieter, kein eigener Server. Logik in `src/lib/purchases.ts` (Premium = aktives Abo oder Lifetime aus `getAvailablePurchases`, Premium-Käufe werden bestätigt/acknowledged, Herzen/Münzen werden über `setConsumableHandler` im `CityProvider` genau einmal gutgeschrieben und dann verbraucht), Regeln in `app/lib/lives.ts` und `app/lib/premium-benefits.ts` (getestet).

| Produkt-ID | Typ | Vorschlag |
| --- | --- | --- |
| `lingopro_premium_monthly` | Abo, monatlich | 2,99 € |
| `lingopro_premium_yearly` | Abo, jährlich | 19,99 € |
| `lingopro_premium_lifetime` | Einmalkauf (nicht verbrauchbar) | 34,99 € |
| `lingopro_hearts_pack` | Einmalkauf, verbrauchbar | 0,99 € – volle Herzen + 10 extra |
| `lingopro_coins_pack` | Einmalkauf, verbrauchbar | 1,99 € – 1500 Münzen |

Premium: unendlich Leben, +50 % XP/Münzen, Streak-Schutz (2 verpasste Tage/Monat), Stadt-Dekorationen (mit Münzen). Leben gibt es nur im Übungsmodus: 5 Herzen, alle 30 Minuten eines zurück; Lernkarten bleiben immer frei.

Einrichtung:
1. Play Console → Monetarisierung → Produkte: die fünf Produkte mit genau diesen IDs anlegen (Abos mit Basisplan, Einmalkäufe als „In-App-Produkt“); App muss mindestens einmal im internen Test hochgeladen sein.
2. App Store Connect → In-App-Käufe: dieselben IDs (später, für iOS).
3. Abos in der Play Console: je ein **Basisplan** (monatlich bzw. jährlich, automatisch verlängernd). Die App nimmt automatisch das Angebot des Basisplans; Einführungsangebote sind optional.
4. Testen: Lizenztester in der Play Console eintragen, Build aus dem internen Test installieren.

Play-Richtlinien: Preise/Abo-Laufzeit werden im Shop aus dem Store geladen, Kündigungshinweis und „Abo verwalten“ sind eingebaut, Käufe wiederherstellen ebenfalls.

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

Ohne Login sind keine Signatur-Hashes in Firebase nötig.

Lokal (Android): `npx expo prebuild --platform android` und dann `cd android && ./gradlew assembleRelease` (Windows: `gradlew.bat`). Der Release-Build ist dabei mit dem Debug-Schlüssel signiert – nur zum Testen, nicht für den Store.

## Store-Hinweise

- Keine Konten: Für die Play-Prüfung ist unter „App-Zugriff“ „Alle Funktionen ohne Anmeldung verfügbar“ anzugeben. Datenlöschung in der App (Settings → Deine Daten) und Datenschutzerklärung sind vorhanden.
- Keine Käufe, keine Werbung, kein Werbe-ID-Zugriff (`AD_ID` ist blockiert). Store-Eintrag darf nichts anderes versprechen.
- iOS: Ohne Drittanbieter-Login ist „Mit Apple anmelden“ nicht erforderlich.
