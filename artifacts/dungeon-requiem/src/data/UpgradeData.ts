/**
 * UpgradeData.ts
 * Data-driven upgrade/passive definitions with class-gating, rarity, and
 * class-specific mechanics (pierce, DoTs, dash variants, warrior perks).
 *
 * Relic values TONED DOWN from original (e.g. soulfire 35→20%, vampiric 12→6%,
 * blood covenant 45→25%, storm heart 1.8→1.2×, iron oath 80→40 armor).
 */

import type { CharacterClass } from "./CharacterData";

// ─── Upgrade IDs ───────────────────────────────────────────────────────────────

export type UpgradeId =
  // ── Universal ──
  | "damage_boost"
  | "attack_speed_boost"
  | "max_health_boost"
  | "crit_chance_boost"
  | "move_speed_boost"
  | "lifesteal_start"
  | "lifesteal_boost"
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
  // ── Warrior-only ──
  | "cleave_start"
  | "cleave_boost"
  | "blood_momentum"
  | "earthbreaker"
  | "iron_reprisal"
  | "fortress"
  | "war_cry"
  | "bloodforge"
  | "weakening_blows"
  | "serrated_edge"
  | "concussive_charge"
  // ── Mage-only ──
  | "chain_lightning"
  | "spell_echo"
  | "arcane_fracture"
  | "mana_shield"
  | "singularity"
  | "frost_armor"
  | "arcane_detonation"
  | "gravity_orbs"
  | "overcharged_orbs"
  | "residual_field"
  | "extra_orb"
  | "volatile_blink"
  | "projectile_size"
  | "split_bolt"
  // ── Rogue-only ──
  | "shadow_step"
  | "venom_stack"
  | "crit_cascade"
  | "phantom_blades"
  | "evasion_matrix"
  | "blade_orbit"
  | "extra_daggers"
  | "toxic_dash"
  | "deep_wounds"
  // ── Relics ──
  | "relic_soulfire"
  | "relic_vampiric"
  | "relic_phantom_echo"
  | "relic_deaths_bargain"
  | "relic_abyss_crown"
  | "relic_blood_covenant"
  | "relic_storm_heart"
  | "relic_iron_oath";

// ─── Rarity ────────────────────────────────────────────────────────────────────

export type UpgradeRarity = "common" | "rare" | "epic";

const RARITY_WEIGHT: Record<UpgradeRarity, number> = {
  common: 10,
  rare: 5,
  epic: 2,
};

// ─── Interfaces ────────────────────────────────────────────────────────────────

