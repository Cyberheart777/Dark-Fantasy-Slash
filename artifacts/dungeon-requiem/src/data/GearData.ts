/**
 * GearData.ts
 * Equippable gear that drops from elite/boss kills.
 * 3 slots: weapon, armor, trinket.
 * Gear persists for the current run only (transferred to stash on death/extract).
 * Each piece gives a stat bonus and a visual icon.
 *
 * Enhancement system (commons +3, rares +5, epics +7, +20% per rank):
 *   level: 0   1    2    3    4    5    6    7
 *   mult:  1.0 1.2  1.4  1.6  1.8  2.0  2.2  2.4
 *
 * Percentage-based bonuses (crit chance, crit damage, dodge, lifesteal,
 * atk speed, move speed, poison damage) are capped at 1.5x base — see
 * getEnhancedBonuses below. Flat stats (dmg, armor, HP, HP/s, heal-on-kill)
 * scale to the full rarity multiplier.
 *
 * Class-locked gear: items with `class` set to "warrior" | "mage" | "rogue"
 * only drop for that class. Items without a class are "any".
 */

import type { CharacterClass } from "./CharacterData";

export type GearSlot = "weapon" | "armor" | "trinket";
export type GearRarity = "common" | "rare" | "epic";

/** "any" (or omitted) allows the item to drop for any class. */
export type GearClassLock = CharacterClass | "any";

export interface GearDef {
  id: string;
  name: string;
  slot: GearSlot;
  rarity: GearRarity;
  icon: string;
  description: string;
  /** Flat stat bonuses applied when equipped. Percentage stats (crit/dodge/lifesteal/etc.) use decimals (0.03 = 3%). */
  bonuses: Partial<Record<string, number>>;
  /** Enhancement level: 0..maxForRarity (3/5/7). */
  enhanceLevel?: number;
  /** Class restriction at drop roll. Omit for "any". */
  class?: GearClassLock;
  /** Proc flag — if set, equipping this gear enables a proc handler in GameScene. */
  proc?: GearProc;
}

/**
 * Proc identifiers for gear items that trigger behaviour beyond flat stat
 * bonuses. Each proc is handled inline in GameScene.tsx — keep this list in
 * sync with the consumers there.
 */
export type GearProc =
  | "plague_dagger_puddle"       // +2 dmg weapon, kill spawns 5s poison puddle
  | "arc_warblade_slash"         // +4 dmg weapon, every 3s auto-arc at 25% dmg
  | "bloodfury_momentum"         // +5 dmg weapon, Blood Momentum stacks 2x faster
  | "serpents_fang_poison"       // +3 dmg weapon, 15% chance/hit for +1 poison stack; +20% poison dmg; stack cap 4
  | "voidstaff_blink"            // +4 dmg +15% atk spd weapon, blink CD -20%
  | "orbital_staff_orbs"         // +3 dmg weapon, player gains orbiting damage orbs
  | "ricochet_orb_bounce"        // +3 dmg weapon, mage orbs ricochet off walls up to 3 times
  | "phantom_wrap_intangible"    // armor, when hit <30% HP become intangible 1.5s (10s CD)
  | "glacial_robe_slow"          // armor, damage taken slows nearby & amplifies dmg (20s CD)
  | "boots_of_speed_postdash"    // trinket, +25% move speed 3s after dash (10s CD)
  | "berserker_sigil_lowhp"      // trinket, +5% damage below 50% HP
  | "crown_of_thorns_bundle"     // trinket, bundled dmg/crit/lifesteal (handled by bonuses)
  | "venom_shroud_poison";       // trinket, -25 base dmg, +100% poison dmg

/** Subset of bonus keys that are percentage-based and capped at 1.5x on enhancement. */
export const PERCENTAGE_BONUS_KEYS: ReadonlySet<string> = new Set([
  "critChance",
  "critDamageBonus",
  "dodgeChance",
  "lifesteal",
  "attackSpeed",
  "moveSpeed",
  "poisonDamageBonus",
  "xpMultiplier",
  "lowHpDamageBonus",
]);

