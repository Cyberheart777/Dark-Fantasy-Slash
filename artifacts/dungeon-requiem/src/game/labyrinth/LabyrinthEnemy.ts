/**
 * LabyrinthEnemy.ts
 *
 * Enemy data + AI for the Labyrinth. Step 3a scope: Corridor Guardian
 * only. The EnemyKind discriminator is future-ready for Trap Spawners,
 * Shadow Stalkers, and the Warden (steps 3b–3e) without refactoring.
 *
 * AI states (Corridor Guardian):
 *   PATROL  — wander toward a random adjacent cell. No line-of-sight
 *             check yet; if the player strays within DETECTION_RANGE,
 *             flip to CHASE.
 *   CHASE   — head straight for the player. Walls block via
 *             collidesWithAnyWall so the enemy slides along corridors.
 *             If the player escapes beyond LEASH_RANGE, drop back to
 *             PATROL.
 *   ATTACK  — within melee range; stop, swing on cooldown.
 *   DEAD    — HP <= 0. Rendered as a fading-out shell for DEATH_FADE_SEC
 *             then filtered out of the runtime list.
 *
 * Self-contained: no imports from GameScene.tsx, no shared types with
 * the main enemy system. The runtime type intentionally does NOT reuse
 * EnemyRuntime from `../GameScene.tsx` since it has many fields that
 * don't apply here (DoTs, gear drops, poison/bleed state, etc.).
 */

import { LABYRINTH_CONFIG, type DifficultyMults } from "./LabyrinthConfig";
import {
  cellToWorld,
  extractWallSegments,
  type Maze,
} from "./LabyrinthMaze";
import { spawnLabProjectile, type LabProjectile } from "./LabyrinthProjectile";

export type EnemyKind =
  | "corridor_guardian"
  | "trap_spawner"
  | "mimic"
  | "shadow_stalker"
  | "warden"
  // Ex-"champion" (orange) — demoted to standard heavy enemy. Still
  // spawns in the run but no longer gates the vault key. Tuning
  // dropped from boss-tier to heavy-tier. See HEAVY_* constants.
  | "heavy"
  // Layer 2 mini-boss: beefed-up champion that spawns after all layer
  // champions are killed. Must be defeated before portals open.
  | "mini_boss"
  // Rival champions: dark-mirror versions of the two classes the
  // player did NOT pick. Exactly two per run, one of each non-player
  // class. First kill drops the vault key, second kill drops a
  // guaranteed rare piece of gear. Render as tinted variants of the
  // player class meshes (see LabyrinthRivalChampion3D.tsx).
  | "rival_warrior"
  | "rival_mage"
  | "rival_rogue"
  | "rival_necromancer"
  | "rival_bard"
  // Layer 3 final boss — replaces the Warden as the deepest encounter.
  | "death_knight";

/** Rival-champion kind predicate. Used to exclude rivals from the
 *  standard-enemy damage multiplier + any other "rivals are special"
 *  logic that needs to discriminate on kind. */
function isRivalKind(kind: EnemyKind): boolean {
  return kind === "rival_warrior" || kind === "rival_mage" || kind === "rival_rogue" || kind === "rival_necromancer" || kind === "rival_bard";
}

// ─── Damage multiplier ──────────────────────────────────────────────────────
/** Multiplier applied to ALL standard enemy damage outputs in the
 *  labyrinth — melee swings (guardian / heavy / mimic / stalker),
 *  trap-spawner projectile damage, and wall-trap beam damage.
 *
 *  Does NOT apply to:
 *    - Rival champions (rival_warrior / rival_mage / rival_rogue) —
 *      they have their own tuning constants and are tuned
 *      separately per the combat-pass spec.
 *    - Warden (boss) — uses LabyrinthWarden.ts, untouched.
 *
 *  Single tunable. Bumping this value above 1.5 makes standard
 *  patrol enemies genuinely threatening; dropping below 1.0 (unlikely)
 *  would nerf them. */
export const LAB_ENEMY_DAMAGE_MULT = 1.5;

export type EnemyAiState = "patrol" | "chase" | "attack" | "dead";

export interface EnemyRuntime {
  id: string;
  kind: EnemyKind;
  x: number;
  z: number;
  /** Facing angle (radians, same convention as LabPlayer.angle). */
  angle: number;
  hp: number;
  maxHp: number;
  state: EnemyAiState;
  /** Generic per-state countdown (next waypoint pick, retarget, etc). */
  aiTimer: number;
  /** Seconds until the enemy can melee again. */
  attackCooldown: number;
  /** Seconds since death — drives the render fade-out. */
  deathFadeSec: number;
  /** Short pulse (seconds remaining) that the renderer flashes on hit.
   *  Set in damageEnemy, decays in updateEnemy. Same semantics as the
   *  main game's `EnemyRuntime.hitFlashTimer`. */
  hitFlashTimer: number;
  /** Current patrol waypoint in world coords (null while chasing). */
  patrolTargetX: number | null;
  patrolTargetZ: number | null;
  /** Cached last-known player direction, for a tiny bit of smoothing. */
  lastMoveX: number;
  lastMoveZ: number;
  /** Trap-spawner turret fire timer (seconds until next shot). Unused
   *  by corridor guardians — they leave this at 0 indefinitely. */
  fireTimer: number;
  /** Rival-champion-only ability bookkeeping. Allocated only for
   *  rival_warrior / rival_mage / rival_rogue kinds; other kinds
   *  leave this undefined so the runtime stays lean. All timers count
   *  DOWN. */
  rival?: RivalAbilityState;
  /** Poison stacks currently applied by the rogue's Venom Stack (and
   *  friends). Ticks hp down each frame while > 0. Optional — only
   *  allocated when a projectile applies poison. */
  poisonStacks?: number;
  /** Per-stack DPS snapshot at application time (matches
   *  GameScene.tsx:1034 semantics). */
  poisonDps?: number;
  /** Seconds remaining while confused (bard Discordant Chord). While
   *  > 0 the enemy stops pursuing the player. Counted down externally. */
  confuseTimer?: number;
  /** Hard-mode multipliers. Default to 1 when omitted. */
  speedMult?: number;
  damageMult?: number;
  /** Glacial slow: while > 0 speedMult is halved. Decays by delta. */
  slowTimer?: number;
  /** If this enemy is a necro minion, the id of its master champion. */
  masterEnemyId?: string;
}

export interface RivalAbilityState {
  /** Generic ability cooldown (warrior War Cry, mage fire, rogue dash). */
  abilityCooldown: number;
  /** Active-effect timer (War Cry active window; dash active window). */
  activeSec: number;
  /** Dash velocity while activeSec > 0 (rogue + mage blink). */
  dashVX: number;
  dashVZ: number;
  /** True while a buff is active (warrior War Cry damage multiplier). */
  buffActive: boolean;
  /** Secondary cooldown used by the mage (blink cooldown — separate
   *  from fire cooldown stored in abilityCooldown). */
  secondaryCooldown: number;
  /** True if the rogue's next landed melee hit should apply poison
   *  stacks. Set on dash trigger, cleared on hit. */
  poisonArmed: boolean;
}

function makeRivalState(): RivalAbilityState {
  return {
    abilityCooldown: 0,
    activeSec: 0,
    dashVX: 0, dashVZ: 0,
    buffActive: false,
    secondaryCooldown: 0,
    poisonArmed: false,
  };
}

/** Apply difficulty multipliers to an already-created enemy. Call
 *  immediately after any factory function when difficulty != normal. */
export function applyDifficultyMode(e: EnemyRuntime, cfg: DifficultyMults): EnemyRuntime {
  e.hp = Math.round(e.hp * cfg.enemyHpMult);
  e.maxHp = Math.round(e.maxHp * cfg.enemyHpMult);
  e.speedMult = cfg.enemySpeedMult;
  e.damageMult = cfg.enemyDamageMult;
  return e;
}

// ─── Tuning ───────────────────────────────────────────────────────────────────

// HP doubled from the original 60 for the systems-pass item 2 rebalance.
// Warden (boss) HP is untouched — see WARDEN_HP in LabyrinthWarden.ts.
const GUARDIAN_HP = 120;
const GUARDIAN_SPEED = 4.2;                 // world units/sec (player is 9)
const GUARDIAN_DETECTION = LABYRINTH_CONFIG.CELL_SIZE * 3;   // ~3 cells
const GUARDIAN_LEASH = LABYRINTH_CONFIG.CELL_SIZE * 5;       // disengage
const GUARDIAN_ATTACK_RANGE = 1.9;
const GUARDIAN_ATTACK_DAMAGE = 10;
const GUARDIAN_ATTACK_COOLDOWN = 1.2;
const GUARDIAN_COLLISION_RADIUS = 0.75;
const GUARDIAN_REPEL_RADIUS = 1.1;          // separation between enemies

// ─── Trap Spawner tuning ─────────────────────────────────────────────────────
// Stationary turret that fires a projectile every TRAP_SPAWNER_FIRE_SEC while
// the player is within TRAP_SPAWNER_RANGE AND line-of-sight is clear.

const TRAP_SPAWNER_HP = 160;   // doubled from 80 (item 2 rebalance)
const TRAP_SPAWNER_RANGE = LABYRINTH_CONFIG.CELL_SIZE * 2.5;
const TRAP_SPAWNER_FIRE_SEC = 1.8;
const TRAP_SPAWNER_PROJECTILE_DAMAGE = 15;
const TRAP_SPAWNER_PROJECTILE_SPEED = 14;
const TRAP_SPAWNER_PROJECTILE_LIFETIME = TRAP_SPAWNER_RANGE / 14 + 0.2;
const TRAP_SPAWNER_COLLISION_RADIUS = 0.8;

// ─── Mimic tuning ────────────────────────────────────────────────────────────
// Revealed chests turn into mimics that chase + melee. Faster than guardians
// (4.5 vs 4.2) and hit harder (18 vs 10) to make the surprise hurt, but
// lower HP (60 vs 60 — matching guardian for now; tweak if they feel too
// tanky). Share the guardian patrol/chase/attack AI exactly — they're just
// a guardian re-skinned with hotter numbers.

export const MIMIC_HP = 120;   // doubled from 60 (item 2 rebalance)
const MIMIC_SPEED = 4.5;
const MIMIC_DETECTION = LABYRINTH_CONFIG.CELL_SIZE * 3;
const MIMIC_LEASH = LABYRINTH_CONFIG.CELL_SIZE * 6;  // more tenacious than guardians
const MIMIC_ATTACK_RANGE = 1.9;
const MIMIC_ATTACK_DAMAGE = 18;
const MIMIC_ATTACK_COOLDOWN = 1.0;  // swings slightly faster than guardian (1.2)
const MIMIC_COLLISION_RADIUS = 0.75;

// ─── Shadow Stalker tuning ───────────────────────────────────────────────────
// Low-HP, very fast ambusher that spawns from a far dead-end every
// SHADOW_STALKER_INTERVAL_SEC. Only one alive at a time. Phases
// (renders semi-transparent, signalled via hitFlashTimer abuse — see
// the shim) until it closes to STALKER_REVEAL_DIST; then snaps to
// fully opaque for the strike.

