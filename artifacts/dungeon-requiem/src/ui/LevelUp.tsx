/**
 * LevelUp.tsx
 * Pause overlay for choosing level-up upgrades.
 * Relics (isRelic: true) get a distinct gold border + crown badge.
 */

import { useGameStore } from "../store/gameStore";
import { audioManager } from "../audio/AudioManager";
import type { UpgradeDef, UpgradeRarity } from "../data/UpgradeData";

// ─── Rarity color theming ────────────────────────────────────────────────────

const RARITY_THEME: Record<UpgradeRarity, {
  bg: string; bgHover: string;
  border: string; borderHover: string;
  glow: string; nameColor: string;
  badgeColor: string; badgeBg: string; badgeBorder: string;
  iconBg: string; iconBorder: string;
}> = {
  common: {
    bg: "rgba(40,35,50,0.6)", bgHover: "rgba(60,55,70,0.75)",
    border: "rgba(100,95,120,0.35)", borderHover: "rgba(140,130,160,0.6)",
    glow: "none", nameColor: "#c0b8d0",
    badgeColor: "#9990aa", badgeBg: "rgba(80,75,100,0.4)", badgeBorder: "rgba(100,95,120,0.5)",
    iconBg: "rgba(50,45,65,0.8)", iconBorder: "rgba(100,95,120,0.4)",
  },
  rare: {
    bg: "rgba(15,30,65,0.6)", bgHover: "rgba(25,45,90,0.75)",
    border: "rgba(60,120,220,0.4)", borderHover: "rgba(80,150,255,0.7)",
    glow: "0 0 12px rgba(60,120,255,0.25)", nameColor: "#70b0ff",
    badgeColor: "#60a0ff", badgeBg: "rgba(20,50,120,0.5)", badgeBorder: "rgba(60,120,220,0.6)",
    iconBg: "rgba(15,35,75,0.8)", iconBorder: "rgba(60,120,220,0.5)",
  },
  epic: {
    bg: "rgba(45,15,70,0.6)", bgHover: "rgba(65,25,100,0.75)",
    border: "rgba(160,60,255,0.45)", borderHover: "rgba(190,100,255,0.75)",
    glow: "0 0 14px rgba(140,40,255,0.3)", nameColor: "#cc88ff",
    badgeColor: "#bb70ff", badgeBg: "rgba(80,20,140,0.5)", badgeBorder: "rgba(160,60,255,0.6)",
    iconBg: "rgba(55,20,90,0.8)", iconBorder: "rgba(160,60,255,0.5)",
  },
};

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
            <UpgradeCard
              key={choice.id}
              upgrade={choice}
              onSelect={() => { audioManager.play("menu_click"); onChoice(choice.id); }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function UpgradeCard({ upgrade, onSelect }: { upgrade: UpgradeDef; onSelect: () => void }) {
  const isRelic = !!upgrade.isRelic;
  const rarity = upgrade.rarity ?? "common";
  const theme = RARITY_THEME[rarity];

  return (
    <button
      style={{
        ...styles.card,
        ...(isRelic
          ? styles.cardRelic
          : {
              background: theme.bg,
              border: `1px solid ${theme.border}`,
              boxShadow: theme.glow,
            }
        ),
      }}
      onClick={onSelect}
      onMouseEnter={(e) => {
        const el = e.currentTarget;
        if (isRelic) {
          el.style.background = "rgba(90,60,0,0.75)";
          el.style.borderColor = "rgba(255,180,0,0.9)";
          el.style.boxShadow = "0 0 22px rgba(255,160,0,0.5)";
        } else {
          el.style.background = theme.bgHover;
          el.style.borderColor = theme.borderHover;
          el.style.boxShadow = rarity === "common" ? "0 0 10px rgba(100,90,130,0.2)" : theme.glow.replace("0.25", "0.5").replace("0.3", "0.55");
        }
      }}
      onMouseLeave={(e) => {
        const el = e.currentTarget;
        if (isRelic) {
          el.style.background = "rgba(60,40,0,0.6)";
          el.style.borderColor = "rgba(220,150,0,0.7)";
          el.style.boxShadow = "0 0 10px rgba(200,120,0,0.3)";
        } else {
          el.style.background = theme.bg;
          el.style.borderColor = theme.border;
          el.style.boxShadow = theme.glow;
        }
      }}
    >
      <div style={{
        ...styles.cardIcon,
        ...(isRelic
          ? styles.cardIconRelic
          : { background: theme.iconBg, border: `1px solid ${theme.iconBorder}` }
        ),
      }}>
        {upgrade.icon}
      </div>
      <div style={styles.cardContent}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{
            ...styles.cardName,
            ...(isRelic ? styles.cardNameRelic : { color: theme.nameColor }),
          }}>
            {upgrade.name}
          </div>
          {isRelic && (
            <span style={styles.relicBadge}>RELIC</span>
          )}
          {!isRelic && rarity !== "common" && (
            <span style={{
              display: "inline-block",
              background: theme.badgeBg,
              border: `1px solid ${theme.badgeBorder}`,
              borderRadius: 4,
              padding: "2px 8px",
              color: theme.badgeColor,
              fontSize: 10,
              fontWeight: "bold",
              letterSpacing: 2,
            }}>
              {rarity.toUpperCase()}
            </span>
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
    minHeight: 56,
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
