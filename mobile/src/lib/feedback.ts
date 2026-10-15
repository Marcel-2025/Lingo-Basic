import { createAudioPlayer, type AudioPlayer } from "expo-audio";
import * as Haptics from "expo-haptics";
import * as Speech from "expo-speech";
import { SUPPORTED_LANGUAGES } from "@/app/lib/languages";
import type { LanguageCode } from "@/app/lib/types";

let correctPlayer: AudioPlayer | null = null;
let wrongPlayer: AudioPlayer | null = null;

/** Short answer tones (generated sine/saw tones, no external assets). Players are created lazily and reused. */
export const playAnswerTone = (correct: boolean) => {
  try {
    if (correct) {
      correctPlayer ??= createAudioPlayer(require("../../assets/correct.wav"));
      correctPlayer.seekTo(0);
      correctPlayer.play();
    } else {
      wrongPlayer ??= createAudioPlayer(require("../../assets/wrong.wav"));
      wrongPlayer.seekTo(0);
      wrongPlayer.play();
    }
  } catch {
    // Audio feedback is optional.
  }
};

export const vibrate = (correct: boolean) => {
  void Haptics.notificationAsync(correct ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Error).catch(() => undefined);
};

export const speak = (text: string, language: "DE" | LanguageCode) => {
  Speech.stop();
  Speech.speak(text, { language: language === "DE" ? "de-DE" : SUPPORTED_LANGUAGES[language].speechCode });
};
