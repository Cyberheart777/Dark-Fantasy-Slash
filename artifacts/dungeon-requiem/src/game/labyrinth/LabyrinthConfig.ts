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

  // ─── Closing zone (step 2 — not wired yet) ──────────────────────────────
  /** Seconds from zone start to fully closed at center. */
  ZONE_TOTAL_DURATION: 8 * 60,
  /** Active shrink window inside each phase (seconds). */
  ZONE_PHASE_SHRINK_SEC: 30,
  /** Pause between shrink phases (seconds). */
  ZONE_PHASE_PAUSE_SEC: 15,
  /** Damage per second (fraction of max HP) when outside safe zone. */
  ZONE_DAMAGE_PCT_PER_SEC: 0.05,
  /** Escalated damage in the final 2 minutes. */
  ZONE_LATE_DAMAGE_PCT_PER_SEC: 0.10,

  // ─── Enemy counts ───────────────────────────────────────────────────────
  CORRIDOR_GUARDIAN_COUNT: 20,
  /** Stationary turret enemies that fire projectiles with line-of-sight. */
  TRAP_SPAWNER_COUNT: 8,
  SHADOW_STALKER_INTERVAL_SEC: 25,
  WARDEN_MIDPOINT_RADIUS: 3,  // cells from center where warden spawns

  // ─── Environmental traps ────────────────────────────────────────────────
  /** Wall-to-wall projectile beam traps (periodic warn → fire cycle). */
  WALL_TRAP_COUNT: 14,

  // ─── Loot ───────────────────────────────────────────────────────────────
  /** Total chest count scattered around the maze. Bumped from 10 to
   *  18 alongside the higher per-kill drop rates — makes the labyrinth
   *  feel loot-rich even in short runs. */
  LOOT_CHEST_COUNT: 18,

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
