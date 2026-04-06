/**
 * CharacterSelect.tsx
 * Class selection screen — mobile-friendly with scrolling and large tap targets.
 */

import { useState } from "react";
import { useGameStore } from "../store/gameStore";
import { CHARACTER_DATA, type CharacterClass } from "../data/CharacterData";

const CLASSES: CharacterClass[] = ["warrior", "mage", "rogue"];

export function CharacterSelect() {
  const { setPhase, setSelectedClass, selectedClass } = useGameStore();
  const [confirmed, setConfirmed] = useState<CharacterClass>(selectedClass);

  const handleConfirm = () => {
    setSelectedClass(confirmed);
    setPhase("playing");
  };

  const def = CHARACTER_DATA[confirmed];

  return (
    <div style={styles.overlay}>
      <div style={styles.panel}>

        {/* Header row with back + title */}
        <div style={styles.header}>
          <button style={styles.backBtn} onClick={() => setPhase("menu")}>← BACK</button>
          <div style={styles.title}>CHOOSE YOUR CLASS</div>
          <div style={styles.subtitle}>Your fate awaits in the depths.</div>
        </div>

        {/* Class cards — stack vertically, full-width on mobile */}
        <div style={styles.cards}>
          {CLASSES.map((cls) => {
            const c = CHARACTER_DATA[cls];
            const isSelected = confirmed === cls;
            return (
              <button
                key={cls}
                style={{
                  ...styles.card,
                  borderColor: isSelected ? c.accentColor : "#2a1f3d",
                  background: isSelected
                    ? `linear-gradient(135deg, #1a1030 0%, ${c.color}28 100%)`
                    : "#0e0919",
                  boxShadow: isSelected
                    ? `0 0 20px ${c.color}44, inset 0 0 20px ${c.color}14`
                    : "none",
                }}
                onClick={() => setConfirmed(cls)}
              >
                {/* Top row: icon + name + badge */}
                <div style={styles.cardTop}>
                  <span style={{ ...styles.classIcon, color: c.accentColor }}>
                    {cls === "warrior" ? "⚔" : cls === "mage" ? "✦" : "◆"}
                  </span>
                  <div style={styles.cardTopText}>
                    <div style={{ ...styles.className, color: c.accentColor }}>{c.name}</div>
                    <div style={{ ...styles.classTitle, color: c.color }}>{c.title}</div>
                  </div>
                  {isSelected && (
                    <span style={{ ...styles.checkmark, color: c.accentColor }}>✔</span>
                  )}
                </div>

                <div style={styles.classDesc}>{c.description}</div>

                {/* Stat bars */}
                <div style={styles.statGrid}>
                  <StatBar label="HP"  value={c.hp}          max={120} color="#e04040" />
                  <StatBar label="DMG" value={c.damage}       max={32}  color="#e08020" />
                  <StatBar label="SPD" value={c.moveSpeed}    max={11}  color="#20c0e0" />
                  <StatBar label="ATK" value={c.attackSpeed}  max={2.5} color="#c040e0" />
                </div>

                <div style={{ ...styles.attackBadge, color: c.accentColor, borderColor: c.color + "50" }}>
                  {cls === "warrior" ? "⚔ MELEE SWEEP" : cls === "mage" ? "✦ PIERCING ORB" : "◆ TWIN DAGGERS"}
                </div>
              </button>
            );
          })}
        </div>

        {/* Lore quote */}
        <div style={styles.loreBox}>
          <span style={{ color: "#8860cc" }}>❝ </span>
          <span style={{ fontStyle: "italic", color: "#c0a0f0" }}>{def.lore}</span>
        </div>

        {/* Confirm button — large tap target */}
        <button
          style={{
            ...styles.confirmBtn,
            background: `linear-gradient(135deg, ${def.color} 0%, ${def.accentColor}cc 100%)`,
            boxShadow: `0 4px 24px ${def.color}70`,
          }}
          onClick={handleConfirm}
        >
          ⚔ ENTER AS {def.name}
        </button>

      </div>
    </div>
  );
}

