import { router } from "expo-router";
import { useEffect } from "react";
import { Image, Pressable, ScrollView, Text, View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withSequence, withSpring, withTiming } from "react-native-reanimated";
import { MAX_BUILDING_LEVEL, type BuildingStatus } from "@/app/lib/city";
import { DECORATIONS } from "@/app/lib/premium-benefits";
import { Flame } from "~/components/celebration";
import { Card, GradientButton, Label, ProgressBar, useScreenColors } from "~/components/ui";
import { useT, type TranslationKey } from "~/i18n";
import { useResponsive } from "~/lib/responsive";
import { CITY_IMAGES } from "~/lib/city-images";
import { useAppState } from "~/state/app-state";
import { useCity } from "~/state/city-state";

const TILE_COLORS = ["bg-amber-100 dark:bg-amber-400/25", "bg-sky-100 dark:bg-sky-400/25", "bg-emerald-100 dark:bg-mint-500/25", "bg-rose-100 dark:bg-rose-400/25", "bg-violet-100 dark:bg-violet-400/25", "bg-lime-100 dark:bg-lime-400/25", "bg-orange-100 dark:bg-orange-400/25"];

/** One building on the town grid: grows with its level, nods gently when it was just built. */
function BuildingTile({ status, index, asleep, onPress, compact }: { status: BuildingStatus; index: number; asleep: boolean; onPress: () => void; compact: boolean }) {
  const { building, level, canUpgrade, nextCost, nextWordsRequired, words, blockedBy } = status;
  const t = useT();
  const name = t(`buildings.${building.id}` as TranslationKey);
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
  const hint = blockedBy === "max" ? t("city.builtOut") : blockedBy === "words" ? t("city.wordsNeeded", { words, needed: nextWordsRequired ?? 0 }) : blockedBy === "coins" ? `🪙 ${nextCost}` : t("city.build", { cost: nextCost ?? 0 });
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t("city.tileLabel", { name, level, max: MAX_BUILDING_LEVEL, hint })}
      onPress={onPress}
      className={`items-center justify-end rounded-2xl p-2 active:opacity-70 ${built ? TILE_COLORS[index % TILE_COLORS.length] : "border-2 border-dashed border-gray-300 dark:border-white/25 bg-white/60 dark:bg-white/5"} ${canUpgrade ? "border-2 border-amber-400 dark:border-amber-300" : ""} ${asleep && built ? "opacity-60" : ""}`}
      style={{ width: compact ? "31%" : "23%", minHeight: compact ? 108 : 128 }}
    >
      {asleep && built ? <Text className="absolute right-2 top-1 text-xs">💤</Text> : null}
      {CITY_IMAGES[`${building.id}_${Math.max(1, level)}`] ? (
        <Animated.View style={[iconStyle, !built ? { opacity: 0.35 } : null]}>
          <Image source={CITY_IMAGES[`${building.id}_${Math.max(1, level)}`]} style={{ width: size * 1.6, height: size * 1.6, borderRadius: 14 }} accessibilityIgnoresInvertColors />
        </Animated.View>
      ) : (
        <Animated.Text style={[{ fontSize: size, lineHeight: size * 1.25 }, iconStyle, !built ? { opacity: 0.35 } : null]}>{building.icon}</Animated.Text>
      )}
      <Text className="mt-1 text-xs font-bold text-gray-900 dark:text-white" numberOfLines={1}>{name}</Text>
      <Text className="text-[10px] text-amber-500 dark:text-amber-300">{"★".repeat(level)}{"☆".repeat(MAX_BUILDING_LEVEL - level)}</Text>
      <Text className={`text-[10px] font-semibold ${canUpgrade ? "text-amber-700 dark:text-amber-200" : "text-gray-500 dark:text-blue-200/75"}`} numberOfLines={1}>{hint}</Text>
    </Pressable>
  );
}

