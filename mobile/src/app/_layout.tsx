import "../../global.css";
import "~/lib/nativewind-interop";
import * as ScreenOrientation from "expo-screen-orientation";
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from "expo-router";
import { useEffect } from "react";
import { vars } from "nativewind";
import { Dimensions, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { CelebrationOverlay, CelebrationToast } from "~/components/celebration";
import { ScreenBackground } from "~/components/screen-background";
import { AppStateProvider, useAppState } from "~/state/app-state";
import { CityProvider } from "~/state/city-state";
import { PackProvider } from "~/state/pack-state";
import { ACCENTS, rgbChannels } from "~/lib/theme";

/** Phones stay in portrait; tablets may rotate freely (landscape is the main tablet layout). */
function useOrientationPolicy() {
  useEffect(() => {
    const { width, height } = Dimensions.get("screen");
    const isTablet = Math.min(width, height) >= 600;
    void (isTablet ? ScreenOrientation.unlockAsync() : ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP)).catch(() => undefined);
  }, []);
}

/** Navigation containers get a transparent background so the animated sky shows through on every screen. */
function Navigation() {
  const { settings } = useAppState();
  const base = settings.isDarkMode ? DarkTheme : DefaultTheme;
  const theme = { ...base, colors: { ...base.colors, background: "transparent", card: "transparent" } };
  const accent = ACCENTS[settings.theme] ?? ACCENTS.Ocean;
  return (
    <ThemeProvider value={theme}>
     <View className="flex-1" style={vars({ "--accent": rgbChannels(accent.main), "--accent-soft": rgbChannels(accent.soft), "--accent-deep": rgbChannels(accent.deep) })}>
      <StatusBar style={settings.isDarkMode ? "light" : "dark"} />
      <ScreenBackground />
      <Stack
        screenOptions={{ headerShown: false, contentStyle: { backgroundColor: "transparent" } }}
        screenLayout={({ children }) => (
          <View className="flex-1">
            <ScreenBackground />
            {children}
          </View>
        )}
      >
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="privacy" options={{ presentation: "modal" }} />
        <Stack.Screen name="premium" options={{ presentation: "modal" }} />
        <Stack.Screen name="lesson" options={{ presentation: "fullScreenModal", gestureEnabled: false, animation: "slide_from_bottom" }} />
      </Stack>
      <CelebrationToast />
      <CelebrationOverlay />
     </View>
    </ThemeProvider>
  );
}

export default function RootLayout() {
  useOrientationPolicy();
  return (
    <SafeAreaProvider>
      <AppStateProvider>
        <PackProvider>
          <CityProvider>
            <Navigation />
          </CityProvider>
        </PackProvider>
      </AppStateProvider>
    </SafeAreaProvider>
  );
}
