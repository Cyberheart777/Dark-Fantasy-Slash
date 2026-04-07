/**
 * GameOver.tsx
 * Game over screen — shows run stats, shards earned, and Soul Forge shortcut.
 */

import { useGameStore } from "../store/gameStore";
import { useMetaStore } from "../store/metaStore";

interface GameOverProps {
  onRestart: () => void;
}

export function GameOver({ onRestart }: GameOverProps) {
  const { score, kills, wave, survivalTime, level, bestScore, bestWave, shardsThisRun, trialMode } = useGameStore();
  const shards = useMetaStore((s) => s.shards);

  const minutes = Math.floor(survivalTime / 60);
  const seconds = Math.floor(survivalTime % 60);
  const isNewBest = score >= bestScore && score > 0;

  const handleRetryTrial = () => {
    const store = useGameStore.getState();
    const prevBest = store.bestScore;
    const prevWave = store.bestWave;
    store.resetGame();
    store.setBestScore(prevBest, prevWave);
    store.setTrialMode(true);
    store.setPhase("charselect");
  };

  return (
    <div style={styles.overlay}>
      <div style={styles.panel}>
        <div style={styles.titleWrapper}>
          <div style={styles.titleRed}>{trialMode ? "TRIAL FAILED" : "YOU FELL"}</div>
          {isNewBest && !trialMode && (
            <div style={styles.newBest}>✦ NEW BEST ✦</div>
          )}
        </div>

        <div style={styles.statGrid}>
          <StatRow label="Score"        value={score.toLocaleString()} highlight />
          <StatRow label="Wave Reached" value={String(wave)} />
          <StatRow label="Kills"        value={String(kills)} />
          <StatRow label="Level"        value={String(level)} />
          <StatRow label="Survived"     value={`${minutes}:${String(seconds).padStart(2, "0")}`} />
        </div>

        {bestScore > 0 && !trialMode && (
          <div style={styles.bestRow}>
            <span style={{ color: "#888" }}>Best: </span>
            <span style={{ color: "#ffcc00" }}>{bestScore.toLocaleString()}</span>
            <span style={{ color: "#888" }}> pts · Wave {bestWave}</span>
          </div>
        )}

        {/* Soul Shard summary */}
        <div style={styles.shardBox}>
          <div style={styles.shardTitle}>◈ SOUL SHARDS EARNED</div>
          <div style={styles.shardAmount}>+{shardsThisRun.toLocaleString()}</div>
          <div style={styles.shardTotal}>Total: {shards.toLocaleString()} shards</div>
        </div>

        <div style={styles.divider} />

        <div style={styles.btnCol}>
          <button style={styles.btnForge} onClick={() => useGameStore.getState().setPhase("soulforge")}>
            ◈ SOUL FORGE — Spend {shards.toLocaleString()} Shards
          </button>

          <div style={styles.btnRow}>
            {trialMode ? (
              <button style={styles.btnTrial} onClick={handleRetryTrial}>
                🏆 RETRY TRIAL
              </button>
            ) : (
              <button style={styles.btnPrimary} onClick={onRestart}>
                ↻ DESCEND AGAIN
              </button>
            )}
            <button style={styles.btnSecondary} onClick={() => {
              useGameStore.getState().setTrialMode(false);
              useGameStore.getState().setPhase("menu");
            }}>
              ⌂ MAIN MENU
            </button>
          </div>
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
    overflowY: "auto",
    WebkitOverflowScrolling: "touch" as React.CSSProperties["WebkitOverflowScrolling"],
    padding: "20px 0",
  },
  panel: {
    textAlign: "center",
    padding: "40px 48px",
    background: "rgba(8,0,12,0.97)",
    border: "1px solid rgba(180,0,0,0.4)",
    borderRadius: 16,
    boxShadow: "0 0 60px rgba(180,0,0,0.25)",
    minWidth: 340,
    maxWidth: 460,
    width: "90vw",
    boxSizing: "border-box",
  },
  titleWrapper: {
    marginBottom: 24,
  },
  titleRed: {
    fontSize: 52,
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
    gap: "10px 32px",
    justifyContent: "center",
    marginBottom: 16,
  },
  bestRow: {
    fontSize: 13,
    marginBottom: 8,
  },
  shardBox: {
    background: "rgba(60,20,100,0.4)",
    border: "1px solid rgba(120,60,180,0.5)",
    borderRadius: 10,
    padding: "14px",
    marginTop: 8,
  },
  shardTitle: {
    fontSize: 11,
    letterSpacing: 3,
    color: "#9060c0",
    fontFamily: "monospace",
  },
  shardAmount: {
    fontSize: 32,
    fontWeight: 900,
    color: "#d0a0ff",
    textShadow: "0 0 16px #9030d0",
    fontFamily: "monospace",
    lineHeight: 1.3,
  },
  shardTotal: {
    fontSize: 12,
    color: "#7050a0",
    fontFamily: "monospace",
    marginTop: 2,
  },
  divider: {
    height: 1,
    background: "linear-gradient(to right, transparent, rgba(180,0,0,0.4), transparent)",
    margin: "20px 0",
  },
  btnCol: {
    display: "flex",
    flexDirection: "column",
    gap: 12,
  },
  btnForge: {
    width: "100%",
    padding: "14px",
    fontSize: 14,
    fontWeight: "bold",
    letterSpacing: 1,
    color: "#d0a0ff",
    background: "rgba(50,15,90,0.8)",
    border: "1px solid rgba(140,70,200,0.6)",
    borderRadius: 8,
    cursor: "pointer",
    fontFamily: "inherit",
    boxShadow: "0 0 14px rgba(120,40,180,0.3)",
    minHeight: 48,
  },
  btnRow: {
    display: "flex",
    gap: 12,
    justifyContent: "center",
  },
  btnPrimary: {
    flex: 1,
    padding: "14px 20px",
    fontSize: 14,
    fontWeight: "bold",
    letterSpacing: 2,
    color: "#fff",
    background: "linear-gradient(135deg, #aa0000, #770000)",
    border: "1px solid #cc0000",
    borderRadius: 8,
    cursor: "pointer",
    fontFamily: "inherit",
    boxShadow: "0 0 16px rgba(180,0,0,0.4)",
    minHeight: 48,
  },
  btnTrial: {
    flex: 1,
    padding: "14px 20px",
    fontSize: 14,
    fontWeight: "bold",
    letterSpacing: 2,
    color: "#ffd700",
    background: "linear-gradient(135deg, #aa6600, #885000)",
    border: "1px solid #cc8800",
    borderRadius: 8,
    cursor: "pointer",
    fontFamily: "inherit",
    boxShadow: "0 0 16px rgba(200,130,0,0.4)",
    minHeight: 48,
  },
  btnSecondary: {
    flex: 1,
    padding: "14px 20px",
    fontSize: 14,
    fontWeight: "bold",
    letterSpacing: 2,
    color: "#bbb",
    background: "rgba(40,20,60,0.8)",
    border: "1px solid rgba(120,80,160,0.4)",
    borderRadius: 8,
    cursor: "pointer",
    fontFamily: "inherit",
    minHeight: 48,
  },
};
