/**
 * LabyrinthProgression.ts
 *
 * Lightweight labyrinth-local progression. Mirrors the XP → level
 * formula from src/systems/ProgressionManager.ts (GameConfig.ts:37-38:
 * BASE = 70, EXPONENT = 1.45, 1.15^floor(level/10) per-10-level scaling)
 * so the ramp feels identical to the main game. Does NOT import
 * ProgressionManager — the main game's version couples to upgrade
 * pick-screens, meta-progression, and class growth tables. We only
 * want XP-drives-level + per-level HP bump.
 *
 * XP orbs are the standard 4-tier crystal (green / blue / purple /
 * orange), drop values match the main game's enemy drop tuning.
 */

import type { XPOrb } from "../GameScene";

// ─── XP formula (same as main game) ──────────────────────────────────────────

const XP_BASE = 70;
const XP_EXPONENT = 1.45;

/** XP required to reach level+1 starting from level. */
export function xpNeededForLevel(level: number): number {
  const tierMult = Math.pow(1.15, Math.floor(level / 10));
  return Math.round(XP_BASE * Math.pow(level, XP_EXPONENT) * tierMult);
}

// ─── Runtime state ───────────────────────────────────────────────────────────

export interface LabProgressionState {
  level: number;
  xp: number;             // XP toward next level (resets on level-up)
  xpToNext: number;       // cached xpNeededForLevel(level)
  /** Cumulative XP earned this run — for HUD / victory summary. */
  totalXp: number;
  /** Number of level-ups this frame; reset to 0 after the caller reads. */
  pendingLevelUps: number;
}

export function makeLabProgression(): LabProgressionState {
  return {
    level: 1,
    xp: 0,
    xpToNext: xpNeededForLevel(1),
    totalXp: 0,
    pendingLevelUps: 0,
  };
}

/** Add XP and handle overflow level-ups. Caller checks `pendingLevelUps`
 *  after to apply per-level effects (HP boost, SFX) and then zeroes it. */
export function addLabXp(state: LabProgressionState, amount: number): void {
  state.xp += amount;
  state.totalXp += amount;
  while (state.xp >= state.xpToNext) {
    state.xp -= state.xpToNext;
    state.level += 1;
    state.xpToNext = xpNeededForLevel(state.level);
    state.pendingLevelUps += 1;
  }
}

// ─── Orb spawn ───────────────────────────────────────────────────────────────

let orbId = 0;

/** Tier mapping for guardian kills. Guardians are the labyrinth's only
 *  enemy today; map them to "blue" (medium XP) so the player level-ups
 *  at a reasonable pace over a 9-minute run. Future enemy types can
 *  return higher tiers. */
function tierForGuardian(): XPOrb["crystalTier"] {
  // Small variance to keep the floor pretty. 70% blue, 20% green, 10% purple.
  const r = Math.random();
  if (r < 0.1) return "purple";
  if (r < 0.8) return "blue";
  return "green";
}

function valueForTier(tier: XPOrb["crystalTier"]): number {
  switch (tier) {
    case "green":  return 15;
    case "blue":   return 30;
    case "purple": return 55;
    case "orange": return 100;
  }
}

/** Spawn a single XP orb at (x, z). Small random offset so multi-kills
 *  don't stack orbs on the same point. */
export function spawnLabXpOrb(list: XPOrb[], x: number, z: number): void {
  const tier = tierForGuardian();
  const ox = x + (Math.random() - 0.5) * 0.6;
  const oz = z + (Math.random() - 0.5) * 0.6;
  list.push({
    id: `laborb${orbId++}`,
    x: ox,
    z: oz,
    value: valueForTier(tier),
    collected: false,
    floatOffset: Math.random() * Math.PI * 2,
    crystalTier: tier,
    collectTimer: 0,
  });
}

// ─── Pickup + tick ───────────────────────────────────────────────────────────

/** How close the player must be to vacuum an orb in. Matches the main
 *  game's baseline pickup radius (stats.pickupRadius ≈ 3). */
export const LAB_PICKUP_RADIUS = 3;

const COLLECT_ANIMATION_DURATION = 0.2; // matches XPOrb3D's COLLECT_DURATION

/** Advance every orb: if uncollected and within pickup range, flag for
 *  collection and return its value so caller can award XP; if already
 *  collected, advance its collection timer. Returns { awardedXp, changed }
 *  where `changed` is true if any orb was flagged or evicted. */
export function tickLabXpOrbs(
  list: XPOrb[],
  px: number,
  pz: number,
  delta: number,
): { awardedXp: number; changed: boolean; evicted: number } {
  let awardedXp = 0;
  let changed = false;
  // Sweep and collect
  for (const orb of list) {
    if (!orb.collected) {
      const dx = orb.x - px;
      const dz = orb.z - pz;
      if (dx * dx + dz * dz <= LAB_PICKUP_RADIUS * LAB_PICKUP_RADIUS) {
        orb.collected = true;
        awardedXp += orb.value;
        changed = true;
      }
    } else {
      orb.collectTimer += delta;
    }
  }
  // Evict orbs whose collect animation has finished
  let evicted = 0;
  for (let i = list.length - 1; i >= 0; i--) {
    if (list[i].collected && list[i].collectTimer >= COLLECT_ANIMATION_DURATION) {
      list.splice(i, 1);
      evicted++;
      changed = true;
    }
  }
  return { awardedXp, changed, evicted };
}
