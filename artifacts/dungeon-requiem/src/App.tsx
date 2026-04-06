/**
 * App.tsx
 * React wrapper for the Phaser game.
 * The game runs inside a dedicated div; React handles the outer shell/meta only.
 * STEAM NOTE: In an Electron/Tauri build, this React shell could be removed
 * and the game can be mounted directly into a native window element.
 */

import { useEffect, useRef } from "react";
import { createGame, destroyGame } from "./game/GameInstance";

export default function App() {
  const containerRef = useRef<HTMLDivElement>(null);
  const mounted = useRef(false);

  useEffect(() => {
    if (mounted.current) return;
    mounted.current = true;

    if (containerRef.current) {
      createGame("game-container");
    }

    return () => {
      destroyGame();
      mounted.current = false;
    };
  }, []);

  return (
    <div
      style={{
        width: "100vw",
        height: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#04000a",
        overflow: "hidden",
      }}
    >
      <div
        id="game-container"
        ref={containerRef}
        style={{ width: "100%", height: "100%" }}
      />
    </div>
  );
}
