/**
 * CharacterSelect.tsx
 * Class selection screen shown between main menu and gameplay.
 */

import { useState } from "react";
import { useGameStore } from "../store/gameStore";
import { CHARACTER_DATA, type CharacterClass } from "../data/CharacterData";

const CLASSES: CharacterClass[] = ["warrior", "mage", "rogue"];

export function CharacterSelect() {
  const { setPhase, setSelectedClass, selectedClass } = useGameStore();
  const [hovered, setHovered] = useState<CharacterClass | null>(null);
  const [confirmed, setConfirmed] = useState<CharacterClass>(selectedClass);

  const handleConfirm = () => {
    setSelectedClass(confirmed);
    setPhase("playing");
  };

  const def = CHARACTER_DATA[confirmed];

  return (
    <div style={styles.overlay}>
      <div style={styles.panel}>
        <div style={styles.header}>
          <button style={styles.backBtn} onClick={() => setPhase("menu")}>← BACK</button>
          <div style={styles.title}>CHOOSE YOUR CLASS</div>
          <div style={styles.subtitle}>Your fate awaits in the depths.</div>
        </div>

        <div style={styles.cards}>
          {CLASSES.map((cls) => {
            const c = CHARACTER_DATA[cls];
            const isSelected = confirmed === cls;
            const isHover = hovered === cls;
            return (
              <div
                key={cls}
                style={{
                  ...styles.card,
                  borderColor: isSelected ? c.accentColor : isHover ? c.color + "80" : "#2a1f3d",
                  background: isSelected
                    ? `linear-gradient(160deg, #1a1030 0%, ${c.color}22 100%)`
                    : isHover
                    ? `linear-gradient(160deg, #140d28 0%, ${c.color}14 100%)`
                    : "#0e0919",
                  boxShadow: isSelected ? `0 0 24px ${c.color}55, inset 0 0 24px ${c.color}18` : "none",
                  transform: isSelected ? "translateY(-4px) scale(1.02)" : isHover ? "translateY(-2px)" : "none",
                }}
                onClick={() => setConfirmed(cls)}
                onMouseEnter={() => setHovered(cls)}
                onMouseLeave={() => setHovered(null)}
              >
                <div style={{ ...styles.classIcon, color: c.accentColor }}>
                  {cls === "warrior" ? "⚔" : cls === "mage" ? "✦" : "◆"}
                </div>
                <div style={{ ...styles.className, color: c.accentColor }}>{c.name}</div>
                <div style={{ ...styles.classTitle, color: c.color }}>{c.title}</div>
                <div style={styles.classDesc}>{c.description}</div>

                <div style={styles.statGrid}>
                  <StatBar label="HP" value={c.hp} max={120} color="#e04040" />
                  <StatBar label="DMG" value={c.damage} max={32} color="#e08020" />
                  <StatBar label="SPD" value={c.moveSpeed} max={11} color="#20c0e0" />
                  <StatBar label="ATK" value={c.attackSpeed} max={2.5} color="#c040e0" />
                </div>

                <div style={{ ...styles.attackBadge, color: c.accentColor, borderColor: c.color + "60" }}>
                  {c.attackType === "melee" ? "⚔ MELEE SWEEP" : c.id === "mage" ? "✦ PIERCING ORB" : "◆ TWIN DAGGERS"}
                </div>

                {isSelected && (
                  <div style={{ ...styles.selectedMark, color: c.accentColor }}>✔ SELECTED</div>
                )}
              </div>
            );
          })}
        </div>

        <div style={styles.loreBox}>
          <span style={{ color: "#8860cc", marginRight: 8 }}>❝</span>
          <span style={{ fontStyle: "italic", color: "#c0a0f0" }}>{def.lore}</span>
        </div>

        <button
          style={{ ...styles.confirmBtn, background: def.color, boxShadow: `0 0 20px ${def.color}80` }}
          onClick={handleConfirm}
        >
          ⚔ ENTER THE DUNGEON AS {def.name}
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
    position: "absolute", inset: 0,
    display: "flex", alignItems: "center", justifyContent: "center",
    background: "linear-gradient(160deg, #04000a 0%, #0e0620 100%)",
    fontFamily: "'Segoe UI', monospace",
    userSelect: "none",
    zIndex: 10,
  },
  panel: {
    width: "min(960px, 96vw)",
    display: "flex", flexDirection: "column", alignItems: "center", gap: 24,
    padding: "32px 24px",
  },
  header: {
    width: "100%", textAlign: "center", position: "relative",
  },
  backBtn: {
    position: "absolute", left: 0, top: "50%", transform: "translateY(-50%)",
    background: "none", border: "1px solid #3a2a50", color: "#806090",
    padding: "6px 14px", borderRadius: 6, cursor: "pointer",
    fontFamily: "monospace", fontSize: 12, letterSpacing: 1,
    transition: "all 0.15s",
  },
  title: {
    fontSize: 28, fontWeight: 900, letterSpacing: 6,
    color: "#d0a0ff",
    textShadow: "0 0 24px #9030d0",
    fontFamily: "monospace",
  },
  subtitle: {
    marginTop: 6, fontSize: 13, color: "#806090",
    letterSpacing: 2, fontFamily: "monospace",
  },
  cards: {
    display: "flex", gap: 16, width: "100%", justifyContent: "center",
    flexWrap: "wrap",
  },
  card: {
    flex: "1 1 260px", maxWidth: 290,
    border: "1.5px solid #2a1f3d",
    borderRadius: 12,
    padding: "24px 20px",
    cursor: "pointer",
    display: "flex", flexDirection: "column", gap: 10,
    transition: "all 0.2s ease",
    background: "#0e0919",
  },
  classIcon: {
    fontSize: 32, textAlign: "center",
    filter: "drop-shadow(0 0 8px currentColor)",
  },
  className: {
    fontSize: 18, fontWeight: 900, letterSpacing: 4,
    textAlign: "center", fontFamily: "monospace",
  },
  classTitle: {
    fontSize: 11, letterSpacing: 2, textAlign: "center",
    fontFamily: "monospace", textTransform: "uppercase",
  },
  classDesc: {
    fontSize: 12, color: "#9080a8", lineHeight: 1.6,
    textAlign: "center", fontFamily: "monospace",
  },
  statGrid: {
    display: "flex", flexDirection: "column", gap: 6,
    marginTop: 4,
  },
  statRow: {
    display: "flex", alignItems: "center", gap: 8,
  },
  statLabel: {
    fontSize: 9, letterSpacing: 1, color: "#605070",
    fontFamily: "monospace", width: 28, textAlign: "right",
  },
  statTrack: {
    flex: 1, height: 6, background: "#1a1228", borderRadius: 3, overflow: "hidden",
  },
  statFill: {
    height: "100%", borderRadius: 3,
    transition: "width 0.3s ease",
  },
  attackBadge: {
    fontSize: 10, letterSpacing: 2, textAlign: "center",
    border: "1px solid",
    borderRadius: 4, padding: "4px 8px",
    fontFamily: "monospace", marginTop: 4,
  },
  selectedMark: {
    fontSize: 11, letterSpacing: 2, textAlign: "center",
    fontFamily: "monospace", fontWeight: 700,
  },
  loreBox: {
    maxWidth: 560, textAlign: "center",
    fontSize: 13, lineHeight: 1.7,
    padding: "12px 20px",
    border: "1px solid #2a1a40",
    borderRadius: 8, background: "#0a0614",
  },
  confirmBtn: {
    width: "100%", maxWidth: 440,
    padding: "16px 24px",
    border: "none", borderRadius: 8,
    color: "#fff", fontWeight: 900,
    fontSize: 14, letterSpacing: 3,
    fontFamily: "monospace",
    cursor: "pointer",
    transition: "all 0.2s",
  },
};
