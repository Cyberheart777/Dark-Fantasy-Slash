/**
 * LabyrinthPortal.ts
 *
 * Extraction portals for the Labyrinth run.
 *
 * Gameplay:
 *   - 6 portals spawn across a run at milestones: 3 @ 180s, 2 @ 300s,
 *     1 @ 420s. Front-loaded — early portals are plentiful but far from
 *     the center; late portals are rare but the player is already close.
 *   - Each portal spawns in the "about to close" ring: inside the current
 *     safe radius but OUTSIDE the next zone target, with buffers on both
 *     sides so the portal isn't consumed instantly on spawn.
 *   - Walking into a live portal ends the run with an EXTRACTED victory
 *     screen — an alternative to reaching the center boss.
 *   - Portals are consumed when the safe radius shrinks past their
 *     position; consumption triggers a fade-out and a console log.
 *
 * Pure-data module — no 3D, no React. The renderer lives in
 * LabyrinthPortal3D.tsx; state/update/spawn lifecycle is driven by
 * LabyrinthScene's ZoneTickLoop.
 */

import { LABYRINTH_CONFIG } from "./LabyrinthConfig";
import { cellToWorld, type Maze } from "./LabyrinthMaze";
import {
  ZONE_FINAL_RADIUS,
  ZONE_INITIAL_RADIUS,
  type ZoneState,
} from "./LabyrinthZone";

/** Fixed spawn schedule. (atSec, count). First burst lands at 45s
 *  so the player discovers the extraction mechanic quickly; previous
 *  3-minute gate meant most players died before seeing one. More
 *  portals total (8 vs 6) for a more portal-rich run. */
export const PORTAL_MILESTONES: readonly { atSec: number; count: number }[] = [
  { atSec: 45, count: 2 },
  { atSec: 120, count: 3 },
  { atSec: 240, count: 2 },
  { atSec: 360, count: 1 },
];

/** Buffer from the *next* zone target so the portal survives at least
 *  one full shrink window after spawn. */
const PORTAL_NEXT_BOUNDARY_BUFFER = LABYRINTH_CONFIG.CELL_SIZE;

/** Buffer from the *current* zone edge so portals don't hug the wall. */
const PORTAL_CURRENT_BOUNDARY_BUFFER = LABYRINTH_CONFIG.CELL_SIZE * 0.5;

/** Minimum Manhattan cell distance between two portals at the same milestone. */
const PORTAL_MIN_CELL_SPACING = 2;

/** Elliptical collision radii (world units) — wider than tall to match
 *  the oval visual. */
export const PORTAL_COLLISION_RX = LABYRINTH_CONFIG.CELL_SIZE * 0.45;
export const PORTAL_COLLISION_RZ = LABYRINTH_CONFIG.CELL_SIZE * 0.32;

/** How long the fade-out lasts after a portal is consumed. */
export const PORTAL_FADE_DURATION_SEC = 0.8;

export interface ExtractionPortal {
  id: string;
  x: number;
  z: number;
  col: number;
  row: number;
  spawnedAtSec: number;
  consumed: boolean;
  /** Seconds since consumption — drives the render-side fade-out. */
  fadeElapsedSec: number;
}

/** Mirror of the private TOTAL_PHASES / PHASE_DURATION_SEC in
 *  LabyrinthZone.ts. Kept local to this file so we don't have to export
 *  Zone internals that don't need to be public. */
function totalZonePhases(): number {
  const phaseDur =
    LABYRINTH_CONFIG.ZONE_PHASE_SHRINK_SEC +
    LABYRINTH_CONFIG.ZONE_PHASE_PAUSE_SEC;
  return Math.ceil(LABYRINTH_CONFIG.ZONE_TOTAL_DURATION / phaseDur);
}

/** Radius the zone will reach at the end of its *next* shrink window.
 *  Used for "about to close" ring placement. Mirrors the lerp at
 *  LabyrinthZone.ts:84-87. */
export function nextZoneBoundaryRadius(zone: ZoneState): number {
  const tp = totalZonePhases();
  const nextPhase = Math.min(zone.phase + 1, tp);
  const t = Math.max(0, Math.min(1, nextPhase / tp));
  return ZONE_INITIAL_RADIUS + (ZONE_FINAL_RADIUS - ZONE_INITIAL_RADIUS) * t;
}

