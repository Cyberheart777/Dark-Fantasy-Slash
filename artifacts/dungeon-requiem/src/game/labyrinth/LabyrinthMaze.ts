/**
 * LabyrinthMaze.ts
 * Pure-data maze generation for The Labyrinth mode.
 *
 * Algorithm: iterative recursive backtracker (depth-first).
 *   - Works on an N×N grid of cells.
 *   - Each cell has 4 walls (N/S/E/W).
 *   - Starting from a random cell, walk to unvisited neighbors knocking
 *     down the shared wall. Backtrack via a stack when stuck.
 *   - Produces a "perfect maze" (one path between any two cells).
 *   - Post-pass: knock down LOOP_FACTOR of remaining interior walls so
 *     there are multiple viable routes (spec requirement).
 *   - Dead-end detection: any cell with 3 walls is a dead end — these are
 *     the spawn points for loot chests and trap spawners.
 *
 * Coordinates:
 *   - Grid: (col, row) with col=0 at the west, row=0 at the north.
 *   - World: (x, z) centered at (0, 0). Each cell's world center is
 *     cellToWorld(col, row).
 */

import { LABYRINTH_CONFIG, LABYRINTH_HALF } from "./LabyrinthConfig";

// ─── Types ────────────────────────────────────────────────────────────────────

/** Bit flags for cell walls. Matches compass directions. */
export const WALL_N = 1 << 0;
export const WALL_E = 1 << 1;
export const WALL_S = 1 << 2;
export const WALL_W = 1 << 3;

export interface MazeCell {
  col: number;
  row: number;
  /** Bit field of WALL_N | WALL_E | WALL_S | WALL_W that are still standing. */
  walls: number;
  /** True after visited by the generator (used internally). */
  visited: boolean;
  /** True if this cell is an open-room cell (merged with neighbors). */
  isRoom: boolean;
}

export interface Maze {
  size: number;
  cells: MazeCell[];        // row-major: cells[row * size + col]
  spawn: { col: number; row: number };
  center: { col: number; row: number };
  deadEnds: { col: number; row: number }[];
}

// ─── Seeded RNG (mulberry32) ──────────────────────────────────────────────────
// Deterministic when a seed is given; falls back to Math.random otherwise.

