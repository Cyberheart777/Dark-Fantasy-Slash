/**
 * MainMenu.tsx
 * Dark fantasy main menu overlay.
 */

import { useGameStore } from "../store/gameStore";
import { useMetaStore } from "../store/metaStore";

export function MainMenu() {
  const { setPhase, bestScore, bestWave } = useGameStore();
  const shards = useMetaStore((s) => s.shards);

  return (
    <div style={styles.overlay}>
      {/* Background vignette */}
      <div style={styles.vignette} />

      <div style={styles.panel}>
        {/* Title */}
        <div style={styles.titleWrapper}>
          <div style={styles.titleGlow}>DUNGEON</div>
          <div style={styles.titleMain}>DUNGEON</div>
          <div style={styles.subtitleGlow}>REQUIEM</div>
          <div style={styles.subtitle}>REQUIEM</div>
        </div>

        <div style={styles.tagline}>A dark descent awaits. Survive the undying.</div>

        <div style={styles.divider} />

        <button
          style={styles.btnPrimary}
          onClick={() => setPhase("charselect")}
        >
          ⚔ BEGIN DESCENT
        </button>

        <button
          style={styles.btnForge}
          onClick={() => setPhase("soulforge")}
        >
          <span style={styles.forgeShard}>◈</span>
          {" "}SOUL FORGE
          {shards > 0 && (
            <span style={styles.forgeShardCount}> · {shards.toLocaleString()} shards</span>
          )}
        </button>

        {bestScore > 0 && (
          <div style={styles.bestScore}>
            <span style={{ color: "#888" }}>Best Run:</span>
            <span style={{ color: "#ffcc00" }}> {bestScore.toLocaleString()} pts</span>
            <span style={{ color: "#888" }}> · Wave {bestWave}</span>
          </div>
        )}

        <div style={styles.divider} />

        <div style={styles.controlsList}>
          <div style={styles.controlsTitle}>CONTROLS</div>
          <div style={styles.controlsGrid}>
            <span style={styles.key}>W A S D</span><span style={styles.action}>Move</span>
            <span style={styles.key}>Mouse</span><span style={styles.action}>Aim</span>
            <span style={styles.key}>LMB / Space</span><span style={styles.action}>Attack</span>
            <span style={styles.key}>Shift</span><span style={styles.action}>Dash (invincible)</span>
            <span style={styles.key}>ESC</span><span style={styles.action}>Pause</span>
          </div>
        </div>
      </div>

      <div style={styles.footer}>Low-poly 3D dungeon crawler · Survive endless waves</div>
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
    background: "radial-gradient(ellipse at center, #12001a 0%, #04000a 100%)",
    fontFamily: "'Segoe UI', monospace",
  },
  vignette: {
    position: "absolute",
    inset: 0,
    background: "radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.8) 100%)",
    pointerEvents: "none",
  },
  panel: {
    textAlign: "center",
    padding: "48px 56px",
    background: "rgba(0,0,0,0.7)",
    border: "1px solid rgba(120,40,180,0.4)",
    borderRadius: 16,
    backdropFilter: "blur(8px)",
    boxShadow: "0 0 60px rgba(100,0,160,0.3), inset 0 0 30px rgba(80,0,120,0.1)",
    minWidth: 400,
    position: "relative",
    zIndex: 1,
  },
  titleWrapper: {
    position: "relative",
    marginBottom: 8,
  },
  titleMain: {
    fontSize: 62,
    fontWeight: "900",
    color: "#cc88ff",
    letterSpacing: 12,
    lineHeight: 1.1,
    position: "relative",
    zIndex: 2,
  },
  titleGlow: {
    position: "absolute",
    fontSize: 62,
    fontWeight: "900",
    color: "transparent",
    letterSpacing: 12,
    lineHeight: 1.1,
    width: "100%",
    textShadow: "0 0 30px #aa00ff, 0 0 60px #8800cc",
    zIndex: 1,
  },
  subtitle: {
    fontSize: 44,
    fontWeight: "900",
    color: "#ff4444",
    letterSpacing: 14,
    lineHeight: 1.0,
    position: "relative",
    zIndex: 2,
  },
  subtitleGlow: {
    position: "absolute",
    fontSize: 44,
    fontWeight: "900",
    color: "transparent",
    letterSpacing: 14,
    lineHeight: 1.0,
    width: "100%",
    textShadow: "0 0 25px #ff0000, 0 0 50px #cc0000",
    zIndex: 1,
  },
  tagline: {
    color: "rgba(200,180,220,0.7)",
    fontSize: 14,
    letterSpacing: 2,
    marginTop: 16,
    marginBottom: 8,
    fontStyle: "italic",
  },
  divider: {
    height: 1,
    background: "linear-gradient(to right, transparent, rgba(120,40,180,0.5), transparent)",
    margin: "20px 0",
  },
  btnPrimary: {
    padding: "16px 48px",
    fontSize: 18,
    fontWeight: "bold",
    letterSpacing: 3,
    color: "#fff",
    background: "linear-gradient(135deg, #6600aa, #440077)",
    border: "1px solid #8800cc",
    borderRadius: 8,
    cursor: "pointer",
    transition: "all 0.2s",
    boxShadow: "0 0 20px rgba(100,0,180,0.5)",
    fontFamily: "inherit",
  },
  btnForge: {
    marginTop: 10,
    padding: "12px 32px",
    fontSize: 14,
    fontWeight: "bold",
    letterSpacing: 2,
    color: "#c0a0e0",
    background: "rgba(40,10,70,0.7)",
    border: "1px solid rgba(120,60,160,0.5)",
    borderRadius: 8,
    cursor: "pointer",
    fontFamily: "inherit",
  },
  forgeShard: {
    color: "#d0a0ff",
    fontSize: 16,
  },
  forgeShardCount: {
    color: "#9060c0",
    fontSize: 12,
  },
  bestScore: {
    marginTop: 16,
    fontSize: 14,
    color: "#888",
  },
  controlsList: {
    textAlign: "left",
  },
  controlsTitle: {
    color: "rgba(180,160,220,0.7)",
    fontSize: 11,
    letterSpacing: 3,
    fontWeight: "bold",
    marginBottom: 12,
    textAlign: "center",
  },
  controlsGrid: {
    display: "grid",
    gridTemplateColumns: "auto 1fr",
    gap: "8px 20px",
    alignItems: "center",
  },
  key: {
    background: "rgba(255,255,255,0.08)",
    border: "1px solid rgba(255,255,255,0.15)",
    borderRadius: 4,
    padding: "3px 8px",
    fontSize: 12,
    color: "#ddd",
    fontWeight: "bold",
    whiteSpace: "nowrap",
  },
  action: {
    color: "rgba(200,180,220,0.8)",
    fontSize: 13,
  },
  footer: {
    position: "absolute",
    bottom: 24,
    left: "50%",
    transform: "translateX(-50%)",
    color: "rgba(120,100,140,0.5)",
    fontSize: 12,
    letterSpacing: 2,
    whiteSpace: "nowrap",
  },
};
