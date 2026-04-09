/**
 * PauseMenu.tsx
 * Pause overlay with three views:
 *   - main       : resume / inventory / extract / settings / main menu
 *   - inventory  : view spare gear from the in-run inventory, equip or sell
 *   - settings   : delegated to the shared SettingsPanel component (also
 *                  used by MainMenu)
 */

import { useState } from "react";
import { useGameStore } from "../store/gameStore";
import { audioManager } from "../audio/AudioManager";
import { GEAR_RARITY_COLOR, type GearDef } from "../data/GearData";
import { SettingsPanel } from "./SettingsPanel";

const click = (fn: () => void) => () => { audioManager.play("menu_click"); fn(); };

type PauseView = "main" | "inventory" | "settings";

interface PauseMenuProps {
  onExtract?: () => void;
  onEquipFromInventory?: (index: number) => void;
  onSellFromInventory?: (index: number) => void;
}

export function PauseMenu({ onExtract, onEquipFromInventory, onSellFromInventory }: PauseMenuProps) {
  const {
    setPhase, highestBossWaveCleared, trialMode,
    inventory, equippedWeapon, equippedArmor, equippedTrinket,
  } = useGameStore();

  const [view, setView] = useState<PauseView>("main");

  const showExtract = !trialMode && highestBossWaveCleared > 0 && onExtract != null;
  const extractLabel =
    highestBossWaveCleared >= 20 ? "100%" :
    highestBossWaveCleared >= 15 ? "75%" :
    highestBossWaveCleared >= 10 ? "50%" :
    "25%";

  const handleMainMenu = () => {
    const s = useGameStore.getState();
    const prevBest = s.bestScore;
    const prevWave = s.bestWave;
    s.resetGame();
    s.setBestScore(prevBest, prevWave);
    s.setPhase("menu");
  };

  return (
    <div style={styles.overlay}>
      <div style={styles.panel}>
        <div style={styles.title}>PAUSED</div>
        <div style={styles.sub}>The dungeon holds its breath...</div>

        <div style={styles.divider} />

        {view === "main" && (
          <>
            <div style={styles.btnCol}>
              <button style={styles.btnPrimary} onClick={click(() => setPhase("playing"))}>
                ▶ RESUME
              </button>

              <button style={styles.btnInventory} onClick={click(() => setView("inventory"))}>
                🎒 INVENTORY{inventory.length > 0 ? ` (${inventory.length})` : ""}
              </button>

              {showExtract && (
                <button style={styles.btnExtract} onClick={click(() => onExtract?.())}>
                  ↑ EXTRACT RUN — Keep {extractLabel} of shards
                </button>
              )}

              <button style={styles.btnSettings} onClick={click(() => setView("settings"))}>
                ⚙ SETTINGS
              </button>

              <button style={styles.btnSecondary} onClick={click(handleMainMenu)}>
                ⌂ MAIN MENU
              </button>
            </div>

            <div style={styles.controls}>
              <span style={{ color: "rgba(180,160,200,0.4)" }}>Press ESC to resume</span>
            </div>
          </>
        )}

        {view === "inventory" && (
          <InventoryView
            inventory={inventory}
            equipped={{
              weapon: equippedWeapon,
              armor: equippedArmor,
              trinket: equippedTrinket,
            }}
            onEquip={onEquipFromInventory}
            onSell={onSellFromInventory}
            onBack={() => setView("main")}
          />
        )}

        {view === "settings" && (
          <SettingsPanel onClose={() => setView("main")} />
        )}
      </div>
    </div>
  );
}

// ─── Inventory view ──────────────────────────────────────────────────────────