/** Drop weight per rarity. */
export const GEAR_RARITY_WEIGHT: Record<GearRarity, number> = {
  common: 10,
  rare: 4,
  epic: 1,
};

/** Colors for gear rarity display. */
export const GEAR_RARITY_COLOR: Record<GearRarity, { border: string; glow: string; text: string }> = {
  common: { border: "#6a6a7a", glow: "none", text: "#aaaabb" },
  rare:   { border: "#4488dd", glow: "0 0 10px rgba(60,120,255,0.3)", text: "#70b0ff" },
  epic:   { border: "#aa44ff", glow: "0 0 14px rgba(140,40,255,0.35)", text: "#cc88ff" },
};

/** Enhancement level visual colors (border glow). */
export const ENHANCE_COLORS: Record<number, { border: string; glow: string }> = {
  0: { border: "#6a6a7a", glow: "none" },
  1: { border: "#44cc44", glow: "0 0 8px rgba(60,200,60,0.3)" },
  2: { border: "#4488dd", glow: "0 0 10px rgba(60,120,255,0.3)" },
  3: { border: "#aa44ff", glow: "0 0 14px rgba(140,40,255,0.35)" },
  4: { border: "#cc44ff", glow: "0 0 16px rgba(160,40,255,0.4)" },
  5: { border: "#ff44aa", glow: "0 0 18px rgba(255,40,160,0.4)" },
  6: { border: "#ff8844", glow: "0 0 20px rgba(255,120,40,0.45)" },
  7: { border: "#ffcc00", glow: "0 0 22px rgba(255,200,0,0.5)" },
};

/**
 * Enhancement multiplier per level: +20% base per rank.
 * Common max +3 (1.6x), Rare max +5 (2.0x), Epic max +7 (2.4x).
 */
export const ENHANCE_MULT = [1.0, 1.2, 1.4, 1.6, 1.8, 2.0, 2.2, 2.4];

/** Max enhancement level by rarity. */
export const ENHANCE_MAX: Record<GearRarity, number> = {
  common: 3,
  rare: 5,
  epic: 7,
};

/**
 * Enhancement shard cost per level (cost to go FROM level N-1 TO level N).
 * Doubling schedule: 50, 100, 200, 400, 800, 1600, 3200.
 * Total to max: common (+3) = 350 · rare (+5) = 1,550 · epic (+7) = 6,350.
 */
export const ENHANCE_COST = [0, 50, 100, 200, 400, 800, 1600, 3200];

/**
 * Get the effective bonuses for a gear piece, accounting for enhancement.
 * Returns a new object — does not mutate the original.
 *
 * Percentage-based bonuses (see PERCENTAGE_BONUS_KEYS) are capped at 1.5x base
 * to prevent dodge/poison/etc. from becoming game-breaking at high enhancement.
 * Flat stats scale to the full rarity multiplier.
 */
export function getEnhancedBonuses(gear: GearDef): Record<string, number> {
  const level = gear.enhanceLevel ?? 0;
  const mult = ENHANCE_MULT[level] ?? 1.0;
  const cappedMult = Math.min(mult, PERCENTAGE_ENHANCE_CAP);
  const out: Record<string, number> = {};
  for (const [key, val] of Object.entries(gear.bonuses)) {
    if (typeof val !== "number") continue;
    const m = PERCENTAGE_BONUS_KEYS.has(key) ? cappedMult : mult;
    out[key] = val * m;
  }
  return out;
}

/** Enhancement cap applied to percentage-based bonuses regardless of rarity. */
export const PERCENTAGE_ENHANCE_CAP = 1.5;

/** Display name with enhancement suffix. */
export function getEnhancedName(gear: GearDef): string {
  const level = gear.enhanceLevel ?? 0;
  return level > 0 ? `${gear.name} +${level}` : gear.name;
}

