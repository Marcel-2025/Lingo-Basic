import { router } from "expo-router";
import { useEffect, useMemo, useRef } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import Animated, { FadeInDown, useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming } from "react-native-reanimated";
import { buildPath, getLessonStars, getPathProgress, type LessonStatus, type PathLesson, type PathSection } from "@/app/lib/lessons";
import type { LanguagePack } from "@/app/lib/types";
import { Appear, Gradient, GradientButton, ProgressBar } from "~/components/ui";
import { useT } from "~/i18n";
import { requestReminderPermission, setReminderSettings, useReminderSettings } from "~/lib/reminders";
import { useResponsive } from "~/lib/responsive";
import { useAppState } from "~/state/app-state";

const NODE = 76;
/** Horizontal zig-zag of the path (fractions of the available half width). */
const OFFSETS = [0, 0.55, 0.85, 0.55, 0, -0.55, -0.85, -0.55];

/** Lesson path: one section per topic, lessons as round nodes that unlock one after another. */
export function LearningPath({ pack, header }: { pack: LanguagePack; header?: React.ReactNode }) {
  const { insights } = useAppState();
  const t = useT();
  const { contentMaxWidth } = useResponsive();
  const path = useMemo(() => buildPath(pack), [pack]);
  const progress = useMemo(() => getPathProgress(path, insights), [insights, path]);
  const scrollRef = useRef<ScrollView>(null);
  const currentY = useRef<number | null>(null);
  const scrolled = useRef(false);

  const currentSection = progress.current ? path.find((section) => section.topicId === progress.current?.topicId) : null;
  const open = (lesson: PathLesson) => router.push({ pathname: "/lesson", params: { id: lesson.id } });

  const onCurrentLayout = (y: number) => {
    currentY.current = y;
    if (!scrolled.current && y > 400) {
      scrolled.current = true;
      setTimeout(() => scrollRef.current?.scrollTo({ y: Math.max(0, y - 260), animated: true }), 250);
    }
  };

  return (
    <ScrollView ref={scrollRef} className="flex-1" contentContainerClassName="p-4 pb-16">
      <View className="w-full self-center" style={{ maxWidth: contentMaxWidth }}>
        {header}
        <Appear entering={FadeInDown.duration(350)} className="mb-5 rounded-3xl bg-white p-5 shadow-sm dark:border dark:border-white/10 dark:bg-black/30">
          <View className="flex-row items-center justify-between">
            <Text className="text-lg font-black text-gray-900 dark:text-white">{t("path.title", { level: pack.level })}</Text>
            <Text className="text-sm font-bold text-gray-500 dark:text-blue-200/80">{t("path.lessonsDone", { done: progress.done, total: progress.total })}</Text>
          </View>
          <ProgressBar value={progress.total ? progress.done / progress.total : 0} className="my-3" />
          {progress.current && currentSection ? (
            <GradientButton label={t("path.continue", { n: progress.current.index + 1, topic: currentSection.title })} onPress={() => open(progress.current!)} />
          ) : (
            <Text className="text-center text-base font-bold text-gray-900 dark:text-white">{t("path.allDone")}</Text>
          )}
        </Appear>

        <ReminderPrompt />

        {path.map((section, sectionIndex) => (
          <Section
            key={section.topicId}
            section={section}
            sectionIndex={sectionIndex}
            status={progress.status}
            stars={(id) => getLessonStars(insights, id)}
            onOpen={open}
            onCurrentLayout={onCurrentLayout}
          />
        ))}
      </View>
    </ScrollView>
  );
}

/** One-time invitation to turn on the daily reminders (hidden once enabled or closed). */
function ReminderPrompt() {
  const reminders = useReminderSettings();
  const t = useT();
  if (reminders.enabled || reminders.promptDismissed) return null;
  const enable = async () => {
    const granted = await requestReminderPermission().catch(() => false);
    await setReminderSettings(granted ? { enabled: true } : { promptDismissed: true });
  };
  return (
    <Appear entering={FadeInDown.delay(150).duration(350)} className="mb-5 flex-row items-center gap-3 rounded-3xl border border-amber-300/50 bg-amber-50 p-4 dark:bg-amber-400/10">
      <Text className="text-3xl">🔔</Text>
      <View className="flex-1">
        <Text className="text-base font-black text-gray-900 dark:text-white">{t("path.remindTitle")}</Text>
        <Text className="text-xs text-gray-600 dark:text-blue-100/85">{t("path.remindText", { n: reminders.timesPerDay })}</Text>
        <Pressable accessibilityRole="button" onPress={() => void enable()} className="mt-2 self-start rounded-full bg-amber-400 px-4 py-1.5 active:opacity-70">
          <Text className="text-sm font-black text-night-950">{t("path.remindOn")}</Text>
        </Pressable>
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel={t("common.close")} hitSlop={10} onPress={() => void setReminderSettings({ promptDismissed: true })} className="self-start p-1 active:opacity-60">
        <Text className="text-base font-bold text-gray-500 dark:text-blue-200/75">✕</Text>
      </Pressable>
    </Appear>
  );
}

