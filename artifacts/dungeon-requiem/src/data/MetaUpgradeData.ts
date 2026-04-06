/**
 * MetaUpgradeData.ts
 * Permanent (cross-run) upgrade definitions for the Soul Forge.
 *
 * All meta upgrades use the "flat" modifier layer so they add
 * predictable amounts and don't compound exponentially with the
 * per-run additive-% upgrades from ProgressionManager.
 *
 * Adding a new upgrade:
 *   1. Add an entry to META_UPGRADES.
 *   2. The modifier(rank) function receives the purchased rank (1-based)
 *      and returns StatModifiers — use flatModifiers() for simple flat bonuses.
 *   3. No other files need changing.
 */

import type { PlayerStats } from "./UpgradeData";
import { flatModifiers, type StatModifier } from "./StatModifier";

export interface MetaUpgradeDef {
  id: string;
  name: string;
  title: string;          // flavour subtitle
  icon: string;
  description: string;   // template — use {value} for the per-rank amount
  maxRanks: number;
  costs: number[];        // length === maxRanks, cost of each individual rank
  /** Returns modifiers that apply AT the given purchased rank (1-based). */
  modifiers: (rank: number) => StatModifier[];
  /** Human-readable stat line shown in the UI for a given rank. */
  statLine: (rank: number) => string;
}

export const META_UPGRADES: MetaUpgradeDef[] = [
  {
    id: "iron_soul",
    name: "Iron Soul",
    title: "Bone & Steel",
    icon: "❤",
    description: "+10 max HP per rank. Flat addition before run upgrades.",
    maxRanks: 5,
    costs: [100, 200, 350, 550, 800],
    modifiers: (rank) => flatModifiers({ maxHealth: 10 * rank, currentHealth: 10 * rank }, `meta:iron_soul:${rank}`),
    statLine: (r) => `+${10 * r} Max HP`,
  },
  {
    id: "honed_edge",
    name: "Honed Edge",
    title: "Sharpened in Blood",
    icon: "⚔",
    description: "+2 flat damage per rank. Applied before % damage multipliers.",
    maxRanks: 5,
    costs: [120, 240, 400, 600, 850],
    modifiers: (rank) => flatModifiers({ damage: 2 * rank }, `meta:honed_edge:${rank}`),
    statLine: (r) => `+${2 * r} Damage`,
  },
  {
    id: "phantom_step",
    name: "Phantom Step",
    title: "Swift as Shadow",
    icon: "💨",
    description: "+0.4 move speed per rank.",
    maxRanks: 5,
    costs: [150, 280, 450, 650, 900],
    modifiers: (rank) => flatModifiers({ moveSpeed: 0.4 * rank }, `meta:phantom_step:${rank}`),
    statLine: (r) => `+${(0.4 * r).toFixed(1)} Move Speed`,
  },
  {
    id: "blood_pact",
    name: "Blood Pact",
    title: "Life Stolen Freely",
    icon: "🩸",
    description: "+2% lifesteal per rank.",
    maxRanks: 5,
    costs: [200, 380, 580, 820, 1100],
    modifiers: (rank) => flatModifiers({ lifesteal: 0.02 * rank }, `meta:blood_pact:${rank}`),
    statLine: (r) => `+${(2 * r)}% Lifesteal`,
  },
  {
    id: "reapers_eye",
    name: "Reaper's Eye",
    title: "Death Sees Clearly",
    icon: "👁",
    description: "+4% crit chance per rank.",
    maxRanks: 5,
    costs: [180, 340, 540, 780, 1050],
    modifiers: (rank) => flatModifiers({ critChance: 0.04 * rank }, `meta:reapers_eye:${rank}`),
    statLine: (r) => `+${(4 * r)}% Crit Chance`,
  },
  {
    id: "dark_resilience",
    name: "Dark Resilience",
    title: "Between the Blinks",
    icon: "⚡",
    description: "-0.15s dash cooldown per rank.",
    maxRanks: 4,
    costs: [130, 260, 420, 620],
    modifiers: (rank) => flatModifiers({ dashCooldown: -0.15 * rank }, `meta:dark_resilience:${rank}`),
    statLine: (r) => `-${(0.15 * r).toFixed(2)}s Dash Cooldown`,
  },
];

/** Map for O(1) lookup by id. */
export const META_UPGRADE_MAP = Object.fromEntries(
  META_UPGRADES.map((u) => [u.id, u]),
) as Record<string, MetaUpgradeDef>;

/**
 * Build the full set of StatModifiers from purchased meta ranks.
 * Call this once per run start; pass result to resolveStats() or ProgressionManager.
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

/** Total shards needed to max out a given upgrade from scratch. */
export function totalCost(def: MetaUpgradeDef): number {
  return def.costs.reduce((a, b) => a + b, 0);
}

/** Cost of the next rank purchase (0 if already maxed). */
export function nextRankCost(def: MetaUpgradeDef, currentRank: number): number {
  if (currentRank >= def.maxRanks) return 0;
  return def.costs[currentRank]; // costs[0] = rank 1 cost, costs[1] = rank 2 cost, etc.
}

/** Stat line showing the *next* rank bonus. */
export function nextRankLine(def: MetaUpgradeDef, currentRank: number): string {
  if (currentRank >= def.maxRanks) return "MAXED";
  return def.statLine(currentRank + 1);
}

/** Stat preview for a given stat key that is a percentage */
export const PCT_STATS = new Set<keyof PlayerStats>(["critChance", "lifesteal", "dodgeChance", "cleaveChance", "doubleStrikeChance"]);
