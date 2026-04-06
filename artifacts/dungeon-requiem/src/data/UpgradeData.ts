/**
 * UpgradeData.ts
 * Data-driven upgrade/passive definitions.
 * Relics are rare, game-changing items offered every 4 levels.
 * Adding new upgrades: just add an entry to UPGRADES.
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
  | "overclock"
  // ── Relics ─────────────────────────────────────────────────────────────────
  | "relic_soulfire"
  | "relic_vampiric"
  | "relic_phantom_echo"
  | "relic_deaths_bargain"
  | "relic_abyss_crown"
  | "relic_blood_covenant"
  | "relic_storm_heart"
  | "relic_iron_oath";

export interface UpgradeDef {
  id: UpgradeId;
  name: string;
  description: string;
  icon: string;
  maxStacks: number;
  isRelic?: boolean;
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
  // ── Relic-powered fields ───────────────────────────────────────────────────
  soulfireChance: number;      // 0..1 — kills trigger area explosion
  phantomEchoEvery: number;    // 0=off, N=bonus strike every Nth attack
  deathBargainActive: number;  // 1=cheat-death ready, 0=used or not acquired
  incomingDamageMult: number;  // 1.0 default, Abyss Crown raises this
  stormCallInterval: number;   // 0=off, N=auto lightning every N seconds
}

export function createDefaultStats(): PlayerStats {
  return {
    maxHealth: 120,
    currentHealth: 120,
    damage: 18,
    attackSpeed: 1.0,
    moveSpeed: 8,
    critChance: 0.05,
    armor: 5,
    lifesteal: 0,
    cleaveChance: 0,
    dodgeChance: 0,
    doubleStrikeChance: 0,
    healthRegen: 0,
    dashCooldown: 2.2,
    xpMultiplier: 1.0,
    attackRange: 5,
    attackArc: 120,
    onKillHeal: 0,
    soulfireChance: 0,
    phantomEchoEvery: 0,
    deathBargainActive: 0,
    incomingDamageMult: 1.0,
    stormCallInterval: 0,
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

  // ── Relics ─────────────────────────────────────────────────────────────────

  relic_soulfire: {
    id: "relic_soulfire",
    name: "Soulfire Blade",
    description: "Kills have a 35% chance to explode, dealing 2× your damage to nearby foes.",
    icon: "🔥",
    maxStacks: 1,
    isRelic: true,
    apply: (s) => { s.soulfireChance = 0.35; },
  },
  relic_vampiric: {
    id: "relic_vampiric",
    name: "Vampiric Shroud",
    description: "+18% lifesteal. Every kill fully refreshes your invincibility window.",
    icon: "🧛",
    maxStacks: 1,
    isRelic: true,
    apply: (s) => { s.lifesteal += 0.18; s.onKillHeal += 5; },
  },
  relic_phantom_echo: {
    id: "relic_phantom_echo",
    name: "Phantom Echo",
    description: "Every 5th attack fires a free ghost strike for 70% damage. Costs nothing.",
    icon: "👁️",
    maxStacks: 1,
    isRelic: true,
    apply: (s) => { s.phantomEchoEvery = 5; },
  },
  relic_deaths_bargain: {
    id: "relic_deaths_bargain",
    name: "Death's Bargain",
    description: "Once per run, survive a lethal blow. You live with 1 HP and cannot die for 2s.",
    icon: "💀",
    maxStacks: 1,
    isRelic: true,
    apply: (s) => { s.deathBargainActive = 1; },
  },
  relic_abyss_crown: {
    id: "relic_abyss_crown",
    name: "Abyss Crown",
    description: "+100% XP gain. Cursed: you take 25% more damage from all sources.",
    icon: "👑",
    maxStacks: 1,
    isRelic: true,
    apply: (s) => {
      s.xpMultiplier = parseFloat((s.xpMultiplier * 2.0).toFixed(3));
      s.incomingDamageMult = parseFloat((s.incomingDamageMult * 1.25).toFixed(3));
    },
  },
  relic_blood_covenant: {
    id: "relic_blood_covenant",
    name: "Blood Covenant",
    description: "Sacrifice 30% of your max HP. In return, deal +70% more damage permanently.",
    icon: "🩸",
    maxStacks: 1,
    isRelic: true,
    apply: (s) => {
      s.damage = Math.round(s.damage * 1.70);
      s.maxHealth = Math.max(1, Math.round(s.maxHealth * 0.70));
      s.currentHealth = Math.min(s.currentHealth, s.maxHealth);
    },
  },
  relic_storm_heart: {
    id: "relic_storm_heart",
    name: "Storm Heart",
    description: "Every 12 seconds, a lightning storm strikes up to 10 enemies for 3× your damage.",
    icon: "⚡",
    maxStacks: 1,
    isRelic: true,
    apply: (s) => { s.stormCallInterval = 12; },
  },
  relic_iron_oath: {
    id: "relic_iron_oath",
    name: "Iron Oath",
    description: "Gain +80 armor and +40% max HP. Your dash is disabled — you stand your ground.",
    icon: "⚙️",
    maxStacks: 1,
    isRelic: true,
    apply: (s) => {
      s.armor += 80;
      const bonus = Math.round(s.maxHealth * 0.40);
      s.maxHealth += bonus;
      s.currentHealth = Math.min(s.currentHealth + bonus, s.maxHealth);
      s.dashCooldown = 9999;
    },
  },
};

const RELIC_IDS: UpgradeId[] = [
  "relic_soulfire", "relic_vampiric", "relic_phantom_echo", "relic_deaths_bargain",
  "relic_abyss_crown", "relic_blood_covenant", "relic_storm_heart", "relic_iron_oath",
];

/** Pick 3 level-up choices. Every 4th level guarantees 1 relic slot. */
export function pickUpgradeChoices(
  acquired: Map<UpgradeId, number>,
  count = 3,
  level = 1
): UpgradeDef[] {
  const normalPool = (Object.values(UPGRADES) as UpgradeDef[]).filter((u) => {
    if (u.isRelic) return false;
    const stacks = acquired.get(u.id) ?? 0;
    return stacks < u.maxStacks;
  });
  const relicPool = RELIC_IDS
    .map((id) => UPGRADES[id])
    .filter((u) => (acquired.get(u.id) ?? 0) < u.maxStacks);

  const shuffled = <T>(arr: T[]): T[] => {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };

  const offerRelic = relicPool.length > 0 && (
    level % 4 === 0 ||
    (level >= 5 && Math.random() < 0.25)
  );

  if (offerRelic) {
    const relic = shuffled(relicPool)[0];
    const normals = shuffled(normalPool).slice(0, count - 1);
    return shuffled([relic, ...normals]);
  }

  return shuffled(normalPool).slice(0, count);
}