function StatBar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const pct = Math.min(1, value / max);
  return (
    <div style={styles.statRow}>
      <span style={styles.statLabel}>{label}</span>
      <div style={styles.statTrack}>
        <div style={{ ...styles.statFill, width: `${pct * 100}%`, background: color }} />
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: "absolute",
    inset: 0,
    overflowY: "auto",
    WebkitOverflowScrolling: "touch" as React.CSSProperties["WebkitOverflowScrolling"],
    background: "linear-gradient(160deg, #04000a 0%, #0e0620 100%)",
    fontFamily: "'Segoe UI', monospace",
    userSelect: "none",
    zIndex: 10,
  },
  panel: {
    width: "100%",
    maxWidth: 620,
    margin: "0 auto",
    display: "flex",
    flexDirection: "column",
    alignItems: "stretch",
    gap: 16,
    padding: "20px 16px 36px",
    boxSizing: "border-box",
  },
  header: {
    textAlign: "center",
    display: "flex",
    flexDirection: "column",
    gap: 6,
    paddingTop: 4,
  },
  backBtn: {
    alignSelf: "flex-start",
    background: "none",
    border: "1px solid #3a2a50",
    color: "#806090",
    padding: "10px 18px",
    borderRadius: 8,
    cursor: "pointer",
    fontFamily: "monospace",
    fontSize: 13,
    letterSpacing: 1,
    minHeight: 44,
    marginBottom: 4,
  },
  title: {
    fontSize: 22,
    fontWeight: 900,
    letterSpacing: 5,
    color: "#d0a0ff",
    textShadow: "0 0 20px #9030d0",
    fontFamily: "monospace",
  },
  subtitle: {
    fontSize: 12,
    color: "#806090",
    letterSpacing: 2,
    fontFamily: "monospace",
  },
  cards: {
    display: "flex",
    flexDirection: "column",
    gap: 12,
    width: "100%",
  },
  card: {
    width: "100%",
    border: "2px solid #2a1f3d",
    borderRadius: 12,
    padding: "18px 16px",
    cursor: "pointer",
    display: "flex",
    flexDirection: "column",
    gap: 10,
    background: "#0e0919",
    textAlign: "left",
    // Large tap target
    minHeight: 44,
    transition: "border-color 0.15s, box-shadow 0.15s, background 0.15s",
  },
  cardTop: {
    display: "flex",
    alignItems: "center",
    gap: 12,
  },
  classIcon: {
    fontSize: 28,
    filter: "drop-shadow(0 0 6px currentColor)",
    flexShrink: 0,
  },
  cardTopText: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    gap: 2,
  },
  className: {
    fontSize: 16,
    fontWeight: 900,
    letterSpacing: 3,
    fontFamily: "monospace",
  },
  classTitle: {
    fontSize: 10,
    letterSpacing: 2,
    fontFamily: "monospace",
    textTransform: "uppercase",
  },
  checkmark: {
    fontSize: 18,
    fontWeight: 900,
    flexShrink: 0,
  },
  classDesc: {
    fontSize: 12,
    color: "#9080a8",
    lineHeight: 1.6,
    fontFamily: "monospace",
  },
  statGrid: {
    display: "flex",
    flexDirection: "column",
    gap: 6,
  },
  statRow: {
    display: "flex",
    alignItems: "center",
    gap: 8,
  },
  statLabel: {
    fontSize: 9,
    letterSpacing: 1,
    color: "#605070",
    fontFamily: "monospace",
    width: 26,
    textAlign: "right",
    flexShrink: 0,
  },
  statTrack: {
    flex: 1,
    height: 7,
    background: "#1a1228",
    borderRadius: 4,
    overflow: "hidden",
  },
  statFill: {
    height: "100%",
    borderRadius: 4,
  },
  attackBadge: {
    fontSize: 10,
    letterSpacing: 2,
    textAlign: "center",
    border: "1px solid",
    borderRadius: 4,
    padding: "6px 8px",
    fontFamily: "monospace",
  },
  loreBox: {
    textAlign: "center",
    fontSize: 13,
    lineHeight: 1.7,
    padding: "12px 16px",
    border: "1px solid #2a1a40",
    borderRadius: 8,
    background: "#0a0614",
    color: "#c0a0f0",
  },
  confirmBtn: {
    width: "100%",
    padding: "18px 24px",
    border: "none",
    borderRadius: 10,
    color: "#fff",
    fontWeight: 900,
    fontSize: 15,
    letterSpacing: 2,
    fontFamily: "monospace",
    cursor: "pointer",
    minHeight: 58,
  },
};
