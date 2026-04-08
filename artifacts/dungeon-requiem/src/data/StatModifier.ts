/**
 * StatModifier.ts
 * Three-layer stat stacking system.
 *
 * ORDER OF OPERATIONS (applied per stat):
 *   1. flat          — raw addition:        base + Σ(flat)
 *   2. additivePct   — pool then multiply:  value × (1 + Σ(pct))
 *   3. multiplicative — each multiplies:    value × Π(mult)
 *
 * Rules for future content:
 *   • Permanent meta upgrades  → "flat"          (predictable, +N per rank)
 *   • Per-run level-up upgrades → "additivePct"   (existing ProgressionManager)
 *   • Rare / legendary items   → "multiplicative" (feels powerful, doesn't stack additively)
 *
 * This prevents exponential blowup: additive % bonuses pool before multiplying,
 * and multiplicative bonuses each scale off the already-modified value.
 */

import type { PlayerStats } from "./UpgradeData";

export type ModifierLayer = "flat" | "additivePct" | "multiplicative";

export interface StatModifier {
  stat: keyof PlayerStats;
  layer: ModifierLayer;
  value: number;
  /** Human-readable source tag for debugging: "meta:iron_soul:2", "item:blood_ring" */
  source: string;
}

/**
 * Resolve a base PlayerStats object through a list of modifiers.
 * Returns a new object; never mutates the input.
 */
export function resolveStats(base: PlayerStats, modifiers: StatModifier[]): PlayerStats {
  if (modifiers.length === 0) return { ...base };

  const result = { ...base } as unknown as Record<string, number | boolean>;
  const statKeys = Object.keys(base) as (keyof PlayerStats)[];

  for (const key of statKeys) {
    // Skip non-numeric fields (booleans like earthbreakerEnabled)
    if (typeof base[key] !== "number") continue;

    const relevant = modifiers.filter((m) => m.stat === key);
    if (relevant.length === 0) continue;

    let val: number = base[key] as number;

    // Layer 1: flat additions
    for (const m of relevant) {
      if (m.layer === "flat") val += m.value;
    }

    // Layer 2: all additive % pool together, then single multiply
    const pctSum = relevant
      .filter((m) => m.layer === "additivePct")
      .reduce((acc, m) => acc + m.value, 0);
    if (pctSum !== 0) val *= 1 + pctSum;

    // Layer 3: each multiplicative bonus multiplies independently
    for (const m of relevant) {
      if (m.layer === "multiplicative") val *= m.value;
    }

    result[key] = val;
  }

  return result as unknown as PlayerStats;
}

/** Build flat modifiers from a simple key-value bonus map. */
export function flatModifiers(
  bonuses: Partial<Record<keyof PlayerStats, number>>,
  source: string,
): StatModifier[] {
  return (Object.entries(bonuses) as [keyof PlayerStats, number][]).map(([stat, value]) => ({
    stat,
    layer: "flat",
    value,
    source,
  }));
}
