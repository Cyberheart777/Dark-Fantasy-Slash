/**
 * MetaUpgradeData.ts
 * Permanent (cross-run) upgrade definitions for the Soul Forge.
 *
 * 12 upgrades (was 6): HP, Damage, Move Speed, Lifesteal, Crit Chance,
 * Dash Cooldown, Armor, Attack Speed, XP Gain, Dodge, Health Regen, On-Kill Heal.
 *
 * Trial buffs are defined in metaStore.ts and applied via buildTrialModifiers().
 */

import type { PlayerStats } from "./UpgradeData";
import { flatModifiers, type StatModifier } from "./StatModifier";
import { getEarnedTrialBuffs } from "../store/metaStore";

export interface MetaUpgradeDef {
  id: string;
  name: string;
  title: string;
  icon: string;
  description: string;
  maxRanks: number;
  costs: number[];
  modifiers: (rank: number) => StatModifier[];
  statLine: (rank: number) => string;
}

export const META_UPGRADES: MetaUpgradeDef[] = [
  // ── Offense ──
  {
    id: "honed_edge",
    name: "Honed Edge",
    title: "Sharpened in Blood",
    icon: "⚔",
    description: "+2 flat damage per rank.",
    maxRanks: 10,
    costs: [120, 240, 400, 600, 850, 1150, 1500, 1900, 2400, 3000],
    modifiers: (rank) => flatModifiers({ damage: 2 * rank }, `meta:honed_edge:${rank}`),
    statLine: (r) => `+${2 * r} Damage`,
  },
  {
    id: "swift_strikes",
    name: "Swift Strikes",
    title: "Hands of the Wraith",
    icon: "🌪",
    description: "+1% attack speed per rank.",
    maxRanks: 10,
    costs: [120, 220, 340, 480, 640, 820, 1020, 1240, 1480, 1740],
    modifiers: (rank) => flatModifiers({ attackSpeed: 0.01 * rank }, `meta:swift_strikes:${rank}`),
    statLine: (r) => `+${(0.01 * r * 100).toFixed(0)}% Attack Speed`,
  },
  {
    id: "crit_damage",
    name: "Executioner's Edge",
    title: "Severance",
    icon: "🩸",
    description: "+5% critical damage per rank.",
    maxRanks: 10,
    costs: [180, 320, 500, 720, 980, 1280, 1620, 2000, 2420, 2880],
    modifiers: (rank) => flatModifiers({ critDamageMultiplier: 0.05 * rank }, `meta:crit_damage:${rank}`),
    statLine: (r) => `+${(0.05 * r * 100).toFixed(0)}% Crit Damage`,
  },
  {
    id: "executioners_reach",
    name: "Executioner's Reach",
    title: "Stretch the Blade",
    icon: "🗡",
    description: "+0.5 attack range per rank.",
    maxRanks: 4,
    costs: [400, 800, 1500, 2800],
    modifiers: (rank) => flatModifiers({ attackRange: 0.5 * rank }, `meta:exec_reach:${rank}`),
    statLine: (r) => `+${(0.5 * r).toFixed(1)} Attack Range`,
  },
  {
    id: "reapers_eye",
    name: "Reaper's Eye",
    title: "Death Sees Clearly",
    icon: "👁",
    description: "+3% crit chance per rank.",
    maxRanks: 5,
    costs: [180, 340, 540, 780, 1050],
    modifiers: (rank) => flatModifiers({ critChance: 0.03 * rank }, `meta:reapers_eye:${rank}`),
    statLine: (r) => `+${(3 * r)}% Crit Chance`,
  },

  // ── Defense ──
  {
    id: "iron_soul",
    name: "Iron Soul",
    title: "Bone & Steel",
    icon: "❤",
    description: "+10 max HP per rank.",
    maxRanks: 10,
    costs: [100, 200, 350, 550, 800, 1100, 1450, 1850, 2300, 2800],
    modifiers: (rank) => flatModifiers({ maxHealth: 10 * rank, currentHealth: 10 * rank }, `meta:iron_soul:${rank}`),
    statLine: (r) => `+${10 * r} Max HP`,
  },
  {
    id: "hardened_shell",
    name: "Hardened Shell",
    title: "Scales of the Deep",
    icon: "🛡",
    description: "+2 armor per rank.",
    maxRanks: 5,
    costs: [100, 200, 340, 520, 740],
    modifiers: (rank) => flatModifiers({ armor: 2 * rank }, `meta:hardened_shell:${rank}`),
    statLine: (r) => `+${2 * r} Armor`,
  },
  {
    id: "ghost_step",
    name: "Ghost Step",
    title: "Between the Blinks",
    icon: "🪬",
    description: "+2% dodge chance per rank.",
    maxRanks: 4,
    costs: [200, 400, 650, 950],
    modifiers: (rank) => flatModifiers({ dodgeChance: 0.02 * rank }, `meta:ghost_step:${rank}`),
    statLine: (r) => `+${2 * r}% Dodge Chance`,
  },

  // ── Sustain ──
  {
    id: "blood_pact",
    name: "Blood Pact",
    title: "Life Stolen Freely",
    icon: "🩸",
    description: "+2% lifesteal per rank.",
    maxRanks: 3,
    costs: [200, 380, 580],
    modifiers: (rank) => flatModifiers({ lifesteal: 0.02 * rank }, `meta:blood_pact:${rank}`),
    statLine: (r) => `+${(2 * r)}% Lifesteal`,
  },
  {
    id: "troll_marrow",
    name: "Troll Marrow",
    title: "Flesh Knits Itself",
    icon: "✨",
    description: "+0.5 HP regen/sec per rank.",
    maxRanks: 4,
    costs: [150, 300, 500, 750],
    modifiers: (rank) => flatModifiers({ healthRegen: 0.5 * rank }, `meta:troll_marrow:${rank}`),
    statLine: (r) => `+${(0.5 * r).toFixed(1)} HP/sec`,
  },
  {
    id: "soul_siphon",
    name: "Soul Siphon",
    title: "The Dead Feed You",
    icon: "👻",
    description: "+2 HP on kill per rank.",
    maxRanks: 4,
    costs: [130, 280, 460, 680],
    modifiers: (rank) => flatModifiers({ onKillHeal: 2 * rank }, `meta:soul_siphon:${rank}`),
    statLine: (r) => `+${2 * r} HP on Kill`,
  },

  // ── Utility ──
  {
    id: "phantom_step",
    name: "Phantom Step",
    title: "Swift as Shadow",
    icon: "💨",
    description: "+0.4 move speed per rank.",
    maxRanks: 10,
    costs: [150, 280, 450, 650, 900, 1200, 1550, 1950, 2500, 3100],
    modifiers: (rank) => flatModifiers({ moveSpeed: 0.4 * rank }, `meta:phantom_step:${rank}`),
    statLine: (r) => `+${(0.4 * r).toFixed(1)} Move Speed`,
  },
  {
    id: "dark_resilience",
    name: "Dark Resilience",
    title: "Time Bends for You",
    icon: "⚡",
    description: "-0.12s dash cooldown per rank.",
    maxRanks: 4,
    costs: [130, 260, 420, 620],
    modifiers: (rank) => flatModifiers({ dashCooldown: -0.12 * rank }, `meta:dark_resilience:${rank}`),
    statLine: (r) => `-${(0.12 * r).toFixed(2)}s Dash CD`,
  },
  {
    id: "battle_instinct",
    name: "Battle Instinct",
    title: "Honed Reflexes",
    icon: "🔥",
    description: "-5s action ability cooldown per rank.",
    maxRanks: 4,
    costs: [300, 600, 1000, 1600],
    modifiers: (rank) => flatModifiers({ actionCooldown: -5 * rank }, `meta:battle_instinct:${rank}`),
    statLine: (r) => `-${5 * r}s Action CD`,
  },
  {
    id: "scholars_tome",
    name: "Scholar's Tome",
    title: "Knowledge Compounds",
    icon: "📖",
    description: "+8% XP gain per rank.",
    maxRanks: 4,
    costs: [100, 220, 380, 580],
    modifiers: (rank) => flatModifiers({ xpMultiplier: 0.08 * rank }, `meta:scholars_tome:${rank}`),
    statLine: (r) => `+${8 * r}% XP Gain`,
  },
];

