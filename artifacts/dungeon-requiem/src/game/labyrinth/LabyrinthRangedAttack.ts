/**
 * LabyrinthRangedAttack.ts
 *
 * Mage + rogue attack patterns in the labyrinth. Mirrors the intent of
 * the main game's projectile attacks without importing GameScene —
 * mage fires a piercing arcane orb, rogue throws a three-dagger fan.
 * Both spawn player-owned LabProjectile instances that damage enemies
 * via the shared tick pipeline.
 *
 * Dispatch:
 *   class === "warrior" → existing melee arc (LabyrinthCombat.ts)
 *   class === "mage"    → spawnMageAttack
 *   class === "rogue"   → spawnRogueAttack
 */

import { spawnLabProjectile, type LabProjectile } from "./LabyrinthProjectile";

// Labyrinth mode tightens ranged attacks by 25% to match the melee
// range reduction applied in LabyrinthScene (see LABYRINTH_RANGE_MULT).
// Corridor combat is tight; main-game ranges would let you snipe
// across half the maze.

// ─── Mage — piercing arcane orb ──────────────────────────────────────────────
const MAGE_BASE_DAMAGE = 20;
const MAGE_PROJECTILE_SPEED = 18;
const MAGE_PROJECTILE_LIFETIME = (14 * 0.75) / 18; // 10.5u range / 18 u/s
const MAGE_COOLDOWN = 0.95;
const MAGE_COLOR = "#e080ff";
const MAGE_GLOW = "#ff60ff";

// ─── Rogue — 3-dagger fan ────────────────────────────────────────────────────
const ROGUE_BASE_DAMAGE = 12;         // per dagger
const ROGUE_PROJECTILE_SPEED = 20;
const ROGUE_PROJECTILE_LIFETIME = (11 * 0.75) / 20; // 8.25u range
const ROGUE_COOLDOWN = 0.6;
const ROGUE_COLOR = "#a0ffff";
const ROGUE_GLOW = "#40e0ff";
const ROGUE_SPREAD_RAD = 0.35; // total spread ~20° across the fan

export interface RangedAttackState {
  cooldownSec: number;
}

export function makeRangedAttackState(): RangedAttackState {
  return { cooldownSec: 0 };
}

/** Tick the cooldown. Called every frame regardless of input. */
export function tickRangedAttack(state: RangedAttackState, delta: number): void {
  if (state.cooldownSec > 0) state.cooldownSec = Math.max(0, state.cooldownSec - delta);
}

/** Try to fire a mage orb. Returns true if the shot went off. */
export function tryFireMageOrb(
  state: RangedAttackState,
  projectiles: LabProjectile[],
  x: number,
  z: number,
  angle: number,
): boolean {
  if (state.cooldownSec > 0) return false;
  // Match player facing: angle convention is atan2(dx, -dz), so forward
  // vector is (sin(angle), -cos(angle)).
  const dx = Math.sin(angle);
  const dz = -Math.cos(angle);
  spawnLabProjectile(projectiles, {
    owner: "player",
    x, z,
    vx: dx * MAGE_PROJECTILE_SPEED,
    vz: dz * MAGE_PROJECTILE_SPEED,
    damage: MAGE_BASE_DAMAGE,
    radius: 0.5,
    lifetime: MAGE_PROJECTILE_LIFETIME,
    piercing: true, // arcane orb passes through enemies
    color: MAGE_COLOR,
    glowColor: MAGE_GLOW,
    style: "orb",
  });
  state.cooldownSec = MAGE_COOLDOWN;
  return true;
}

/** Try to fire a rogue fan (3 daggers in a spread). Returns true if
 *  the shot went off. */
export function tryFireRogueFan(
  state: RangedAttackState,
  projectiles: LabProjectile[],
  x: number,
  z: number,
  angle: number,
): boolean {
  if (state.cooldownSec > 0) return false;
  const offsets = [-ROGUE_SPREAD_RAD, 0, ROGUE_SPREAD_RAD];
  for (const da of offsets) {
    const a = angle + da;
    const dx = Math.sin(a);
    const dz = -Math.cos(a);
    spawnLabProjectile(projectiles, {
      owner: "player",
      x, z,
      vx: dx * ROGUE_PROJECTILE_SPEED,
      vz: dz * ROGUE_PROJECTILE_SPEED,
      damage: ROGUE_BASE_DAMAGE,
      radius: 0.35,
      lifetime: ROGUE_PROJECTILE_LIFETIME,
      piercing: false,
      color: ROGUE_COLOR,
      glowColor: ROGUE_GLOW,
      style: "dagger",
    });
  }
  state.cooldownSec = ROGUE_COOLDOWN;
  return true;
}
