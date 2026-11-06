import { Tabs, type BottomTabBarProps } from "expo-router/js-tabs";
import { Image, Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AppHeader } from "~/components/app-header";
import { Gradient, useScreenColors } from "~/components/ui";
import { useResponsive } from "~/lib/responsive";

const TABS: Record<string, { icon: string; label: string }> = {
  index: { icon: "📚", label: "Heute" },
  uebungen: { icon: "🎮", label: "Übungen" },
  stadt: { icon: "🏙️", label: "Stadt" },
  profil: { icon: "👤", label: "Profil" },
  settings: { icon: "⚙️", label: "Settings" },
};

/**
 * Phone and tablet portrait: bottom navigation like the web app (active button lifted with the theme gradient).
 * Tablet landscape: a slim navigation rail on the left, which keeps the full height for the content.
 */
function TabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const colors = useScreenColors();
  const { isWide, isTablet } = useResponsive();

  const items = state.routes.map((route, index) => {
    const tab = TABS[route.name];
    if (!tab) return null;
    const isActive = state.index === index;
    const content = (
      <View className={`${isWide ? "h-[68px] w-[76px]" : "h-16 w-14"} items-center justify-center`}>
        <Text className="mb-1 text-2xl">{tab.icon}</Text>
        <Text className={`text-[10px] font-bold uppercase tracking-wider ${isActive ? "text-white" : "text-gray-500"}`}>{tab.label}</Text>
      </View>
    );
    return (
      <Pressable
        key={route.key}
        accessibilityRole="tab"
        accessibilityState={{ selected: isActive }}
        accessibilityLabel={tab.label}
        onPress={() => {
          const event = navigation.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
          if (!isActive && !event.defaultPrevented) navigation.navigate(route.name);
        }}
        className={`rounded-2xl ${isActive ? `${isWide ? "translate-x-1" : "-translate-y-2"} overflow-hidden shadow-lg` : ""}`}
      >
        {isActive ? <Gradient>{content}</Gradient> : content}
      </Pressable>
    );
  });

  if (isWide) {
    return (
      <View className={`${colors.nav} items-center gap-4 px-3 shadow-lg`} style={{ paddingTop: insets.top + 16, paddingBottom: insets.bottom + 16, paddingLeft: insets.left + 12 }} accessibilityRole="tablist">
        <Image source={require("../../../assets/icon.png")} style={{ width: 48, height: 48, borderRadius: 16, marginBottom: 8 }} accessibilityLabel="Lingo Pro" />
        {items}
      </View>
    );
  }
  return (
    <View className={`${colors.nav} px-4 pt-3 shadow-lg`} style={{ paddingBottom: Math.max(insets.bottom, 12) }} accessibilityRole="tablist">
      <View className={`flex-row ${isTablet ? "justify-center gap-10" : "justify-around"}`}>{items}</View>
    </View>
  );
}

export default function TabsLayout() {
  const { isWide } = useResponsive();
  return (
    <Tabs tabBar={(props) => <TabBar {...props} />} screenOptions={{ header: () => <AppHeader />, tabBarPosition: isWide ? "left" : "bottom" }}>
      <Tabs.Screen name="index" />
      <Tabs.Screen name="uebungen" />
      <Tabs.Screen name="stadt" />
      <Tabs.Screen name="profil" />
      <Tabs.Screen name="settings" />
    </Tabs>
  );
}
