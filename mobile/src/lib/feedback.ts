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

/** Voices the device offers, grouped by language ("de", "en", …). Loaded once; speech falls back to the language code alone. */
let voicesByLanguage: Map<string, Speech.Voice[]> | null = null;
let voicesLoading: Promise<void> | null = null;
const loadVoices = () => {
  voicesLoading ??= Speech.getAvailableVoicesAsync()
    .then((voices) => {
      voicesByLanguage = new Map();
      for (const voice of voices) {
        const key = voice.language.toLowerCase().slice(0, 2);
        voicesByLanguage.set(key, [...(voicesByLanguage.get(key) ?? []), voice]);
      }
    })
    .catch(() => undefined);
  return voicesLoading;
};
void loadVoices();

/** Picks a voice that really speaks `speechCode` (prefers an exact locale match, then enhanced/network quality). */
const pickVoice = (speechCode: string) => {
  const candidates = voicesByLanguage?.get(speechCode.toLowerCase().slice(0, 2)) ?? [];
  if (candidates.length === 0) return undefined;
  const exact = candidates.filter((voice) => voice.language.toLowerCase().replace("_", "-") === speechCode.toLowerCase());
  const pool = exact.length ? exact : candidates;
  return (pool.find((voice) => voice.quality === Speech.VoiceQuality.Enhanced) ?? pool[0]).identifier;
};

/** Reads `text` in `language` using a matching system voice, so a German word never comes out with an English accent. */
export const speak = (text: string, language: LanguageCode, options: { slow?: boolean } = {}) => {
  const speechCode = SUPPORTED_LANGUAGES[language].speechCode;
  Speech.stop();
  Speech.speak(text, { language: speechCode, voice: pickVoice(speechCode), rate: options.slow ? 0.55 : 0.95 });
};
