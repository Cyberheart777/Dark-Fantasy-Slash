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
import type { PlayerStats } from "../../data/UpgradeData";

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

/** Try to fire a mage orb. Returns true if the shot went off.
 *
 *  Mirrors the main-game orb spawn path (GameScene.tsx ~1902-2015):
 *    - mageExtraOrbs: +N orbs in a fan (±8° per extra orb)
 *    - splitBoltActive: +1 orb at -25% damage (labyrinth variant of
 *      the main game's split-into-3 cone — tightened for corridor combat)
 *    - projectileRadiusBonus: flat bonus to collision radius
 *    - spellEchoChance: chance to double-cast entire volley
 *    - overchargedOrbBonus: tag proj with spawn/maxRange so the tick
 *      can scale damage by travel distance
 */
export function tryFireMageOrb(
  state: RangedAttackState,
  projectiles: LabProjectile[],
  x: number,
  z: number,
  angle: number,
  labStats: PlayerStats,
  /** Action-ability buff multipliers (mage Arcane Barrage).
   *  atkSpeedMult shortens the cooldown; orbSizeMult scales radius. */
  atkSpeedMult: number = 1,
  orbSizeMult: number = 1,
): boolean {
  if (state.cooldownSec > 0) return false;
  const baseDmg = Math.round(labStats.damage > 0 ? labStats.damage : MAGE_BASE_DAMAGE);
  const radius = (0.5 + labStats.projectileRadiusBonus) * orbSizeMult;
  const speed = MAGE_PROJECTILE_SPEED;
  const life = MAGE_PROJECTILE_LIFETIME;
  const maxRange = speed * life;
  const overchargedEnabled = labStats.overchargedOrbBonus > 0;

  // Build fan: base orb + mageExtraOrbs spread at ±8° per extra
  const totalOrbs = 1 + Math.max(0, labStats.mageExtraOrbs);
  const SPREAD_STEP = (8 * Math.PI) / 180; // 8 degrees per extra orb

  const fireVolley = (jitter: number): void => {
    for (let i = 0; i < totalOrbs; i++) {
      // Center the fan; for totalOrbs=1 offset is 0.
      const offset = totalOrbs > 1 ? (i - (totalOrbs - 1) / 2) * SPREAD_STEP : 0;
      const a = angle + offset + jitter;
      const dx = Math.sin(a);
      const dz = -Math.cos(a);
      spawnLabProjectile(projectiles, {
        owner: "player",
        x, z,
        vx: dx * speed,
        vz: dz * speed,
        damage: baseDmg,
        baseDamage: baseDmg,
        radius,
        lifetime: life,
        initialLifetime: life,
        piercing: true,
        color: MAGE_COLOR,
        glowColor: MAGE_GLOW,
        style: "orb",
        spawnX: overchargedEnabled ? x : undefined,
        spawnZ: overchargedEnabled ? z : undefined,
        maxRange: overchargedEnabled ? maxRange : undefined,
      });
    }
    // Split Bolt: +1 extra orb at -25% damage, slight angle jitter.
    if (labStats.splitBoltActive) {
      const splitDmg = Math.round(baseDmg * 0.75);
      const splitA = angle + jitter + SPREAD_STEP * 0.5;
      const dx = Math.sin(splitA);
      const dz = -Math.cos(splitA);
      spawnLabProjectile(projectiles, {
        owner: "player",
        x, z,
        vx: dx * speed,
        vz: dz * speed,
        damage: splitDmg,
        baseDamage: splitDmg,
        radius,
        lifetime: life,
        initialLifetime: life,
        piercing: true,
        color: MAGE_COLOR,
        glowColor: MAGE_GLOW,
        style: "orb",
        spawnX: overchargedEnabled ? x : undefined,
        spawnZ: overchargedEnabled ? z : undefined,
        maxRange: overchargedEnabled ? maxRange : undefined,
      });
    }
  };

  fireVolley(0);
  // Spell Echo: chance to double-cast with slight jitter
  if (labStats.spellEchoChance > 0 && Math.random() < labStats.spellEchoChance) {
    fireVolley((Math.random() - 0.5) * 0.15);
  }
  state.cooldownSec = MAGE_COOLDOWN / Math.max(0.1, atkSpeedMult);
  return true;
}

/** Try to fire a rogue fan. Returns true if the shot went off.
 *
 *  Mirrors the main-game dagger spawn path:
 *    - rogueExtraDaggers: +N daggers widen the fan (proportional spread)
 *    - phantomBladesEnabled: 2 extra spectral daggers at ±0.5 rad,
 *      80% speed, 50% damage, 70% lifetime
 *    - projectileRadiusBonus: flat bonus to collision radius
 */