/** Map for O(1) lookup by id. */
export const META_UPGRADE_MAP = Object.fromEntries(
  META_UPGRADES.map((u) => [u.id, u]),
) as Record<string, MetaUpgradeDef>;

/**
 * Build StatModifiers from purchased Soul Forge ranks.
 */
export function buildMetaModifiers(
  purchased: Record<string, number>,
): StatModifier[] {
  const out: StatModifier[] = [];
  for (const [id, rank] of Object.entries(purchased)) {
    if (rank <= 0) continue;
    const def = META_UPGRADE_MAP[id];
    if (!def) continue;
    out.push(...def.modifiers(rank));
  }
  return out;
}

/**
 * Build StatModifiers from earned Trial of Champions buffs.
 * Call alongside buildMetaModifiers at run start.
 */
export function buildTrialModifiers(
  trialWins: Record<string, string>,
): StatModifier[] {
  const buffs = getEarnedTrialBuffs(trialWins);
  return buffs.map((b) => ({
    stat: b.stat as keyof PlayerStats,
    layer: "flat" as const,
    value: b.value,
    source: `trial:${b.class}:${b.difficulty}`,
  }));
}

export function totalCost(def: MetaUpgradeDef): number {
  return def.costs.reduce((a, b) => a + b, 0);
}

export function nextRankCost(def: MetaUpgradeDef, currentRank: number): number {
  if (currentRank >= def.maxRanks) return 0;
  return def.costs[currentRank];
}

export function nextRankLine(def: MetaUpgradeDef, currentRank: number): string {
  if (currentRank >= def.maxRanks) return "MAXED";
  return def.statLine(currentRank + 1);
}

export const PCT_STATS = new Set<keyof PlayerStats>(["critChance", "lifesteal", "dodgeChance", "cleaveChance", "doubleStrikeChance"]);