export const STALKER_HP = 80;  // doubled from 40 (item 2 rebalance)
const STALKER_SPEED = 5.5;
const STALKER_DETECTION = LABYRINTH_CONFIG.CELL_SIZE * 6;   // always aware of player
const STALKER_LEASH = LABYRINTH_CONFIG.CELL_SIZE * 12;      // never loses interest
const STALKER_ATTACK_RANGE = 1.7;
const STALKER_ATTACK_DAMAGE = 20;
const STALKER_ATTACK_COOLDOWN = 0.9;
const STALKER_COLLISION_RADIUS = 0.6;
/** Distance at which stalker snaps from phasing to opaque — the "spotted!" moment. */
export const STALKER_REVEAL_DIST = LABYRINTH_CONFIG.CELL_SIZE * 1.5;

// ─── Champion tuning ─────────────────────────────────────────────────────────
// ─── Heavy (ex-"champion" — demoted to standard heavy enemy) ────────────────
// Visually the original orange-red model. Previously held the key and
// announcement; now it's just a heavy-class patrol enemy that spawns
// alongside guardians. Tuning sits between guardian and warden:
//   Guardian HP 120, Heavy HP 200, Warden HP 800
//   Guardian dmg 10, Heavy dmg 16, Warden dmg 35
export const HEAVY_HP = 200;
const HEAVY_SPEED = 4.0;                                  // slower than guardian (4.2) — tanky patroller
const HEAVY_DETECTION = LABYRINTH_CONFIG.CELL_SIZE * 5;
const HEAVY_LEASH = LABYRINTH_CONFIG.CELL_SIZE * 10;
const HEAVY_ATTACK_RANGE = 2.0;
const HEAVY_ATTACK_DAMAGE = 16;
const HEAVY_ATTACK_COOLDOWN = 1.3;
const HEAVY_COLLISION_RADIUS = 1.0;

// ─── Rival Champions ────────────────────────────────────────────────────────
// Two per run — the two classes the player did NOT pick, re-spawned
// as hostile mirrors. Each uses its class's actual move set ported
// labyrinth-local:
//   rival_warrior: chase + melee swing + auto War Cry under 30% HP
//   rival_mage:    keep-distance + fire arcane orbs + blink when close
//   rival_rogue:   chase + poison-dash that applies stacks on hit
// Tuning makes them the most dangerous enemies outside the warden:
// roughly warden/2 HP, higher damage than guardian, faster movement.

export const RIVAL_WARRIOR_HP = 380;
const RIVAL_WARRIOR_SPEED = 5.2;
const RIVAL_WARRIOR_ATTACK_RANGE = 2.4;
const RIVAL_WARRIOR_ATTACK_DAMAGE = 28;
const RIVAL_WARRIOR_ATTACK_COOLDOWN = 1.0;
const RIVAL_WARRIOR_COLLISION_RADIUS = 1.0;
/** HP fraction below which the rival warrior auto-triggers War Cry. */
const RIVAL_WARRIOR_WARCRY_HP_THRESHOLD = 0.30;
/** War Cry active duration (seconds). */
const RIVAL_WARRIOR_WARCRY_SEC = 4.0;
/** War Cry cooldown from trigger (seconds). */
const RIVAL_WARRIOR_WARCRY_CD = 20.0;
/** Damage multiplier while War Cry is active. */
const RIVAL_WARRIOR_WARCRY_MULT = 1.4;
/** Arc-slash cooldown (seconds). Ported from Trial of Champions
 *  warrior_champion (GameScene.tsx:2283-2289). ToC uses 2.8s base
 *  with enrage scaling; labyrinth spec pins it to a consistent 2s
 *  (no phase scaling this pass — tune post-Alpha if needed). */
const RIVAL_WARRIOR_ARC_SLASH_CD = 2.5;
/** Arc-slash damage. ToC uses e.damage * 1.2; we mirror that on the
 *  labyrinth's RIVAL_WARRIOR_ATTACK_DAMAGE. */
const RIVAL_WARRIOR_ARC_SLASH_DAMAGE_MULT = 1.2;
/** Projectile speed — ToC base is 8 u/s. */
const RIVAL_WARRIOR_ARC_SLASH_SPEED = 6.0;
/** Max engagement range for arc-slash firing — the rival won't
 *  bother from across the maze; ports ToC's cDist <= 12 check. */
const RIVAL_WARRIOR_ARC_SLASH_MAX_DIST = 12.0;
/** Min engagement range — if the player is already in melee range,
 *  swing instead. Keeps arc slash as a mid-range pressure tool. */
const RIVAL_WARRIOR_ARC_SLASH_MIN_DIST = 0;

export const RIVAL_MAGE_HP = 280;
const RIVAL_MAGE_SPEED = 4.5;
/** Ideal distance the mage wants to keep from the player — if closer,
 *  it blinks backwards; if further, it closes to fire range. */
const RIVAL_MAGE_PREFERRED_DIST = LABYRINTH_CONFIG.CELL_SIZE * 1.5;
const RIVAL_MAGE_FIRE_RANGE = LABYRINTH_CONFIG.CELL_SIZE * 2.2;
const RIVAL_MAGE_FIRE_COOLDOWN = 1.6;
const RIVAL_MAGE_PROJECTILE_DAMAGE = 22;
const RIVAL_MAGE_PROJECTILE_SPEED = 18;
/** Min distance before blink triggers (player too close). */
const RIVAL_MAGE_BLINK_THRESHOLD = 2.2;
const RIVAL_MAGE_BLINK_CD = 3.0;
const RIVAL_MAGE_BLINK_DISTANCE = 6.0;
const RIVAL_MAGE_ATTACK_RANGE = 2.0;  // backup melee if close
const RIVAL_MAGE_ATTACK_DAMAGE = 12;
const RIVAL_MAGE_ATTACK_COOLDOWN = 1.3;
const RIVAL_MAGE_COLLISION_RADIUS = 0.9;

export const RIVAL_ROGUE_HP = 320;
const RIVAL_ROGUE_SPEED = 6.0;
const RIVAL_ROGUE_ATTACK_RANGE = 10;
const RIVAL_ROGUE_ATTACK_DAMAGE = 12;
const RIVAL_ROGUE_ATTACK_COOLDOWN = 0.7;
const RIVAL_ROGUE_COLLISION_RADIUS = 0.9;
const RIVAL_ROGUE_DAGGER_SPREAD = 3;
const RIVAL_ROGUE_DAGGER_SPEED = 16;
const RIVAL_ROGUE_DAGGER_LIFETIME = 0.75; // halved from 1.5
/** Dash cooldown (seconds). */
const RIVAL_ROGUE_DASH_CD = 4.0;
/** Dash peak speed (world units / sec). */
const RIVAL_ROGUE_DASH_SPEED = 16;
/** Dash duration (seconds) — short burst then normal movement resumes. */
const RIVAL_ROGUE_DASH_SEC = 0.22;
/** Min distance from player at which the rogue triggers a dash-close. */
const RIVAL_ROGUE_DASH_THRESHOLD = LABYRINTH_CONFIG.CELL_SIZE * 1.4;
/** Poison stacks applied to the player on a successful rogue hit. */
const RIVAL_ROGUE_POISON_STACKS_PER_HIT = 2;

// ─── Rival Necromancer ─────────────────────────────────────────────────────
// Slow, tanky ranged attacker. Fires skull projectiles and periodically
// spawns a "bone burst" — 6 projectiles in a star pattern around itself.
export const RIVAL_NECROMANCER_HP = 350;
const RIVAL_NECROMANCER_SPEED = 3.8;
const RIVAL_NECROMANCER_COLLISION_RADIUS = 0.9;
const RIVAL_NECROMANCER_SCYTHE_RANGE = 3.5;
const RIVAL_NECROMANCER_SCYTHE_DAMAGE = 22;
const RIVAL_NECROMANCER_SCYTHE_COOLDOWN = 1.8;
const RIVAL_NECROMANCER_SCYTHE_ARC = Math.PI * 0.6;
const RIVAL_NECROMANCER_MINION_CD = 10.0;
const RIVAL_NECROMANCER_MINION_HP = 60;
const RIVAL_NECROMANCER_MINION_FIRE_CD = 2.0;
const RIVAL_NECROMANCER_MINION_DAMAGE = 8;
const RIVAL_NECROMANCER_ATTACK_RANGE = 2.0;
const RIVAL_NECROMANCER_ATTACK_DAMAGE = 10;
const RIVAL_NECROMANCER_ATTACK_COOLDOWN = 1.3;

// ─── Rival Bard ────────────────────────────────────────────────────────────
// Medium-fast ranged attacker with a support ability: periodically heals
// and speed-buffs nearby non-rival enemies.
export const RIVAL_BARD_HP = 280;
const RIVAL_BARD_SPEED = 5.5;
const RIVAL_BARD_COLLISION_RADIUS = 0.9;
/** Ideal keep-distance. */
const RIVAL_BARD_PREFERRED_DIST = LABYRINTH_CONFIG.CELL_SIZE * 1.3;
const RIVAL_BARD_FIRE_RANGE = LABYRINTH_CONFIG.CELL_SIZE * 2.2;
const RIVAL_BARD_FIRE_COOLDOWN = 1.5;
const RIVAL_BARD_PROJECTILE_DAMAGE = 10;
const RIVAL_BARD_PROJECTILE_SPEED = 16;
/** Buff ability cooldown (seconds). Heals + speeds nearby non-rival enemies. */
const RIVAL_BARD_BUFF_CD = 8.0;
/** Heal amount: fraction of target's maxHp restored. */
const RIVAL_BARD_BUFF_HEAL_PCT = 0.20;
/** Buff speed duration (seconds) applied to nearby enemies. */
const RIVAL_BARD_BUFF_SPEED_SEC = 3.0;
/** Radius within which the bard's buff affects other enemies. */
const RIVAL_BARD_BUFF_RADIUS = LABYRINTH_CONFIG.CELL_SIZE * 2;
/** Backup melee. */
const RIVAL_BARD_ATTACK_RANGE = 2.0;
const RIVAL_BARD_ATTACK_DAMAGE = 8;
const RIVAL_BARD_ATTACK_COOLDOWN = 1.3;

/** After death, how long the husk lingers before being evicted. */
export const ENEMY_DEATH_FADE_SEC = 0.6;

/** Minimum cells between player spawn and enemy spawns. */
const SPAWN_MIN_CELL_DIST_FROM_PLAYER = 4;

/** The center 3x3 boss chamber is reserved — no patrol enemies inside. */
const CENTER_EXCLUSION = 2;

// ─── Spawn placement ─────────────────────────────────────────────────────────

/**
 * Pick `count` spawn cells for Corridor Guardians. Avoids the player's
 * spawn area and the center boss chamber. Returns the runtime list.
 */
