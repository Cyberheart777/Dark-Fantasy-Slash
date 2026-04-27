/**
 * AffixBanner.tsx
 *
 * Brief, non-blocking banner that shows the FIRST time an affix
 * appears in the current session. Displays:
 *
 *   [colored badge with affix symbol] AFFIX_NAME — one-line description
 *
 * Auto-dismisses after 3 seconds with a 0.5s fade-out, then clears
 * gameStore.pendingAffixBanner so the next-encountered affix can
 * take its place.
 *
 * Lives outside the HUD's main column (top-center) so it doesn't
 * overlap player-stat readouts. Pointer-events: none — purely
 * informational, doesn't block input. Mounted in both game modes
 * alongside AffixTooltip.
 */

import { useEffect, useState } from "react";
import { useGameStore } from "../store/gameStore";
import { AFFIX_DEFS, type EnemyAffix } from "../data/AffixData";

const HOLD_SEC = 3.0;
const FADE_OUT_SEC = 0.5;
const TOTAL_SEC = HOLD_SEC + FADE_OUT_SEC;

export function AffixBanner() {
  const pendingAffix = useGameStore((s) => s.pendingAffixBanner);
  const clear = useGameStore((s) => s.clearAffixBanner);

  // Local mirror so we can render the banner during its fade-out
  // even after the store field is cleared. Set when a fresh affix
  // arrives; cleared by the unmount-after-total-sec timer below.
  const [shown, setShown] = useState<string | null>(null);
  const [opacity, setOpacity] = useState(0);

  useEffect(() => {
    if (!pendingAffix) return;
    setShown(pendingAffix);
    setOpacity(1);
    // Fade-out timer.
    const fade = setTimeout(() => setOpacity(0), HOLD_SEC * 1000);
    // Hard unmount + store-clear timer.
    const dismiss = setTimeout(() => {
      setShown(null);
      clear();
    }, TOTAL_SEC * 1000);
    return () => {
      clearTimeout(fade);
      clearTimeout(dismiss);
    };
  }, [pendingAffix, clear]);

  if (!shown) return null;
  const def = AFFIX_DEFS[shown as EnemyAffix];
  if (!def || def.id === "none") return null;

  return (
    <div style={{ ...styles.wrap, opacity }}>
      <div
        style={{
          ...styles.badge,
          background: def.color,
          boxShadow: `0 0 14px ${def.color}aa`,
        }}
      >
        <span style={styles.symbol}>{def.symbol}</span>
      </div>
      <div style={styles.text}>
        <div style={{ ...styles.name, color: def.color }}>{def.name}</div>
        <div style={styles.desc}>{def.description}</div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrap: {
    position: "fixed",
    top: "11%",
    left: "50%",
    transform: "translateX(-50%)",
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: "10px 18px 10px 12px",
    background: "rgba(8,4,18,0.92)",
    border: "1px solid rgba(140,80,200,0.5)",
    borderRadius: 12,
    boxShadow: "0 0 28px rgba(80,30,140,0.45)",
    pointerEvents: "none",
    fontFamily: "monospace",
    transition: `opacity ${FADE_OUT_SEC}s ease-out`,
    maxWidth: "min(440px, 92vw)",
    zIndex: 60,
  },
  badge: {
    width: 38,
    height: 38,
    borderRadius: 8,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  symbol: {
    fontSize: 20,
    filter: "drop-shadow(0 0 4px rgba(0,0,0,0.6))",
  },
  text: {
    display: "flex",
    flexDirection: "column" as const,
    gap: 2,
  },
  name: {
    fontSize: 13,
    fontWeight: 900 as const,
    letterSpacing: 3,
  },
  desc: {
    fontSize: 11,
    color: "#b8a8d0",
    lineHeight: 1.3,
  },
};
