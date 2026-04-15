/**
 * LabyrinthZone.ts
 * Pure-math state + helpers for the closing danger zone.
 *
 * Zone model (item 8 rewrite — accelerating phase cycle):
 *   - Circular, centered at (0, 0).
 *   - Closes in discrete SHRINK → PAUSE cycles. Each shrink is faster
 *     than the last (see LABYRINTH_CONFIG.ZONE_PHASE_SHRINKS) so early
 *     phases give the player breathing room and late phases force
 *     commitment. All interior pauses are the same tunable length
 *     (ZONE_PHASE_PAUSE_SEC). The final phase has no trailing pause
 *     — after its shrink ends, the zone stays fully closed.
 *   - Total duration is derived from the schedule, not configured.
 *     With the default 7-phase schedule + 35s pause: exactly 480s.
 *   - Player outside safe radius takes damage per second, escalating
 *     in the final 2 minutes.
 */

import { LABYRINTH_CONFIG, LABYRINTH_HALF } from "./LabyrinthConfig";

// ─── Schedule ────────────────────────────────────────────────────────────────

const SHRINKS: readonly number[] = LABYRINTH_CONFIG.ZONE_PHASE_SHRINKS;
const PAUSE = LABYRINTH_CONFIG.ZONE_PHASE_PAUSE_SEC;

/** Number of shrink phases in the schedule. */
const TOTAL_PHASES = SHRINKS.length;

/** Cumulative start-of-phase elapsed time. offsets[i] = elapsed time
 *  when phase i begins shrinking. offsets[TOTAL_PHASES] = total zone
 *  duration. */
const PHASE_OFFSETS: readonly number[] = (() => {
  const out: number[] = [0];
  for (let i = 0; i < SHRINKS.length; i++) {
    const prev = out[out.length - 1];
    const pauseAfter = i < SHRINKS.length - 1 ? PAUSE : 0; // no pause after final shrink
    out.push(prev + SHRINKS[i] + pauseAfter);
  }
  return out;
})();

/** Total time from run start until the zone is fully closed. Derived
 *  from the phase schedule — not a configurable scalar. */
export const ZONE_TOTAL_DURATION_SEC = PHASE_OFFSETS[TOTAL_PHASES];

/** Safe-zone radius when the run starts — must cover the full maze,
 *  including the corner cells. Maze is a square of half-extent
 *  LABYRINTH_HALF, so the furthest cell centre is at distance
 *  √2·LABYRINTH_HALF from origin. +1 cell buffer. */
export const ZONE_INITIAL_RADIUS =
  LABYRINTH_HALF * Math.SQRT2 + LABYRINTH_CONFIG.CELL_SIZE;

/** Final safe radius. Stays slightly >0 so the boss chamber stays
 *  safe until the final stand. */
export const ZONE_FINAL_RADIUS = LABYRINTH_CONFIG.CELL_SIZE * 1.5;

// ─── State ───────────────────────────────────────────────────────────────────

export interface ZoneState {
  elapsedSec: number;
  /** Current safe-zone radius in world units. */
  radius: number;
  /** True during the pause window of the current phase. */
  isPaused: boolean;
  /** 0-indexed phase number. */
  phase: number;
  /** Progress within current phase, 0..1 (0=start of shrink, 1=end of pause). */
  phaseProgress: number;
  /** Seconds remaining until the zone is fully closed. */
  timeRemaining: number;
}

/** Phase index containing `t`. Clamps to the last phase. */
function phaseAt(t: number): number {
  for (let i = TOTAL_PHASES - 1; i >= 0; i--) {
    if (t >= PHASE_OFFSETS[i]) return i;
  }
  return 0;
}

function lerpPhaseRadius(frac: number): number {
  const clamped = Math.max(0, Math.min(1, frac));
  return ZONE_INITIAL_RADIUS + (ZONE_FINAL_RADIUS - ZONE_INITIAL_RADIUS) * clamped;
}

/** Radius at the BEGINNING of phase `i` (== end of phase i-1 shrink). */
function phaseStartRadius(i: number): number {
  return lerpPhaseRadius(i / TOTAL_PHASES);
}

/** Radius at the END of phase `i`'s shrink window (== start of its pause). */
function phaseEndRadius(i: number): number {
  return lerpPhaseRadius((i + 1) / TOTAL_PHASES);
}

/** Compute the zone state at a given elapsed time. Pure function. */
export function computeZoneState(elapsedSec: number): ZoneState {
  const t = Math.max(0, Math.min(elapsedSec, ZONE_TOTAL_DURATION_SEC));
  const phase = phaseAt(t);
  const timeInPhase = t - PHASE_OFFSETS[phase];
  const shrinkSec = SHRINKS[phase];
  const phaseDuration = PHASE_OFFSETS[phase + 1] - PHASE_OFFSETS[phase];
  const isPaused = timeInPhase >= shrinkSec;

  const startR = phaseStartRadius(phase);
  const endR = phaseEndRadius(phase);

  let radius: number;
  if (!isPaused) {
    const shrinkT = shrinkSec > 0 ? timeInPhase / shrinkSec : 1;
    radius = startR + (endR - startR) * shrinkT;
  } else {
    radius = endR;
  }

  return {
    elapsedSec: t,
    radius,
    isPaused,
    phase,
    phaseProgress: phaseDuration > 0 ? timeInPhase / phaseDuration : 1,
    timeRemaining: Math.max(0, ZONE_TOTAL_DURATION_SEC - t),
  };
}

/** Compute damage-per-second (as a fraction of maxHP) at a given
 *  elapsed time. Scales from base to escalated DPS in the final 2
 *  minutes. */
export function computeZoneDpsPct(elapsedSec: number): number {
  const lateThreshold = ZONE_TOTAL_DURATION_SEC - 120;
  if (elapsedSec >= lateThreshold) return LABYRINTH_CONFIG.ZONE_LATE_DAMAGE_PCT_PER_SEC;
  return LABYRINTH_CONFIG.ZONE_DAMAGE_PCT_PER_SEC;
}

/** True if the given world point is inside the safe zone. */
export function isInsideZone(x: number, z: number, radius: number): boolean {
  return x * x + z * z <= radius * radius;
}

export function distanceInsideZone(x: number, z: number, radius: number): number {
  return radius - Math.sqrt(x * x + z * z);
}

export function formatZoneTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec - m * 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

// ─── Public helpers for other labyrinth modules ──────────────────────────────

/** Number of shrink phases. Exposed so LabyrinthPortal.ts can compute
 *  phase-aligned spawn radii without duplicating schedule math. */
export function zoneTotalPhases(): number {
  return TOTAL_PHASES;
}

/** Radius the zone will reach at the end of the given phase's shrink
 *  window. `phase` may exceed TOTAL_PHASES-1; clamps to final radius. */
export function zonePhaseBoundaryRadius(phase: number): number {
  const p = Math.max(0, Math.min(TOTAL_PHASES, phase));
  return lerpPhaseRadius(p / TOTAL_PHASES);
}