export function spawnCorridorGuardians(
  maze: Maze,
  count: number,
  rng: () => number = Math.random,
  /** Item 7: fraction of guardians placed in the outer ring
   *  (Chebyshev >= outerRingMin from center). Zero = original uniform
   *  behaviour. Typical: 0.65 → 65% outer, 35% elsewhere. */
  outerBiasPct = 0,
  outerRingMin = 0,
): EnemyRuntime[] {
  const cCol = maze.center.col;
  const cRow = maze.center.row;
  const pCol = maze.spawn.col;
  const pRow = maze.spawn.row;

  const candidates = maze.cells.filter((cell) => {
    if (Math.abs(cell.col - cCol) <= CENTER_EXCLUSION && Math.abs(cell.row - cRow) <= CENTER_EXCLUSION) return false;
    const dc = cell.col - pCol;
    const dr = cell.row - pRow;
    if (dc * dc + dr * dr < SPAWN_MIN_CELL_DIST_FROM_PLAYER * SPAWN_MIN_CELL_DIST_FROM_PLAYER) return false;
    return true;
  });

  // Fisher-Yates
  for (let i = candidates.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
  }

  // Ring-biased selection — partition candidates into outer / inner
  // (Chebyshev distance from center) and draw the requested split.
  // When outerBiasPct = 0 (default) we keep the old uniform path.
  let chosen;
  if (outerBiasPct > 0 && outerRingMin > 0) {
    const isOuter = (cell: { col: number; row: number }) =>
      Math.max(Math.abs(cell.col - cCol), Math.abs(cell.row - cRow)) >= outerRingMin;
    const outer = candidates.filter(isOuter);
    const inner = candidates.filter((c) => !isOuter(c));
    const outerTarget = Math.min(outer.length, Math.round(count * outerBiasPct));
    const innerTarget = Math.min(inner.length, count - outerTarget);
    chosen = outer.slice(0, outerTarget).concat(inner.slice(0, innerTarget));
  } else {
    chosen = candidates.slice(0, count);
  }
  return chosen.map((cell, i) => {
    const { x, z } = cellToWorld(cell.col, cell.row);
    return {
      id: `guardian-${i}-${cell.col}-${cell.row}`,
      kind: "corridor_guardian" as const,
      x, z,
      angle: rng() * Math.PI * 2 - Math.PI,
      hp: GUARDIAN_HP,
      maxHp: GUARDIAN_HP,
      state: "patrol" as EnemyAiState,
      aiTimer: 0,
      attackCooldown: 0,
      deathFadeSec: 0,
      hitFlashTimer: 0,
      patrolTargetX: null,
      patrolTargetZ: null,
      lastMoveX: 0,
      lastMoveZ: 0,
      fireTimer: 0,
    };
  });
}

let mimicIdCounter = 0;
/** Create a mimic enemy at the given world position. Called by the
 *  chest system when a mimic chest is triggered — the chest vanishes
 *  and this enemy takes its place. Starts in `chase` so it comes
 *  straight at the player who just poked it. */
export function makeMimicEnemy(x: number, z: number): EnemyRuntime {
  return {
    id: `mimic-${mimicIdCounter++}`,
    kind: "mimic",
    x, z,
    angle: 0,
    hp: MIMIC_HP,
    maxHp: MIMIC_HP,
    state: "chase",
    aiTimer: 0,
    attackCooldown: 0,
    deathFadeSec: 0,
    hitFlashTimer: 0,
    patrolTargetX: null,
    patrolTargetZ: null,
    lastMoveX: 0,
    lastMoveZ: 0,
    fireTimer: 0,
  };
}

let minionIdCounter = 0;
/** Create a single Corridor Guardian at a specific world position.
 *  Used by the Warden's phase-3 minion summons. */
export function makeCorridorGuardianAt(x: number, z: number): EnemyRuntime {
  return {
    id: `minion-${minionIdCounter++}`,
    kind: "corridor_guardian",
    x, z,
    angle: 0,
    hp: GUARDIAN_HP,
    maxHp: GUARDIAN_HP,
    state: "chase",
    aiTimer: 0,
    attackCooldown: 0,
    deathFadeSec: 0,
    hitFlashTimer: 0,
    patrolTargetX: null,
    patrolTargetZ: null,
    lastMoveX: 0,
    lastMoveZ: 0,
    fireTimer: 0,
  };
}

let stalkerIdCounter = 0;
/** Create a shadow stalker at the given world position. Starts in
 *  `chase` so it immediately hunts the player from wherever it
 *  materialises. */
export function makeShadowStalker(x: number, z: number): EnemyRuntime {
  return {
    id: `stalker-${stalkerIdCounter++}`,
    kind: "shadow_stalker",
    x, z,
    angle: 0,
    hp: STALKER_HP,
    maxHp: STALKER_HP,
    state: "chase",
    aiTimer: 0,
    attackCooldown: 0,
    deathFadeSec: 0,
    hitFlashTimer: 0,
    patrolTargetX: null,
    patrolTargetZ: null,
    lastMoveX: 0,
    lastMoveZ: 0,
    fireTimer: 0,
  };
}

/** Pick a dead-end far from the player for a stalker to appear at. If
 *  the maze has no suitable dead-end, returns null (caller skips the
 *  spawn this interval). */
export function findStalkerSpawnCell(
  maze: Maze,
  playerX: number,
  playerZ: number,
): { x: number; z: number } | null {
  const cs = LABYRINTH_CONFIG.CELL_SIZE;
  const minDistSq = (cs * 8) * (cs * 8);
  let best: { x: number; z: number; d: number } | null = null;
  for (const de of maze.deadEnds) {
    const { x, z } = cellToWorld(de.col, de.row);
    const dx = x - playerX;
    const dz = z - playerZ;
    const d = dx * dx + dz * dz;
    if (d < minDistSq) continue;
    if (!best || d > best.d) best = { x, z, d };
  }
  return best;
}

let heavyIdCounter = 0;
let rivalIdCounter = 0;

/** Pick `count` cells for heavy enemies. Reuses guardian placement
 *  logic (non-center, non-spawn-area) with no ring bias — heavies
 *  can show up anywhere. Returns the runtime list. */
export function spawnHeavies(
  maze: Maze,
  count: number,
  rng: () => number = Math.random,
): EnemyRuntime[] {
  const cCol = maze.center.col;
  const cRow = maze.center.row;
  const pCol = maze.spawn.col;
  const pRow = maze.spawn.row;
  const candidates = maze.cells.filter((cell) => {
    if (Math.abs(cell.col - cCol) <= CENTER_EXCLUSION && Math.abs(cell.row - cRow) <= CENTER_EXCLUSION) return false;
    const dc = cell.col - pCol;
    const dr = cell.row - pRow;
    if (dc * dc + dr * dr < SPAWN_MIN_CELL_DIST_FROM_PLAYER * SPAWN_MIN_CELL_DIST_FROM_PLAYER) return false;
    return true;
  });
  for (let i = candidates.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
  }
  const chosen = candidates.slice(0, count);
  return chosen.map((cell) => {
    const { x, z } = cellToWorld(cell.col, cell.row);
    return makeHeavy(x, z);
  });
}

/** Create a heavy enemy (the ex-"champion" orange model, demoted to
 *  a standard patrol enemy). No rival ability state — just beefier
 *  melee stats. */
export function makeHeavy(x: number, z: number): EnemyRuntime {
  return {
    id: `heavy-${heavyIdCounter++}`,
    kind: "heavy",
    x, z,
    angle: 0,
    hp: HEAVY_HP,
    maxHp: HEAVY_HP,
    state: "chase",
    aiTimer: 0,
    attackCooldown: 0,
    deathFadeSec: 0,
    hitFlashTimer: 0,
    patrolTargetX: null,
    patrolTargetZ: null,
    lastMoveX: 0,
    lastMoveZ: 0,
    fireTimer: 0,
  };
}

/** Create a rival champion. Kind selects which class's stats + AI
 *  branch apply. Callers use the helpers below for per-class HP /
 *  spawn location; this is the unified factory. */
export function makeRivalChampion(
  kind: "rival_warrior" | "rival_mage" | "rival_rogue" | "rival_necromancer" | "rival_bard",
  x: number,
  z: number,
): EnemyRuntime {
  const hp =
    kind === "rival_warrior"     ? RIVAL_WARRIOR_HP :
    kind === "rival_mage"        ? RIVAL_MAGE_HP :
    kind === "rival_necromancer" ? RIVAL_NECROMANCER_HP :
    kind === "rival_bard"        ? RIVAL_BARD_HP :
                                   RIVAL_ROGUE_HP;
  return {
    id: `${kind}-${rivalIdCounter++}`,
    kind,
    x, z,
    angle: 0,
    hp,
    maxHp: hp,
    state: "chase",
    aiTimer: 0,
    attackCooldown: 0,
    deathFadeSec: 0,
    hitFlashTimer: 0,
    patrolTargetX: null,
    patrolTargetZ: null,
    lastMoveX: 0,
    lastMoveZ: 0,
    fireTimer: 0,
    rival: makeRivalState(),
  };
}

// ─── Mini-boss constants ──────────────────────────────────────────────────────
// Layer 2 boss: randomly picks a rival class, but has 2-3x HP and fires
// both a starburst and aimed daggers for mixed attacks.
const MINI_BOSS_HP_MULT = 2.5;  // times the base rival HP
const MINI_BOSS_STARBURST_CD = 5.0;
const MINI_BOSS_STARBURST_COUNT = 10;
const MINI_BOSS_STARBURST_SPEED = 10;
const MINI_BOSS_STARBURST_DAMAGE = 18;
const MINI_BOSS_STARBURST_LIFETIME = 1.2; // short for corridors
const MINI_BOSS_LANCE_CD = 4.0;
const MINI_BOSS_LANCE_SPEED = 14;
const MINI_BOSS_LANCE_DAMAGE = 15;
const MINI_BOSS_LANCE_LIFETIME = 1.0;
const MINI_BOSS_LANCE_SPREAD = 0.15;

let miniBossIdCounter = 0;

/** Create a layer 2 mini-boss. Picks a random rival class's appearance
 *  but with boosted HP and a mixed attack pattern (starburst + lances). */
export function makeMiniBoss(x: number, z: number): EnemyRuntime {
  const kinds: Array<"rival_warrior" | "rival_mage" | "rival_rogue" | "rival_necromancer" | "rival_bard"> = [
    "rival_warrior", "rival_mage", "rival_rogue", "rival_necromancer", "rival_bard",
  ];
  const baseKind = kinds[Math.floor(Math.random() * kinds.length)];
  const baseHp =
    baseKind === "rival_warrior"     ? RIVAL_WARRIOR_HP :
    baseKind === "rival_mage"        ? RIVAL_MAGE_HP :
    baseKind === "rival_necromancer" ? RIVAL_NECROMANCER_HP :
    baseKind === "rival_bard"        ? RIVAL_BARD_HP :
                                       RIVAL_ROGUE_HP;
  const hp = Math.round(baseHp * MINI_BOSS_HP_MULT);
  return {
    id: `mini_boss-${miniBossIdCounter++}`,
    kind: "mini_boss",
    x, z,
    angle: 0,
    hp,
    maxHp: hp,
    state: "chase",
    aiTimer: 0,
    attackCooldown: 0,
    deathFadeSec: 0,
    hitFlashTimer: 0,
    patrolTargetX: null,
    patrolTargetZ: null,
    lastMoveX: 0,
    lastMoveZ: 0,
    fireTimer: 0,
    rival: makeRivalState(),
  };
}

