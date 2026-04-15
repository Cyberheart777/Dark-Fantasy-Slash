/**
 * LabyrinthGear.ts
 *
 * Run-only gear/equipment system for the Labyrinth. Enemies roll gear
 * via the main-game's tryRollGear() (read-only reuse of GearData.ts).
 * Dropped gear renders as a floating gem; pickup auto-equips (or swaps
 * and drops the old piece). Bonuses re-compute immediately on equip.
 *
 * Labyrinth gear is RUN-ONLY. It never bleeds into the main-game
 * inventory or gear stash. At run end, every equipped + unlooted
 * piece auto-salvages into Soul Forge crystals via
 * useMetaStore.getState().addShards(total). Salvage values mirror
 * the main-game table (not exported from metaStore — see LAB_SALVAGE_VALUE).
 */

import { getEnhancedBonuses, tryRollGear, type GearDef } from "../../data/GearData";

// ─── Tunable constants ───────────────────────────────────────────────────────

/** Multiplier passed to tryRollGear(enemyType, dropMult). Main-game
 *  difficulties pass 1.0 (Normal), 1.15 (Hard), 1.30 (Nightmare). We
 *  stay at 1.0 for base rates matching the main game's Normal. Raise
 *  this if drops feel too sparse in playtest. */
export const LAB_DROP_MULT = 1.0;

/** Pickup radius in world units. Tighter than main game's 3.0 because
 *  labyrinth corridors are narrow and auto-pickup can feel intrusive. */
export const LAB_PICKUP_RADIUS = 2.0;

/** Seconds before an unlooted ground drop despawns. */
export const LAB_GEAR_LIFETIME = 12;

/** Mirrors GEAR_SELL_VALUE at src/store/metaStore.ts:152-157. NOT
 *  exported from the core store, so we mirror here with a source
 *  anchor comment. If those values change in main game, update here
 *  in tandem. Per-rarity, flat — does NOT scale with enhanceLevel. */
export const LAB_SALVAGE_VALUE: Record<string, number> = {
  common: 5,
  rare: 15,
  epic: 35,
};

// ─── Enemy-kind → main-game enemy-type mapping ───────────────────────────────

/** Maps labyrinth enemy kinds to main-game enemy-type keys used by
 *  GEAR_DROP_RATES (GearData.ts:174-184). Also carries a per-kind
 *  drop-rate multiplier so tougher kinds drop more often. */
const ENEMY_TYPE_FOR_ROLL: Record<string, { type: string; mult: number }> = {
  corridor_guardian: { type: "elite",             mult: 1.0 },
  trap_spawner:      { type: "wraith",            mult: 1.0 },
  mimic:             { type: "scuttler",          mult: 1.4 },
  shadow_stalker:    { type: "wraith",            mult: 1.2 },
  warden:            { type: "boss",              mult: 3.0 },
  champion:          { type: "warrior_champion",  mult: 2.0 },
};

/** Attempt a gear drop for the given labyrinth enemy kind. Returns
 *  a GearDef or null if nothing rolls. Wraps the main-game
 *  tryRollGear() with labyrinth-specific type mapping + dropMult. */
export function rollLabGearDrop(enemyKind: string): GearDef | null {
  const mapping = ENEMY_TYPE_FOR_ROLL[enemyKind];
  if (!mapping) return null;
  return tryRollGear(mapping.type, LAB_DROP_MULT * mapping.mult);
}

// ─── Ground drops ────────────────────────────────────────────────────────────

/** Gear currently on the ground, waiting to be picked up. Shape mirrors
 *  the main game's GearDropRuntime (GameScene.tsx:237-243). */
export interface LabGearDropRuntime {
  id: string;
  x: number;
  z: number;
  gear: GearDef;
  /** Phase offset so multiple drops don't bob in sync. */
  floatOffset: number;
  /** Seconds remaining before despawn. */
  lifetime: number;
}

let dropIdCounter = 0;

export function spawnLabGearDrop(
  list: LabGearDropRuntime[],
  gear: GearDef,
  x: number,
  z: number,
): void {
  list.push({
    id: `labgear${dropIdCounter++}`,
    x,
    z,
    gear,
    floatOffset: Math.random() * Math.PI * 2,
    lifetime: LAB_GEAR_LIFETIME,
  });
}

/** Per-frame tick: advance lifetimes, return the first drop the player
 *  walked over this frame (or null). The caller is responsible for
 *  calling equipLabGear() with the returned gear + applying maxHealth
 *  delta to the player. Lifetime-expired drops are filtered out in place. */
