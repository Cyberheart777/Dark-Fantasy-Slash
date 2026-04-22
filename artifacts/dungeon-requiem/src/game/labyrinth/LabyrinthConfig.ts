/**
 * LabyrinthConfig.ts
 * Tuning constants for The Labyrinth game mode.
 * Kept separate from GameConfig.ts so normal-mode tuning is untouched.
 */

export const LABYRINTH_CONFIG = {
  // ─── Maze dimensions ────────────────────────────────────────────────────
  /** Grid size — number of cells per side. Each cell is CELL_SIZE wide.
   *  Bumped 21 → 25 in item 7/8 to give the outer ring enough real
   *  estate for the loot room + high-density combat while keeping the
   *  mid ring for portal spawns + center chamber for the boss. */
  GRID_SIZE: 25,
  /** Item 7: portion of standard enemies (guardians + turrets) placed
   *  in the outer ring (Chebyshev distance >= OUTER_RING_MIN from
   *  center). Rest spread across mid + inner. The zone consumes the
   *  outer ring first, so this density bias turns outer exploration
   *  into a "raid early for the loot room" decision point. */
  OUTER_RING_ENEMY_BIAS: 0.65,
  /** Chebyshev distance (in cells) from maze center that qualifies as
   *  the outer ring. Loot-room cell picker + enemy-bias logic share
   *  this so the definition of "outer ring" is consistent. */
  OUTER_RING_MIN: 8,
  /** World units per maze cell (wall-to-wall corridor width). */
  CELL_SIZE: 8,
  /** Thickness of interior maze walls. */
  WALL_THICKNESS: 1.5,
  /** Height of maze walls. Tall enough to fully block camera pan. */
  WALL_HEIGHT: 6,
  /** Fraction of interior walls to randomly open up after generation, for
   *  multiple viable paths (0 = perfect maze, 0.15 = ~15% extra openings). */
  LOOP_FACTOR: 0.15,
  /** Probability a dead-end cell becomes a small open room (2x2). */
  OPEN_ROOM_CHANCE: 0.08,

  // ─── Closing zone ────────────────────────────────────────────────────────
  // Phase-cycle schedule (item 8). The zone closes in discrete
  // shrink-then-pause cycles. Each shrink is FASTER than the last
  // so the early game gives space to plan, the late game forces
  // commitment. Pauses are identical and tunable via
  // ZONE_PHASE_PAUSE_SEC below.
  //
  //  Shrink seconds per phase (index 0 = first phase):
  //    75s -> 60s -> 45s -> 35s -> 25s -> 18s -> 12s  (sum = 270s / 4.5 min)
  //  + 6 interior pauses @ 35s each                     (sum = 210s / 3.5 min)
  //  Total shrinking time = 480s (8 min), same as before.
  ZONE_PHASE_SHRINKS: [75, 60, 45, 35, 25, 18, 12],
  /** Pause held at the current boundary between shrinks. Tunable
   *  per user spec (30-45s range). The final phase has NO trailing
   *  pause — after the last shrink, the zone stays fully closed
   *  until the run ends. */
  ZONE_PHASE_PAUSE_SEC: 35,
  /** Damage per second (fraction of max HP) when outside safe zone. */
  ZONE_DAMAGE_PCT_PER_SEC: 0.05,
  /** Escalated damage in the final 2 minutes. */
  ZONE_LATE_DAMAGE_PCT_PER_SEC: 0.10,

  // ─── Enemy counts ───────────────────────────────────────────────────────
  CORRIDOR_GUARDIAN_COUNT: 35,
  /** Stationary turret enemies that fire projectiles with line-of-sight. */
  TRAP_SPAWNER_COUNT: 12,
  /** Heavy enemies (ex-"champion" orange model, demoted to standard
   *  heavy). Spawn at run start alongside guardians + trap spawners. */
  HEAVY_COUNT: 5,
  SHADOW_STALKER_INTERVAL_SEC: 18,
  WARDEN_MIDPOINT_RADIUS: 3,  // cells from center where warden spawns

  // ─── Environmental traps ────────────────────────────────────────────────
  /** Wall-to-wall projectile beam traps (periodic warn → fire cycle). */
  WALL_TRAP_COUNT: 14,

  // ─── Loot ───────────────────────────────────────────────────────────────
  /** Total chest count scattered around the maze. Bumped from 10 to
   *  18 alongside the higher per-kill drop rates — makes the labyrinth
   *  feel loot-rich even in short runs. */
  LOOT_CHEST_COUNT: 24,

  // ─── Progression tuning ────────────────────────────────────────────────
  XP_MULTIPLIER: 1.5,  // faster leveling since there are fewer enemies

  // ─── RNG ────────────────────────────────────────────────────────────────
  /** If null, uses Math.random() — maze is different every run.
   *  Set to a number to reproduce a specific maze for debugging. */
  SEED: null as number | null,
};

