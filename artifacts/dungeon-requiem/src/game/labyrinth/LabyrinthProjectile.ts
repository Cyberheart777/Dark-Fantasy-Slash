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
import type { PlayerStats } from "../../data/UpgradeData";

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
  style: "orb" | "dagger" | "crescent" | "note";
  dead: boolean;
  // ── Upgrade-driven optional fields ────────────────────────────────
  /** Overcharged Orbs + ricochet wall-bounce: spawn origin. */
  spawnX?: number;
  spawnZ?: number;
  /** Max travel distance, used by Overcharged Orbs to scale damage. */
  maxRange?: number;
  /** True if this projectile was spawned by Arcane Fracture — prevents
   *  recursive fracture/detonation on fracture shards. */
  isFracture?: boolean;
  /** Initial lifetime at spawn — lets arcane detonation / overcharged
   *  know how far through its flight the orb is. */
  initialLifetime?: number;
  /** Base damage (before modifiers). Used by ricochet/chain math. */
  baseDamage?: number;
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
 *  When `labStats` is provided, applies mage/rogue upgrade mechanics
 *  (chain lightning, ricochet, arcane fracture, arcane detonation,
 *  gravity orb pull, overcharged orb damage scaling, venom stack).
 *  Mirrors GameScene.tsx:2615-2900.
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
    /** Upgrade-gated mechanics source. When absent, projectiles use
     *  the baseline behavior (no chain lightning, no fracture, etc.). */
    labStats?: PlayerStats;
  },
): void {
  const stats = ctx.labStats;

  // Kill helper — common path for player projectile kills (direct hit,
  // chain lightning, ricochet, arcane fracture, arcane detonation).
  const killIfDead = (e: EnemyRuntime): boolean => {
    if (e.state !== "dead" && e.hp <= 0) {
      e.state = "dead";
      e.hitFlashTimer = 0.35;
      if (ctx.onEnemyKilled) ctx.onEnemyKilled(e);
      return true;
    }
    return false;
  };

  // Apply chain damage to an enemy from bounce mechanics. Respects
  // onEnemyHit / onEnemyKilled callbacks so popups + kill-FX + XP
  // orbs all fire through the same pipeline as direct hits.
  const applyBounceDamage = (e: EnemyRuntime, dmg: number): void => {
    if (e.state === "dead") return;
    const before = e.hp;
    e.hp = Math.max(0, e.hp - dmg);
    if (ctx.onEnemyHit) ctx.onEnemyHit(e, Math.min(before, dmg));
    if (e.hp <= 0) {
      killIfDead(e);
    } else {
      e.hitFlashTimer = 0.18;
    }
  };

  // Spawn fracture shards on kill (Arcane Fracture): 3 orbs at 40%
  // damage, 0.8s lifetime, random directions. Marked isFracture so
  // they don't recurse fracture/detonation.
  const spawnFractureShards = (srcX: number, srcZ: number, baseDmg: number): void => {
    const fracDmg = Math.round(baseDmg * 0.4);
    const fracSpeed = 10;
    for (let f = 0; f < 3; f++) {
      const fracAngle = Math.random() * Math.PI * 2;
      spawnLabProjectile(list, {
        owner: "player",
        x: srcX, z: srcZ,
        vx: Math.sin(fracAngle) * fracSpeed,
        vz: Math.cos(fracAngle) * fracSpeed,
        damage: fracDmg,
        baseDamage: fracDmg,
        radius: 0.35,
        lifetime: 0.8,
        initialLifetime: 0.8,
        piercing: true,
        color: "#ff66ff",
        glowColor: "#cc33cc",
        style: "orb",
        isFracture: true,
      });
    }
  };

  // Tick poison duration off any dissipating effects — not needed for
  // labyrinth since poison stacks are persistent until enemy dies
  // (matches main-game behavior).

  for (let idx = 0; idx < list.length; idx++) {
    const p = list[idx];
    if (p.dead) continue;
    p.x += p.vx * delta;
    p.z += p.vz * delta;
    p.lifetime -= delta;

    // ── Mage: Gravity Orbs — pull enemies toward orb while in flight ──
    if (
      p.owner === "player" &&
      p.style === "orb" &&
      stats &&
      stats.gravityOrbPull > 0 &&
      !p.isFracture
    ) {
      const pullRange = 4;
      for (const e of ctx.enemies) {
        if (e.state === "dead") continue;
        const gx = p.x - e.x;
        const gz = p.z - e.z;
        const gd = Math.sqrt(gx * gx + gz * gz);
        if (gd > 0.3 && gd <= pullRange) {
          const pull = (stats.gravityOrbPull * delta) / gd;
          e.x += gx * pull;
          e.z += gz * pull;
        }
      }
    }

    // ── Lifetime expiry ──────────────────────────────────────────────
    if (p.lifetime <= 0) {
      // Mage: Arcane Detonation — AoE explosion on orb expiry
      if (
        p.owner === "player" &&
        p.style === "orb" &&
        stats &&
        stats.arcaneDetonationEnabled &&
        !p.isFracture
      ) {
        const aoeRadius = 2.5;
        const aoeDmg = Math.round((p.baseDamage ?? p.damage) * 0.6);
        for (const e of ctx.enemies) {
          if (e.state === "dead") continue;
          const ax = p.x - e.x;
          const az = p.z - e.z;
          if (ax * ax + az * az <= aoeRadius * aoeRadius) {
            applyBounceDamage(e, aoeDmg);
          }
        }
      }
      p.dead = true;
      continue;
    }

    // ── Wall collision ───────────────────────────────────────────────
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
        const rr = ctx.enemyRadius + Math.max(0, p.radius - 0.5);
        if (dx * dx + dz * dz <= rr * rr) {
          p.hitIds.add(e.id);

          // Compute damage with Overcharged Orbs distance scaling.
          let dmg = p.damage;
          if (
            stats &&
            stats.overchargedOrbBonus > 0 &&
            p.style === "orb" &&
            p.spawnX !== undefined &&
            p.spawnZ !== undefined &&
            p.maxRange !== undefined &&
            p.maxRange > 0
          ) {
            const tdx = p.x - p.spawnX;
            const tdz = p.z - p.spawnZ;
            const traveled = Math.sqrt(tdx * tdx + tdz * tdz);
            const t = Math.min(1, traveled / p.maxRange);
            dmg = Math.round(dmg * (1 + stats.overchargedOrbBonus * t));
          }

          const before = e.hp;
          e.hp = Math.max(0, e.hp - dmg);
          if (ctx.onEnemyHit) ctx.onEnemyHit(e, Math.min(before, dmg));

          // ── Rogue: Venom Stack — apply poison on hit ──
          if (
            stats &&
            stats.venomStackDps > 0 &&
            p.style === "dagger"
          ) {
            const deepMult = stats.deepWoundsMultiplier > 0 ? stats.deepWoundsMultiplier : 1;
            e.poisonStacks = Math.min(5, (e.poisonStacks ?? 0) + 1);
            e.poisonDps = stats.venomStackDps * deepMult;
          }

          let killedThisHit = false;
          if (e.hp <= 0) {
            killedThisHit = killIfDead(e);
          } else {
            e.hitFlashTimer = 0.18;
          }

          // ── Mage: Chain Lightning — bounce to nearby enemies ──
          if (
            stats &&
            stats.chainLightningBounces > 0 &&
            p.style === "orb" &&
            !p.isFracture
          ) {
            let bounceSource: EnemyRuntime = e;
            const bounced = new Set<string>([e.id]);
            const bounceRange = 6;
            for (let b = 0; b < stats.chainLightningBounces; b++) {
              let closest: EnemyRuntime | null = null;
              let closestDist = bounceRange;
              for (const t of ctx.enemies) {
                if (t.state === "dead" || bounced.has(t.id)) continue;
                const bx = t.x - bounceSource.x;
                const bz = t.z - bounceSource.z;
                const bd = Math.sqrt(bx * bx + bz * bz);
                if (bd < closestDist) {
                  closestDist = bd;
                  closest = t;
                }
              }
              if (!closest) break;
              bounced.add(closest.id);
              const chainDmg = Math.round(dmg * 0.55);
              applyBounceDamage(closest, chainDmg);
              bounceSource = closest;
            }
          }

          // ── Rogue: Ricochet — daggers bounce to nearby enemies ──
          if (
            stats &&
            stats.ricochetBounces > 0 &&
            p.style === "dagger"
          ) {
            let ricoSource: EnemyRuntime = e;
            const ricoBounced = new Set<string>([e.id]);
            const ricoRange = 6;
            for (let rb = 0; rb < stats.ricochetBounces; rb++) {
              let closest: EnemyRuntime | null = null;
              let closestDist = ricoRange;
              for (const t of ctx.enemies) {
                if (t.state === "dead" || ricoBounced.has(t.id)) continue;
                const rx = t.x - ricoSource.x;
                const rz = t.z - ricoSource.z;
                const rd = Math.sqrt(rx * rx + rz * rz);
                if (rd < closestDist) {
                  closestDist = rd;
                  closest = t;
                }
              }
              if (!closest) break;
              ricoBounced.add(closest.id);
              const ricoDmg = Math.round(dmg * 0.5);
              applyBounceDamage(closest, ricoDmg);
              ricoSource = closest;
            }
          }

          // ── Mage: Arcane Fracture — death explosion projectiles ──
          if (
            killedThisHit &&
            stats &&
            stats.arcaneFractureEnabled &&
            p.style === "orb" &&
            !p.isFracture
          ) {
            spawnFractureShards(e.x, e.z, p.baseDamage ?? dmg);
          }

          if (!p.piercing) { p.dead = true; break; }
        }
      }
    } else {
      // Enemy projectile → check player sphere.
      const dx = ctx.playerX - p.x;
      const dz = ctx.playerZ - p.z;
      const rr = Math.max(ctx.playerRadius, p.radius);
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
