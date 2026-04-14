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
import { spawnLabProjectile, type LabProjectile } from "./LabyrinthProjectile";

export type EnemyKind = "corridor_guardian" | "trap_spawner" | "mimic" | "shadow_stalker" | "warden";

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
  /** Trap-spawner turret fire timer (seconds until next shot). Unused
   *  by corridor guardians — they leave this at 0 indefinitely. */
  fireTimer: number;
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

// ─── Trap Spawner tuning ─────────────────────────────────────────────────────
// Stationary turret that fires a projectile every TRAP_SPAWNER_FIRE_SEC while
// the player is within TRAP_SPAWNER_RANGE AND line-of-sight is clear.

const TRAP_SPAWNER_HP = 80;
const TRAP_SPAWNER_RANGE = LABYRINTH_CONFIG.CELL_SIZE * 2.5;
const TRAP_SPAWNER_FIRE_SEC = 1.8;
const TRAP_SPAWNER_PROJECTILE_DAMAGE = 15;
const TRAP_SPAWNER_PROJECTILE_SPEED = 14;
const TRAP_SPAWNER_PROJECTILE_LIFETIME = TRAP_SPAWNER_RANGE / 14 + 0.2;
const TRAP_SPAWNER_COLLISION_RADIUS = 0.8;

// ─── Mimic tuning ────────────────────────────────────────────────────────────
// Revealed chests turn into mimics that chase + melee. Faster than guardians
// (4.5 vs 4.2) and hit harder (18 vs 10) to make the surprise hurt, but
// lower HP (60 vs 60 — matching guardian for now; tweak if they feel too
// tanky). Share the guardian patrol/chase/attack AI exactly — they're just
// a guardian re-skinned with hotter numbers.

export const MIMIC_HP = 60;
const MIMIC_SPEED = 4.5;
const MIMIC_DETECTION = LABYRINTH_CONFIG.CELL_SIZE * 3;
const MIMIC_LEASH = LABYRINTH_CONFIG.CELL_SIZE * 6;  // more tenacious than guardians
const MIMIC_ATTACK_RANGE = 1.9;
const MIMIC_ATTACK_DAMAGE = 18;
const MIMIC_ATTACK_COOLDOWN = 1.0;  // swings slightly faster than guardian (1.2)
const MIMIC_COLLISION_RADIUS = 0.75;

// ─── Shadow Stalker tuning ───────────────────────────────────────────────────
// Low-HP, very fast ambusher that spawns from a far dead-end every
// SHADOW_STALKER_INTERVAL_SEC. Only one alive at a time. Phases
// (renders semi-transparent, signalled via hitFlashTimer abuse — see
// the shim) until it closes to STALKER_REVEAL_DIST; then snaps to
// fully opaque for the strike.

export const STALKER_HP = 40;
const STALKER_SPEED = 5.5;
const STALKER_DETECTION = LABYRINTH_CONFIG.CELL_SIZE * 6;   // always aware of player
const STALKER_LEASH = LABYRINTH_CONFIG.CELL_SIZE * 12;      // never loses interest
const STALKER_ATTACK_RANGE = 1.7;
const STALKER_ATTACK_DAMAGE = 20;
const STALKER_ATTACK_COOLDOWN = 0.9;
const STALKER_COLLISION_RADIUS = 0.6;
/** Distance at which stalker snaps from phasing to opaque — the "spotted!" moment. */
export const STALKER_REVEAL_DIST = LABYRINTH_CONFIG.CELL_SIZE * 1.5;

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
      fireTimer: 0,
    };
  });
}

let mimicIdCounter = 0;
/** Create a mimic enemy at the given world position. Called by the
 *  chest system when a mimic chest is triggered — the chest vanishes
 *  and this enemy takes its place. Starts in `chase` so it comes
 *  straight at the player who just poked it. */
