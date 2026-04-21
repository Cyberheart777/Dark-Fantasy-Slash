/**
 * LabyrinthWarden.ts
 *
 * The Warden — three-phase boss that spawns at the centre 3x3 chamber
 * once the run has been going for a while and the zone has meaningfully
 * closed. Gated by BOTH elapsed time and zone radius so the player
 * can't just rush the centre.
 *
 *   Phase 1 (>66% HP): basic chase + melee, 1.6s attack cooldown.
 *   Phase 2 (33-66%):  adds a radial 8-projectile starburst every 5s,
 *                      with a 0.6s tell before the ring fires.
 *   Phase 3 (<33%):    enrage — +50% movespeed, summons 2 corridor
 *                      guardian minions every 10s.
 *
 * Killing the warden sets shared.victory (new win state) distinct from
 * portal extraction.
 */

import { LABYRINTH_CONFIG } from "./LabyrinthConfig";
import {
  type EnemyRuntime,
  type EnemyAiState,
  makeShadowStalker as _unused, // keep import pattern consistent
} from "./LabyrinthEnemy";
import { spawnCorridorGuardians as _unusedGuardianSpawn } from "./LabyrinthEnemy";
import { cellToWorld, type Maze } from "./LabyrinthMaze";
import { spawnLabProjectile, type LabProjectile } from "./LabyrinthProjectile";

// Silence unused imports — we import only for side-effect-free type reuse.
// (Warden uses its own factory rather than shadow stalker's.)
void _unused;
void _unusedGuardianSpawn;

// ─── Tuning ───────────────────────────────────────────────────────────────────

export const WARDEN_HP = 800;
const WARDEN_SPEED = 3.0;
const WARDEN_SPEED_ENRAGE = 4.5;         // Phase 3 = 1.5×
const WARDEN_ATTACK_RANGE = 2.6;
const WARDEN_ATTACK_DAMAGE = 35;
const WARDEN_ATTACK_COOLDOWN = 1.6;
const WARDEN_COLLISION_RADIUS = 1.8;

const STARBURST_PROJECTILE_COUNT = 8;
const STARBURST_PROJECTILE_DAMAGE = 22;
const STARBURST_PROJECTILE_SPEED = 10;
const STARBURST_PROJECTILE_LIFETIME = 1.4; // reduced from 2.8 for tight corridors
const STARBURST_WARN_SEC = 0.6;
const STARBURST_COOLDOWN_SEC = 5.0;

// Void Lance — aimed 3-shot cone (mirrors main-game boss pattern).
// Reduced range via shorter lifetime for labyrinth corridors.
const VOID_LANCE_SPEED = 14;
const VOID_LANCE_SPREAD = 0.12;       // radians between each lance
const VOID_LANCE_SPAWN_DIST = 2.5;    // closer spawn for tight spaces
const VOID_LANCE_DAMAGE = 18;
const VOID_LANCE_LIFETIME = 1.2;      // short range — corridor-friendly
const VOID_LANCE_COOLDOWN_SEC = 6.0;

const MINION_SPAWN_INTERVAL_SEC = 10;
const MINIONS_PER_BURST = 2;

/** Gate: warden appears at elapsedSec >= this. */
export const WARDEN_TIME_GATE_SEC = 5 * 60;
/** AND: zone radius must be under this fraction of initial radius. */
export const WARDEN_ZONE_GATE_FRAC = 0.5;

/** Phase 2/3 state (persists on the warden EnemyRuntime via the
 *  aiTimer + fireTimer fields that other kinds use differently). */
export interface WardenState {
  phase: 1 | 2 | 3;
  /** Seconds until next starburst fires (phase ≥2). */
  starburstCooldown: number;
  /** If >0, starburst is telegraphing — fire when it hits 0. */
  starburstWarning: number;
  /** Seconds until next minion-summon (phase 3). */
  minionCooldown: number;
  /** Seconds until next void-lance volley (all phases). */
  voidLanceCooldown: number;
}

/** Storage: we piggyback on the enemy's fireTimer/aiTimer fields and a
 *  side-table keyed by enemy id. Simpler than broadening EnemyRuntime
 *  since the warden is singular. */
const wardenStates = new Map<string, WardenState>();

export function getWardenState(id: string): WardenState {
  let s = wardenStates.get(id);
  if (!s) {
    s = {
      phase: 1,
      starburstCooldown: STARBURST_COOLDOWN_SEC,
      starburstWarning: 0,
      minionCooldown: MINION_SPAWN_INTERVAL_SEC,
      voidLanceCooldown: VOID_LANCE_COOLDOWN_SEC,
    };
    wardenStates.set(id, s);
  }
  return s;
}

export function clearWardenState(id: string): void {
  wardenStates.delete(id);
}

let wardenIdCounter = 0;
export function makeWarden(maze: Maze): EnemyRuntime {
  const { x, z } = cellToWorld(maze.center.col, maze.center.row);
  return {
    id: `warden-${wardenIdCounter++}`,
    kind: "warden",
    x, z,
    angle: 0,
    hp: WARDEN_HP,
    maxHp: WARDEN_HP,
    state: "chase" as EnemyAiState,
    aiTimer: 0,
    attackCooldown: 0,
    deathFadeSec: 0,
    hitFlashTimer: 0,
    patrolTargetX: null,
    patrolTargetZ: null,
    lastMoveX: 0,
    lastMoveZ: 0,
    fireTimer: 0,
  };
}

/** Per-frame warden AI. Runs its own chase+melee (doesn't share the
 *  guardian path because it needs phase-specific behaviour) and drives
 *  starburst + minion-spawn logic from the side-table state. */
