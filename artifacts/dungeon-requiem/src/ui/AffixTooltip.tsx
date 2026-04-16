/**
 * AffixTooltip.tsx
 *
 * DOM overlay that surfaces enemy-affix info when the player taps an
 * affixed enemy in 3D space. Reads `inspectedAffix` from gameStore;
 * Enemy3D's onClick populates that field. Tap anywhere outside the
 * popup dismisses (large hit target — full-screen backdrop).
 *
 * Mounted next to the HUD in both game modes (main game + labyrinth)
 * so the tap-to-inspect feature works regardless of which scene is
 * active. Pointer events route through the backdrop so the
 * underlying canvas doesn't fight for input while the tooltip is up.
 */

import { useGameStore } from "../store/gameStore";
import { AFFIX_DEFS, type EnemyAffix } from "../data/AffixData";

/** Pretty-print enemy type for the tooltip header. ALL CAPS
 *  treatment so affix banners read consistent across surfaces. */
function formatEnemyType(type: string): string {
  return type
    .split("_")
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase())
    .join(" ");
}

export function AffixTooltip() {
  const inspected = useGameStore((s) => s.inspectedAffix);
  const setInspected = useGameStore((s) => s.setInspectedAffix);
  if (!inspected) return null;

  const dismiss = () => setInspected(null);

  return (
    <div style={styles.backdrop} onClick={dismiss}>
      <div style={styles.popup} onClick={(e) => e.stopPropagation()}>
        <div style={styles.title}>{formatEnemyType(inspected.enemyType)}</div>
        <div style={styles.divider} />
        {inspected.affixes.map((affixId) => {
          const def = AFFIX_DEFS[affixId as EnemyAffix];
          if (!def || def.id === "none") return null;
          return (
            <div key={affixId} style={styles.affixRow}>
              <div
                style={{
                  ...styles.affixBadge,
                  background: def.color,
                  boxShadow: `0 0 12px ${def.color}aa`,
                }}
              >
                <span style={styles.affixSymbol}>{def.symbol}</span>
              </div>
              <div style={styles.affixText}>
                <div style={{ ...styles.affixName, color: def.color }}>{def.name}</div>
                <div style={styles.affixDesc}>{def.description}</div>
              </div>
            </div>
          );
        })}
        <button style={styles.dismissBtn} onClick={dismiss}>
          ▸ DISMISS
        </button>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  backdrop: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.55)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 70,
    backdropFilter: "blur(4px)",
    cursor: "pointer",
    touchAction: "none",
  },
  popup: {
    width: "min(420px, 92vw)",
    maxHeight: "80vh",
    overflowY: "auto",
    padding: "22px 26px 18px",
    background: "rgba(10,6,18,0.97)",
    border: "1px solid rgba(140,80,200,0.55)",
    borderRadius: 14,
    boxShadow: "0 0 36px rgba(120,40,180,0.4), inset 0 0 22px rgba(80,30,120,0.25)",
    fontFamily: "monospace",
    cursor: "default",
  },
  title: {
    fontSize: 18,
    fontWeight: 900 as const,
    letterSpacing: 4,
    color: "#e0c0ff",
    textShadow: "0 0 12px rgba(200,140,255,0.6)",
    textAlign: "center",
  },
  divider: {
    height: 1,
    margin: "12px -10px 14px",
    background: "linear-gradient(90deg, transparent, rgba(140,80,200,0.55), transparent)",
  },
  affixRow: {
    display: "flex",
    alignItems: "center",
    gap: 14,
    padding: "10px 0",
    borderBottom: "1px solid rgba(80,40,120,0.15)",
  },
  affixBadge: {
    width: 44,
    height: 44,
    borderRadius: 8,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  affixSymbol: {
    fontSize: 22,
    filter: "drop-shadow(0 0 4px rgba(0,0,0,0.6))",
  },
  affixName: {
    fontSize: 14,
    fontWeight: 900 as const,
    letterSpacing: 3,
    marginBottom: 3,
  },
  affixText: {
    flex: 1,
  },
  affixDesc: {
    fontSize: 12,
    color: "#b8a8d0",
    lineHeight: 1.4,
  },
  dismissBtn: {
    marginTop: 16,
    width: "100%",
    padding: "12px",
    fontSize: 12,
    fontWeight: 700 as const,
    letterSpacing: 3,
    color: "#d0a0ff",
    background: "rgba(40,20,70,0.6)",
    border: "1px solid rgba(140,80,200,0.4)",
    borderRadius: 8,
    cursor: "pointer",
    fontFamily: "inherit",
  },
};
