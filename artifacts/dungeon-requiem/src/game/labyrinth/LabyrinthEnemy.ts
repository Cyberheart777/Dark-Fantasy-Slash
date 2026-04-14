/**
 * LabyrinthEnemy.ts
 *
 * Enemy data + AI for the Labyrinth. Step 3a scope: Corridor Guardian
 * only. The EnemyKind discriminator is future-ready for Trap Spawners,
 * Shadow Stalkers, and the Warden (steps 3b–3e) without refactoring.
 *
 * AI states (Corridor Guardian):
 *   PATROL  — wander toward a random adjacent cell. No line-of-sight
 *             check yet; if the player strays within DETECTION_RANGE,
 *             flip to CHASE.
 *   CHASE   — head straight for the player. Walls block via
 *             collidesWithAnyWall so the enemy slides along corridors.
 *             If the player escapes beyond LEASH_RANGE, drop back to
 *             PATROL.
 *   ATTACK  — within melee range; stop, swing on cooldown.
 *   DEAD    — HP <= 0. Rendered as a fading-out shell for DEATH_FADE_SEC
 *             then filtered out of the runtime list.
 *
 * Self-contained: no imports from GameScene.tsx, no shared types with
 * the main enemy system. The runtime type intentionally does NOT reuse
 * EnemyRuntime from `../GameScene.tsx` since it has many fields that
 * don't apply here (DoTs, gear drops, poison/bleed state, etc.).
 */

import { LABYRINTH_CONFIG } from "./LabyrinthConfig";
import {
  cellToWorld,
  extractWallSegments,
  type Maze,
} from "./LabyrinthMaze";

export type EnemyKind = "corridor_guardian";

export type EnemyAiState = "patrol" | "chase" | "attack" | "dead";

export interface EnemyRuntime {
  id: string;
  kind: EnemyKind;
  x: number;
  z: number;
  /** Facing angle (radians, same convention as LabPlayer.angle). */
  angle: number;
  hp: number;
  maxHp: number;
  state: EnemyAiState;
  /** Generic per-state countdown (next waypoint pick, retarget, etc). */
  aiTimer: number;
  /** Seconds until the enemy can melee again. */
  attackCooldown: number;
  /** Seconds since death — drives the render fade-out. */
  deathFadeSec: number;
  /** Short pulse (seconds remaining) that the renderer flashes on hit.
   *  Set in damageEnemy, decays in updateEnemy. Same semantics as the
   *  main game's `EnemyRuntime.hitFlashTimer`. */
  hitFlashTimer: number;
  /** Current patrol waypoint in world coords (null while chasing). */
  patrolTargetX: number | null;
  patrolTargetZ: number | null;
  /** Cached last-known player direction, for a tiny bit of smoothing. */
  lastMoveX: number;
  lastMoveZ: number;
}

// ─── Tuning ───────────────────────────────────────────────────────────────────

const GUARDIAN_HP = 60;
const GUARDIAN_SPEED = 4.2;                 // world units/sec (player is 9)
const GUARDIAN_DETECTION = LABYRINTH_CONFIG.CELL_SIZE * 3;   // ~3 cells
const GUARDIAN_LEASH = LABYRINTH_CONFIG.CELL_SIZE * 5;       // disengage
const GUARDIAN_ATTACK_RANGE = 1.9;
const GUARDIAN_ATTACK_DAMAGE = 10;
const GUARDIAN_ATTACK_COOLDOWN = 1.2;
const GUARDIAN_COLLISION_RADIUS = 0.75;
const GUARDIAN_REPEL_RADIUS = 1.1;          // separation between enemies

/** After death, how long the husk lingers before being evicted. */
export const ENEMY_DEATH_FADE_SEC = 0.6;

/** Minimum cells between player spawn and enemy spawns. */
const SPAWN_MIN_CELL_DIST_FROM_PLAYER = 4;

/** The center 3x3 boss chamber is reserved — no patrol enemies inside. */
const CENTER_EXCLUSION = 2;

// ─── Spawn placement ─────────────────────────────────────────────────────────

/**
 * Pick `count` spawn cells for Corridor Guardians. Avoids the player's
 * spawn area and the center boss chamber. Returns the runtime list.
 */
