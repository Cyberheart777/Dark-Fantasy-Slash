/**
 * LabyrinthDeathFx.ts
 *
 * Copy of the main game's DeathFx data model (GameScene.tsx:227-235) and
 * spawn helper (GameScene.tsx:363-380). Ported rather than imported so
 * the Labyrinth stays self-contained per REPLIT_CONTEXT.md invariant —
 * if the main game tweaks its death-burst tuning, the Labyrinth keeps
 * its own feel and won't be affected by that change. If we ever want
 * perfect parity, this becomes a trivial re-export.
 */

/** A single enemy-death particle burst. Short-lived, 7 puffs + flash. */
export interface LabDeathFx {
  id: string;
  x: number;
  z: number;
  age: number;
  duration: number;
  color: string;
  puffs: { vx: number; vy: number; vz: number }[];
}

const PUFF_COUNT = 7;
const MAX_ACTIVE = 40;
const DURATION_SEC = 0.55;

let fxId = 0;

/** Push a new burst into the list. Caps the list at MAX_ACTIVE so a
 *  long run can't grow the particle pool unboundedly. Tuning exactly
 *  matches GameScene.tsx:363-380 — speed 2.2–3.6 horizontal, 1.4–3.0
 *  vertical, duration 0.55s. */
export function spawnLabDeathFx(
  list: LabDeathFx[],
  x: number,
  z: number,
  color: string,
): void {
  const puffs: { vx: number; vy: number; vz: number }[] = [];
  for (let i = 0; i < PUFF_COUNT; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 2.2 + Math.random() * 1.4;
    puffs.push({
      vx: Math.sin(angle) * speed,
      vy: 1.4 + Math.random() * 1.6,
      vz: Math.cos(angle) * speed,
    });
  }
  list.push({
    id: `labfx${fxId++}`,
    x, z,
    age: 0,
    duration: DURATION_SEC,
    color,
    puffs,
  });
  if (list.length > MAX_ACTIVE) list.splice(0, list.length - MAX_ACTIVE);
}

/** Advance every active burst's `age`. Returns the subset still alive. */
export function tickLabDeathFx(list: LabDeathFx[], delta: number): LabDeathFx[] {
  for (const fx of list) fx.age += delta;
  return list.filter((fx) => fx.age < fx.duration);
}
