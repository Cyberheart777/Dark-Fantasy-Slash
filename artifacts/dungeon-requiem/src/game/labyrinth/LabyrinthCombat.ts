/**
 * LabyrinthCombat.ts
 *
 * Minimal player-side combat for the Labyrinth. Self-contained — does
 * NOT share state with the main game's combat system in GameScene.tsx.
 *
 * Attack model: on input.attack (spacebar / mouse click / mobile button),
 * the player makes a single 120° forward swing that damages every live
 * enemy whose position lies inside the arc within SWING_RANGE. One-hit
 * check per swing — no multi-frame hit detection, no combo system yet.
 *
 * Why the same math as the main game? Because when Step 5 wires up
 * Labyrinth-local progression, we want the same damage/range numbers
 * to read cleanly from PlayerStats (damage, atkRange). The interface
 * here matches the `stats` shape used in GameScene.tsx so the switch
 * is trivial later.
 */

export interface LabCombatStats {
  /** Base weapon damage applied per swing. */
  damage: number;
  /** Reach of the swing in world units. */
  atkRange: number;
  /** Seconds between swings. */
  atkCooldown: number;
}

/** Baseline combat stats for the Labyrinth until progression is wired
 *  up in Step 5. Roughly matches the core game's warrior baseline
 *  (CharacterData.ts: warrior damage 35, ranges 2.5–3). */
export const LAB_COMBAT_BASELINE: LabCombatStats = {
  damage: 30,
  atkRange: 3.2,
  atkCooldown: 0.6,
};

/** Half-width of the forward swing arc in radians. Full arc = 2× this. */
export const SWING_HALF_ARC = (120 * Math.PI) / 180 / 2;

/** Visual window during which the swing arc is drawn. */
export const SWING_VISUAL_DURATION_SEC = 0.22;

export interface PlayerAttackState {
  /** Seconds remaining until the next swing is allowed. */
  cooldownSec: number;
  /** Seconds remaining for the arc-swing visual. 0 = not swinging. */
  swingVisualSec: number;
  /** Angle (radians, world-frame) the swing is locked to. */
  swingAngle: number;
  /** Reach (world units) the current swing was launched with. Cached so
   *  the renderer can use the same value the hit-test used. */
  swingRange: number;
}

export function makePlayerAttackState(): PlayerAttackState {
  return { cooldownSec: 0, swingVisualSec: 0, swingAngle: 0, swingRange: 0 };
}

export function tickAttackState(state: PlayerAttackState, delta: number): void {
  if (state.cooldownSec > 0) state.cooldownSec = Math.max(0, state.cooldownSec - delta);
  if (state.swingVisualSec > 0) state.swingVisualSec = Math.max(0, state.swingVisualSec - delta);
}

/** Start a swing if off cooldown. Returns true on success.
 *  `facingAngle` is the player's facing (radians, world-frame). */
export function tryStartSwing(
  state: PlayerAttackState,
  facingAngle: number,
  stats: LabCombatStats,
): boolean {
  if (state.cooldownSec > 0) return false;
  state.cooldownSec = stats.atkCooldown;
  state.swingVisualSec = SWING_VISUAL_DURATION_SEC;
  state.swingAngle = facingAngle;
  state.swingRange = stats.atkRange;
  return true;
}

/** True if a target at (tx, tz) lies in the swing arc centered at (cx, cz)
 *  with the given facing angle. Uses the same atan2 convention as the
 *  player's movement-derived `angle` (Math.atan2(dx, -dz) in Scene.tsx:371). */
export function isInSwingArc(
  cx: number,
  cz: number,
  facingAngle: number,
  tx: number,
  tz: number,
  range: number,
): boolean {
  const dx = tx - cx;
  const dz = tz - cz;
  const distSq = dx * dx + dz * dz;
  if (distSq > range * range) return false;
  // Match the facing convention: angle 0 = -Z axis, +X rotates clockwise.
  const targetAngle = Math.atan2(dx, -dz);
  // Smallest signed difference, wrapped to [-π, π].
  let diff = targetAngle - facingAngle;
  while (diff > Math.PI) diff -= 2 * Math.PI;
  while (diff < -Math.PI) diff += 2 * Math.PI;
  return Math.abs(diff) <= SWING_HALF_ARC;
}