function InventoryView({
  inventory,
  equipped,
  onEquip,
  onSell,
  onBack,
}: {
  inventory: GearDef[];
  equipped: { weapon: GearDef | null; armor: GearDef | null; trinket: GearDef | null };
  onEquip?: (index: number) => void;
  onSell?: (index: number) => void;
  onBack: () => void;
}) {
  return (
    <>
      <div style={styles.settingsWrapper}>
        {/* Currently equipped gear — read-only summary at the top */}
        <div style={styles.sectionTitle}>EQUIPPED</div>
        <div style={styles.equippedRow}>
          <EquippedSlot label="Weapon"  gear={equipped.weapon} />
          <EquippedSlot label="Armor"   gear={equipped.armor} />
          <EquippedSlot label="Trinket" gear={equipped.trinket} />
        </div>

        {/* Spare inventory — the actual list of pickable items */}
        <div style={styles.sectionTitle}>
          SPARE GEAR ({inventory.length}/20)
        </div>

        {inventory.length === 0 ? (
          <div style={styles.emptyInv}>
            No spare gear yet. Dupes drop into this list once a slot is occupied.
          </div>
        ) : (
          <div style={styles.invList}>
            {inventory.map((item, i) => {
              const rc = GEAR_RARITY_COLOR[item.rarity];
              const sellValue = item.rarity === "epic" ? 35 : item.rarity === "rare" ? 15 : 5;
              return (
                <div
                  key={`${item.id}-${i}`}
                  style={{
                    ...styles.invItem,
                    borderColor: rc.border,
                    boxShadow: rc.glow === "none" ? undefined : rc.glow,
                  }}
                >
                  <div style={styles.invItemLeft}>
                    <span style={styles.invIcon}>{item.icon}</span>
                    <div style={styles.invTextCol}>
                      <div style={{ ...styles.invName, color: rc.text }}>
                        {item.name}
                        <span style={styles.invSlot}> · {item.slot}</span>
                      </div>
                      <div style={styles.invDesc}>{item.description}</div>
                    </div>
                  </div>
                  <div style={styles.invItemBtns}>
                    <button
                      style={styles.invEquipBtn}
                      onClick={click(() => onEquip?.(i))}
                    >
                      EQUIP
                    </button>
                    <button
                      style={styles.invSellBtn}
                      onClick={click(() => onSell?.(i))}
                    >
                      SELL ◈{sellValue}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <button style={styles.btnBack} onClick={click(onBack)}>
        ← BACK
      </button>
    </>
  );
}

function EquippedSlot({ label, gear }: { label: string; gear: GearDef | null }) {
  if (!gear) {
    return (
      <div style={{ ...styles.equippedSlot, opacity: 0.5 }}>
        <div style={styles.equippedIcon}>—</div>
        <div style={styles.equippedLabel}>{label}</div>
      </div>
    );
  }
  const rc = GEAR_RARITY_COLOR[gear.rarity];
  return (
    <div style={{ ...styles.equippedSlot, borderColor: rc.border }}>
      <div style={styles.equippedIcon}>{gear.icon}</div>
      <div style={{ ...styles.equippedName, color: rc.text }}>{gear.name}</div>
    </div>
  );
}

// Slider, Toggle, and the audio/visual/controls UI all live in
// SettingsPanel.tsx now (shared by MainMenu + PauseMenu).

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: "absolute",
    inset: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "rgba(0,0,0,0.75)",
    backdropFilter: "blur(8px)",
    fontFamily: "'Segoe UI', monospace",
    zIndex: 100,
  },
  panel: {
    textAlign: "center",
    padding: "48px 64px",
    background: "rgba(6,3,12,0.97)",
    border: "1px solid rgba(80,50,120,0.5)",
    borderRadius: 16,
    boxShadow: "0 0 40px rgba(60,0,120,0.25)",
    minWidth: 360,
    maxWidth: 440,
  },
  title: {
    fontSize: 52,
    fontWeight: "900",
    color: "#aa88cc",
    letterSpacing: 10,
    textShadow: "0 0 20px #6600aa",
    marginBottom: 8,
  },
  sub: {
    color: "rgba(180,160,200,0.5)",
    fontSize: 14,
    fontStyle: "italic",
    letterSpacing: 1,
  },
  divider: {
    height: 1,
    background: "linear-gradient(to right, transparent, rgba(80,50,120,0.5), transparent)",
    margin: "28px 0",
  },
  btnCol: {
    display: "flex",
    flexDirection: "column",
    gap: 12,
    alignItems: "center",
  },
  btnPrimary: {
    width: 260,
    padding: "14px",
    fontSize: 16,
    fontWeight: "bold",
    letterSpacing: 3,
    color: "#fff",
    background: "linear-gradient(135deg, #5500aa, #3a0077)",
    border: "1px solid #7700cc",
    borderRadius: 8,
    cursor: "pointer",
    fontFamily: "inherit",
    boxShadow: "0 0 20px rgba(80,0,180,0.4)",
  },
  btnExtract: {
    width: 260,
    padding: "13px",
    fontSize: 13,
    fontWeight: "bold",
    letterSpacing: 1,
    color: "#88ffcc",
    background: "rgba(10,50,30,0.85)",
    border: "1px solid rgba(40,180,90,0.6)",
    borderRadius: 8,
    cursor: "pointer",
    fontFamily: "inherit",
    boxShadow: "0 0 14px rgba(0,160,70,0.25)",
  },
  btnSettings: {
    width: 260,
    padding: "12px",
    fontSize: 14,
    fontWeight: "bold",
    letterSpacing: 2,
    color: "#c0a0e0",
    background: "rgba(40,20,70,0.7)",
    border: "1px solid rgba(120,60,160,0.5)",
    borderRadius: 8,
    cursor: "pointer",
    fontFamily: "inherit",
  },
  btnInventory: {
    width: 260,
    padding: "12px",
    fontSize: 14,
    fontWeight: "bold",
    letterSpacing: 2,
    color: "#e8cfa0",
    background: "rgba(60,40,15,0.7)",
    border: "1px solid rgba(180,130,60,0.5)",
    borderRadius: 8,
    cursor: "pointer",
    fontFamily: "inherit",
    boxShadow: "0 0 12px rgba(160,100,40,0.2)",
  },
  equippedRow: {
    display: "flex",
    gap: 8,
    marginBottom: 6,
  },
  equippedSlot: {
    flex: 1,
    textAlign: "center" as const,
    padding: "8px 6px",
    background: "rgba(20,10,30,0.6)",
    border: "1px solid rgba(80,50,120,0.4)",
    borderRadius: 6,
    fontFamily: "monospace",
  },
  equippedIcon: {
    fontSize: 22,
    lineHeight: 1,
    marginBottom: 2,
  },
  equippedLabel: {
    fontSize: 9,
    color: "rgba(160,140,190,0.6)",
    letterSpacing: 1,
    textTransform: "uppercase" as const,
  },
  equippedName: {
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: 0.5,
    lineHeight: 1.1,
    maxHeight: 24,
    overflow: "hidden" as const,
  },
  invList: {
    display: "flex",
    flexDirection: "column" as const,
    gap: 6,
  },
  invItem: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "8px 10px",
    background: "rgba(15,8,25,0.8)",
    border: "1px solid",
    borderRadius: 6,
  },
  invItemLeft: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    flex: 1,
    minWidth: 0,
  },
  invIcon: {
    fontSize: 22,
    flex: "0 0 28px",
    textAlign: "center" as const,
  },
  invTextCol: {
    flex: 1,
    minWidth: 0,
  },
  invName: {
    fontSize: 12,
    fontWeight: 700,
    letterSpacing: 0.5,
    whiteSpace: "nowrap" as const,
    overflow: "hidden" as const,
    textOverflow: "ellipsis" as const,
  },
  invSlot: {
    fontSize: 9,
    color: "rgba(160,140,190,0.5)",
    letterSpacing: 1,
    textTransform: "uppercase" as const,
    fontWeight: 400,
  },
  invDesc: {
    fontSize: 10,
    color: "rgba(200,180,220,0.7)",
    lineHeight: 1.3,
    marginTop: 2,
  },
  invItemBtns: {
    display: "flex",
    flexDirection: "column" as const,
    gap: 3,
  },
  invEquipBtn: {
    padding: "4px 10px",
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: 1,
    color: "#e8d0ff",
    background: "linear-gradient(135deg, #5500aa, #3a0077)",
    border: "1px solid #7700cc",
    borderRadius: 4,
    cursor: "pointer",
    fontFamily: "inherit",
    minWidth: 60,
  },
  invSellBtn: {
    padding: "4px 10px",
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: 1,
    color: "#d0a0ff",
    background: "rgba(30,15,45,0.9)",
    border: "1px solid rgba(120,60,160,0.5)",
    borderRadius: 4,
    cursor: "pointer",
    fontFamily: "inherit",
    minWidth: 60,
  },
  emptyInv: {
    padding: "20px 10px",
    fontSize: 11,
    color: "rgba(160,140,190,0.5)",
    textAlign: "center" as const,
    fontStyle: "italic" as const,
    lineHeight: 1.5,
  },
  btnSecondary: {
    width: 260,
    padding: "12px",
    fontSize: 15,
    fontWeight: "bold",
    letterSpacing: 2,
    color: "#bbb",
    background: "rgba(30,15,45,0.8)",
    border: "1px solid rgba(80,50,120,0.4)",
    borderRadius: 8,
    cursor: "pointer",
    fontFamily: "inherit",
  },
  btnBack: {
    marginTop: 20,
    width: 260,
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
  },
  controls: {
    marginTop: 24,
    fontSize: 12,
  },
  settingsWrapper: {
    textAlign: "left" as const,
    maxHeight: "60vh",
    overflowY: "auto" as const,
    paddingRight: 8,
  },
  sectionTitle: {
    color: "rgba(200,160,230,0.6)",
    fontSize: 10,
    letterSpacing: 3,
    fontWeight: 900,
    marginTop: 18,
    marginBottom: 10,
    borderBottom: "1px solid rgba(80,50,120,0.3)",
    paddingBottom: 4,
  },
  row: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    marginBottom: 10,
  },
  rowLabel: {
    flex: "0 0 110px",
    color: "rgba(200,180,220,0.85)",
    fontSize: 12,
    letterSpacing: 0.5,
  },
  rowValue: {
    flex: "0 0 32px",
    color: "rgba(180,140,220,0.85)",
    fontSize: 11,
    textAlign: "right" as const,
    fontFamily: "monospace",
  },
  slider: {
    flex: 1,
    accentColor: "#8844cc",
    cursor: "pointer",
  },
  toggleBtn: {
    flex: "0 0 60px",
    padding: "6px 10px",
    fontSize: 11,
    fontWeight: 900,
    letterSpacing: 1.5,
    border: "1px solid",
    borderRadius: 5,
    cursor: "pointer",
    fontFamily: "inherit",
  },
  keybindGrid: {
    display: "grid",
    gridTemplateColumns: "auto 1fr",
    gap: "8px 14px",
    alignItems: "center",
    marginTop: 4,
  },
  kbKey: {
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.12)",
    borderRadius: 4,
    padding: "3px 8px",
    fontSize: 11,
    color: "#ddd",
    fontWeight: "bold" as const,
    whiteSpace: "nowrap" as const,
    textAlign: "center" as const,
  },
  kbLabel: {
    color: "rgba(200,180,220,0.8)",
    fontSize: 12,
  },
};
