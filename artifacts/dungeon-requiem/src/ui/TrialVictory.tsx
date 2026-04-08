/**
 * TrialVictory.tsx
 * Full-screen overlay shown when the player defeats a Trial of Champions champion.
 */

import { useGameStore } from "../store/gameStore";
import { useMetaStore, TRIAL_BUFFS } from "../store/metaStore";
import { CHARACTER_DATA } from "../data/CharacterData";
import { DIFFICULTY_DATA } from "../data/DifficultyData";
import { ENEMY_DATA } from "../data/EnemyData";

interface TrialVictoryProps {
  onRetry: () => void;
}

const CHAMPION_LORE: Record<string, string> = {
  warrior: "He conquered the Vault once. The dungeon consumed what victory left behind. What you destroyed was not a warrior — it was a warning the dungeon kept to itself.",
  mage:    "She found what she sought: the source of all magic. It found her first. What you faced was not her — it was the hunger that wore her knowledge like a skin.",
  rogue:   "She escaped the Vault. Or thought she did. The dungeon keeps its debts. She became what she owed. You paid it in her place.",
};

const CLASS_ICONS: Record<string, string> = {
  warrior: "⚔",
  mage:    "✦",
  rogue:   "◆",
};

export function TrialVictory({ onRetry }: TrialVictoryProps) {
  const { selectedClass, difficultyTier, shardsThisRun, kills, score } = useGameStore();
  const { shards, trialWins } = useMetaStore();
  const def = CHARACTER_DATA[selectedClass];
  const diff = DIFFICULTY_DATA[difficultyTier];
  const lore = CHAMPION_LORE[selectedClass] ?? "The champion lies defeated.";
  const icon = CLASS_ICONS[selectedClass] ?? "◈";
  const champType = `${selectedClass}_champion` as keyof typeof ENEMY_DATA;
  const champDisplayName = ENEMY_DATA[champType]?.displayName ?? "The Champion";
  const champFullLabel = `${champDisplayName} — ${selectedClass.charAt(0).toUpperCase() + selectedClass.slice(1)} Champion`;

  // Find the buff earned for this specific class + difficulty
  const earnedBuff = TRIAL_BUFFS.find(b => b.class === selectedClass && b.difficulty === difficultyTier);
  // Check if this was a NEW clear (higher than previous)
  const prevClear = trialWins[selectedClass];
  const diffRank: Record<string, number> = { normal: 1, hard: 2, nightmare: 3 };
  const prevRank = prevClear ? (diffRank[prevClear] ?? 0) : 0;
  const thisRank = diffRank[difficultyTier] ?? 0;
  // The store already updated, so if current == this tier, it was a new record
  const isNewRecord = thisRank >= prevRank;

  return (
    <div style={styles.overlay}>
      <div style={styles.panel}>
        <div style={styles.trophyRow}>
          <div style={styles.trophyIcon}>🏆</div>
        </div>

        <div style={styles.victoryTitle}>TRIAL COMPLETE</div>

        <div style={{ ...styles.diffBadge, color: diff.accentColor, borderColor: diff.color + "80" }}>
          {diff.label} DIFFICULTY
        </div>

        <div style={styles.champLine}>
          <span style={{ ...styles.champIcon, color: def.accentColor }}>{icon}</span>
          <span style={{ ...styles.champName, color: def.accentColor }}>
            {champFullLabel} SLAIN
          </span>
        </div>

        <div style={styles.lore}>{lore}</div>

        <div style={styles.divider} />

        {/* Permanent buff award */}
        {earnedBuff && (
          <div style={styles.buffBox}>
            <div style={styles.buffTitle}>
              {isNewRecord ? "⚜ PERMANENT BUFF UNLOCKED" : "⚜ BUFF ALREADY EARNED"}
            </div>
            <div style={{ ...styles.buffName, color: isNewRecord ? "#ffcc40" : "#8070a0" }}>
              {earnedBuff.label}
            </div>
            <div style={{ ...styles.buffDesc, color: isNewRecord ? "#e0d0f0" : "#605070" }}>
              {earnedBuff.description}
            </div>
            {!isNewRecord && (
              <div style={styles.buffHint}>
                Clear on a higher difficulty for new buffs!
              </div>
            )}
          </div>
        )}

        <div style={styles.statRow}>
          <div style={styles.stat}>
            <div style={styles.statVal}>{score.toLocaleString()}</div>
            <div style={styles.statLbl}>SCORE</div>
          </div>
          <div style={styles.stat}>
            <div style={styles.statVal}>{kills}</div>
            <div style={styles.statLbl}>KILLS</div>
          </div>
        </div>

        <div style={styles.shardBox}>
          <div style={styles.shardTitle}>◈ SOUL SHARDS EARNED</div>
          <div style={styles.shardAmount}>+{shardsThisRun.toLocaleString()}</div>
          <div style={styles.shardTotal}>Total: {shards.toLocaleString()} shards</div>
        </div>

        <div style={styles.divider} />

        <div style={styles.btnCol}>
          <button style={styles.btnRetry} onClick={onRetry}>
            ↺ RETRY TRIAL
          </button>
          <button style={styles.btnMenu} onClick={() => {
            useGameStore.getState().setTrialMode(false);
            useGameStore.getState().setPhase("menu");
          }}>
            ⌂ RETURN TO MENU
          </button>
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: "absolute",
    inset: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "rgba(0,0,0,0.92)",
    backdropFilter: "blur(8px)",
    fontFamily: "'Segoe UI', monospace",
    overflowY: "auto",
    padding: "20px 0",
    zIndex: 100,
  },
  panel: {
    textAlign: "center",
    padding: "40px 48px",
    background: "rgba(6,2,14,0.98)",
    border: "1.5px solid rgba(255,180,0,0.45)",
    borderRadius: 18,
    boxShadow: "0 0 60px rgba(200,140,0,0.3), 0 0 120px rgba(100,60,0,0.2)",
    minWidth: 340,
    maxWidth: 460,
    width: "90vw",
    boxSizing: "border-box",
  },
  trophyRow: {
    marginBottom: 8,
  },
  trophyIcon: {
    fontSize: 60,
    filter: "drop-shadow(0 0 20px #ffaa00)",
    lineHeight: 1,
  },
  victoryTitle: {
    fontSize: 46,
    fontWeight: 900,
    color: "#ffcc00",
    letterSpacing: 6,
    textShadow: "0 0 30px #ffaa00, 0 0 60px #ff8800",
    marginBottom: 10,
    lineHeight: 1,
  },
  diffBadge: {
    display: "inline-block",
    fontSize: 11,
    letterSpacing: 3,
    border: "1px solid",
    borderRadius: 4,
    padding: "4px 12px",
    marginBottom: 16,
    fontFamily: "monospace",
  },
  champLine: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    marginBottom: 10,
  },
  champIcon: {
    fontSize: 28,
    filter: "drop-shadow(0 0 8px currentColor)",
  },
  champName: {
    fontSize: 18,
    fontWeight: 900,
    letterSpacing: 3,
    fontFamily: "monospace",
  },
  lore: {
    fontSize: 13,
    color: "rgba(200,180,220,0.7)",
    fontStyle: "italic",
    lineHeight: 1.6,
    marginBottom: 16,
    padding: "0 10px",
  },
  divider: {
    height: 1,
    background: "linear-gradient(to right, transparent, rgba(255,180,0,0.35), transparent)",
    margin: "16px 0",
  },
  statRow: {
    display: "flex",
    justifyContent: "center",
    gap: 40,
    marginBottom: 12,
  },
  stat: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 4,
  },
  statVal: {
    fontSize: 28,
    fontWeight: 900,
    color: "#ddd",
    fontFamily: "monospace",
  },
  statLbl: {
    fontSize: 10,
    letterSpacing: 3,
    color: "#7060a0",
    fontFamily: "monospace",
  },
  shardBox: {
    background: "rgba(60,20,100,0.4)",
    border: "1px solid rgba(120,60,180,0.5)",
    borderRadius: 10,
    padding: "14px",
    marginTop: 4,
  },
  shardTitle: {
    fontSize: 11,
    letterSpacing: 3,
    color: "#9060c0",
    fontFamily: "monospace",
  },
  shardAmount: {
    fontSize: 34,
    fontWeight: 900,
    color: "#d0a0ff",
    textShadow: "0 0 16px #9030d0",
    fontFamily: "monospace",
    lineHeight: 1.3,
  },
  shardTotal: {
    fontSize: 12,
    color: "#7050a0",
    fontFamily: "monospace",
    marginTop: 2,
  },
  buffBox: {
    background: "rgba(80,50,0,0.3)",
    border: "1px solid rgba(200,150,0,0.4)",
    borderRadius: 10,
    padding: "14px",
    textAlign: "center" as const,
    marginBottom: 8,
  },
  buffTitle: {
    fontSize: 10,
    letterSpacing: 3,
    color: "#aa8030",
    fontFamily: "monospace",
    marginBottom: 6,
  },
  buffName: {
    fontSize: 18,
    fontWeight: 900,
    fontFamily: "monospace",
    letterSpacing: 2,
    textShadow: "0 0 10px rgba(255,180,0,0.4)",
  },
  buffDesc: {
    fontSize: 13,
    fontFamily: "monospace",
    marginTop: 4,
    lineHeight: 1.4,
  },
  buffHint: {
    fontSize: 10,
    color: "#605060",
    fontFamily: "monospace",
    marginTop: 6,
    fontStyle: "italic" as const,
  },
  btnCol: {
    display: "flex",
    flexDirection: "column",
    gap: 10,
  },
  btnRetry: {
    width: "100%",
    padding: "15px",
    fontSize: 15,
    fontWeight: 900,
    letterSpacing: 2,
    color: "#fff",
    background: "linear-gradient(135deg, #aa6600, #cc8800)",
    border: "1px solid #ffaa00",
    borderRadius: 8,
    cursor: "pointer",
    fontFamily: "inherit",
    boxShadow: "0 0 18px rgba(200,130,0,0.4)",
    minHeight: 50,
  },
  btnMenu: {
    width: "100%",
    padding: "13px",
    fontSize: 13,
    fontWeight: "bold",
    letterSpacing: 1,
    color: "#bbb",
    background: "rgba(30,15,50,0.8)",
    border: "1px solid rgba(90,60,120,0.4)",
    borderRadius: 8,
    cursor: "pointer",
    fontFamily: "inherit",
    minHeight: 46,
  },
};