export function spawnCorridorGuardians(
  maze: Maze,
  count: number,
  rng: () => number = Math.random,
): EnemyRuntime[] {
  const cCol = maze.center.col;
  const cRow = maze.center.row;
  const pCol = maze.spawn.col;
  const pRow = maze.spawn.row;

  const candidates = maze.cells.filter((cell) => {
    if (Math.abs(cell.col - cCol) <= CENTER_EXCLUSION && Math.abs(cell.row - cRow) <= CENTER_EXCLUSION) return false;
    const dc = cell.col - pCol;
    const dr = cell.row - pRow;
    if (dc * dc + dr * dr < SPAWN_MIN_CELL_DIST_FROM_PLAYER * SPAWN_MIN_CELL_DIST_FROM_PLAYER) return false;
    return true;
  });

  // Fisher-Yates
  for (let i = candidates.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
  }

  const chosen = candidates.slice(0, count);
  return chosen.map((cell, i) => {
    const { x, z } = cellToWorld(cell.col, cell.row);
    return {
      id: `guardian-${i}-${cell.col}-${cell.row}`,
      kind: "corridor_guardian" as const,
      x, z,
      angle: rng() * Math.PI * 2 - Math.PI,
      hp: GUARDIAN_HP,
      maxHp: GUARDIAN_HP,
      state: "patrol" as EnemyAiState,
      aiTimer: 0,
      attackCooldown: 0,
      deathFadeSec: 0,
      hitFlashTimer: 0,
      patrolTargetX: null,
      patrolTargetZ: null,
      lastMoveX: 0,
      lastMoveZ: 0,
    };
  });
}

// ─── Per-frame update ────────────────────────────────────────────────────────

/**
 * Advance one enemy's AI + movement + melee by `delta` seconds.
 * Writes damage into `playerDamage` (accumulator — caller applies it
 * to the player at the end of the frame, so multiple enemies attacking
 * in the same tick all register).
 */
export function updateEnemy(
  enemy: EnemyRuntime,
  playerX: number,
  playerZ: number,
  segments: ReturnType<typeof extractWallSegments>,
  delta: number,
  allEnemies: readonly EnemyRuntime[],
  playerDamage: { value: number },
): void {
  if (enemy.state === "dead") {
    enemy.deathFadeSec += delta;
    return;
  }

  const dx = playerX - enemy.x;
  const dz = playerZ - enemy.z;
  const distSq = dx * dx + dz * dz;
  const dist = Math.sqrt(distSq);

  // State transitions
  switch (enemy.state) {
    case "patrol":
      if (dist < GUARDIAN_DETECTION) enemy.state = "chase";
      break;
    case "chase":
      if (dist > GUARDIAN_LEASH) {
        enemy.state = "patrol";
        enemy.patrolTargetX = null;
        enemy.patrolTargetZ = null;
      } else if (dist <= GUARDIAN_ATTACK_RANGE) {
        enemy.state = "attack";
      }
      break;
    case "attack":
      if (dist > GUARDIAN_ATTACK_RANGE + 0.4) enemy.state = "chase";
      break;
  }

  // Cooldown decay is always on
  if (enemy.attackCooldown > 0) enemy.attackCooldown = Math.max(0, enemy.attackCooldown - delta);
  if (enemy.hitFlashTimer > 0) enemy.hitFlashTimer = Math.max(0, enemy.hitFlashTimer - delta);

  // Act by state
  let desiredDx = 0, desiredDz = 0;
  if (enemy.state === "chase") {
    // Head toward player, unit direction
    if (dist > 0.0001) { desiredDx = dx / dist; desiredDz = dz / dist; }
  } else if (enemy.state === "patrol") {
    // Pick/refresh a patrol waypoint
    if (
      enemy.patrolTargetX === null ||
      enemy.patrolTargetZ === null ||
      enemy.aiTimer <= 0
    ) {
      pickNewPatrolWaypoint(enemy);
    }
    enemy.aiTimer -= delta;
    if (enemy.patrolTargetX !== null && enemy.patrolTargetZ !== null) {
      const wx = enemy.patrolTargetX - enemy.x;
      const wz = enemy.patrolTargetZ - enemy.z;
      const wd = Math.sqrt(wx * wx + wz * wz);
      if (wd > 0.4) {
        desiredDx = wx / wd;
        desiredDz = wz / wd;
      } else {
        // Reached waypoint — pick a new one next tick
        enemy.aiTimer = 0;
      }
    }
  } else if (enemy.state === "attack") {
    // Face the player and swing on cooldown
    if (enemy.attackCooldown <= 0) {
      playerDamage.value += GUARDIAN_ATTACK_DAMAGE;
      enemy.attackCooldown = GUARDIAN_ATTACK_COOLDOWN;
    }
  }

  // Enemy-vs-enemy separation (soft repulsion)
  for (const other of allEnemies) {
    if (other === enemy || other.state === "dead") continue;
    const ox = enemy.x - other.x;
    const oz = enemy.z - other.z;
    const od = Math.sqrt(ox * ox + oz * oz);
    if (od > 0 && od < GUARDIAN_REPEL_RADIUS) {
      const push = (GUARDIAN_REPEL_RADIUS - od) / GUARDIAN_REPEL_RADIUS;
      desiredDx += (ox / od) * push * 0.6;
      desiredDz += (oz / od) * push * 0.6;
    }
  }

  // Normalize movement + commit with axis-separated wall collision
  const moveLen = Math.sqrt(desiredDx * desiredDx + desiredDz * desiredDz);
  if (moveLen > 0.0001) {
    const nx = desiredDx / moveLen;
    const nz = desiredDz / moveLen;
    const stepX = nx * GUARDIAN_SPEED * delta;
    const stepZ = nz * GUARDIAN_SPEED * delta;
    const nextX = enemy.x + stepX;
    const nextZ = enemy.z + stepZ;
    if (!collidesWithAnyWallLocal(nextX, enemy.z, GUARDIAN_COLLISION_RADIUS, segments)) enemy.x = nextX;
    if (!collidesWithAnyWallLocal(enemy.x, nextZ, GUARDIAN_COLLISION_RADIUS, segments)) enemy.z = nextZ;
    // Face the direction of travel (same atan2 convention as the player)
    enemy.angle = Math.atan2(nx, -nz);
    enemy.lastMoveX = nx;
    enemy.lastMoveZ = nz;
  } else if (enemy.state === "attack") {
    // Face the player while swinging
    if (dist > 0.0001) enemy.angle = Math.atan2(dx / dist, -dz / dist);
  }
}