export interface UpgradeDef {
  id: UpgradeId;
  name: string;
  description: string;
  icon: string;
  maxStacks: number;
  isRelic?: boolean;
  rarity: UpgradeRarity;
  classes: "all" | CharacterClass[];
  apply: (stats: PlayerStats) => void;
  /** Runtime-only: current stack count when presented in level-up UI */
  currentLevel?: number;
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
  // ── Relic fields ───────────────────────────────────────────────────────────
  soulfireChance: number;
  phantomEchoEvery: number;
  deathBargainActive: number;
  incomingDamageMult: number;
  stormCallInterval: number;
  // ── Warrior-specific ───────────────────────────────────────────────────────
  bloodMomentumPerHit: number;   // stacking damage % per hit (0 = off)
  earthbreakerEnabled: boolean;  // every 5th hit AoE slam
  ironReprisalEnabled: boolean;  // shockwave on damage taken
  fortressArmorPerSec: number;   // armor/sec while standing still
  warCryDmgBonus: number;        // % bonus damage for 5s after dash (baseline)
  bloodforgeMaxHpPerKill: number; // +1 max HP per kill, capped at 20
  weakeningBlowsPct: number;     // % damage reduction applied per melee hit on enemies
  serratedBleedDps: number;      // bleed damage per sec on crit (WARRIOR owns bleed)
  dashKnockbackForce: number;    // knockback distance on dash (baseline, upgradeable)
  // ── Mage-specific ──────────────────────────────────────────────────────────
  chainLightningBounces: number; // bounce count per hit
  spellEchoChance: number;       // chance to double-cast
  arcaneFractureEnabled: boolean;// death explosions
  manaShieldPct: number;         // damage absorption %
  singularityInterval: number;   // seconds between vortex
  frostArmorSlowPct: number;     // slow on enemies that hit you
  mageExtraOrbs: number;         // additional projectiles per attack
  mageBlinkSlowPct: number;      // slow applied to enemies at blink origin (baseline)
  volatileBlinkEnabled: boolean; // blink afterimage explodes for 1× damage
  projectileRadiusBonus: number; // flat bonus to projectile collision radius
  splitBoltActive: boolean;      // +1 orb but -25% damage
  arcaneDetonationEnabled: boolean; // orbs explode on expiry for 60% AoE
  gravityOrbPull: number;        // pull strength (units/sec) on nearby enemies
  overchargedOrbBonus: number;   // max damage bonus at max range (0.8 = +80%)
  residualFieldEnabled: boolean; // orbs leave damaging ground trail
  // ── Rogue-specific ─────────────────────────────────────────────────────────
  dashResetOnKill: boolean;      // dash cd resets on kill
  venomStackDps: number;         // poison damage per second per stack
  critCascadeEnabled: boolean;   // crits boost crit chance temporarily
  phantomBladesEnabled: boolean; // extra spectral daggers
  evasionMatrixEnabled: boolean; // dodge → invis + crit
  bladeOrbitCount: number;       // spinning daggers
  rogueExtraDaggers: number;     // additional daggers per attack
  toxicDashStacks: number;       // poison stacks applied by dash (baseline 1, upgradeable)
  deepWoundsMultiplier: number;  // multiplier on poison duration/damage
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
    // Warrior
    bloodMomentumPerHit: 0,
    earthbreakerEnabled: false,
    ironReprisalEnabled: false,
    fortressArmorPerSec: 0,
    warCryDmgBonus: 0.15,        // baseline: +15% damage for 4s after dash
    bloodforgeMaxHpPerKill: 0,
    weakeningBlowsPct: 0,
    serratedBleedDps: 0,          // bleed on crit (warrior owns bleed)
    dashKnockbackForce: 3,        // baseline knockback on dash
    // Mage
    chainLightningBounces: 0,
    spellEchoChance: 0,
    arcaneFractureEnabled: false,
    manaShieldPct: 0,
    singularityInterval: 0,
    frostArmorSlowPct: 0,
    arcaneDetonationEnabled: false,
    gravityOrbPull: 0,
    overchargedOrbBonus: 0,
    residualFieldEnabled: false,
    mageExtraOrbs: 0,
    mageBlinkSlowPct: 0.30,       // baseline: 30% slow at blink origin
    volatileBlinkEnabled: false,
    projectileRadiusBonus: 0,
    splitBoltActive: false,
    // Rogue
    dashResetOnKill: false,
    venomStackDps: 0,
    critCascadeEnabled: false,
    phantomBladesEnabled: false,
    evasionMatrixEnabled: false,
    bladeOrbitCount: 0,
    rogueExtraDaggers: 0,
    toxicDashStacks: 1,            // baseline: 1 poison stack on dash
    deepWoundsMultiplier: 1.0,
  };
}

// ─── Upgrade Definitions ───────────────────────────────────────────────────────