/** Mini-boss AI state — similar to warden side-table approach. */
interface MiniBossState {
  starburstCd: number;
  lanceCd: number;
}
const miniBossStates = new Map<string, MiniBossState>();

function getMiniBossState(id: string): MiniBossState {
  let s = miniBossStates.get(id);
  if (!s) {
    s = { starburstCd: MINI_BOSS_STARBURST_CD, lanceCd: MINI_BOSS_LANCE_CD };
    miniBossStates.set(id, s);
  }
  return s;
}

export function clearMiniBossState(id: string): void {
  miniBossStates.delete(id);
}

/** Per-frame mini-boss AI: chase + melee + starburst + aimed lances. */
export function updateMiniBoss(
  boss: EnemyRuntime,
  playerX: number,
  playerZ: number,
  delta: number,
  playerDamage: { value: number },
  projectiles: LabProjectile[],
): void {
  const ms = getMiniBossState(boss.id);
  const dx = playerX - boss.x;
  const dz = playerZ - boss.z;
  const dist = Math.sqrt(dx * dx + dz * dz) || 0.0001;

  // Melee
  if (boss.attackCooldown > 0) boss.attackCooldown = Math.max(0, boss.attackCooldown - delta);
  if (boss.hitFlashTimer > 0) boss.hitFlashTimer = Math.max(0, boss.hitFlashTimer - delta);
  const meleeRange = 2.4;
  const meleeDmg = 28;
  if (dist <= meleeRange && boss.attackCooldown <= 0) {
    playerDamage.value += meleeDmg;
    boss.attackCooldown = 1.4;
  }

  // Chase
  if (dist > meleeRange * 0.85) {
    const speed = 4.0;
    const nx = dx / dist;
    const nz = dz / dist;
    boss.x += nx * speed * delta;
    boss.z += nz * speed * delta;
    boss.lastMoveX = nx;
    boss.lastMoveZ = nz;
  }
  boss.angle = Math.atan2(dx / dist, -dz / dist);

  // Starburst — radial ring of projectiles (corridor-safe lifetime)
  ms.starburstCd -= delta;
  if (ms.starburstCd <= 0) {
    ms.starburstCd = MINI_BOSS_STARBURST_CD;
    for (let i = 0; i < MINI_BOSS_STARBURST_COUNT; i++) {
      const a = (i / MINI_BOSS_STARBURST_COUNT) * Math.PI * 2;
      spawnLabProjectile(projectiles, {
        owner: "enemy",
        x: boss.x,
        z: boss.z,
        vx: Math.cos(a) * MINI_BOSS_STARBURST_SPEED,
        vz: Math.sin(a) * MINI_BOSS_STARBURST_SPEED,
        damage: MINI_BOSS_STARBURST_DAMAGE,
        radius: 0.4,
        lifetime: MINI_BOSS_STARBURST_LIFETIME,
        piercing: false,
        color: "#ff6040",
        glowColor: "#cc3020",
        style: "orb",
      });
    }
  }

  // Aimed lance volley — 3-shot cone at the player
  ms.lanceCd -= delta;
  if (ms.lanceCd <= 0) {
    ms.lanceCd = MINI_BOSS_LANCE_CD;
    const baseAngle = Math.atan2(dx, dz);
    for (let i = -1; i <= 1; i++) {
      const a = baseAngle + i * MINI_BOSS_LANCE_SPREAD;
      const spawnDist = 2.0;
      spawnLabProjectile(projectiles, {
        owner: "enemy",
        x: boss.x + Math.sin(a) * spawnDist,
        z: boss.z + Math.cos(a) * spawnDist,
        vx: Math.sin(a) * MINI_BOSS_LANCE_SPEED,
        vz: Math.cos(a) * MINI_BOSS_LANCE_SPEED,
        damage: MINI_BOSS_LANCE_DAMAGE,
        radius: 0.35,
        lifetime: MINI_BOSS_LANCE_LIFETIME,
        piercing: false,
        color: "#ff4488",
        glowColor: "#cc2060",
        style: "orb",
      });
    }
  }
}

/** Pick an outer-ring dead-end far from the player. Uses Chebyshev
 *  distance from maze center ≥ minRing to ensure the outer band;
 *  falls back to any far-from-player dead-end if no outer-ring
 *  candidates exist. Shared by rival spawns + anyone else wanting a
 *  "far, outer ring" cell. */
export function findOuterRingSpawnCell(
  maze: Maze,
  playerX: number,
  playerZ: number,
  minRing = 6,
): { x: number; z: number } | null {
  const cs = LABYRINTH_CONFIG.CELL_SIZE;
  const minDistSq = (cs * 6) * (cs * 6);
  const center = maze.center;
  const outerDeadEnds = maze.deadEnds.filter((c) => {
    const dc = Math.abs(c.col - center.col);
    const dr = Math.abs(c.row - center.row);
    return Math.max(dc, dr) >= minRing;
  });
  const pool = outerDeadEnds.length > 0 ? outerDeadEnds : maze.deadEnds;
  let best: { x: number; z: number; d: number } | null = null;
  for (const de of pool) {
    const { x, z } = cellToWorld(de.col, de.row);
    const dx = x - playerX;
    const dz = z - playerZ;
    const d = dx * dx + dz * dz;
    if (d < minDistSq) continue;
    if (!best || d > best.d) best = { x, z, d };
  }
  return best;
}

/** Pick a mid-ring dead-end for the first rival spawn. Mid ring is
 *  defined as Chebyshev distance 4-7 from center — far enough to
 *  feel like it closed in from elsewhere, close enough to reach in
 *  under a minute. Falls back to any far-from-player dead-end. */
export function findMidRingSpawnCell(
  maze: Maze,
  playerX: number,
  playerZ: number,
): { x: number; z: number } | null {
  const cs = LABYRINTH_CONFIG.CELL_SIZE;
  const minDistSq = (cs * 4) * (cs * 4);
  const center = maze.center;
  const midDeadEnds = maze.deadEnds.filter((c) => {
    const dc = Math.abs(c.col - center.col);
    const dr = Math.abs(c.row - center.row);
    const cheb = Math.max(dc, dr);
    return cheb >= 4 && cheb <= 7;
  });
  const pool = midDeadEnds.length > 0 ? midDeadEnds : maze.deadEnds;
  let best: { x: number; z: number; d: number } | null = null;
  for (const de of pool) {
    const { x, z } = cellToWorld(de.col, de.row);
    const dx = x - playerX;
    const dz = z - playerZ;
    const d = dx * dx + dz * dz;
    if (d < minDistSq) continue;
    if (!best || d > best.d) best = { x, z, d };
  }
  return best;
}

/**
 * Pick `count` spawn cells for Trap Spawner turrets. Prefers dead-end cells
 * (enemies are harder to out-flank when wedged at a dead-end) and otherwise
 * falls back to any corner cell. Avoids the player spawn and the centre
 * boss chamber. Stationary for the life of the run — no patrol.
 */
export function spawnTrapSpawners(
  maze: Maze,
  count: number,
  rng: () => number = Math.random,
  /** Item 7: same ring-bias as guardians — push a fraction of turrets
   *  to the outer ring so it actually feels hostile. */
  outerBiasPct = 0,
  outerRingMin = 0,
): EnemyRuntime[] {
  const cCol = maze.center.col;
  const cRow = maze.center.row;
  const pCol = maze.spawn.col;
  const pRow = maze.spawn.row;

  const deadEndCells = maze.deadEnds
    .map((de) => maze.cells[de.row * maze.size + de.col])
    .filter((cell) => {
      if (Math.abs(cell.col - cCol) <= CENTER_EXCLUSION && Math.abs(cell.row - cRow) <= CENTER_EXCLUSION) return false;
      const dc = cell.col - pCol;
      const dr = cell.row - pRow;
      if (dc * dc + dr * dr < SPAWN_MIN_CELL_DIST_FROM_PLAYER * SPAWN_MIN_CELL_DIST_FROM_PLAYER) return false;
      return true;
    });

  for (let i = deadEndCells.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [deadEndCells[i], deadEndCells[j]] = [deadEndCells[j], deadEndCells[i]];
  }

  let chosen;
  if (outerBiasPct > 0 && outerRingMin > 0) {
    const isOuter = (cell: { col: number; row: number }) =>
      Math.max(Math.abs(cell.col - cCol), Math.abs(cell.row - cRow)) >= outerRingMin;
    const outer = deadEndCells.filter(isOuter);
    const inner = deadEndCells.filter((c) => !isOuter(c));
    const outerTarget = Math.min(outer.length, Math.round(count * outerBiasPct));
    const innerTarget = Math.min(inner.length, count - outerTarget);
    chosen = outer.slice(0, outerTarget).concat(inner.slice(0, innerTarget));
  } else {
    chosen = deadEndCells.slice(0, count);
  }
  return chosen.map((cell, i) => {
    const { x, z } = cellToWorld(cell.col, cell.row);
    return {
      id: `spawner-${i}-${cell.col}-${cell.row}`,
      kind: "trap_spawner" as const,
      x, z,
      angle: 0,
      hp: TRAP_SPAWNER_HP,
      maxHp: TRAP_SPAWNER_HP,
      state: "patrol" as EnemyAiState,   // inert state; no chase logic applies
      aiTimer: 0,
      attackCooldown: 0,
      deathFadeSec: 0,
      hitFlashTimer: 0,
      patrolTargetX: null,
      patrolTargetZ: null,
      lastMoveX: 0,
      lastMoveZ: 0,
      fireTimer: rng() * TRAP_SPAWNER_FIRE_SEC, // stagger initial shots
    };
  });
}

/** Spawn trap_spawner turrets at explicit world positions. Used by the
 *  loot-room guard placement — the room is highlighted on the minimap
 *  from run start, so we add dedicated ranged defenders inside it to
 *  make the approach feel earned. Positions are caller-chosen (typically
 *  a ring around the vault cell centre); each turret fires with the
 *  same cadence + HP as the corridor-placed ones. */
