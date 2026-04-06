/**
 * HUD.tsx
 * React DOM overlay rendered on top of the R3F canvas.
 * Shows HP bar, XP bar, wave info, and upgrades.
 */

import { useGameStore } from "../store/gameStore";
import { useEffect, useRef, useState } from "react";

export function HUD() {
  const {
    playerHP, playerMaxHP, xp, xpToNext, level,
    wave, score, kills, survivalTime,
    acquiredUpgrades, isDashing, isAttacking,
    bossHP, bossMaxHP, bossName, bossAlive, bossSpecialWarn,
  } = useGameStore();

  // Boss arrival announcement
  const prevBossAlive = useRef(false);
  const [bossAnnounce, setBossAnnounce] = useState(false);
  const announceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (bossAlive && !prevBossAlive.current) {
      setBossAnnounce(true);
      if (announceTimer.current) clearTimeout(announceTimer.current);
      announceTimer.current = setTimeout(() => setBossAnnounce(false), 3200);
    }
    prevBossAlive.current = bossAlive;
    return () => { if (announceTimer.current) clearTimeout(announceTimer.current); };
  }, [bossAlive]);

  const hpPct = Math.max(0, playerHP / playerMaxHP) * 100;
  const xpPct = Math.min(100, (xp / xpToNext) * 100);
  const minutes = Math.floor(survivalTime / 60);
  const seconds = Math.floor(survivalTime % 60);
  const timeStr = `${minutes}:${String(seconds).padStart(2, "0")}`;

  const hpColor = hpPct > 50 ? "#22cc55" : hpPct > 25 ? "#ff8800" : "#cc2222";

  const upgradeEntries = Object.entries(acquiredUpgrades).filter(([, v]) => v > 0);

  return (
    <div style={styles.hud}>
      {/* Top-left: player vitals */}
      <div style={styles.vitals}>
        {/* HP bar */}
        <div style={styles.barLabel}>
          <span style={{ color: "#ff6666", fontWeight: "bold" }}>HP</span>
          <span style={{ color: "#ccc", fontSize: 13 }}>{Math.ceil(playerHP)}/{playerMaxHP}</span>
        </div>
        <div style={styles.barTrack}>
          <div style={{ ...styles.barFill, width: `${hpPct}%`, background: hpColor, boxShadow: `0 0 8px ${hpColor}` }} />
        </div>

        {/* XP bar */}
        <div style={{ ...styles.barLabel, marginTop: 8 }}>
          <span style={{ color: "#aaffaa", fontWeight: "bold" }}>XP</span>
          <span style={{ color: "#ccc", fontSize: 13 }}>Lv.{level}</span>
        </div>
        <div style={styles.barTrack}>
          <div style={{ ...styles.barFill, width: `${xpPct}%`, background: "#44ff88", boxShadow: "0 0 8px #44ff88" }} />
        </div>
      </div>

      {/* Top-center: wave/score */}
      <div style={styles.center}>
        <div style={styles.waveText}>WAVE {wave}</div>
        <div style={styles.statsRow}>
          <span>⚔ {kills}</span>
          <span>★ {score.toLocaleString()}</span>
          <span>⏱ {timeStr}</span>
        </div>
      </div>

      {/* Controls hint */}
      <div style={styles.controls}>
        <span>WASD Move</span>
        <span>Mouse Aim</span>
        <span>LMB / Space Attack</span>
        <span>Shift Dash</span>
        <span>ESC Pause</span>
      </div>

      {/* Bottom-left: upgrades */}
      {upgradeEntries.length > 0 && (
        <div style={styles.upgradePanel}>
          <div style={styles.upgradeTitle}>UPGRADES</div>
          <div style={styles.upgradeGrid}>
            {upgradeEntries.map(([id, count]) => (
              <div key={id} style={styles.upgradeChip}>
                <span style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: 1, color: "#ddd" }}>
                  {id.replace(/_/g, " ")}
                </span>
                {count > 1 && <span style={{ color: "#ffcc00", marginLeft: 4, fontWeight: "bold" }}>×{count}</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Dash cooldown indicator */}
      <div style={{ ...styles.actionIndicator, opacity: isDashing ? 1 : 0.3 }}>
        <span style={{ color: isDashing ? "#88aaff" : "#666" }}>◈ DASH</span>
      </div>

      {/* Boss HP bar — full width, center-bottom, shown only when boss is alive */}
      {bossAlive && bossMaxHP > 0 && (
        <div style={styles.bossBar}>
          <div style={styles.bossBarHeader}>
            <span style={styles.bossBarName}>{bossName}</span>
            {bossSpecialWarn && (
              <span style={styles.bossWarn}>⚠ SHOCKWAVE INCOMING</span>
            )}
          </div>
          <div style={styles.bossBarTrack}>
            <div style={{
              ...styles.bossBarFill,
              width: `${Math.max(0, (bossHP / bossMaxHP)) * 100}%`,
            }} />
          </div>
          <div style={styles.bossBarFooter}>
            <span style={{ color: "#aaa", fontSize: 11 }}>
              {Math.max(0, Math.ceil(bossHP)).toLocaleString()} / {bossMaxHP.toLocaleString()}
            </span>
          </div>
        </div>
      )}

      {/* Boss arrival announcement */}
      {bossAnnounce && (
        <div style={styles.bossAnnounce}>
          <div style={styles.bossAnnounceTop}>⚠ BOSS APPROACHES ⚠</div>
          <div style={styles.bossAnnounceBottom}>{bossName}</div>
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  hud: {
    position: "absolute",
    inset: 0,
    pointerEvents: "none",
    fontFamily: "'Segoe UI', monospace",
    userSelect: "none",
  },
  vitals: {
    position: "absolute",
    top: 20,
    left: 20,
    width: 220,
    background: "rgba(0,0,0,0.65)",
    border: "1px solid #333",
    borderRadius: 8,
    padding: "12px 16px",
    backdropFilter: "blur(4px)",
  },
  barLabel: {
    display: "flex",
    justifyContent: "space-between",
    marginBottom: 4,
    fontSize: 14,
    fontWeight: "600",
  },
  barTrack: {
    width: "100%",
    height: 10,
    background: "#222",
    borderRadius: 5,
    overflow: "hidden",
    border: "1px solid #444",
  },
  barFill: {
    height: "100%",
    borderRadius: 5,
    transition: "width 0.15s ease",
  },
  center: {
    position: "absolute",
    top: 20,
    left: "50%",
    transform: "translateX(-50%)",
    textAlign: "center",
    background: "rgba(0,0,0,0.6)",
    border: "1px solid #333",
    borderRadius: 8,
    padding: "8px 24px",
    backdropFilter: "blur(4px)",
  },
  waveText: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#ff8800",
    letterSpacing: 3,
    textShadow: "0 0 10px #ff6600",
  },
  statsRow: {
    display: "flex",
    gap: 20,
    color: "#ccc",
    fontSize: 14,
    marginTop: 4,
  },
  controls: {
    position: "absolute",
    bottom: 16,
    left: "50%",
    transform: "translateX(-50%)",
    display: "flex",
    gap: 16,
    color: "rgba(180,180,180,0.5)",
    fontSize: 12,
    background: "rgba(0,0,0,0.4)",
    padding: "6px 16px",
    borderRadius: 20,
    border: "1px solid rgba(255,255,255,0.08)",
  },
  upgradePanel: {
    position: "absolute",
    bottom: 60,
    left: 20,
    maxWidth: 280,
    background: "rgba(0,0,0,0.65)",
    border: "1px solid #333",
    borderRadius: 8,
    padding: "10px 12px",
    backdropFilter: "blur(4px)",
  },
  upgradeTitle: {
    color: "#ffcc44",
    fontSize: 11,
    letterSpacing: 2,
    fontWeight: "bold",
    marginBottom: 6,
  },
  upgradeGrid: {
    display: "flex",
    flexWrap: "wrap",
    gap: 4,
  },
  upgradeChip: {
    background: "rgba(80,60,20,0.6)",
    border: "1px solid #664",
    borderRadius: 4,
    padding: "3px 7px",
    fontSize: 11,
    color: "#ddd",
  },
  actionIndicator: {
    position: "absolute",
    bottom: 16,
    right: 20,
    fontSize: 13,
    letterSpacing: 2,
    transition: "opacity 0.2s",
  },
  bossBar: {
    position: "absolute",
    bottom: 52,
    left: "50%",
    transform: "translateX(-50%)",
    width: "min(600px, 90vw)",
    background: "rgba(0,0,0,0.75)",
    border: "1px solid #660033",
    borderRadius: 8,
    padding: "10px 14px 8px",
    backdropFilter: "blur(6px)",
    boxShadow: "0 0 24px rgba(180,0,80,0.4)",
  },
  bossBarHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  bossBarName: {
    color: "#ff44aa",
    fontSize: 15,
    fontWeight: "bold",
    letterSpacing: 2,
    textShadow: "0 0 10px #ff0066",
    textTransform: "uppercase" as const,
  },
  bossWarn: {
    color: "#ff4400",
    fontSize: 13,
    fontWeight: "bold",
    letterSpacing: 1,
    animation: "none",
    textShadow: "0 0 8px #ff2200",
  },
  bossBarTrack: {
    width: "100%",
    height: 14,
    background: "#1a0010",
    borderRadius: 7,
    overflow: "hidden",
    border: "1px solid #550022",
  },
  bossBarFill: {
    height: "100%",
    borderRadius: 7,
    background: "linear-gradient(90deg, #8b0050, #ff0066, #cc0044)",
    boxShadow: "0 0 10px #ff0066",
    transition: "width 0.12s ease",
  },
  bossBarFooter: {
    marginTop: 4,
    textAlign: "center" as const,
  },
  bossAnnounce: {
    position: "absolute",
    top: "30%",
    left: "50%",
    transform: "translateX(-50%)",
    textAlign: "center" as const,
    pointerEvents: "none",
  },
  bossAnnounceTop: {
    color: "#ff2244",
    fontSize: 28,
    fontWeight: "bold",
    letterSpacing: 4,
    textShadow: "0 0 20px #ff0033, 0 0 40px #880000",
    marginBottom: 8,
    textTransform: "uppercase" as const,
  },
  bossAnnounceBottom: {
    color: "#ff88bb",
    fontSize: 18,
    letterSpacing: 6,
    textShadow: "0 0 12px #ff0055",
    textTransform: "uppercase" as const,
  },
};
