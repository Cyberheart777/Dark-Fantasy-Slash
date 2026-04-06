/**
 * LevelUp.tsx
 * Pause overlay for choosing level-up upgrades.
 * Relics (isRelic: true) get a distinct gold border + crown badge.
 */

import { useGameStore } from "../store/gameStore";
import type { UpgradeDef } from "../data/UpgradeData";

interface LevelUpProps {
  onChoice: (id: string) => void;
}

export function LevelUp({ onChoice }: LevelUpProps) {
  const { level, levelUpChoices } = useGameStore();
  const hasRelic = levelUpChoices.some((c) => c.isRelic);

  return (
    <div style={styles.overlay}>
      <div style={styles.panel}>
        <div style={styles.header}>
          <div style={styles.levelBadge}>LEVEL {level}</div>
          <div style={styles.title}>{hasRelic ? "RELIC DISCOVERED" : "POWER ASCENDED"}</div>
          <div style={styles.sub}>{hasRelic ? "A legendary relic awaits you" : "Choose one enhancement"}</div>
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
  const isRelic = !!upgrade.isRelic;
  return (
    <button
      style={{
        ...styles.card,
        ...(isRelic ? styles.cardRelic : {}),
      }}
      onClick={onSelect}
      onMouseEnter={(e) => {
        const el = e.currentTarget;
        el.style.background = isRelic
          ? "rgba(90,60,0,0.75)"
          : "rgba(70,40,100,0.75)";
        el.style.borderColor = isRelic
          ? "rgba(255,180,0,0.9)"
          : "rgba(180,100,255,0.7)";
        el.style.boxShadow = isRelic
          ? "0 0 22px rgba(255,160,0,0.5)"
          : "0 0 16px rgba(120,0,220,0.4)";
      }}
      onMouseLeave={(e) => {
        const el = e.currentTarget;
        el.style.background = isRelic
          ? "rgba(60,40,0,0.6)"
          : "rgba(40,20,60,0.6)";
        el.style.borderColor = isRelic
          ? "rgba(220,150,0,0.7)"
          : "rgba(120,80,160,0.35)";
        el.style.boxShadow = isRelic
          ? "0 0 10px rgba(200,120,0,0.3)"
          : "none";
      }}
    >
      <div style={{ ...styles.cardIcon, ...(isRelic ? styles.cardIconRelic : {}) }}>
        {upgrade.icon}
      </div>
      <div style={styles.cardContent}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ ...styles.cardName, ...(isRelic ? styles.cardNameRelic : {}) }}>
            {upgrade.name}
          </div>
          {isRelic && (
            <span style={styles.relicBadge}>RELIC</span>
          )}
        </div>
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
    boxShadow: "none",
  },
  cardRelic: {
    background: "rgba(60,40,0,0.6)",
    border: "2px solid rgba(220,150,0,0.7)",
    boxShadow: "0 0 10px rgba(200,120,0,0.3)",
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
  cardIconRelic: {
    background: "rgba(80,50,0,0.8)",
    border: "2px solid rgba(220,150,0,0.6)",
    boxShadow: "0 0 12px rgba(255,160,0,0.4)",
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
  cardNameRelic: {
    color: "#ffd060",
    textShadow: "0 0 8px rgba(255,180,0,0.5)",
  },
  cardDesc: {
    color: "rgba(190,170,210,0.75)",
    fontSize: 13,
    lineHeight: 1.5,
  },
  relicBadge: {
    display: "inline-block",
    background: "rgba(180,110,0,0.5)",
    border: "1px solid rgba(255,160,0,0.6)",
    borderRadius: 4,
    padding: "2px 8px",
    color: "#ffc040",
    fontSize: 10,
    fontWeight: "bold",
    letterSpacing: 2,
  },
};