function makeRng(seed: number | null): () => number {
  if (seed == null) return Math.random;
  let s = seed >>> 0;
  return function rng() {
    s |= 0; s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function idx(col: number, row: number, size: number): number {
  return row * size + col;
}

function inBounds(col: number, row: number, size: number): boolean {
  return col >= 0 && row >= 0 && col < size && row < size;
}

/** Returns the bit flag of the wall pointing from `a` toward `b`. */
function wallBetween(a: MazeCell, b: MazeCell): [number, number] {
  const dc = b.col - a.col;
  const dr = b.row - a.row;
  if (dc === 1)  return [WALL_E, WALL_W];
  if (dc === -1) return [WALL_W, WALL_E];
  if (dr === 1)  return [WALL_S, WALL_N];
  if (dr === -1) return [WALL_N, WALL_S];
  throw new Error(`Cells not adjacent: (${a.col},${a.row}) (${b.col},${b.row})`);
}

function neighborsOf(cell: MazeCell, cells: MazeCell[], size: number): MazeCell[] {
  const { col, row } = cell;
  const deltas = [
    [0, -1], [1, 0], [0, 1], [-1, 0],
  ];
  const out: MazeCell[] = [];
  for (const [dc, dr] of deltas) {
    if (inBounds(col + dc, row + dr, size)) {
      out.push(cells[idx(col + dc, row + dr, size)]);
    }
  }
  return out;
}

function shuffle<T>(arr: T[], rng: () => number): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// ─── Maze generation ──────────────────────────────────────────────────────────

/**
 * Generate a maze using iterative recursive backtracker.
 * @param size   Grid side (cells). Must be odd for nice centering.
 * @param seed   Optional deterministic seed.
 */
export function generateMaze(
  size: number = LABYRINTH_CONFIG.GRID_SIZE,
  seed: number | null = LABYRINTH_CONFIG.SEED,
): Maze {
  const rng = makeRng(seed);

  // Initialize all cells with all 4 walls up.
  const cells: MazeCell[] = [];
  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      cells.push({
        col, row,
        walls: WALL_N | WALL_E | WALL_S | WALL_W,
        visited: false,
        isRoom: false,
      });
    }
  }

  // ── Iterative DFS carve ───────────────────────────────────────────────────
  // Start at the outer edge (spawn point) per spec.
  const spawnCol = 1;
  const spawnRow = 1;
  const start = cells[idx(spawnCol, spawnRow, size)];
  start.visited = true;
  const stack: MazeCell[] = [start];

  while (stack.length > 0) {
    const current = stack[stack.length - 1];
    const unvisitedNeighbors = neighborsOf(current, cells, size)
      .filter((n) => !n.visited);

    if (unvisitedNeighbors.length === 0) {
      stack.pop();
      continue;
    }

    const next = unvisitedNeighbors[Math.floor(rng() * unvisitedNeighbors.length)];
    const [wallFromA, wallFromB] = wallBetween(current, next);
    current.walls &= ~wallFromA;
    next.walls &= ~wallFromB;
    next.visited = true;
    stack.push(next);
  }

  // ── Loop pass: knock down random interior walls for multiple paths ────────
  // Per spec: "Multiple viable paths to the center so the player has
  // route choices." A perfect maze has exactly one path; we open LOOP_FACTOR
  // of the remaining interior walls to create shortcuts.
  const loopCount = Math.floor(
    size * size * 2 * LABYRINTH_CONFIG.LOOP_FACTOR,
  );
  let opened = 0;
  let attempts = 0;
  while (opened < loopCount && attempts < loopCount * 10) {
    attempts++;
    const col = 1 + Math.floor(rng() * (size - 2));
    const row = 1 + Math.floor(rng() * (size - 2));
    const cell = cells[idx(col, row, size)];
    const ns = neighborsOf(cell, cells, size);
    if (ns.length === 0) continue;
    const n = ns[Math.floor(rng() * ns.length)];
    const [wallA, wallB] = wallBetween(cell, n);
    if ((cell.walls & wallA) === 0) continue; // already open
    cell.walls &= ~wallA;
    n.walls &= ~wallB;
    opened++;
  }

  // ── Center cell: ensure it's an open 3x3 chamber for the boss fight ──────
  const centerCol = Math.floor(size / 2);
  const centerRow = Math.floor(size / 2);
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      const c = cells[idx(centerCol + dc, centerRow + dr, size)];
      c.isRoom = true;
      // Knock down interior walls of the 3x3 cluster
      if (dc < 1)  c.walls &= ~WALL_E;
      if (dc > -1) c.walls &= ~WALL_W;
      if (dr < 1)  c.walls &= ~WALL_S;
      if (dr > -1) c.walls &= ~WALL_N;
    }
  }

  // ── Dead-end detection ───────────────────────────────────────────────────
  // A dead end is a cell with exactly 3 walls remaining (one open passage).
  const deadEnds: { col: number; row: number }[] = [];
  for (const cell of cells) {
    if (cell.isRoom) continue;
    // Skip spawn area
    if (cell.col === spawnCol && cell.row === spawnRow) continue;
    const wallCount = countBits(cell.walls);
    if (wallCount === 3) {
      deadEnds.push({ col: cell.col, row: cell.row });
      // Some dead ends become small 2x2 open rooms (spec: "Occasional small
      // open rooms at intersections to break up the corridor feel").
      if (rng() < LABYRINTH_CONFIG.OPEN_ROOM_CHANCE) {
        cell.isRoom = true;
      }
    }
  }

  return {
    size,
    cells,
    spawn: { col: spawnCol, row: spawnRow },
    center: { col: centerCol, row: centerRow },
    deadEnds,
  };
}