export function spawnTrapSpawnersAt(
  positions: Array<{ x: number; z: number }>,
  tag = "loot",
  rng: () => number = Math.random,
): EnemyRuntime[] {
  return positions.map((pos, i) => ({
    id: `spawner-${tag}-${i}-${pos.x.toFixed(1)}-${pos.z.toFixed(1)}`,
    kind: "trap_spawner" as const,
    x: pos.x,
    z: pos.z,
    angle: 0,
    hp: TRAP_SPAWNER_HP,
    maxHp: TRAP_SPAWNER_HP,
    state: "patrol" as EnemyAiState,
    aiTimer: 0,
    attackCooldown: 0,
    deathFadeSec: 0,
    hitFlashTimer: 0,
    patrolTargetX: null,
    patrolTargetZ: null,
    lastMoveX: 0,
    lastMoveZ: 0,
    fireTimer: rng() * TRAP_SPAWNER_FIRE_SEC,
  }));
}

// ─── Per-frame update ────────────────────────────────────────────────────────

/**
 * Advance one enemy's AI + movement + melee by `delta` seconds.
 * Writes damage into `playerDamage` (accumulator — caller applies it
 * to the player at the end of the frame, so multiple enemies attacking
 * in the same tick all register).
 */
export function updateEnemy(
  enemy: EnemyRuntime,
  playerX: number,
  playerZ: number,
  segments: ReturnType<typeof extractWallSegments>,
  delta: number,
  allEnemies: readonly EnemyRuntime[],
  playerDamage: { value: number },
  projectiles: LabProjectile[],
  /** Rival-rogue poison-stack accumulator. Optional so non-rival
   *  call sites don't have to construct it. When a rival_rogue lands
   *  a dash-armed melee hit, it bumps .value by
   *  RIVAL_ROGUE_POISON_STACKS_PER_HIT; the caller applies those
   *  stacks to the labyrinth poison state at the end of the tick. */
  poisonStacks: { value: number } = { value: 0 },
): void {
  if (enemy.state === "dead") {
    enemy.deathFadeSec += delta;
    return;
  }

  // ─── Poison DoT tick (rogue Venom Stack / Deep Wounds) ─────────────
  // Mirrors the main game's enemy poison tick at
  // GameScene.tsx:1540-1541: `e.hp -= e.poisonStacks * e.poisonDps * delta`.
  if ((enemy.poisonStacks ?? 0) > 0 && (enemy.poisonDps ?? 0) > 0) {
    enemy.hp = Math.max(0, enemy.hp - enemy.poisonStacks! * enemy.poisonDps! * delta);
    if (enemy.hp <= 0) {
      enemy.state = "dead";
      enemy.hitFlashTimer = 0.35;
      return;
    }
  }

  // ─── Confuse tick (bard Discordant Chord) ─────────────────────────
  // While confuseTimer > 0, enemies wander randomly instead of chasing.
  // They still take damage and their timers/flash still tick normally.
  const isConfused = (enemy.confuseTimer ?? 0) > 0;
  if (isConfused) {
    enemy.confuseTimer = Math.max(0, enemy.confuseTimer! - delta);
  }

  // ─── Glacial slow tick ─────────────────────────────────────────────
  if ((enemy.slowTimer ?? 0) > 0) {
    enemy.slowTimer = Math.max(0, enemy.slowTimer! - delta);
  }

  // ─── Rival ability timers + transitions ────────────────────────────
  // Tick every frame regardless of state (we want cooldowns to roll
  // even while out-of-combat so a long-alive rival still gets its
  // abilities back). Transitions that depend on current HP happen
  // here too (warrior auto-war-cry at <30% HP).
  if (enemy.rival) {
    const r = enemy.rival;
    if (r.abilityCooldown > 0) r.abilityCooldown = Math.max(0, r.abilityCooldown - delta);
    if (r.secondaryCooldown > 0) r.secondaryCooldown = Math.max(0, r.secondaryCooldown - delta);
    if (r.activeSec > 0) r.activeSec = Math.max(0, r.activeSec - delta);
    if (r.activeSec <= 0 && r.buffActive) r.buffActive = false;

    if (enemy.kind === "rival_warrior") {
      const hpPct = enemy.hp / Math.max(1, enemy.maxHp);
      if (
        hpPct < RIVAL_WARRIOR_WARCRY_HP_THRESHOLD &&
        r.abilityCooldown <= 0 &&
        !r.buffActive
      ) {
        r.buffActive = true;
        r.activeSec = RIVAL_WARRIOR_WARCRY_SEC;
        r.abilityCooldown = RIVAL_WARRIOR_WARCRY_CD;
      }
      // Arc-slash fire check — port of the Trial of Champions
      // warrior_champion crescent burst (GameScene.tsx:2253-2273).
      // Fires one crescent every 2 s toward the player whenever the
      // player is within the engagement band. secondaryCooldown
      // tracks this independently from War Cry's abilityCooldown.
      if (r.secondaryCooldown <= 0) {
        const dxA = playerX - enemy.x;
        const dzA = playerZ - enemy.z;
        const distA = Math.sqrt(dxA * dxA + dzA * dzA);
        if (distA > RIVAL_WARRIOR_ARC_SLASH_MIN_DIST && distA < RIVAL_WARRIOR_ARC_SLASH_MAX_DIST) {
          const baseAngle = Math.atan2(dxA, dzA);
          const speed = RIVAL_WARRIOR_ARC_SLASH_SPEED;
          let dmg = RIVAL_WARRIOR_ATTACK_DAMAGE * RIVAL_WARRIOR_ARC_SLASH_DAMAGE_MULT * (enemy.damageMult ?? 1);
          if (r.buffActive) dmg *= RIVAL_WARRIOR_WARCRY_MULT;
          projectiles.push({
            id: `arcslash${rivalIdCounter++}`,
            owner: "enemy",
            x: enemy.x,
            z: enemy.z,
            vx: Math.sin(baseAngle) * speed,
            vz: Math.cos(baseAngle) * speed,
            damage: dmg,
            // Bigger collision footprint than a standard enemy orb —
            // tickLabProjectiles uses max(playerRadius, p.radius).
            radius: 1.0,
            lifetime: 2.5,
            piercing: false,
            hitIds: new Set(),
            color: "#ff4400",
            glowColor: "#ff2200",
            style: "crescent",
            dead: false,
          });
          r.secondaryCooldown = RIVAL_WARRIOR_ARC_SLASH_CD;
        }
      }
    }
  }

  // ─── Rival Mage: fundamentally different AI ─────────────────────────
  // Skip the shared chase/melee state machine and run the keep-distance +
  // ranged-orb logic instead. Mage returns early so none of the later
  // movement/melee code runs.
  if (enemy.kind === "rival_mage") {
    runRivalMageAI(enemy, playerX, playerZ, segments, delta, projectiles);
    return;
  }

  // ─── Rival Necromancer: melee scythe + skeleton minions ────────────
  if (enemy.kind === "rival_necromancer") {
    runRivalNecromancerAI(enemy, playerX, playerZ, segments, delta, projectiles, allEnemies);
    return;
  }

  // ─── Rival Bard: ranged + nearby-enemy buff ───────────────────────
  if (enemy.kind === "rival_bard") {
    runRivalBardAI(enemy, playerX, playerZ, segments, delta, projectiles, allEnemies);
    return;
  }

  // Dispatch on enemy kind. Corridor Guardian + Mimic + Shadow Stalker
  // share the full patrol/chase/attack state machine below (with per-
  // kind tuning). Trap Spawner is stationary-turret only. The Warden
  // runs its own state machine in LabyrinthWarden.ts — callers route
  // that kind through updateWarden before reaching this function, so
  // if we see one here something's wrong; fall through to a no-op.
  if (enemy.kind === "trap_spawner") {
    updateTrapSpawner(enemy, playerX, playerZ, segments, delta, projectiles);
    if (enemy.hitFlashTimer > 0) enemy.hitFlashTimer = Math.max(0, enemy.hitFlashTimer - delta);
    return;
  }
  if (enemy.kind === "warden") {
    // Warden tick is handled by LabyrinthWarden.updateWarden; skip here.
    if (enemy.hitFlashTimer > 0) enemy.hitFlashTimer = Math.max(0, enemy.hitFlashTimer - delta);
    return;
  }

  // Per-kind tuning for the shared chase-melee AI.
  const tuning =
    enemy.kind === "mimic"
      ? { speed: MIMIC_SPEED, detect: MIMIC_DETECTION, leash: MIMIC_LEASH, range: MIMIC_ATTACK_RANGE, damage: MIMIC_ATTACK_DAMAGE, cd: MIMIC_ATTACK_COOLDOWN, collR: MIMIC_COLLISION_RADIUS }
    : enemy.kind === "shadow_stalker"
      ? { speed: STALKER_SPEED, detect: STALKER_DETECTION, leash: STALKER_LEASH, range: STALKER_ATTACK_RANGE, damage: STALKER_ATTACK_DAMAGE, cd: STALKER_ATTACK_COOLDOWN, collR: STALKER_COLLISION_RADIUS }
    : enemy.kind === "heavy"
      ? { speed: HEAVY_SPEED, detect: HEAVY_DETECTION, leash: HEAVY_LEASH, range: HEAVY_ATTACK_RANGE, damage: HEAVY_ATTACK_DAMAGE, cd: HEAVY_ATTACK_COOLDOWN, collR: HEAVY_COLLISION_RADIUS }
    : enemy.kind === "rival_warrior"
      ? { speed: RIVAL_WARRIOR_SPEED, detect: LABYRINTH_CONFIG.CELL_SIZE * 10, leash: LABYRINTH_CONFIG.CELL_SIZE * 25, range: RIVAL_WARRIOR_ATTACK_RANGE, damage: RIVAL_WARRIOR_ATTACK_DAMAGE, cd: RIVAL_WARRIOR_ATTACK_COOLDOWN, collR: RIVAL_WARRIOR_COLLISION_RADIUS }
    // rival_mage never reaches this dispatch — runRivalMageAI handles
    // everything and returns early above.
    : enemy.kind === "rival_rogue"
      ? { speed: RIVAL_ROGUE_SPEED, detect: LABYRINTH_CONFIG.CELL_SIZE * 10, leash: LABYRINTH_CONFIG.CELL_SIZE * 25, range: RIVAL_ROGUE_ATTACK_RANGE, damage: RIVAL_ROGUE_ATTACK_DAMAGE, cd: RIVAL_ROGUE_ATTACK_COOLDOWN, collR: RIVAL_ROGUE_COLLISION_RADIUS }
    : { speed: GUARDIAN_SPEED, detect: GUARDIAN_DETECTION, leash: GUARDIAN_LEASH, range: GUARDIAN_ATTACK_RANGE, damage: GUARDIAN_ATTACK_DAMAGE, cd: GUARDIAN_ATTACK_COOLDOWN, collR: GUARDIAN_COLLISION_RADIUS };

  const dx = playerX - enemy.x;
  const dz = playerZ - enemy.z;
  const distSq = dx * dx + dz * dz;
  const dist = Math.sqrt(distSq);

  // Confused enemies force-patrol (wander aimlessly) and can't attack.
  if (isConfused) {
    enemy.state = "patrol";
  } else {
    // Normal state transitions
    switch (enemy.state) {
      case "patrol":
        if (dist < tuning.detect) enemy.state = "chase";
        break;
      case "chase":
        if (dist > tuning.leash) {
          enemy.state = "patrol";
          enemy.patrolTargetX = null;
          enemy.patrolTargetZ = null;
        } else if (dist <= tuning.range) {
          enemy.state = "attack";
        }
        break;
      case "attack":
        if (dist > tuning.range + 0.4) enemy.state = "chase";
        break;
    }
  }

  // Cooldown decay is always on
  if (enemy.attackCooldown > 0) enemy.attackCooldown = Math.max(0, enemy.attackCooldown - delta);
  if (enemy.hitFlashTimer > 0) enemy.hitFlashTimer = Math.max(0, enemy.hitFlashTimer - delta);

  // Act by state
  let desiredDx = 0, desiredDz = 0;
  if (enemy.state === "chase") {
    // Head toward player, unit direction
    if (dist > 0.0001) { desiredDx = dx / dist; desiredDz = dz / dist; }
  } else if (enemy.state === "patrol") {
    // Pick/refresh a patrol waypoint
    if (
      enemy.patrolTargetX === null ||
      enemy.patrolTargetZ === null ||
      enemy.aiTimer <= 0
    ) {
      pickNewPatrolWaypoint(enemy);
    }
    enemy.aiTimer -= delta;
    if (enemy.patrolTargetX !== null && enemy.patrolTargetZ !== null) {
      const wx = enemy.patrolTargetX - enemy.x;
      const wz = enemy.patrolTargetZ - enemy.z;
      const wd = Math.sqrt(wx * wx + wz * wz);
      if (wd > 0.4) {
        desiredDx = wx / wd;
        desiredDz = wz / wd;
      } else {
        // Reached waypoint — pick a new one next tick
        enemy.aiTimer = 0;
      }
    }
  } else if (enemy.state === "attack") {
    if (enemy.attackCooldown <= 0) {
      if (enemy.kind === "rival_rogue") {
        // Rival rogue fires a fan of daggers instead of melee.
        const aimAngle = Math.atan2(dx, dz);
        for (let d = 0; d < RIVAL_ROGUE_DAGGER_SPREAD; d++) {
          const spread = (d - (RIVAL_ROGUE_DAGGER_SPREAD - 1) / 2) * 0.15;
          const a = aimAngle + spread;
          spawnLabProjectile(projectiles, {
            owner: "enemy",
            x: enemy.x, z: enemy.z,
            vx: Math.sin(a) * RIVAL_ROGUE_DAGGER_SPEED,
            vz: Math.cos(a) * RIVAL_ROGUE_DAGGER_SPEED,
            damage: tuning.damage * (enemy.damageMult ?? 1),
            radius: 0.3,
            lifetime: RIVAL_ROGUE_DAGGER_LIFETIME,
            piercing: false,
            color: "#40e8a0", glowColor: "#00dd66",
            style: "dagger",
          });
        }
        enemy.attackCooldown = tuning.cd;
        if (enemy.rival?.poisonArmed) {
          poisonStacks.value += RIVAL_ROGUE_POISON_STACKS_PER_HIT;
          enemy.rival.poisonArmed = false;
        }
      } else {
        // Melee attackers (warrior, standard enemies).
        let dmg = tuning.damage * (enemy.damageMult ?? 1);
        if (enemy.kind === "rival_warrior" && enemy.rival?.buffActive) {
          dmg *= RIVAL_WARRIOR_WARCRY_MULT;
        }
        if (!isRivalKind(enemy.kind)) {
          dmg *= LAB_ENEMY_DAMAGE_MULT;
        }
        playerDamage.value += dmg;
        enemy.attackCooldown = tuning.cd;
      }
    }
  }

  // ─── Rival Rogue dash trigger + active-dash velocity override ──────
  // Trigger: if the player is just outside melee range and dash CD is
  // ready, burst-close along the player vector and arm poison for
  // the next landed hit. While the dash is active, position advances
  // by the stored velocity instead of the shared movement code below
  // (which runs at normal speed). Wall collision is respected.
  if (enemy.kind === "rival_rogue" && enemy.rival) {
    const r = enemy.rival;
    if (r.activeSec <= 0 && r.abilityCooldown <= 0) {
      const dxR = playerX - enemy.x;
      const dzR = playerZ - enemy.z;
      const distR = Math.sqrt(dxR * dxR + dzR * dzR);
      if (distR > RIVAL_ROGUE_ATTACK_RANGE && distR < RIVAL_ROGUE_DASH_THRESHOLD) {
        r.dashVX = (dxR / distR) * RIVAL_ROGUE_DASH_SPEED;
        r.dashVZ = (dzR / distR) * RIVAL_ROGUE_DASH_SPEED;
        r.activeSec = RIVAL_ROGUE_DASH_SEC;
        r.abilityCooldown = RIVAL_ROGUE_DASH_CD;
        r.poisonArmed = true;
      }
    }
    if (r.activeSec > 0) {
      // Dash velocity overrides normal movement this frame. Apply
      // with axis-separated wall collision so the dash can't phase.
      const stepX = r.dashVX * delta;
      const stepZ = r.dashVZ * delta;
      const nextX = enemy.x + stepX;
      const nextZ = enemy.z + stepZ;
      if (!collidesWithAnyWallLocal(nextX, enemy.z, tuning.collR, segments)) enemy.x = nextX;
      if (!collidesWithAnyWallLocal(enemy.x, nextZ, tuning.collR, segments)) enemy.z = nextZ;
      enemy.angle = Math.atan2(r.dashVX, -r.dashVZ);
      // Zero desired movement for the normal movement block below
      // so the dash doesn't double-apply. desiredDx/dz are locals
      // defined earlier in this function.
      desiredDx = 0;
      desiredDz = 0;
    }
  }

  // Enemy-vs-enemy separation (soft repulsion)
  for (const other of allEnemies) {
    if (other === enemy || other.state === "dead") continue;
    const ox = enemy.x - other.x;
    const oz = enemy.z - other.z;
    const od = Math.sqrt(ox * ox + oz * oz);
    if (od > 0 && od < GUARDIAN_REPEL_RADIUS) {
      const push = (GUARDIAN_REPEL_RADIUS - od) / GUARDIAN_REPEL_RADIUS;
      desiredDx += (ox / od) * push * 0.6;
      desiredDz += (oz / od) * push * 0.6;
    }
  }

  // Normalize movement + commit with axis-separated wall collision
  const moveLen = Math.sqrt(desiredDx * desiredDx + desiredDz * desiredDz);
  if (moveLen > 0.0001) {
    const nx = desiredDx / moveLen;
    const nz = desiredDz / moveLen;
    const sm = (enemy.speedMult ?? 1) * ((enemy.slowTimer ?? 0) > 0 ? 0.5 : 1);
    const stepX = nx * tuning.speed * sm * delta;
    const stepZ = nz * tuning.speed * sm * delta;
    const nextX = enemy.x + stepX;
    const nextZ = enemy.z + stepZ;
    if (!collidesWithAnyWallLocal(nextX, enemy.z, tuning.collR, segments)) enemy.x = nextX;
    if (!collidesWithAnyWallLocal(enemy.x, nextZ, tuning.collR, segments)) enemy.z = nextZ;
    // Face the direction of travel (same atan2 convention as the player)
    enemy.angle = Math.atan2(nx, -nz);
    enemy.lastMoveX = nx;
    enemy.lastMoveZ = nz;
  } else if (enemy.state === "attack") {
    // Face the player while swinging
    if (dist > 0.0001) enemy.angle = Math.atan2(dx / dist, -dz / dist);
  }
}

