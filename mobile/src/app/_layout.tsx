import "../../global.css";
import "~/lib/nativewind-interop";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AppStateProvider } from "~/state/app-state";
import { PackProvider } from "~/state/pack-state";

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AppStateProvider>
        <PackProvider>
          <StatusBar style="light" />
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="login" options={{ presentation: "modal" }} />
            <Stack.Screen name="privacy" options={{ presentation: "modal" }} />
          </Stack>
        </PackProvider>
      </AppStateProvider>
    </SafeAreaProvider>
  );
}