export function tickLabGearDrops(
  list: LabGearDropRuntime[],
  delta: number,
  playerX: number,
  playerZ: number,
): { pickedUp: GearDef | null; changed: boolean } {
  let pickedUp: GearDef | null = null;
  let pickedIdx = -1;
  const r2 = LAB_PICKUP_RADIUS * LAB_PICKUP_RADIUS;
  for (let i = 0; i < list.length; i++) {
    const d = list[i];
    d.lifetime -= delta;
    if (pickedUp !== null) continue; // still tick lifetimes for the others
    const dx = playerX - d.x;
    const dz = playerZ - d.z;
    if (dx * dx + dz * dz <= r2) {
      pickedUp = d.gear;
      pickedIdx = i;
    }
  }
  // Evict: the picked-up index + any expired drops. Done in one pass.
  let changed = false;
  if (pickedIdx >= 0) {
    list.splice(pickedIdx, 1);
    changed = true;
  }
  let w = 0;
  for (let r = 0; r < list.length; r++) {
    if (list[r].lifetime > 0) {
      list[w++] = list[r];
    } else {
      changed = true;
    }
  }
  list.length = w;
  return { pickedUp, changed };
}

// ─── Equipped state + bonuses ────────────────────────────────────────────────

/** The labyrinth's own equipped-gear holder. Deliberately decoupled
 *  from main-game GameState.equippedGear so run-only gear never
 *  leaks into the persistent inventory pipeline. */
export interface LabGearState {
  weapon: GearDef | null;
  armor: GearDef | null;
  trinket: GearDef | null;
  /** Cached sum of enhanced bonuses from all three slots. Refreshed
   *  by recomputeBonuses() on every equip. Combat code reads this
   *  directly — no need to recompute per frame. */
  bonuses: Record<string, number>;
}

export function makeLabGearState(): LabGearState {
  return { weapon: null, armor: null, trinket: null, bonuses: {} };
}

/** Recompute `state.bonuses` by summing enhanced bonuses from all three
 *  slots. Called immediately inside equipLabGear() so subsequent reads
 *  (combat tick, HUD poll) see fresh values THIS frame. */
export function recomputeBonuses(state: LabGearState): void {
  const out: Record<string, number> = {};
  for (const slot of [state.weapon, state.armor, state.trinket]) {
    if (!slot) continue;
    const bonuses = getEnhancedBonuses(slot);
    for (const [k, v] of Object.entries(bonuses)) {
      out[k] = (out[k] ?? 0) + v;
    }
  }
  state.bonuses = out;
}

/** Equip a gear piece into its slot.
 *   - If the slot is empty: equip, return { oldGear: null, maxHealthDelta: +new }.
 *   - If the slot is occupied: swap, return the old piece so the caller
 *     can drop it back to the ground. maxHealthDelta = newMaxHealth −
 *     oldMaxHealth so the caller can update player.maxHp (and heal by
 *     the delta, mirroring main-game equipGear behaviour).
 */
export function equipLabGear(
  state: LabGearState,
  gear: GearDef,
): { oldGear: GearDef | null; maxHealthDelta: number } {
  const slot = gear.slot;
  const oldGear = state[slot] ?? null;
  const oldMaxHealth = oldGear ? (getEnhancedBonuses(oldGear).maxHealth ?? 0) : 0;
  const newMaxHealth = getEnhancedBonuses(gear).maxHealth ?? 0;
  state[slot] = gear;
  recomputeBonuses(state);
  return { oldGear, maxHealthDelta: newMaxHealth - oldMaxHealth };
}

// ─── Run-end salvage ─────────────────────────────────────────────────────────

/** Compute total Soul Forge crystals earned by salvaging every
 *  equipped piece + every unlooted ground drop. Caller deposits via
 *  useMetaStore.getState().addShards(total). Uses LAB_SALVAGE_VALUE
 *  (mirrors main-game GEAR_SELL_VALUE). */
export function salvageLabGear(
  state: LabGearState,
  unlootedDrops: LabGearDropRuntime[],
): number {
  let total = 0;
  const addValue = (g: GearDef | null) => {
    if (!g) return;
    total += LAB_SALVAGE_VALUE[g.rarity] ?? 0;
  };
  addValue(state.weapon);
  addValue(state.armor);
  addValue(state.trinket);
  for (const drop of unlootedDrops) {
    addValue(drop.gear);
  }
  return total;
}