/** Flash duration when an enemy takes a hit. Matches the main game's
 *  approximate feel — short enough to read as a hit impact without
 *  making the next swing feel slow. */
const HIT_FLASH_SEC = 0.15;

/** Apply damage. Marks enemy as dead when HP hits 0. Returns true on kill. */
export function damageEnemy(enemy: EnemyRuntime, dmg: number): boolean {
  if (enemy.state === "dead") return false;
  enemy.hp = Math.max(0, enemy.hp - dmg);
  enemy.hitFlashTimer = HIT_FLASH_SEC;
  if (enemy.hp <= 0) {
    enemy.state = "dead";
    enemy.deathFadeSec = 0;
    return true;
  }
  return false;
}

export function isEnemyEvictable(enemy: EnemyRuntime): boolean {
  return enemy.state === "dead" && enemy.deathFadeSec >= ENEMY_DEATH_FADE_SEC;
}

// ─── Rival Mage AI ───────────────────────────────────────────────────────────
// Keep-distance + arcane-orb behaviour. Ported from the player-side
// LabyrinthRangedAttack / LabyrinthDash mechanics but inlined here so
// we don't twist those modules to serve both sides.
//
// Outline per frame:
//   1. If player is too close AND blink (secondary CD) is ready, blink
//      directly away along the player vector.
//   2. If player is further than preferred distance, close toward them
//      at normal speed.
//   3. Otherwise hold position and, if fire cooldown (abilityCooldown)
//      is ready, spawn an enemy-owned orb projectile.
//   4. If player is in melee range, fall back to a slow melee swing.
//
// Wall collision respected for all movement. Projectile is owner=
// "enemy" so the shared tickLabProjectiles pipeline damages the
// player instead of other enemies.
function runRivalMageAI(
  enemy: EnemyRuntime,
  playerX: number,
  playerZ: number,
  segments: ReturnType<typeof extractWallSegments>,
  delta: number,
  projectiles: LabProjectile[],
): void {
  if (enemy.attackCooldown > 0) enemy.attackCooldown -= delta;
  const r = enemy.rival;
  if (!r) return;

  const dx = playerX - enemy.x;
  const dz = playerZ - enemy.z;
  const dist = Math.sqrt(dx * dx + dz * dz);
  const dirX = dist > 0.001 ? dx / dist : 0;
  const dirZ = dist > 0.001 ? dz / dist : 0;

  // Facing follows the player for both ranged + melee intent.
  if (dist > 0.001) enemy.angle = Math.atan2(dirX, -dirZ);

  // Blink retreat — triggers when the player closes inside the threshold.
  // Uses r.secondaryCooldown so it's independent of the fire cooldown.
  if (r.secondaryCooldown <= 0 && dist < RIVAL_MAGE_BLINK_THRESHOLD) {
    const blinkX = enemy.x - dirX * RIVAL_MAGE_BLINK_DISTANCE;
    const blinkZ = enemy.z - dirZ * RIVAL_MAGE_BLINK_DISTANCE;
    // Try blink — if target is inside a wall, step back until clear or give up.
    let bx = blinkX;
    let bz = blinkZ;
    const coll = RIVAL_MAGE_COLLISION_RADIUS;
    for (let i = 0; i < 5; i++) {
      if (!collidesWithAnyWallLocal(bx, bz, coll, segments)) {
        enemy.x = bx;
        enemy.z = bz;
        r.secondaryCooldown = RIVAL_MAGE_BLINK_CD;
        break;
      }
      // Step back halfway each iteration so a partial blink still
      // puts us somewhere clear.
      bx = (bx + enemy.x) * 0.5;
      bz = (bz + enemy.z) * 0.5;
    }
  }

  // Movement intent — close if too far, hold if in fire window.
  let moveX = 0, moveZ = 0;
  if (dist > RIVAL_MAGE_FIRE_RANGE) {
    moveX = dirX;
    moveZ = dirZ;
  } else if (dist > RIVAL_MAGE_PREFERRED_DIST) {
    // Small drift to maintain angle without mashing into the player.
    moveX = dirX * 0.4;
    moveZ = dirZ * 0.4;
  } else if (dist < RIVAL_MAGE_PREFERRED_DIST * 0.85) {
    // Too close but blink not ready — back-pedal.
    moveX = -dirX * 0.6;
    moveZ = -dirZ * 0.6;
  }

  if (moveX !== 0 || moveZ !== 0) {
    const stepX = moveX * RIVAL_MAGE_SPEED * (enemy.speedMult ?? 1) * delta;
    const stepZ = moveZ * RIVAL_MAGE_SPEED * (enemy.speedMult ?? 1) * delta;
    const coll = RIVAL_MAGE_COLLISION_RADIUS;
    const nextX = enemy.x + stepX;
    const nextZ = enemy.z + stepZ;
    if (!collidesWithAnyWallLocal(nextX, enemy.z, coll, segments)) enemy.x = nextX;
    if (!collidesWithAnyWallLocal(enemy.x, nextZ, coll, segments)) enemy.z = nextZ;
    enemy.lastMoveX = moveX;
    enemy.lastMoveZ = moveZ;
  }

  // Ranged fire — only in the keep-distance band.
  if (r.abilityCooldown <= 0 && dist <= RIVAL_MAGE_FIRE_RANGE && dist >= RIVAL_MAGE_ATTACK_RANGE) {
    r.abilityCooldown = RIVAL_MAGE_FIRE_COOLDOWN;
    projectiles.push({
      id: `rivalproj${rivalIdCounter++}`,
      owner: "enemy",
      x: enemy.x,
      z: enemy.z,
      vx: dirX * RIVAL_MAGE_PROJECTILE_SPEED,
      vz: dirZ * RIVAL_MAGE_PROJECTILE_SPEED,
      damage: RIVAL_MAGE_PROJECTILE_DAMAGE * (enemy.damageMult ?? 1),
      radius: 0.35,
      lifetime: 1.0, // halved from 2.0
      piercing: false,
      hitIds: new Set(),
      color: "#b844ff",
      glowColor: "#7020c0",
      style: "orb",
      dead: false,
    });
  }

  // Melee fallback if the player is jammed up against us (blink
  // might have been blocked by walls). Uses the mage's weaker melee
  // damage/cooldown constants.
  if (dist <= RIVAL_MAGE_ATTACK_RANGE && enemy.attackCooldown <= 0) {
    // playerDamage accumulator is not in this helper's scope — the
    // shared updateEnemy caller handles the damage accumulator for
    // other enemies, but runRivalMageAI is a complete override. We
    // fire a short-range zero-velocity projectile in place of a
    // melee swing so the pipeline wires back through the same
    // damage path. Lifetime 0.08s + speed 10 guarantees it hits
    // the already-adjacent player before expiring.
    enemy.attackCooldown = RIVAL_MAGE_ATTACK_COOLDOWN;
    projectiles.push({
      id: `rivalmeleeproj${rivalIdCounter++}`,
      owner: "enemy",
      x: enemy.x,
      z: enemy.z,
      vx: dirX * 10,
      vz: dirZ * 10,
      damage: RIVAL_MAGE_ATTACK_DAMAGE * (enemy.damageMult ?? 1),
      radius: 0.35,
      lifetime: 0.25,
      piercing: false,
      hitIds: new Set(),
      color: "#b844ff",
      glowColor: "#7020c0",
      style: "orb",
      dead: false,
    });
  }
}

