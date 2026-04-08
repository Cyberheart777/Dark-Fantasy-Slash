/**
 * SoulForge.tsx
 * Permanent upgrade shop between runs.
 * Each upgrade uses flat StatModifiers — stacks correctly with per-run bonuses.
 */

import { useState } from "react";
import { useMetaStore, TRIAL_BUFFS, getEarnedTrialBuffs } from "../store/metaStore";
import { META_UPGRADES, nextRankCost, nextRankLine } from "../data/MetaUpgradeData";
import { DIFFICULTIES, DIFFICULTY_DATA } from "../data/DifficultyData";
import { useGameStore } from "../store/gameStore";

export function SoulForge() {
  const { shards, totalShardsEarned, purchased, purchaseRank, trialWins } = useMetaStore();
  const setPhase = useGameStore((s) => s.setPhase);
  const [flash, setFlash] = useState<string | null>(null);

  const handleBuy = (id: string, cost: number, maxRanks: number) => {
    const ok = purchaseRank(id, cost, maxRanks);
    setFlash(ok ? id : "__denied__");
    setTimeout(() => setFlash(null), 600);
  };

  return (
    <div style={styles.overlay}>
      <div style={styles.panel}>

        {/* Header */}
        <button style={styles.backBtn} onClick={() => setPhase("menu")}>← BACK</button>

        <div style={styles.titleRow}>
          <div style={styles.title}>SOUL FORGE</div>
          <div style={styles.shardsDisplay}>
            <span style={styles.shardIcon}>◈</span>
            <span style={styles.shardCount}>{shards.toLocaleString()}</span>
            <span style={styles.shardLabel}> shards</span>
          </div>
        </div>
        <div style={styles.subtitle}>
          Permanent upgrades that carry into every run.
          {totalShardsEarned > 0 && (
            <span style={styles.totalEarned}> Total earned: {totalShardsEarned.toLocaleString()}</span>
          )}
        </div>

        <div style={styles.howTo}>
          Shards drop from kills · bonus shards awarded on death based on waves survived.
        </div>

        <div style={styles.vaultQuote}>
          "The dungeon does not forget those who survive it. Every Shard you carry back… is a thread binding you to what waits below."
        </div>

        {/* Trial of Champions — per-difficulty progress */}
        <div style={styles.trialBox}>
          <div style={styles.trialTitle}>🏆 TRIAL OF CHAMPIONS — PERMANENT BUFFS</div>
          <div style={styles.trialRow}>
            {([["warrior", "⚔", "#e06020"], ["mage", "✦", "#6020e0"], ["rogue", "◆", "#20a0e0"]] as [string, string, string][]).map(([cls, icon, color]) => {
              const highestClear = trialWins?.[cls] as string | undefined;
              const diffRank = highestClear ? ({ normal: 1, hard: 2, nightmare: 3 }[highestClear] ?? 0) : 0;
              return (
                <div key={cls} style={{
                  ...styles.trialCard,
                  borderColor: diffRank > 0 ? color + "88" : "#1a1228",
                  boxShadow: diffRank > 0 ? `0 0 14px ${color}44` : "none",
                }}>
                  <div style={{ fontSize: 22, filter: diffRank > 0 ? `drop-shadow(0 0 6px ${color})` : "none" }}>{icon}</div>
                  <div style={{ fontSize: 9, letterSpacing: 2, color: diffRank > 0 ? color : "#4a3060", fontFamily: "monospace", marginTop: 4 }}>
                    {cls.toUpperCase()}
                  </div>
                  {/* Per-difficulty pips */}
                  <div style={{ display: "flex", gap: 4, marginTop: 6 }}>
                    {DIFFICULTIES.map((tier, i) => {
                      const d = DIFFICULTY_DATA[tier];
                      const cleared = diffRank >= i + 1;
                      return (
                        <div key={tier} style={{
                          width: 20, height: 6, borderRadius: 3,
                          background: cleared ? d.color : "#1a1228",
                          boxShadow: cleared ? `0 0 4px ${d.color}` : "none",
                        }} title={`${d.label}: ${cleared ? "Cleared" : "Locked"}`} />
                      );
                    })}
                  </div>
                  {/* Current buff summary */}
                  {diffRank > 0 && (
                    <div style={{ fontSize: 9, color: "#8070a0", marginTop: 4, lineHeight: 1.4, fontFamily: "monospace" }}>
                      {TRIAL_BUFFS
                        .filter(b => b.class === cls && ({ normal: 1, hard: 2, nightmare: 3 }[b.difficulty] ?? 0) <= diffRank)
                        .map(b => b.description.replace(" permanently", ""))
                        .join(", ")}
                    </div>
                  )}
                  {diffRank === 0 && (
                    <div style={{ fontSize: 9, color: "#3a2050", marginTop: 4, fontFamily: "monospace" }}>○ LOCKED</div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Upgrade grid */}
        <div style={styles.grid}>
          {META_UPGRADES.map((def) => {
            const rank = purchased[def.id] ?? 0;
            const maxed = rank >= def.maxRanks;
            const cost = nextRankCost(def, rank);
            const canAfford = shards >= cost;
            const nextLine = nextRankLine(def, rank);
            const isBuyFlash = flash === def.id;
            const isDenied = flash === "__denied__" && !canAfford;

            return (
              <div
                key={def.id}
                style={{
                  ...styles.card,
                  borderColor: maxed
                    ? "#ffd700aa"
                    : isBuyFlash
                    ? "#a0ffa0"
                    : "#2a1f3d",
                  boxShadow: maxed
                    ? "0 0 16px #ffd70044"
                    : isBuyFlash
                    ? "0 0 16px #40ff4066"
                    : "none",
                }}
              >
                <div style={styles.cardHeader}>
                  <span style={styles.icon}>{def.icon}</span>
                  <div style={styles.cardTitles}>
                    <div style={styles.cardName}>{def.name}</div>
                    <div style={styles.cardFlavour}>{def.title}</div>
                  </div>
                  {maxed && <span style={styles.maxedBadge}>MAX</span>}
                </div>

                <div style={styles.cardDesc}>{def.description}</div>

                {/* Rank pips */}
                <div style={styles.pips}>
                  {Array.from({ length: def.maxRanks }).map((_, i) => (
                    <div
                      key={i}
                      style={{
                        ...styles.pip,
                        background: i < rank ? "#c080ff" : "#1a1228",
                        boxShadow: i < rank ? "0 0 6px #8040cc" : "none",
                      }}
                    />
                  ))}
                </div>

                {/* Current bonus line */}
                {rank > 0 && (
                  <div style={styles.currentBonus}>
                    Now: {def.statLine(rank)}
                  </div>
                )}

                {/* Buy button */}
                {maxed ? (
                  <div style={styles.maxedLabel}>✦ FULLY UPGRADED</div>
                ) : (
                  <button
                    style={{
                      ...styles.buyBtn,
                      opacity: canAfford ? 1 : 0.45,
                      borderColor: canAfford ? "#7040cc" : "#3a2050",
                      background: canAfford
                        ? "linear-gradient(135deg, #3a1a60, #5a2090)"
                        : "#1a1228",
                    }}
                    onClick={() => handleBuy(def.id, cost, def.maxRanks)}
                  >
                    <span style={styles.buyNext}>{nextLine}</span>
                    <span style={styles.buyCost}>
                      <span style={{ color: canAfford ? "#d0a0ff" : "#605070" }}>◈</span>
                      {" "}{cost.toLocaleString()}
                    </span>
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div style={styles.footer}>
          Stacking math: meta bonuses (flat) → run upgrades (additive %) → item multipliers
        </div>

        <button
          style={styles.playBtn}
          onClick={() => setPhase("charselect")}
        >
          ⚔ DESCEND INTO THE DUNGEON
        </button>

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
    background: "linear-gradient(160deg, #04000a 0%, #0a0520 100%)",
    fontFamily: "'Segoe UI', monospace",
    userSelect: "none",
  },
  panel: {
    maxWidth: 700,
    margin: "0 auto",
    padding: "20px 16px 40px",
    display: "flex",
    flexDirection: "column",
    gap: 14,
    boxSizing: "border-box",
    width: "100%",
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
  },
  titleRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: 8,
  },
  title: {
    fontSize: 26,
    fontWeight: 900,
    letterSpacing: 6,
    color: "#d0a0ff",
    textShadow: "0 0 20px #9030d0",
    fontFamily: "monospace",
  },
  shardsDisplay: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    background: "rgba(80,30,120,0.3)",
    border: "1px solid #4a2080",
    borderRadius: 8,
    padding: "8px 14px",
  },
  shardIcon: {
    fontSize: 18,
    color: "#d0a0ff",
    textShadow: "0 0 10px #9040cc",
  },
  shardCount: {
    fontSize: 20,
    fontWeight: 900,
    color: "#d0a0ff",
    fontFamily: "monospace",
  },
  shardLabel: {
    fontSize: 12,
    color: "#806090",
    fontFamily: "monospace",
  },
  subtitle: {
    fontSize: 13,
    color: "#806090",
    fontFamily: "monospace",
    letterSpacing: 1,
  },
  totalEarned: {
    color: "#a060c0",
  },
  howTo: {
    fontSize: 11,
    color: "#504060",
    fontFamily: "monospace",
    letterSpacing: 1,
    borderLeft: "2px solid #3a1a50",
    paddingLeft: 10,
  },
  vaultQuote: {
    fontSize: 11,
    color: "rgba(180,140,220,0.5)",
    fontStyle: "italic",
    fontFamily: "monospace",
    lineHeight: 1.7,
    textAlign: "center",
    padding: "8px 16px",
    borderTop: "1px solid #1e1230",
    borderBottom: "1px solid #1e1230",
  },
  grid: {
    display: "flex",
    flexDirection: "column",
    gap: 12,
  },
  card: {
    border: "1.5px solid #2a1f3d",
    borderRadius: 12,
    padding: "16px",
    background: "#0e0919",
    display: "flex",
    flexDirection: "column",
    gap: 10,
    transition: "border-color 0.2s, box-shadow 0.2s",
  },
  cardHeader: {
    display: "flex",
    alignItems: "center",
    gap: 12,
  },
  icon: {
    fontSize: 24,
    flexShrink: 0,
    filter: "drop-shadow(0 0 4px #9040cc)",
  },
  cardTitles: {
    flex: 1,
  },
  cardName: {
    fontSize: 15,
    fontWeight: 900,
    letterSpacing: 2,
    color: "#c080f0",
    fontFamily: "monospace",
  },
  cardFlavour: {
    fontSize: 10,
    color: "#6a4080",
    letterSpacing: 2,
    fontFamily: "monospace",
    textTransform: "uppercase",
  },
  maxedBadge: {
    fontSize: 10,
    letterSpacing: 2,
    color: "#ffd700",
    border: "1px solid #ffd70066",
    borderRadius: 4,
    padding: "3px 8px",
    fontFamily: "monospace",
    flexShrink: 0,
  },
  cardDesc: {
    fontSize: 12,
    color: "#7060a0",
    fontFamily: "monospace",
    lineHeight: 1.5,
  },
  pips: {
    display: "flex",
    gap: 6,
  },
  pip: {
    width: 32,
    height: 8,
    borderRadius: 4,
    transition: "background 0.2s, box-shadow 0.2s",
  },
  currentBonus: {
    fontSize: 11,
    color: "#c080f0",
    fontFamily: "monospace",
    letterSpacing: 1,
  },
  buyBtn: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    border: "1px solid #3a2050",
    borderRadius: 8,
    padding: "12px 16px",
    cursor: "pointer",
    fontFamily: "monospace",
    minHeight: 48,
    transition: "opacity 0.15s, border-color 0.15s",
    gap: 8,
  },
  buyNext: {
    fontSize: 12,
    color: "#c0a0e0",
    letterSpacing: 1,
    textAlign: "left",
  },
  buyCost: {
    fontSize: 14,
    fontWeight: 900,
    color: "#d0a0ff",
    letterSpacing: 1,
    whiteSpace: "nowrap",
  },
  maxedLabel: {
    textAlign: "center",
    fontSize: 11,
    letterSpacing: 3,
    color: "#ffd700",
    fontFamily: "monospace",
    padding: "8px 0 4px",
  },
  trialBox: {
    background: "#080612",
    border: "1px solid rgba(180,130,0,0.25)",
    borderRadius: 10,
    padding: "14px 16px",
    display: "flex",
    flexDirection: "column",
    gap: 10,
  },
  trialTitle: {
    fontSize: 11,
    letterSpacing: 3,
    color: "#8a6010",
    fontFamily: "monospace",
  },
  trialRow: {
    display: "flex",
    gap: 10,
  },
  trialCard: {
    flex: 1,
    border: "1.5px solid #1a1228",
    borderRadius: 8,
    padding: "12px 8px",
    textAlign: "center" as const,
    background: "#0a0610",
    display: "flex",
    flexDirection: "column" as const,
    alignItems: "center",
    transition: "all 0.2s",
  },
  footer: {
    fontSize: 10,
    color: "#3a2850",
    fontFamily: "monospace",
    textAlign: "center",
    letterSpacing: 1,
    borderTop: "1px solid #1a1228",
    paddingTop: 12,
  },
  playBtn: {
    width: "100%",
    padding: "18px",
    border: "none",
    borderRadius: 10,
    background: "linear-gradient(135deg, #4a0880, #7020b0)",
    color: "#fff",
    fontWeight: 900,
    fontSize: 15,
    letterSpacing: 2,
    fontFamily: "monospace",
    cursor: "pointer",
    minHeight: 56,
    boxShadow: "0 4px 20px #6010a060",
  },
};