/** Format gear bonuses as a human-readable stat string. */
export function formatBonuses(bonuses: Record<string, number>): string {
  const parts: string[] = [];
  for (const [key, val] of Object.entries(bonuses)) {
    if (val === 0) continue;
    switch (key) {
      case "damage": parts.push(`${val >= 0 ? "+" : ""}${val.toFixed(1)} dmg`); break;
      case "armor": parts.push(`+${val.toFixed(1)} armor`); break;
      case "maxHealth": parts.push(`${val >= 0 ? "+" : ""}${val.toFixed(0)} HP`); break;
      case "critChance": parts.push(`+${(val * 100).toFixed(1)}% crit`); break;
      case "critDamageBonus": parts.push(`+${(val * 100).toFixed(1)}% crit dmg`); break;
      case "attackSpeed": parts.push(`+${(val * 100).toFixed(0)}% atk spd`); break;
      case "moveSpeed": parts.push(`+${val.toFixed(2)} move spd`); break;
      case "lifesteal": parts.push(`+${(val * 100).toFixed(1)}% lifesteal`); break;
      case "dodgeChance": parts.push(`+${(val * 100).toFixed(1)}% dodge`); break;
      case "xpMultiplier": parts.push(`+${(val * 100).toFixed(0)}% XP`); break;
      case "healthRegen": parts.push(`+${val.toFixed(1)} HP/s`); break;
      case "onKillHeal": parts.push(`+${val.toFixed(0)} heal on kill`); break;
      case "poisonDamageBonus": parts.push(`+${(val * 100).toFixed(0)}% poison dmg`); break;
      case "lowHpDamageBonus": parts.push(`+${(val * 100).toFixed(0)}% dmg <50% HP`); break;
      default: parts.push(`+${val} ${key}`); break;
    }
  }
  return parts.join(", ");
}

// ─── Gear Pool ───────────────────────────────────────────────────────────────
// Full table per the Gear System Overhaul spec. All bonus percentages are
// stored as decimals (0.10 = 10%). Class-locked items are filtered at drop
// roll — see `tryRollGear` / `rollGearDrop` below.