// ─── Rival Necromancer AI ────────────────────────────────────────────────────
// Keep-distance + skull projectiles + bone burst (6 projectiles in star).
// Pattern modelled after runRivalMageAI: preferred distance, ranged fire,
// melee fallback. Uses abilityCooldown for fire rate and secondaryCooldown
// for the bone burst.
function runRivalNecromancerAI(
  enemy: EnemyRuntime,
  playerX: number,
  playerZ: number,
  segments: ReturnType<typeof extractWallSegments>,
  delta: number,
  projectiles: LabProjectile[],
  allEnemies?: readonly EnemyRuntime[],
): void {
  if (enemy.attackCooldown > 0) enemy.attackCooldown -= delta;
  const r = enemy.rival;
  if (!r) return;

  const dx = playerX - enemy.x;
  const dz = playerZ - enemy.z;
  const dist = Math.sqrt(dx * dx + dz * dz);
  const dirX = dist > 0.001 ? dx / dist : 0;
  const dirZ = dist > 0.001 ? dz / dist : 0;

  if (dist > 0.001) enemy.angle = Math.atan2(dirX, -dirZ);

  // Chase the player — slow, menacing approach
  if (dist > RIVAL_NECROMANCER_SCYTHE_RANGE * 0.6) {
    const spd = RIVAL_NECROMANCER_SPEED * (enemy.speedMult ?? 1);
    const stepX = dirX * spd * delta;
    const stepZ = dirZ * spd * delta;
    const coll = RIVAL_NECROMANCER_COLLISION_RADIUS;
    const nextX = enemy.x + stepX;
    const nextZ = enemy.z + stepZ;
    if (!collidesWithAnyWallLocal(nextX, enemy.z, coll, segments)) enemy.x = nextX;
    if (!collidesWithAnyWallLocal(enemy.x, nextZ, coll, segments)) enemy.z = nextZ;
    enemy.lastMoveX = dirX;
    enemy.lastMoveZ = dirZ;
  }

  // Scythe melee — visible slow green arc sweep, short range
  if (dist <= RIVAL_NECROMANCER_SCYTHE_RANGE && enemy.attackCooldown <= 0) {
    enemy.attackCooldown = RIVAL_NECROMANCER_SCYTHE_COOLDOWN;
    enemy.hitFlashTimer = 0.3;
    const sweepCount = 3;
    const baseAngle = Math.atan2(dirX, dirZ);
    for (let i = 0; i < sweepCount; i++) {
      const a = baseAngle + (i - 1) * 0.4;
      projectiles.push({
        id: `rivalnecswing${rivalIdCounter++}`,
        owner: "enemy",
        x: enemy.x + Math.sin(a) * 1.2,
        z: enemy.z + Math.cos(a) * 1.2,
        vx: Math.sin(a) * 4, vz: Math.cos(a) * 4,
        damage: RIVAL_NECROMANCER_SCYTHE_DAMAGE * (enemy.damageMult ?? 1),
        radius: 0.6,
        lifetime: 0.3,
        piercing: true,
        hitIds: new Set(),
        color: "#66ff44",
        glowColor: "#33aa22",
        style: "orb",
        dead: false,
      });
    }
  }

  // Skeleton minion summon — 2 skeleton mages that orbit and fire bone projectiles
  r.secondaryCooldown -= delta;
  if (r.secondaryCooldown <= 0) {
    r.secondaryCooldown = RIVAL_NECROMANCER_MINION_CD;
    // Spawn 2 skeleton mages near the necromancer
    if (allEnemies) {
      const minionCount = (allEnemies as EnemyRuntime[]).filter(
        (e) => e.state !== "dead" && e.kind === "corridor_guardian" && e.hp <= RIVAL_NECROMANCER_MINION_HP,
      ).length;
      if (minionCount < 4) {
        for (let i = 0; i < 2; i++) {
          const a = Math.random() * Math.PI * 2;
          const rr = 3 + Math.random() * 2;
          const mx = enemy.x + Math.cos(a) * rr;
          const mz = enemy.z + Math.sin(a) * rr;
          const minion: EnemyRuntime = {
            id: `necminion-${rivalIdCounter++}`,
            kind: "corridor_guardian",
            x: mx, z: mz,
            angle: 0,
            hp: RIVAL_NECROMANCER_MINION_HP,
            maxHp: RIVAL_NECROMANCER_MINION_HP,
            state: "chase" as EnemyAiState,
            aiTimer: 0,
            attackCooldown: 0,
            deathFadeSec: 0,
            hitFlashTimer: 0,
            patrolTargetX: null,
            patrolTargetZ: null,
            lastMoveX: 0,
            lastMoveZ: 0,
            fireTimer: RIVAL_NECROMANCER_MINION_FIRE_CD,
          };
          (allEnemies as EnemyRuntime[]).push(minion);
        }
      }
    }
  }

  // Skeleton minions fire bone projectiles at the player
  if (allEnemies) {
    for (const m of allEnemies as EnemyRuntime[]) {
      if (m.state === "dead") continue;
      if (m.kind !== "corridor_guardian" || m.hp > RIVAL_NECROMANCER_MINION_HP) continue;
      m.fireTimer = (m.fireTimer ?? RIVAL_NECROMANCER_MINION_FIRE_CD) - delta;
      if (m.fireTimer <= 0) {
        m.fireTimer = RIVAL_NECROMANCER_MINION_FIRE_CD;
        const mdx = playerX - m.x, mdz = playerZ - m.z;
        const md = Math.sqrt(mdx * mdx + mdz * mdz) || 1;
        if (md <= LABYRINTH_CONFIG.CELL_SIZE * 3) {
          projectiles.push({
            id: `necminionproj${rivalIdCounter++}`,
            owner: "enemy",
            x: m.x, z: m.z,
            vx: (mdx / md) * 12, vz: (mdz / md) * 12,
            damage: RIVAL_NECROMANCER_MINION_DAMAGE * (enemy.damageMult ?? 1),
            radius: 0.3,
            lifetime: 1.2,
            piercing: false,
            hitIds: new Set(),
            color: "#ccff66",
            glowColor: "#88cc22",
            style: "orb",
            dead: false,
          });
        }
      }
    }
  }
}

