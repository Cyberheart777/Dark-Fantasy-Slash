/**
 * Bestiary.tsx
 *
 * Standalone main-menu screen listing every enemy affix in the
 * game. Reads from AFFIX_DEFS (single source of truth) and the
 * persistent metaStore.discoveredAffixes map for unlock state.
 *
 * Locked entries (never encountered) render dim with a 🔒 badge
 * and the description hidden — the player has to actually fight an
 * affixed enemy to unlock the entry. Discovered entries render in
 * full color with the affix description.
 *
 * Routed via gameStore.setPhase("bestiary"); MainMenu provides the
 * entry point. App.tsx handles the phase → component mapping.
 */

import { useGameStore } from "../store/gameStore";
import { useMetaStore } from "../store/metaStore";
import { AFFIX_DEFS, AFFIX_TYPES } from "../data/AffixData";

export function Bestiary() {
  const setPhase = useGameStore((s) => s.setPhase);
  const discovered = useMetaStore((s) => s.discoveredAffixes);

  const total = AFFIX_TYPES.length;
  const unlockedCount = AFFIX_TYPES.filter((id) => discovered[id]).length;

  return (
    <div style={styles.overlay}>
      <div style={styles.panel}>
        <div style={styles.header}>
          <span style={styles.title}>BESTIARY</span>
          <span style={styles.progress}>{unlockedCount} / {total} DISCOVERED</span>
        </div>
        <div style={styles.subtitle}>
          Enemy affixes encountered across all runs.
        </div>

        <div style={styles.list}>
          {AFFIX_TYPES.map((id) => {
            const def = AFFIX_DEFS[id];
            const isUnlocked = !!discovered[id];
            return (
              <div
                key={id}
                style={{
                  ...styles.entry,
                  borderColor: isUnlocked ? def.color : "#1f1428",
                  background: isUnlocked
                    ? "rgba(10,6,18,0.7)"
                    : "rgba(8,4,14,0.7)",
                  opacity: isUnlocked ? 1 : 0.5,
                }}
              >
                <div
                  style={{
                    ...styles.badge,
                    background: isUnlocked ? def.color : "#1a1020",
                    boxShadow: isUnlocked ? `0 0 14px ${def.color}aa` : "none",
                  }}
                >
                  <span style={styles.symbol}>
                    {isUnlocked ? def.symbol : "🔒"}
                  </span>
                </div>
                <div style={styles.text}>
                  <div
                    style={{
                      ...styles.name,
                      color: isUnlocked ? def.color : "#5a4060",
                    }}
                  >
                    {isUnlocked ? def.name : "????"}
                  </div>
                  <div style={styles.desc}>
                    {isUnlocked
                      ? def.description
                      : "Encounter this affix in combat to unlock its entry."}
                  </div>
                  {isUnlocked && (
                    <div style={{ ...styles.colorChip, background: def.color }}>
                      <span style={styles.colorChipLabel}>
                        AURA TINT · {def.color.toUpperCase()}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <button style={styles.backBtn} onClick={() => setPhase("menu")}>
          ◂ BACK TO MENU
        </button>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: "fixed",
    inset: 0,
    background: "radial-gradient(ellipse at center, #1a0825 0%, #050208 70%)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontFamily: "monospace",
    overflow: "auto",
    padding: "24px 0",
  },
  panel: {
    width: "min(540px, 94vw)",
    maxHeight: "92vh",
    overflowY: "auto",
    padding: "24px 28px 20px",
    background: "rgba(8,4,18,0.96)",
    border: "1px solid rgba(140,80,200,0.55)",
    borderRadius: 14,
    boxShadow: "0 0 36px rgba(120,40,180,0.35)",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "baseline",
    marginBottom: 6,
  },
  title: {
    fontSize: 22,
    fontWeight: 900 as const,
    letterSpacing: 6,
    color: "#e0c0ff",
    textShadow: "0 0 14px rgba(200,140,255,0.6)",
  },
  progress: {
    fontSize: 11,
    letterSpacing: 2,
    color: "#8a70a8",
  },
  subtitle: {
    fontSize: 11,
    letterSpacing: 1,
    color: "#7a6090",
    marginBottom: 18,
    fontStyle: "italic" as const,
  },
  list: {
    display: "flex",
    flexDirection: "column" as const,
    gap: 10,
  },
  entry: {
    display: "flex",
    alignItems: "flex-start",
    gap: 14,
    padding: "12px 14px",
    border: "1px solid",
    borderRadius: 10,
    transition: "opacity 0.2s",
  },
  badge: {
    width: 48,
    height: 48,
    borderRadius: 10,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    transition: "background 0.2s",
  },
  symbol: {
    fontSize: 26,
    filter: "drop-shadow(0 0 4px rgba(0,0,0,0.6))",
  },
  text: {
    flex: 1,
  },
  name: {
    fontSize: 14,
    fontWeight: 900 as const,
    letterSpacing: 3,
    marginBottom: 4,
  },
  desc: {
    fontSize: 11,
    color: "#a898c0",
    lineHeight: 1.5,
    marginBottom: 6,
  },
  colorChip: {
    display: "inline-block",
    padding: "2px 8px",
    borderRadius: 4,
    marginTop: 2,
  },
  colorChipLabel: {
    fontSize: 9,
    color: "#000000",
    letterSpacing: 1.5,
    fontWeight: 700 as const,
  },
  backBtn: {
    marginTop: 18,
    width: "100%",
    padding: "12px",
    fontSize: 13,
    fontWeight: 700 as const,
    letterSpacing: 3,
    color: "#d0a0ff",
    background: "rgba(40,20,70,0.6)",
    border: "1px solid rgba(140,80,200,0.45)",
    borderRadius: 8,
    cursor: "pointer",
    fontFamily: "inherit",
  },
};
