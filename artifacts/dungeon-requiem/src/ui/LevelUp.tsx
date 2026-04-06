/**
 * LevelUp.tsx
 * Pause overlay for choosing level-up upgrades.
 */

import { useGameStore } from "../store/gameStore";
import type { UpgradeDef } from "../data/UpgradeData";

interface LevelUpProps {
  onChoice: (id: string) => void;
}

export function LevelUp({ onChoice }: LevelUpProps) {
  const { level, levelUpChoices } = useGameStore();

  return (
    <div style={styles.overlay}>
      <div style={styles.panel}>
        <div style={styles.header}>
          <div style={styles.levelBadge}>LEVEL {level}</div>
          <div style={styles.title}>POWER ASCENDED</div>
          <div style={styles.sub}>Choose one enhancement</div>
        </div>

        <div style={styles.choices}>
          {levelUpChoices.map((choice) => (
            <UpgradeCard key={choice.id} upgrade={choice} onSelect={() => onChoice(choice.id)} />
          ))}
        </div>
      </div>
    </div>
  );
}

function UpgradeCard({ upgrade, onSelect }: { upgrade: UpgradeDef; onSelect: () => void }) {
  return (
    <button style={styles.card} onClick={onSelect}>
      <div style={styles.cardIcon}>{upgrade.icon}</div>
      <div style={styles.cardContent}>
        <div style={styles.cardName}>{upgrade.name}</div>
        <div style={styles.cardDesc}>{upgrade.description}</div>
      </div>
    </button>
  );
}

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: "absolute",
    inset: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "rgba(0,0,0,0.8)",
    backdropFilter: "blur(6px)",
    fontFamily: "'Segoe UI', monospace",
    zIndex: 100,
  },
  panel: {
    padding: "40px 48px",
    background: "rgba(8,4,16,0.97)",
    border: "1px solid rgba(120,80,180,0.5)",
    borderRadius: 16,
    boxShadow: "0 0 60px rgba(80,0,160,0.3)",
    maxWidth: 680,
    width: "90%",
  },
  header: {
    textAlign: "center",
    marginBottom: 32,
  },
  levelBadge: {
    display: "inline-block",
    background: "rgba(100,0,180,0.3)",
    border: "1px solid rgba(120,0,200,0.6)",
    borderRadius: 20,
    padding: "4px 20px",
    color: "#cc88ff",
    fontSize: 13,
    letterSpacing: 3,
    fontWeight: "bold",
    marginBottom: 10,
  },
  title: {
    fontSize: 34,
    fontWeight: "900",
    color: "#ddaaff",
    letterSpacing: 6,
    textShadow: "0 0 20px #8800ff",
  },
  sub: {
    color: "rgba(180,160,200,0.6)",
    fontSize: 14,
    marginTop: 8,
    letterSpacing: 2,
  },
  choices: {
    display: "flex",
    flexDirection: "column",
    gap: 12,
  },
  card: {
    display: "flex",
    alignItems: "center",
    gap: 20,
    padding: "18px 24px",
    background: "rgba(40,20,60,0.6)",
    border: "1px solid rgba(120,80,160,0.35)",
    borderRadius: 10,
    cursor: "pointer",
    textAlign: "left",
    transition: "all 0.15s ease",
    fontFamily: "inherit",
  },
  cardIcon: {
    fontSize: 36,
    flexShrink: 0,
    width: 52,
    height: 52,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "rgba(60,30,90,0.8)",
    borderRadius: 8,
    border: "1px solid rgba(120,80,160,0.4)",
  },
  cardContent: {
    flex: 1,
  },
  cardName: {
    color: "#ddaaff",
    fontSize: 17,
    fontWeight: "bold",
    marginBottom: 5,
    letterSpacing: 1,
  },
  cardDesc: {
    color: "rgba(190,170,210,0.75)",
    fontSize: 13,
    lineHeight: 1.5,
  },
};
