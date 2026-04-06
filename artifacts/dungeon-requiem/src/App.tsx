/**
 * App.tsx — Root component.
 * Phase-based state machine. GameScene handles all game logic.
 */

import { useCallback } from "react";
import { useGameStore } from "./store/gameStore";
import { GameScene } from "./game/GameScene";
import { MainMenu } from "./ui/MainMenu";
import { CharacterSelect } from "./ui/CharacterSelect";
import { SoulForge } from "./ui/SoulForge";
import { GameOver } from "./ui/GameOver";

export default function App() {
  const phase = useGameStore((s) => s.phase);

  const handleRestart = useCallback(() => {
    const store = useGameStore.getState();
    const prevBest = store.bestScore;
    const prevWave = store.bestWave;
    store.resetGame();
    store.setBestScore(prevBest, prevWave);
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