function countBits(n: number): number {
  let c = 0;
  while (n) { c += n & 1; n >>= 1; }
  return c;
}

// ─── Coordinate helpers ───────────────────────────────────────────────────────

/** Convert (col, row) to world-space (x, z) at the cell's center. */
export function cellToWorld(col: number, row: number): { x: number; z: number } {
  const cs = LABYRINTH_CONFIG.CELL_SIZE;
  return {
    x: col * cs - LABYRINTH_HALF + cs / 2,
    z: row * cs - LABYRINTH_HALF + cs / 2,
  };
}

/** For a dead-end cell (exactly one open wall), returns the cardinal
 *  direction of that single opening. Used by the vault-door placer
 *  so the door sits ON the open-wall edge (embedded in the corridor
 *  architecture) rather than floating at the cell centre. */
export type WallDir = "N" | "S" | "E" | "W";
export function findOpenWallDir(cell: MazeCell): WallDir | null {
  if (!(cell.walls & WALL_N)) return "N";
  if (!(cell.walls & WALL_S)) return "S";
  if (!(cell.walls & WALL_E)) return "E";
  if (!(cell.walls & WALL_W)) return "W";
  return null;
}

/** Convert world (x, z) to grid (col, row). Clamps to bounds. */
export function worldToCell(x: number, z: number): { col: number; row: number } {
  const cs = LABYRINTH_CONFIG.CELL_SIZE;
  const col = Math.floor((x + LABYRINTH_HALF) / cs);
  const row = Math.floor((z + LABYRINTH_HALF) / cs);
  const size = LABYRINTH_CONFIG.GRID_SIZE;
  return {
    col: Math.max(0, Math.min(size - 1, col)),
    row: Math.max(0, Math.min(size - 1, row)),
  };
}

// ─── Wall segment extraction ──────────────────────────────────────────────────
// For rendering: turn the cell wall bits into a flat list of line segments
// that the renderer can draw as boxes.

export interface WallSegment {
  /** Center x of the wall segment in world space. */
  cx: number;
  /** Center z of the wall segment in world space. */
  cz: number;
  /** Length of the wall along its dominant axis. */
  length: number;
  /** Orientation: "h" = runs along x-axis, "v" = runs along z-axis. */
  orient: "h" | "v";
}

/**
 * Extract the distinct wall segments for rendering. Each shared wall between
 * two cells appears once (not twice). Includes the outer boundary.
 */
export function extractWallSegments(maze: Maze): WallSegment[] {
  const { size, cells } = maze;
  const cs = LABYRINTH_CONFIG.CELL_SIZE;
  const segs: WallSegment[] = [];

  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      const cell = cells[idx(col, row, size)];
      const { x, z } = cellToWorld(col, row);

      // North wall — only emit if wall exists AND we're the top owner
      // (either we're at row 0 OR we own the boundary with (col, row-1))
      if (cell.walls & WALL_N) {
        segs.push({
          cx: x, cz: z - cs / 2,
          length: cs, orient: "h",
        });
      }
      // West wall — emit if wall exists (west-owner convention)
      if (cell.walls & WALL_W) {
        segs.push({
          cx: x - cs / 2, cz: z,
          length: cs, orient: "v",
        });
      }
      // East wall — only emit if at the east boundary (col === size - 1),
      // since interior east walls are owned by the cell to the west.
      if (col === size - 1 && (cell.walls & WALL_E)) {
        segs.push({
          cx: x + cs / 2, cz: z,
          length: cs, orient: "v",
        });
      }
      // South wall — only emit at south boundary.
      if (row === size - 1 && (cell.walls & WALL_S)) {
        segs.push({
          cx: x, cz: z + cs / 2,
          length: cs, orient: "h",
        });
      }
    }
  }

  return segs;
}
