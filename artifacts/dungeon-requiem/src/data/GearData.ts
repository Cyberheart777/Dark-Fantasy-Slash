/**
 * GearData.ts
 * Equippable gear that drops from elite/boss kills.
 * 3 slots: weapon, armor, trinket.
 * Gear persists for the current run only.
 * Each piece gives a stat bonus and a visual icon.
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

// ─── Gear Pool ───────────────────────────────────────────────────────────────

export const GEAR_POOL: GearDef[] = [
  // ── Weapons ──
  { id: "rusty_blade",       name: "Rusty Blade",        slot: "weapon", rarity: "common", icon: "🗡️", description: "+4 damage",                    bonuses: { damage: 4 } },
  { id: "sharpened_edge",    name: "Sharpened Edge",      slot: "weapon", rarity: "common", icon: "⚔️", description: "+6 damage",                    bonuses: { damage: 6 } },
  { id: "venomfang",         name: "Venomfang",           slot: "weapon", rarity: "rare",   icon: "🐍", description: "+5 damage, +2% crit",          bonuses: { damage: 5, critChance: 0.02 } },
  { id: "soulreaver",        name: "Soulreaver",          slot: "weapon", rarity: "rare",   icon: "👻", description: "+8 damage, +3 on-kill heal",   bonuses: { damage: 8, onKillHeal: 3 } },
  { id: "void_cleaver",      name: "Void Cleaver",        slot: "weapon", rarity: "epic",   icon: "🔮", description: "+12 damage, +4% crit",         bonuses: { damage: 12, critChance: 0.04 } },
  { id: "stormbreaker",      name: "Stormbreaker",        slot: "weapon", rarity: "epic",   icon: "⚡", description: "+10 damage, +0.1 attack speed", bonuses: { damage: 10, attackSpeed: 0.1 } },

  // ── Armor ──
  { id: "leather_vest",      name: "Leather Vest",        slot: "armor",  rarity: "common", icon: "🧥", description: "+10 HP, +3 armor",             bonuses: { maxHealth: 10, armor: 3 } },
  { id: "chainmail",         name: "Chainmail",           slot: "armor",  rarity: "common", icon: "🛡️", description: "+6 armor",                     bonuses: { armor: 6 } },
  { id: "shadow_cloak",      name: "Shadow Cloak",        slot: "armor",  rarity: "rare",   icon: "🌫️", description: "+3% dodge, +15 HP",            bonuses: { dodgeChance: 0.03, maxHealth: 15 } },
  { id: "iron_bastion",      name: "Iron Bastion",        slot: "armor",  rarity: "rare",   icon: "🏰", description: "+10 armor, +20 HP",            bonuses: { armor: 10, maxHealth: 20 } },
  { id: "abyssal_plate",     name: "Abyssal Plate",       slot: "armor",  rarity: "epic",   icon: "🦴", description: "+15 armor, +30 HP, +2% dodge", bonuses: { armor: 15, maxHealth: 30, dodgeChance: 0.02 } },
  { id: "wraithbound_mail",  name: "Wraithbound Mail",    slot: "armor",  rarity: "epic",   icon: "👁️", description: "+8 armor, +4% lifesteal",      bonuses: { armor: 8, lifesteal: 0.04 } },

  // ── Trinkets ──
  { id: "cracked_gem",       name: "Cracked Gem",         slot: "trinket", rarity: "common", icon: "💎", description: "+10% XP gain",                 bonuses: { xpMultiplier: 0.1 } },
  { id: "swift_boots",       name: "Swift Boots",         slot: "trinket", rarity: "common", icon: "👢", description: "+0.5 move speed",              bonuses: { moveSpeed: 0.5 } },
  { id: "blood_amulet",      name: "Blood Amulet",        slot: "trinket", rarity: "rare",   icon: "🩸", description: "+3% lifesteal, +1 HP regen",   bonuses: { lifesteal: 0.03, healthRegen: 1 } },
  { id: "echo_ring",         name: "Echo Ring",           slot: "trinket", rarity: "rare",   icon: "💫", description: "+0.08 attack speed, +3% crit", bonuses: { attackSpeed: 0.08, critChance: 0.03 } },
  { id: "crown_of_thorns",   name: "Crown of Thorns",     slot: "trinket", rarity: "epic",   icon: "👑", description: "+5 damage, +5% crit, +2% lifesteal", bonuses: { damage: 5, critChance: 0.05, lifesteal: 0.02 } },
  { id: "shard_of_infinity", name: "Shard of Infinity",   slot: "trinket", rarity: "epic",   icon: "✨", description: "+20% XP, +0.1 attack speed, +15 HP",  bonuses: { xpMultiplier: 0.2, attackSpeed: 0.1, maxHealth: 15 } },
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
 * Common is the base chance. Rare and epic are much lower.
 * Roll each rarity independently — epic first, then rare, then common.
 * This means you can't get a common if you roll an epic.
 *
 * Tuned for early-access pacing: a new player should see at least one drop
 * within their first 5 waves so the gear system is visibly present from the
 * start. Boss and Trial Champion rates are intentionally left high so those
 * fights still feel rewarding.
 */
export const GEAR_DROP_RATES: Record<string, Record<GearRarity, number>> = {
  scuttler:          { common: 0.005,  rare: 0,      epic: 0 },        // 0.5% common
  wraith:            { common: 0.005,  rare: 0.001,  epic: 0 },        // 0.5% common, 0.1% rare
  brute:             { common: 0.02,   rare: 0.003,  epic: 0 },        // 2% common, 0.3% rare
  elite:             { common: 0.05,   rare: 0.01,   epic: 0.002 },    // 5% common, 1% rare, 0.2% epic
  boss:              { common: 0.10,   rare: 0.04,   epic: 0.01 },     // 10% common, 4% rare, 1% epic
  xp_goblin:         { common: 0.02,   rare: 0.004,  epic: 0 },        // 2% common, 0.4% rare — rewards chasing
  warrior_champion:  { common: 1.0,    rare: 0.40,   epic: 0.10 },     // guaranteed common, 40% rare, 10% epic
  mage_champion:     { common: 1.0,    rare: 0.40,   epic: 0.10 },
  rogue_champion:    { common: 1.0,    rare: 0.40,   epic: 0.10 },
};

/**
 * Attempt a gear drop. Rolls epic first, then rare, then common.
 * Returns null if nothing drops.
 */
export function tryRollGear(enemyType: string): GearDef | null {
  const rates = GEAR_DROP_RATES[enemyType];
  if (!rates) return null;
  // Roll highest rarity first
  if (rates.epic > 0 && Math.random() < rates.epic) return rollGearDrop("epic");
  if (rates.rare > 0 && Math.random() < rates.rare) return rollGearDrop("rare");
  if (rates.common > 0 && Math.random() < rates.common) return rollGearDrop("common");
  return null;
}
