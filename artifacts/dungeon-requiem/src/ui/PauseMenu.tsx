/**
 * PauseMenu.tsx
 * Pause overlay with resume and quit options.
 */

import { useGameStore } from "../store/gameStore";

export function PauseMenu() {
  const { setPhase } = useGameStore();

  return (
    <div style={styles.overlay}>
      <div style={styles.panel}>
        <div style={styles.title}>PAUSED</div>
        <div style={styles.sub}>The dungeon holds its breath...</div>

        <div style={styles.divider} />

        <div style={styles.btnCol}>
          <button style={styles.btnPrimary} onClick={() => setPhase("playing")}>
            ▶ RESUME
          </button>
          <button style={styles.btnSecondary} onClick={() => setPhase("menu")}>
            ⌂ MAIN MENU
          </button>
        </div>

        <div style={styles.controls}>
          <span style={{ color: "rgba(180,160,200,0.4)" }}>Press ESC to resume</span>
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: "absolute",
    inset: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "rgba(0,0,0,0.75)",
    backdropFilter: "blur(8px)",
    fontFamily: "'Segoe UI', monospace",
    zIndex: 100,
  },
  panel: {
    textAlign: "center",
    padding: "48px 64px",
    background: "rgba(6,3,12,0.97)",
    border: "1px solid rgba(80,50,120,0.5)",
    borderRadius: 16,
    boxShadow: "0 0 40px rgba(60,0,120,0.25)",
    minWidth: 320,
  },
  title: {
    fontSize: 52,
    fontWeight: "900",
    color: "#aa88cc",
    letterSpacing: 10,
    textShadow: "0 0 20px #6600aa",
    marginBottom: 8,
  },
  sub: {
    color: "rgba(180,160,200,0.5)",
    fontSize: 14,
    fontStyle: "italic",
    letterSpacing: 1,
  },
  divider: {
    height: 1,
    background: "linear-gradient(to right, transparent, rgba(80,50,120,0.5), transparent)",
    margin: "28px 0",
  },
  btnCol: {
    display: "flex",
    flexDirection: "column",
    gap: 12,
    alignItems: "center",
  },
  btnPrimary: {
    width: 200,
    padding: "14px",
    fontSize: 16,
    fontWeight: "bold",
    letterSpacing: 3,
    color: "#fff",
    background: "linear-gradient(135deg, #5500aa, #3a0077)",
    border: "1px solid #7700cc",
    borderRadius: 8,
    cursor: "pointer",
    fontFamily: "inherit",
    boxShadow: "0 0 20px rgba(80,0,180,0.4)",
  },
  btnSecondary: {
    width: 200,
    padding: "12px",
    fontSize: 15,
    fontWeight: "bold",
    letterSpacing: 2,
    color: "#bbb",
    background: "rgba(30,15,45,0.8)",
    border: "1px solid rgba(80,50,120,0.4)",
    borderRadius: 8,
    cursor: "pointer",
    fontFamily: "inherit",
  },
  controls: {
    marginTop: 24,
    fontSize: 12,
  },
};
