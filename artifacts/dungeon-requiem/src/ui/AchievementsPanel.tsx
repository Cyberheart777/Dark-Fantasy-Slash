/**
 * AchievementsPanel.tsx
 * Full-page achievements viewer used by MainMenu and PauseMenu.
 */

import { useState } from "react";
import { useAchievementStore } from "../store/achievementStore";
import { useMetaStore } from "../store/metaStore";
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
  const claimed = useAchievementStore((s) => s.claimed);
  const claimReward = useAchievementStore((s) => s.claimReward);
  const addShards = useMetaStore((s) => s.addShards);
  const [activeTab, setActiveTab] = useState<AchievementCategory | "all">("all");
  const [panelView, setPanelView] = useState<"achievements" | "guide">("achievements");

  const totalUnlocked = Object.keys(unlocked).length;
  const totalAchievements = ACHIEVEMENTS.length;

  const filtered = activeTab === "all"
    ? ACHIEVEMENTS
    : ACHIEVEMENTS.filter((a) => a.category === activeTab);

  return (
    <div style={styles.wrapper}>
      {/* Back button at top */}
      <button style={styles.backBtn} onClick={click(onClose)}>
        &#8592; BACK
      </button>

      {/* View toggle: Achievements / Guide */}
      <div style={styles.viewToggle}>
        <button
          style={{ ...styles.viewBtn, ...(panelView === "achievements" ? styles.viewBtnActive : {}) }}
          onClick={click(() => setPanelView("achievements"))}
        >
          ACHIEVEMENTS
        </button>
        <button
          style={{ ...styles.viewBtn, ...(panelView === "guide" ? styles.viewBtnActive : {}) }}
          onClick={click(() => setPanelView("guide"))}
        >
          GUIDE
        </button>
      </div>

      {panelView === "achievements" && (
        <>
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
                    {ach.shardReward && !isHidden && isUnlocked && !claimed[ach.id] && (
                      <button
                        style={styles.claimBtn}
                        onClick={(ev) => {
                          ev.stopPropagation();
                          audioManager.play("menu_click");
                          const amount = claimReward(ach.id);
                          if (amount > 0) addShards(amount);
                        }}
                      >
                        CLAIM ◈{ach.shardReward}
                      </button>
                    )}
                    {ach.shardReward && !isHidden && claimed[ach.id] && (
                      <div style={styles.claimedLabel}>◈ {ach.shardReward} claimed</div>
                    )}
                    {ach.shardReward && !isHidden && !isUnlocked && (
                      <div style={styles.cardReward}>◈ {ach.shardReward} shards</div>
                    )}
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
        </>
      )}

      {panelView === "guide" && (
        <div style={styles.guideContainer}>
          <div style={styles.title}>GUIDE</div>

          <GuideSection title="DUNGEON MODE" icon="⚔">
            Survive waves of increasingly dangerous enemies in a dark arena.
            Kill enemies to earn XP orbs, level up, and pick powerful upgrades.
            Every 10 waves a boss spawns. Dying ends the run — shards earned
            carry over to the Soul Forge for permanent upgrades.
          </GuideSection>

          <GuideSection title="TRIAL OF CHAMPIONS" icon="🏆">
            A 1v1 boss fight against a class-specific champion. Available on
            Normal, Hard, and Nightmare. Clearing a trial earns permanent stat
            buffs that apply to all future runs. Beat all trials to earn the
            Champion of All achievement.
          </GuideSection>

          <GuideSection title="THE LABYRINTH" icon="🌀">
            A procedural maze with 3 layers of increasing difficulty. Explore,
            fight rivals, find gear, and race the closing shroud zone. Extract
            via portals or descend deeper. Only Layer 3 victory lets you keep
            gear permanently. All other runs salvage gear into crystals (shards).
          </GuideSection>

          <GuideSection title="SOUL FORGE" icon="◈">
            Spend soul shards on permanent upgrades (Forge tab), manage your
            gear stash and loadout (Armory tab), or gamble for random gear
            (Gambler tab). Gear enhancement requires a duplicate of the same
            item as fusion material plus a shard cost.
          </GuideSection>

          <GuideSection title="GEAR SYSTEM" icon="🗡">
            Gear drops from enemies in three rarities: Common (gray), Rare
            (blue), Epic (purple). Each piece has stat bonuses and some have
            special proc effects. Enhancement increases stats — fuse a duplicate
            copy of the same gear plus spend shards. Max enhancement: Common +3,
            Rare +5, Epic +7.
          </GuideSection>

          <GuideSection title="CLASSES" icon="⚔">
            <b>Warrior</b> — Melee cleave, high HP, War Cry ultimate.{"\n"}
            <b>Mage</b> — Ranged orbs, AoE spells, Arcane Barrage ultimate.{"\n"}
            <b>Rogue</b> — Fast daggers, poison, Blade Storm ultimate.{"\n"}
            <b>Necromancer</b> — Summon skeletal minions, Death Surge AoE.{"\n"}
            <b>Bard</b> — Ranged notes, buffs nearby allies, sonic burst.
          </GuideSection>

          <GuideSection title="CONTROLS" icon="🎮">
            <b>WASD</b> — Move{"\n"}
            <b>Mouse</b> — Aim & auto-attack{"\n"}
            <b>Shift</b> — Dash (invincible during){"\n"}
            <b>Space</b> — Class action ability{"\n"}
            <b>ESC</b> — Pause{"\n"}
            <b>Mobile:</b> Left joystick to move, right side to aim & attack.
          </GuideSection>
        </div>
      )}
    </div>
  );
}

