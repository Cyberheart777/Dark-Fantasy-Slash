/**
 * GearData.ts
 * Equippable gear that drops from elite/boss kills.
 * 3 slots: weapon, armor, trinket.
 * Gear persists for the current run only (transferred to stash on death/extract).
 * Each piece gives a stat bonus and a visual icon.
 *
 * Enhancement system: common gear can be enhanced +1/+2/+3 in the Soul Forge.
 * Each level multiplies all bonuses: +1 = 1.4×, +2 = 1.8×, +3 = 2.2×.
 */

export type GearSlot = "weapon" | "armor" | "trinket";
export type GearRarity = "common" | "rare" | "epic";

export interface GearDef {
  id: string;
  name: string;
  slot: GearSlot;
  rarity: GearRarity;
  icon: string;
  description: string;
  /** Flat stat bonuses applied when equipped. */
  bonuses: Partial<Record<string, number>>;
  /** Enhancement level: 0 (base), 1, 2, or 3. Only commons can be enhanced. */
  enhanceLevel?: number;
}

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

/** Enhancement shard cost per level (cost to go FROM level N-1 TO level N). */
export const ENHANCE_COST = [0, 30, 60, 100, 150, 220, 300, 400];

/**
 * Get the effective bonuses for a gear piece, accounting for enhancement.
 * Returns a new object — does not mutate the original.
 */
export function getEnhancedBonuses(gear: GearDef): Record<string, number> {
  const mult = ENHANCE_MULT[gear.enhanceLevel ?? 0] ?? 1.0;
  const out: Record<string, number> = {};
  for (const [key, val] of Object.entries(gear.bonuses)) {
    if (typeof val === "number") out[key] = val * mult;
  }
  return out;
}

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
      case "damage": parts.push(`+${val.toFixed(1)} dmg`); break;
      case "armor": parts.push(`+${val.toFixed(1)} armor`); break;
      case "maxHealth": parts.push(`+${val.toFixed(0)} HP`); break;
      case "critChance": parts.push(`+${(val * 100).toFixed(1)}% crit`); break;
      case "attackSpeed": parts.push(`+${val.toFixed(2)} atk spd`); break;
      case "moveSpeed": parts.push(`+${val.toFixed(1)} move spd`); break;
      case "lifesteal": parts.push(`+${(val * 100).toFixed(1)}% lifesteal`); break;
      case "dodgeChance": parts.push(`+${(val * 100).toFixed(1)}% dodge`); break;
      case "xpMultiplier": parts.push(`+${(val * 100).toFixed(0)}% XP`); break;
      case "healthRegen": parts.push(`+${val.toFixed(1)} HP/s`); break;
      case "onKillHeal": parts.push(`+${val.toFixed(0)} heal on kill`); break;
      default: parts.push(`+${val} ${key}`); break;
    }
  }
  return parts.join(", ");
}

// ─── Gear Pool ───────────────────────────────────────────────────────────────
// Stats rebalanced: commons are low baseline (+1 dmg, +1 armor, +10 HP, etc.)
// Rares ~3× common, epics ~5× common. Enhancement +3 (2.2×) makes a common
// rival a base rare.

// Enhancement now scales all rarities: Common +3 (1.6x), Rare +5 (2.0x), Epic +7 (2.4x).

