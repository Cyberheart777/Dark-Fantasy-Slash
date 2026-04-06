/**
 * UpgradeData.ts
 * Data-driven upgrade/passive definitions.
 * Adding new upgrades: just add an entry to UPGRADES.
 * STEAM NOTE: Supports external JSON loading for content mods.
 */

export type UpgradeId =
  | "damage_boost"
  | "attack_speed_boost"
  | "max_health_boost"
  | "crit_chance_boost"
  | "move_speed_boost"
  | "lifesteal_start"
  | "lifesteal_boost"
  | "cleave_start"
  | "cleave_boost"
  | "double_strike"
  | "armor_boost"
  | "health_regen"
  | "dash_cooldown"
  | "xp_gain_boost"
  | "berserker_rage"
  | "iron_skin"
  | "attack_range_boost"
  | "soul_feast"
  | "wraithplate"
  | "overclock";

export interface UpgradeDef {
  id: UpgradeId;
  name: string;
  description: string;
  icon: string;   // Emoji placeholder — replace with spritesheet key for Steam build
  maxStacks: number;
  apply: (stats: PlayerStats) => void;
}

export interface PlayerStats {
  maxHealth: number;
  currentHealth: number;
  damage: number;
  attackSpeed: number;
  moveSpeed: number;
  critChance: number;
  armor: number;
  lifesteal: number;
  cleaveChance: number;
  dodgeChance: number;
  doubleStrikeChance: number;
  healthRegen: number;
  dashCooldown: number;
  xpMultiplier: number;
  attackRange: number;
  attackArc: number;
  onKillHeal: number;
}

export function createDefaultStats(): PlayerStats {
  return {
    maxHealth: 120,
    currentHealth: 120,
    damage: 18,
    attackSpeed: 1.0,
    moveSpeed: 8,          // units/second (3D scale)
    critChance: 0.05,
    armor: 5,
    lifesteal: 0,
    cleaveChance: 0,
    dodgeChance: 0,
    doubleStrikeChance: 0,
    healthRegen: 0,
    dashCooldown: 2.2,     // seconds (3D scale)
    xpMultiplier: 1.0,
    attackRange: 5,        // units (3D scale)
    attackArc: 120,
    onKillHeal: 0,
  };
}

