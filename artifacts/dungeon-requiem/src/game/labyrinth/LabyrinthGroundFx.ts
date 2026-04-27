/**
 * LabyrinthGroundFx.ts
 *
 * Ported from the main game's GroundEffect data model (GameScene.tsx:167-175)
 * and renderer (GameScene.tsx:2776-2800). Used in the Labyrinth to drop
 * short-lived poison-mist pools at the player's feet while they're in
 * the shroud — gives the zone damage a visceral "sickness trail" instead
 * of a featureless edge of safety.
 *
 * The main game's ground effects double as damage sources; the
 * Labyrinth version is VISUAL-ONLY — damage is already handled by
 * LabyrinthPoison. Keeping the two concerns separate means we can tune
 * visual density without re-tuning damage.
 */

export interface LabGroundFx {
  id: string;
  x: number;
  z: number;
  radius: number;
  lifetime: number; // seconds remaining; 0 → evict
  color: string;
  dps?: number;
  appliesPoison?: boolean;
}

const SHROUD_MIST_INTERVAL_SEC = 0.35;
const SHROUD_MIST_LIFETIME_SEC = 1.6;
const SHROUD_MIST_RADIUS = 1.8;
const SHROUD_MIST_COLOR = "#9bff6a"; // toxic green matching the main-game shroud palette
const MAX_ACTIVE = 30;

let fxId = 0;

/** State for the mist-trail emitter. One per scene. */
export interface LabShroudMistEmitter {
  /** Time since last spawn; resets on each spawn. */
  cooldown: number;
}

export function makeShroudMistEmitter(): LabShroudMistEmitter {
  return { cooldown: 0 };
}

/** Advance emitter cooldown and spawn a new mist puff if the player is
 *  outside the safe zone. Uses a per-frame cooldown (not a sleep) so
 *  movement speed doesn't affect trail density. */
export function tickShroudMist(
  emitter: LabShroudMistEmitter,
  list: LabGroundFx[],
  outside: boolean,
  px: number,
  pz: number,
  delta: number,
): void {
  emitter.cooldown = Math.max(0, emitter.cooldown - delta);
  if (!outside) return;
  if (emitter.cooldown > 0) return;
  list.push({
    id: `labmist${fxId++}`,
    x: px,
    z: pz,
    radius: SHROUD_MIST_RADIUS,
    lifetime: SHROUD_MIST_LIFETIME_SEC,
    color: SHROUD_MIST_COLOR,
  });
  if (list.length > MAX_ACTIVE) list.splice(0, list.length - MAX_ACTIVE);
  emitter.cooldown = SHROUD_MIST_INTERVAL_SEC;
}

/** Advance each active effect's lifetime. Returns the survivors. */
export function tickGroundFx(list: LabGroundFx[], delta: number): LabGroundFx[] {
  for (const ge of list) ge.lifetime -= delta;
  return list.filter((ge) => ge.lifetime > 0);
}