/** Derived: total world extent of the maze (wall-to-wall). */
export const LABYRINTH_WORLD_EXTENT =
  LABYRINTH_CONFIG.GRID_SIZE * LABYRINTH_CONFIG.CELL_SIZE;

/** Derived: half-extent for centering the maze at (0,0). */
export const LABYRINTH_HALF = LABYRINTH_WORLD_EXTENT / 2;

// ─── Per-layer descent config ────────────────────────────────────────────────

export interface LayerConfig {
  gridSize: number;
  spawnMult: number;
  zoneShrinkMult: number;
  gearDropMult: number;
  crystalMult: number;
  /** Per-layer XP multiplier applied on top of LABYRINTH_CONFIG.XP_MULTIPLIER.
   *  Layer 1 = 1x (baseline), Layer 2 = 2x, Layer 3 = 2x. Lets deeper
   *  layers feel rewarding despite the shorter runtime. */
  xpMultiplier: number;
  championCount: number;
  championScheduleSec: number[];
  hasWarden: boolean;
  hasMiniBoss: boolean;
  hasZoneShrink: boolean;
  hasEnemySpawns: boolean;
  hpBonusOnEntry: number;
}

export const LAYER_CONFIG: Record<1 | 2 | 3, LayerConfig> = {
  1: {
    gridSize: 25,
    spawnMult: 1.0,
    zoneShrinkMult: 1.0,
    gearDropMult: 1.0,
    crystalMult: 1,
    xpMultiplier: 1,
    championCount: 4,
    championScheduleSec: [120, 180, 240, 300],
    hasWarden: false,
    hasMiniBoss: false,
    hasZoneShrink: true,
    hasEnemySpawns: true,
    hpBonusOnEntry: 0,
  },
  2: {
    gridSize: 15,
    spawnMult: 2.0,
    zoneShrinkMult: 2.667,
    gearDropMult: 1.5,
    crystalMult: 2,
    xpMultiplier: 2,
    championCount: 3,
    championScheduleSec: [60, 120, 180],
    hasWarden: true,
    hasMiniBoss: true,
    hasZoneShrink: true,
    hasEnemySpawns: true,
    hpBonusOnEntry: 20,
  },
  3: {
    gridSize: 5,
    spawnMult: 0,
    zoneShrinkMult: 0,
    gearDropMult: 0,
    crystalMult: 3,
    xpMultiplier: 2,
    championCount: 0,
    championScheduleSec: [],
    hasWarden: false,
    hasMiniBoss: false,
    hasZoneShrink: false,
    hasEnemySpawns: false,
    hpBonusOnEntry: 20,
  },
};

// ─── Difficulty types & multipliers ─────────────────────────────────────────

export type LabyrinthDifficulty = "normal" | "hard" | "nightmare";

export const LABYRINTH_HARD_MODE = {
  enemyHpMult: 2.0,
  enemyDamageMult: 1.25,
  enemySpeedMult: 1.10,
  gearDropMult: 1.5,
  crystalMult: 2.0,
  xpMultLayer1: 2.0,
  xpMultLayer2: 4.0,
};

export const LABYRINTH_NIGHTMARE_MODE = {
  enemyHpMult: 3.0,
  enemyDamageMult: 1.5,
  enemySpeedMult: 1.2,
  gearDropMult: 2.0,
  crystalMult: 3.0,
  xpMultLayer1: 3.0,
  xpMultLayer2: 6.0,
};

export type DifficultyMults = typeof LABYRINTH_HARD_MODE;

export function getDifficultyConfig(d: LabyrinthDifficulty): DifficultyMults | null {
  if (d === "nightmare") return LABYRINTH_NIGHTMARE_MODE;
  if (d === "hard") return LABYRINTH_HARD_MODE;
  return null;
}
