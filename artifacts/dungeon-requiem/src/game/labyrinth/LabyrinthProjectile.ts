/**
 * LabyrinthProjectile.ts
 *
 * Self-contained projectile system for the labyrinth. Struct shape
 * matches the main game's `Projectile` (GameScene.tsx:146-160) so the
 * existing `Projectile3D` renderer can draw a LabProjectile with zero
 * renderer edits — just an `as unknown as` cast at the call site.
 *
 * Used by:
 *   - Wall traps (step B): beam projectiles between two wall anchors
 *   - Trap Spawner enemies (step D): turret orbs toward the player
 *   - Warden boss starburst attack (step F)
 *   - Mage + rogue player attacks (step G)
 *
 * Collision:
 *   - Player-owned projectiles damage enemies (hit = enemy sphere).
 *   - Enemy-owned projectiles damage the player (hit = player sphere).
 *   - Every projectile despawns on wall impact (segment box-test),
 *     on lifetime expiry, or on hit (unless piercing).
 */

import type { EnemyRuntime } from "./LabyrinthEnemy";
import type { extractWallSegments } from "./LabyrinthMaze";

export interface LabProjectile {
  id: string;
  /** "player" sources damage enemies; "enemy" sources damage the player. */
  owner: "player" | "enemy";
  x: number; z: number;
  vx: number; vz: number;
  damage: number;
  radius: number;       // for main-game renderer — not used in collision
  lifetime: number;     // seconds remaining; 0 → evict
  piercing: boolean;    // if true, keeps flying after a hit
  hitIds: Set<string>;  // enemy/player ids already hit this projectile
  color: string;
  glowColor: string;
  style: "orb" | "dagger";
  dead: boolean;
}

let projId = 0;

export function spawnLabProjectile(
  list: LabProjectile[],
  opts: Omit<LabProjectile, "id" | "hitIds" | "dead">,
): void {
  list.push({
    ...opts,
    id: `labproj${projId++}`,
    hitIds: new Set(),
    dead: false,
  });
}

/** Wall-segment rectangle collision test. Mirrors the player-vs-wall
 *  box test in LabyrinthScene.collidesWithAnyWall, simplified to a
 *  point-vs-rectangle query since projectiles are small. */
function projectileHitsWall(
  x: number,
  z: number,
  segments: ReturnType<typeof extractWallSegments>,
  wallThickness: number,
): boolean {
  for (const seg of segments) {
    const halfW = seg.orient === "h" ? seg.length / 2 : wallThickness / 2;
    const halfH = seg.orient === "v" ? seg.length / 2 : wallThickness / 2;
    if (
      x >= seg.cx - halfW && x <= seg.cx + halfW &&
      z >= seg.cz - halfH && z <= seg.cz + halfH
    ) {
      return true;
    }
  }
  return false;
}

/** Tick every projectile: advance position, age lifetime, check walls,
 *  check collision with players/enemies, apply damage. Returns the
 *  `awardedXp`/`playerHit` accumulators so the caller can wire them
 *  into progression + defeat checks.
 *
 *  Mutates `list` in place (filters dead projectiles). */
export function tickLabProjectiles(
  list: LabProjectile[],
  delta: number,
  ctx: {
    playerX: number;
    playerZ: number;
    playerRadius: number;
    enemies: EnemyRuntime[];
    enemyRadius: number;
    segments: ReturnType<typeof extractWallSegments>;
    wallThickness: number;
    /** Called when a player projectile kills an enemy. */
    onEnemyKilled?: (e: EnemyRuntime) => void;
    /** Called when a player projectile damages an enemy (kill or not). */
    onEnemyHit?: (e: EnemyRuntime, damage: number) => void;
    /** Accumulates damage taken by the player this tick. */
    playerDamageAccum: { value: number };
  },
): void {
  for (const p of list) {
    if (p.dead) continue;
    p.x += p.vx * delta;
    p.z += p.vz * delta;
    p.lifetime -= delta;
    if (p.lifetime <= 0) { p.dead = true; continue; }
    if (projectileHitsWall(p.x, p.z, ctx.segments, ctx.wallThickness)) {
      p.dead = true;
      continue;
    }
    if (p.owner === "player") {
      // Player projectile → scan enemies.
      for (const e of ctx.enemies) {
        if (e.state === "dead") continue;
        if (p.hitIds.has(e.id)) continue;
        const dx = e.x - p.x;
        const dz = e.z - p.z;
        const rr = ctx.enemyRadius;
        if (dx * dx + dz * dz <= rr * rr) {
          p.hitIds.add(e.id);
          const before = e.hp;
          e.hp = Math.max(0, e.hp - p.damage);
          if (ctx.onEnemyHit) ctx.onEnemyHit(e, Math.min(before, p.damage));
          if (e.hp <= 0) {
            e.state = "dead";
            e.hitFlashTimer = 0.35;
            if (ctx.onEnemyKilled) ctx.onEnemyKilled(e);
          } else {
            e.hitFlashTimer = 0.18;
          }
          if (!p.piercing) { p.dead = true; break; }
        }
      }
    } else {
      // Enemy projectile → check player sphere.
      const dx = ctx.playerX - p.x;
      const dz = ctx.playerZ - p.z;
      const rr = ctx.playerRadius;
      if (dx * dx + dz * dz <= rr * rr) {
        ctx.playerDamageAccum.value += p.damage;
        p.dead = true;
      }
    }
  }
  // Evict dead projectiles — single-pass filter in place.
  let w = 0;
  for (let r = 0; r < list.length; r++) {
    if (!list[r].dead) {
      list[w++] = list[r];
    }
  }
  list.length = w;
}
