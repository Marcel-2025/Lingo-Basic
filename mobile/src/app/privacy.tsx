import { router } from "expo-router";
import type { ReactNode } from "react";
import { Linking, Pressable, ScrollView, Text } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const CONTACT_EMAIL = "flondy.dev@gmail.com";

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <>
      <Text className="mb-2 mt-5 text-lg font-bold text-gray-900">{title}</Text>
      <Text className="text-sm leading-6 text-gray-700">{children}</Text>
    </>
  );
}

/**
 * In-app privacy policy. Must match the Google Play "Data safety" form and the hosted policy URL in the store listing.
 * Review this text before publishing; it describes what the code does as of this version.
 */
export default function PrivacyScreen() {
  const insets = useSafeAreaInsets();
  return (
    <ScrollView className="flex-1 bg-white" contentContainerClassName="p-6" contentContainerStyle={{ paddingTop: insets.top + 16, paddingBottom: insets.bottom + 24, width: "100%", maxWidth: 560, alignSelf: "center" }}>
      <Text className="text-2xl font-bold text-gray-900">Datenschutzerklärung</Text>
      <Text className="mt-1 text-xs text-gray-500">Stand: November 2026</Text>

      <Section title="Keine Konten, keine Server">
        Lingo Pro funktioniert ohne Konto und ohne Anmeldung. Dein Lernfortschritt (XP, Streak, gelernte Wörter, Stadt, Einstellungen) wird ausschließlich auf deinem Gerät gespeichert und nicht an uns oder Dritte übertragen. Die App enthält keine Werbung und kein Tracking.
      </Section>
      <Section title="Sicherung">
        Über Settings → Deine Daten kannst du eine Sicherungsdatei erzeugen und selbst speichern oder teilen. Wohin du diese Datei legst, entscheidest allein du; wir erhalten sie nicht.
      </Section>
      <Section title="Käufe">
        Premium-Abos und Einmalkäufe laufen über Google Play bzw. den App Store. Zur Prüfung der Käufe nutzen wir RevenueCat (RevenueCat, Inc., USA); dabei werden eine anonyme Geräte-ID und die Kaufbelege verarbeitet, keine Namen oder Zahlungsdaten. Zahlungsdaten sieht nur dein Store-Konto.
      </Section>
      <Section title="Erinnerungen">
        Tägliche Erinnerungen sind optional und werden nur lokal auf deinem Gerät geplant. Es werden dafür keine Daten übertragen und keine Push-Tokens gespeichert.
      </Section>
      <Section title="Löschung">
        Unter Settings → Deine Daten → „Alle Daten löschen“ entfernst du den gesamten Fortschritt vom Gerät. Auch das Deinstallieren der App löscht alle Daten.
      </Section>
      <Section title="Deine Rechte">
        Du hast das Recht auf Auskunft, Berichtigung, Löschung, Einschränkung der Verarbeitung, Datenübertragbarkeit und Beschwerde bei einer Datenschutz-Aufsichtsbehörde.
      </Section>
      <Section title="Kontakt">Fragen zum Datenschutz: {CONTACT_EMAIL}</Section>

      <Pressable accessibilityRole="link" onPress={() => void Linking.openURL(`mailto:${CONTACT_EMAIL}`)} className="mt-6 py-2"><Text className="text-center font-bold text-indigo-700">E-Mail schreiben</Text></Pressable>
      <Pressable onPress={() => router.back()} className="py-3"><Text className="text-center text-sm text-gray-600">Schließen</Text></Pressable>
    </ScrollView>
  );
}
