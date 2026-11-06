import "../../global.css";
import "~/lib/nativewind-interop";
import * as ScreenOrientation from "expo-screen-orientation";
import { Stack } from "expo-router";
import { useEffect } from "react";
import { Dimensions } from "react-native";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { CelebrationOverlay } from "~/components/celebration";
import { AppStateProvider } from "~/state/app-state";
import { CityProvider } from "~/state/city-state";
import { PackProvider } from "~/state/pack-state";

/** Phones stay in portrait; tablets may rotate freely (landscape is the main tablet layout). */
function useOrientationPolicy() {
  useEffect(() => {
    const { width, height } = Dimensions.get("screen");
    const isTablet = Math.min(width, height) >= 600;
    void (isTablet ? ScreenOrientation.unlockAsync() : ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP)).catch(() => undefined);
  }, []);
}

export default function RootLayout() {
  useOrientationPolicy();
  return (
    <SafeAreaProvider>
      <AppStateProvider>
        <PackProvider>
          <CityProvider>
            <StatusBar style="light" />
            <Stack screenOptions={{ headerShown: false }}>
              <Stack.Screen name="(tabs)" />
              <Stack.Screen name="privacy" options={{ presentation: "modal" }} />
              <Stack.Screen name="premium" options={{ presentation: "modal" }} />
            </Stack>
            <CelebrationOverlay />
          </CityProvider>
        </PackProvider>
      </AppStateProvider>
    </SafeAreaProvider>
  );
}
