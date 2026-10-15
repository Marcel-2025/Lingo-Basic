import { Tabs, type BottomTabBarProps } from "expo-router/js-tabs";
import { Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AppHeader } from "~/components/app-header";
import { Gradient, useScreenColors } from "~/components/ui";

const TABS: Record<string, { icon: string; label: string }> = {
  index: { icon: "📚", label: "Heute" },
  uebungen: { icon: "🎮", label: "Übungen" },
  profil: { icon: "👤", label: "Profil" },
  settings: { icon: "⚙️", label: "Settings" },
};

/** Same bottom navigation as the web app: four buttons, the active one lifted with the theme gradient. */
function TabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const colors = useScreenColors();
  return (
    <View className={`${colors.nav} px-4 pt-3 shadow-lg`} style={{ paddingBottom: Math.max(insets.bottom, 12) }}>
      <View className="flex-row justify-around">
        {state.routes.map((route, index) => {
          const tab = TABS[route.name];
          if (!tab) return null;
          const isActive = state.index === index;
          const content = (
            <View className="h-16 w-16 items-center justify-center">
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
              className={`rounded-2xl ${isActive ? "-translate-y-2 overflow-hidden shadow-lg" : ""}`}
            >
              {isActive ? <Gradient>{content}</Gradient> : content}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export default function TabsLayout() {
  return (
    <Tabs tabBar={(props) => <TabBar {...props} />} screenOptions={{ header: () => <AppHeader /> }}>
      <Tabs.Screen name="index" />
      <Tabs.Screen name="uebungen" />
      <Tabs.Screen name="profil" />
      <Tabs.Screen name="settings" />
    </Tabs>
  );
}
