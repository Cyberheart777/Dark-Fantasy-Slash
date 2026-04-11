/**
 * SoulForge.tsx
 * Permanent upgrade shop between runs.
 * Each upgrade uses flat StatModifiers — stacks correctly with per-run bonuses.
 */

import { useState } from "react";
import { useMetaStore, TRIAL_BUFFS, getEarnedTrialBuffs, type StashItem } from "../store/metaStore";
import { META_UPGRADES, buildMetaModifiers, buildTrialModifiers, nextRankCost, nextRankLine } from "../data/MetaUpgradeData";
import { DIFFICULTIES, DIFFICULTY_DATA } from "../data/DifficultyData";
import { ENHANCE_MULT, ENHANCE_COST, ENHANCE_COLORS, formatBonuses, type GearDef } from "../data/GearData";
import { useGameStore } from "../store/gameStore";
import { audioManager } from "../audio/AudioManager";
import { CHARACTER_DATA, type CharacterClass } from "../data/CharacterData";
import { createDefaultStats, type PlayerStats } from "../data/UpgradeData";
import { resolveStats, flatModifiers, type StatModifier } from "../data/StatModifier";
import { StatsPanel } from "./PauseMenu";

const clickSfx = () => audioManager.play("menu_click");

/** Scale bonuses by enhancement level for display purposes. */
function scaleBonuses(bonuses: Record<string, number>, enhanceLevel: number): Record<string, number> {
  const mult = ENHANCE_MULT[enhanceLevel] ?? 1;
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(bonuses)) {
    if (typeof v === "number") out[k] = v * mult;
  }
  return out;
}

/**
 * Compute the resolved PlayerStats a player would START a run with, based on:
 *   - the picked class's base stats
 *   - all purchased meta upgrades (Soul Forge)
 *   - earned Trial of Champions buffs
 *   - the equipped pre-run loadout (gear stash)
 *
 * Mirrors `makeProgWithMeta` in GameScene.tsx so the UI preview matches what
 * the run will actually start with (sans race bonuses since the race isn't
 * picked at the forge).
 */
function computePreviewStats(
  cls: CharacterClass,
  purchased: Record<string, number>,
  trialWins: Record<string, string>,
  equippedLoadout: Record<string, StashItem | null>,
): PlayerStats {
  const def = CHARACTER_DATA[cls];
  const classBase: PlayerStats = {
    ...createDefaultStats(),
    maxHealth: def.hp,
    currentHealth: def.hp,
    damage: def.damage,
    attackSpeed: def.attackSpeed,
    moveSpeed: def.moveSpeed,
    armor: def.armor,
    dashCooldown: def.dashCooldown,
    critChance: def.critChance,
    attackRange: def.attackRange,
  };
  const metaMods = buildMetaModifiers(purchased);
  const trialMods = buildTrialModifiers(trialWins);
  // Equipped gear bonuses are added as flat modifiers with enhancement scaling.
  const gearMods: StatModifier[] = [];
  for (const item of Object.values(equippedLoadout)) {
    if (!item || !item.bonuses) continue;
    const enh = item.enhanceLevel ?? 0;
    const mult = ENHANCE_MULT[enh] ?? 1;
    const scaled: Partial<Record<keyof PlayerStats, number>> = {};
    for (const [key, val] of Object.entries(item.bonuses)) {
      if (typeof val === "number") (scaled as Record<string, number>)[key] = val * mult;
    }
    gearMods.push(...flatModifiers(scaled, `gear:${item.id}`));
  }
  return resolveStats(classBase, [...metaMods, ...trialMods, ...gearMods]);
}

/**
 * Soul Forge background artwork. Expected file path:
 *   public/images/Soul-Forge-bg.png
 * Filename uses the capitalization you specified in chat. GitHub paths
 * are case-sensitive, so `soul-forge-bg.png` would NOT resolve to
 * `Soul-Forge-bg.png`. If the actual uploaded filename ends up different,
 * just update this constant — the background shorthand in styles.overlay
 * falls through to the dark gradient while any file is missing.
 */