function Section({ section, sectionIndex, status, stars, onOpen, onCurrentLayout }: {
  section: PathSection;
  sectionIndex: number;
  status: Record<string, LessonStatus>;
  stars: (id: string) => number;
  onOpen: (lesson: PathLesson) => void;
  onCurrentLayout: (y: number) => void;
}) {
  const t = useT();
  const sectionY = useRef(0);
  const done = section.lessons.filter((lesson) => status[lesson.id] === "done").length;
  const locked = section.lessons.every((lesson) => status[lesson.id] === "locked");
  const complete = done === section.lessons.length;
  return (
    <View className="mb-6" onLayout={(event) => { sectionY.current = event.nativeEvent.layout.y; }}>
      <View className={`mb-4 overflow-hidden rounded-3xl ${locked ? "opacity-60" : ""}`}>
        {locked ? (
          <View className="flex-row items-center gap-3 bg-white/70 px-5 py-4 dark:bg-white/10">
            <SectionText section={section} sectionIndex={sectionIndex} done={done} light={false} />
          </View>
        ) : (
          <Gradient className="flex-row items-center gap-3 px-5 py-4">
            <SectionText section={section} sectionIndex={sectionIndex} done={done} light />
            {complete ? <Text className="text-2xl">🏆</Text> : null}
          </Gradient>
        )}
      </View>
      <View className="items-center">
        {section.lessons.map((lesson, index) => {
          const offset = OFFSETS[(index + sectionIndex * 3) % OFFSETS.length];
          const lessonStatus = status[lesson.id] ?? "locked";
          return (
            <View
              key={lesson.id}
              style={{ transform: [{ translateX: offset * 90 }], marginBottom: 18 }}
              onLayout={lessonStatus === "current" ? (event) => onCurrentLayout(sectionY.current + event.nativeEvent.layout.y) : undefined}
            >
              <LessonNode lesson={lesson} status={lessonStatus} stars={stars(lesson.id)} onPress={() => onOpen(lesson)} label={t("path.lessonLabel", { n: lesson.index + 1, topic: section.title })} />
            </View>
          );
        })}
      </View>
    </View>
  );
}

function SectionText({ section, sectionIndex, done, light }: { section: PathSection; sectionIndex: number; done: number; light: boolean }) {
  const t = useT();
  return (
    <>
      <Text className="text-3xl">{section.icon ?? "📘"}</Text>
      <View className="flex-1">
        <Text className={`text-xs font-bold uppercase tracking-widest ${light ? "text-night-950/70" : "text-gray-500 dark:text-blue-200/75"}`}>{t("path.unit", { n: sectionIndex + 1 })}</Text>
        <Text className={`text-lg font-black ${light ? "text-night-950" : "text-gray-900 dark:text-white"}`} numberOfLines={1}>{section.title}</Text>
      </View>
      <Text className={`text-sm font-bold ${light ? "text-night-950/80" : "text-gray-500 dark:text-blue-200/75"}`}>{done}/{section.lessons.length}</Text>
    </>
  );
}

function LessonNode({ lesson, status, stars, onPress, label }: { lesson: PathLesson; status: LessonStatus; stars: number; onPress: () => void; label: string }) {
  const t = useT();
  const pulse = useSharedValue(1);
  useEffect(() => {
    pulse.value = status === "current" ? withRepeat(withSequence(withTiming(1.08, { duration: 700 }), withTiming(1, { duration: 700 })), -1, true) : withTiming(1);
  }, [pulse, status]);
  const pulseStyle = useAnimatedStyle(() => ({ transform: [{ scale: pulse.value }] }));
  const icon = status === "locked" ? "🔒" : status === "done" ? (stars >= 3 ? "👑" : "✓") : "★";
  const a11y = status === "locked" ? t("path.locked", { label }) : status === "done" ? t("path.doneStars", { label, n: stars }) : t("path.start", { label });

  return (
    <View className="items-center">
      {status === "current" ? (
        <View className="mb-2 rounded-xl bg-white px-3 py-1 shadow-sm dark:bg-white/15">
          <Text className="text-xs font-black uppercase tracking-wider text-indigo-700 dark:text-mint-300">{t("path.startBubble")}</Text>
        </View>
      ) : null}
      <Animated.View style={pulseStyle}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={a11y}
          disabled={status === "locked"}
          onPress={onPress}
          className="active:scale-95"
          style={{ width: NODE, height: NODE, borderRadius: NODE / 2 }}
        >
          {status === "locked" ? (
            <View className="flex-1 items-center justify-center rounded-full border-b-4 border-gray-300 bg-gray-200 dark:border-white/10 dark:bg-white/10" style={{ borderRadius: NODE / 2 }}>
              <Text className="text-2xl opacity-60">{icon}</Text>
            </View>
          ) : (
            <View className="flex-1 overflow-hidden border-b-4 border-black/20" style={{ borderRadius: NODE / 2 }}>
              <Gradient className="flex-1 items-center justify-center">
                <Text className="text-3xl font-black text-night-950">{icon}</Text>
              </Gradient>
            </View>
          )}
        </Pressable>
      </Animated.View>
      {status === "done" ? (
        <View className="mt-1 flex-row">
          {[1, 2, 3].map((value) => <Text key={value} className="text-base" style={{ opacity: value <= stars ? 1 : 0.25 }}>⭐</Text>)}
        </View>
      ) : (
        <Text className="mt-1 text-xs font-bold text-gray-500 dark:text-blue-200/75">{t("path.lessonShort", { n: lesson.index + 1 })}</Text>
      )}
    </View>
  );
}