export const UPGRADES: Record<UpgradeId, UpgradeDef> = {
  // ════════════════════════════════════════════════════════════════════════════
  // UNIVERSAL
  // ════════════════════════════════════════════════════════════════════════════
  damage_boost: {
    id: "damage_boost", name: "Whetstone",
    description: "+15% weapon damage",
    icon: "⚔️", maxStacks: 8, rarity: "common", classes: "all",
    apply: (s) => { s.damage = Math.round(s.damage * 1.15); },
  },
  attack_speed_boost: {
    id: "attack_speed_boost", name: "Bladestorm",
    description: "+12% attack speed",
    icon: "🌪️", maxStacks: 6, rarity: "common", classes: "all",
    apply: (s) => { s.attackSpeed = parseFloat((s.attackSpeed * 1.12).toFixed(3)); },
  },
  max_health_boost: {
    id: "max_health_boost", name: "Iron Constitution",
    description: "+20 max health and heal 20 HP",
    icon: "❤️", maxStacks: 10, rarity: "common", classes: "all",
    apply: (s) => {
      s.maxHealth += 20;
      s.currentHealth = Math.min(s.currentHealth + 20, s.maxHealth);
    },
  },
  crit_chance_boost: {
    id: "crit_chance_boost", name: "Critical Eye",
    description: "+6% critical strike chance",
    icon: "🎯", maxStacks: 6, rarity: "common", classes: "all",
    apply: (s) => { s.critChance = parseFloat((s.critChance + 0.06).toFixed(3)); },
  },
  move_speed_boost: {
    id: "move_speed_boost", name: "Windwalker",
    description: "+12% movement speed",
    icon: "💨", maxStacks: 5, rarity: "common", classes: "all",
    apply: (s) => { s.moveSpeed = parseFloat((s.moveSpeed * 1.12).toFixed(3)); },
  },
  lifesteal_start: {
    id: "lifesteal_start", name: "Blood Price",
    description: "Gain 4% lifesteal on hits",
    icon: "🩸", maxStacks: 1, rarity: "rare", classes: "all",
    apply: (s) => { s.lifesteal += 0.04; }, // was 0.06 — total lifesteal was too high
  },
  lifesteal_boost: {
    id: "lifesteal_boost", name: "Bloodlord",
    description: "+2% lifesteal",
    icon: "🩸", maxStacks: 5, rarity: "common", classes: "all",
    apply: (s) => { s.lifesteal += 0.02; }, // was 0.04 — max stack gave +20% alone
  },
  double_strike: {
    id: "double_strike", name: "Twin Fang",
    description: "+18% chance to strike twice",
    icon: "⚡", maxStacks: 4, rarity: "rare", classes: "all",
    apply: (s) => { s.doubleStrikeChance += 0.18; },
  },
  armor_boost: {
    id: "armor_boost", name: "Tempered Plate",
    description: "+5 armor (reduces incoming damage)",
    icon: "🛡️", maxStacks: 6, rarity: "common", classes: "all",
    apply: (s) => { s.armor += 5; }, // was 8 — max stack gave +48 alone
  },
  health_regen: {
    id: "health_regen", name: "Troll's Blood",
    description: "+1.0 HP regen per second",
    icon: "✨", maxStacks: 5, rarity: "common", classes: "all",
    apply: (s) => { s.healthRegen += 1.0; }, // was 1.5 — max stack gave +7.5/sec
  },
  dash_cooldown: {
    id: "dash_cooldown", name: "Phantom Step",
    description: "-20% dash cooldown",
    icon: "🌀", maxStacks: 5, rarity: "common", classes: "all",
    apply: (s) => { s.dashCooldown = parseFloat((s.dashCooldown * 0.8).toFixed(2)); },
  },
  xp_gain_boost: {
    id: "xp_gain_boost", name: "Scholar's Insight",
    description: "+25% XP from all sources",
    icon: "📖", maxStacks: 4, rarity: "common", classes: "all",
    apply: (s) => { s.xpMultiplier = parseFloat((s.xpMultiplier * 1.25).toFixed(3)); },
  },
  berserker_rage: {
    id: "berserker_rage", name: "Glass Cannon",
    description: "+20% damage but -10% max health",
    icon: "💥", maxStacks: 3, rarity: "rare", classes: "all",
    apply: (s) => {
      s.damage = Math.round(s.damage * 1.20);
      s.maxHealth = Math.max(10, Math.round(s.maxHealth * 0.90));
      s.currentHealth = Math.min(s.currentHealth, s.maxHealth);
    },
  },
  iron_skin: {
    id: "iron_skin", name: "Iron Skin",
    description: "+5% dodge chance",
    icon: "🪬", maxStacks: 4, rarity: "common", classes: "all",
    apply: (s) => { s.dodgeChance += 0.05; },
  },
  attack_range_boost: {
    id: "attack_range_boost", name: "Executioner's Reach",
    description: "+1 attack range",
    icon: "🗡️", maxStacks: 4, rarity: "common", classes: "all",
    apply: (s) => { s.attackRange += 1; },
  },
  soul_feast: {
    id: "soul_feast", name: "Soul Feast",
    description: "Heal 8 HP on every kill",
    icon: "👻", maxStacks: 5, rarity: "common", classes: "all",
    apply: (s) => { s.onKillHeal += 8; },
  },
  wraithplate: {
    id: "wraithplate", name: "Wraithplate",
    description: "+10 armor",
    icon: "🦴", maxStacks: 4, rarity: "common", classes: "all",
    apply: (s) => { s.armor += 10; }, // was 15 — max stack gave +60 alone
  },
  overclock: {
    id: "overclock", name: "Overclock",
    description: "+5% attack speed and +5% move speed",
    icon: "⚡", maxStacks: 5, rarity: "common", classes: "all",
    apply: (s) => {
      s.attackSpeed = parseFloat((s.attackSpeed * 1.05).toFixed(3));
      s.moveSpeed   = parseFloat((s.moveSpeed   * 1.05).toFixed(3));
    },
  },

  // ════════════════════════════════════════════════════════════════════════════
  // WARRIOR-ONLY — melee is hard mode, so these are slightly stronger
  // ════════════════════════════════════════════════════════════════════════════
  cleave_start: {
    id: "cleave_start", name: "Wide Swing",
    description: "Attacks now cleave — wider arc (+30°)",
    icon: "🪓", maxStacks: 1, rarity: "rare", classes: ["warrior"],
    apply: (s) => { s.cleaveChance = 1; s.attackArc += 30; },
  },
  cleave_boost: {
    id: "cleave_boost", name: "Arc Master",
    description: "+20° attack arc",
    icon: "🪓", maxStacks: 5, rarity: "common", classes: ["warrior"],
    apply: (s) => { s.attackArc += 20; },
  },
  blood_momentum: {
    id: "blood_momentum", name: "Blood Momentum",
    description: "Each consecutive hit increases damage by +3% (max 60%). Resets after 2s.",
    icon: "🔴", maxStacks: 1, rarity: "epic", classes: ["warrior"],
    apply: (s) => { s.bloodMomentumPerHit = 0.03; },
  },
  earthbreaker: {
    id: "earthbreaker", name: "Earthbreaker",
    description: "Every 5th hit slams the ground — AoE damage to all nearby enemies.",
    icon: "🌋", maxStacks: 1, rarity: "epic", classes: ["warrior"],
    apply: (s) => { s.earthbreakerEnabled = true; },
  },
  iron_reprisal: {
    id: "iron_reprisal", name: "Iron Reprisal",
    description: "Taking damage releases a shockwave dealing 15% of your max HP as damage.",
    icon: "💢", maxStacks: 1, rarity: "rare", classes: ["warrior"],
    apply: (s) => { s.ironReprisalEnabled = true; },
  },
  fortress: {
    id: "fortress", name: "Fortress",
    description: "Gain +2 armor/sec while standing still (max +20).",
    icon: "🏰", maxStacks: 1, rarity: "rare", classes: ["warrior"],
    apply: (s) => { s.fortressArmorPerSec = 2; }, // was 3 (+30 cap) — reduced in GameScene too
  },
  war_cry: {
    id: "war_cry", name: "Battle Roar",
    description: "War Cry damage bonus increased to +35% for 6 seconds.",
    icon: "📯", maxStacks: 1, rarity: "rare", classes: ["warrior"],
    apply: (s) => { s.warCryDmgBonus = 0.35; },  // upgrades baseline 0.15 → 0.35
  },
  bloodforge: {
    id: "bloodforge", name: "Bloodforge",
    description: "Each kill grants +1 max HP (capped at +20).",
    icon: "🩸", maxStacks: 1, rarity: "rare", classes: ["warrior"],
    apply: (s) => { s.bloodforgeMaxHpPerKill = 1; },
  },
  weakening_blows: {
    id: "weakening_blows", name: "Weakening Blows",
    description: "Melee hits reduce enemy damage by 2%.",
    icon: "💀", maxStacks: 3, rarity: "rare", classes: ["warrior"],
    apply: (s) => { s.weakeningBlowsPct += 0.02; },
  },
  serrated_edge: {
    id: "serrated_edge", name: "Serrated Edge",
    description: "Critical hits apply a bleed: 6 damage/sec for 3s.",
    icon: "🩸", maxStacks: 3, rarity: "rare", classes: ["warrior"],
    apply: (s) => { s.serratedBleedDps += 6; },
  },
  concussive_charge: {
    id: "concussive_charge", name: "Concussive Charge",
    description: "Dash knockback distance +50%. Knocked enemies take damage.",
    icon: "💥", maxStacks: 2, rarity: "rare", classes: ["warrior"],
    apply: (s) => { s.dashKnockbackForce += 2; },
  },

  // ════════════════════════════════════════════════════════════════════════════
  // MAGE-ONLY — pierce, extra orbs, control
  // ════════════════════════════════════════════════════════════════════════════
  chain_lightning: {
    id: "chain_lightning", name: "Chain Lightning",
    description: "Projectile hits bounce to 2 nearby enemies for 60% damage.",
    icon: "⚡", maxStacks: 3, rarity: "rare", classes: ["mage"],
    apply: (s) => { s.chainLightningBounces += 2; },
  },
  spell_echo: {
    id: "spell_echo", name: "Spell Echo",
    description: "+25% chance to double-cast your projectile.",
    icon: "🔮", maxStacks: 3, rarity: "rare", classes: ["mage"],
    apply: (s) => { s.spellEchoChance = parseFloat((s.spellEchoChance + 0.25).toFixed(3)); },
  },
  arcane_fracture: {
    id: "arcane_fracture", name: "Arcane Fracture",
    description: "Enemies killed by your projectiles explode into 3 mini-projectiles.",
    icon: "💎", maxStacks: 1, rarity: "epic", classes: ["mage"],
    apply: (s) => { s.arcaneFractureEnabled = true; },
  },
  mana_shield: {
    id: "mana_shield", name: "Mana Shield",
    description: "Absorb 25% of incoming damage as a magic barrier.",
    icon: "🛡️", maxStacks: 1, rarity: "rare", classes: ["mage"],
    apply: (s) => { s.manaShieldPct = 0.25; },
  },
  singularity: {
    id: "singularity", name: "Singularity",
    description: "Every 14s create a vortex pulling enemies inward for 3s.",
    icon: "🌀", maxStacks: 1, rarity: "epic", classes: ["mage"],
    apply: (s) => { s.singularityInterval = 14; },
  },
  frost_armor: {
    id: "frost_armor", name: "Frost Armor",
    description: "Enemies that hit you are slowed by 35% for 2s.",
    icon: "❄️", maxStacks: 1, rarity: "rare", classes: ["mage"],
    apply: (s) => { s.frostArmorSlowPct = 0.35; },
  },
  arcane_detonation: {
    id: "arcane_detonation", name: "Arcane Detonation",
    description: "Orbs explode on expiry for 60% AoE damage.",
    icon: "💥", maxStacks: 1, rarity: "epic", classes: ["mage"],
    apply: (s) => { s.arcaneDetonationEnabled = true; },
  },
  gravity_orbs: {
    id: "gravity_orbs", name: "Gravity Orbs",
    description: "Orbs pull nearby enemies toward their flight path.",
    icon: "🌀", maxStacks: 1, rarity: "epic", classes: ["mage"],
    apply: (s) => { s.gravityOrbPull = 4; },
  },
  overcharged_orbs: {
    id: "overcharged_orbs", name: "Overcharged Orbs",
    description: "Orbs gain up to +80% damage at max range.",
    icon: "⚡", maxStacks: 1, rarity: "rare", classes: ["mage"],
    apply: (s) => { s.overchargedOrbBonus = 0.8; },
  },
  residual_field: {
    id: "residual_field", name: "Residual Field",
    description: "Orbs leave a damaging trail that burns enemies.",
    icon: "🔮", maxStacks: 1, rarity: "epic", classes: ["mage"],
    apply: (s) => { s.residualFieldEnabled = true; },
  },
  extra_orb: {
    id: "extra_orb", name: "Arcane Barrage",
    description: "Fire +1 additional orb per attack.",
    icon: "🟣", maxStacks: 3, rarity: "rare", classes: ["mage"],
    apply: (s) => { s.mageExtraOrbs += 1; },
  },
  volatile_blink: {
    id: "volatile_blink", name: "Volatile Blink",
    description: "Blink afterimage now explodes for 1× damage in a wide radius.",
    icon: "💥", maxStacks: 1, rarity: "epic", classes: ["mage"],
    apply: (s) => { s.volatileBlinkEnabled = true; },
  },
  projectile_size: {
    id: "projectile_size", name: "Amplified Orbs",
    description: "+20% projectile collision radius.",
    icon: "🔵", maxStacks: 3, rarity: "common", classes: ["mage"],
    apply: (s) => { s.projectileRadiusBonus += 0.11; },
  },
  split_bolt: {
    id: "split_bolt", name: "Split Bolt",
    description: "+1 orb per attack but -25% damage. Trades focus for spread.",
    icon: "🔀", maxStacks: 1, rarity: "rare", classes: ["mage"],
    apply: (s) => { s.splitBoltActive = true; s.mageExtraOrbs += 1; },
  },

  // ════════════════════════════════════════════════════════════════════════════
  // ROGUE-ONLY — speed, crits, poison, extra daggers
  // ════════════════════════════════════════════════════════════════════════════
  shadow_step: {
    id: "shadow_step", name: "Shadow Step",
    description: "Dash cooldown resets on kill.",
    icon: "👤", maxStacks: 1, rarity: "epic", classes: ["rogue"],
    apply: (s) => { s.dashResetOnKill = true; },
  },
  venom_stack: {
    id: "venom_stack", name: "Venom Stack",
    description: "Attacks apply poison: 4 damage/sec per stack. Spreads on death.",
    icon: "🐍", maxStacks: 3, rarity: "rare", classes: ["rogue"],
    apply: (s) => { s.venomStackDps += 4; },
  },
  crit_cascade: {
    id: "crit_cascade", name: "Crit Cascade",
    description: "Critical hits boost crit chance by +12% for 3s.",
    icon: "💫", maxStacks: 1, rarity: "epic", classes: ["rogue"],
    apply: (s) => { s.critCascadeEnabled = true; },
  },
  phantom_blades: {
    id: "phantom_blades", name: "Phantom Blades",
    description: "Each attack fires 2 extra spectral daggers at wide angles.",
    icon: "🗡️", maxStacks: 1, rarity: "epic", classes: ["rogue"],
    apply: (s) => { s.phantomBladesEnabled = true; },
  },
  evasion_matrix: {
    id: "evasion_matrix", name: "Evasion Matrix",
    description: "Successful dodge grants 1s invisibility + guaranteed crit.",
    icon: "🌫️", maxStacks: 1, rarity: "rare", classes: ["rogue"],
    apply: (s) => { s.evasionMatrixEnabled = true; },
  },
  blade_orbit: {
    id: "blade_orbit", name: "Blade Orbit",
    description: "3 daggers spin around you, damaging nearby enemies.",
    icon: "🔄", maxStacks: 2, rarity: "rare", classes: ["rogue"],
    apply: (s) => { s.bladeOrbitCount += 3; },
  },
  extra_daggers: {
    id: "extra_daggers", name: "Fan of Knives",
    description: "Fire +1 additional dagger per attack.",
    icon: "🔪", maxStacks: 3, rarity: "rare", classes: ["rogue"],
    apply: (s) => { s.rogueExtraDaggers += 1; },
  },
  toxic_dash: {
    id: "toxic_dash", name: "Toxic Dash",
    description: "Dash applies 3 poison stacks instead of 1.",
    icon: "☠️", maxStacks: 1, rarity: "rare", classes: ["rogue"],
    apply: (s) => { s.toxicDashStacks = 3; },
  },
  deep_wounds: {
    id: "deep_wounds", name: "Deep Wounds",
    description: "Poison damage and duration increased by 50%.",
    icon: "🧪", maxStacks: 2, rarity: "rare", classes: ["rogue"],
    apply: (s) => { s.deepWoundsMultiplier += 0.5; },
  },

  // ════════════════════════════════════════════════════════════════════════════
  // RELICS — TONED DOWN from original values
  // ════════════════════════════════════════════════════════════════════════════
  relic_soulfire: {
    id: "relic_soulfire", name: "Soulfire Blade",
    description: "Kills have a 20% chance to explode, dealing 1.5× your damage nearby.",
    icon: "🔥", maxStacks: 1, rarity: "epic", classes: "all", isRelic: true,
    apply: (s) => { s.soulfireChance = 0.20; },  // was 0.35
  },
  relic_vampiric: {
    id: "relic_vampiric", name: "Vampiric Shroud",
    description: "+4% lifesteal. Heal 2 HP on kill.",
    icon: "🧛", maxStacks: 1, rarity: "epic", classes: "all", isRelic: true,
    apply: (s) => { s.lifesteal += 0.04; s.onKillHeal += 2; }, // was 6% + 3 (was 12% + 5)
  },
  relic_phantom_echo: {
    id: "relic_phantom_echo", name: "Phantom Echo",
    description: "Every 5th attack fires a free ghost strike for 50% damage.",
    icon: "👁️", maxStacks: 1, rarity: "epic", classes: ["warrior"], isRelic: true,
    apply: (s) => { s.phantomEchoEvery = 5; },  // damage reduced 70→50% in GameScene
  },
  relic_deaths_bargain: {
    id: "relic_deaths_bargain", name: "Death's Bargain",
    description: "Once per run, survive a lethal blow with 1 HP. 1.5s invincibility.",
    icon: "💀", maxStacks: 1, rarity: "epic", classes: "all", isRelic: true,
    apply: (s) => { s.deathBargainActive = 1; },  // was 2s, now 1.5s in GameScene
  },
  relic_abyss_crown: {
    id: "relic_abyss_crown", name: "Abyss Crown",
    description: "+40% XP gain. Cursed: you take 20% more damage.",
    icon: "👑", maxStacks: 1, rarity: "epic", classes: "all", isRelic: true,
    apply: (s) => {
      s.xpMultiplier = parseFloat((s.xpMultiplier * 1.4).toFixed(3));  // was 1.6
      s.incomingDamageMult = parseFloat((s.incomingDamageMult * 1.2).toFixed(3));  // was 1.25
    },
  },
  relic_blood_covenant: {
    id: "relic_blood_covenant", name: "Blood Covenant",
    description: "Sacrifice 20% max HP. Deal +25% more damage permanently.",
    icon: "🩸", maxStacks: 1, rarity: "epic", classes: "all", isRelic: true,
    apply: (s) => {
      s.damage = Math.round(s.damage * 1.25);  // was 1.45
      s.maxHealth = Math.max(1, Math.round(s.maxHealth * 0.80));  // was 0.70
      s.currentHealth = Math.min(s.currentHealth, s.maxHealth);
    },
  },
  relic_storm_heart: {
    id: "relic_storm_heart", name: "Storm Heart",
    description: "Every 18s, lightning strikes up to 8 enemies for 1.2× your damage.",
    icon: "⚡", maxStacks: 1, rarity: "epic", classes: "all", isRelic: true,
    apply: (s) => { s.stormCallInterval = 18; },  // was 16s/10 targets/1.8×
  },
  relic_iron_oath: {
    id: "relic_iron_oath", name: "Iron Oath",
    description: "+25 armor and +20% max HP. Your dash is disabled.",
    icon: "⚙️", maxStacks: 1, rarity: "epic", classes: ["warrior"], isRelic: true,
    apply: (s) => {
      s.armor += 25; // was 40 (orig 80) — still the biggest armor pick, balanced vs 80% cap
      const bonus = Math.round(s.maxHealth * 0.20); // was 0.25 (orig 0.40)
      s.maxHealth += bonus;
      s.currentHealth = Math.min(s.currentHealth + bonus, s.maxHealth);
      s.dashCooldown = 9999;
    },
  },
};

