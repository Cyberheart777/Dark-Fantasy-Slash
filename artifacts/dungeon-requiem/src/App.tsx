/**
 * App.tsx
 * Root application component.
 * GameScene (R3F Canvas) stays mounted throughout the session.
 * Screens overlay on top rather than re-mounting the Canvas.
 */

import { useRef, useEffect, useCallback } from "react";
import { useGameStore } from "./store/gameStore";
import { GameManager } from "./game/GameManager";
import { MainMenu } from "./ui/MainMenu";
import { GameScene } from "./game/GameScene";
import { GameOver } from "./ui/GameOver";

export default function App() {
  const phase = useGameStore((s) => s.phase);
  const managerRef = useRef<GameManager | null>(null);

  if (!managerRef.current) {
    managerRef.current = new GameManager();
  }

  // Start when phase changes to playing
  useEffect(() => {
    const manager = managerRef.current!;
    if (phase === "playing" && !manager.running) {
      manager.start();
    } else if (phase === "gameover") {
      manager.stop();
    }
  }, [phase]);

  const handleRestart = useCallback(() => {
    const manager = managerRef.current!;
    const store = useGameStore.getState();
    const prevBest = store.bestScore;
    const prevWave = store.bestWave;
    manager.reset();
    store.resetGame();
    store.setBestScore(prevBest, prevWave);
    // Small delay to let state settle
    requestAnimationFrame(() => {
      manager.start();
    });
  }, []);

  return (
    <div style={styles.root}>
      {/* Main menu */}
      {phase === "menu" && <MainMenu />}

      {/* 3D canvas — visible during all game phases */}
      {phase !== "menu" && (
        <GameScene manager={managerRef.current} onRestart={handleRestart} />
      )}

      {/* Game over overlay */}
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