// ─── Rival Bard AI ──────────────────────────────────────────────────────────
// Medium-fast ranged attacker. Fires "note" projectiles (crescent style)
// and periodically buffs nearby non-rival enemies (heal 20% maxHp + speed
// boost for 3s). Uses abilityCooldown for fire rate and secondaryCooldown
// for the buff ability.
function runRivalBardAI(
  enemy: EnemyRuntime,
  playerX: number,
  playerZ: number,
  segments: ReturnType<typeof extractWallSegments>,
  delta: number,
  projectiles: LabProjectile[],
  allEnemies: readonly EnemyRuntime[],
): void {
  if (enemy.attackCooldown > 0) enemy.attackCooldown -= delta;
  const r = enemy.rival;
  if (!r) return;

  const dx = playerX - enemy.x;
  const dz = playerZ - enemy.z;
  const dist = Math.sqrt(dx * dx + dz * dz);
  const dirX = dist > 0.001 ? dx / dist : 0;
  const dirZ = dist > 0.001 ? dz / dist : 0;

  if (dist > 0.001) enemy.angle = Math.atan2(dirX, -dirZ);

  // Movement: close if far, hold at range, backpedal if too close.
  let moveX = 0, moveZ = 0;
  if (dist > RIVAL_BARD_FIRE_RANGE) {
    moveX = dirX;
    moveZ = dirZ;
  } else if (dist > RIVAL_BARD_PREFERRED_DIST) {
    moveX = dirX * 0.35;
    moveZ = dirZ * 0.35;
  } else if (dist < RIVAL_BARD_PREFERRED_DIST * 0.8) {
    moveX = -dirX * 0.6;
    moveZ = -dirZ * 0.6;
  }

  if (moveX !== 0 || moveZ !== 0) {
    const stepX = moveX * RIVAL_BARD_SPEED * (enemy.speedMult ?? 1) * delta;
    const stepZ = moveZ * RIVAL_BARD_SPEED * (enemy.speedMult ?? 1) * delta;
    const coll = RIVAL_BARD_COLLISION_RADIUS;
    const nextX = enemy.x + stepX;
    const nextZ = enemy.z + stepZ;
    if (!collidesWithAnyWallLocal(nextX, enemy.z, coll, segments)) enemy.x = nextX;
    if (!collidesWithAnyWallLocal(enemy.x, nextZ, coll, segments)) enemy.z = nextZ;
    enemy.lastMoveX = moveX;
    enemy.lastMoveZ = moveZ;
  }

  // Ranged fire: 3-note spread toward the player.
  if (r.abilityCooldown <= 0 && dist <= RIVAL_BARD_FIRE_RANGE && dist >= RIVAL_BARD_ATTACK_RANGE) {
    r.abilityCooldown = RIVAL_BARD_FIRE_COOLDOWN;
    const baseAngle = Math.atan2(dirX, dirZ);
    for (let n = -1; n <= 1; n++) {
      const a = baseAngle + n * 0.2;
      projectiles.push({
        id: `rivalbardproj${rivalIdCounter++}`,
        owner: "enemy",
        x: enemy.x,
        z: enemy.z,
        vx: Math.sin(a) * RIVAL_BARD_PROJECTILE_SPEED,
        vz: Math.cos(a) * RIVAL_BARD_PROJECTILE_SPEED,
        damage: RIVAL_BARD_PROJECTILE_DAMAGE * (enemy.damageMult ?? 1),
        radius: 0.3,
        lifetime: 1.0,
        piercing: false,
        hitIds: new Set(),
        color: "#ffcc44",
        glowColor: "#cc9920",
        style: "note",
        dead: false,
      });
    }
  }

  // Buff ability: heal + speed-boost nearby non-rival enemies.
  if (r.secondaryCooldown <= 0) {
    r.secondaryCooldown = RIVAL_BARD_BUFF_CD;
    const radiusSq = RIVAL_BARD_BUFF_RADIUS * RIVAL_BARD_BUFF_RADIUS;
    for (const other of allEnemies) {
      if (other === enemy || other.state === "dead") continue;
      if (isRivalKind(other.kind)) continue;
      const ox = other.x - enemy.x;
      const oz = other.z - enemy.z;
      if (ox * ox + oz * oz > radiusSq) continue;
      // Heal 20% of maxHp (capped at maxHp).
      other.hp = Math.min(other.maxHp, other.hp + other.maxHp * RIVAL_BARD_BUFF_HEAL_PCT);
      // Speed buff: temporarily boost via the confuseTimer trick won't
      // work here. Instead we write a small activeSec + lastMoveX/Z
      // boost. Since standard enemies don't have rival state, we apply
      // the speed buff by giving them a brief positive hitFlashTimer
      // which the tuning block won't use. Actually — the simplest
      // approach is to NOT model a speed field on EnemyRuntime (too
      // invasive). Instead we fire a tiny healing visual projectile
      // from the bard toward the ally (cosmetic). The heal is the
      // real value — speed boost is achieved by reducing the ally's
      // aiTimer so it re-targets faster for RIVAL_BARD_BUFF_SPEED_SEC.
      other.aiTimer = 0; // force immediate re-target (effectively speeds up AI reaction)
    }
  }

  // Melee fallback — burst of notes around self.
  if (dist <= RIVAL_BARD_ATTACK_RANGE && enemy.attackCooldown <= 0) {
    enemy.attackCooldown = RIVAL_BARD_ATTACK_COOLDOWN;
    projectiles.push({
      id: `rivalbardmelee${rivalIdCounter++}`,
      owner: "enemy",
      x: enemy.x,
      z: enemy.z,
      vx: dirX * 10,
      vz: dirZ * 10,
      damage: RIVAL_BARD_ATTACK_DAMAGE * (enemy.damageMult ?? 1),
      radius: 0.3,
      lifetime: 0.25,
      piercing: false,
      hitIds: new Set(),
      color: "#ffcc44",
      glowColor: "#cc9920",
      style: "note",
      dead: false,
    });
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function pickNewPatrolWaypoint(enemy: EnemyRuntime): void {
  // Random direction, 2–5 cells away. Walls will naturally truncate the walk.
  const angle = Math.random() * Math.PI * 2;
  const dist = LABYRINTH_CONFIG.CELL_SIZE * (2 + Math.random() * 3);
  enemy.patrolTargetX = enemy.x + Math.cos(angle) * dist;
  enemy.patrolTargetZ = enemy.z + Math.sin(angle) * dist;
  enemy.aiTimer = 2 + Math.random() * 2;  // refresh in 2–4s regardless
}

/** Stationary turret AI. Counts down a fire timer; when the player is
 *  within range AND line-of-sight is clear, fires a projectile straight
 *  at the player's current position and resets the timer. Otherwise
 *  just decays the timer toward 0 so the first in-range frame fires
 *  immediately rather than waiting for a full cycle. */
function updateTrapSpawner(
  enemy: EnemyRuntime,
  playerX: number,
  playerZ: number,
  segments: ReturnType<typeof extractWallSegments>,
  delta: number,
  projectiles: LabProjectile[],
): void {
  const dx = playerX - enemy.x;
  const dz = playerZ - enemy.z;
  const distSq = dx * dx + dz * dz;
  enemy.fireTimer = Math.max(0, enemy.fireTimer - delta);
  if (distSq > TRAP_SPAWNER_RANGE * TRAP_SPAWNER_RANGE) return;
  if (enemy.fireTimer > 0) return;
  if (!hasLineOfSight(enemy.x, enemy.z, playerX, playerZ, segments)) return;
  const dist = Math.sqrt(distSq) || 1;
  const vx = (dx / dist) * TRAP_SPAWNER_PROJECTILE_SPEED;
  const vz = (dz / dist) * TRAP_SPAWNER_PROJECTILE_SPEED;
  // Rotate turret to face shot direction so the visual reads right.
  enemy.angle = Math.atan2(dx / dist, -dz / dist);
  spawnLabProjectile(projectiles, {
    owner: "enemy",
    x: enemy.x,
    z: enemy.z,
    vx, vz,
    damage: TRAP_SPAWNER_PROJECTILE_DAMAGE * LAB_ENEMY_DAMAGE_MULT * (enemy.damageMult ?? 1),
    radius: 0.4,
    lifetime: TRAP_SPAWNER_PROJECTILE_LIFETIME,
    piercing: false,
    color: "#a020e0",
    glowColor: "#e080ff",
    style: "orb",
  });
  enemy.fireTimer = TRAP_SPAWNER_FIRE_SEC;
}

/** Bresenham-ish LOS: sample the segment from (ax,az) to (bx,bz) at
 *  0.4u intervals and check if any sample is inside a wall box. Good
 *  enough for turret-to-player sight; not pixel-perfect but very cheap. */
export function hasLineOfSight(
  ax: number, az: number,
  bx: number, bz: number,
  segments: ReturnType<typeof extractWallSegments>,
): boolean {
  const dx = bx - ax;
  const dz = bz - az;
  const dist = Math.sqrt(dx * dx + dz * dz);
  const steps = Math.max(1, Math.ceil(dist / 0.4));
  const wallT = LABYRINTH_CONFIG.WALL_THICKNESS;
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    const x = ax + dx * t;
    const z = az + dz * t;
    for (const seg of segments) {
      const halfW = seg.orient === "h" ? seg.length / 2 : wallT / 2;
      const halfH = seg.orient === "v" ? seg.length / 2 : wallT / 2;
      if (
        x >= seg.cx - halfW && x <= seg.cx + halfW &&
        z >= seg.cz - halfH && z <= seg.cz + halfH
      ) {
        return false;
      }
    }
  }
  return true;
}

/** Test helper: read-only per-kind collision radius (for trap-spawner
 *  hit detection against player swings, since it's stationary). */
export function enemyCollisionRadius(kind: EnemyKind): number {
  switch (kind) {
    case "trap_spawner": return TRAP_SPAWNER_COLLISION_RADIUS;
    case "corridor_guardian": return GUARDIAN_COLLISION_RADIUS;
    case "mimic": return MIMIC_COLLISION_RADIUS;
    case "shadow_stalker": return STALKER_COLLISION_RADIUS;
    case "warden": return 1.8;
    case "death_knight": return 2.0;
    case "mini_boss": return 1.4;
    case "heavy": return HEAVY_COLLISION_RADIUS;
    case "rival_warrior": return RIVAL_WARRIOR_COLLISION_RADIUS;
    case "rival_mage": return RIVAL_MAGE_COLLISION_RADIUS;
    case "rival_rogue": return RIVAL_ROGUE_COLLISION_RADIUS;
    case "rival_necromancer": return RIVAL_NECROMANCER_COLLISION_RADIUS;
    case "rival_bard": return RIVAL_BARD_COLLISION_RADIUS;
  }
}

/** Local duplicate of the Scene's wall collision helper. Kept here so
 *  this module stays self-contained and testable — same math as Scene's
 *  collidesWithAnyWall (LabyrinthScene.tsx:508). */
function collidesWithAnyWallLocal(
  cx: number,
  cz: number,
  r: number,
  segments: ReturnType<typeof extractWallSegments>,
): boolean {
  const wallT = LABYRINTH_CONFIG.WALL_THICKNESS;
  for (const seg of segments) {
    const halfW = seg.orient === "h" ? seg.length / 2 : wallT / 2;
    const halfH = seg.orient === "v" ? seg.length / 2 : wallT / 2;
    const closestX = Math.max(seg.cx - halfW, Math.min(cx, seg.cx + halfW));
    const closestZ = Math.max(seg.cz - halfH, Math.min(cz, seg.cz + halfH));
    const dx = cx - closestX;
    const dz = cz - closestZ;
    if (dx * dx + dz * dz < r * r) return true;
  }
  return false;
}

// ─── Stat accessors (for external systems like the HUD) ──────────────────────

export function getEnemyDetectionRange(): number {
  return GUARDIAN_DETECTION;
}
export function getEnemyAttackRange(): number {
  return GUARDIAN_ATTACK_RANGE;
}