/**
 * Spawn up to `count` new portals for a milestone. Returns the portals
 * that should be appended to the existing list. Pure function — does
 * not mutate `existingPortals`.
 */
export function spawnPortalsForMilestone(
  maze: Maze,
  zone: ZoneState,
  existingPortals: readonly ExtractionPortal[],
  count: number,
  rng: () => number = Math.random,
  atSec: number = zone.elapsedSec,
): ExtractionPortal[] {
  if (count <= 0) return [];

  const rNowOuter = Math.max(0, zone.radius - PORTAL_CURRENT_BOUNDARY_BUFFER);
  const rNextInner = Math.max(0, nextZoneBoundaryRadius(zone) + PORTAL_NEXT_BOUNDARY_BUFFER);
  const outerSq = rNowOuter * rNowOuter;
  const innerSq = rNextInner * rNextInner;

  const centerCol = maze.center.col;
  const centerRow = maze.center.row;

  type Candidate = { col: number; row: number; x: number; z: number };
  const candidates: Candidate[] = [];
  for (const cell of maze.cells) {
    // Skip the 3x3 center chamber (reserved for boss) and the spawn cell.
    if (Math.abs(cell.col - centerCol) <= 1 && Math.abs(cell.row - centerRow) <= 1) continue;
    if (cell.col === maze.spawn.col && cell.row === maze.spawn.row) continue;
    const { x, z } = cellToWorld(cell.col, cell.row);
    const dsq = x * x + z * z;
    if (dsq > outerSq) continue;                    // outside current safe
    if (innerSq > 0 && dsq < innerSq) continue;     // inside next target
    candidates.push({ col: cell.col, row: cell.row, x, z });
  }

  // Fisher-Yates shuffle for uniform distribution across the ring.
  for (let i = candidates.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
  }

  const chosen: ExtractionPortal[] = [];
  const occupied: { col: number; row: number }[] = existingPortals
    .filter((p) => !p.consumed)
    .map((p) => ({ col: p.col, row: p.row }));

  for (const c of candidates) {
    if (chosen.length >= count) break;
    const tooClose = occupied.some(
      (o) => Math.abs(o.col - c.col) + Math.abs(o.row - c.row) < PORTAL_MIN_CELL_SPACING,
    );
    if (tooClose) continue;
    chosen.push({
      id: `portal-${atSec.toFixed(0)}-${c.col}-${c.row}`,
      x: c.x,
      z: c.z,
      col: c.col,
      row: c.row,
      spawnedAtSec: atSec,
      consumed: false,
      fadeElapsedSec: 0,
    });
    occupied.push({ col: c.col, row: c.row });
  }

  return chosen;
}

/** Elliptical hit test. `playerReach` is the player's collision radius. */
export function portalCollision(
  px: number,
  pz: number,
  portal: ExtractionPortal,
  playerReach: number = 0.7,
): boolean {
  if (portal.consumed) return false;
  const rx = PORTAL_COLLISION_RX + playerReach;
  const rz = PORTAL_COLLISION_RZ + playerReach;
  const dx = (px - portal.x) / rx;
  const dz = (pz - portal.z) / rz;
  return dx * dx + dz * dz <= 1;
}

/** True once the shrinking safe radius has overtaken the portal. */
export function isPortalConsumed(
  portal: ExtractionPortal,
  currentRadius: number,
): boolean {
  const dsq = portal.x * portal.x + portal.z * portal.z;
  return dsq > currentRadius * currentRadius;
}

/** 1.0 when fresh, linearly down to 0 across the fade-out window. */
export function portalFadeAlpha(portal: ExtractionPortal): number {
  if (!portal.consumed) return 1;
  return Math.max(0, 1 - portal.fadeElapsedSec / PORTAL_FADE_DURATION_SEC);
}

/** True once the fade-out has finished — safe to drop from the list. */
export function isPortalFadeoutDone(portal: ExtractionPortal): boolean {
  return portal.consumed && portal.fadeElapsedSec >= PORTAL_FADE_DURATION_SEC;
}