export default function CityScreen() {
  const { stats, isPremium } = useAppState();
  const { coins, overview, asleep, statuses, quests, chestAvailable, upgrade, claimChest, city, buyDecorationWithCoins } = useCity();
  const colors = useScreenColors();
  const t = useT();
  const { isWide, isTablet, contentMaxWidth } = useResponsive();
  const readyCount = statuses.filter((status) => status.canUpgrade).length;

  const header = (
    <Card className="border-2 border-mint-400/40 dark:border-mint-400/40">
      <View className="flex-row items-center justify-between">
        <View>
          <Text className="text-2xl font-black text-gray-900 dark:text-white">🏙️ {t("city.title")}</Text>
          <Text className="text-sm text-gray-600 dark:text-blue-100/85">{t("city.subtitle", { level: overview.cityLevel, population: overview.population })}</Text>
        </View>
        <View className="items-end rounded-2xl bg-amber-100 px-3 py-2 dark:bg-amber-400/20">
          <Text className="text-2xl font-black text-gray-900 dark:text-white">🪙 {coins}</Text>
          <Text className="text-xs font-semibold text-gray-600 dark:text-amber-200">{t("common.coins")}</Text>
        </View>
      </View>
      <ProgressBar value={overview.buildingLevels / overview.maxLevels} className="mt-4" />
      <Text className="mt-1 text-xs text-gray-600 dark:text-blue-100/85">{t("city.stages", { built: overview.buildingLevels, max: overview.maxLevels })}</Text>
      {asleep ? (
        <View className="mt-3 rounded-xl bg-indigo-50 p-3 dark:bg-white/10">
          <Text className="text-sm font-bold text-gray-900 dark:text-white">{t("city.asleep")}</Text>
          <Text className="text-xs text-gray-600 dark:text-blue-100/85">{t("city.asleepText", { date: stats.lastActiveDate })}</Text>
        </View>
      ) : null}
    </Card>
  );

  const grid = (
    <Card>
      <View className="mb-3 flex-row items-center justify-between">
        <Label>{t("city.buildings")}</Label>
        {readyCount > 0 ? <Text className="mb-2 rounded-full bg-amber-100 dark:bg-amber-400/25 px-2 py-0.5 text-xs font-bold text-amber-800 dark:text-amber-200">{t("city.ready", { n: readyCount })}</Text> : null}
      </View>
      <View className="flex-row flex-wrap justify-between gap-y-3">
        {statuses.map((status, index) => <BuildingTile key={status.building.id} status={status} index={index} asleep={asleep} compact={!isTablet} onPress={() => upgrade(status.building.id)} />)}
      </View>
      <Text className="mt-3 text-xs text-gray-500 dark:text-blue-200/75">{t("city.hint")}</Text>
    </Card>
  );

  const decorations = (
    <Card>
      <View className="mb-3 flex-row items-center justify-between">
        <Label>{isPremium ? t("city.extras") : t("city.extrasPremium")}</Label>
        {!isPremium ? <Pressable accessibilityRole="button" onPress={() => router.push("/premium")} className="mb-2 rounded-full bg-indigo-600 dark:bg-mint-400 px-3 py-1 active:opacity-70"><Text className="text-xs font-bold text-white">{t("city.getPremium")}</Text></Pressable> : null}
      </View>
      <View className="flex-row flex-wrap gap-2">
        {DECORATIONS.map((decoration) => {
          const owned = city.decorations.includes(decoration.id);
          const affordable = coins >= decoration.cost;
          const name = t(`decorations.${decoration.id}` as TranslationKey);
          return (
            <Pressable
              key={decoration.id}
              accessibilityRole="button"
              accessibilityLabel={owned ? t("city.decorationLabel", { name }) : t("city.decorationCost", { name, n: decoration.cost })}
              disabled={owned || !isPremium}
              onPress={() => { if (!buyDecorationWithCoins(decoration.id)) return; }}
              className={`w-[31%] items-center rounded-2xl p-3 ${owned ? "bg-emerald-100 dark:bg-mint-500/25" : isPremium && affordable ? "border-2 border-amber-400 dark:border-amber-300 bg-white dark:border dark:border-white/10 dark:bg-black/30" : "bg-gray-100 dark:bg-white/10"} ${!isPremium ? "opacity-60" : ""}`}
            >
              {CITY_IMAGES[`${decoration.id}_1`] && (owned || isPremium) ? (
                <Image source={CITY_IMAGES[`${decoration.id}_1`]} style={{ width: 56, height: 56, borderRadius: 12 }} accessibilityIgnoresInvertColors />
              ) : (
                <Text className="text-3xl">{owned ? decoration.icon : isPremium ? decoration.icon : "🔒"}</Text>
              )}
              <Text className="mt-1 text-xs font-bold text-gray-900 dark:text-white" numberOfLines={1}>{name}</Text>
              <Text className="text-[10px] text-gray-500 dark:text-blue-200/75">{owned ? t("city.built") : `🪙 ${decoration.cost}`}</Text>
            </Pressable>
          );
        })}
      </View>
      {!isPremium ? <Text className="mt-3 text-xs text-gray-500 dark:text-blue-200/75">{t("city.extrasHint")}</Text> : null}
    </Card>
  );

  const side = (
    <View className="gap-4">
      <Card>
        <Label>{t("city.quests")}</Label>
        {quests.map((quest) => (
          <View key={quest.id} className={`mb-2 rounded-2xl p-3 ${quest.done ? "bg-green-50 dark:bg-mint-500/15" : "bg-gray-50 dark:bg-white/5"}`}>
            <View className="flex-row items-center justify-between">
              <Text className={`flex-1 text-sm font-semibold ${quest.done ? "text-green-800 dark:text-mint-300" : "text-gray-900 dark:text-white"}`}>{quest.done ? "✓ " : ""}{t(`quests.${quest.id}` as TranslationKey)}</Text>
              <Text className="text-xs font-bold text-amber-700 dark:text-amber-200">🪙 {quest.reward}</Text>
            </View>
            {!quest.done ? <ProgressBar value={quest.progress / quest.target} className="mt-2" /> : null}
            {!quest.done ? <Text className="mt-1 text-[10px] text-gray-500 dark:text-blue-200/75">{quest.progress} / {quest.target}</Text> : null}
          </View>
        ))}
        <Text className="text-xs text-gray-500 dark:text-blue-200/75">{t("city.questsHint")}</Text>
      </Card>
      <Card className="items-center">
        <Flame size={40} />
        <Text className="mt-1 text-lg font-black text-gray-900 dark:text-white">{t("city.inARow", { days: t("common.days", { n: stats.streak }) })}</Text>
        {chestAvailable ? (
          <GradientButton className="mt-3 w-full" label={t("city.openChest", { n: 20 })} onPress={claimChest} />
        ) : (
          <Text className="mt-1 text-center text-xs text-gray-500 dark:text-blue-200/75">{stats.streak >= 3 ? t("city.chestDone") : t("city.chestLocked")}</Text>
        )}
      </Card>
      <GradientButton label={t("city.learnNow")} onPress={() => router.navigate("/")} />
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
