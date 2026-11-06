import { router } from "expo-router";
import type { ReactNode } from "react";
import { Linking, Pressable, ScrollView, Text } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useT, type TranslationKey } from "~/i18n";

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
  const t = useT();
  return (
    <ScrollView className="flex-1 bg-white" contentContainerClassName="p-6" contentContainerStyle={{ paddingTop: insets.top + 16, paddingBottom: insets.bottom + 24, width: "100%", maxWidth: 560, alignSelf: "center" }}>
      <Text className="text-2xl font-bold text-gray-900">{t("privacy.title")}</Text>
      <Text className="mt-1 text-xs text-gray-500">{t("privacy.updated")}</Text>

      {([1, 2, 3, 4, 5, 6, 7] as const).map((index) => (
        <Section key={index} title={t(`privacy.s${index}` as TranslationKey)}>{t(`privacy.s${index}t` as TranslationKey, { email: CONTACT_EMAIL })}</Section>
      ))}

      <Pressable accessibilityRole="link" onPress={() => void Linking.openURL(`mailto:${CONTACT_EMAIL}`)} className="mt-6 py-2"><Text className="text-center font-bold text-indigo-700">{t("privacy.email")}</Text></Pressable>
      <Pressable onPress={() => router.back()} className="py-3"><Text className="text-center text-sm text-gray-600">{t("common.close")}</Text></Pressable>
    </ScrollView>
  );
}
