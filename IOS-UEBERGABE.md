# Lingo Pro – iOS-Release auf dem Mac (Übergabe)

Stand: 7. November 2026, Version **1.2.2**, iOS-Build **2**. Android ist dieselbe Codebasis (Versionscode 5).
Dieses Dokument ist die Anleitung für den Claude-Chat auf dem Mac. Es beschreibt nur, was dort noch zu tun ist –
der App-Code ist fertig und für iOS vorbereitet.

## Projekt

- Repo: `Lingo-Basic`, Branch `live-version`, App im Ordner **`mobile/`** (Expo SDK 57, React Native 0.86, Expo Router, NativeWind, Reanimated).
- Bundle-ID: **`dev.flondy.lingo.pro`** · Name: **Lingo Pro** · Version 1.2.2 · Build-Nummer in `mobile/app.json` → `expo.ios.buildNumber` (bei jedem Upload +1).
- `eas.json`: `appVersionSource: "local"` – Version und Build-Nummer kommen **immer aus app.json**, nicht von EAS.
- Kein Login, kein Backend, kein Firebase. Fortschritt nur lokal (AsyncStorage). Käufe direkt über StoreKit/Google Play mit `expo-iap` – **kein RevenueCat**, kein Server.
- 10 UI-Sprachen (`mobile/src/i18n/`), `CFBundleLocalizations` ist in app.json gesetzt.
- Privacy Manifest (`expo.ios.privacyManifests`) ist in app.json gesetzt: UserDefaults CA92.1, FileTimestamp C617.1, SystemBootTime 35F9.1, DiskSpace E174.1; erhobene Daten: nur Kaufverlauf (App-Funktionalität), nicht verknüpft, kein Tracking.
- `ITSAppUsesNonExemptEncryption: false` ist gesetzt (keine Export-Compliance-Frage).
- Kein Mikrofon, keine Kamera, kein Standort. Benachrichtigungen nur lokal (expo-notifications, Berechtigung erst beim Einschalten der Erinnerung).

## Voraussetzungen auf dem Mac (prüfen)

1. Xcode (aktuelle Version aus dem App Store) inkl. iOS-Plattform, `xcode-select -p` zeigt auf Xcode.
2. Node 20+ und CocoaPods (`brew install cocoapods` oder `sudo gem install cocoapods`).
3. Apple-Developer-Konto (Flondy / Marcel Single) in Xcode → Settings → Accounts angemeldet.
4. Repo auf dem Mac aktuell: `git pull` auf `live-version` (Marcel pusht vorher vom Windows-PC).

## Weg A – lokal mit Xcode (empfohlen, volle Kontrolle)

```bash
cd Lingo-Basic/mobile
npm install
npx expo prebuild --platform ios --clean     # erzeugt mobile/ios aus app.json (nie von Hand ändern)
cd ios && pod install && cd ..
open ios/LingoPro.xcworkspace                 # Name ggf. anders – die .xcworkspace im ios-Ordner öffnen
```

In Xcode:
1. Target **LingoPro** → *Signing & Capabilities* → Team = Marcels Team, „Automatically manage signing“ an. Bundle-ID muss `dev.flondy.lingo.pro` sein.
2. Capability **In-App Purchase** hinzufügen (StoreKit, für expo-iap).
3. Oben Gerät „Any iOS Device (arm64)“ wählen → *Product → Archive*.
4. Im Organizer: *Distribute App → App Store Connect → Upload*.
5. Test vorher: einmal auf dem iOS-Simulator starten (`npx expo run:ios`) und Lernkarten, Übungen, Stadt, Einstellungen (Sprache wechseln, Akzent/Himmel), Profil-Name und Sicherung exportieren durchklicken.

## Weg B – EAS Build (Cloud, ohne Xcode-Signing-Gefummel)

```bash
cd Lingo-Basic/mobile
npx eas-cli@latest login                      # Expo-Konto von Marcel
npx eas-cli@latest init --id 10c01564-dc86-48ee-adf0-b25649c26132   # falls noch nicht verknüpft
npx eas-cli@latest build -p ios --profile production
npx eas-cli@latest submit -p ios --latest     # vorher in eas.json submit.production.ios.ascAppId eintragen
```
EAS fragt nach dem Apple-Login und legt Zertifikat + Provisioning Profile selbst an.

## App Store Connect (einmalig anlegen)

- *Meine Apps → +* → Neue App: Plattform iOS, Name **„Lingo Pro – Vokabeln lernen“** (falls vergeben: „Lingo Pro: Vokabeltrainer“), Primärsprache Deutsch, Bundle-ID `dev.flondy.lingo.pro`, SKU z. B. `lingopro-ios`.
- **Datenschutz-URL**: `https://marcel-2025.github.io/Lingo-Pro/privacy.html` (deckt iOS bereits ab).
- **Support-URL**: `https://marcel-2025.github.io/Lingo-Pro/` · Marketing-URL optional.
- **Kategorie**: Bildung (sekundär: Spiele/Lernspiele optional, lieber leer lassen).
- **Altersfreigabe**: alle Fragen „Nein“/„Keine“ → 4+. Bei „In-App-Käufe“ ja.
- **App-Datenschutz („Nutritional Label“)**: „Daten werden erhoben“ → nur *Käufe → Kaufverlauf* (App-Funktionalität, nicht mit Identität verknüpft, kein Tracking). Keine Geräte-ID, sonst nichts. Muss zum Privacy Manifest in app.json passen.
- **Exportkonformität**: entfällt (ITSAppUsesNonExemptEncryption = false).
- **App-Prüfung**: Kein Login → „Anmeldung erforderlich“ aus. Hinweis an Prüfer: „Keine Anmeldung nötig. Alle Lerninhalte sind kostenlos; Premium ist optional (Abo oder Einmalkauf).“

