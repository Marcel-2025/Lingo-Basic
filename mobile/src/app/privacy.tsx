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
    <ScrollView className="flex-1 bg-white" contentContainerClassName="p-6" contentContainerStyle={{ paddingTop: insets.top + 16, paddingBottom: insets.bottom + 24 }}>
      <Text className="text-2xl font-bold text-gray-900">Datenschutzerklärung</Text>
      <Text className="mt-1 text-xs text-gray-500">Stand: Oktober 2026</Text>

      <Section title="Ohne Konto">
        Du kannst Lingua vollständig ohne Konto nutzen. Dein Lernfortschritt (XP, Streak, gelernte Wörter, Einstellungen) wird dann nur auf deinem Gerät gespeichert und nicht übertragen.
      </Section>
      <Section title="Mit Konto (optional)">
        Wenn du dich anmeldest, verarbeiten wir je nach Anmeldemethode deine E-Mail-Adresse, deine Telefonnummer oder deinen Google-Kontonamen sowie eine Nutzer-ID. Dein Lernfortschritt wird dann zusätzlich in der Cloud gespeichert, damit du ihn auf mehreren Geräten nutzen kannst. Dafür nutzen wir Firebase Authentication und Cloud Firestore von Google (Google Ireland Ltd.); die Daten liegen in der EU (Region eur3).
      </Section>
      <Section title="Zweck und Rechtsgrundlage">
        Die Daten werden ausschließlich verwendet, um dich anzumelden und deinen Lernfortschritt zu synchronisieren (Vertragserfüllung, Art. 6 Abs. 1 lit. b DSGVO). Es gibt keine Werbung, kein Tracking und keine Weitergabe an Dritte zu Werbezwecken.
      </Section>
      <Section title="Löschung">
        Du kannst dein Konto jederzeit in der App unter Settings → Konto → „Konto löschen“ löschen. Dabei werden dein Konto und alle Cloud-Daten dauerhaft entfernt. Alternativ genügt eine E-Mail an {CONTACT_EMAIL}.
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
