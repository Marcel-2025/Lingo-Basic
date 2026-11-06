import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from "expo-audio";
import { AppState, type AppStateStatus } from "react-native";

/**
 * Calm looping background track (generated in-house, no third-party samples). Plays only while the app is in the
 * foreground and the "Musik" setting is on; answer tones and speech are mixed on top.
 */
let player: AudioPlayer | null = null;
let wanted = false;

const ensurePlayer = () => {
  if (player) return player;
  player = createAudioPlayer(require("../../assets/music.mp3"));
  player.loop = true;
  player.volume = 0.28;
  return player;
};

const apply = (appState: AppStateStatus = AppState.currentState) => {
  try {
    if (wanted && appState === "active") {
      const p = ensurePlayer();
      if (!p.playing) p.play();
    } else if (player?.playing) {
      player.pause();
    }
  } catch {
    // Music is optional.
  }
};

AppState.addEventListener("change", (state) => apply(state));
void setAudioModeAsync({ playsInSilentMode: false, interruptionMode: "mixWithOthers", shouldPlayInBackground: false }).catch(() => undefined);

/** Turns the music on or off (called from the settings and on app start). */
export const setMusicEnabled = (enabled: boolean) => {
  wanted = enabled;
  apply();
};
