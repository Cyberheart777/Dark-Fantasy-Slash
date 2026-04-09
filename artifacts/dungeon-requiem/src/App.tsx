/**
 * App.tsx — Root component.
 * Phase-based state machine. GameScene handles all game logic.
 */

import { useCallback, useEffect } from "react";
import { useGameStore } from "./store/gameStore";
import { audioManager } from "./audio/AudioManager";
import type { SoundKey } from "./audio/SoundData";
import { GameScene } from "./game/GameScene";
import { MainMenu } from "./ui/MainMenu";
import { CharacterSelect } from "./ui/CharacterSelect";
import { SoulForge } from "./ui/SoulForge";
import { GameOver } from "./ui/GameOver";
import { TrialVictory } from "./ui/TrialVictory";

/** Pick the music track that should be playing for a given phase. */
function musicForPhase(phase: string): SoundKey | null {
  switch (phase) {
    case "menu":
    case "charselect":
    case "soulforge":
      return "music_menu";
    case "playing":
    case "paused":
    case "levelup":
      return "music_dungeon";
    case "gameover":
    case "trialvictory":
    default:
      return null; // silence — respectful pause after death / victory
  }
}

export default function App() {
  const phase = useGameStore((s) => s.phase);

  // ── Centralized music controller ──────────────────────────────────────────
  // Watches phase and plays the matching music track. playMusic() is
  // idempotent: calling it with the same key while already playing is a no-op,
  // so transitions like playing→paused→playing don't restart the track.
  useEffect(() => {
    const key = musicForPhase(phase);
    if (key) audioManager.playMusic(key);
    else audioManager.stopMusic();
  }, [phase]);

  // Kickstart audio on the first user gesture — browsers block AudioContext
  // until the user interacts with the page. Once unlocked, retry the current
  // phase's music so it actually starts playing.
  useEffect(() => {
    audioManager.preload(); // load any file-backed sounds defined in SoundData
    const unlock = () => {
      audioManager.resume();
      const key = musicForPhase(useGameStore.getState().phase);
      if (key) audioManager.playMusic(key);
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
    window.addEventListener("pointerdown", unlock);
    window.addEventListener("keydown", unlock);
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, []);

  const handleRestart = useCallback(() => {
    const store = useGameStore.getState();
    const prevBest = store.bestScore;
    const prevWave = store.bestWave;
    store.resetGame();
    store.setBestScore(prevBest, prevWave);
  }, []);

  const handleTrialRetry = useCallback(() => {
    const store = useGameStore.getState();
    const prevBest = store.bestScore;
    const prevWave = store.bestWave;
    store.resetGame();
    store.setBestScore(prevBest, prevWave);
    store.setTrialMode(true);
    store.setPhase("charselect");
  }, []);

  return (
    <div style={styles.root}>
      {phase === "menu"       && <MainMenu />}
      {phase === "charselect" && <CharacterSelect />}
      {phase === "soulforge"  && <SoulForge />}

      {(phase !== "menu" && phase !== "charselect" && phase !== "soulforge") && (
        <GameScene onRestart={handleRestart} />
      )}

      {phase === "gameover" && (
        <GameOver onRestart={handleRestart} />
      )}

      {phase === "trialvictory" && (
        <TrialVictory onRetry={handleTrialRetry} />
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  root: {
    width: "100vw",
    height: "100vh",
    overflow: "hidden",
    background: "#04000a",
    position: "relative",
    fontFamily: "'Segoe UI', monospace",
    userSelect: "none",
  },
};
