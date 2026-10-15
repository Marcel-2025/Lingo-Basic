import type { ConfirmationResult } from "@react-native-firebase/auth";
import * as AppleAuthentication from "expo-apple-authentication";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { GradientButton } from "~/components/ui";
import { confirmPhoneCode, isAppleSignInAvailable, signInWithApple, signInWithEmail, signInWithGoogle, startPhoneSignIn } from "~/lib/firebase";

type Method = "email" | "phone";
type Pending = "email" | "google" | "apple" | "phone-send" | "phone-confirm" | null;

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const [method, setMethod] = useState<Method>("email");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSignup, setIsSignup] = useState(false);
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [confirmation, setConfirmation] = useState<ConfirmationResult | null>(null);
  const [pending, setPending] = useState<Pending>(null);
  const [message, setMessage] = useState("");
  const [appleAvailable, setAppleAvailable] = useState(false);
  const isLoading = pending !== null;

  useEffect(() => {
    let active = true;
    void isAppleSignInAvailable().then((available) => { if (active) setAppleAvailable(available); }).catch(() => undefined);
    return () => { active = false; };
  }, []);

  const run = async (kind: Exclude<Pending, null>, action: () => Promise<unknown>, close = true) => {
    setPending(kind);
    setMessage("");
    try {
      await action();
      if (close) router.back();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Die Anmeldung ist fehlgeschlagen.");
    } finally {
      setPending(null);
    }
  };

  const input = "rounded-xl bg-gray-100 p-3 text-gray-900";
  const tab = (active: boolean) => `flex-1 items-center rounded-lg py-2 ${active ? "bg-white shadow-sm" : ""}`;

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} className="flex-1 bg-white">
      <ScrollView contentContainerClassName="p-6" contentContainerStyle={{ paddingTop: insets.top + 16, paddingBottom: insets.bottom + 24 }} keyboardShouldPersistTaps="handled">
        <Text className="mb-2 text-2xl font-bold text-gray-900">{method === "email" && isSignup ? "Registrieren" : "Einloggen"}</Text>
        <Text className="mb-6 text-sm text-gray-600">Optional: Mit einem Konto wird dein Fortschritt zwischen Geräten synchronisiert. Ohne Login bleibt alles auf diesem Gerät.</Text>

        {appleAvailable ? (
          <View className={`mb-3 ${isLoading ? "opacity-60" : ""}`} pointerEvents={isLoading ? "none" : "auto"}>
            <AppleAuthentication.AppleAuthenticationButton
              buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
              buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
              cornerRadius={12}
              style={{ height: 48, width: "100%" }}
              onPress={() => void run("apple", signInWithApple)}
            />
          </View>
        ) : null}

        <Pressable accessibilityRole="button" disabled={isLoading} onPress={() => void run("google", signInWithGoogle)} className={`mb-4 flex-row items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white py-3 shadow-sm ${isLoading ? "opacity-60" : "active:opacity-70"}`}>
          <Text className="text-lg font-black text-blue-600">G</Text>
          <Text className="font-bold text-gray-900">{pending === "google" ? "Bitte warten…" : "Mit Google fortfahren"}</Text>
        </Pressable>

        <View className="mb-4 flex-row gap-1 rounded-xl bg-gray-100 p-1" accessibilityRole="tablist">
          <Pressable accessibilityRole="tab" accessibilityState={{ selected: method === "email" }} className={tab(method === "email")} onPress={() => { setMethod("email"); setMessage(""); }}><Text className="font-bold text-gray-900">E-Mail</Text></Pressable>
          <Pressable accessibilityRole="tab" accessibilityState={{ selected: method === "phone" }} className={tab(method === "phone")} onPress={() => { setMethod("phone"); setMessage(""); }}><Text className="font-bold text-gray-900">Telefon</Text></Pressable>
        </View>

        {method === "email" ? (
          <View className="gap-3">
            <TextInput value={email} onChangeText={setEmail} placeholder="E-Mail" placeholderTextColor="#6b7280" keyboardType="email-address" autoCapitalize="none" autoComplete="email" textContentType="emailAddress" className={input} editable={!isLoading} accessibilityLabel="E-Mail" />
            <TextInput value={password} onChangeText={setPassword} placeholder={isSignup ? "Passwort (mind. 6 Zeichen)" : "Passwort"} placeholderTextColor="#6b7280" secureTextEntry autoComplete={isSignup ? "new-password" : "current-password"} textContentType={isSignup ? "newPassword" : "password"} className={input} editable={!isLoading} accessibilityLabel="Passwort" />
            <GradientButton label={pending === "email" ? "Bitte warten…" : isSignup ? "Account erstellen" : "Mit E-Mail einloggen"} disabled={isLoading || !email || !password} onPress={() => void run("email", () => signInWithEmail(email, password, isSignup))} />
            <Pressable onPress={() => setIsSignup((value) => !value)} className="py-2"><Text className="text-center text-sm font-bold text-indigo-700">{isSignup ? "Schon einen Account? Jetzt einloggen" : "Noch kein Account? Jetzt registrieren"}</Text></Pressable>
          </View>
        ) : (
          <View className="gap-3">
            <TextInput value={phone} onChangeText={(value) => { setPhone(value); setConfirmation(null); setCode(""); }} placeholder="Telefonnummer, z. B. +49 151 2345678" placeholderTextColor="#6b7280" keyboardType="phone-pad" autoComplete="tel" textContentType="telephoneNumber" className={input} editable={!isLoading} accessibilityLabel="Telefonnummer" />
            {confirmation ? (
              <TextInput value={code} onChangeText={(value) => setCode(value.replace(/\D/g, "").slice(0, 6))} placeholder="6-stelliger SMS-Code" placeholderTextColor="#6b7280" keyboardType="number-pad" autoComplete="sms-otp" textContentType="oneTimeCode" className={`${input} tracking-widest`} editable={!isLoading} accessibilityLabel="SMS-Code" />
            ) : null}
            {confirmation ? (
              <GradientButton label={pending === "phone-confirm" ? "Bitte warten…" : "Code bestätigen"} disabled={isLoading || code.length < 6} onPress={() => void run("phone-confirm", () => confirmPhoneCode(confirmation, code))} />
            ) : (
              <GradientButton
                label={pending === "phone-send" ? "SMS wird gesendet…" : "SMS-Code senden"}
                disabled={isLoading || !phone}
                onPress={() => void run("phone-send", async () => {
                  setConfirmation(await startPhoneSignIn(phone));
                  setMessage("Der SMS-Code wurde gesendet.");
                }, false)}
              />
            )}
            {confirmation ? <Pressable disabled={isLoading} onPress={() => { setConfirmation(null); setCode(""); }} className="py-2"><Text className="text-center text-sm font-bold text-indigo-700">Andere Nummer / Code erneut senden</Text></Pressable> : null}
            <Text className="text-xs text-gray-600">Es können SMS-Gebühren deines Anbieters anfallen.</Text>
          </View>
        )}

        <Pressable onPress={() => router.push("/privacy")} className="mt-4 py-2"><Text className="text-center text-xs text-gray-600">Mit der Anmeldung akzeptierst du die <Text className="font-bold text-indigo-700">Datenschutzerklärung</Text>.</Text></Pressable>
        <Pressable disabled={isLoading} onPress={() => router.back()} className="py-3"><Text className="text-center text-sm text-gray-600">Schließen</Text></Pressable>
        {message ? <Text accessibilityLiveRegion="polite" className="mt-2 rounded-xl bg-indigo-50 p-2 text-center text-xs font-bold text-indigo-800">{message}</Text> : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
