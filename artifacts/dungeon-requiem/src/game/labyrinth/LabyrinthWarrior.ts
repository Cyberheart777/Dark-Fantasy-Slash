/**
 * LabyrinthWarrior.ts
 *
 * Warrior-flavoured passives for Labyrinth mode. Mirrors the three
 * "feels like the warrior" effects from the main game's PlayerRuntime
 * without importing GameScene or the upgrade system:
 *
 *   • Blood Momentum — +3% damage per consecutive hit (cap 20 → +60%).
 *     Stacks on each enemy landed; resets after 3s without landing.
 *   • Bloodforge — +1 maxHp per kill, cap 20 HP this run.
 *   • Critical hits — warrior's base critChance (5% from CharacterData).
 *     Crits deal 2× base damage.
 *   • War Cry (auto) — when HP drops below 30%, pop a 4s +25% damage
 *     buff. 20s cooldown so it can't spam.
 *
 * Zero coupling: all of this lives in LabWarriorState, a plain object.
 * Combat code calls `modifyOutgoingDamage()` before applying damage,
 * and `registerHit` / `registerKill` afterwards. No shared mutable state
 * with the main game.
 *
 * Source anchors (for parity tuning):
 *   Blood Momentum        → GameScene.tsx:1177, 1394-1399, 409
 *   Bloodforge            → GameScene.tsx:420-429, 1762
 *   War Cry               → GameScene.tsx:1051, 1089, 1403, 427
 *   critChance base value → CharacterData.ts:54 (warrior: 0.05)
 */

// ─── Tuning ──────────────────────────────────────────────────────────────────

const BLOOD_MOMENTUM_PER_STACK = 0.03;      // +3% damage per stack
const BLOOD_MOMENTUM_MAX_STACKS = 20;       // +60% damage cap
const BLOOD_MOMENTUM_RESET_SEC = 3;         // reset window after last hit

const BLOODFORGE_HP_PER_KILL = 1;
const BLOODFORGE_MAX_HP_GAIN = 20;          // cap per run

const WAR_CRY_TRIGGER_HP_FRAC = 0.30;       // pop at <30% HP
const WAR_CRY_DAMAGE_BUFF = 0.25;           // +25% damage
const WAR_CRY_DURATION_SEC = 4;
const WAR_CRY_COOLDOWN_SEC = 20;

const CRIT_MULTIPLIER = 2;                  // crits deal 2× base damage

// ─── State ───────────────────────────────────────────────────────────────────

export interface LabWarriorState {
  // Blood Momentum
  momentumStacks: number;
  momentumTimer: number;    // counts DOWN; when it hits 0, stacks reset
  // Bloodforge
  bloodforgeGain: number;   // total HP gained this run (cap BLOODFORGE_MAX_HP_GAIN)
  // War Cry
  warCryTimer: number;      // active duration remaining (0 = inactive)
  warCryCooldown: number;   // ICD remaining before next auto-pop
  // Transient per-frame — read once by the HUD then cleared
  lastHitWasCrit: boolean;
}

export function makeLabWarriorState(): LabWarriorState {
  return {
    momentumStacks: 0,
    momentumTimer: 0,
    bloodforgeGain: 0,
    warCryTimer: 0,
    warCryCooldown: 0,
    lastHitWasCrit: false,
  };
}

/** Advance timers each frame. Resets Blood Momentum stacks when the
 *  reset window elapses. War Cry expires when timer reaches 0. */
export function tickLabWarrior(state: LabWarriorState, delta: number): void {
  if (state.momentumTimer > 0) {
    state.momentumTimer = Math.max(0, state.momentumTimer - delta);
    if (state.momentumTimer === 0) state.momentumStacks = 0;
  }
  if (state.warCryTimer > 0) {
    state.warCryTimer = Math.max(0, state.warCryTimer - delta);
  }
  if (state.warCryCooldown > 0) {
    state.warCryCooldown = Math.max(0, state.warCryCooldown - delta);
  }
}

/** Call on each frame where player HP dipped; auto-pops War Cry if the
 *  HP fraction dropped below threshold AND cooldown is ready. */
export function maybeTriggerWarCry(
  state: LabWarriorState,
  hp: number,
  maxHp: number,
): boolean {
  if (hp <= 0) return false;
  if (state.warCryTimer > 0) return false;
  if (state.warCryCooldown > 0) return false;
  if (hp / maxHp > WAR_CRY_TRIGGER_HP_FRAC) return false;
  state.warCryTimer = WAR_CRY_DURATION_SEC;
  state.warCryCooldown = WAR_CRY_COOLDOWN_SEC;
  return true;
}

/** Compute outgoing damage for a single hit. Applies crit roll (with
 *  the warrior's base critChance) and combines Blood Momentum + War Cry
 *  multiplicatively. Stamps `state.lastHitWasCrit` for HUD readback. */
export function modifyOutgoingDamage(
  state: LabWarriorState,
  baseDamage: number,
  critChance: number,
  momentumPerStack = BLOOD_MOMENTUM_PER_STACK,
  critDmgMult = CRIT_MULTIPLIER,
): number {
  const isCrit = Math.random() < critChance;
  state.lastHitWasCrit = isCrit;
  const momentumMult = 1 + state.momentumStacks * momentumPerStack;
  const warCryMult = state.warCryTimer > 0 ? 1 + WAR_CRY_DAMAGE_BUFF : 1;
  const critMult = isCrit ? critDmgMult : 1;
  return baseDamage * momentumMult * warCryMult * critMult;
}

/** Call once per enemy actually hit this frame. Advances Blood Momentum
 *  stacks and refreshes the reset timer. */
export function registerHit(state: LabWarriorState): void {
  if (state.momentumStacks < BLOOD_MOMENTUM_MAX_STACKS) {
    state.momentumStacks += 1;
  }
  state.momentumTimer = BLOOD_MOMENTUM_RESET_SEC;
}

/** Call once per enemy killed. Awards Bloodforge max-HP gain (capped
 *  per run). Returns the amount actually granted this call so caller
 *  can bump both maxHp and current hp. */
export function registerKill(state: LabWarriorState, hpPerKill = BLOODFORGE_HP_PER_KILL, maxGain = BLOODFORGE_MAX_HP_GAIN): number {
  if (state.bloodforgeGain >= maxGain) return 0;
  const awarded = Math.min(hpPerKill, maxGain - state.bloodforgeGain);
  state.bloodforgeGain += awarded;
  return awarded;
}

// ─── Snapshot helpers for HUD polling ────────────────────────────────────────

export interface LabWarriorSnapshot {
  momentumStacks: number;
  momentumMult: number;       // 1.00 .. 1.60
  warCryActive: boolean;
  warCrySec: number;
  bloodforgeGain: number;
  bloodforgeCap: number;
}

export function snapshotLabWarrior(state: LabWarriorState): LabWarriorSnapshot {
  return {
    momentumStacks: state.momentumStacks,
    momentumMult: 1 + state.momentumStacks * BLOOD_MOMENTUM_PER_STACK,
    warCryActive: state.warCryTimer > 0,
    warCrySec: state.warCryTimer,
    bloodforgeGain: state.bloodforgeGain,
    bloodforgeCap: BLOODFORGE_MAX_HP_GAIN,
  };
}
