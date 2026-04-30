/**
 * LabyrinthCompanion.ts
 *
 * Wandering Bard Companion — a summonable AI companion that follows
 * the player through all labyrinth layers, firing bard-style 5-note
 * fans at enemies and providing a passive aura buff.
 *
 * Summoned via a golden rune sign placed in a Layer 1 dead-end.
 * Costs 200 Soul Forge crystals. Permanent for the run (no respawn
 * on death). Persists through layer transitions.
 */

import { spawnLabProjectile, type LabProjectile } from "./LabyrinthProjectile";
import type { EnemyRuntime } from "./LabyrinthEnemy";
import { hasLineOfSight } from "./LabyrinthEnemy";
import { extractWallSegments } from "./LabyrinthMaze";

// ─── Tuning constants ────────────────────────────────────────────────────────

export const COMPANION_SUMMON_COST = 50;
export const COMPANION_BASE_HP = 80;
const COMPANION_DAMAGE_PER_NOTE = 8;
const COMPANION_ATTACK_SPEED = 1.0;
export const COMPANION_AURA_RADIUS = 15;
export const COMPANION_AURA_HP_BONUS = 0.10;
export const COMPANION_AURA_DAMAGE_BONUS = 0.10;
export const COMPANION_AURA_MOVE_SPEED_BONUS = 0.10;
const COMPANION_FOLLOW_DISTANCE = 4;
export const COMPANION_LAYER_TRANSITION_HP = 20;

const COMPANION_SPEED = 9;
const COMPANION_ATTACK_RANGE = 20;
const NOTE_COUNT = 5;
const NOTE_FAN_HALF = (25 / 2) * (Math.PI / 180);
const NOTE_SPAWN_DIST = 1.5;
const NOTE_SPEED = 22;
const NOTE_LIFETIME = 2.5;
const NOTE_COLOR = "#ffc830";
const NOTE_GLOW = "#cc9922";
const SIGN_INTERACT_RADIUS = 2.5;

// ─── Companion state ─────────────────────────────────────────────────────────

export interface CompanionState {
  alive: boolean;
  hp: number;
  maxHp: number;
  x: number;
  z: number;
  angle: number;
  fireCooldown: number;
  summoned: boolean;
  signConsumed: boolean;
}

export function createCompanionState(): CompanionState {
  return {
    alive: false,
    hp: COMPANION_BASE_HP,
    maxHp: COMPANION_BASE_HP,
    x: 0, z: 0,
    angle: 0,
    fireCooldown: 0,
    summoned: false,
    signConsumed: false,
  };
}

// ─── Summon sign ─────────────────────────────────────────────────────────────

export interface SummonSign {
  x: number;
  z: number;
  consumed: boolean;
}

export function placeSummonSign(
  deadEnds: { col: number; row: number }[],
  spawnCol: number,
  spawnRow: number,
  cellToWorld: (col: number, row: number) => { x: number; z: number },
): SummonSign {
  let best: { col: number; row: number } | null = null;
  let bestDist = 0;
  for (const de of deadEnds) {
    const dx = de.col - spawnCol;
    const dz = de.row - spawnRow;
    const dist = dx * dx + dz * dz;
    if (dist > 4 && dist > bestDist && dist < 100) {
      bestDist = dist;
      best = de;
    }
  }
  if (!best && deadEnds.length > 0) {
    best = deadEnds[Math.floor(Math.random() * deadEnds.length)];
  }
  if (!best) {
    best = { col: Math.max(0, spawnCol + 3), row: spawnRow };
  }
  const pos = cellToWorld(best.col, best.row);
  return { x: pos.x, z: pos.z, consumed: false };
}

export function isNearSign(px: number, pz: number, sign: SummonSign): boolean {
  if (sign.consumed) return false;
  const dx = px - sign.x, dz = pz - sign.z;
  return dx * dx + dz * dz <= SIGN_INTERACT_RADIUS * SIGN_INTERACT_RADIUS;
}

// ─── Aura check ──────────────────────────────────────────────────────────────