export function updateWarden(
  warden: EnemyRuntime,
  playerX: number,
  playerZ: number,
  delta: number,
  playerDamage: { value: number },
  projectiles: LabProjectile[],
  onSpawnMinion: (x: number, z: number) => void,
): void {
  const state = getWardenState(warden.id);

  // Phase transitions by HP fraction.
  const hpFrac = warden.hp / warden.maxHp;
  state.phase = hpFrac > 0.66 ? 1 : hpFrac > 0.33 ? 2 : 3;

  const dx = playerX - warden.x;
  const dz = playerZ - warden.z;
  const dist = Math.sqrt(dx * dx + dz * dz) || 0.0001;

  // Melee
  if (warden.attackCooldown > 0) warden.attackCooldown = Math.max(0, warden.attackCooldown - delta);
  if (warden.hitFlashTimer > 0) warden.hitFlashTimer = Math.max(0, warden.hitFlashTimer - delta);
  if (dist <= WARDEN_ATTACK_RANGE && warden.attackCooldown <= 0) {
    playerDamage.value += WARDEN_ATTACK_DAMAGE * (warden.damageMult ?? 1);
    warden.attackCooldown = WARDEN_ATTACK_COOLDOWN;
  }

  // Chase movement (unless swinging, then hold position briefly)
  if (dist > WARDEN_ATTACK_RANGE * 0.85) {
    const speed = (state.phase === 3 ? WARDEN_SPEED_ENRAGE : WARDEN_SPEED) * (warden.speedMult ?? 1);
    const nx = dx / dist;
    const nz = dz / dist;
    warden.x += nx * speed * delta;
    warden.z += nz * speed * delta;
    warden.lastMoveX = nx;
    warden.lastMoveZ = nz;
  }
  warden.angle = Math.atan2(dx / dist, -dz / dist);

  // Starburst (phase 2+)
  if (state.phase >= 2) {
    if (state.starburstWarning > 0) {
      state.starburstWarning -= delta;
      if (state.starburstWarning <= 0) {
        // Fire the ring.
        for (let i = 0; i < STARBURST_PROJECTILE_COUNT; i++) {
          const a = (i / STARBURST_PROJECTILE_COUNT) * Math.PI * 2;
          spawnLabProjectile(projectiles, {
            owner: "enemy",
            x: warden.x,
            z: warden.z,
            vx: Math.cos(a) * STARBURST_PROJECTILE_SPEED,
            vz: Math.sin(a) * STARBURST_PROJECTILE_SPEED,
            damage: STARBURST_PROJECTILE_DAMAGE * (warden.damageMult ?? 1),
            radius: 0.5,
            lifetime: STARBURST_PROJECTILE_LIFETIME,
            piercing: false,
            color: "#ff40a0",
            glowColor: "#ff80c8",
            style: "orb",
          });
        }
        state.starburstCooldown = STARBURST_COOLDOWN_SEC;
      }
    } else {
      state.starburstCooldown -= delta;
      if (state.starburstCooldown <= 0) {
        state.starburstWarning = STARBURST_WARN_SEC;
      }
    }
  }

  // Void Lance — aimed 3-shot cone at the player (all phases).
  // Mirrors the main-game boss void lance but with reduced range for
  // tight labyrinth corridors. Tightens with phase: 6s → 4s → 3s.
  state.voidLanceCooldown -= delta;
  if (state.voidLanceCooldown <= 0) {
    const lanceCd = state.phase === 3 ? 3.0 : state.phase === 2 ? 4.0 : VOID_LANCE_COOLDOWN_SEC;
    state.voidLanceCooldown = lanceCd;
    const baseAngle = Math.atan2(dx, dz);
    for (let i = -1; i <= 1; i++) {
      const a = baseAngle + i * VOID_LANCE_SPREAD;
      const spawnX = warden.x + Math.sin(a) * VOID_LANCE_SPAWN_DIST;
      const spawnZ = warden.z + Math.cos(a) * VOID_LANCE_SPAWN_DIST;
      spawnLabProjectile(projectiles, {
        owner: "enemy",
        x: spawnX,
        z: spawnZ,
        vx: Math.sin(a) * VOID_LANCE_SPEED,
        vz: Math.cos(a) * VOID_LANCE_SPEED,
        damage: VOID_LANCE_DAMAGE * (warden.damageMult ?? 1),
        radius: 0.4,
        lifetime: VOID_LANCE_LIFETIME,
        piercing: false,
        color: "#aa20ff",
        glowColor: "#6610aa",
        style: "orb",
      });
    }
  }

  // Minion summons (phase 3)
  if (state.phase === 3) {
    state.minionCooldown -= delta;
    if (state.minionCooldown <= 0) {
      for (let i = 0; i < MINIONS_PER_BURST; i++) {
        const a = Math.random() * Math.PI * 2;
        const r = LABYRINTH_CONFIG.CELL_SIZE * 1.2;
        onSpawnMinion(warden.x + Math.cos(a) * r, warden.z + Math.sin(a) * r);
      }
      state.minionCooldown = MINION_SPAWN_INTERVAL_SEC;
    }
  }
}

/** Convenience: is the warden gated closed yet? Called every frame in
 *  ZoneTickLoop to decide whether to spawn. */
export function shouldSpawnWarden(
  elapsedSec: number,
  zoneRadius: number,
  zoneInitialRadius: number,
  wardenAlreadySpawned: boolean,
): boolean {
  if (wardenAlreadySpawned) return false;
  if (elapsedSec < WARDEN_TIME_GATE_SEC) return false;
  if (zoneRadius / zoneInitialRadius > WARDEN_ZONE_GATE_FRAC) return false;
  return true;
}