export const GEAR_POOL: GearDef[] = [
  // ═══ WEAPONS ═══
  // Common
  { id: "rusty_blade",      name: "Rusty Blade",       slot: "weapon", rarity: "common", icon: "🗡️", description: "+1 dmg",                                                                            bonuses: { damage: 1 } },
  { id: "bone_dagger",      name: "Bone Dagger",        slot: "weapon", rarity: "common", icon: "🦴", description: "+1 dmg, +1% crit chance",                                                          bonuses: { damage: 1, critChance: 0.01 } },
  { id: "sharpened_edge",   name: "Sharpened Edge",     slot: "weapon", rarity: "common", icon: "⚔️", description: "+2 dmg",                                                                            bonuses: { damage: 2 } },
  { id: "iron_mace",        name: "Iron Mace",          slot: "weapon", rarity: "common", icon: "🔨", description: "+2 dmg, +3 HP",                                                                    bonuses: { damage: 2, maxHealth: 3 } },
  // Rare
  { id: "venomfang",        name: "Venomfang",          slot: "weapon", rarity: "rare",   icon: "🐍", description: "+3 dmg, +1% crit chance",                                                          bonuses: { damage: 3, critChance: 0.01 } },
  { id: "soulreaver",       name: "Soulreaver",         slot: "weapon", rarity: "rare",   icon: "👻", description: "+4 dmg, +2 heal on kill",                                                          bonuses: { damage: 4, onKillHeal: 2 } },
  { id: "plague_dagger",    name: "Plague Dagger",      slot: "weapon", rarity: "rare",   icon: "☠️",  description: "+2 dmg · kills spawn a 5s poison puddle",                                          bonuses: { damage: 2 }, class: "rogue", proc: "plague_dagger_puddle" },
  // Epic
  { id: "void_cleaver",     name: "Void Cleaver",       slot: "weapon", rarity: "epic",   icon: "🔮", description: "+6 dmg, +3% crit dmg",                                                              bonuses: { damage: 6, critDamageBonus: 0.03 } },
  { id: "stormbreaker",     name: "Stormbreaker",       slot: "weapon", rarity: "epic",   icon: "⚡", description: "+5 dmg, +10% atk speed",                                                            bonuses: { damage: 5, attackSpeed: 0.10 } },
  { id: "bloodfury_axe",    name: "Bloodfury Axe",      slot: "weapon", rarity: "epic",   icon: "🪓", description: "+5 dmg, +10% atk spd · Blood Momentum stacks generate 2x faster",                   bonuses: { damage: 5, attackSpeed: 0.10 }, class: "warrior", proc: "bloodfury_momentum" },
  { id: "arc_warblade",     name: "Arc Warblade",       slot: "weapon", rarity: "epic",   icon: "🌩️", description: "+4 dmg · arc slash at 25% dmg every 3s",                                            bonuses: { damage: 4 }, class: "warrior", proc: "arc_warblade_slash" },
  { id: "serpents_fang",    name: "Serpent's Fang",     slot: "weapon", rarity: "epic",   icon: "🐍", description: "+3 dmg, +20% poison dmg · 15%/hit extra poison stack (max 4)",                      bonuses: { damage: 3, poisonDamageBonus: 0.20 }, class: "rogue", proc: "serpents_fang_poison" },
  { id: "voidstaff",        name: "Voidstaff",          slot: "weapon", rarity: "epic",   icon: "🌌", description: "+4 dmg, +15% atk spd · blink CD −20%",                                              bonuses: { damage: 4, attackSpeed: 0.15 }, class: "mage", proc: "voidstaff_blink" },
  { id: "orbital_staff",    name: "Orbital Staff",      slot: "weapon", rarity: "epic",   icon: "🪐", description: "+3 dmg · orbs orbit you and damage nearby enemies",                                 bonuses: { damage: 3 }, class: "mage", proc: "orbital_staff_orbs" },
  { id: "ricochet_orb",     name: "Ricochet Orb",       slot: "weapon", rarity: "epic",   icon: "🔵", description: "+3 dmg · orbs bounce off walls up to 3 times (80/90/100/110% per bounce)",         bonuses: { damage: 3 }, class: "mage", proc: "ricochet_orb_bounce" },

  // ═══ ARMOR ═══
  // Common
  { id: "leather_vest",     name: "Leather Vest",       slot: "armor",  rarity: "common", icon: "🧥", description: "+10 HP, +1 armor",                                                                   bonuses: { maxHealth: 10, armor: 1 } },
  { id: "tattered_robes",   name: "Tattered Robes",     slot: "armor",  rarity: "common", icon: "👘", description: "+5 HP, +0.10 move speed",                                                            bonuses: { maxHealth: 5, moveSpeed: 0.10 } },
  { id: "chainmail",        name: "Chainmail",          slot: "armor",  rarity: "common", icon: "🛡️", description: "+2 armor, +5 HP",                                                                   bonuses: { armor: 2, maxHealth: 5 } },
  { id: "bone_shield",      name: "Bone Shield",        slot: "armor",  rarity: "common", icon: "💀", description: "+2 armor, +3% dodge",                                                               bonuses: { armor: 2, dodgeChance: 0.03 } },
  // Rare
  { id: "shadow_cloak",     name: "Shadow Cloak",       slot: "armor",  rarity: "rare",   icon: "🌫️", description: "+10% dodge, +10 HP",                                                                bonuses: { dodgeChance: 0.10, maxHealth: 10 } },
  { id: "iron_bastion",     name: "Iron Bastion",       slot: "armor",  rarity: "rare",   icon: "🏰", description: "+4 armor, +15 HP",                                                                  bonuses: { armor: 4, maxHealth: 15 } },
  { id: "cursed_plate",     name: "Cursed Plate",       slot: "armor",  rarity: "rare",   icon: "⛓️",  description: "+5 armor, −5 HP",                                                                   bonuses: { armor: 5, maxHealth: -5 } },
  // Epic
  { id: "abyssal_plate",    name: "Abyssal Plate",      slot: "armor",  rarity: "epic",   icon: "🦴", description: "+6 armor, +20 HP, +5% crit dmg",                                                    bonuses: { armor: 6, maxHealth: 20, critDamageBonus: 0.05 } },
  { id: "wraithbound_mail", name: "Wraithbound Mail",   slot: "armor",  rarity: "epic",   icon: "👁️", description: "+3 armor, +3% lifesteal",                                                           bonuses: { armor: 3, lifesteal: 0.03 } },
  { id: "phantom_wrap",     name: "Phantom Wrap",       slot: "armor",  rarity: "epic",   icon: "🕸️", description: "+2 armor, +0.15 move speed · when hit <30% HP: intangible 1.5s (10s CD)",          bonuses: { armor: 2, moveSpeed: 0.15 }, proc: "phantom_wrap_intangible" },
  { id: "glacial_robe",     name: "Glacial Robe",       slot: "armor",  rarity: "epic",   icon: "❄️", description: "+2 armor · damage taken slows nearby 70% 2s; slowed take +20% dmg (20s CD)",        bonuses: { armor: 2 }, class: "mage", proc: "glacial_robe_slow" },

  // ═══ TRINKETS ═══
  // Common
  { id: "cracked_gem",      name: "Cracked Gem",        slot: "trinket", rarity: "common", icon: "💎", description: "+3% XP",                                                                            bonuses: { xpMultiplier: 0.03 } },
  { id: "swift_boots",      name: "Swift Boots",        slot: "trinket", rarity: "common", icon: "👢", description: "+0.20 move speed",                                                                  bonuses: { moveSpeed: 0.20 } },
  { id: "lucky_coin",       name: "Lucky Coin",         slot: "trinket", rarity: "common", icon: "🪙", description: "+2% XP, +1% crit chance",                                                          bonuses: { xpMultiplier: 0.02, critChance: 0.01 } },
  { id: "healing_herb",     name: "Healing Herb",       slot: "trinket", rarity: "common", icon: "🌿", description: "+0.3 HP/s, +5 HP",                                                                 bonuses: { healthRegen: 0.3, maxHealth: 5 } },
  { id: "shadow_stone",     name: "Shadow Stone",       slot: "trinket", rarity: "common", icon: "🌑", description: "+1% dodge, +5 HP",                                                                  bonuses: { dodgeChance: 0.01, maxHealth: 5 } },
  // Rare
  { id: "blood_amulet",     name: "Blood Amulet",       slot: "trinket", rarity: "rare",   icon: "🩸", description: "+2% lifesteal, +0.5 HP/s",                                                         bonuses: { lifesteal: 0.02, healthRegen: 0.5 } },
  { id: "echo_ring",        name: "Echo Ring",          slot: "trinket", rarity: "rare",   icon: "💫", description: "+5% atk speed, +2% crit chance",                                                   bonuses: { attackSpeed: 0.05, critChance: 0.02 } },
  { id: "berserker_sigil",  name: "Berserker Sigil",    slot: "trinket", rarity: "rare",   icon: "🩹", description: "+5% dmg when below 50% HP",                                                        bonuses: { lowHpDamageBonus: 0.05 }, proc: "berserker_sigil_lowhp" },
  // Epic
  { id: "boots_of_speed",   name: "Boots of Speed",     slot: "trinket", rarity: "epic",   icon: "🥾", description: "+3% move spd, +2% atk spd · post-dash +25% move spd 3s (10s CD)",                  bonuses: { moveSpeed: 0.03, attackSpeed: 0.02 }, proc: "boots_of_speed_postdash" },
  { id: "crown_of_thorns",  name: "Crown of Thorns",    slot: "trinket", rarity: "epic",   icon: "👑", description: "+3 dmg, +3% crit chance, +1% lifesteal",                                            bonuses: { damage: 3, critChance: 0.03, lifesteal: 0.01 } },
  { id: "shard_of_infinity",name: "Shard of Infinity",  slot: "trinket", rarity: "epic",   icon: "✨", description: "+8% XP, +5% atk speed, +10 HP",                                                    bonuses: { xpMultiplier: 0.08, attackSpeed: 0.05, maxHealth: 10 } },
  { id: "venom_shroud",     name: "Venom Shroud",       slot: "trinket", rarity: "epic",   icon: "🧪", description: "−25 base dmg, +100% poison dmg",                                                   bonuses: { damage: -25, poisonDamageBonus: 1.00 }, class: "rogue", proc: "venom_shroud_poison" },
];

