/**
 * LabyrinthPoison.ts
 *
 * Labyrinth-local mirror of the main game's poison-stack system.
 * The Labyrinth zone shroud applies poison stacks to the player instead
 * of flat percent-HP damage — this way, the Rogue's Venom Stack (+4 DPS
 * per stack) and Deep Wounds (x1.5 per rank) power-ups automatically
 * scale the zone's danger when those upgrades are present.
 *
 * Why not reuse the enemy poison tick directly?
 *   The base game's poison state lives on EnemyRuntime
 *   (GameScene.tsx:112-113) — there are no player-side poison fields.
 *   We intentionally do NOT modify GameScene.tsx to keep this feature
 *   fully self-contained in the Labyrinth folder. Instead, we mirror
 *   the exact same tick math (hp -= stacks * dps * delta, see
 *   GameScene.tsx:1540-1541) and read the same stats fields
 *   (venomStackDps + deepWoundsMultiplier) from whatever stats source
 *   the Labyrinth eventually wires up.
 *
 * Differences from the base poison system:
 *   - Labyrinth shroud accrues +1 stack per second while outside the
 *     safe zone, capped at 5 (matches the enemy stack cap).
 *   - Stacks fully reset after 3 continuous seconds in the safe zone.
 *     (Base poison has no decay — stacks only drop when the enemy dies.)
 */

/** Minimum stats shape needed to compute shroud DPS. Compatible with
 *  the real PlayerStats from UpgradeData.ts; the Labyrinth can pass a
 *  subset or undefined for baseline behavior. */
export interface LabPoisonStats {
  venomStackDps: number;
  deepWoundsMultiplier: number;
}

export interface LabPoisonState {
  /** 0..LAB_POISON_MAX_STACKS. Accumulates outside the zone, resets to 0
   *  after LAB_POISON_FALLOFF_SEC seconds continuously in the zone. */
  stacks: number;
  /** Damage-per-second per stack at the moment of last application.
   *  Matches the enemy application pattern at GameScene.tsx:1034. */
  dps: number;
  /** Seconds spent continuously inside the safe zone (reset when outside). */
  timeInSafeSec: number;
}

export const LAB_POISON_MAX_STACKS = 5;
export const LAB_POISON_STACK_ACCRUAL_PER_SEC = 1;
export const LAB_POISON_FALLOFF_SEC = 3;
/** Baseline per-stack DPS, matching GameScene.tsx:1026 / :1750
 *  (`venomStackDps > 0 ? venomStackDps : 3`). */
export const LAB_POISON_BASE_DPS = 3;

export function makeLabPoisonState(): LabPoisonState {
  return { stacks: 0, dps: 0, timeInSafeSec: 0 };
}

/** Compute DPS per stack. Mirrors GameScene.tsx:1026-1034 exactly:
 *  `poisonPerStack * deepWoundsMultiplier` with the "3 if no venomStackDps"
 *  baseline. Pass `undefined` to use baselines. */
export function computeShroudPerStackDps(stats?: LabPoisonStats): number {
  const perStack =
    stats && stats.venomStackDps > 0 ? stats.venomStackDps : LAB_POISON_BASE_DPS;
  const mult = stats?.deepWoundsMultiplier ?? 1.0;
  return perStack * mult;
}

/** Advance the player's shroud-poison state by one frame.
 *  Mutates `state` in place — same pattern as the main game's per-frame
 *  enemy poison bookkeeping. */
export function tickLabPoison(
  state: LabPoisonState,
  inSafe: boolean,
  delta: number,
  stats?: LabPoisonStats,
): void {
  if (!inSafe) {
    state.timeInSafeSec = 0;
    state.stacks = Math.min(
      LAB_POISON_MAX_STACKS,
      state.stacks + LAB_POISON_STACK_ACCRUAL_PER_SEC * delta,
    );
    // Refresh DPS every tick so mid-run stat changes (future power-ups)
    // apply immediately.
    state.dps = computeShroudPerStackDps(stats);
  } else {
    state.timeInSafeSec += delta;
    if (state.timeInSafeSec >= LAB_POISON_FALLOFF_SEC) {
      state.stacks = 0;
    }
  }
}

/** Apply the per-frame poison damage tick.
 *  Identical math to GameScene.tsx:1540-1541:
 *     `e.hp -= e.poisonStacks * e.poisonDps * delta` */
export function applyLabPoisonDamage(
  player: { hp: number; maxHp: number },
  state: LabPoisonState,
  delta: number,
): void {
  if (state.stacks <= 0 || state.dps <= 0) return;
  player.hp = Math.max(0, player.hp - state.stacks * state.dps * delta);
}

/** Inject poison stacks from an external source (e.g. a trapped chest
 *  exploding on the player). Respects the max-stacks cap and sets the
 *  dps baseline if not yet initialised. Does not affect the falloff
 *  timer — the player's time-in-safe starts counting anew only when
 *  they re-enter the safe zone. */
export function addLabPoisonStacks(
  state: LabPoisonState,
  amount: number,
  stats?: LabPoisonStats,
): void {
  state.stacks = Math.min(LAB_POISON_MAX_STACKS, state.stacks + amount);
  if (state.dps <= 0) state.dps = computeShroudPerStackDps(stats);
  state.timeInSafeSec = 0;
}