/** Flash duration when an enemy takes a hit. Matches the main game's
 *  approximate feel — short enough to read as a hit impact without
 *  making the next swing feel slow. */
const HIT_FLASH_SEC = 0.15;

/** Apply damage. Marks enemy as dead when HP hits 0. Returns true on kill. */
export function damageEnemy(enemy: EnemyRuntime, dmg: number): boolean {
  if (enemy.state === "dead") return false;
  enemy.hp = Math.max(0, enemy.hp - dmg);
  enemy.hitFlashTimer = HIT_FLASH_SEC;
  if (enemy.hp <= 0) {
    enemy.state = "dead";
    enemy.deathFadeSec = 0;
    return true;
  }
  return false;
}

export function isEnemyEvictable(enemy: EnemyRuntime): boolean {
  return enemy.state === "dead" && enemy.deathFadeSec >= ENEMY_DEATH_FADE_SEC;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function pickNewPatrolWaypoint(enemy: EnemyRuntime): void {
  // Random direction, 2–5 cells away. Walls will naturally truncate the walk.
  const angle = Math.random() * Math.PI * 2;
  const dist = LABYRINTH_CONFIG.CELL_SIZE * (2 + Math.random() * 3);
  enemy.patrolTargetX = enemy.x + Math.cos(angle) * dist;
  enemy.patrolTargetZ = enemy.z + Math.sin(angle) * dist;
  enemy.aiTimer = 2 + Math.random() * 2;  // refresh in 2–4s regardless
}

/** Local duplicate of the Scene's wall collision helper. Kept here so
 *  this module stays self-contained and testable — same math as Scene's
 *  collidesWithAnyWall (LabyrinthScene.tsx:508). */
function collidesWithAnyWallLocal(
  cx: number,
  cz: number,
  r: number,
  segments: ReturnType<typeof extractWallSegments>,
): boolean {
  const wallT = LABYRINTH_CONFIG.WALL_THICKNESS;
  for (const seg of segments) {
    const halfW = seg.orient === "h" ? seg.length / 2 : wallT / 2;
    const halfH = seg.orient === "v" ? seg.length / 2 : wallT / 2;
    const closestX = Math.max(seg.cx - halfW, Math.min(cx, seg.cx + halfW));
    const closestZ = Math.max(seg.cz - halfH, Math.min(cz, seg.cz + halfH));
    const dx = cx - closestX;
    const dz = cz - closestZ;
    if (dx * dx + dz * dz < r * r) return true;
  }
  return false;
}

// ─── Stat accessors (for external systems like the HUD) ──────────────────────

export function getEnemyDetectionRange(): number {
  return GUARDIAN_DETECTION;
}
export function getEnemyAttackRange(): number {
  return GUARDIAN_ATTACK_RANGE;
}