/** True if `gear` is eligible to drop for `playerClass`. */
export function gearMatchesClass(gear: GearDef, playerClass?: CharacterClass): boolean {
  // Omitted/"any" items drop for every class.
  if (!gear.class || gear.class === "any") return true;
  // If we don't know the player class, be permissive.
  if (!playerClass) return true;
  return gear.class === playerClass;
}

/**
 * Pick a random gear piece using rarity-weighted selection.
 * Can optionally filter by slot and by player class (enforces class-locks).
 */
export function rollGearDrop(rarity: GearRarity, forSlot?: GearSlot, playerClass?: CharacterClass): GearDef {
  const pool = GEAR_POOL.filter(g =>
    g.rarity === rarity
    && (!forSlot || g.slot === forSlot)
    && gearMatchesClass(g, playerClass)
  );
  if (pool.length > 0) return pool[Math.floor(Math.random() * pool.length)];
  // Fallback: relax class filter but keep rarity — better to drop SOMETHING
  // than to reward nothing when the class pool is empty at this rarity/slot.
  const relaxed = GEAR_POOL.filter(g => g.rarity === rarity && (!forSlot || g.slot === forSlot));
  if (relaxed.length > 0) return relaxed[Math.floor(Math.random() * relaxed.length)];
  return GEAR_POOL.find(g => g.rarity === rarity) ?? GEAR_POOL[0];
}