export function isInAura(px: number, pz: number, comp: CompanionState): boolean {
  if (!comp.alive) return false;
  const dx = px - comp.x, dz = pz - comp.z;
  return dx * dx + dz * dz <= COMPANION_AURA_RADIUS * COMPANION_AURA_RADIUS;
}

// ─── AI tick ─────────────────────────────────────────────────────────────────

export function tickCompanion(
  comp: CompanionState,
  px: number,
  pz: number,
  delta: number,
  enemies: EnemyRuntime[],
  projectiles: LabProjectile[],
  segments: ReturnType<typeof extractWallSegments>,
): void {
  if (!comp.alive) return;

  // Follow player
  const dx = px - comp.x;
  const dz = pz - comp.z;
  const dist = Math.sqrt(dx * dx + dz * dz) || 0.001;
  if (dist > COMPANION_FOLLOW_DISTANCE) {
    const speed = COMPANION_SPEED * delta;
    comp.x += (dx / dist) * Math.min(speed, dist - COMPANION_FOLLOW_DISTANCE * 0.8);
    comp.z += (dz / dist) * Math.min(speed, dist - COMPANION_FOLLOW_DISTANCE * 0.8);
  }

  // Find nearest enemy in range with line of sight
  let nearDist = Infinity;
  let nearE: EnemyRuntime | null = null;
  for (const e of enemies) {
    if (e.state === "dead") continue;
    const ex = e.x - comp.x, ez = e.z - comp.z;
    const d2 = ex * ex + ez * ez;
    if (d2 < COMPANION_ATTACK_RANGE * COMPANION_ATTACK_RANGE && d2 < nearDist) {
      if (hasLineOfSight(comp.x, comp.z, e.x, e.z, segments)) {
        nearDist = d2;
        nearE = e;
      }
    }
  }

  if (nearE) {
    // Labyrinth angle convention is atan2(dx, -dz) paired with firing
    // (sin, -cos) — see LabyrinthScene.tsx aimAngle and tryFireBardNote.
    // Using atan2(dx, +dz) here would invert the Z component of the
    // shot direction so notes fire away from the target instead of at it.
    comp.angle = Math.atan2(nearE.x - comp.x, -(nearE.z - comp.z));
  }

  // Fire 5-note fan
  comp.fireCooldown = Math.max(0, comp.fireCooldown - delta);
  if (comp.fireCooldown <= 0 && nearE) {
    comp.fireCooldown = 1.0 / COMPANION_ATTACK_SPEED;
    const baseAngle = comp.angle;
    for (let i = 0; i < NOTE_COUNT; i++) {
      const t = NOTE_COUNT > 1 ? (i / (NOTE_COUNT - 1)) * 2 - 1 : 0;
      const fanAngle = baseAngle + t * NOTE_FAN_HALF;
      const ndx = Math.sin(fanAngle);
      const ndz = -Math.cos(fanAngle);
      spawnLabProjectile(projectiles, {
        owner: "player",
        x: comp.x + ndx * NOTE_SPAWN_DIST,
        z: comp.z + ndz * NOTE_SPAWN_DIST,
        vx: ndx * NOTE_SPEED,
        vz: ndz * NOTE_SPEED,
        damage: COMPANION_DAMAGE_PER_NOTE,
        radius: 0.3,
        lifetime: NOTE_LIFETIME,
        piercing: true,
        color: NOTE_COLOR,
        glowColor: NOTE_GLOW,
        style: "note",
      });
    }
  }

  // Take damage from enemy projectiles
  for (const ep of projectiles) {
    if (ep.dead || ep.owner !== "enemy") continue;
    const hx = ep.x - comp.x, hz = ep.z - comp.z;
    if (Math.sqrt(hx * hx + hz * hz) <= 1.2) {
      comp.hp -= ep.damage;
      ep.dead = true;
    }
  }

  // Take damage from nearby melee enemies
  for (const e of enemies) {
    if (e.state === "dead") continue;
    const ex = e.x - comp.x, ez = e.z - comp.z;
    const d2 = ex * ex + ez * ez;
    if (d2 <= 2.5 * 2.5) {
      comp.hp -= 2 * delta;
    }
  }

  if (comp.hp <= 0) {
    comp.alive = false;
    comp.hp = 0;
  }
}
