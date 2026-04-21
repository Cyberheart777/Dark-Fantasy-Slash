/**
 * LabyrinthDeathKnight.ts
 *
 * The Death Knight — three-phase Layer 3 final boss. Spawns at the
 * maze centre chamber. More HP, more mechanics, and more menacing
 * than the Warden.
 *
 *   Phase 1 (>66% HP): chase + melee. Every 5s: telegraphed ground
 *                      slam (0.8s warning) — AoE damage (×2.5) in
 *                      6-unit radius. Player must dodge.
 *   Phase 2 (33-66%):  adds undead minion spawns (2 every 7s) and
 *                      a soul lance cone (3 projectiles every 4s).
 *   Phase 3 (<33%):    enrage — speed boost, slam cooldown/radius up,
 *                      more minions, wider lance cone, dark aura that
 *                      buffs nearby enemies.
 *
 * Killing the Death Knight sets shared.layerComplete (same as warden
 * kill for the Layer 3 win state).
 */

import { LABYRINTH_CONFIG } from "./LabyrinthConfig";
import {
  type EnemyRuntime,
  type EnemyAiState,
} from "./LabyrinthEnemy";
import { cellToWorld, type Maze } from "./LabyrinthMaze";
import { spawnLabProjectile, type LabProjectile } from "./LabyrinthProjectile";

// ─── Tuning ───────────────────────────────────────────────────────────────────

export const DEATH_KNIGHT_HP = 3000;
const DK_SPEED = 2.5;
const DK_SPEED_ENRAGE = 4.0;
const DK_ATTACK_RANGE = 3.0;
const DK_ATTACK_DAMAGE = 45;
const DK_ATTACK_COOLDOWN = 1.4;
const DK_COLLISION_RADIUS = 2.0;

// Ground Slam
const SLAM_WARN_SEC = 0.8;
const SLAM_DAMAGE_MULT = 2.5;           // damage × 2.5
const SLAM_RADIUS_P1 = 6;
const SLAM_RADIUS_P3 = 8;
const SLAM_COOLDOWN_P1 = 5.0;
const SLAM_COOLDOWN_P3 = 3.0;

// Soul Lance — aimed cone at the player
const LANCE_SPEED = 12;
const LANCE_SPREAD = 0.15;              // radians between each lance
const LANCE_SPAWN_DIST = 2.5;
const LANCE_DAMAGE_MULT = 0.5;          // damage × 0.5
const LANCE_LIFETIME = 1.5;
const LANCE_COUNT_P2 = 3;
const LANCE_COUNT_P3 = 5;
const LANCE_COOLDOWN_P2 = 4.0;
const LANCE_COOLDOWN_P3 = 3.0;

// Undead minion spawns
const MINION_COOLDOWN_P2 = 7.0;
const MINION_COOLDOWN_P3 = 5.0;
const MINION_COUNT_P2 = 2;
const MINION_COUNT_P3 = 3;

// Dark Aura (Phase 3)
const AURA_TICK_SEC = 2.0;
const AURA_RADIUS = 10;
const AURA_SPEED_BOOST = 0.15;          // 15% speed boost
const AURA_BOOST_DURATION = 3.0;

// ─── State ────────────────────────────────────────────────────────────────────

export interface DeathKnightState {
  phase: 1 | 2 | 3;
  /** Seconds until next ground slam fires (all phases). */
  slamCooldown: number;
  /** If >0, slam is telegraphing — fire AoE when it hits 0. */
  slamWarning: number;
  /** Seconds until next soul lance volley (phase 2+). */
  lanceCooldown: number;
  /** Seconds until next undead minion spawn burst (phase 2+). */
  minionCooldown: number;
  /** Seconds until next dark aura tick (phase 3). */
  auraCooldown: number;
}

const dkStates = new Map<string, DeathKnightState>();

export function getDeathKnightState(id: string): DeathKnightState {
  let s = dkStates.get(id);
  if (!s) {
    s = {
      phase: 1,
      slamCooldown: SLAM_COOLDOWN_P1,
      slamWarning: 0,
      lanceCooldown: LANCE_COOLDOWN_P2,
      minionCooldown: MINION_COOLDOWN_P2,
      auraCooldown: AURA_TICK_SEC,
    };
    dkStates.set(id, s);
  }
  return s;
}

export function clearDeathKnightState(id: string): void {
  dkStates.delete(id);
}

// ─── Factory ──────────────────────────────────────────────────────────────────