export const UPGRADES: Record<UpgradeId, UpgradeDef> = {
  damage_boost: {
    id: "damage_boost",
    name: "Whetstone",
    description: "+15% weapon damage",
    icon: "⚔️",
    maxStacks: 8,
    apply: (s) => { s.damage = Math.round(s.damage * 1.15); },
  },
  attack_speed_boost: {
    id: "attack_speed_boost",
    name: "Bladestorm",
    description: "+12% attack speed",
    icon: "🌪️",
    maxStacks: 6,
    apply: (s) => { s.attackSpeed = parseFloat((s.attackSpeed * 1.12).toFixed(3)); },
  },
  max_health_boost: {
    id: "max_health_boost",
    name: "Iron Constitution",
    description: "+20 max health and heal 20 HP",
    icon: "❤️",
    maxStacks: 10,
    apply: (s) => {
      s.maxHealth += 20;
      s.currentHealth = Math.min(s.currentHealth + 20, s.maxHealth);
    },
  },
  crit_chance_boost: {
    id: "crit_chance_boost",
    name: "Critical Eye",
    description: "+6% critical strike chance",
    icon: "🎯",
    maxStacks: 6,
    apply: (s) => { s.critChance = parseFloat((s.critChance + 0.06).toFixed(3)); },
  },
  move_speed_boost: {
    id: "move_speed_boost",
    name: "Windwalker",
    description: "+12% movement speed",
    icon: "💨",
    maxStacks: 5,
    apply: (s) => { s.moveSpeed = parseFloat((s.moveSpeed * 1.12).toFixed(3)); },
  },
  lifesteal_start: {
    id: "lifesteal_start",
    name: "Blood Price",
    description: "Gain 6% lifesteal on hits",
    icon: "🩸",
    maxStacks: 1,
    apply: (s) => { s.lifesteal += 0.06; },
  },
  lifesteal_boost: {
    id: "lifesteal_boost",
    name: "Bloodlord",
    description: "+4% lifesteal",
    icon: "🩸",
    maxStacks: 5,
    apply: (s) => { s.lifesteal += 0.04; },
  },
  cleave_start: {
    id: "cleave_start",
    name: "Wide Swing",
    description: "Attacks now cleave — wider arc (+30°)",
    icon: "🪓",
    maxStacks: 1,
    apply: (s) => { s.cleaveChance = 1; s.attackArc += 30; },
  },
  cleave_boost: {
    id: "cleave_boost",
    name: "Arc Master",
    description: "+20° attack arc",
    icon: "🪓",
    maxStacks: 5,
    apply: (s) => { s.attackArc += 20; },
  },
  double_strike: {
    id: "double_strike",
    name: "Twin Fang",
    description: "+18% chance to strike twice",
    icon: "⚡",
    maxStacks: 4,
    apply: (s) => { s.doubleStrikeChance += 0.18; },
  },
  armor_boost: {
    id: "armor_boost",
    name: "Tempered Plate",
    description: "+8 armor (reduces incoming damage)",
    icon: "🛡️",
    maxStacks: 6,
    apply: (s) => { s.armor += 8; },
  },
  health_regen: {
    id: "health_regen",
    name: "Troll's Blood",
    description: "+1.5 HP regen per second",
    icon: "✨",
    maxStacks: 5,
    apply: (s) => { s.healthRegen += 1.5; },
  },
  dash_cooldown: {
    id: "dash_cooldown",
    name: "Phantom Step",
    description: "-20% dash cooldown",
    icon: "🌀",
    maxStacks: 5,
    apply: (s) => { s.dashCooldown = Math.round(s.dashCooldown * 0.8); },
  },
  xp_gain_boost: {
    id: "xp_gain_boost",
    name: "Scholar's Insight",
    description: "+25% XP from all sources",
    icon: "📖",
    maxStacks: 4,
    apply: (s) => { s.xpMultiplier = parseFloat((s.xpMultiplier * 1.25).toFixed(3)); },
  },
  berserker_rage: {
    id: "berserker_rage",
    name: "Glass Cannon",
    description: "+20% damage but -10% max health",
    icon: "💥",
    maxStacks: 3,
    apply: (s) => {
      s.damage = Math.round(s.damage * 1.20);
      s.maxHealth = Math.max(10, Math.round(s.maxHealth * 0.90));
      s.currentHealth = Math.min(s.currentHealth, s.maxHealth);
    },
  },
  iron_skin: {
    id: "iron_skin",
    name: "Iron Skin",
    description: "+5% dodge chance",
    icon: "🪬",
    maxStacks: 4,
    apply: (s) => { s.dodgeChance += 0.05; },
  },
  attack_range_boost: {
    id: "attack_range_boost",
    name: "Executioner's Reach",
    description: "+1 attack range (melee arc & projectile distance)",
    icon: "🗡️",
    maxStacks: 4,
    apply: (s) => { s.attackRange += 1; },
  },
  soul_feast: {
    id: "soul_feast",
    name: "Soul Feast",
    description: "Heal 8 HP on every kill",
    icon: "👻",
    maxStacks: 5,
    apply: (s) => { s.onKillHeal += 8; },
  },
  wraithplate: {
    id: "wraithplate",
    name: "Wraithplate",
    description: "+15 armor",
    icon: "🦴",
    maxStacks: 4,
    apply: (s) => { s.armor += 15; },
  },
  overclock: {
    id: "overclock",
    name: "Overclock",
    description: "+5% attack speed and +5% move speed",
    icon: "⚡",
    maxStacks: 5,
    apply: (s) => {
      s.attackSpeed = parseFloat((s.attackSpeed * 1.05).toFixed(3));
      s.moveSpeed   = parseFloat((s.moveSpeed   * 1.05).toFixed(3));
    },
  },
};

/** Pick 3 random upgrades, avoiding over-stacked ones */
export function pickUpgradeChoices(
  acquired: Map<UpgradeId, number>,
  count = 3
): UpgradeDef[] {
  const available = (Object.values(UPGRADES) as UpgradeDef[]).filter((u) => {
    const stacks = acquired.get(u.id) ?? 0;
    return stacks < u.maxStacks;
  });

  // Shuffle
  for (let i = available.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [available[i], available[j]] = [available[j], available[i]];
  }

  return available.slice(0, count);
}
