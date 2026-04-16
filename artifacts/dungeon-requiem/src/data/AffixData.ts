/**
 * AffixData.ts
 *
 * Single source of truth for the enemy affix system. Consolidates
 * what was previously scattered between GameScene.tsx (AFFIX_TYPES,
 * spawn-roll mechanics) and Enemy3D.tsx (AFFIX_COLORS, ring
 * materials).
 *
 * Each affix has a name, a one-line description, an associated
 * color (the existing tint/circle hue), and a small symbol used by
 * the floating icon over enemies. Renderers / data consumers should
 * read from AFFIX_DEFS rather than re-declaring the strings inline.
 *
 * "none" is intentionally listed for exhaustive switches, but with
 * empty visual data — consumers should skip it via the `isAffixed()`
 * helper.
 */

export type EnemyAffix = "none" | "shielded" | "vampiric" | "berserker";

/** Ordered tuple of rollable affixes. Used by spawn logic to pick
 *  one at random. */
export const AFFIX_TYPES: readonly Exclude<EnemyAffix, "none">[] = [
  "shielded",
  "vampiric",
  "berserker",
] as const;

export interface AffixDef {
  /** Internal id, also the EnemyAffix string. */
  id: EnemyAffix;
  /** Player-facing name (uppercase, used by banner + tooltip). */
  name: string;
  /** One-line description shown in the tooltip + first-encounter banner. */
  description: string;
  /** Hex color associated with the affix — same color used for the
   *  existing aura ring + emissive tint. Drives icon background +
   *  banner accent. */
  color: string;
  /** Single character / emoji shown inside the floating icon plate
   *  above the enemy. Renderers can either use this as a Text mesh
   *  or pick a corresponding geometric primitive. */
  symbol: string;
}

export const AFFIX_DEFS: Record<EnemyAffix, AffixDef> = {
  none: {
    id: "none",
    name: "",
    description: "",
    color: "#000000",
    symbol: "",
  },
  shielded: {
    id: "shielded",
    name: "SHIELDED",
    description: "Absorbs the first incoming hit, regardless of damage.",
    color: "#4488ff",
    symbol: "🛡",
  },
  vampiric: {
    id: "vampiric",
    name: "VAMPIRIC",
    description: "Heals 20% of damage dealt back to itself on every hit.",
    color: "#ff2040",
    symbol: "🩸",
  },
  berserker: {
    id: "berserker",
    name: "BERSERKER",
    description: "+50% move speed and +30% damage, but starts at 70% HP.",
    color: "#ff8020",
    symbol: "🔥",
  },
};

/** True when the affix is one of the rollable variants (excludes
 *  "none"). Saves consumers the ` !== "none" ` check. */
export function isAffixed(affix: EnemyAffix): boolean {
  return affix !== "none" && affix in AFFIX_DEFS;
}