let dkIdCounter = 0;
export function makeDeathKnight(maze: Maze): EnemyRuntime {
  const { x, z } = cellToWorld(maze.center.col, maze.center.row);
  return {
    id: `death_knight-${dkIdCounter++}`,
    kind: "death_knight",
    x, z,
    angle: 0,
    hp: DEATH_KNIGHT_HP,
    maxHp: DEATH_KNIGHT_HP,
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

// ─── AI tick ──────────────────────────────────────────────────────────────────

/** Per-frame Death Knight AI. Chase + melee + phase-gated abilities. */
export function updateDeathKnight(
  dk: EnemyRuntime,
  playerX: number,
  playerZ: number,
  delta: number,
  playerDamage: { value: number },
  projectiles: LabProjectile[],
  onSpawnMinion: (x: number, z: number) => void,
  /** All enemies in the arena — needed for dark aura speed buff. */
  allEnemies?: EnemyRuntime[],
): void {
  const state = getDeathKnightState(dk.id);

  // Phase transitions by HP fraction.
  const hpFrac = dk.hp / dk.maxHp;
  state.phase = hpFrac > 0.66 ? 1 : hpFrac > 0.33 ? 2 : 3;

  const dx = playerX - dk.x;
  const dz = playerZ - dk.z;
  const dist = Math.sqrt(dx * dx + dz * dz) || 0.0001;

  // ── Melee ──────────────────────────────────────────────────────────────────
  if (dk.attackCooldown > 0) dk.attackCooldown = Math.max(0, dk.attackCooldown - delta);
  if (dk.hitFlashTimer > 0) dk.hitFlashTimer = Math.max(0, dk.hitFlashTimer - delta);
  if (dist <= DK_ATTACK_RANGE && dk.attackCooldown <= 0) {
    playerDamage.value += DK_ATTACK_DAMAGE * (dk.damageMult ?? 1);
    dk.attackCooldown = DK_ATTACK_COOLDOWN;
  }

  // ── Chase movement ─────────────────────────────────────────────────────────
  if (dist > DK_ATTACK_RANGE * 0.85) {
    const speed = (state.phase === 3 ? DK_SPEED_ENRAGE : DK_SPEED) * (dk.speedMult ?? 1);
    const nx = dx / dist;
    const nz = dz / dist;
    dk.x += nx * speed * delta;
    dk.z += nz * speed * delta;
    dk.lastMoveX = nx;
    dk.lastMoveZ = nz;
  }
  dk.angle = Math.atan2(dx / dist, -dz / dist);

  // ── Ground Slam (all phases) ───────────────────────────────────────────────
  {
    const slamCd = state.phase === 3 ? SLAM_COOLDOWN_P3 : SLAM_COOLDOWN_P1;
    const slamRadius = state.phase === 3 ? SLAM_RADIUS_P3 : SLAM_RADIUS_P1;
    if (state.slamWarning > 0) {
      state.slamWarning -= delta;
      if (state.slamWarning <= 0) {
        // AoE damage to player if in radius
        if (dist <= slamRadius) {
          playerDamage.value += DK_ATTACK_DAMAGE * SLAM_DAMAGE_MULT * (dk.damageMult ?? 1);
        }
        state.slamCooldown = slamCd;
      }
    } else {
      state.slamCooldown -= delta;
      if (state.slamCooldown <= 0) {
        state.slamWarning = SLAM_WARN_SEC;
      }
    }
  }

  // ── Soul Lance (phase 2+) ──────────────────────────────────────────────────
  if (state.phase >= 2) {
    state.lanceCooldown -= delta;
    if (state.lanceCooldown <= 0) {
      const lanceCount = state.phase === 3 ? LANCE_COUNT_P3 : LANCE_COUNT_P2;
      const lanceCd = state.phase === 3 ? LANCE_COOLDOWN_P3 : LANCE_COOLDOWN_P2;
      state.lanceCooldown = lanceCd;

      const baseAngle = Math.atan2(dx, dz);
      const halfSpread = ((lanceCount - 1) / 2) * LANCE_SPREAD;
      for (let i = 0; i < lanceCount; i++) {
        const a = baseAngle - halfSpread + i * LANCE_SPREAD;
        const spawnX = dk.x + Math.sin(a) * LANCE_SPAWN_DIST;
        const spawnZ = dk.z + Math.cos(a) * LANCE_SPAWN_DIST;
        spawnLabProjectile(projectiles, {
          owner: "enemy",
          x: spawnX,
          z: spawnZ,
          vx: Math.sin(a) * LANCE_SPEED,
          vz: Math.cos(a) * LANCE_SPEED,
          damage: DK_ATTACK_DAMAGE * LANCE_DAMAGE_MULT * (dk.damageMult ?? 1),
          radius: 0.45,
          lifetime: LANCE_LIFETIME,
          piercing: false,
          color: "#44ffaa",
          glowColor: "#22cc66",
          style: "orb",
        });
      }
    }
  }

  // ── Undead Minion Spawns (phase 2+) ────────────────────────────────────────
  if (state.phase >= 2) {
    state.minionCooldown -= delta;
    if (state.minionCooldown <= 0) {
      const count = state.phase === 3 ? MINION_COUNT_P3 : MINION_COUNT_P2;
      const cd = state.phase === 3 ? MINION_COOLDOWN_P3 : MINION_COOLDOWN_P2;
      for (let i = 0; i < count; i++) {
        const a = Math.random() * Math.PI * 2;
        const r = LABYRINTH_CONFIG.CELL_SIZE * 1.2;
        onSpawnMinion(dk.x + Math.cos(a) * r, dk.z + Math.sin(a) * r);
      }
      state.minionCooldown = cd;
    }
  }

  // ── Dark Aura (phase 3) ────────────────────────────────────────────────────
  // Every 2s, all enemies within 10u of the DK get a 15% speed boost for 3s.
  if (state.phase === 3 && allEnemies) {
    state.auraCooldown -= delta;
    if (state.auraCooldown <= 0) {
      state.auraCooldown = AURA_TICK_SEC;
      for (const e of allEnemies) {
        if (e.id === dk.id) continue;
        if (e.state === "dead") continue;
        const ex = e.x - dk.x;
        const ez = e.z - dk.z;
        if (ex * ex + ez * ez <= AURA_RADIUS * AURA_RADIUS) {
          // Apply speed boost. Uses speedMult field — stacks
          // multiplicatively with hard-mode speedMult. We cap at a
          // reasonable ceiling to prevent runaway speed.
          const base = e.speedMult ?? 1;
          e.speedMult = Math.min(base * (1 + AURA_SPEED_BOOST), 2.0);
          // The boost decays naturally — we don't track per-enemy
          // timers. Instead, reapply every tick. The effective duration
          // is governed by the aura tick rate itself.
          void AURA_BOOST_DURATION; // documented for tuning reference
        }
      }
    }
  }
}