function GuideSection({ title, icon, children }: { title: string; icon: string; children: React.ReactNode }) {
  return (
    <div style={styles.guideSection}>
      <div style={styles.guideSectionTitle}>
        <span style={{ marginRight: 8 }}>{icon}</span>{title}
      </div>
      <div style={styles.guideSectionBody}>{children}</div>
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
  backBtn: {
    alignSelf: "flex-start",
    padding: "10px 18px",
    fontSize: 13,
    fontWeight: 900,
    letterSpacing: 2,
    color: "#bbb",
    background: "rgba(30,15,45,0.8)",
    border: "1px solid rgba(80,50,120,0.4)",
    borderRadius: 8,
    cursor: "pointer",
    fontFamily: "monospace",
  },
  viewToggle: {
    display: "flex",
    gap: 6,
  },
  viewBtn: {
    flex: 1,
    padding: "8px 12px",
    fontSize: 12,
    fontWeight: 900,
    letterSpacing: 3,
    color: "#666",
    background: "transparent",
    border: "1px solid rgba(80,50,120,0.3)",
    borderRadius: 6,
    cursor: "pointer",
    fontFamily: "monospace",
    transition: "all 0.15s",
  },
  viewBtnActive: {
    color: "#cc88ff",
    borderColor: "rgba(180,80,255,0.6)",
    background: "rgba(120,40,200,0.1)",
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
  cardReward: {
    fontSize: 9,
    color: "#c0a050",
    fontFamily: "monospace",
    letterSpacing: 1,
    marginTop: 1,
  },
  claimBtn: {
    marginTop: 4,
    padding: "5px 12px",
    fontSize: 11,
    fontWeight: 900,
    letterSpacing: 2,
    fontFamily: "monospace",
    color: "#ffd040",
    background: "rgba(180,140,20,0.15)",
    border: "1px solid rgba(255,200,0,0.5)",
    borderRadius: 5,
    cursor: "pointer",
    transition: "all 0.15s",
  },
  claimedLabel: {
    fontSize: 9,
    color: "#606040",
    fontFamily: "monospace",
    letterSpacing: 1,
    marginTop: 1,
    fontStyle: "italic",
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

  // ── Guide ──
  guideContainer: {
    display: "flex",
    flexDirection: "column",
    gap: 12,
  },
  guideSection: {
    background: "rgba(10,6,20,0.7)",
    border: "1px solid rgba(80,50,120,0.3)",
    borderRadius: 8,
    padding: "12px 14px",
  },
  guideSectionTitle: {
    fontSize: 13,
    fontWeight: 900,
    letterSpacing: 3,
    color: "#cc88ff",
    fontFamily: "monospace",
    marginBottom: 8,
  },
  guideSectionBody: {
    fontSize: 11,
    color: "rgba(200,180,220,0.75)",
    lineHeight: 1.6,
    fontFamily: "monospace",
    whiteSpace: "pre-line",
  },
};
