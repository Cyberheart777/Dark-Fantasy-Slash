/**
 * LabyrinthTrap.ts
 *
 * Wall-to-wall projectile traps. Picks corridor cells that have walls on
 * exactly two opposite sides (N+S, or E+W) and turns each into a periodic
 * trap that fires a beam across the corridor:
 *   Warn (0.8s, red pulsing emitters) →
 *   Fire (0.25s, fast projectile across the corridor) →
 *   Cooldown (2.2–3.5s randomized).
 *
 * Visual emitters + projectile both feed through the existing projectile
 * pool — no new renderer. Emitters themselves are rendered by
 * LabyrinthTrap3D.tsx (small pulsing cubes embedded in the walls).
 */

import { LABYRINTH_CONFIG } from "./LabyrinthConfig";
import { WALL_N, WALL_E, WALL_S, WALL_W, cellToWorld, type Maze } from "./LabyrinthMaze";
import { spawnLabProjectile, type LabProjectile } from "./LabyrinthProjectile";
import { LAB_ENEMY_DAMAGE_MULT } from "./LabyrinthEnemy";

export type TrapPhase = "warn" | "fire" | "cooldown";
export type TrapAxis = "horizontal" | "vertical";

export interface LabTrap {
  id: string;
  /** Fire origin (side A) in world coords. */
  ax: number; az: number;
  /** Fire destination (side B). */
  bx: number; bz: number;
  /** "horizontal" → beam fires E↔W, "vertical" → beam fires N↔S. */
  axis: TrapAxis;
  phase: TrapPhase;
  /** Seconds remaining in the current phase. */
  phaseSec: number;
  /** Distance A → B (for projectile speed tuning). */
  corridorLen: number;
  /** Randomized per-trap so the maze doesn't feel metronome-like. */
  cooldownSec: number;
}

const WARN_SEC = 0.8;
const FIRE_SEC = 0.25;
const COOLDOWN_MIN = 2.2;
const COOLDOWN_MAX = 3.5;
const TRAP_DAMAGE = 30;
const TRAP_INSET = 0.8; // distance from wall face to emitter centre (so it's not embedded inside the wall)

let trapId = 0;

/** Pick corridor cells with walls on exactly two opposite sides, drop
 *  N traps. Avoids the spawn cell and the centre 3×3 boss chamber. */
export function spawnLabTraps(maze: Maze, count: number): LabTrap[] {
  const cs = LABYRINTH_CONFIG.CELL_SIZE;
  const size = maze.size;
  const centerCol = Math.floor(size / 2);
  const centerRow = Math.floor(size / 2);
  const candidates: { col: number; row: number; axis: TrapAxis }[] = [];

  for (let row = 1; row < size - 1; row++) {
    for (let col = 1; col < size - 1; col++) {
      // Skip spawn + boss chamber
      if (col === maze.spawn.col && row === maze.spawn.row) continue;
      if (Math.abs(col - centerCol) <= 1 && Math.abs(row - centerRow) <= 1) continue;
      const cell = maze.cells[row * size + col];
      const hasN = (cell.walls & WALL_N) !== 0;
      const hasS = (cell.walls & WALL_S) !== 0;
      const hasE = (cell.walls & WALL_E) !== 0;
      const hasW = (cell.walls & WALL_W) !== 0;
      // Horizontal corridor (open E/W) → fire from N wall to S wall → axis "vertical"
      if (!hasE && !hasW && hasN && hasS) {
        candidates.push({ col, row, axis: "vertical" });
      }
      // Vertical corridor (open N/S) → fire from E wall to W wall → axis "horizontal"
      else if (!hasN && !hasS && hasE && hasW) {
        candidates.push({ col, row, axis: "horizontal" });
      }
    }
  }

  // Shuffle + take first N
  for (let i = candidates.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
  }
  const picks = candidates.slice(0, count);

  return picks.map(({ col, row, axis }) => {
    const { x, z } = cellToWorld(col, row);
    const half = cs / 2;
    let ax: number, az: number, bx: number, bz: number;
    if (axis === "vertical") {
      // Beam travels N↔S: anchors on N/S walls of the cell
      ax = x; az = z - (half - TRAP_INSET);
      bx = x; bz = z + (half - TRAP_INSET);
    } else {
      // Beam travels E↔W: anchors on E/W walls
      ax = x - (half - TRAP_INSET); az = z;
      bx = x + (half - TRAP_INSET); bz = z;
    }
    // Stagger initial phases so the map doesn't pulse in sync
    const startPhase = Math.random() < 0.5 ? "cooldown" : "warn";
    return {
      id: `labtrap${trapId++}`,
      ax, az, bx, bz,
      axis,
      phase: startPhase,
      phaseSec: startPhase === "cooldown"
        ? COOLDOWN_MIN + Math.random() * (COOLDOWN_MAX - COOLDOWN_MIN)
        : WARN_SEC * Math.random(),
      corridorLen: Math.sqrt((bx - ax) ** 2 + (bz - az) ** 2),
      cooldownSec: COOLDOWN_MIN + Math.random() * (COOLDOWN_MAX - COOLDOWN_MIN),
    };
  });
}

/** Advance every trap's state machine, spawn a projectile at the
 *  fire→cooldown transition. Mutates traps in place. */
export function tickLabTraps(
  traps: LabTrap[],
  projectiles: LabProjectile[],
  delta: number,
): void {
  for (const t of traps) {
    t.phaseSec -= delta;
    if (t.phaseSec > 0) continue;
    switch (t.phase) {
      case "warn": {
        // Fire!
        t.phase = "fire";
        t.phaseSec = FIRE_SEC;
        // Launch one projectile travelling A → B across the corridor.
        // Speed sized so the projectile traverses the corridor in ~FIRE_SEC.
        const speed = t.corridorLen / FIRE_SEC;
        const dx = t.bx - t.ax;
        const dz = t.bz - t.az;
        const mag = Math.sqrt(dx * dx + dz * dz) || 1;
        const vx = (dx / mag) * speed;
        const vz = (dz / mag) * speed;
        spawnLabProjectile(projectiles, {
          owner: "enemy",
          x: t.ax,
          z: t.az,
          vx, vz,
          damage: TRAP_DAMAGE * LAB_ENEMY_DAMAGE_MULT,
          radius: 0.5,
          lifetime: FIRE_SEC + 0.1,
          piercing: true, // beams shouldn't stop on first hit — they keep travelling
          color: "#ff4030",
          glowColor: "#ff8060",
          style: "orb", // beam read; orb renderer with red glow looks right
        });
        break;
      }
      case "fire": {
        t.phase = "cooldown";
        t.phaseSec = t.cooldownSec;
        break;
      }
      case "cooldown": {
        t.phase = "warn";
        t.phaseSec = WARN_SEC;
        break;
      }
    }
  }
}
