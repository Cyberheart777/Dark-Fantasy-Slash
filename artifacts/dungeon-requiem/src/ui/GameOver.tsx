/**
 * GameOver.tsx
 * Game over screen with stats and restart.
 */

import { useGameStore } from "../store/gameStore";

interface GameOverProps {
  onRestart: () => void;
}

export function GameOver({ onRestart }: GameOverProps) {
  const { score, kills, wave, survivalTime, level, bestScore, bestWave } = useGameStore();

  const minutes = Math.floor(survivalTime / 60);
  const seconds = Math.floor(survivalTime % 60);
  const isNewBest = score >= bestScore && score > 0;

  return (
    <div style={styles.overlay}>
      <div style={styles.panel}>
        <div style={styles.titleWrapper}>
          <div style={styles.titleRed}>YOU FELL</div>
          {isNewBest && (
            <div style={styles.newBest}>✦ NEW BEST ✦</div>
          )}
        </div>

        <div style={styles.statGrid}>
          <StatRow label="Score" value={score.toLocaleString()} highlight />
          <StatRow label="Wave Reached" value={String(wave)} />
          <StatRow label="Kills" value={String(kills)} />
          <StatRow label="Level" value={String(level)} />
          <StatRow label="Survived" value={`${minutes}:${String(seconds).padStart(2, "0")}`} />
        </div>

        {bestScore > 0 && (
          <div style={styles.bestRow}>
            <span style={{ color: "#888" }}>Best: </span>
            <span style={{ color: "#ffcc00" }}>{bestScore.toLocaleString()}</span>
            <span style={{ color: "#888" }}> pts · Wave {bestWave}</span>
          </div>
        )}

        <div style={styles.divider} />

        <div style={styles.btnRow}>
          <button style={styles.btnPrimary} onClick={onRestart}>
            ↻ DESCEND AGAIN
          </button>
          <button style={styles.btnSecondary} onClick={() => useGameStore.getState().setPhase("menu")}>
            ⌂ MAIN MENU
          </button>
        </div>
      </div>
    </div>
  );
}

function StatRow({ label, value, highlight = false }: { label: string; value: string; highlight?: boolean }) {
  return (
    <>
      <span style={{ color: "rgba(180,160,200,0.7)", fontSize: 14 }}>{label}</span>
      <span style={{
        color: highlight ? "#ffcc00" : "#ddd",
        fontWeight: highlight ? "bold" : "normal",
        fontSize: highlight ? 22 : 16,
        textShadow: highlight ? "0 0 10px #ffaa00" : "none",
      }}>{value}</span>
    </>
  );
}

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: "absolute",
    inset: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "rgba(0,0,0,0.85)",
    backdropFilter: "blur(6px)",
    fontFamily: "'Segoe UI', monospace",
  },
  panel: {
    textAlign: "center",
    padding: "48px 64px",
    background: "rgba(8,0,12,0.95)",
    border: "1px solid rgba(180,0,0,0.4)",
    borderRadius: 16,
    boxShadow: "0 0 60px rgba(180,0,0,0.25)",
    minWidth: 380,
  },
  titleWrapper: {
    marginBottom: 32,
  },
  titleRed: {
    fontSize: 56,
    fontWeight: "900",
    color: "#cc2222",
    letterSpacing: 8,
    textShadow: "0 0 30px #aa0000",
  },
  newBest: {
    color: "#ffcc00",
    fontSize: 16,
    letterSpacing: 4,
    marginTop: 8,
    textShadow: "0 0 15px #ffaa00",
    fontWeight: "bold",
  },
  statGrid: {
    display: "grid",
    gridTemplateColumns: "auto auto",
    gap: "12px 40px",
    justifyContent: "center",
    marginBottom: 20,
  },
  bestRow: {
    fontSize: 14,
    marginBottom: 8,
  },
  divider: {
    height: 1,
    background: "linear-gradient(to right, transparent, rgba(180,0,0,0.4), transparent)",
    margin: "20px 0",
  },
  btnRow: {
    display: "flex",
    gap: 16,
    justifyContent: "center",
  },
  btnPrimary: {
    padding: "14px 32px",
    fontSize: 16,
    fontWeight: "bold",
    letterSpacing: 2,
    color: "#fff",
    background: "linear-gradient(135deg, #aa0000, #770000)",
    border: "1px solid #cc0000",
    borderRadius: 8,
    cursor: "pointer",
    fontFamily: "inherit",
    boxShadow: "0 0 20px rgba(180,0,0,0.4)",
  },
  btnSecondary: {
    padding: "14px 32px",
    fontSize: 16,
    fontWeight: "bold",
    letterSpacing: 2,
    color: "#bbb",
    background: "rgba(40,20,60,0.8)",
    border: "1px solid rgba(120,80,160,0.4)",
    borderRadius: 8,
    cursor: "pointer",
    fontFamily: "inherit",
  },
};
