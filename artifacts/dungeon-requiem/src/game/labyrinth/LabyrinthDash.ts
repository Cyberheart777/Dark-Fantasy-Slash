/**
 * LabyrinthDash.ts
 *
 * Self-contained dash state for The Labyrinth. Mirrors the main game's
 * dash math (GameConfig.PLAYER.DASH_SPEED = 22, DASH_DURATION = 0.18)
 * without importing GameScene or its runtime. Class-specific dash
 * variants (warrior knockback, mage blink, rogue poison trail) are a
 * later step — this module ships the generic "burst of speed" dash so
 * all three classes have working evasion today.
 *
 * Usage from LabyrinthScene:
 *
 *   const dashRef = useRef(makeLabDashState());
 *   // each frame:
 *   tickLabDashState(dashRef.current, delta);
 *   if (input.state.dash) {
 *     input.consumeDash();
 *     tryStartLabDash(dashRef.current, facingX, facingZ, classDef.dashCooldown);
 *   }
 *   if (dashRef.current.timer > 0) {
 *     // skip normal joystick movement; apply (dashVX, dashVZ) * delta
 *   }
 */

/** Runtime state of the labyrinth dash system. */
export interface LabDashState {
  /** Seconds remaining in the active dash. 0 → not dashing. */
  timer: number;
  /** Seconds remaining until the next dash is allowed. 0 → ready. */
  cooldown: number;
  /** World-frame velocity applied each frame while `timer > 0`. */
  vx: number;
  vz: number;
}

/** Matches GameConfig.PLAYER.DASH_SPEED. */
export const LAB_DASH_SPEED = 22;
/** Matches GameConfig.PLAYER.DASH_DURATION. */
export const LAB_DASH_DURATION = 0.18;

export function makeLabDashState(): LabDashState {
  return { timer: 0, cooldown: 0, vx: 0, vz: 0 };
}

/** Advance timers each frame. No movement is applied here — the caller
 *  consumes `(vx, vz)` while `timer > 0`. */
export function tickLabDashState(s: LabDashState, delta: number): void {
  if (s.timer > 0) {
    s.timer = Math.max(0, s.timer - delta);
    if (s.timer === 0) {
      s.vx = 0;
      s.vz = 0;
    }
  }
  if (s.cooldown > 0) {
    s.cooldown = Math.max(0, s.cooldown - delta);
  }
}

/** Start a dash if the cooldown is ready and a direction is provided.
 *  Returns `true` if the dash started, `false` if the request was
 *  rejected (on cooldown or no direction).
 *
 *  @param dirX  Normalized world-frame X component of dash direction.
 *  @param dirZ  Normalized world-frame Z component of dash direction.
 *               If both are 0, the dash request is rejected — the main
 *               game uses the facing angle as a fallback; callers should
 *               provide that fallback before calling this function so
 *               the module stays direction-agnostic.
 *  @param cooldownSec  Per-class cooldown from CHARACTER_DATA[class].dashCooldown.
 */
export function tryStartLabDash(
  s: LabDashState,
  dirX: number,
  dirZ: number,
  cooldownSec: number,
): boolean {
  if (s.cooldown > 0) return false;
  if (dirX === 0 && dirZ === 0) return false;
  // Caller should already have normalized the direction; we guard anyway.
  const mag = Math.sqrt(dirX * dirX + dirZ * dirZ);
  if (mag === 0) return false;
  const nx = dirX / mag;
  const nz = dirZ / mag;
  s.timer = LAB_DASH_DURATION;
  s.vx = nx * LAB_DASH_SPEED;
  s.vz = nz * LAB_DASH_SPEED;
  s.cooldown = cooldownSec;
  return true;
}

/** Convenience: true while the dash is actively applying velocity. */
export function isLabDashing(s: LabDashState): boolean {
  return s.timer > 0;
}
