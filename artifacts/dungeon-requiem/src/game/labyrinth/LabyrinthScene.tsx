/**
 * LabyrinthScene.tsx — Root scene for The Labyrinth game mode.
 *
 * Design: this scene is a plugin to the core game. It reuses existing
 * combat, enemy AI, power-ups, and gear systems via selective imports,
 * but owns its own map generation, closing zone, enemy placement, and
 * loot placement. Nothing in the core GameScene is modified.
 *
 * Build order (see spec):
 *   1. Maze generation — render navigable maze                          [WIP]
 *   2. Zone shrink
 *   3. Enemy placement
 *   4. Loot placement
 *   5. Labyrinth Warden (mini-boss)
 *   6. Center boss / extraction
 *   7. Scoring & leaderboard
 *   8. Menu integration (done — this file is the entry point)
 *   9. Polish
 */

import { useGameStore } from "../../store/gameStore";

export function LabyrinthScene() {
  const setPhase = useGameStore((s) => s.setPhase);

  // Placeholder UI — replaced in step 1 with a full 3D canvas + maze.
  // For now, clicking any menu-derived phase just lands here, and the
  // user can back out to the main menu to verify nothing in the core
  // game is disturbed.
  return (
    <div style={styles.root}>
      <div style={styles.panel}>
        <div style={styles.title}>THE LABYRINTH</div>
        <div style={styles.subtitle}>Construction in progress</div>
        <div style={styles.statusList}>
          <div style={styles.statusRow}>○ Step 1 — Maze generation</div>
          <div style={styles.statusRow}>○ Step 2 — Closing zone</div>
          <div style={styles.statusRow}>○ Step 3 — Enemy placement</div>
          <div style={styles.statusRow}>○ Step 4 — Loot placement</div>
          <div style={styles.statusRow}>○ Step 5 — Labyrinth Warden</div>
          <div style={styles.statusRow}>○ Step 6 — Center boss / extraction</div>
          <div style={styles.statusRow}>○ Step 7 — Scoring & leaderboard</div>
          <div style={styles.statusRow}>✔ Step 8 — Menu integration</div>
        </div>
        <button style={styles.backBtn} onClick={() => setPhase("menu")}>
          ← BACK TO MAIN MENU
        </button>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  root: {
    position: "absolute",
    inset: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "radial-gradient(ellipse at center, #0a0618 0%, #04000a 100%)",
    fontFamily: "'Segoe UI', monospace",
  },
  panel: {
    padding: "48px 56px",
    background: "rgba(6,3,12,0.92)",
    border: "1px solid rgba(60,140,220,0.4)",
    borderRadius: 16,
    boxShadow: "0 0 40px rgba(40,120,200,0.2)",
    minWidth: 380,
    textAlign: "center",
  },
  title: {
    fontSize: 32,
    fontWeight: 900,
    letterSpacing: 8,
    color: "#aadfff",
    textShadow: "0 0 20px rgba(60,140,220,0.6)",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 12,
    color: "rgba(170,223,255,0.6)",
    letterSpacing: 3,
    marginBottom: 24,
  },
  statusList: {
    textAlign: "left",
    marginBottom: 28,
    display: "flex",
    flexDirection: "column",
    gap: 6,
  },
  statusRow: {
    fontSize: 12,
    color: "rgba(200,220,240,0.7)",
    letterSpacing: 1,
    fontFamily: "monospace",
  },
  backBtn: {
    padding: "12px 28px",
    fontSize: 13,
    fontWeight: "bold",
    letterSpacing: 2,
    color: "#aadfff",
    background: "rgba(10,25,50,0.8)",
    border: "1px solid rgba(60,140,220,0.5)",
    borderRadius: 8,
    cursor: "pointer",
    fontFamily: "inherit",
  },
};