export function tryFireRogueFan(
  state: RangedAttackState,
  projectiles: LabProjectile[],
  x: number,
  z: number,
  angle: number,
  labStats: PlayerStats,
  atkSpeedMult: number = 1,
): boolean {
  if (state.cooldownSec > 0) return false;
  const baseDmg = Math.round(labStats.damage > 0 ? labStats.damage : ROGUE_BASE_DAMAGE);
  const radius = 0.35 + labStats.projectileRadiusBonus;
  const speed = ROGUE_PROJECTILE_SPEED;
  const life = ROGUE_PROJECTILE_LIFETIME;

  const baseCount = 3;
  const totalDaggers = baseCount + Math.max(0, labStats.rogueExtraDaggers);

  // Convergence Blade: merge all daggers into a single mega-projectile
  if (labStats.convergenceBladeEnabled) {
    const megaDmg = baseDmg * totalDaggers;
    const megaRadius = radius * 5;
    const megaSpeed = speed * 0.4;
    const dx = Math.sin(angle);
    const dz = -Math.cos(angle);
    spawnLabProjectile(projectiles, {
      owner: "player",
      x, z,
      vx: dx * megaSpeed, vz: dz * megaSpeed,
      damage: megaDmg, baseDamage: megaDmg,
      radius: megaRadius, lifetime: life * 1.5, initialLifetime: life * 1.5,
      piercing: true,
      color: "#66ffcc", glowColor: "#22cc88", style: "dagger",
    });
    state.cooldownSec = ROGUE_COOLDOWN / Math.max(0.1, atkSpeedMult);
    return true;
  }

  const halfSpread = ROGUE_SPREAD_RAD;

  for (let i = 0; i < totalDaggers; i++) {
    const t = totalDaggers > 1 ? (i / (totalDaggers - 1)) * 2 - 1 : 0;
    const a = angle + t * halfSpread;
    const dx = Math.sin(a);
    const dz = -Math.cos(a);
    spawnLabProjectile(projectiles, {
      owner: "player",
      x, z,
      vx: dx * speed,
      vz: dz * speed,
      damage: baseDmg,
      baseDamage: baseDmg,
      radius,
      lifetime: life,
      initialLifetime: life,
      piercing: false,
      color: ROGUE_COLOR,
      glowColor: ROGUE_GLOW,
      style: "dagger",
    });
  }

  // Phantom Blades: 2 extra spectral daggers at wide angles
  if (labStats.phantomBladesEnabled) {
    const phantomDmg = Math.round(baseDmg * 0.5);
    const phantomSpeed = speed * 0.8;
    const phantomLife = life * 0.7;
    const phantomRadius = 0.35 * 0.7 + labStats.projectileRadiusBonus;
    for (const offset of [-0.5, 0.5]) {
      const a = angle + offset;
      const dx = Math.sin(a);
      const dz = -Math.cos(a);
      spawnLabProjectile(projectiles, {
        owner: "player",
        x, z,
        vx: dx * phantomSpeed,
        vz: dz * phantomSpeed,
        damage: phantomDmg,
        baseDamage: phantomDmg,
        radius: phantomRadius,
        lifetime: phantomLife,
        initialLifetime: phantomLife,
        piercing: false,
        color: "#80ffcc",
        glowColor: "#40cc88",
        style: "dagger",
      });
    }
  }

  state.cooldownSec = ROGUE_COOLDOWN / Math.max(0.1, atkSpeedMult);
  return true;
}

// ─── Bard — Musical Scale (5-note fan spread) ───────────────────────────────
const BARD_BASE_DAMAGE = 15;
const BARD_PROJECTILE_SPEED = 22;
const BARD_PROJECTILE_LIFETIME = 2.5;
const BARD_COOLDOWN = 0.67; // ~1.5 shots/sec
const BARD_COLOR = "#ffd040";
const BARD_GLOW = "#ffaa22";
const BARD_NOTE_COUNT = 5;
const BARD_FAN_HALF = (25 / 2) * (Math.PI / 180);
const BARD_SPAWN_DIST = 2;

export function tryFireBardNote(
  state: RangedAttackState,
  projectiles: LabProjectile[],
  x: number,
  z: number,
  angle: number,
  labStats: PlayerStats,
  atkSpeedMult: number = 1,
): boolean {
  if (state.cooldownSec > 0) return false;
  // Match the main-game bard: damage scales with stats + bardDamageBonus.
  const bardDmg = Math.round((labStats.damage + labStats.bardDamageBonus) || BARD_BASE_DAMAGE);
  for (let i = 0; i < BARD_NOTE_COUNT; i++) {
    const t = BARD_NOTE_COUNT > 1 ? (i / (BARD_NOTE_COUNT - 1)) * 2 - 1 : 0;
    const fanAngle = angle + t * BARD_FAN_HALF;
    const dx = Math.sin(fanAngle);
    const dz = -Math.cos(fanAngle);
    spawnLabProjectile(projectiles, {
      owner: "player",
      x: x + dx * BARD_SPAWN_DIST,
      z: z + dz * BARD_SPAWN_DIST,
      vx: dx * BARD_PROJECTILE_SPEED,
      vz: dz * BARD_PROJECTILE_SPEED,
      damage: bardDmg,
      radius: 0.3,
      lifetime: BARD_PROJECTILE_LIFETIME,
      piercing: true,
      color: BARD_COLOR,
      glowColor: BARD_GLOW,
      style: "note",
    });
  }
  state.cooldownSec = BARD_COOLDOWN / Math.max(0.1, atkSpeedMult);
  return true;
}
