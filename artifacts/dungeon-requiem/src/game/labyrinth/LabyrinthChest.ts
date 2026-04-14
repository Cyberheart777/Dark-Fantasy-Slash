/**
 * LabyrinthChest.ts
 *
 * Three chest flavours scattered around the maze:
 *
 *   • treasure (60%) — pops open on proximity, spawns 3–5 XP orbs + a
 *     small heal. Plays "gear_drop".
 *   • trapped (25%) — poison-puddle surprise. On proximity, spawns a
 *     LabGroundFx poison pool and puts 2 poison stacks on the player
 *     if close enough. Plays "boss_special".
 *   • mimic (15%) — reveal animation, then converts into a new LabEnemy
 *     of kind "mimic" at the chest position. Plays "boss_spawn".
 *
 * Interaction is proximity-based (no tap required). The interact radius
 * is 1.5u — slightly tighter than the XP pickup radius so the player
 * has a visual moment before being committed. Mimics trigger the SAME
 * way, so approaching any chest has some risk.
 *
 * Chest lifecycle inside the ref:
 *   live → triggered (0.35s reveal) → consumed
 *   A consumed chest is kept in the list for one more frame so the
 *   scene's React mirror can evict it cleanly, then filtered out.
 */

import { LABYRINTH_CONFIG } from "./LabyrinthConfig";
import { cellToWorld, type Maze } from "./LabyrinthMaze";
import { spawnLabXpOrb } from "./LabyrinthProgression";
import { type LabGroundFx } from "./LabyrinthGroundFx";
import type { XPOrb } from "../GameScene";
import { MIMIC_HP, makeMimicEnemy, type EnemyRuntime } from "./LabyrinthEnemy";

export type ChestKind = "treasure" | "trapped" | "mimic";
export type ChestState = "live" | "revealing" | "consumed";

export interface LabChest {
  id: string;
  x: number; z: number;
  kind: ChestKind;
  state: ChestState;
  /** Seconds since the chest was triggered — drives reveal animation. */
  revealSec: number;
}

const INTERACT_RADIUS = 1.5;
const REVEAL_DURATION_SEC = 0.35;
const TRAPPED_POISON_RADIUS = 3;
const TRAPPED_POISON_LIFETIME = 8;
const TRAPPED_POISON_COLOR = "#7bff50";
const TREASURE_ORB_MIN = 3;
const TREASURE_ORB_MAX = 5;
const TREASURE_HEAL = 10;

let chestId = 0;
let groundFxId = 0;

/** Spawn `count` chests at random dead-end or room cells. Weights the
 *  chest kinds to 60/25/15 for treasure/trapped/mimic. */
export function spawnLabChests(maze: Maze, count: number): LabChest[] {
  const size = maze.size;
  const centerCol = Math.floor(size / 2);
  const centerRow = Math.floor(size / 2);
  // Prefer dead-ends; fall back to any room cell if not enough dead-ends.
  const deadEndCells = maze.deadEnds
    .map((de) => maze.cells[de.row * size + de.col])
    .filter((cell) => {
      // Not at spawn, not in centre chamber.
      if (cell.col === maze.spawn.col && cell.row === maze.spawn.row) return false;
      if (Math.abs(cell.col - centerCol) <= 1 && Math.abs(cell.row - centerRow) <= 1) return false;
      return true;
    });

  for (let i = deadEndCells.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deadEndCells[i], deadEndCells[j]] = [deadEndCells[j], deadEndCells[i]];
  }
  const chosen = deadEndCells.slice(0, count);
  return chosen.map((cell) => {
    const { x, z } = cellToWorld(cell.col, cell.row);
    const r = Math.random();
    const kind: ChestKind = r < 0.6 ? "treasure" : r < 0.85 ? "trapped" : "mimic";
    return {
      id: `labchest${chestId++}`,
      x, z,
      kind,
      state: "live" as const,
      revealSec: 0,
    };
  });
}

/** Per-frame tick: detect player proximity to live chests, advance
 *  reveal timers, fire the chest's effect, and schedule eviction. */
export function tickLabChests(
  chests: LabChest[],
  playerX: number,
  playerZ: number,
  delta: number,
  ctx: {
    xpOrbs: XPOrb[];
    groundFx: LabGroundFx[];
    enemies: EnemyRuntime[];
    playerHeal: (amount: number) => void;
    playerPoison: (stacks: number) => void;
    playAudio: (key: "gear_drop" | "boss_special" | "boss_spawn") => void;
  },
): { changed: boolean } {
  let changed = false;
  for (const c of chests) {
    if (c.state === "consumed") continue;
    if (c.state === "live") {
      const dx = playerX - c.x;
      const dz = playerZ - c.z;
      if (dx * dx + dz * dz <= INTERACT_RADIUS * INTERACT_RADIUS) {
        c.state = "revealing";
        c.revealSec = 0;
        changed = true;
      }
      continue;
    }
    // Revealing
    c.revealSec += delta;
    if (c.revealSec >= REVEAL_DURATION_SEC) {
      resolveChest(c, ctx);
      c.state = "consumed";
      changed = true;
    }
  }
  return { changed };
}

/** Fire the chest's effect exactly once. Called when reveal animation ends. */
function resolveChest(
  chest: LabChest,
  ctx: Parameters<typeof tickLabChests>[4],
): void {
  switch (chest.kind) {
    case "treasure": {
      const orbCount = TREASURE_ORB_MIN + Math.floor(Math.random() * (TREASURE_ORB_MAX - TREASURE_ORB_MIN + 1));
      for (let i = 0; i < orbCount; i++) {
        // Spread the orbs in a small ring so they don't stack.
        const angle = (i / orbCount) * Math.PI * 2 + Math.random() * 0.4;
        const dist = 0.7 + Math.random() * 0.5;
        spawnLabXpOrb(ctx.xpOrbs, chest.x + Math.cos(angle) * dist, chest.z + Math.sin(angle) * dist);
      }
      ctx.playerHeal(TREASURE_HEAL);
      ctx.playAudio("gear_drop");
      return;
    }
    case "trapped": {
      ctx.groundFx.push({
        id: `chestpoison${groundFxId++}`,
        x: chest.x,
        z: chest.z,
        radius: TRAPPED_POISON_RADIUS,
        lifetime: TRAPPED_POISON_LIFETIME,
        color: TRAPPED_POISON_COLOR,
      });
      ctx.playerPoison(2);
      ctx.playAudio("boss_special");
      return;
    }
    case "mimic": {
      ctx.enemies.push(makeMimicEnemy(chest.x, chest.z));
      ctx.playAudio("boss_spawn");
      return;
    }
  }
}

/** Export so the scene's ref mgmt can see how big the pool started at
 *  and budget the "is this a fresh run" heuristic. */
export { MIMIC_HP as LAB_MIMIC_HP };
