import { router } from "expo-router";
import { useEffect } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withSequence, withSpring, withTiming } from "react-native-reanimated";
import { MAX_BUILDING_LEVEL, type BuildingStatus } from "@/app/lib/city";
import { DECORATIONS } from "@/app/lib/premium-benefits";
import { Flame } from "~/components/celebration";
import { Card, Gradient, GradientButton, Label, ProgressBar, useScreenColors } from "~/components/ui";
import { useResponsive } from "~/lib/responsive";
import { useAppState } from "~/state/app-state";
import { useCity } from "~/state/city-state";

const TILE_COLORS = ["bg-amber-100", "bg-sky-100", "bg-emerald-100", "bg-rose-100", "bg-violet-100", "bg-lime-100", "bg-orange-100"];

/** One building on the town grid: grows with its level, nods gently when it was just built. */
function BuildingTile({ status, index, asleep, onPress, compact }: { status: BuildingStatus; index: number; asleep: boolean; onPress: () => void; compact: boolean }) {
  const { building, level, canUpgrade, nextCost, nextWordsRequired, words, blockedBy } = status;
  const bounce = useSharedValue(1);
  const sway = useSharedValue(0);
  useEffect(() => {
    if (level > 0) bounce.value = withSequence(withSpring(1.18, { damping: 6 }), withSpring(1));
  }, [bounce, level]);
  useEffect(() => {
    if (canUpgrade) sway.value = withRepeat(withSequence(withTiming(-4, { duration: 500 }), withTiming(4, { duration: 500 })), -1, true);
    else sway.value = withTiming(0);
  }, [canUpgrade, sway]);
  const iconStyle = useAnimatedStyle(() => ({ transform: [{ scale: bounce.value }, { rotate: `${sway.value}deg` }] }));
  const built = level > 0;
  const size = compact ? 34 + level * 6 : 40 + level * 8;
  const hint = blockedBy === "max" ? "Ausgebaut" : blockedBy === "words" ? `${words}/${nextWordsRequired} Wörter` : blockedBy === "coins" ? `🪙 ${nextCost}` : `🪙 ${nextCost} · Bauen!`;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${building.name}, Stufe ${level} von ${MAX_BUILDING_LEVEL}. ${hint}`}
      onPress={onPress}
      className={`items-center justify-end rounded-2xl p-2 active:opacity-70 ${built ? TILE_COLORS[index % TILE_COLORS.length] : "border-2 border-dashed border-gray-300 bg-white/60"} ${canUpgrade ? "border-2 border-amber-400" : ""} ${asleep && built ? "opacity-60" : ""}`}
      style={{ width: compact ? "31%" : "23%", minHeight: compact ? 108 : 128 }}
    >
      {asleep && built ? <Text className="absolute right-2 top-1 text-xs">💤</Text> : null}
      <Animated.Text style={[{ fontSize: size, lineHeight: size * 1.25 }, iconStyle, !built ? { opacity: 0.35 } : null]}>{building.icon}</Animated.Text>
      <Text className="mt-1 text-xs font-bold text-gray-900" numberOfLines={1}>{building.name}</Text>
      <Text className="text-[10px] text-amber-500">{"★".repeat(level)}{"☆".repeat(MAX_BUILDING_LEVEL - level)}</Text>
      <Text className={`text-[10px] font-semibold ${canUpgrade ? "text-amber-700" : "text-gray-500"}`} numberOfLines={1}>{hint}</Text>
    </Pressable>
  );
}

export default function CityScreen() {
  const { stats, isPremium } = useAppState();
  const { coins, overview, asleep, statuses, quests, chestAvailable, upgrade, claimChest, city, buyDecorationWithCoins } = useCity();
  const colors = useScreenColors();
  const { isWide, isTablet, contentMaxWidth } = useResponsive();
  const readyCount = statuses.filter((status) => status.canUpgrade).length;

  const header = (
    <Gradient className="rounded-3xl p-5">
      <View className="flex-row items-center justify-between">
        <View>
          <Text className="text-2xl font-black text-white">Deine Stadt</Text>
          <Text className="text-sm text-white/90">Stadt-Level {overview.cityLevel} · {overview.population} Einwohner</Text>
        </View>
        <View className="items-end">
          <Text className="text-3xl font-black text-white">🪙 {coins}</Text>
          <Text className="text-xs text-white/90">Münzen</Text>
        </View>
      </View>
      <ProgressBar value={overview.buildingLevels / overview.maxLevels} className="mt-4 bg-white/30" />
      <Text className="mt-1 text-xs text-white/90">{overview.buildingLevels} / {overview.maxLevels} Ausbaustufen</Text>
      {asleep ? (
        <View className="mt-3 rounded-xl bg-white/20 p-3">
          <Text className="text-sm font-bold text-white">💤 Deine Stadt schläft.</Text>
          <Text className="text-xs text-white/90">Seit {stats.lastActiveDate} nichts gelernt. Eine Lernkarte weckt alle wieder auf.</Text>
        </View>
      ) : null}
    </Gradient>
  );

  const grid = (
    <Card>
      <View className="mb-3 flex-row items-center justify-between">
        <Label>Gebäude</Label>
        {readyCount > 0 ? <Text className="mb-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-800">{readyCount} baubereit</Text> : null}
      </View>
      <View className="flex-row flex-wrap justify-between gap-y-3">
        {statuses.map((status, index) => <BuildingTile key={status.building.id} status={status} index={index} asleep={asleep} compact={!isTablet} onPress={() => upgrade(status.building.id)} />)}
      </View>
      <Text className="mt-3 text-xs text-gray-500">Jedes Gebäude gehört zu Lernthemen: Lerne Wörter aus dem Thema und verdiene Münzen (5 XP = 1 Münze, jedes gelernte Wort = 3 Münzen).</Text>
    </Card>
  );

  const decorations = (
    <Card>
      <View className="mb-3 flex-row items-center justify-between">
        <Label>Stadt-Extras {isPremium ? "" : "· Premium"}</Label>
        {!isPremium ? <Pressable accessibilityRole="button" onPress={() => router.push("/premium")} className="mb-2 rounded-full bg-indigo-600 px-3 py-1 active:opacity-70"><Text className="text-xs font-bold text-white">💎 Premium holen</Text></Pressable> : null}
      </View>
      <View className="flex-row flex-wrap gap-2">
        {DECORATIONS.map((decoration) => {
          const owned = city.decorations.includes(decoration.id);
          const affordable = coins >= decoration.cost;
          return (
            <Pressable
              key={decoration.id}
              accessibilityRole="button"
              accessibilityLabel={`${decoration.name}${owned ? ", gebaut" : `, ${decoration.cost} Münzen`}`}
              disabled={owned || !isPremium}
              onPress={() => { if (!buyDecorationWithCoins(decoration.id)) return; }}
              className={`w-[31%] items-center rounded-2xl p-3 ${owned ? "bg-emerald-100" : isPremium && affordable ? "border-2 border-amber-400 bg-white" : "bg-gray-100"} ${!isPremium ? "opacity-60" : ""}`}
            >
              <Text className="text-3xl">{owned ? decoration.icon : isPremium ? decoration.icon : "🔒"}</Text>
              <Text className="mt-1 text-xs font-bold text-gray-900" numberOfLines={1}>{decoration.name}</Text>
              <Text className="text-[10px] text-gray-500">{owned ? "gebaut" : `🪙 ${decoration.cost}`}</Text>
            </Pressable>
          );
        })}
      </View>
      {!isPremium ? <Text className="mt-3 text-xs text-gray-500">Mit Premium kaufst du Dekorationen mit deinen Münzen, bekommst +50 % XP, unendlich Leben und Streak-Schutz.</Text> : null}
    </Card>
  );

  const side = (
    <View className="gap-4">
      <Card>
        <Label>Tagesaufgaben</Label>
        {quests.map((quest) => (
          <View key={quest.id} className={`mb-2 rounded-2xl p-3 ${quest.done ? "bg-green-50" : "bg-gray-50"}`}>
            <View className="flex-row items-center justify-between">
              <Text className={`flex-1 text-sm font-semibold ${quest.done ? "text-green-800" : "text-gray-900"}`}>{quest.done ? "✓ " : ""}{quest.title}</Text>
              <Text className="text-xs font-bold text-amber-700">🪙 {quest.reward}</Text>
            </View>
            {!quest.done ? <ProgressBar value={quest.progress / quest.target} className="mt-2" /> : null}
            {!quest.done ? <Text className="mt-1 text-[10px] text-gray-500">{quest.progress} / {quest.target}</Text> : null}
          </View>
        ))}
        <Text className="text-xs text-gray-500">Jeden Tag drei neue Aufgaben.</Text>
      </Card>
      <Card className="items-center">
        <Flame size={40} />
        <Text className="mt-1 text-lg font-black text-gray-900">{stats.streak === 1 ? "1 Tag" : `${stats.streak} Tage`} in Folge</Text>
        {chestAvailable ? (
          <GradientButton className="mt-3 w-full" label="🎁 Streak-Truhe öffnen (+20 Münzen)" onPress={claimChest} />
        ) : (
          <Text className="mt-1 text-center text-xs text-gray-500">{stats.streak >= 3 ? "Truhe für heute schon geöffnet. Morgen wartet die nächste." : "Ab 3 Tagen in Folge wartet jeden Tag eine Truhe."}</Text>
        )}
      </Card>
      <GradientButton label="Jetzt lernen und Münzen verdienen" onPress={() => router.navigate("/")} />
    </View>
  );

  if (isWide) {
    return (
      <ScrollView className={`flex-1 ${colors.screen}`} contentContainerClassName="gap-6 p-6 pb-10">
        {header}
        <View className="flex-row items-start gap-6">
          <View className="flex-[1.5] gap-6">{grid}{decorations}</View>
          <View className="flex-1">{side}</View>
        </View>
      </ScrollView>
    );
  }
  return (
    <ScrollView className={`flex-1 ${colors.screen}`} contentContainerClassName="p-4 pb-10">
      <View className="w-full gap-4 self-center" style={{ maxWidth: contentMaxWidth }}>
        {header}
        {grid}
        {decorations}
        {side}
      </View>
    </ScrollView>
  );
}