export const GEAR_POOL: GearDef[] = [
  // ── Weapons (common) ──
  { id: "rusty_blade",       name: "Rusty Blade",        slot: "weapon", rarity: "common", icon: "🗡️", description: "+1 damage",                    bonuses: { damage: 1 } },
  { id: "sharpened_edge",    name: "Sharpened Edge",      slot: "weapon", rarity: "common", icon: "⚔️", description: "+2 damage",                    bonuses: { damage: 2 } },
  { id: "bone_dagger",       name: "Bone Dagger",         slot: "weapon", rarity: "common", icon: "🦴", description: "+1 damage, +1% crit",          bonuses: { damage: 1, critChance: 0.01 } },
  { id: "iron_mace",         name: "Iron Mace",           slot: "weapon", rarity: "common", icon: "🔨", description: "+2 damage",                    bonuses: { damage: 2 } },
  // ── Weapons (rare) ──
  { id: "venomfang",         name: "Venomfang",           slot: "weapon", rarity: "rare",   icon: "🐍", description: "+3 damage, +1% crit",          bonuses: { damage: 3, critChance: 0.01 } },
  { id: "soulreaver",        name: "Soulreaver",          slot: "weapon", rarity: "rare",   icon: "👻", description: "+4 damage, +2 on-kill heal",   bonuses: { damage: 4, onKillHeal: 2 } },
  // ── Weapons (epic) ──
  { id: "void_cleaver",      name: "Void Cleaver",        slot: "weapon", rarity: "epic",   icon: "🔮", description: "+6 damage, +3% crit",          bonuses: { damage: 6, critChance: 0.03 } },
  { id: "stormbreaker",      name: "Stormbreaker",        slot: "weapon", rarity: "epic",   icon: "⚡", description: "+5 damage, +0.06 attack speed", bonuses: { damage: 5, attackSpeed: 0.06 } },

  // ── Armor (common) ──
  { id: "leather_vest",      name: "Leather Vest",        slot: "armor",  rarity: "common", icon: "🧥", description: "+10 HP, +1 armor",             bonuses: { maxHealth: 10, armor: 1 } },
  { id: "chainmail",         name: "Chainmail",           slot: "armor",  rarity: "common", icon: "🛡️", description: "+2 armor",                     bonuses: { armor: 2 } },
  { id: "tattered_robes",    name: "Tattered Robes",      slot: "armor",  rarity: "common", icon: "👘", description: "+5 HP, +0.1 move speed",       bonuses: { maxHealth: 5, moveSpeed: 0.1 } },
  { id: "bone_shield",       name: "Bone Shield",         slot: "armor",  rarity: "common", icon: "💀", description: "+2 armor",                     bonuses: { armor: 2 } },
  // ── Armor (rare) ──
  { id: "shadow_cloak",      name: "Shadow Cloak",        slot: "armor",  rarity: "rare",   icon: "🌫️", description: "+2% dodge, +10 HP",            bonuses: { dodgeChance: 0.02, maxHealth: 10 } },
  { id: "iron_bastion",      name: "Iron Bastion",        slot: "armor",  rarity: "rare",   icon: "🏰", description: "+4 armor, +15 HP",             bonuses: { armor: 4, maxHealth: 15 } },
  // ── Armor (epic) ──
  { id: "abyssal_plate",     name: "Abyssal Plate",       slot: "armor",  rarity: "epic",   icon: "🦴", description: "+6 armor, +20 HP, +1% dodge",  bonuses: { armor: 6, maxHealth: 20, dodgeChance: 0.01 } },
  { id: "wraithbound_mail",  name: "Wraithbound Mail",    slot: "armor",  rarity: "epic",   icon: "👁️", description: "+3 armor, +3% lifesteal",      bonuses: { armor: 3, lifesteal: 0.03 } },

  // ── Trinkets (common) ──
  { id: "cracked_gem",       name: "Cracked Gem",         slot: "trinket", rarity: "common", icon: "💎", description: "+3% XP gain",                  bonuses: { xpMultiplier: 0.03 } },
  { id: "swift_boots",       name: "Swift Boots",         slot: "trinket", rarity: "common", icon: "👢", description: "+0.2 move speed",              bonuses: { moveSpeed: 0.2 } },
  { id: "lucky_coin",        name: "Lucky Coin",          slot: "trinket", rarity: "common", icon: "🪙", description: "+2% XP, +1% crit",            bonuses: { xpMultiplier: 0.02, critChance: 0.01 } },
  { id: "healing_herb",      name: "Healing Herb",        slot: "trinket", rarity: "common", icon: "🌿", description: "+0.3 HP/s, +5 HP",            bonuses: { healthRegen: 0.3, maxHealth: 5 } },
  // ── Trinkets (rare) ──
  { id: "blood_amulet",      name: "Blood Amulet",        slot: "trinket", rarity: "rare",   icon: "🩸", description: "+2% lifesteal, +0.5 HP/s",    bonuses: { lifesteal: 0.02, healthRegen: 0.5 } },
  { id: "echo_ring",         name: "Echo Ring",           slot: "trinket", rarity: "rare",   icon: "💫", description: "+0.04 atk speed, +2% crit",   bonuses: { attackSpeed: 0.04, critChance: 0.02 } },
  // ── Trinkets (epic) ──
  { id: "crown_of_thorns",   name: "Crown of Thorns",     slot: "trinket", rarity: "epic",   icon: "👑", description: "+3 dmg, +3% crit, +1% lifesteal", bonuses: { damage: 3, critChance: 0.03, lifesteal: 0.01 } },
  { id: "shard_of_infinity", name: "Shard of Infinity",   slot: "trinket", rarity: "epic",   icon: "✨", description: "+8% XP, +0.05 atk speed, +10 HP", bonuses: { xpMultiplier: 0.08, attackSpeed: 0.05, maxHealth: 10 } },
];

/**
 * Pick a random gear piece using rarity-weighted selection.
 * Can optionally filter by slot.
 */
export function rollGearDrop(rarity: GearRarity, forSlot?: GearSlot): GearDef {
  const pool = GEAR_POOL.filter(g => g.rarity === rarity && (!forSlot || g.slot === forSlot));
  if (pool.length === 0) return GEAR_POOL.find(g => g.rarity === rarity) ?? GEAR_POOL[0];
  return pool[Math.floor(Math.random() * pool.length)];
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
export function tryRollGear(enemyType: string, dropMult = 1.0): GearDef | null {
  const rates = GEAR_DROP_RATES[enemyType];
  if (!rates) return null;
  const epicMult   = Math.pow(dropMult, 3);
  const rareMult   = Math.pow(dropMult, 2);
  const commonMult = dropMult;
  if (rates.epic   > 0 && Math.random() < rates.epic   * epicMult)   return rollGearDrop("epic");
  if (rates.rare   > 0 && Math.random() < rates.rare   * rareMult)   return rollGearDrop("rare");
  if (rates.common > 0 && Math.random() < rates.common * commonMult) return rollGearDrop("common");
  return null;
}
