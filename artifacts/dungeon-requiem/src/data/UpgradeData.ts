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
  | "soul_feast"
  | "killing_blow"
  | "momentum_shift"
  // ── Warrior-only ──
  | "cleave_start"
  | "blood_momentum"
  | "earthbreaker"
  | "iron_reprisal"
  | "war_cry"
  | "bloodforge"
  | "weakening_blows"
  | "concussive_charge"
  | "executioners_wrath"
  | "berserkers_mark"
  | "titans_grip"
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
  | "arcane_surge"
  | "convergence"
  | "leyline_anchor"
  | "unstable_core"
  // ── Rogue-only ──
  | "shadow_step"
  | "venom_stack"
  | "crit_cascade"
  | "phantom_blades"
  | "evasion_matrix"
  | "extra_daggers"
  | "toxic_dash"
  | "deep_wounds"
  | "marked_for_death"
  | "deaths_momentum"
  | "cloak_and_dagger"
  | "ricochet"
  | "predators_instinct"
  // ── Necromancer-only ──
  | "grave_robber"
  | "bone_shards"
  | "dark_vigor"
  | "undying_legion"
  | "haunting_presence"
  | "soul_harvest"
  | "relentless_dead"
  | "necrotic_edge"
  | "dark_communion"
  | "army_of_darkness"
  | "lichs_bargain"
  | "death_coil"
  // ── Bard-only ──
  | "bard_sustain"
  | "bard_clear_voice"
  | "bard_long_reach"
  | "bard_sharp_ears"
  | "bard_opening_act"
  | "bard_vital_song"
  | "bard_distant_melody"
  | "bard_amplifier"
  | "bard_lingering_confuse"
  | "bard_staccato"
  | "bard_resonance"
  | "bard_harmony"
  | "bard_maestro"
  | "bard_crescendo"
  | "bard_symphony"
  | "bard_grand_finale"
  | "bard_rhapsody"
  // ── Relics ──
  | "relic_soulfire"
  | "relic_vampiric"
  | "relic_phantom_echo"
  | "relic_deaths_bargain"
  | "relic_abyss_crown"
  | "relic_blood_covenant"
  | "relic_iron_oath"
  | "relic_convergence_blade";

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
  critDamageMultiplier: number;  // multiplier applied to crit damage (default 1.85)
  overhealShieldPct: number;     // 0 = none. 0.20 = heals can overflow to 120% maxHp
  hpDrainPerSec: number;         // 0 = none. continuous HP loss; can kill the player
  healingReceivedMult: number;   // 1.0 = normal. 1.25 = +25% all healing received
  momentumShiftEnabled: boolean; // crits grant +4% move speed for 2s, stacks 5x
  // ── Relic fields ───────────────────────────────────────────────────────────
  soulfireChance: number;
  phantomEchoEvery: number;
  deathBargainActive: number;
  incomingDamageMult: number;
  // ── Warrior-specific ───────────────────────────────────────────────────────
  bloodMomentumPerHit: number;   // stacking damage % per hit (0 = off)
  earthbreakerEnabled: boolean;  // every 5th hit AoE slam
  ironReprisalEnabled: boolean;  // shockwave on damage taken
  warCryDmgBonus: number;        // % bonus damage for 5s after dash (baseline)
  bloodforgeMaxHpPerKill: number; // +0.2 max HP per kill, capped at +30
  weakeningBlowsPct: number;     // % damage reduction applied per melee hit on enemies
  dashKnockbackForce: number;    // knockback distance on dash (baseline, upgradeable)
  executionersWrathEnabled: boolean; // crits deal 40% AoE around target
  berserkersMarkEnabled: boolean;    // below 40% HP: burst crit dmg + atk speed
  titansGripEnabled: boolean;        // -20% atk speed, +35% dmg, +2 knockback
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
  arcaneSurgeBlinkCdr: number;   // blink CD reduction on crit (seconds)
  convergenceEnabled: boolean;   // same-target escalating damage
  leylineAnchorEnabled: boolean; // standing still creates crit/speed zone
  unstableCoreEnabled: boolean;  // post-blink empowered attack
  // ── Rogue-specific ─────────────────────────────────────────────────────────
  dashResetOnKill: boolean;      // dash cd resets on kill
  venomStackDps: number;         // poison damage per second per stack
  critCascadeEnabled: boolean;   // crits boost crit chance temporarily
  phantomBladesEnabled: boolean; // extra spectral daggers
  evasionMatrixEnabled: boolean; // dodge → invis + crit
  rogueExtraDaggers: number;     // additional daggers per attack
  toxicDashStacks: number;       // poison stacks applied by dash (baseline 1)
  toxicDashPuddle: boolean;      // dash leaves a toxic puddle at origin
  deepWoundsMultiplier: number;  // multiplier on poison duration/damage
  markedForDeathEnabled: boolean; // first hit marks, subsequent hits deal bonus
  deathsMomentumEnabled: boolean; // chain-kills stack crit damage
  cloakAndDaggerEnabled: boolean; // stealth burst after 1.5s no attack
  ricochetBounces: number;        // daggers bounce to N enemies for 50% dmg
  predatorsInstinctEnabled: boolean; // +40% crit dmg vs enemies below 30% HP
  convergenceBladeEnabled: boolean;  // merge all daggers into single mega-projectile
  // ── Necromancer-specific ────────────────────────────────────────────────────
  necroRaiseChance: number;          // on-kill chance to raise skeletal mage (0.30 base)
  necroMinionCap: number;            // max simultaneous skeletal mages (3 base)
  necroMinionHp: number;             // per-minion HP pool (30 base)
  necroMinionDamage: number;         // bone projectile damage per shot (4 base)
  necroMinionFireRate: number;       // seconds between bone shots (1.5 base)
  necroDeathSurgeDamageMult: number; // multiplier on Death Surge burst damage (1.0 base)
  necroSoulHarvestHeal: number;      // HP healed when a minion-killed enemy dies (0 base)
  necroRelentlessDeadDmg: number;    // damage dealt by minion death explosion (0 base)
  necroNecroticEdge: boolean;        // scythe hits apply 1 poison stack
  necroArmyOfDarkness: boolean;      // minion cap → 5
  necroLichsBargain: boolean;        // raise chance → 60% but costs 5 HP
  necroDeathCoil: boolean;           // Death Surge kills can raise minions
  necroScytheArcBonus: number;       // extra arc degrees (0 base)
  necroScytheDamageBonus: number;    // flat bonus scythe damage (0 base)
  necroMinionHpBonus: number;        // flat bonus minion HP (0 base)
  necroMinionDamageBonus: number;    // flat bonus bone projectile damage (0 base)
  // ── Bard-specific ──────────────────────────────────────────────────────────
  bardConfuseChance: number;         // 0.10 base
  bardConfuseDuration: number;       // 5s base
  bardConfuseCap: number;            // 2 base
  bardMaxRange: number;              // 60 base
  bardFalloff1: number;              // 1.00 (0-15u)
  bardFalloff2: number;              // 0.75 (15-30u)
  bardFalloff3: number;              // 0.50 (30-45u)
  bardFalloff4: number;              // 0.25 (45-60u)
  bardDissonancePct: number;         // 0 base — damage amp per stack (Vital Song)
  bardDissonanceMaxStacks: number;   // 8
  bardPierceCount: number;           // 0 base (Resonance: 3)
  bardStaccatoEnabled: boolean;      // every 3rd shot fires 3-note spread
  bardGrandFinaleEnabled: boolean;   // every 10th shot = 5× damage, no falloff
  bardRhapsodyEnabled: boolean;      // continuous-fire damage ramp
  bardSymphonyEnabled: boolean;      // confused enemies deal +100% dmg, take +30% dmg
  bardDamageBonus: number;           // flat bonus from upgrades
  bardAtkSpeedBonus: number;         // additive attack speed bonus
  bardRangeBonus: number;            // additive max range bonus
  bardHpBonus: number;               // flat HP bonus
  // ── Gear proc stat fields ──────────────────────────────────────────────────
  critDamageBonus: number;        // gear (+% crit damage), additive to critDamageMultiplier
  poisonDamageBonus: number;      // gear (+% poison damage), additive bonus to poison DPS
  lowHpDamageBonus: number;       // gear (Berserker Sigil), damage bonus when <50% HP
  maxPoisonStacksBonus: number;   // gear (Serpent's Fang) increases poison stack cap by N
  serpentsFangChance: number;     // gear (Serpent's Fang) extra-poison-stack chance per hit
  blinkCdrPct: number;            // gear (Voidstaff) dash/blink cooldown reduction 0..1
  bloodMomentumGainMult: number;  // gear (Bloodfury Axe) multiplies momentum stack gain rate
  postDashSpeedBonus: number;     // gear (Boots of Speed) post-dash move speed bonus (fraction)
  postDashSpeedDuration: number;  // gear (Boots of Speed) duration of the buff
  postDashSpeedCd: number;        // gear (Boots of Speed) cooldown between triggers
  arcSlashDamagePct: number;      // gear (Arc Warblade) arc slash damage as fraction of base
  arcSlashInterval: number;       // gear (Arc Warblade) seconds between arc slashes
  phantomWrapEnabled: boolean;    // gear (Phantom Wrap) on-damage intangible proc
  phantomWrapCd: number;          // gear (Phantom Wrap) cooldown
  phantomWrapDuration: number;    // gear (Phantom Wrap) i-frame duration
  glacialRobeEnabled: boolean;    // gear (Glacial Robe) on-damage slow + amp
  glacialRobeCd: number;          // gear (Glacial Robe) cooldown
  plagueDaggerEnabled: boolean;   // gear (Plague Dagger) kill spawns poison puddle
  orbitalStaffEnabled: boolean;   // gear (Orbital Staff) adds orbiting damage orbs
  ricochetOrbEnabled: boolean;    // gear (Ricochet Orb) mage orbs ricochet off walls
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
    critDamageMultiplier: 1.85,
    overhealShieldPct: 0,
    hpDrainPerSec: 0,
    healingReceivedMult: 1.0,
    momentumShiftEnabled: false,
    soulfireChance: 0,
    phantomEchoEvery: 0,
    deathBargainActive: 0,
    incomingDamageMult: 1.0,
    // Warrior
    bloodMomentumPerHit: 0,
    earthbreakerEnabled: false,
    ironReprisalEnabled: false,
    warCryDmgBonus: 0.15,        // baseline: +15% damage for 4s after dash
    bloodforgeMaxHpPerKill: 0,
    weakeningBlowsPct: 0,
    dashKnockbackForce: 3,        // baseline knockback on dash
    executionersWrathEnabled: false,
    berserkersMarkEnabled: false,
    titansGripEnabled: false,
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
    arcaneSurgeBlinkCdr: 0,
    convergenceEnabled: false,
    leylineAnchorEnabled: false,
    unstableCoreEnabled: false,
    // Rogue
    dashResetOnKill: false,
    venomStackDps: 0,
    critCascadeEnabled: false,
    phantomBladesEnabled: false,
    evasionMatrixEnabled: false,
    rogueExtraDaggers: 0,
    toxicDashStacks: 1,            // baseline: 1 poison stack on dash
    toxicDashPuddle: false,
    deepWoundsMultiplier: 1.0,
    markedForDeathEnabled: false,
    deathsMomentumEnabled: false,
    cloakAndDaggerEnabled: false,
    ricochetBounces: 0,
    predatorsInstinctEnabled: false,
    convergenceBladeEnabled: false,
    // Necromancer
    necroRaiseChance: 0.30,
    necroMinionCap: 3,
    necroMinionHp: 30,
    necroMinionDamage: 6,
    necroMinionFireRate: 1.0,
    necroDeathSurgeDamageMult: 1.0,
    necroSoulHarvestHeal: 0,
    necroRelentlessDeadDmg: 0,
    necroNecroticEdge: false,
    necroArmyOfDarkness: false,
    necroLichsBargain: false,
    necroDeathCoil: false,
    necroScytheArcBonus: 0,
    necroScytheDamageBonus: 0,
    necroMinionHpBonus: 0,
    necroMinionDamageBonus: 0,
    // Bard
    bardConfuseChance: 0.10,
    bardConfuseDuration: 5,
    bardConfuseCap: 2,
    bardMaxRange: 60,
    bardFalloff1: 1.00,
    bardFalloff2: 0.75,
    bardFalloff3: 0.50,
    bardFalloff4: 0.25,
    bardDissonancePct: 0,
    bardDissonanceMaxStacks: 8,
    bardPierceCount: 0,
    bardStaccatoEnabled: false,
    bardGrandFinaleEnabled: false,
    bardRhapsodyEnabled: false,
    bardSymphonyEnabled: false,
    bardDamageBonus: 0,
    bardAtkSpeedBonus: 0,
    bardRangeBonus: 0,
    bardHpBonus: 0,
    // Gear proc defaults (neutral — no equipped gear)
    critDamageBonus: 0,
    poisonDamageBonus: 0,
    lowHpDamageBonus: 0,
    maxPoisonStacksBonus: 0,
    serpentsFangChance: 0,
    blinkCdrPct: 0,
    bloodMomentumGainMult: 1,
    postDashSpeedBonus: 0,
    postDashSpeedDuration: 0,
    postDashSpeedCd: 0,
    arcSlashDamagePct: 0,
    arcSlashInterval: 0,
    phantomWrapEnabled: false,
    phantomWrapCd: 0,
    phantomWrapDuration: 0,
    glacialRobeEnabled: false,
    glacialRobeCd: 0,
    plagueDaggerEnabled: false,
    orbitalStaffEnabled: false,
    ricochetOrbEnabled: false,
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
    description: "+10% attack speed",
    icon: "🌪️", maxStacks: 6, rarity: "common", classes: "all",
    apply: (s) => { s.attackSpeed = parseFloat((s.attackSpeed * 1.10).toFixed(3)); },
  },
  max_health_boost: {
    id: "max_health_boost", name: "Iron Constitution",
    description: "+20 max health and heal 20 HP",
    icon: "❤️", maxStacks: 5, rarity: "common", classes: "all",
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
    description: "+6% move speed and -8% dash cooldown",
    icon: "💨", maxStacks: 5, rarity: "common", classes: "all",
    apply: (s) => {
      s.moveSpeed = parseFloat((s.moveSpeed * 1.06).toFixed(3));
      s.dashCooldown = parseFloat((s.dashCooldown * 0.92).toFixed(2));
    },
  },
  lifesteal_start: {
    id: "lifesteal_start", name: "Blood Price",
    description: "+25% all healing received, +1% lifesteal",
    icon: "🩸", maxStacks: 1, rarity: "rare", classes: "all",
    apply: (s) => { s.healingReceivedMult += 0.25; s.lifesteal += 0.01; },
  },
  lifesteal_boost: {
    id: "lifesteal_boost", name: "Bloodlord",
    description: "+2% lifesteal",
    icon: "🩸", maxStacks: 5, rarity: "common", classes: "all",
    apply: (s) => { s.lifesteal += 0.02; }, // was 0.04 — max stack gave +20% alone
  },
  double_strike: {
    id: "double_strike", name: "Twin Fang",
    description: "+15% chance to strike twice",
    icon: "⚡", maxStacks: 2, rarity: "rare", classes: "all",
    apply: (s) => { s.doubleStrikeChance += 0.15; },
  },
  armor_boost: {
    id: "armor_boost", name: "Tempered Plate",
    description: "+3 armor (reduces incoming damage)",
    icon: "🛡️", maxStacks: 6, rarity: "common", classes: "all",
    apply: (s) => { s.armor += 3; },
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
    description: "+20% XP from all sources",
    icon: "📖", maxStacks: 2, rarity: "common", classes: "all",
    apply: (s) => { s.xpMultiplier = parseFloat((s.xpMultiplier * 1.20).toFixed(3)); },
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
  soul_feast: {
    id: "soul_feast", name: "Soul Feast",
    description: "Heal 2 HP on every kill",
    icon: "👻", maxStacks: 5, rarity: "common", classes: "all",
    apply: (s) => { s.onKillHeal += 2; },
  },
  killing_blow: {
    id: "killing_blow", name: "Killing Blow",
    description: "+12% crit damage per stack.",
    icon: "💀", maxStacks: 3, rarity: "rare", classes: "all",
    apply: (s) => { s.critDamageMultiplier += 0.12; },
  },
  momentum_shift: {
    id: "momentum_shift", name: "Momentum Shift",
    description: "Crits grant +4% move speed for 2s, stacks up to 5 times.",
    icon: "💨", maxStacks: 1, rarity: "rare", classes: "all",
    apply: (s) => { s.momentumShiftEnabled = true; },
  },
  // ════════════════════════════════════════════════════════════════════════════
  // WARRIOR-ONLY — melee is hard mode, so these are slightly stronger
  // ════════════════════════════════════════════════════════════════════════════
  cleave_start: {
    id: "cleave_start", name: "Wide Swing",
    description: "Attacks cleave. Rank 1: 60° arc. Ranks 2-5: +75° each (360° at rank 5).",
    icon: "🪓", maxStacks: 5, rarity: "rare", classes: ["warrior"],
    apply: (s) => {
      if (s.cleaveChance < 1) {
        // Rank 1 — enable cleave with 60° base arc
        s.cleaveChance = 1;
        s.attackArc += 60;
      } else {
        // Ranks 2-5: +75° each → 60+75+75+75+75 = 360° cap
        s.attackArc += 75;
      }
    },
  },
  blood_momentum: {
    id: "blood_momentum", name: "Blood Momentum",
    description: "Each consecutive hit increases damage by +3% (max 30%). Resets after 3s.",
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
  war_cry: {
    id: "war_cry", name: "Battle Roar",
    description: "War Cry damage bonus increased to +35% for 6 seconds.",
    icon: "📯", maxStacks: 1, rarity: "rare", classes: ["warrior"],
    apply: (s) => { s.warCryDmgBonus = 0.35; },  // upgrades baseline 0.15 → 0.35
  },
  bloodforge: {
    id: "bloodforge", name: "Bloodforge",
    description: "Each kill grants +0.2 max HP (capped at +30).",
    icon: "🩸", maxStacks: 1, rarity: "rare", classes: ["warrior"],
    apply: (s) => { s.bloodforgeMaxHpPerKill = 1; },
  },
  weakening_blows: {
    id: "weakening_blows", name: "Weakening Blows",
    description: "Melee hits reduce enemy damage by 4% and grant +4% crit damage per stack.",
    icon: "💀", maxStacks: 3, rarity: "rare", classes: ["warrior"],
    apply: (s) => { s.weakeningBlowsPct += 0.04; s.critDamageMultiplier += 0.04; },
  },
  concussive_charge: {
    id: "concussive_charge", name: "Concussive Charge",
    description: "Dash knockback distance +50%. Knocked enemies take damage.",
    icon: "💥", maxStacks: 2, rarity: "rare", classes: ["warrior"],
    apply: (s) => { s.dashKnockbackForce += 2; },
  },
  executioners_wrath: {
    id: "executioners_wrath", name: "Executioner's Wrath",
    description: "Crits deal an additional hit for 40% of crit damage in a small AoE around the target.",
    icon: "🪓", maxStacks: 1, rarity: "epic", classes: ["warrior"],
    apply: (s) => { s.executionersWrathEnabled = true; },
  },
  berserkers_mark: {
    id: "berserkers_mark", name: "Berserker's Mark",
    description: "Below 40% HP: +30% crit damage and +15% attack speed for 6s. 20s cooldown.",
    icon: "🔴", maxStacks: 1, rarity: "rare", classes: ["warrior"],
    apply: (s) => { s.berserkersMarkEnabled = true; },
  },
  titans_grip: {
    id: "titans_grip", name: "Titan's Grip",
    description: "Attack speed -20%, but each hit deals +35% damage and +2 knockback.",
    icon: "🦾", maxStacks: 1, rarity: "rare", classes: ["warrior"],
    apply: (s) => {
      s.titansGripEnabled = true;
      s.attackSpeed = parseFloat((s.attackSpeed * 0.80).toFixed(3));
      s.damage = Math.round(s.damage * 1.35);
      s.dashKnockbackForce += 2;
    },
  },

  // ════════════════════════════════════════════════════════════════════════════
  // MAGE-ONLY — pierce, extra orbs, control
  // ════════════════════════════════════════════════════════════════════════════
  chain_lightning: {
    id: "chain_lightning", name: "Chain Lightning",
    description: "Projectile hits bounce to 2 nearby enemies for 55% damage.",
    icon: "⚡", maxStacks: 2, rarity: "rare", classes: ["mage"],
    apply: (s) => { s.chainLightningBounces += 2; },
  },
  spell_echo: {
    id: "spell_echo", name: "Spell Echo",
    description: "+20% chance to double-cast your projectile.",
    icon: "🔮", maxStacks: 2, rarity: "rare", classes: ["mage"],
    apply: (s) => { s.spellEchoChance = parseFloat((s.spellEchoChance + 0.20).toFixed(3)); },
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
    description: "When orbs reach max range, they explode for 60% base damage in an AoE instead of disappearing.",
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
    description: "Orbs leave a damaging trail that persists for 2s, dealing 8% base damage/sec.",
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
    description: "+20% orb size.",
    icon: "🔵", maxStacks: 3, rarity: "common", classes: ["mage"],
    apply: (s) => { s.projectileRadiusBonus += 0.11; },
  },
  split_bolt: {
    id: "split_bolt", name: "Split Bolt",
    description: "Each orb splits into 3 mini-orbs on fire. Mini-orbs deal 35% damage and spread in a cone.",
    icon: "🔀", maxStacks: 1, rarity: "rare", classes: ["mage"],
    apply: (s) => { s.splitBoltActive = true; },
  },
  arcane_surge: {
    id: "arcane_surge", name: "Arcane Surge",
    description: "+15% crit damage. Crits reduce blink cooldown by 0.5s.",
    icon: "⚡", maxStacks: 3, rarity: "rare", classes: ["mage"],
    apply: (s) => { s.critDamageMultiplier += 0.15; s.arcaneSurgeBlinkCdr += 0.5; },
  },
  convergence: {
    id: "convergence", name: "Convergence",
    description: "Orbs hitting the same enemy within 0.5s escalate: +25% on 2nd, +50% on 3rd, +75% on 4th.",
    icon: "🎯", maxStacks: 1, rarity: "epic", classes: ["mage"],
    apply: (s) => { s.convergenceEnabled = true; },
  },
  leyline_anchor: {
    id: "leyline_anchor", name: "Leyline Anchor",
    description: "Stand still 1.5s to create a zone: +25% crit damage, +20% projectile speed. Lasts 4s after leaving.",
    icon: "🔮", maxStacks: 1, rarity: "rare", classes: ["mage"],
    apply: (s) => { s.leylineAnchorEnabled = true; },
  },
  unstable_core: {
    id: "unstable_core", name: "Unstable Core",
    description: "After blink, next orb attack within 2s deals +60% damage and +40% crit damage.",
    icon: "💥", maxStacks: 1, rarity: "epic", classes: ["mage"],
    apply: (s) => { s.unstableCoreEnabled = true; },
  },

  // ════════════════════════════════════════════════════════════════════════════
  // ROGUE-ONLY — speed, crits, poison, extra daggers
  // ════════════════════════════════════════════════════════════════════════════
  shadow_step: {
    id: "shadow_step", name: "Shadow Step",
    description: "Dash cooldown resets on kill (minimum 0.3s cooldown floor).",
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
    description: "Critical hits boost crit chance by +12% for 3s. Non-refreshing.",
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
  extra_daggers: {
    id: "extra_daggers", name: "Fan of Knives",
    description: "Fire +1 additional dagger per attack.",
    icon: "🔪", maxStacks: 2, rarity: "rare", classes: ["rogue"],
    apply: (s) => { s.rogueExtraDaggers += 1; },
  },
  toxic_dash: {
    id: "toxic_dash", name: "Toxic Dash",
    description: "Dash leaves a toxic puddle at your starting position. Lasts 3s, applies 1 poison stack/sec.",
    icon: "☠️", maxStacks: 1, rarity: "rare", classes: ["rogue"],
    apply: (s) => { s.toxicDashPuddle = true; },
  },
  deep_wounds: {
    id: "deep_wounds", name: "Deep Wounds",
    description: "Poison damage and duration increased by 50%.",
    icon: "🧪", maxStacks: 1, rarity: "rare", classes: ["rogue"],
    apply: (s) => { s.deepWoundsMultiplier += 0.5; },
  },
  marked_for_death: {
    id: "marked_for_death", name: "Marked for Death",
    description: "First hit marks enemies for 4s. Subsequent hits deal +20% damage and +20% crit damage.",
    icon: "🎯", maxStacks: 1, rarity: "rare", classes: ["rogue"],
    apply: (s) => { s.markedForDeathEnabled = true; },
  },
  deaths_momentum: {
    id: "deaths_momentum", name: "Death's Momentum",
    description: "Kills within 3s of each other grant +8% crit damage, stacking 5 times (40% total). Resets after 3s.",
    icon: "💀", maxStacks: 1, rarity: "epic", classes: ["rogue"],
    apply: (s) => { s.deathsMomentumEnabled = true; },
  },
  cloak_and_dagger: {
    id: "cloak_and_dagger", name: "Cloak and Dagger",
    description: "After 1.5s without attacking, next attack deals +50% damage and +100% crit damage. 3s cooldown.",
    icon: "🗡️", maxStacks: 1, rarity: "rare", classes: ["rogue"],
    apply: (s) => { s.cloakAndDaggerEnabled = true; },
  },
  ricochet: {
    id: "ricochet", name: "Ricochet",
    description: "Daggers bounce to 1 nearby enemy for 50% damage. At 2 stacks, bounces to 2 enemies.",
    icon: "↩️", maxStacks: 2, rarity: "rare", classes: ["rogue"],
    apply: (s) => { s.ricochetBounces += 1; },
  },
  predators_instinct: {
    id: "predators_instinct", name: "Predator's Instinct",
    description: "Enemies below 30% HP take +40% crit damage from you.",
    icon: "🦅", maxStacks: 1, rarity: "rare", classes: ["rogue"],
    apply: (s) => { s.predatorsInstinctEnabled = true; },
  },

  // ════════════════════════════════════════════════════════════════════════════
  // NECROMANCER-ONLY
  // ════════════════════════════════════════════════════════════════════════════

  // ── Tier 1 — Common ──
  grave_robber: {
    id: "grave_robber", name: "Grave Robber",
    description: "Raise chance +10% (30% → 40%).",
    icon: "⚱", maxStacks: 3, rarity: "common", classes: ["necromancer"],
    apply: (s) => { s.necroRaiseChance += 0.10; },
  },
  bone_shards: {
    id: "bone_shards", name: "Bone Shards",
    description: "Minion bone projectile damage +2.",
    icon: "🦴", maxStacks: 5, rarity: "common", classes: ["necromancer"],
    apply: (s) => { s.necroMinionDamageBonus += 2; },
  },
  dark_vigor: {
    id: "dark_vigor", name: "Dark Vigor",
    description: "Scythe damage +3.",
    icon: "💀", maxStacks: 5, rarity: "common", classes: ["necromancer"],
    apply: (s) => { s.necroScytheDamageBonus += 3; },
  },
  undying_legion: {
    id: "undying_legion", name: "Undying Legion",
    description: "Minion HP +15.",
    icon: "🛡", maxStacks: 5, rarity: "common", classes: ["necromancer"],
    apply: (s) => { s.necroMinionHpBonus += 15; },
  },
  haunting_presence: {
    id: "haunting_presence", name: "Haunting Presence",
    description: "Scythe arc width +15 degrees.",
    icon: "👻", maxStacks: 3, rarity: "common", classes: ["necromancer"],
    apply: (s) => { s.necroScytheArcBonus += 15; },
  },

  // ── Tier 2 — Rare ──
  soul_harvest: {
    id: "soul_harvest", name: "Soul Harvest",
    description: "Killing a minion-killed enemy heals Necromancer for 8 HP.",
    icon: "💚", maxStacks: 1, rarity: "rare", classes: ["necromancer"],
    apply: (s) => { s.necroSoulHarvestHeal = 8; },
  },
  relentless_dead: {
    id: "relentless_dead", name: "Relentless Dead",
    description: "When a minion dies it explodes dealing 10 damage to nearby enemies.",
    icon: "💥", maxStacks: 3, rarity: "rare", classes: ["necromancer"],
    apply: (s) => { s.necroRelentlessDeadDmg += 10; },
  },
  necrotic_edge: {
    id: "necrotic_edge", name: "Necrotic Edge",
    description: "Scythe hits apply 1 poison stack.",
    icon: "☠", maxStacks: 1, rarity: "rare", classes: ["necromancer"],
    apply: (s) => { s.necroNecroticEdge = true; },
  },
  dark_communion: {
    id: "dark_communion", name: "Dark Communion",
    description: "Death Surge damage +25% per minion sacrificed.",
    icon: "🌑", maxStacks: 3, rarity: "rare", classes: ["necromancer"],
    apply: (s) => { s.necroDeathSurgeDamageMult += 0.25; },
  },

  // ── Tier 3 — Epic ──
  army_of_darkness: {
    id: "army_of_darkness", name: "Army of Darkness",
    description: "Minion cap increases from 3 to 5.",
    icon: "⚔", maxStacks: 1, rarity: "epic", classes: ["necromancer"],
    apply: (s) => { s.necroArmyOfDarkness = true; },
  },
  lichs_bargain: {
    id: "lichs_bargain", name: "Lich's Bargain",
    description: "Raise chance becomes 60% but each raise costs 5 HP.",
    icon: "📜", maxStacks: 1, rarity: "epic", classes: ["necromancer"],
    apply: (s) => { s.necroLichsBargain = true; },
  },
  death_coil: {
    id: "death_coil", name: "Death Coil",
    description: "Death Surge kills also raise 1 skeletal mage from each slain enemy.",
    icon: "🔮", maxStacks: 1, rarity: "epic", classes: ["necromancer"],
    apply: (s) => { s.necroDeathCoil = true; },
  },

  // ════════════════════════════════════════════════════════════════════════════
  // BARD-ONLY
  // ════════════════════════════════════════════════════════════════════════════

  // ── Tier 1 — Common ──
  bard_sustain: {
    id: "bard_sustain", name: "Sustain",
    description: "Attack speed +20%.",
    icon: "🎵", maxStacks: 3, rarity: "common", classes: ["bard"],
    apply: (s) => { s.bardAtkSpeedBonus += 0.70; },
  },
  bard_clear_voice: {
    id: "bard_clear_voice", name: "Clear Voice",
    description: "Damage +6.",
    icon: "🔊", maxStacks: 5, rarity: "common", classes: ["bard"],
    apply: (s) => { s.bardDamageBonus += 6; },
  },
  bard_long_reach: {
    id: "bard_long_reach", name: "Long Reach",
    description: "Max range +15 units.",
    icon: "📏", maxStacks: 3, rarity: "common", classes: ["bard"],
    apply: (s) => { s.bardRangeBonus += 15; },
  },
  bard_sharp_ears: {
    id: "bard_sharp_ears", name: "Sharp Ears",
    description: "Confuse chance +10%.",
    icon: "👂", maxStacks: 3, rarity: "common", classes: ["bard"],
    apply: (s) => { s.bardConfuseChance += 0.10; },
  },
  bard_opening_act: {
    id: "bard_opening_act", name: "Opening Act",
    description: "HP +25.",
    icon: "🎭", maxStacks: 5, rarity: "common", classes: ["bard"],
    apply: (s) => { s.bardHpBonus += 25; s.maxHealth += 25; s.currentHealth += 25; },
  },

  // ── Tier 2 — Rare ──
  bard_vital_song: {
    id: "bard_vital_song", name: "Vital Song",
    description: "Notes apply Dissonance: 3% damage taken per stack, max 8 (24% amp). Falls off after 3s.",
    icon: "💀", maxStacks: 1, rarity: "rare", classes: ["bard"],
    apply: (s) => { s.bardDissonancePct = 0.03; },
  },
  bard_distant_melody: {
    id: "bard_distant_melody", name: "Distant Melody",
    description: "Damage falloff reduced: 75%→90%, 50%→80%, 25%→65%.",
    icon: "🌙", maxStacks: 1, rarity: "rare", classes: ["bard"],
    apply: (s) => { s.bardFalloff2 = 0.90; s.bardFalloff3 = 0.80; s.bardFalloff4 = 0.65; },
  },
  bard_amplifier: {
    id: "bard_amplifier", name: "Amplifier",
    description: "Max range +25 units (60→85).",
    icon: "📡", maxStacks: 1, rarity: "rare", classes: ["bard"],
    apply: (s) => { s.bardRangeBonus += 25; },
  },
  bard_lingering_confuse: {
    id: "bard_lingering_confuse", name: "Lingering Confuse",
    description: "Confuse duration +5s, max confused +1 (total 3).",
    icon: "🌀", maxStacks: 1, rarity: "rare", classes: ["bard"],
    apply: (s) => { s.bardConfuseDuration += 5; s.bardConfuseCap += 1; },
  },
  bard_staccato: {
    id: "bard_staccato", name: "Staccato",
    description: "Every 3rd shot fires 7 notes in a wider scale cluster (2 extra at 10u and 11u offsets).",
    icon: "⚡", maxStacks: 1, rarity: "rare", classes: ["bard"],
    apply: (s) => { s.bardStaccatoEnabled = true; },
  },
  bard_resonance: {
    id: "bard_resonance", name: "Resonance",
    description: "Notes pierce through enemies infinitely — no pierce limit.",
    icon: "🔔", maxStacks: 1, rarity: "rare", classes: ["bard"],
    apply: (s) => { s.bardPierceCount = 999; },
  },
  bard_harmony: {
    id: "bard_harmony", name: "Harmony",
    description: "Crit chance +15%, crit damage +50%.",
    icon: "🎶", maxStacks: 1, rarity: "rare", classes: ["bard"],
    apply: (s) => { s.critChance += 0.15; s.critDamageMultiplier += 0.50; },
  },

  // ── Tier 3 — Epic ──
  bard_maestro: {
    id: "bard_maestro", name: "Maestro",
    description: "Confuse chance tripled (10%→30%).",
    icon: "🎩", maxStacks: 1, rarity: "epic", classes: ["bard"],
    apply: (s) => { s.bardConfuseChance *= 3; },
  },
  bard_crescendo: {
    id: "bard_crescendo", name: "Crescendo",
    description: "Attack speed +75%, damage +40%.",
    icon: "📈", maxStacks: 1, rarity: "epic", classes: ["bard"],
    apply: (s) => { s.bardAtkSpeedBonus += 1.125; s.bardDamageBonus += Math.round(20 * 0.4); },
  },
  bard_symphony: {
    id: "bard_symphony", name: "Symphony of Chaos",
    description: "Confused enemies deal +100% damage to other enemies AND take +30% from all sources.",
    icon: "🌪", maxStacks: 1, rarity: "epic", classes: ["bard"],
    apply: (s) => { s.bardSymphonyEnabled = true; },
  },
  bard_grand_finale: {
    id: "bard_grand_finale", name: "Grand Finale",
    description: "Every 10th shot fires a massive note dealing 5× damage with no falloff.",
    icon: "💥", maxStacks: 1, rarity: "epic", classes: ["bard"],
    apply: (s) => { s.bardGrandFinaleEnabled = true; },
  },
  bard_rhapsody: {
    id: "bard_rhapsody", name: "Rhapsody",
    description: "After 3s of continuous attacking, damage ramps +10%/sec (capped at +100%).",
    icon: "🔥", maxStacks: 1, rarity: "epic", classes: ["bard"],
    apply: (s) => { s.bardRhapsodyEnabled = true; },
  },

  // ════════════════════════════════════════════════════════════════════════════
  // RELICS — TONED DOWN from original values
  // ════════════════════════════════════════════════════════════════════════════
  relic_soulfire: {
    id: "relic_soulfire", name: "Soulfire Blade",
    description: "Kills have a 20% chance to explode, dealing 1.0× your damage nearby.",
    icon: "🔥", maxStacks: 1, rarity: "epic", classes: "all", isRelic: true,
    apply: (s) => { s.soulfireChance = 0.20; },
  },
  relic_vampiric: {
    id: "relic_vampiric", name: "Vampiric Shroud",
    description: "+2% lifesteal. Heals overflow to 120% max HP. Lose 6 HP/sec — kill or die.",
    icon: "🧛", maxStacks: 1, rarity: "epic", classes: "all", isRelic: true,
    apply: (s) => { s.lifesteal += 0.02; s.overhealShieldPct = 0.20; s.hpDrainPerSec = 6; },
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
    description: "+35% XP gain. Cursed: you take 15% more damage.",
    icon: "👑", maxStacks: 1, rarity: "epic", classes: "all", isRelic: true,
    apply: (s) => {
      s.xpMultiplier = parseFloat((s.xpMultiplier * 1.35).toFixed(3));
      s.incomingDamageMult = parseFloat((s.incomingDamageMult * 1.15).toFixed(3));
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
  relic_iron_oath: {
    id: "relic_iron_oath", name: "Iron Oath",
    description: "+10 armor and +10% max HP. Dash cooldown tripled.",
    icon: "⚙️", maxStacks: 1, rarity: "epic", classes: ["warrior"], isRelic: true,
    apply: (s) => {
      s.armor += 10;
      const bonus = Math.round(s.maxHealth * 0.10);
      s.maxHealth += bonus;
      s.currentHealth = Math.min(s.currentHealth + bonus, s.maxHealth);
      s.dashCooldown *= 3;
    },
  },
  relic_convergence_blade: {
    id: "relic_convergence_blade", name: "Convergence Blade",
    description: "All daggers merge into a single piercing projectile. Combined damage, 5× wider, 40% velocity. -30% attack speed.",
    icon: "🗡️", maxStacks: 1, rarity: "epic", classes: ["rogue"], isRelic: true,
    apply: (s) => {
      s.convergenceBladeEnabled = true;
      s.attackSpeed = parseFloat((s.attackSpeed * 0.70).toFixed(3));
    },
  },
};

// ─── Relic ID list ─────────────────────────────────────────────────────────────

const RELIC_IDS: UpgradeId[] = [
  "relic_soulfire", "relic_vampiric", "relic_phantom_echo", "relic_deaths_bargain",
  "relic_abyss_crown", "relic_blood_covenant", "relic_iron_oath", "relic_convergence_blade",
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
