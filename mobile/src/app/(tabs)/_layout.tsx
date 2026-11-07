import { Tabs, type BottomTabBarProps } from "expo-router/js-tabs";
import { Image, Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AppHeader } from "~/components/app-header";
import { ScreenBackground } from "~/components/screen-background";
import { Gradient, useScreenColors } from "~/components/ui";
import { useT, type TranslationKey } from "~/i18n";
import { useResponsive } from "~/lib/responsive";

const TABS: Record<string, { icon: string; label: TranslationKey }> = {
  index: { icon: "📚", label: "tabs.today" },
  uebungen: { icon: "🎮", label: "tabs.exercises" },
  stadt: { icon: "🏙️", label: "tabs.city" },
  profil: { icon: "👤", label: "tabs.profile" },
  settings: { icon: "⚙️", label: "tabs.settings" },
};

/**
 * Phone and tablet portrait: bottom navigation like the web app (active button lifted with the theme gradient).
 * Tablet landscape: a slim navigation rail on the left, which keeps the full height for the content.
 */
function TabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const colors = useScreenColors();
  const { isWide, isTablet } = useResponsive();
  const t = useT();

  const items = state.routes.map((route, index) => {
    const tab = TABS[route.name];
    if (!tab) return null;
    const isActive = state.index === index;
    const content = (
      <View className={`${isWide ? "h-[68px] w-[76px]" : "h-16 w-[68px]"} items-center justify-center px-1`}>
        <Text className="mb-1 text-2xl">{tab.icon}</Text>
        <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} className={`text-[10px] font-bold uppercase ${isActive ? "text-white" : "text-gray-500 dark:text-blue-200/75"}`}>{t(tab.label)}</Text>
      </View>
    );
    // Transform and shadow classes set CSS variables (--tw-translate-*, --tw-shadow). NativeWind can only add
    // variables during the first render, so every tab carries them from the start (neutral when inactive);
    // otherwise switching tabs remounts the button and crashes NativeWind's dev-only upgrade warning on iOS.
    return (
      <Pressable
        key={route.key}
        accessibilityRole="tab"
        accessibilityState={{ selected: isActive }}
        accessibilityLabel={t(tab.label)}
        onPress={() => {
          const event = navigation.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
          if (!isActive && !event.defaultPrevented) navigation.navigate(route.name);
        }}
        className={`rounded-2xl ${isActive ? `${isWide ? "translate-x-1 translate-y-0" : "translate-x-0 -translate-y-2"} overflow-hidden shadow-lg dark:shadow-none` : "translate-x-0 translate-y-0 shadow-none"}`}
      >
        {isActive ? <Gradient>{content}</Gradient> : content}
      </Pressable>
    );
  });

  if (isWide) {
    return (
      <View className={`${colors.nav} items-center gap-4 px-3 shadow-lg dark:shadow-none`} style={{ paddingTop: insets.top + 16, paddingBottom: insets.bottom + 16, paddingLeft: insets.left + 12 }} accessibilityRole="tablist">
        <Image source={require("../../../assets/icon.png")} style={{ width: 48, height: 48, borderRadius: 16, marginBottom: 8 }} accessibilityLabel="Lingo Pro" />
        {items}
      </View>
    );
  }
  return (
    <View className={`${colors.nav} px-4 pt-3 shadow-lg dark:shadow-none`} style={{ paddingBottom: Math.max(insets.bottom, 12) }} accessibilityRole="tablist">
      <View className={`flex-row ${isTablet ? "justify-center gap-10" : "justify-around"}`}>{items}</View>
    </View>
  );
}

export default function TabsLayout() {
  const { isWide } = useResponsive();
  return (
    <Tabs
      tabBar={(props) => <TabBar {...props} />}
      screenOptions={{ header: () => <AppHeader />, tabBarPosition: isWide ? "left" : "bottom", sceneStyle: { backgroundColor: "transparent" } }}
      // Every tab paints its own sky, so inactive tabs never shine through (they are only hidden on native).
      screenLayout={({ children }) => (
        <View className="flex-1">
          <ScreenBackground />
          {children}
        </View>
      )}
    >
      <Tabs.Screen name="index" />
      <Tabs.Screen name="uebungen" />
      <Tabs.Screen name="stadt" />
      <Tabs.Screen name="profil" />
      <Tabs.Screen name="settings" />
    </Tabs>
  );
}