// ─── Relic ID list ─────────────────────────────────────────────────────────────

const RELIC_IDS: UpgradeId[] = [
  "relic_soulfire", "relic_vampiric", "relic_phantom_echo", "relic_deaths_bargain",
  "relic_abyss_crown", "relic_blood_covenant", "relic_storm_heart", "relic_iron_oath",
];

// ─── Helpers ───────────────────────────────────────────────────────────────────

function shuffled<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function isClassCompatible(u: UpgradeDef, charClass: CharacterClass): boolean {
  if (u.classes === "all") return true;
  return u.classes.includes(charClass);
}

function weightedSample<T>(arr: T[], weightFn: (item: T) => number, count: number): T[] {
  if (arr.length <= count) return shuffled(arr);
  const result: T[] = [];
  const remaining = [...arr];
  for (let i = 0; i < count && remaining.length > 0; i++) {
    const totalWeight = remaining.reduce((sum, item) => sum + weightFn(item), 0);
    let roll = Math.random() * totalWeight;
    let picked = remaining.length - 1;
    for (let j = 0; j < remaining.length; j++) {
      roll -= weightFn(remaining[j]);
      if (roll <= 0) { picked = j; break; }
    }
    result.push(remaining[picked]);
    remaining.splice(picked, 1);
  }
  return result;
}

