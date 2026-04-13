/**
 * AchievementToast.tsx
 * In-game popup when an achievement unlocks.
 * Slides in from top, auto-dismisses after 4 seconds.
 */

import { useEffect, useState, useRef } from "react";
import { useAchievementStore } from "../store/achievementStore";
import { ACHIEVEMENT_MAP } from "../data/AchievementData";

export function AchievementToast() {
  const [visible, setVisible] = useState(false);
  const [current, setCurrent] = useState<{ id: string; name: string; icon: string } | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const popToast = useAchievementStore((s) => s.popToast);
  const queueLen = useAchievementStore((s) => s.toastQueue.length);

  useEffect(() => {
    if (queueLen === 0 || visible) return;
    const id = popToast();
    if (!id) return;
    const def = ACHIEVEMENT_MAP[id];
    if (!def) return;
    setCurrent({ id, name: def.name, icon: def.icon });
    setVisible(true);
    timerRef.current = setTimeout(() => {
      setVisible(false);
      setCurrent(null);
    }, 4000);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [queueLen, visible, popToast]);

  if (!visible || !current) return null;

  return (
    <div style={styles.wrapper}>
      <div style={styles.container}>
        <div style={styles.icon}>{current.icon}</div>
        <div style={styles.textCol}>
          <div style={styles.header}>ACHIEVEMENT UNLOCKED</div>
          <div style={styles.name}>{current.name}</div>
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrapper: {
    position: "absolute",
    top: 80,
    left: "50%",
    transform: "translateX(-50%)",
    zIndex: 50,
    pointerEvents: "none",
    animation: "achievementSlideIn 0.5s ease-out, achievementFadeOut 0.6s ease-in 3.4s forwards",
  },
  container: {
    display: "flex",
    alignItems: "center",
    gap: 14,
    padding: "14px 24px",
    background: "linear-gradient(135deg, rgba(20,10,35,0.95), rgba(10,5,20,0.95))",
    border: "1.5px solid rgba(255,200,0,0.6)",
    borderRadius: 10,
    boxShadow: "0 0 24px rgba(255,180,0,0.35), 0 0 60px rgba(200,120,0,0.15), inset 0 0 20px rgba(255,200,0,0.08)",
    backdropFilter: "blur(8px)",
    minWidth: 280,
  },
  icon: {
    fontSize: 28,
    lineHeight: 1,
    flexShrink: 0,
  },
  textCol: {
    display: "flex",
    flexDirection: "column" as const,
    gap: 3,
  },
  header: {
    fontSize: 9,
    fontWeight: 900,
    letterSpacing: 3,
    color: "#ffcc00",
    fontFamily: "monospace",
    textShadow: "0 0 8px rgba(255,200,0,0.6)",
  },
  name: {
    fontSize: 16,
    fontWeight: 700,
    letterSpacing: 1.5,
    color: "#ffe8aa",
    fontFamily: "'Segoe UI', monospace",
    textShadow: "0 0 6px rgba(255,200,100,0.3)",
  },
};
