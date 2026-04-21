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

/** Inventory capacity. Matches the main game's inventory cap so a
 *  labyrinth run can hold as much spare gear as a main-game run
 *  before auto-salvage at extraction. Hardcoded both here and in
 *  the character-view render (PauseMenu.tsx uses the same 20 for
 *  "SPARE GEAR (N/20)") — bump in both places if changed. */
export const LAB_INVENTORY_CAPACITY = 20;

// ─── Enemy-kind → main-game enemy-type mapping ───────────────────────────────

/** Maps labyrinth enemy kinds to main-game enemy-type keys used by
 *  GEAR_DROP_RATES (GearData.ts:174-184). Also carries a per-kind
 *  drop-rate multiplier so tougher kinds drop more often. */
const ENEMY_TYPE_FOR_ROLL: Record<string, { type: string; mult: number }> = {
  corridor_guardian: { type: "elite",             mult: 3.0 },
  trap_spawner:      { type: "wraith",            mult: 3.0 },
  mimic:             { type: "elite",             mult: 4.0 },
  shadow_stalker:    { type: "elite",             mult: 2.5 },
  warden:            { type: "boss",              mult: 5.0 },
  champion:          { type: "warrior_champion",  mult: 2.0 },
};

/** Attempt a gear drop for the given labyrinth enemy kind. Returns
 *  a GearDef or null if nothing rolls. Wraps the main-game
 *  tryRollGear() with labyrinth-specific type mapping + dropMult. */
export function rollLabGearDrop(enemyKind: string, extraMult = 1): GearDef | null {
  const mapping = ENEMY_TYPE_FOR_ROLL[enemyKind];
  if (!mapping) return null;
  return tryRollGear(mapping.type, LAB_DROP_MULT * mapping.mult * extraMult);
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
  /** Override lifetime (seconds). Default = LAB_GEAR_LIFETIME.
   *  Pass Number.POSITIVE_INFINITY for "permanent" drops (e.g.,
   *  minor-reward-room gear that sits waiting for the player to
   *  find it). */
  lifetimeSec: number = LAB_GEAR_LIFETIME,
): void {
  list.push({
    id: `labgear${dropIdCounter++}`,
    x,
    z,
    gear,
    floatOffset: Math.random() * Math.PI * 2,
    lifetime: lifetimeSec,
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
  /** Run-only inventory of unequipped gear. Capped at
   *  LAB_INVENTORY_CAPACITY (20). New pickups go here first; only
   *  slotted into an EQUIPPED slot if that slot is empty OR the
   *  player explicitly swaps via the pause-menu Character view.
   *  Auto-salvaged alongside equipped gear at run end. */
  inventory: GearDef[];
}

export function makeLabGearState(): LabGearState {
  return { weapon: null, armor: null, trinket: null, bonuses: {}, inventory: [] };
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

/** Outcome of a pickup-path decision. The scene uses this to know
 *  whether to drop the old equipped piece back to the ground (only
 *  happens when the inventory was full at pickup time). */
export interface PickupResult {
  /** Where the newly picked-up gear ended up. */
  placement: "equipped" | "inventory" | "dropped";
  /** If placement==="equipped" and the slot was occupied, this is
   *  the PREVIOUS equipped piece that's been moved out. Null when
   *  the slot was empty. When dropped=true we drop this back to
   *  the ground (inventory was full so we had to swap). */
  displacedGear: GearDef | null;
  /** Net change to player.maxHp from the equip. Caller applies it
   *  to playerRef.current.maxHp + heals by the delta. 0 when the
   *  pickup just went into the inventory. */
  maxHealthDelta: number;
}

/** Decide what happens when the player walks over a gear drop.
 *
 *   1. Slot empty           → equip directly, no displacement.
 *   2. Slot occupied + inventory has space → put NEW gear in
 *      inventory. Equipped is untouched. Player can swap later
 *      from the pause-menu Character view.
 *   3. Slot occupied + inventory FULL → swap and drop the old
 *      equipped piece back on the ground (same as the old
 *      equipLabGear behaviour). Prevents hard-locking the player
 *      out of new gear once they've hoarded 20 pieces.
 */
export function pickupLabGear(
  state: LabGearState,
  gear: GearDef,
): PickupResult {
  const slot = gear.slot;
  const existing = state[slot] ?? null;

  // Case 1 — empty slot, direct equip.
  if (!existing) {
    const newMaxHealth = getEnhancedBonuses(gear).maxHealth ?? 0;
    state[slot] = gear;
    recomputeBonuses(state);
    return { placement: "equipped", displacedGear: null, maxHealthDelta: newMaxHealth };
  }

  // Case 2 — slot occupied, inventory has room: stash pickup.
  if (state.inventory.length < LAB_INVENTORY_CAPACITY) {
    state.inventory.push(gear);
    return { placement: "inventory", displacedGear: null, maxHealthDelta: 0 };
  }

  // Case 3 — slot occupied, inventory full: swap + drop old.
  const oldMaxHealth = getEnhancedBonuses(existing).maxHealth ?? 0;
  const newMaxHealth = getEnhancedBonuses(gear).maxHealth ?? 0;
  state[slot] = gear;
  recomputeBonuses(state);
  return { placement: "dropped", displacedGear: existing, maxHealthDelta: newMaxHealth - oldMaxHealth };
}

/** Equip the inventory[index] item into its matching slot, moving
 *  any currently-equipped piece into the vacated inventory slot
 *  (swap). maxHealthDelta is the net HP change the caller applies
 *  to the player. Returns null if the index is out of bounds. */
export function equipFromInventory(
  state: LabGearState,
  index: number,
): { maxHealthDelta: number } | null {
  const item = state.inventory[index];
  if (!item) return null;
  const slot = item.slot;
  const existing = state[slot] ?? null;
  const oldMaxHealth = existing ? (getEnhancedBonuses(existing).maxHealth ?? 0) : 0;
  const newMaxHealth = getEnhancedBonuses(item).maxHealth ?? 0;
  state[slot] = item;
  // Replace inventory slot with the displaced gear (or remove if
  // nothing was equipped). splice keeps the inventory indices
  // stable for the rest of the list.
  if (existing) {
    state.inventory[index] = existing;
  } else {
    state.inventory.splice(index, 1);
  }
  recomputeBonuses(state);
  return { maxHealthDelta: newMaxHealth - oldMaxHealth };
}

/** Sell the inventory[index] item for its salvage value. Returns
 *  the crystal amount (LAB_SALVAGE_VALUE[rarity]) for the caller
 *  to deposit via useMetaStore.getState().addShards(amount). */
export function sellFromInventory(
  state: LabGearState,
  index: number,
): number {
  const item = state.inventory[index];
  if (!item) return 0;
  const value = LAB_SALVAGE_VALUE[item.rarity] ?? 0;
  state.inventory.splice(index, 1);
  return value;
}

// ─── Run-end salvage ─────────────────────────────────────────────────────────

/** Compute total Soul Forge crystals earned by salvaging every
 *  equipped piece + every inventory item + every unlooted ground
 *  drop. Caller deposits via useMetaStore.getState().addShards(total).
 *  Uses LAB_SALVAGE_VALUE (mirrors main-game GEAR_SELL_VALUE). */
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
  for (const item of state.inventory) addValue(item);
  for (const drop of unlootedDrops) addValue(drop.gear);
  return total;
}
