/**
 * App.tsx — Root component.
 * Phase-based state machine. GameScene handles all game logic.
 */

import { useCallback, useEffect, useRef } from "react";
import { useGameStore } from "./store/gameStore";
import { audioManager } from "./audio/AudioManager";
import type { SoundKey } from "./audio/SoundData";
import { GameScene } from "./game/GameScene";
import { MainMenu } from "./ui/MainMenu";
import { CharacterSelect } from "./ui/CharacterSelect";
import { SoulForge } from "./ui/SoulForge";
import { GameOver } from "./ui/GameOver";
import { TrialVictory } from "./ui/TrialVictory";
import { LabyrinthScene } from "./game/labyrinth/LabyrinthScene";
import { LabyrinthCharSelect } from "./game/labyrinth/LabyrinthCharSelect";

/** Pick the music track that should be playing for a given phase. */
function musicForPhase(phase: string): SoundKey | null {
  switch (phase) {
    case "menu":
    case "charselect":
    case "soulforge":
    case "labyrinth_charselect":
      return "music_menu";
    case "playing":
    case "paused":
    case "levelup":
    case "labyrinth":
      return "music_dungeon";
    case "gameover":
    case "trialvictory":
    default:
      return null; // silence — respectful pause after death / victory
  }
}

export default function App() {
  const phase = useGameStore((s) => s.phase);
  const prevPhaseRef = useRef(phase);
  useEffect(() => { if (phase !== "levelup") prevPhaseRef.current = phase; }, [phase]);
  const masterVolume = useGameStore((s) => s.masterVolume);
  const sfxVolume = useGameStore((s) => s.sfxVolume);
  const musicVolume = useGameStore((s) => s.musicVolume);
  const muted = useGameStore((s) => s.muted);

  // Propagate volume settings to the AudioManager whenever they change.
  // Without this, the sliders in the pause menu would update store state
  // but leave the actual audio output unchanged.
  useEffect(() => {
    audioManager.setVolume(masterVolume, sfxVolume, musicVolume, muted);
  }, [masterVolume, sfxVolume, musicVolume, muted]);

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
  // until the user interacts with the page. Once unlocked, FORCE-restart the
  // current phase's music. We can't just call playMusic again because the
  // phase-change useEffect already called it on mount (while suspended), and
  // the synth fallback set _musicNodes.osc internally — playMusic's
  // idempotent guard would now return early thinking music is already
  // playing. stopMusic() clears that stale state so the second call
  // actually starts the file-backed track.
  useEffect(() => {
    audioManager.preload(); // load file-backed sounds + music variants
    const unlock = () => {
      audioManager.resume();
      const key = musicForPhase(useGameStore.getState().phase);
      if (key) {
        audioManager.stopMusic(); // clear any stale synth-fallback state
        audioManager.playMusic(key); // start the real track now that ctx is live
      }
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
      {phase === "menu"                 && <MainMenu />}
      {phase === "charselect"           && <CharacterSelect />}
      {phase === "soulforge"            && <SoulForge />}
      {phase === "labyrinth_charselect" && <LabyrinthCharSelect />}
      {(phase === "labyrinth" || (phase === "levelup" && prevPhaseRef.current === "labyrinth")) && <LabyrinthScene />}

      {(phase !== "menu"
        && phase !== "charselect"
        && phase !== "soulforge"
        && phase !== "labyrinth"
        && phase !== "labyrinth_charselect"
        && !(phase === "levelup" && prevPhaseRef.current === "labyrinth")) && (
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
