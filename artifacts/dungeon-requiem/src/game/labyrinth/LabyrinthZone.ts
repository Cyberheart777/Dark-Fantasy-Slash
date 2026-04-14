/**
 * LabyrinthZone.ts
 * Pure-math state + helpers for the closing danger zone.
 *
 * Zone model:
 *   - Circular, centered at (0, 0) — the maze's center chamber.
 *   - Starts at max radius (entire maze inside safe zone) and shrinks
 *     in phases: 30 seconds of shrink, 15 seconds of pause, repeat.
 *   - Total duration: 8 minutes to fully close at the center.
 *   - Player outside safe radius takes damage per second, escalating
 *     in the final 2 minutes.
 *   - Cells "consumed" by the zone are marked impassable (spec: "Maze
 *     geometry consumed by the zone should become impassable — the
 *     player cannot re-enter cleared areas").
 */

import { LABYRINTH_CONFIG, LABYRINTH_HALF } from "./LabyrinthConfig";

const PHASE_DURATION_SEC =
  LABYRINTH_CONFIG.ZONE_PHASE_SHRINK_SEC +
  LABYRINTH_CONFIG.ZONE_PHASE_PAUSE_SEC;

/** Number of shrink phases to fully close the zone. */
const TOTAL_PHASES = Math.ceil(
  LABYRINTH_CONFIG.ZONE_TOTAL_DURATION / PHASE_DURATION_SEC,
);

/** Safe-zone radius when the run starts — must cover the full maze,
 *  including the corner cells. The maze is a square of half-extent
 *  LABYRINTH_HALF, so the furthest cell center is at distance
 *  √2 · LABYRINTH_HALF from origin. We add one cell of buffer so the
 *  corner cells are comfortably inside at t=0 rather than right on
 *  the boundary. */
export const ZONE_INITIAL_RADIUS =
  LABYRINTH_HALF * Math.SQRT2 + LABYRINTH_CONFIG.CELL_SIZE;

/** Final safe radius at t = 8min. Stays slightly >0 so the center room
 *  is always safe until death — prevents the zone from closing inside
 *  the 3x3 boss chamber the generator reserves. */
export const ZONE_FINAL_RADIUS = LABYRINTH_CONFIG.CELL_SIZE * 1.5;

export interface ZoneState {
  /** Seconds since the run started (monotonic). */
  elapsedSec: number;
  /** Current safe-zone radius in world units. */
  radius: number;
  /** True during the 15s pause between shrinks. */
  isPaused: boolean;
  /** 0-indexed phase number. */
  phase: number;
  /** Progress within current phase, 0..1 (0=start of shrink, 1=end of pause). */
  phaseProgress: number;
  /** Seconds remaining until the zone is fully closed. */
  timeRemaining: number;
}

/**
 * Compute the zone state at a given elapsed time.
 * Pure function — no mutation, no side effects.
 */
export function computeZoneState(elapsedSec: number): ZoneState {
  const t = Math.max(0, Math.min(elapsedSec, LABYRINTH_CONFIG.ZONE_TOTAL_DURATION));
  const phase = Math.min(TOTAL_PHASES - 1, Math.floor(t / PHASE_DURATION_SEC));
  const timeInPhase = t - phase * PHASE_DURATION_SEC;
  const isPaused = timeInPhase >= LABYRINTH_CONFIG.ZONE_PHASE_SHRINK_SEC;

  // Radius at start of this phase (= end-of-previous-phase radius)
  const startRadius = lerpRadius(phase / TOTAL_PHASES);
  // Radius at end of this phase's shrink window
  const endRadius = lerpRadius((phase + 1) / TOTAL_PHASES);

  let radius: number;
  if (!isPaused) {
    const shrinkT = timeInPhase / LABYRINTH_CONFIG.ZONE_PHASE_SHRINK_SEC;
    radius = startRadius + (endRadius - startRadius) * shrinkT;
  } else {
    radius = endRadius;
  }

  return {
    elapsedSec: t,
    radius,
    isPaused,
    phase,
    phaseProgress: timeInPhase / PHASE_DURATION_SEC,
    timeRemaining: Math.max(0, LABYRINTH_CONFIG.ZONE_TOTAL_DURATION - t),
  };
}

function lerpRadius(t: number): number {
  const clamped = Math.max(0, Math.min(1, t));
  return ZONE_INITIAL_RADIUS + (ZONE_FINAL_RADIUS - ZONE_INITIAL_RADIUS) * clamped;
}

/**
 * Compute damage-per-second (as a fraction of maxHP) at a given elapsed time.
 * Scales from 5%/s to 10%/s in the final 2 minutes per spec.
 */
export function computeZoneDpsPct(elapsedSec: number): number {
  const lateThreshold = LABYRINTH_CONFIG.ZONE_TOTAL_DURATION - 120;
  if (elapsedSec >= lateThreshold) return LABYRINTH_CONFIG.ZONE_LATE_DAMAGE_PCT_PER_SEC;
  return LABYRINTH_CONFIG.ZONE_DAMAGE_PCT_PER_SEC;
}

/** True if the given world point is inside the safe zone. */
export function isInsideZone(x: number, z: number, radius: number): boolean {
  return x * x + z * z <= radius * radius;
}

/** Distance from the zone boundary (negative if outside, positive if inside). */
export function distanceInsideZone(x: number, z: number, radius: number): number {
  return radius - Math.sqrt(x * x + z * z);
}

/** Format elapsed/remaining seconds as M:SS for the HUD. */
export function formatZoneTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec - m * 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}