/**
 * Drop chances per enemy type, per rarity.
 *
 * Base epic rates raised 2-3× from previous values so the harder enemy tiers
 * actually feel like they reward epics. The previous values (e.g. elite epic
 * 0.05%) made epic drops effectively invisible even on Nightmare.
 */
export const GEAR_DROP_RATES: Record<string, Record<GearRarity, number>> = {
  scuttler:          { common: 0.008,  rare: 0,        epic: 0 },        // 0.8% common
  wraith:            { common: 0.008,  rare: 0.0008,   epic: 0 },        // 0.8% common, 0.08% rare
  brute:             { common: 0.025,  rare: 0.0015,   epic: 0 },        // 2.5% common, 0.15% rare
  elite:             { common: 0.06,   rare: 0.005,    epic: 0.0015 },   // 6% common, 0.5% rare, 0.15% epic
  boss:              { common: 0.15,   rare: 0.025,    epic: 0.008 },    // 15% common, 2.5% rare, 0.8% epic
  xp_goblin:         { common: 0.03,   rare: 0.003,    epic: 0 },        // 3% common, 0.3% rare
  warrior_champion:  { common: 1.0,    rare: 0.18,     epic: 0.06 },     // guaranteed common, 18% rare, 6% epic
  mage_champion:     { common: 1.0,    rare: 0.18,     epic: 0.06 },
  rogue_champion:    { common: 1.0,    rare: 0.18,     epic: 0.06 },
};

/**
 * Attempt a gear drop. Rolls epic first, then rare, then common.
 *
 * dropMult scales drop chances by difficulty (1.0 Normal, 1.15 Hard, 1.30 Nightmare).
 * Higher rarities get steeper non-linear scaling — epic = mult^3, rare = mult^2,
 * common = mult^1. This makes Nightmare epics ~2.2× more common than Normal epics
 * while keeping the common drop pace roughly comparable.
 *
 * Returns null if nothing drops.
 */
export function tryRollGear(enemyType: string, dropMult = 1.0, playerClass?: CharacterClass): GearDef | null {
  const rates = GEAR_DROP_RATES[enemyType];
  if (!rates) return null;
  const epicMult   = Math.pow(dropMult, 3);
  const rareMult   = Math.pow(dropMult, 2);
  const commonMult = dropMult;
  if (rates.epic   > 0 && Math.random() < rates.epic   * epicMult)   return rollGearDrop("epic",   undefined, playerClass);
  if (rates.rare   > 0 && Math.random() < rates.rare   * rareMult)   return rollGearDrop("rare",   undefined, playerClass);
  if (rates.common > 0 && Math.random() < rates.common * commonMult) return rollGearDrop("common", undefined, playerClass);
  return null;
}