// ─── Main Selection ────────────────────────────────────────────────────────────

export function pickUpgradeChoices(
  acquired: Map<UpgradeId, number>,
  count = 3,
  level = 1,
  charClass: CharacterClass = "warrior",
): UpgradeDef[] {
  const allUpgrades = Object.values(UPGRADES) as UpgradeDef[];

  const normalPool = allUpgrades.filter((u) => {
    if (u.isRelic) return false;
    if (!isClassCompatible(u, charClass)) return false;
    return (acquired.get(u.id) ?? 0) < u.maxStacks;
  });

  const relicPool = RELIC_IDS
    .map((id) => UPGRADES[id])
    .filter((u) => {
      if (!isClassCompatible(u, charClass)) return false;
      return (acquired.get(u.id) ?? 0) < u.maxStacks;
    });

  const offerRelic = relicPool.length > 0 && (
    level % 4 === 0 ||
    (level >= 5 && Math.random() < 0.25)
  );

  // Helper: stamp currentLevel onto each choice
  const stamp = (choices: UpgradeDef[]): UpgradeDef[] =>
    choices.map((u) => ({ ...u, currentLevel: acquired.get(u.id) ?? 0 }));

  if (offerRelic) {
    const relic = shuffled(relicPool)[0];
    const normals = weightedSample(normalPool, (u) => RARITY_WEIGHT[u.rarity], count - 1);
    return stamp(shuffled([relic, ...normals]));
  }

  return stamp(weightedSample(normalPool, (u) => RARITY_WEIGHT[u.rarity], count));
}
