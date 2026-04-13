/**
 * AchievementsPanel.tsx
 * Full-page achievements viewer used by MainMenu and PauseMenu.
 */

import { useState } from "react";
import { useAchievementStore } from "../store/achievementStore";
import {
  ACHIEVEMENTS,
  ACHIEVEMENT_CATEGORIES,
  CATEGORY_LABELS,
  type AchievementCategory,
} from "../data/AchievementData";
import { audioManager } from "../audio/AudioManager";

const click = (fn: () => void) => () => { audioManager.play("menu_click"); fn(); };

interface AchievementsPanelProps {
  onClose: () => void;
}

export function AchievementsPanel({ onClose }: AchievementsPanelProps) {
  const unlocked = useAchievementStore((s) => s.unlocked);
  const [activeTab, setActiveTab] = useState<AchievementCategory | "all">("all");

  const totalUnlocked = Object.keys(unlocked).length;
  const totalAchievements = ACHIEVEMENTS.length;

  const filtered = activeTab === "all"
    ? ACHIEVEMENTS
    : ACHIEVEMENTS.filter((a) => a.category === activeTab);

  return (
    <div style={styles.wrapper}>
      {/* Header */}
      <div style={styles.header}>
        <div style={styles.title}>ACHIEVEMENTS</div>
        <div style={styles.counter}>
          <span style={styles.counterNum}>{totalUnlocked}</span>
          <span style={styles.counterSlash}> / </span>
          <span style={styles.counterTotal}>{totalAchievements}</span>
        </div>
      </div>

      {/* Category tabs */}
      <div style={styles.tabs}>
        <TabButton
          label="ALL"
          active={activeTab === "all"}
          onClick={() => setActiveTab("all")}
        />
        {ACHIEVEMENT_CATEGORIES.map((cat) => (
          <TabButton
            key={cat}
            label={CATEGORY_LABELS[cat].toUpperCase()}
            active={activeTab === cat}
            onClick={() => setActiveTab(cat)}
          />
        ))}
      </div>

      {/* Achievement grid */}
      <div style={styles.grid}>
        {filtered.map((ach) => {
          const isUnlocked = !!unlocked[ach.id];
          const isHidden = ach.hidden && !isUnlocked;

          return (
            <div
              key={ach.id}
              style={{
                ...styles.card,
                opacity: isUnlocked ? 1 : 0.45,
                borderColor: isUnlocked
                  ? "rgba(255,200,0,0.5)"
                  : "rgba(80,50,120,0.3)",
                boxShadow: isUnlocked
                  ? "0 0 12px rgba(255,180,0,0.15)"
                  : "none",
              }}
            >
              <div style={styles.cardIcon}>
                {isHidden ? "?" : ach.icon}
              </div>
              <div style={styles.cardTextCol}>
                <div style={{
                  ...styles.cardName,
                  color: isUnlocked ? "#ffe8aa" : isHidden ? "#555" : "#888",
                }}>
                  {isHidden ? "???" : ach.name}
                </div>
                <div style={styles.cardDesc}>
                  {isHidden ? "This achievement is hidden" : ach.description}
                </div>
                {isUnlocked && unlocked[ach.id] && (
                  <div style={styles.cardDate}>
                    {new Date(unlocked[ach.id]).toLocaleDateString()}
                  </div>
                )}
              </div>
              {isUnlocked && <div style={styles.checkmark}>&#10003;</div>}
            </div>
          );
        })}
      </div>

      <button style={styles.backBtn} onClick={click(onClose)}>
        &#8592; BACK
      </button>
    </div>
  );
}

function TabButton({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      style={{
        ...styles.tab,
        color: active ? "#ffcc00" : "#888",
        borderColor: active ? "rgba(255,200,0,0.5)" : "transparent",
        background: active ? "rgba(255,200,0,0.08)" : "transparent",
      }}
      onClick={click(onClick)}
    >
      {label}
    </button>
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrapper: {
    display: "flex",
    flexDirection: "column",
    gap: 16,
    maxHeight: "65vh",
    overflowY: "auto",
    textAlign: "left",
    paddingRight: 4,
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "baseline",
  },
  title: {
    fontSize: 16,
    fontWeight: 900,
    letterSpacing: 4,
    color: "#cc88ff",
    textShadow: "0 0 10px rgba(180,80,255,0.4)",
  },
  counter: {
    fontFamily: "monospace",
    fontSize: 14,
  },
  counterNum: {
    color: "#ffcc00",
    fontWeight: 900,
  },
  counterSlash: {
    color: "#666",
  },
  counterTotal: {
    color: "#888",
  },
  tabs: {
    display: "flex",
    gap: 4,
    flexWrap: "wrap",
  },
  tab: {
    padding: "4px 10px",
    fontSize: 9,
    fontWeight: 900,
    letterSpacing: 1.5,
    border: "1px solid transparent",
    borderRadius: 4,
    cursor: "pointer",
    fontFamily: "monospace",
    background: "transparent",
    transition: "all 0.15s",
  },
  grid: {
    display: "flex",
    flexDirection: "column",
    gap: 6,
  },
  card: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: "10px 12px",
    background: "rgba(10,6,20,0.7)",
    border: "1px solid",
    borderRadius: 8,
    transition: "opacity 0.2s, border-color 0.2s",
  },
  cardIcon: {
    fontSize: 24,
    lineHeight: 1,
    flexShrink: 0,
    width: 32,
    textAlign: "center",
  },
  cardTextCol: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    gap: 2,
    minWidth: 0,
  },
  cardName: {
    fontSize: 13,
    fontWeight: 700,
    letterSpacing: 1,
    fontFamily: "'Segoe UI', monospace",
  },
  cardDesc: {
    fontSize: 10,
    color: "rgba(200,180,220,0.6)",
    lineHeight: 1.3,
  },
  cardDate: {
    fontSize: 9,
    color: "rgba(160,140,180,0.4)",
    fontFamily: "monospace",
    marginTop: 2,
  },
  checkmark: {
    fontSize: 16,
    color: "#44cc66",
    fontWeight: 900,
    flexShrink: 0,
    textShadow: "0 0 6px rgba(60,200,80,0.5)",
  },
  backBtn: {
    marginTop: 8,
    padding: "11px",
    fontSize: 14,
    fontWeight: "bold",
    letterSpacing: 2,
    color: "#bbb",
    background: "rgba(30,15,45,0.8)",
    border: "1px solid rgba(80,50,120,0.4)",
    borderRadius: 8,
    cursor: "pointer",
    fontFamily: "inherit",
    width: "100%",
  },
};