export function makeMimicEnemy(x: number, z: number): EnemyRuntime {
  return {
    id: `mimic-${mimicIdCounter++}`,
    kind: "mimic",
    x, z,
    angle: 0,
    hp: MIMIC_HP,
    maxHp: MIMIC_HP,
    state: "chase",
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

let minionIdCounter = 0;
/** Create a single Corridor Guardian at a specific world position.
 *  Used by the Warden's phase-3 minion summons. */
export function makeCorridorGuardianAt(x: number, z: number): EnemyRuntime {
  return {
    id: `minion-${minionIdCounter++}`,
    kind: "corridor_guardian",
    x, z,
    angle: 0,
    hp: GUARDIAN_HP,
    maxHp: GUARDIAN_HP,
    state: "chase",
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

let stalkerIdCounter = 0;
/** Create a shadow stalker at the given world position. Starts in
 *  `chase` so it immediately hunts the player from wherever it
 *  materialises. */
export function makeShadowStalker(x: number, z: number): EnemyRuntime {
  return {
    id: `stalker-${stalkerIdCounter++}`,
    kind: "shadow_stalker",
    x, z,
    angle: 0,
    hp: STALKER_HP,
    maxHp: STALKER_HP,
    state: "chase",
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

/** Pick a dead-end far from the player for a stalker to appear at. If
 *  the maze has no suitable dead-end, returns null (caller skips the
 *  spawn this interval). */
export function findStalkerSpawnCell(
  maze: Maze,
  playerX: number,
  playerZ: number,
): { x: number; z: number } | null {
  const cs = LABYRINTH_CONFIG.CELL_SIZE;
  const minDistSq = (cs * 8) * (cs * 8);
  let best: { x: number; z: number; d: number } | null = null;
  for (const de of maze.deadEnds) {
    const { x, z } = cellToWorld(de.col, de.row);
    const dx = x - playerX;
    const dz = z - playerZ;
    const d = dx * dx + dz * dz;
    if (d < minDistSq) continue;
    if (!best || d > best.d) best = { x, z, d };
  }
  return best;
}

/**
 * Pick `count` spawn cells for Trap Spawner turrets. Prefers dead-end cells
 * (enemies are harder to out-flank when wedged at a dead-end) and otherwise
 * falls back to any corner cell. Avoids the player spawn and the centre
 * boss chamber. Stationary for the life of the run — no patrol.
 */
export function spawnTrapSpawners(
  maze: Maze,
  count: number,
  rng: () => number = Math.random,
): EnemyRuntime[] {
  const cCol = maze.center.col;
  const cRow = maze.center.row;
  const pCol = maze.spawn.col;
  const pRow = maze.spawn.row;

  const deadEndCells = maze.deadEnds
    .map((de) => maze.cells[de.row * maze.size + de.col])
    .filter((cell) => {
      if (Math.abs(cell.col - cCol) <= CENTER_EXCLUSION && Math.abs(cell.row - cRow) <= CENTER_EXCLUSION) return false;
      const dc = cell.col - pCol;
      const dr = cell.row - pRow;
      if (dc * dc + dr * dr < SPAWN_MIN_CELL_DIST_FROM_PLAYER * SPAWN_MIN_CELL_DIST_FROM_PLAYER) return false;
      return true;
    });

  for (let i = deadEndCells.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [deadEndCells[i], deadEndCells[j]] = [deadEndCells[j], deadEndCells[i]];
  }

  const chosen = deadEndCells.slice(0, count);
  return chosen.map((cell, i) => {
    const { x, z } = cellToWorld(cell.col, cell.row);
    return {
      id: `spawner-${i}-${cell.col}-${cell.row}`,
      kind: "trap_spawner" as const,
      x, z,
      angle: 0,
      hp: TRAP_SPAWNER_HP,
      maxHp: TRAP_SPAWNER_HP,
      state: "patrol" as EnemyAiState,   // inert state; no chase logic applies
      aiTimer: 0,
      attackCooldown: 0,
      deathFadeSec: 0,
      hitFlashTimer: 0,
      patrolTargetX: null,
      patrolTargetZ: null,
      lastMoveX: 0,
      lastMoveZ: 0,
      fireTimer: rng() * TRAP_SPAWNER_FIRE_SEC, // stagger initial shots
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
  projectiles: LabProjectile[],
): void {
  if (enemy.state === "dead") {
    enemy.deathFadeSec += delta;
    return;
  }

  // Dispatch on enemy kind. Corridor Guardian + Mimic + Shadow Stalker
  // share the full patrol/chase/attack state machine below (with per-
  // kind tuning). Trap Spawner is stationary-turret only. The Warden
  // runs its own state machine in LabyrinthWarden.ts — callers route
  // that kind through updateWarden before reaching this function, so
  // if we see one here something's wrong; fall through to a no-op.
  if (enemy.kind === "trap_spawner") {
    updateTrapSpawner(enemy, playerX, playerZ, segments, delta, projectiles);
    if (enemy.hitFlashTimer > 0) enemy.hitFlashTimer = Math.max(0, enemy.hitFlashTimer - delta);
    return;
  }
  if (enemy.kind === "warden") {
    // Warden tick is handled by LabyrinthWarden.updateWarden; skip here.
    if (enemy.hitFlashTimer > 0) enemy.hitFlashTimer = Math.max(0, enemy.hitFlashTimer - delta);
    return;
  }

  // Per-kind tuning for the shared chase-melee AI.
  const tuning =
    enemy.kind === "mimic"
      ? { speed: MIMIC_SPEED, detect: MIMIC_DETECTION, leash: MIMIC_LEASH, range: MIMIC_ATTACK_RANGE, damage: MIMIC_ATTACK_DAMAGE, cd: MIMIC_ATTACK_COOLDOWN, collR: MIMIC_COLLISION_RADIUS }
    : enemy.kind === "shadow_stalker"
      ? { speed: STALKER_SPEED, detect: STALKER_DETECTION, leash: STALKER_LEASH, range: STALKER_ATTACK_RANGE, damage: STALKER_ATTACK_DAMAGE, cd: STALKER_ATTACK_COOLDOWN, collR: STALKER_COLLISION_RADIUS }
    : { speed: GUARDIAN_SPEED, detect: GUARDIAN_DETECTION, leash: GUARDIAN_LEASH, range: GUARDIAN_ATTACK_RANGE, damage: GUARDIAN_ATTACK_DAMAGE, cd: GUARDIAN_ATTACK_COOLDOWN, collR: GUARDIAN_COLLISION_RADIUS };

  const dx = playerX - enemy.x;
  const dz = playerZ - enemy.z;
  const distSq = dx * dx + dz * dz;
  const dist = Math.sqrt(distSq);

  // State transitions
  switch (enemy.state) {
    case "patrol":
      if (dist < tuning.detect) enemy.state = "chase";
      break;
    case "chase":
      if (dist > tuning.leash) {
        enemy.state = "patrol";
        enemy.patrolTargetX = null;
        enemy.patrolTargetZ = null;
      } else if (dist <= tuning.range) {
        enemy.state = "attack";
      }
      break;
    case "attack":
      if (dist > tuning.range + 0.4) enemy.state = "chase";
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
      playerDamage.value += tuning.damage;
      enemy.attackCooldown = tuning.cd;
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
    const stepX = nx * tuning.speed * delta;
    const stepZ = nz * tuning.speed * delta;
    const nextX = enemy.x + stepX;
    const nextZ = enemy.z + stepZ;
    if (!collidesWithAnyWallLocal(nextX, enemy.z, tuning.collR, segments)) enemy.x = nextX;
    if (!collidesWithAnyWallLocal(enemy.x, nextZ, tuning.collR, segments)) enemy.z = nextZ;
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

/** Stationary turret AI. Counts down a fire timer; when the player is
 *  within range AND line-of-sight is clear, fires a projectile straight
 *  at the player's current position and resets the timer. Otherwise
 *  just decays the timer toward 0 so the first in-range frame fires
 *  immediately rather than waiting for a full cycle. */
function updateTrapSpawner(
  enemy: EnemyRuntime,
  playerX: number,
  playerZ: number,
  segments: ReturnType<typeof extractWallSegments>,
  delta: number,
  projectiles: LabProjectile[],
): void {
  const dx = playerX - enemy.x;
  const dz = playerZ - enemy.z;
  const distSq = dx * dx + dz * dz;
  enemy.fireTimer = Math.max(0, enemy.fireTimer - delta);
  if (distSq > TRAP_SPAWNER_RANGE * TRAP_SPAWNER_RANGE) return;
  if (enemy.fireTimer > 0) return;
  if (!hasLineOfSight(enemy.x, enemy.z, playerX, playerZ, segments)) return;
  const dist = Math.sqrt(distSq) || 1;
  const vx = (dx / dist) * TRAP_SPAWNER_PROJECTILE_SPEED;
  const vz = (dz / dist) * TRAP_SPAWNER_PROJECTILE_SPEED;
  // Rotate turret to face shot direction so the visual reads right.
  enemy.angle = Math.atan2(dx / dist, -dz / dist);
  spawnLabProjectile(projectiles, {
    owner: "enemy",
    x: enemy.x,
    z: enemy.z,
    vx, vz,
    damage: TRAP_SPAWNER_PROJECTILE_DAMAGE,
    radius: 0.4,
    lifetime: TRAP_SPAWNER_PROJECTILE_LIFETIME,
    piercing: false,
    color: "#a020e0",
    glowColor: "#e080ff",
    style: "orb",
  });
  enemy.fireTimer = TRAP_SPAWNER_FIRE_SEC;
}

/** Bresenham-ish LOS: sample the segment from (ax,az) to (bx,bz) at
 *  0.4u intervals and check if any sample is inside a wall box. Good
 *  enough for turret-to-player sight; not pixel-perfect but very cheap. */
function hasLineOfSight(
  ax: number, az: number,
  bx: number, bz: number,
  segments: ReturnType<typeof extractWallSegments>,
): boolean {
  const dx = bx - ax;
  const dz = bz - az;
  const dist = Math.sqrt(dx * dx + dz * dz);
  const steps = Math.max(1, Math.ceil(dist / 0.4));
  const wallT = LABYRINTH_CONFIG.WALL_THICKNESS;
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    const x = ax + dx * t;
    const z = az + dz * t;
    for (const seg of segments) {
      const halfW = seg.orient === "h" ? seg.length / 2 : wallT / 2;
      const halfH = seg.orient === "v" ? seg.length / 2 : wallT / 2;
      if (
        x >= seg.cx - halfW && x <= seg.cx + halfW &&
        z >= seg.cz - halfH && z <= seg.cz + halfH
      ) {
        return false;
      }
    }
  }
  return true;
}

/** Test helper: read-only per-kind collision radius (for trap-spawner
 *  hit detection against player swings, since it's stationary). */
export function enemyCollisionRadius(kind: EnemyKind): number {
  switch (kind) {
    case "trap_spawner": return TRAP_SPAWNER_COLLISION_RADIUS;
    case "corridor_guardian": return GUARDIAN_COLLISION_RADIUS;
    case "mimic": return MIMIC_COLLISION_RADIUS;
    case "shadow_stalker": return STALKER_COLLISION_RADIUS;
    case "warden": return 1.8;
  }
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