### Texte (de-DE und en-US)
Komplett in `_lingo-pro-release/store-texte.md` (Windows-PC) bzw. im Play-Store-Eintrag – gleiche Texte verwenden:
- Untertitel (max. 30): DE „Vokabeln lernen & Stadt bauen“ · EN „Learn words, build your city“
- Werbetext (max. 170): DE „Lerne Vokabeln in 10 Sprachen, halte deine Serie und baue mit jedem Wort deine eigene Stadt. Ohne Konto, offline, ohne Werbung.“ · EN „Learn vocabulary in 10 languages, keep your streak and grow your own city with every word. No account, offline, no ads.“
- Keywords (max. 100, ohne Leerzeichen nach Komma): DE `vokabeln,sprachen,englisch,spanisch,lernen,karteikarten,wortschatz,französisch,italienisch,türkisch` · EN `vocabulary,flashcards,languages,german,spanish,french,learn,words,italian,turkish`
- **Keine** Keyword-Blöcke in der Beschreibung, keine erfundenen Zahlen/Bewertungen (das hat bei Google zur Sperre der alten App geführt).

### Screenshots (fertig, echte App-Oberfläche)
Liegen auf dem Windows-PC in `Google Play Console\Lingo Pro\Release Builds\v.3\store-grafiken\ios\`:
- iPhone 6,9"/6,7": `ios-67-de-1..5.png`, `ios-67-en-1..5.png` (1290 × 2796)
- iPad 13": `ipad-13-de-1..5.png`, `ipad-13-en-1..5.png` (2064 × 2752) – nötig, weil `supportsTablet: true`.
- Rohe Screenshots ohne Überschrift: `ios\roh\`.

## In-App-Käufe / Abos (vor dem Einreichen von Premium)

Produkt-IDs (identisch zu Android):
| ID | Typ | Preis |
|---|---|---|
| `lingopro_premium_monthly` | Auto-Abo (Gruppe „Premium“) | 2,99 € |
| `lingopro_premium_yearly` | Auto-Abo (Gruppe „Premium“) | 19,99 € |
| `lingopro_premium_lifetime` | Nicht-verbrauchbar | 34,99 € |
| `lingopro_hearts_pack` | Verbrauchbar | 0,99 € |
| `lingopro_coins_pack` | Verbrauchbar | 1,99 € |

- Kein RevenueCat und kein Key nötig: Die App lädt die Produkte direkt per StoreKit (`expo-iap`, `src/lib/purchases.ts`). Die IDs oben müssen exakt so in App Store Connect angelegt sein; solange sie fehlen oder nicht „Bereit zum Einreichen“ sind, zeigt der Shop „Die Angebote sind gerade nicht verfügbar“ – die App funktioniert trotzdem komplett.
- Testen: in App Store Connect einen **Sandbox-Tester** anlegen, TestFlight-Build installieren, Kauf mit dem Sandbox-Konto ausführen; „Käufe wiederherstellen“ prüfen.
- Die Abos bei der ersten Einreichung **zusammen mit der App-Version** einreichen (in der Version unter „In-App-Käufe und Abonnements“ auswählen).
- Abos brauchen in App Store Connect: Lokalisierte Namen, Prüf-Screenshot des Paywalls (Premium-Screen), und den Link zur EULA (Standard-EULA von Apple reicht) + Datenschutz-URL in der App-Beschreibung.

## Bekannte iOS-Punkte

- Sprachausgabe nutzt die iOS-Systemstimmen (`expo-speech`, Auswahl je Sprache in `src/lib/feedback.ts`). Fehlen Stimmen, nimmt iOS die Standardstimme.
- Hintergrundmusik: `expo-audio`, `playsInSilentMode: false` – bei Stumm-Schalter bleibt sie aus (gewollt).
- Splash: `expo-splash-screen`-Plugin, Hintergrund #0b1f63.
- Wenn `pod install` an `expo-iap`/`openiap` hängt: `pod repo update` und erneut.
- Nach jeder Änderung an app.json / Plugins: `npx expo prebuild --platform ios --clean` erneut.

## Nach dem Upload

1. In App Store Connect den Build der Version 1.2.2 zuordnen, TestFlight intern testen.
2. Zur Prüfung einreichen. Versionshinweise (DE/EN) wie bei Android (siehe Chat/Projekt-Doku).
3. Build-Nummer in app.json für den nächsten Upload erhöhen und committen.