const SOUL_FORGE_BG_URL = `${import.meta.env.BASE_URL}images/Soul-Forge-bg.png`;

export function SoulForge() {
  const { shards, totalShardsEarned, purchased, purchaseRank, trialWins, gearStash, sellGear, equippedLoadout, equipToLoadout, unequipFromLoadout, enhanceGear } = useMetaStore();
  const setPhase = useGameStore((s) => s.setPhase);
  const selectedClass = useGameStore((s) => s.selectedClass);
  const [flash, setFlash] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"forge" | "armory">("forge");
  const [previewClass, setPreviewClass] = useState<CharacterClass>(selectedClass);

  const previewStats = computePreviewStats(previewClass, purchased, trialWins, equippedLoadout);

  const handleBuy = (id: string, cost: number, maxRanks: number) => {
    clickSfx();
    const ok = purchaseRank(id, cost, maxRanks);
    setFlash(ok ? id : "__denied__");
    setTimeout(() => setFlash(null), 600);
  };

  return (
    <div style={styles.overlay}>
      <div style={styles.panel}>

        {/* Header */}
        <button style={styles.backBtn} onClick={() => { clickSfx(); setPhase("menu"); }}>← BACK</button>

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

        {/* Tab selector */}
        <div style={styles.tabRow}>
          <button
            style={{
              ...styles.tabBtn,
              ...(activeTab === "forge" ? styles.tabBtnActive : {}),
            }}
            onClick={() => { clickSfx(); setActiveTab("forge"); }}
          >
            ⚒ FORGE
          </button>
          <button
            style={{
              ...styles.tabBtn,
              ...(activeTab === "armory" ? styles.tabBtnActive : {}),
            }}
            onClick={() => { clickSfx(); setActiveTab("armory"); }}
          >
            ⚔ ARMORY
            {gearStash.length > 0 && (
              <span style={styles.tabBadge}>{gearStash.length}</span>
            )}
          </button>
        </div>

        {activeTab === "forge" && (<>
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
        </>)}

        {activeTab === "armory" && (
          <div style={styles.armoryContainer}>
            <div style={styles.armoryIntro}>
              Equip gear from your stash before your next run. Each slot holds
              one item. Click an equipped slot to unequip.
            </div>

            {/* ── Stats preview (with class picker) ── */}
            <div style={styles.armorySection}>
              <div style={styles.armorySectionTitle}>STATS PREVIEW</div>
              <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
                {(["warrior", "mage", "rogue"] as const).map((c) => {
                  const def = CHARACTER_DATA[c];
                  const active = previewClass === c;
                  return (
                    <button
                      key={c}
                      onClick={() => { clickSfx(); setPreviewClass(c); }}
                      style={{
                        flex: 1,
                        padding: "6px 8px",
                        background: active ? `${def.color}22` : "#0a0614",
                        border: `1px solid ${active ? def.accentColor : "#2a1f3d"}`,
                        borderRadius: 6,
                        color: active ? def.accentColor : "#504060",
                        fontFamily: "monospace",
                        fontSize: 11,
                        fontWeight: 900,
                        letterSpacing: 2,
                        cursor: "pointer",
                      }}
                    >
                      {c === "warrior" ? "⚔" : c === "mage" ? "✦" : "◆"} {def.name}
                    </button>
                  );
                })}
              </div>
              <StatsPanel stats={previewStats} />
            </div>

            {/* ── Equipment Loadout ── */}
            <div style={styles.armorySection}>
              <div style={styles.armorySectionTitle}>EQUIPPED LOADOUT</div>
              <div style={styles.loadoutGrid}>
                {(["weapon", "armor", "trinket"] as const).map(slot => {
                  const equipped = equippedLoadout[slot];
                  const slotLabel = slot.charAt(0).toUpperCase() + slot.slice(1);
                  const enh = equipped?.enhanceLevel ?? 0;
                  const enhColor = ENHANCE_COLORS[enh] ?? ENHANCE_COLORS[0];
                  const rarityColor = equipped
                    ? equipped.rarity === "epic" ? "#aa44ff" : equipped.rarity === "rare" ? "#4488dd" : enhColor.border
                    : "#2a1f3d";
                  return (
                    <button
                      key={slot}
                      onClick={() => { if (equipped) { clickSfx(); unequipFromLoadout(slot); } }}
                      style={{
                        ...styles.loadoutSlot,
                        border: `2px solid ${rarityColor}`,
                        cursor: equipped ? "pointer" : "default",
                        boxShadow: equipped ? (enh > 0 ? enhColor.glow : `0 0 12px ${rarityColor}44`) : "none",
                      }}
                      title={equipped ? "Click to unequip" : ""}
                    >
                      <div style={styles.slotLabel}>{slotLabel.toUpperCase()}</div>
                      {equipped ? (
                        <>
                          <div style={styles.slotIcon}>{equipped.icon}</div>
                          <div style={{ ...styles.slotName, color: rarityColor }}>
                            {equipped.name}{enh > 0 ? ` +${enh}` : ""}
                          </div>
                          {equipped.bonuses && (
                            <div style={styles.slotStats}>
                              {formatBonuses(scaleBonuses(equipped.bonuses as Record<string, number>, enh))}
                            </div>
                          )}
                          <div style={styles.slotUnequipHint}>click to unequip</div>
                        </>
                      ) : (
                        <div style={styles.slotEmpty}>— EMPTY —</div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* ── Stash ── */}
            <div style={styles.armorySection}>
              <div style={styles.armorySectionTitle}>
                STASH {gearStash.length > 0 && <span style={{ color: "#a060c0" }}>({gearStash.length})</span>}
              </div>
              {gearStash.length > 0 ? (
                <div style={styles.stashGrid}>
                  {gearStash.map((item, i) => {
                    const enh = item.enhanceLevel ?? 0;
                    const enhColor = ENHANCE_COLORS[enh] ?? ENHANCE_COLORS[0];
                    const rarityColor = item.rarity === "epic" ? "#aa44ff" : item.rarity === "rare" ? "#4488dd" : enhColor.border;
                    const sellVal = item.rarity === "epic" ? 35 : item.rarity === "rare" ? 15 : 5;
                    const canEnhance = item.rarity === "common" && enh < 3;
                    const enhanceCost = canEnhance ? ENHANCE_COST[enh + 1] : 0;
                    const canAffordEnhance = shards >= enhanceCost;
                    return (
                      <div
                        key={`${item.id}-${i}`}
                        style={{
                          ...styles.stashCard,
                          border: `2px solid ${rarityColor}`,
                          boxShadow: enh > 0 ? enhColor.glow : "none",
                        }}
                      >
                        <div style={styles.stashCardHeader}>
                          <span style={styles.stashIcon}>{item.icon}</span>
                          <div style={styles.stashCardTitles}>
                            <div style={{ ...styles.stashName, color: rarityColor }}>
                              {item.name}{enh > 0 ? ` +${enh}` : ""}
                            </div>
                            <div style={styles.stashMeta}>
                              <span style={{ color: rarityColor }}>{item.rarity.toUpperCase()}</span>
                              <span style={{ color: "#504060" }}> · </span>
                              <span style={{ color: "#806090" }}>{item.slot.toUpperCase()}</span>
                            </div>
                          </div>
                        </div>
                        {item.bonuses && (
                          <div style={styles.stashStats}>
                            {formatBonuses(scaleBonuses(item.bonuses as Record<string, number>, enh))}
                          </div>
                        )}
                        <div style={styles.stashActions}>
                          <button
                            onClick={() => { clickSfx(); equipToLoadout(i); }}
                            style={styles.equipBtn}
                          >EQUIP</button>
                          <button
                            onClick={() => { clickSfx(); sellGear(i); }}
                            style={styles.sellBtn}
                          >SELL ◈{sellVal}</button>
                          {canEnhance && (
                            <button
                              onClick={() => { clickSfx(); enhanceGear(i); }}
                              style={{
                                ...styles.enhanceBtn,
                                background: canAffordEnhance ? "#0a2010" : "#1a1040",
                                borderColor: canAffordEnhance ? "#40aa40" : "#2a3030",
                                color: canAffordEnhance ? "#60cc60" : "#3a4a3a",
                                cursor: canAffordEnhance ? "pointer" : "default",
                                opacity: canAffordEnhance ? 1 : 0.5,
                              }}
                            >+{enh + 1} ◈{enhanceCost}</button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div style={styles.stashEmpty}>
                  No gear in stash. Play a run to find drops!
                </div>
              )}
            </div>
          </div>
        )}

        {/* Footer */}
        <div style={styles.footer}>
          Stacking math: meta bonuses (flat) → run upgrades (additive %) → item multipliers
        </div>

        <button
          style={styles.playBtn}
          onClick={() => { clickSfx(); setPhase("charselect"); }}
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
    // Layered background: dark tint + key art + fallback gradient.
    // Same sizing pattern as MainMenu/CharacterSelect for easy iteration.
    //
    //   - `auto 108%` shrinks image vs the previous `cover` over-scale
    //     so the "SOUL FORGE" lettering near the top of the source
    //     isn't clipped at the viewport's top edge
    //   - `center 25%` biases image down so the title sits BELOW the
    //     very top of the viewport with breathing room, and the warrior
    //     + forge composition remains visible behind the upgrade cards
    //
    // Tuning knobs (single-number iteration):
    //   bigger `auto NNN%` → image larger, more crop
    //   smaller `center XX%` → biases image content DOWN
    //   larger `center XX%` → biases image content UP
    //
    // Tint is heavier than the main menu (0.6 → 0.85) because the forge
    // has dense upgrade cards that need to stay legible.
    background: `
      linear-gradient(rgba(6,2,14,0.6), rgba(4,0,10,0.85)),
      url("${SOUL_FORGE_BG_URL}") center 25% / auto 108% no-repeat,
      linear-gradient(160deg, #04000a 0%, #0a0520 100%)
    `,
    backgroundAttachment: "fixed",
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

  // ── Tabs ─────────────────────────────────────────────────────────────────
  tabRow: {
    display: "flex",
    gap: 8,
    borderBottom: "2px solid #2a1f3d",
    paddingBottom: 0,
  },
  tabBtn: {
    flex: 1,
    padding: "14px 18px",
    background: "transparent",
    border: "2px solid transparent",
    borderBottom: "none",
    borderRadius: "8px 8px 0 0",
    color: "#6a5080",
    fontFamily: "monospace",
    fontSize: 16,
    fontWeight: 900,
    letterSpacing: 3,
    cursor: "pointer",
    transition: "all 0.15s",
    position: "relative" as const,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  tabBtnActive: {
    background: "#0e0919",
    borderColor: "#5020a0",
    color: "#c080f0",
    boxShadow: "0 -2px 12px rgba(140,60,220,0.3)",
  },
  tabBadge: {
    display: "inline-block",
    background: "#a060c0",
    color: "#0a0610",
    borderRadius: 12,
    padding: "2px 8px",
    fontSize: 12,
    fontWeight: 900,
    minWidth: 20,
    textAlign: "center" as const,
  },

  // ── Armory layout ────────────────────────────────────────────────────────
  armoryContainer: {
    display: "flex",
    flexDirection: "column" as const,
    gap: 20,
  },
  armoryIntro: {
    fontSize: 13,
    color: "#806090",
    fontFamily: "monospace",
    lineHeight: 1.5,
    padding: "12px 14px",
    background: "rgba(10,6,16,0.5)",
    borderLeft: "3px solid #5020a0",
    borderRadius: 4,
  },
  armorySection: {
    background: "#080612",
    border: "1px solid rgba(140,60,220,0.25)",
    borderRadius: 10,
    padding: "16px 18px",
    display: "flex",
    flexDirection: "column" as const,
    gap: 14,
  },
  armorySectionTitle: {
    fontSize: 14,
    fontWeight: 900,
    letterSpacing: 4,
    color: "#a060c0",
    fontFamily: "monospace",
  },

  // ── Loadout (equipment slots) ────────────────────────────────────────────
  loadoutGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: 12,
  },
  loadoutSlot: {
    display: "flex",
    flexDirection: "column" as const,
    alignItems: "center",
    gap: 8,
    padding: "16px 10px",
    background: "#0a0610",
    borderRadius: 10,
    fontFamily: "monospace",
    minHeight: 160,
    transition: "all 0.15s",
  },
  slotLabel: {
    fontSize: 11,
    color: "#604070",
    letterSpacing: 3,
    fontWeight: 900,
  },
  slotIcon: {
    fontSize: 40,
    margin: "4px 0",
  },
  slotName: {
    fontSize: 14,
    fontWeight: 900,
    textAlign: "center" as const,
    letterSpacing: 1,
  },
  slotStats: {
    fontSize: 12,
    color: "#a080c0",
    textAlign: "center" as const,
    lineHeight: 1.5,
    padding: "0 4px",
  },
  slotUnequipHint: {
    fontSize: 10,
    color: "#4a3060",
    letterSpacing: 1,
    marginTop: "auto",
  },
  slotEmpty: {
    fontSize: 13,
    color: "#3a2050",
    letterSpacing: 2,
    marginTop: 30,
  },

  // ── Stash grid ───────────────────────────────────────────────────────────
  stashGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
    gap: 12,
  },
  stashCard: {
    display: "flex",
    flexDirection: "column" as const,
    gap: 10,
    padding: "14px",
    background: "#0a0610",
    borderRadius: 10,
    fontFamily: "monospace",
    transition: "all 0.15s",
  },
  stashCardHeader: {
    display: "flex",
    alignItems: "center",
    gap: 12,
  },
  stashIcon: {
    fontSize: 32,
    flexShrink: 0,
  },
  stashCardTitles: {
    flex: 1,
    minWidth: 0,
  },
  stashName: {
    fontSize: 15,
    fontWeight: 900,
    letterSpacing: 1,
    overflow: "hidden" as const,
    textOverflow: "ellipsis" as const,
    whiteSpace: "nowrap" as const,
  },
  stashMeta: {
    fontSize: 10,
    letterSpacing: 2,
    marginTop: 2,
  },
  stashStats: {
    fontSize: 12,
    color: "#a080c0",
    lineHeight: 1.5,
    padding: "8px 10px",
    background: "rgba(30,10,50,0.4)",
    borderRadius: 6,
    borderLeft: "2px solid #5020a0",
  },
  stashActions: {
    display: "flex",
    gap: 6,
    flexWrap: "wrap" as const,
  },
  equipBtn: {
    flex: 1,
    minWidth: 60,
    fontSize: 12,
    fontWeight: 900,
    padding: "10px 12px",
    background: "#1a1040",
    border: "1.5px solid #5040aa",
    borderRadius: 6,
    color: "#a0a0ff",
    cursor: "pointer",
    fontFamily: "monospace",
    letterSpacing: 2,
  },
  sellBtn: {
    flex: 1,
    minWidth: 60,
    fontSize: 12,
    fontWeight: 900,
    padding: "10px 12px",
    background: "#1a1040",
    border: "1.5px solid #6a2070",
    borderRadius: 6,
    color: "#c070e0",
    cursor: "pointer",
    fontFamily: "monospace",
    letterSpacing: 2,
  },
  enhanceBtn: {
    flex: 1,
    minWidth: 60,
    fontSize: 12,
    fontWeight: 900,
    padding: "10px 12px",
    border: "1.5px solid",
    borderRadius: 6,
    fontFamily: "monospace",
    letterSpacing: 1,
  },
  stashEmpty: {
    fontSize: 13,
    color: "#4a3060",
    fontFamily: "monospace",
    textAlign: "center" as const,
    padding: "40px 20px",
    fontStyle: "italic" as const,
  },
};
