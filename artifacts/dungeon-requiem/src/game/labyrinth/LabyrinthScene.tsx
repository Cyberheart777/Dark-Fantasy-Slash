/**
 * LabyrinthScene.tsx — Root scene for The Labyrinth game mode.
 *
 * Step 1 (this milestone): navigable maze with player movement and camera.
 * No enemies, no closing zone, no combat — just verify maze generation,
 * collision, and camera work.
 *
 * This is a plugin scene that runs completely independently from the core
 * GameScene. It reuses InputManager3D for keyboard/mouse polling. Combat,
 * power-ups, enemies, and gear will be wired in future steps.
 */

import { useRef, useEffect, useMemo, useState, useCallback } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { EffectComposer, Bloom, Vignette } from "@react-three/postprocessing";
import * as THREE from "three";
import { useGameStore } from "../../store/gameStore";
import { DamagePopups3D } from "../../ui/DamagePopups3D";
import { useAchievementStore } from "../../store/achievementStore";
import { AffixTooltip } from "../../ui/AffixTooltip";
import { AffixBanner } from "../../ui/AffixBanner";
import { AchievementToast } from "../../ui/AchievementToast";
import { InputManager3D } from "../InputManager3D";
import {
  LABYRINTH_CONFIG,
  LABYRINTH_HALF,
  LAYER_CONFIG,
  getDifficultyConfig,
  type LabyrinthDifficulty,
  type DifficultyMults,
  type LayerConfig,
} from "./LabyrinthConfig";
import {
  generateMaze,
  cellToWorld,
  worldToCell,
  extractWallSegments,
  findOpenWallDir,
  type Maze,
  type MazeCell,
  type WallDir,
  WALL_N, WALL_E, WALL_S, WALL_W,
} from "./LabyrinthMaze";
import { LabyrinthMap3D } from "./LabyrinthMap3D";
import { LabyrinthMobileControls, type LabAimOverride } from "./LabyrinthMobileControls";
import { LabyrinthZone3D } from "./LabyrinthZone3D";
import {
  computeZoneState,
  isInsideZone,
  formatZoneTime,
  ZONE_INITIAL_RADIUS,
  ZONE_TOTAL_DURATION_SEC,
  type ZoneState,
} from "./LabyrinthZone";
import {
  makeLabPoisonState,
  tickLabPoison,
  applyLabPoisonDamage,
  LAB_POISON_MAX_STACKS,
  type LabPoisonState,
} from "./LabyrinthPoison";
import {
  spawnPortalsForMilestone,
  portalCollision,
  isPortalConsumed,
  isPortalFadeoutDone,
  PORTAL_MILESTONES,
  type ExtractionPortal,
} from "./LabyrinthPortal";
import { LabyrinthPortals3D } from "./LabyrinthPortal3D";
import {
  makePlayerAttackState,
  tickAttackState,
  tryStartSwing,
  isInSwingArc,
  SWING_VISUAL_DURATION_SEC,
  SWING_HALF_ARC,
  type LabCombatStats,
  type PlayerAttackState,
} from "./LabyrinthCombat";
import {
  spawnCorridorGuardians,
  spawnTrapSpawners,
  spawnTrapSpawnersAt,
  spawnHeavies,
  updateEnemy,
  damageEnemy,
  isEnemyEvictable,
  makeShadowStalker,
  findStalkerSpawnCell,
  makeCorridorGuardianAt,
  makeRivalChampion,
  makeMiniBoss,
  updateMiniBoss,
  clearMiniBossState,
  findOuterRingSpawnCell,
  findMidRingSpawnCell,
  type EnemyRuntime,
  applyDifficultyMode,
  hasLineOfSight,
} from "./LabyrinthEnemy";
import {
  makeWarden,
  updateWarden,
  shouldSpawnWarden,
  clearWardenState,
  getWardenState,
} from "./LabyrinthWarden";
import {
  makeDeathKnight,
  updateDeathKnight,
  getDeathKnightState,
  clearDeathKnightState,
} from "./LabyrinthDeathKnight";
import { LabyrinthEnemies3D } from "./LabyrinthEnemy3D";
import { LabyrinthPlayer3D } from "./LabyrinthPlayer3D";
import { LabyrinthCanvasErrorBoundary } from "./LabyrinthCanvasErrorBoundary";
import { LabyrinthDebug } from "./LabyrinthDebug";
import {
  spawnLabDeathFx,
  tickLabDeathFx,
  type LabDeathFx,
} from "./LabyrinthDeathFx";
import { LabyrinthDeathFx3D } from "./LabyrinthDeathFx3D";
import {
  makeShroudMistEmitter,
  tickShroudMist,
  tickGroundFx,
  type LabGroundFx,
  type LabShroudMistEmitter,
} from "./LabyrinthGroundFx";
import { LabyrinthGroundFx3D } from "./LabyrinthGroundFx3D";
import {
  makeLabProgression,
  addLabXp,
  spawnLabXpOrb,
  tickLabXpOrbs,
  rollEnemyLoot,
  pickUpgradeChoices,
  LAB_EXCLUDED_UPGRADES,
  type LabProgressionState,
} from "./LabyrinthProgression";
import { XPOrb3D } from "../../entities/XPOrb3D";
import type { XPOrb, MinionRuntime } from "../GameScene";
import {
  makeLabWarriorState,
  tickLabWarrior,
  maybeTriggerWarCry,
  modifyOutgoingDamage,
  registerHit,
  registerKill,
  snapshotLabWarrior,
  type LabWarriorState,
} from "./LabyrinthWarrior";
import {
  tickLabProjectiles,
  spawnLabProjectile,
  type LabProjectile,
} from "./LabyrinthProjectile";
import { LabyrinthProjectiles3D } from "./LabyrinthProjectile3D";
import {
  type CompanionState, type SummonSign,
  createCompanionState, placeSummonSign, isNearSign, isInAura,
  tickCompanion, COMPANION_SUMMON_COST, COMPANION_BASE_HP,
  COMPANION_AURA_RADIUS, COMPANION_AURA_HP_BONUS,
  COMPANION_AURA_DAMAGE_BONUS, COMPANION_AURA_MOVE_SPEED_BONUS,
  COMPANION_LAYER_TRANSITION_HP,
} from "./LabyrinthCompanion";
import {
  makeRangedAttackState,
  tickRangedAttack,
  tryFireMageOrb,
  tryFireRogueFan,
  tryFireBardNote,
  type RangedAttackState,
} from "./LabyrinthRangedAttack";
import {
  makeLabGearState,
  rollLabGearDrop,
  spawnLabGearDrop,
  tickLabGearDrops,
  pickupLabGear,
  equipFromInventory,
  sellFromInventory,
  salvageLabGear,
  LAB_INVENTORY_CAPACITY,
  LAB_SALVAGE_VALUE,
  type LabGearState,
  type LabGearDropRuntime,
} from "./LabyrinthGear";
import { LabyrinthGearDrops3D } from "./LabyrinthGear3D";
import { LabyrinthLootDoor3D } from "./LabyrinthLootDoor3D";
import { useMetaStore } from "../../store/metaStore";
import { rollGearDrop, type GearDef } from "../../data/GearData";
import {
  spawnLabTraps,
  tickLabTraps,
  type LabTrap,
} from "./LabyrinthTrap";
import { LabyrinthTraps3D } from "./LabyrinthTrap3D";
import {
  spawnLabChests,
  tickLabChests,
  type LabChest,
} from "./LabyrinthChest";
import { LabyrinthChests3D } from "./LabyrinthChest3D";
import { addLabPoisonStacks } from "./LabyrinthPoison";
import {
  makeLabDashState,
  tickLabDashState,
  tryStartLabDash,
  type LabDashState,
} from "./LabyrinthDash";
import { CHARACTER_DATA, type CharacterClass } from "../../data/CharacterData";
import type { RaceType } from "../../data/RaceData";
import { resolveLabPlayerStats } from "./LabyrinthStats";
import { UPGRADES, type PlayerStats } from "../../data/UpgradeData";
import { LevelUp } from "../../ui/LevelUp";
import { audioManager } from "../../audio/AudioManager";

// ─── Player runtime (lean — no combat yet) ────────────────────────────────────

interface LabPlayer {
  x: number;
  z: number;
  angle: number;
  vx: number;
  vz: number;
  hp: number;
  maxHp: number;
  /** True while the dash timer is active — drives Player3D's dash-lean
   *  animation and tells MovementLoop to apply dash velocity instead
   *  of joystick-derived velocity. Mutated each frame by MovementLoop. */
  isDashing: boolean;
  // ── Action ability runtime ──────────────────────────────────────
  /** Cooldown until the next action can be used (seconds). */
  actionCooldownTimer: number;
  /** While > 0, class-specific action buff is active. */
  actionActiveTimer: number;
  /** Temporary armor from the warrior action buff. */
  actionArmorBuff: number;
  /** Temporary outgoing damage multiplier from action (warrior). */
  actionDmgMult: number;
  /** Temporary attack speed multiplier from action (mage). */
  actionAtkSpeedMult: number;
  /** Temporary projectile size multiplier from action (mage). */
  actionOrbSizeMult: number;
  /** Timer marking enemies as 20% more vulnerable (bard Discord). */
  actionVulnerabilityTimer: number;
}

/** Shared state read by HUD (polling) and mutated by Canvas useFrame. */
interface LabSharedState {
  zone: ZoneState;
  defeated: boolean;
  extracted: boolean;
  victory: boolean;
  wardenSpawned: boolean;
  deathKnightSpawned: boolean;
  firstRivalSpawned: boolean;
  secondRivalSpawned: boolean;
  rivalKillCount: number;
  hasKey: boolean;
  /** Manual-pickup vault keys. Rival-champion death spawns one here;
   *  the player must walk onto it (radius ~0.6u) to set hasKey=true.
   *  Multiple entries are supported but only the first rival drops. */
  keyPickups: Array<{ id: string; x: number; z: number }>;
  lootRoomUnlocked: boolean;
  pendingLootSpawn: boolean;
  pendingMinorRoomGear: Array<{ x: number; z: number; gear: GearDef }>;
  nearLockedVault: boolean;
  shroudDamageTaken: number;
  gearPickupsThisRun: number;
  achievementsEvaluated: boolean;
  crystalsEarned: number;
  rivalAnnounce: { kind: "rival_warrior" | "rival_mage" | "rival_rogue" | "rival_necromancer" | "rival_bard"; announcedAt: number } | null;
  wardenHud: {
    alive: boolean;
    hp: number;
    maxHp: number;
    name: string;
    specialWarn: boolean;
  } | null;
  deathKnightHud: {
    alive: boolean;
    hp: number;
    maxHp: number;
    name: string;
    specialWarn: boolean;
  } | null;
  outsideZone: boolean;
  safeDirX: number;
  safeDirZ: number;
  poisonStacks: number;
  poisonDps: number;
  portals: ExtractionPortal[];
  spawnedMilestones: Set<number>;
  lastPortalPopupSec: number;
  lastPortalPopupCount: number;
  enemyCount: number;
  killCount: number;
  level: number;
  xp: number;
  xpToNext: number;
  totalXp: number;
  warrior: {
    momentumStacks: number;
    momentumMult: number;
    warCryActive: boolean;
    warCrySec: number;
    bloodforgeGain: number;
    bloodforgeCap: number;
  } | null;
  equipped: {
    weapon: GearDef | null;
    armor: GearDef | null;
    trinket: GearDef | null;
  };
  // ─── Descent layer tracking ─────────────────────────────────────────
  layer: 1 | 2 | 3;
  layerElapsedSec: number;
  championsToKill: number;
  championsKilled: number;
  championSpawnIndex: number;
  layerComplete: boolean;
  miniBossSpawned: boolean;
  miniBossAlive: boolean;
  hardBossSpawned: boolean;
  soulCrystalMult: number;
  descentPortalsSpawned: boolean;
  pendingLayerChange: 2 | 3 | null;
  pendingPortalDecision: { type: "extract" | "descent"; portalId: string } | null;
  layerBanner: { text: string; sub: string; color: string; at: number } | null;
  isPaused: boolean;
  companion: CompanionState;
  summonSign: SummonSign | null;
  companionEverSummoned: boolean;
  companionDiedDuringRun: boolean;
  lastChancePortalsSpawned: boolean;
  timerExpiredSwarmSpawned: boolean;
}

// ─── Root React component ─────────────────────────────────────────────────────

export function LabyrinthScene() {
  // Maze regenerates on layer transitions (state, not memo). Initial L1 = full GRID_SIZE.
  const [maze, setMaze] = useState(() => generateMaze(LAYER_CONFIG[1].gridSize));

  // Class picked in the character-select step before landing here. The
  // store defaults to "warrior" so direct-to-labyrinth (eg. deep link,
  // old flow) still works. Labyrinth-specific locks are handled in
  // LabyrinthCharSelect — this component just reads whatever was set.
  const selectedClass = useGameStore((s) => s.selectedClass) as CharacterClass;
  const selectedRace = useGameStore((s) => s.selectedRace);
  const labDifficulty = useGameStore((s) => s.labyrinthDifficulty);
  const classDef = CHARACTER_DATA[selectedClass];

  // Resolved player stats — composes class + race + Soul Forge +
  // Trial buffs via the same pipeline the main game uses
  // (GameScene.tsx:264-293). One-shot resolve at scene mount;
  // gear bonuses still layer on top per-tick via gearStateRef.
  const labStats = useMemo(
    () => resolveLabPlayerStats(selectedClass, selectedRace),
    [selectedClass, selectedRace],
  );

  // Combat stats derived from the RESOLVED player stats (not raw
  // classDef) so Soul Forge upgrades like Honed Edge (+2 dmg/rank),
  // Swift Strikes (+1% atkspd/rank), and Executioner's Reach
  // (+0.5 range/rank) carry into the labyrinth. Labyrinth mode
  // still reduces weapon range by 25% vs the main game — tighter
  // corridor combat.
  const LABYRINTH_RANGE_MULT = 0.75;
  // Counter to force combatStats recalculation after power-up upgrades
  const [upgradeRevision, setUpgradeRevision] = useState(0);

  const combatStats: LabCombatStats = useMemo(() => ({
    damage: labStats.damage,
    atkRange: labStats.attackRange * LABYRINTH_RANGE_MULT,
    atkCooldown: 1 / Math.max(0.01, labStats.attackSpeed),
  }), [labStats, upgradeRevision]);

  // InputManager lives at the scene level so both the R3F Canvas and the
  // mobile-touch overlay (which is outside Canvas) can share it.
  const inputRef = useRef<InputManager3D | null>(null);
  if (!inputRef.current) inputRef.current = new InputManager3D();

  // Shared player + zone state. The Canvas useFrame loop writes to this;
  // the HUD polls it on an interval so we don't re-render React at 60fps.
  // Initial HP comes from the resolved stats so Soul Forge Iron
  // Soul (+10 HP/rank) + Trial of Champions clear bonuses flow
  // through to the labyrinth starting pool. Captured ONCE via
  // useRef-init so remounting the scene doesn't wipe in-run HP.
  const playerRef = useRef<LabPlayer>({
    x: 0, z: 0, angle: 0, vx: 0, vz: 0,
    hp: labStats.maxHealth, maxHp: labStats.maxHealth,
    isDashing: false,
    actionCooldownTimer: 0,
    actionActiveTimer: 0,
    actionArmorBuff: 0,
    actionDmgMult: 1,
    actionAtkSpeedMult: 1,
    actionOrbSizeMult: 1,
    actionVulnerabilityTimer: 0,
  });
  const labDashRef = useRef<LabDashState>(makeLabDashState());
  const sharedRef = useRef<LabSharedState>({
    zone: computeZoneState(0),
    defeated: false,
    extracted: false,
    victory: false,
    wardenSpawned: false,
    wardenHud: null,
    deathKnightSpawned: false,
    deathKnightHud: null,
    firstRivalSpawned: false,
    secondRivalSpawned: false,
    rivalKillCount: 0,
    hasKey: false,
    keyPickups: [],
    lootRoomUnlocked: false,
    pendingLootSpawn: false,
    pendingMinorRoomGear: [],
    nearLockedVault: false,
    shroudDamageTaken: 0,
    gearPickupsThisRun: 0,
    achievementsEvaluated: false,
    crystalsEarned: 0,
    rivalAnnounce: null,
    outsideZone: false,
    safeDirX: 0, safeDirZ: 0,
    poisonStacks: 0,
    poisonDps: 0,
    portals: [],
    spawnedMilestones: new Set<number>(),
    lastPortalPopupSec: -Infinity,
    lastPortalPopupCount: 0,
    enemyCount: 0,
    killCount: 0,
    level: 1,
    xp: 0,
    xpToNext: 0,
    totalXp: 0,
    warrior: null,
    equipped: { weapon: null, armor: null, trinket: null },
    // Descent layer tracking
    layer: 1,
    layerElapsedSec: 0,
    championsToKill: LAYER_CONFIG[1].championCount,
    championsKilled: 0,
    championSpawnIndex: 0,
    layerComplete: false,
    miniBossSpawned: false,
    miniBossAlive: false,
    hardBossSpawned: false,
    soulCrystalMult: LAYER_CONFIG[1].crystalMult,
    descentPortalsSpawned: false,
    pendingLayerChange: null,
    pendingPortalDecision: null,
    isPaused: false,
    layerBanner: { text: "DEFEAT 4 CHAMPIONS TO DESCEND", sub: "THE HUNT BEGINS", color: "#cc88ff", at: 0 },
    companion: createCompanionState(),
    summonSign: null,
    companionEverSummoned: false,
    companionDiedDuringRun: false,
    lastChancePortalsSpawned: false,
    timerExpiredSwarmSpawned: false,
  });
  const labPoisonRef = useRef<LabPoisonState>(makeLabPoisonState());
  const attackStateRef = useRef<PlayerAttackState>(makePlayerAttackState());
  const deathFxRef = useRef<LabDeathFx[]>([]);
  const groundFxRef = useRef<LabGroundFx[]>([]);
  const shroudMistRef = useRef<LabShroudMistEmitter>(makeShroudMistEmitter());
  const progressionRef = useRef<LabProgressionState>(makeLabProgression(selectedClass));
  const xpOrbsRef = useRef<XPOrb[]>([]);
  // Warrior-only passives state. Created unconditionally (cheap), but
  // the combat loop only invokes it when charClass === "warrior".
  const warriorStateRef = useRef<LabWarriorState>(makeLabWarriorState());
  // Ranged attack cooldown for mage + rogue. Warrior ignores.
  const rangedAttackStateRef = useRef<RangedAttackState>(makeRangedAttackState());
  // Projectile pool shared between all projectile sources (traps,
  // turret enemies, warden starburst, mage/rogue attacks). Ticked and
  // collision-checked in CombatEnemyLoop; rendered via the main-game
  // Projectile3D.
  const projectilesRef = useRef<LabProjectile[]>([]);
  // Aim override from the mobile aim stick. When active, the combat
  // loop aims attacks at `angle` instead of auto-targeting the
  // nearest enemy. Kept as a labyrinth-local ref so we don't need
  // to extend InputManager3D (core-game file).
  const aimOverrideRef = useRef<LabAimOverride>({ active: false, angle: 0 });
  const labMinionsRef = useRef<MinionRuntime[]>([]);
  const necroPassiveTimer = useRef(3.0);
  // Run-only gear system — equipped pieces + ground drops. Everything
  // auto-salvages into Soul Forge crystals at run end (see
  // ranSalvageRef). Labyrinth gear NEVER enters the main-game stash
  // or inventory.
  const gearStateRef = useRef<LabGearState>(makeLabGearState());
  const gearDropsRef = useRef<LabGearDropRuntime[]>([]);
  /** Ensure the run-end salvage deposits into useMetaStore.addShards()
   *  exactly once per run — guards against the defeated/extracted/
   *  victory flags staying true across multiple frames. */
  const ranSalvageRef = useRef(false);
  // Loot-room placement picked once at scene mount. Chooses an outer-
  // ring dead-end (Chebyshev distance ≥ 7 from maze center). This is
  // a visual placeholder this commit — the key + unlock mechanic
  // lands with items #4 and #7.
  // Dead-end room layout (item 1 rework). Picks 3-4 distinct dead-
  // end cells distributed across the outer + mid rings:
  //   [0]   — the VAULT: outer-ring dead-end, locked door, guaranteed
  //           rare gear behind it (spawned on unlock).
  //   [1..] — MINOR reward rooms: mix of outer + mid ring dead-ends,
  //           each hosting a treasure chest + common gear drop at
  //           the cell centre. No lock, no gate — just a small but
  //           real reward so any dead-end exploration feels earned.
  //
  // Also computes the vault's open-wall direction so the door mesh
  // can be embedded in the corridor architecture rather than
  // floating in open space.
  const lootLayout = useMemo(() => {
    const center = maze.center;
    const cheb = (c: { col: number; row: number }) =>
      Math.max(Math.abs(c.col - center.col), Math.abs(c.row - center.row));
    const deadEndCells = maze.deadEnds
      .map((c) => maze.cells[c.row * maze.size + c.col])
      .filter((c) => c != null);
    const outer = deadEndCells.filter((c) => cheb(c) >= LABYRINTH_CONFIG.OUTER_RING_MIN);
    const mid = deadEndCells.filter((c) => cheb(c) >= 4 && cheb(c) < LABYRINTH_CONFIG.OUTER_RING_MIN);

    // Shuffle helpers so each run picks different rooms.
    const shuffle = <T,>(arr: T[]): T[] => {
      const a = arr.slice();
      for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
      }
      return a;
    };
    const outerShuf = shuffle(outer);
    const midShuf = shuffle(mid);

    // Vault = first outer-ring dead-end (falls back to any dead-end).
    const vault = outerShuf[0] ?? deadEndCells[0] ?? null;
    const vaultOpenDir = vault ? findOpenWallDir(vault) : null;

    // Minor rooms: 2 outer (after vault) + 1 mid. If one ring is
    // short-stocked, backfill from the other. Aim for 3 minor rooms
    // so the total is 4 dead-end rooms per run.
    const remainingOuter = outerShuf.slice(1);
    const minorPool: MazeCell[] = [];
    minorPool.push(...remainingOuter.slice(0, 2));
    minorPool.push(...midShuf.slice(0, 3 - minorPool.length));
    // Backfill if still short.
    if (minorPool.length < 3) {
      const used = new Set<string>([
        ...(vault ? [`${vault.col},${vault.row}`] : []),
        ...minorPool.map((c) => `${c.col},${c.row}`),
      ]);
      for (const c of deadEndCells) {
        if (minorPool.length >= 3) break;
        if (used.has(`${c.col},${c.row}`)) continue;
        minorPool.push(c);
      }
    }

    return {
      vaultCell: vault ? { col: vault.col, row: vault.row } : maze.spawn,
      vaultOpenDir: vaultOpenDir ?? "N",
      minorCells: minorPool.map((c) => ({ col: c.col, row: c.row })),
    };
  }, [maze]);
  const lootRoomCell = lootLayout.vaultCell;
  // Wall-to-wall traps. Spawned once per run at scene mount (same as
  // enemies), kept in a ref (stationary state machines — no React
  // re-render needed for their phase changes; their emitter visuals
  // poll phase directly each frame via useFrame).
  const trapsRef = useRef<LabTrap[]>([]);
  if (trapsRef.current.length === 0) {
    trapsRef.current = spawnLabTraps(maze, LABYRINTH_CONFIG.WALL_TRAP_COUNT);
  }
  if (!sharedRef.current.summonSign && sharedRef.current.layer === 1) {
    sharedRef.current.summonSign = placeSummonSign(
      maze.deadEnds, maze.spawn.col, maze.spawn.row, cellToWorld,
    );
  }
  // Loot chests — treasure (60%), trapped (25%), mimic (15%). Each
  // consumed chest is marked state="consumed" and evicted lazily.
  // Additional guaranteed-treasure chests are placed at each minor
  // reward room (item 1 redesign); those are appended after the
  // random chest roll so their positions don't get shuffled.
  const chestsRef = useRef<LabChest[]>([]);
  if (chestsRef.current.length === 0) {
    chestsRef.current = spawnLabChests(maze, LABYRINTH_CONFIG.LOOT_CHEST_COUNT);
    // Minor reward rooms: one guaranteed treasure chest + one
    // common gear drop per room. Gear uses infinite lifetime so
    // the reward is still there when the player eventually
    // wanders into the dead-end — no time pressure for a small
    // reward. Chest payload (heal + XP orbs) fires on proximity.
    for (const cell of lootLayout.minorCells) {
      const pos = cellToWorld(cell.col, cell.row);
      chestsRef.current.push({
        id: `minor-chest-${cell.col}-${cell.row}`,
        x: pos.x,
        z: pos.z,
        kind: "treasure",
        state: "live",
        revealSec: 0,
      });
      const commonGear = rollGearDrop("common");
      // Stash the drop in gearDropsRef once it's initialised. We
      // can't reach it from the outer scene scope (it's scoped
      // inside LabyrinthWorld) so we tuck the pending list on
      // sharedRef and drain it on the first CombatEnemyLoop tick.
      sharedRef.current.pendingMinorRoomGear.push({
        x: pos.x,
        z: pos.z,
        gear: commonGear,
      });
    }
  }
  // Seed sharedRef with the progression's starting values so HUD reads
  // sensible defaults before the first tick runs.
  sharedRef.current.level = progressionRef.current.level;
  sharedRef.current.xpToNext = progressionRef.current.xpToNext;
  // Enemies initialized once per scene mount (one maze = one enemy set).
  const enemiesRef = useRef<EnemyRuntime[]>([]);
  if (enemiesRef.current.length === 0) {
    const guardians = spawnCorridorGuardians(
      maze,
      LABYRINTH_CONFIG.CORRIDOR_GUARDIAN_COUNT,
      undefined,
      LABYRINTH_CONFIG.OUTER_RING_ENEMY_BIAS,
      LABYRINTH_CONFIG.OUTER_RING_MIN,
    );
    const turrets = spawnTrapSpawners(
      maze,
      LABYRINTH_CONFIG.TRAP_SPAWNER_COUNT,
      undefined,
      LABYRINTH_CONFIG.OUTER_RING_ENEMY_BIAS * 0.8,  // slightly less biased for turrets — they're stationary
      LABYRINTH_CONFIG.OUTER_RING_MIN,
    );
    // Heavies (ex-champion orange model, demoted to standard heavy
    // enemy). Spread around the maze, no ring bias.
    const heavies = spawnHeavies(maze, LABYRINTH_CONFIG.HEAVY_COUNT);
    // Loot-room guardians — 3 extra trap_spawner turrets arranged in
    // a triangle around the vault cell centre. The loot room is now
    // highlighted on the minimap from run start (Task 4), so the room
    // needs dedicated ranged defenders to keep the approach dangerous.
    // Radius 2.2u keeps the turrets inside the 8u-wide cell while
    // giving the player room to manoeuvre during the fight.
    const lootCenter = cellToWorld(lootRoomCell.col, lootRoomCell.row);
    const LOOT_GUARD_R = 2.2;
    const lootGuards = spawnTrapSpawnersAt(
      [0, (2 * Math.PI) / 3, (4 * Math.PI) / 3].map((ang) => ({
        x: lootCenter.x + Math.cos(ang) * LOOT_GUARD_R,
        z: lootCenter.z + Math.sin(ang) * LOOT_GUARD_R,
      })),
      "lootguard",
    );
    const allEnemies = [...guardians, ...turrets, ...heavies, ...lootGuards];
    const diffCfg = getDifficultyConfig(labDifficulty);
    if (diffCfg) allEnemies.forEach((e) => applyDifficultyMode(e, diffCfg));
    enemiesRef.current = allEnemies;
    sharedRef.current.enemyCount = enemiesRef.current.length;
  }
  const runStartMs = useRef(performance.now());

  // Layer transition watcher: when a descent portal sets shared.pendingLayerChange,
  // regenerate the maze with the new size + reset all per-layer state.
  useEffect(() => {
    const iv = setInterval(() => {
      const s = sharedRef.current;
      const next = s.pendingLayerChange;
      if (!next) return;
      const nlc = LAYER_CONFIG[next];
      // Generate a new, smaller maze for the next layer
      const newMaze = generateMaze(nlc.gridSize);
      setMaze(newMaze);
      // Reset all layer state on shared
      s.layer = next;
      s.layerElapsedSec = 0;
      s.championsToKill = nlc.championCount;
      s.championsKilled = 0;
      s.championSpawnIndex = 0;
      s.layerComplete = false;
      s.miniBossSpawned = false;
      s.miniBossAlive = false;
      s.hardBossSpawned = false;
      s.lastChancePortalsSpawned = false;
      s.timerExpiredSwarmSpawned = false;
      s.soulCrystalMult = nlc.crystalMult;
      s.descentPortalsSpawned = false;
      s.portals = [];
      s.rivalKillCount = 0;
      s.keyPickups = [];
      s.wardenSpawned = false;
      s.deathKnightSpawned = false;
      s.rivalAnnounce = null;
      s.wardenHud = null;
      s.deathKnightHud = null;
      s.pendingLayerChange = null;
      s.spawnedMilestones = new Set<number>();
      // Layer intro banner
      if (next === 2) {
        s.layerBanner = { text: "LAYER 2 — THE DEEP LABYRINTH", sub: "DEFEAT 3 CHAMPIONS TO OPEN PORTALS", color: "#cc88ff", at: 0 };
      } else {
        s.layerBanner = { text: "LAYER 3 — THE ABYSS", sub: "SLAY THE DEATH KNIGHT", color: "#ff4488", at: 0 };
      }
      // Clear enemies + projectiles
      enemiesRef.current.length = 0;
      projectilesRef.current.length = 0;
      s.enemyCount = 0;
      // Reset zone shrink
      runStartMs.current = performance.now();
      // Teleport player to new maze spawn cell + apply HP bonus
      const spawn = cellToWorld(newMaze.spawn.col, newMaze.spawn.row);
      const p = playerRef.current;
      p.x = spawn.x;
      p.z = spawn.z;
      if (nlc.hpBonusOnEntry > 0) p.hp = Math.min(p.maxHp, p.hp + nlc.hpBonusOnEntry);
      const comp = sharedRef.current.companion;
      if (comp.alive) {
        comp.x = spawn.x + 2;
        comp.z = spawn.z + 2;
        comp.hp = Math.min(comp.maxHp, comp.hp + COMPANION_LAYER_TRANSITION_HP);
      }
    }, 100);
    return () => clearInterval(iv);
  }, []);

  useEffect(() => {
    return () => {
      inputRef.current?.destroy();
      inputRef.current = null;
    };
  }, []);

  return (
    <div style={styles.root}>
      <Canvas
        camera={{ position: [0, 36, 8], fov: 55, near: 0.5, far: 300 }}
        gl={{ antialias: true }}
      >
        {/* Shadows removed from the Canvas (previously `shadows` prop).
            iOS Safari's shadow-map pipeline was leaving the whole scene
            near-black on mobile — walls and floor rendered, but the
            StandardMaterial PBR lighting was cancelled out. Losing
            shadow casting is a cheap readability win. */}
        <LabyrinthWorld
          maze={maze}
          charClass={selectedClass}
          race={selectedRace}
          combatStats={combatStats}
          inputRef={inputRef}
          playerRef={playerRef}
          sharedRef={sharedRef}
          labPoisonRef={labPoisonRef}
          attackStateRef={attackStateRef}
          labDashRef={labDashRef}
          dashCooldownSec={labStats.dashCooldown}
          moveSpeedBonus={labStats.moveSpeed - classDef.moveSpeed}
          enemiesRef={enemiesRef}
          deathFxRef={deathFxRef}
          groundFxRef={groundFxRef}
          shroudMistRef={shroudMistRef}
          progressionRef={progressionRef}
          xpOrbsRef={xpOrbsRef}
          warriorStateRef={warriorStateRef}
          rangedAttackStateRef={rangedAttackStateRef}
          projectilesRef={projectilesRef}
          trapsRef={trapsRef}
          chestsRef={chestsRef}
          aimOverrideRef={aimOverrideRef}
          gearStateRef={gearStateRef}
          gearDropsRef={gearDropsRef}
          ranSalvageRef={ranSalvageRef}
          labMinionsRef={labMinionsRef}
          necroPassiveTimer={necroPassiveTimer}
          labStats={labStats}
          lootRoomCell={lootRoomCell}
          vaultOpenDir={lootLayout.vaultOpenDir}
          critChance={labStats.critChance}
          runStartMs={runStartMs}
        />
        <EffectComposer>
          <Bloom intensity={0.6} luminanceThreshold={0.4} luminanceSmoothing={0.85} mipmapBlur />
          <Vignette offset={0.25} darkness={0.85} />
        </EffectComposer>
      </Canvas>
      <LabyrinthHUD
        maze={maze}
        charClass={selectedClass}
        labStats={labStats}
        playerRef={playerRef}
        sharedRef={sharedRef}
        gearStateRef={gearStateRef}
        progressionRef={progressionRef}
        onUpgradeApplied={() => setUpgradeRevision((v) => v + 1)}
        enemiesRef={enemiesRef}
        lootRoomCell={lootRoomCell}
      />
      <LabyrinthMobileControls inputRef={inputRef} aimOverrideRef={aimOverrideRef} />
      {/* Affix tap-to-inspect tooltip — wired so the labyrinth's
          shimmed Enemy3D path also opens the popup. Today labyrinth
          shims keep affix="none" so this is dormant; will activate
          if affix-rolling is added to the labyrinth shim later. */}
      <AffixTooltip />
      <AffixBanner />
      {/* Achievement unlock toasts — main-game HUD mounts its own
          copy, but the labyrinth uses a separate HUD so we mount
          here. Same store + queue, so unlocks from either mode
          drain through whichever toast component is currently
          mounted. */}
      <AchievementToast />
      <LabyrinthDebug
        playerRef={playerRef}
        sharedRef={sharedRef}
        attackStateRef={attackStateRef}
        labDashRef={labDashRef}
      />
    </div>
  );
}

// ─── Layer-aware lighting ────────────────────────────────────────────────────

let _healPopId = 0;
function labHealPlayer(p: LabPlayer, amount: number, healCap = 1.0): void {
  if (amount <= 0) return;
  const before = p.hp;
  const ceiling = p.maxHp * healCap;
  p.hp = Math.min(ceiling, p.hp + amount);
  const healed = Math.round(p.hp - before);
  if (healed >= 1) {
    useGameStore.getState().addDamagePopup({
      id: `heal_${_healPopId++}`, x: p.x - 1.5, z: p.z,
      value: healed, isCrit: false, isPlayer: false,
      spawnTime: performance.now(),
      text: `+${healed}`, color: "#44ff88", durationSec: 0.8,
    });
  }
}

const LAYER_LIGHT_MULT: Record<number, number> = { 1: 0.55, 2: 0.35, 3: 0.18 };
const LAYER_FOG_NEAR:   Record<number, number> = { 1: 20,  2: 12,  3: 6  };

function LayerLighting({ sharedRef }: { sharedRef: React.MutableRefObject<LabSharedState> }) {
  const ambRef = useRef<THREE.AmbientLight>(null);
  const hemiRef = useRef<THREE.HemisphereLight>(null);
  const dirRef = useRef<THREE.DirectionalLight>(null);
  const fogRef = useRef<THREE.Fog>(null);

  useFrame(() => {
    const m = LAYER_LIGHT_MULT[sharedRef.current.layer] ?? 1;
    if (ambRef.current)  ambRef.current.intensity  = 0.6 * m;
    if (hemiRef.current) hemiRef.current.intensity  = 0.4 * m;
    if (dirRef.current)  dirRef.current.intensity   = 0.8 * m;
    if (fogRef.current)  fogRef.current.near        = LAYER_FOG_NEAR[sharedRef.current.layer] ?? 20;
  });

  return (
    <>
      <ambientLight ref={ambRef} intensity={0.6} color="#604080" />
      <hemisphereLight ref={hemiRef} args={["#604080", "#0a0414", 0.4]} />
      <directionalLight ref={dirRef} position={[30, 50, 20]} intensity={0.8} color="#8060a0" />
      <fog ref={fogRef} attach="fog" args={["#080410", 20, 90]} />
    </>
  );
}

// ─── 3D world contents ────────────────────────────────────────────────────────

function LabyrinthWorld({
  maze,
  charClass,
  race,
  combatStats,
  inputRef,
  playerRef,
  sharedRef,
  labPoisonRef,
  attackStateRef,
  labDashRef,
  dashCooldownSec,
  moveSpeedBonus,
  enemiesRef,
  deathFxRef,
  groundFxRef,
  shroudMistRef,
  progressionRef,
  xpOrbsRef,
  warriorStateRef,
  rangedAttackStateRef,
  projectilesRef,
  trapsRef,
  chestsRef,
  aimOverrideRef,
  gearStateRef,
  gearDropsRef,
  ranSalvageRef,
  labMinionsRef,
  necroPassiveTimer,
  labStats,
  lootRoomCell,
  vaultOpenDir,
  critChance,
  runStartMs,
}: {
  maze: Maze;
  charClass: CharacterClass;
  race: RaceType;
  combatStats: LabCombatStats;
  inputRef: React.MutableRefObject<InputManager3D | null>;
  playerRef: React.MutableRefObject<LabPlayer>;
  sharedRef: React.MutableRefObject<LabSharedState>;
  labPoisonRef: React.MutableRefObject<LabPoisonState>;
  attackStateRef: React.MutableRefObject<PlayerAttackState>;
  labDashRef: React.MutableRefObject<LabDashState>;
  /** Per-class dash cooldown in seconds (from CHARACTER_DATA). Passed as
   *  a primitive rather than re-deriving inside the loop because the
   *  class is fixed for the lifetime of the scene. */
  dashCooldownSec: number;
  /** Soul Forge + race movement-speed delta. See MovementLoop prop. */
  moveSpeedBonus: number;
  enemiesRef: React.MutableRefObject<EnemyRuntime[]>;
  deathFxRef: React.MutableRefObject<LabDeathFx[]>;
  groundFxRef: React.MutableRefObject<LabGroundFx[]>;
  shroudMistRef: React.MutableRefObject<LabShroudMistEmitter>;
  progressionRef: React.MutableRefObject<LabProgressionState>;
  xpOrbsRef: React.MutableRefObject<XPOrb[]>;
  warriorStateRef: React.MutableRefObject<LabWarriorState>;
  rangedAttackStateRef: React.MutableRefObject<RangedAttackState>;
  projectilesRef: React.MutableRefObject<LabProjectile[]>;
  trapsRef: React.MutableRefObject<LabTrap[]>;
  chestsRef: React.MutableRefObject<LabChest[]>;
  aimOverrideRef: React.MutableRefObject<LabAimOverride>;
  gearStateRef: React.MutableRefObject<LabGearState>;
  gearDropsRef: React.MutableRefObject<LabGearDropRuntime[]>;
  ranSalvageRef: React.MutableRefObject<boolean>;
  labMinionsRef: React.MutableRefObject<MinionRuntime[]>;
  necroPassiveTimer: React.MutableRefObject<number>;
  labStats: PlayerStats;
  lootRoomCell: { col: number; row: number };
  vaultOpenDir: WallDir;
  critChance: number;
  runStartMs: React.MutableRefObject<number>;
}) {
  // Initialize spawn position from the maze generator on first mount.
  useMemo(() => {
    const spawn = cellToWorld(maze.spawn.col, maze.spawn.row);
    playerRef.current.x = spawn.x;
    playerRef.current.z = spawn.z;
    runStartMs.current = performance.now();
    return null;
  }, [maze, playerRef, runStartMs]);

  const [currentRadius, setCurrentRadius] = useState(ZONE_INITIAL_RADIUS);
  const [paused, setPaused] = useState(false);
  // Live portal list mirror — drives the renderer. Kept in React state so
  // adding/removing portals re-renders the Canvas tree. Updated by
  // ZoneTickLoop at spawn / consumption events (not every frame).
  const [portalList, setPortalList] = useState<ExtractionPortal[]>([]);
  // Enemy list mirror for the React renderer. Updated by CombatEnemyLoop
  // only when the array identity actually changes (spawn / eviction).
  const [enemyList, setEnemyList] = useState<EnemyRuntime[]>(() => enemiesRef.current.slice());
  // Death-burst list mirror. CombatEnemyLoop pushes new bursts and
  // evicts expired ones; this state drives the Canvas-tree re-render.
  const [deathFxList, setDeathFxList] = useState<LabDeathFx[]>([]);
  // Shroud-mist list mirror. ZoneTickLoop pushes new mist puffs while
  // the player is outside the safe zone and ticks their lifetime.
  const [groundFxList, setGroundFxList] = useState<LabGroundFx[]>([]);
  // XP-orb list mirror. CombatEnemyLoop pushes on kill and evicts on
  // collection animation completion.
  const [xpOrbList, setXpOrbList] = useState<XPOrb[]>([]);
  // Projectile list mirror — same pattern. Any projectile source (wall
  // traps, turret enemies, warden starburst, player ranged attacks)
  // feeds through the same pool.
  const [projectileList, setProjectileList] = useState<LabProjectile[]>([]);
  // Live chest list mirror. Chests are consumed exactly once; the render
  // list filters out consumed chests so they visually disappear after
  // their reveal animation finishes.
  const [chestList, setChestList] = useState<LabChest[]>(() => chestsRef.current.slice());
  // Ground gear-drop list mirror — CombatEnemyLoop pushes on enemy kill
  // and evicts on pickup / lifetime expiry.
  const [gearDropList, setGearDropList] = useState<LabGearDropRuntime[]>([]);
  // Mirror of shared.lootRoomUnlocked, flipped by CombatEnemyLoop when
  // it consumes pendingLootSpawn. Drives the 3D door's open animation.
  const [lootRoomUnlockedFlag, setLootRoomUnlockedFlag] = useState(false);

  return (
    <>
      {/* Lighting balance: enough ambient + key for enemy/player PBR
          meshes to read, but NOT so much that walls and floor wash
          into a uniform glow. The previous over-boost (ambient 2.4
          + hemisphere 1.4 + 2nd directional 1.5) made walls
          indistinguishable from the floor — both are similar-tone
          purple, so over-saturated lighting collapsed the contrast
          between them. Walls + floor self-emissive (boosted in
          LabyrinthMap3D) covers the case where direct lighting is
          weak; lights here just lift the player + enemy meshes. */}
      <LayerLighting sharedRef={sharedRef} />
      <PlayerTorch playerRef={playerRef} />

      {/* Each visual subsystem is wrapped in an error boundary so a
          silent throw in one (e.g. a shader, material, or geometry
          failing to init on iOS) doesn't blank out the whole Canvas.
          The boundaries log to the browser console AND leave the rest
          of the scene visible, so a partial scene is visible instead
          of a fully black canvas. */}
      <LabyrinthCanvasErrorBoundary label="Map3D" fallback={null}>
        <LabyrinthMap3D maze={maze} layer={sharedRef.current.layer} />
      </LabyrinthCanvasErrorBoundary>
      <LabyrinthCanvasErrorBoundary label="Zone3D" fallback={null}>
        <LabyrinthZone3D radius={currentRadius} isPaused={paused} />
      </LabyrinthCanvasErrorBoundary>
      <LabyrinthCanvasErrorBoundary label="Portals3D" fallback={null}>
        <LabyrinthPortals3D portals={portalList} />
      </LabyrinthCanvasErrorBoundary>
      <LabyrinthCanvasErrorBoundary label="DamagePopups3D" fallback={null}>
        <DamagePopups3D />
      </LabyrinthCanvasErrorBoundary>
      {/* Enemy renderer is wrapped in an error boundary so a shim-side
          crash can't cascade and blank out the rest of the Canvas. If
          it fails, enemies are invisible (a known degradation) but
          walls, player, and HUD still render. */}
      <LabyrinthCanvasErrorBoundary label="Enemies3D" fallback={null}>
        <LabyrinthEnemies3D enemies={enemyList} playerRef={playerRef} layer={sharedRef.current.layer} />
      </LabyrinthCanvasErrorBoundary>
      {/* Death-burst renderer — independent of Enemies3D so even if the
          enemy visuals error out, the kill-feedback particles still play
          (they read only from deathFxList, not from GameState). */}
      {/* Necromancer minions */}
      <LabMinions3D minionsRef={labMinionsRef} />
      <LabyrinthDeathFx3D bursts={deathFxList} />
      {/* Shroud-mist ground trail — toxic green pools under the player
          while they're outside the safe zone. Purely visual; damage is
          handled separately by LabyrinthPoison. */}
      <LabyrinthGroundFx3D effects={groundFxList} />
      {/* XP orb drops from guardian kills. Uses the main game's
          XPOrb3D renderer (imported; no core edits) via a thin local
          XPOrb struct. Collection logic is in CombatEnemyLoop. */}
      {xpOrbList.map((orb) => (
        <XPOrb3D key={orb.id} orb={orb} />
      ))}
      {/* Gear drops — floating rarity-colored gems. Ports the
          main-game GearDrop3D visual (not exported). */}
      <LabyrinthGearDrops3D drops={gearDropList} />
      {/* Locked loot-room door placeholder. Visual only this commit;
          interaction lands with items #4 (champion drops key) + #7
          (loot-room unlock). */}
      <LabyrinthLootDoor3D
        x={cellToWorld(lootRoomCell.col, lootRoomCell.row).x}
        z={cellToWorld(lootRoomCell.col, lootRoomCell.row).z}
        openDir={vaultOpenDir}
        unlocked={lootRoomUnlockedFlag}
      />
      {/* Key pickups — 2D billboarded gold key sprite dropped on rival
          champion death. Reads live from sharedRef.keyPickups each
          frame; the MovementLoop pickup-radius check removes entries
          from that array when the player walks onto them. */}
      <LabyrinthKeyPickups3D sharedRef={sharedRef} />
      {/* Active projectiles — wall-trap beams, enemy turret shots,
          warden starburst, mage orbs, rogue daggers. Uses the main
          game's Projectile3D via a shim-cast in LabyrinthProjectiles3D. */}
      <LabyrinthProjectiles3D projectiles={projectileList} />
      <CompanionBard3D sharedRef={sharedRef} />
      <SummonSign3D sharedRef={sharedRef} />
      <PlayerAttackArc playerRef={playerRef} attackStateRef={attackStateRef} />
      {/* Player rendering: the main-game Player3D (warrior GLB / mage /
          rogue procedural meshes) is the primary visual. If anything
          in that pipeline throws (GLB fetch failure, shim mismatch,
          etc.), the error boundary swallows it and falls back to the
          procedural robot-man GeoCharacter — which is built from
          meshBasicMaterial primitives so it'll render on any GPU.
          Only ONE renders at a time now (was double-rendering when
          GeoCharacter was always-on alongside the GLB). */}
      <LabyrinthCanvasErrorBoundary
        label="Player3D"
        fallback={
          <GeoCharacter
            playerRef={playerRef}
            attackStateRef={attackStateRef}
          />
        }
      >
        <LabyrinthPlayer3D
          charClass={charClass}
          race={race}
          playerRef={playerRef}
          attackStateRef={attackStateRef}
        />
      </LabyrinthCanvasErrorBoundary>
      <CameraFollow playerRef={playerRef} />
      <MovementLoop
        playerRef={playerRef}
        maze={maze}
        inputRef={inputRef}
        sharedRef={sharedRef}
        labDashRef={labDashRef}
        dashCooldownSec={dashCooldownSec}
        gearStateRef={gearStateRef}
        lootRoomCell={lootRoomCell}
        moveSpeedBonus={moveSpeedBonus}
        labStats={labStats}
        groundFxRef={groundFxRef}
      />
      <CombatEnemyLoop
        maze={maze}
        combatStats={combatStats}
        playerRef={playerRef}
        sharedRef={sharedRef}
        inputRef={inputRef}
        attackStateRef={attackStateRef}
        enemiesRef={enemiesRef}
        deathFxRef={deathFxRef}
        progressionRef={progressionRef}
        xpOrbsRef={xpOrbsRef}
        warriorStateRef={warriorStateRef}
        rangedAttackStateRef={rangedAttackStateRef}
        projectilesRef={projectilesRef}
        trapsRef={trapsRef}
        chestsRef={chestsRef}
        labPoisonRef={labPoisonRef}
        groundFxRef={groundFxRef}
        aimOverrideRef={aimOverrideRef}
        gearStateRef={gearStateRef}
        gearDropsRef={gearDropsRef}
        ranSalvageRef={ranSalvageRef}
        labMinionsRef={labMinionsRef}
        necroPassiveTimer={necroPassiveTimer}
        labStats={labStats}
        lootRoomCell={lootRoomCell}
        critChance={critChance}
        charClass={charClass}
        onEnemiesChange={setEnemyList}
        onDeathFxChange={setDeathFxList}
        onXpOrbsChange={setXpOrbList}
        onProjectilesChange={setProjectileList}
        onChestsChange={setChestList}
        onGearDropsChange={setGearDropList}
        onLootRoomUnlocked={setLootRoomUnlockedFlag}
      />
      {/* Trap emitter visuals — small pulsing cubes on each anchor.
          The actual projectile is drawn by LabyrinthProjectiles3D. */}
      <LabyrinthTraps3D traps={trapsRef.current} />
      {/* Loot chests — treasure / trapped / mimic. Consumed chests
          filter out of the render list after their reveal plays. */}
      <LabyrinthChests3D chests={chestList.filter((c) => c.state !== "consumed")} />
      <ZoneTickLoop
        maze={maze}
        playerRef={playerRef}
        sharedRef={sharedRef}
        labPoisonRef={labPoisonRef}
        groundFxRef={groundFxRef}
        shroudMistRef={shroudMistRef}
        enemiesRef={enemiesRef}
        onGroundFxChange={setGroundFxList}
        onEnemiesChange={setEnemyList}
        runStartMs={runStartMs}
        onRadiusChange={(r, p) => { setCurrentRadius(r); setPaused(p); }}
        onPortalsChange={setPortalList}
      />
    </>
  );
}

function CompanionBard3D({ sharedRef }: { sharedRef: React.MutableRefObject<LabSharedState> }) {
  const groupRef = useRef<THREE.Group>(null);
  const t = useRef(0);
  useFrame((_, delta) => {
    t.current += delta;
    const comp = sharedRef.current.companion;
    if (!comp.alive || !groupRef.current) {
      if (groupRef.current) groupRef.current.visible = false;
      return;
    }
    groupRef.current.visible = true;
    groupRef.current.position.set(comp.x, 0, comp.z);
    groupRef.current.rotation.y = comp.angle;
    groupRef.current.position.y = Math.sin(t.current * 2) * 0.05;
  });
  return (
    <group ref={groupRef}>
      <mesh position={[0, 1.0, 0]}>
        <boxGeometry args={[0.55, 0.60, 0.35]} />
        <meshBasicMaterial color="#c8a040" />
      </mesh>
      <mesh position={[0, 0.5, 0]}>
        <boxGeometry args={[0.2, 0.5, 0.2]} />
        <meshBasicMaterial color="#8a6a20" />
      </mesh>
      <mesh position={[0, 1.55, 0]}>
        <boxGeometry args={[0.35, 0.35, 0.32]} />
        <meshBasicMaterial color="#d0a070" />
      </mesh>
      <mesh position={[0, 1.75, 0]}>
        <boxGeometry args={[0.38, 0.22, 0.36]} />
        <meshBasicMaterial color="#ffc830" />
      </mesh>
      <mesh position={[0.35, 1.0, 0.1]}>
        <boxGeometry args={[0.08, 0.9, 0.06]} />
        <meshBasicMaterial color="#aa8830" />
      </mesh>
      <pointLight color="#ffc830" intensity={1.5} distance={COMPANION_AURA_RADIUS} decay={2} position={[0, 1.5, 0]} />
    </group>
  );
}

function SummonSign3D({ sharedRef }: { sharedRef: React.MutableRefObject<LabSharedState> }) {
  const meshRef = useRef<THREE.Mesh>(null);
  const t = useRef(0);
  useFrame((_, delta) => {
    t.current += delta;
    const sign = sharedRef.current.summonSign;
    if (!sign || sign.consumed || !meshRef.current) {
      if (meshRef.current) meshRef.current.visible = false;
      return;
    }
    meshRef.current.visible = true;
    meshRef.current.position.set(sign.x, 0.02 + Math.sin(t.current * 2) * 0.01, sign.z);
    meshRef.current.rotation.y = t.current * 0.5;
  });
  return (
    <mesh ref={meshRef} rotation={[-Math.PI / 2, 0, 0]}>
      <ringGeometry args={[0.8, 1.2, 6]} />
      <meshBasicMaterial color="#ffc830" transparent opacity={0.7} side={THREE.DoubleSide} />
    </mesh>
  );
}

// Bright point light that follows the player — so you can always see
// yourself clearly against the dark floor.
function PlayerTorch({ playerRef }: { playerRef: React.MutableRefObject<LabPlayer> }) {
  const lightRef = useRef<THREE.PointLight>(null);
  const t = useRef(0);
  useFrame((_, delta) => {
    if (!lightRef.current) return;
    t.current += delta;
    const p = playerRef.current;
    lightRef.current.position.set(p.x, 8, p.z);
    lightRef.current.intensity = 7.0 + Math.sin(t.current * 4.5) * 0.8 + Math.sin(t.current * 11) * 0.3;
  });
  return (
    <pointLight
      ref={lightRef}
      intensity={7.0}
      color="#ffcc88"
      distance={35}
      decay={1.2}
    />
  );
}

// ─── Player marker (robot-man warrior — geometric fallback) ──────────────────
// A humanoid warrior built entirely from meshBasicMaterial primitives so it's
// visible on every GPU/browser regardless of lighting state. Anatomy mirrors
// the main game's WarriorMeshAnimated (Player3D.tsx:177-278): torso, two legs,
// two arms, head, cape, sword. Walk cycle swings arms + legs while moving;
// swing triggers a one-shot weapon arc keyed off attackStateRef. depthWrite
// is off on every part so nothing can occlude him.

function GeoCharacter({
  playerRef,
  attackStateRef,
}: {
  playerRef: React.MutableRefObject<LabPlayer>;
  attackStateRef: React.MutableRefObject<PlayerAttackState>;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const ringRef = useRef<THREE.Mesh>(null);
  const bodyRef = useRef<THREE.Mesh>(null);
  const leftArmRef = useRef<THREE.Group>(null);
  const rightArmRef = useRef<THREE.Group>(null);
  const leftLegRef = useRef<THREE.Group>(null);
  const rightLegRef = useRef<THREE.Group>(null);
  const weaponRef = useRef<THREE.Group>(null);
  const capeRef = useRef<THREE.Mesh>(null);
  const t = useRef(0);
  const lastX = useRef(0);
  const lastZ = useRef(0);
  const weaponSwing = useRef(0);
  const lastSwingVisualSec = useRef(0);

  useFrame((_, delta) => {
    if (!groupRef.current) return;
    t.current += delta;
    const p = playerRef.current;
    const atk = attackStateRef.current;
    // Position + facing. +π because the mesh "front" is -Z (head wedge
    // and sword orientation), matching WarriorMeshAnimated's convention.
    groupRef.current.position.set(p.x, 0, p.z);
    groupRef.current.rotation.y = p.angle + Math.PI;

    const isMoving =
      Math.abs(p.x - lastX.current) > 0.001 ||
      Math.abs(p.z - lastZ.current) > 0.001;
    lastX.current = p.x;
    lastZ.current = p.z;

    // Walk cycle — arms + legs counter-swing at 8 Hz while moving.
    if (leftArmRef.current && rightArmRef.current && leftLegRef.current && rightLegRef.current) {
      if (isMoving && !p.isDashing) {
        const freq = 8;
        const amp = 0.5;
        const s = Math.sin(t.current * freq) * amp;
        leftArmRef.current.rotation.x = s;
        rightArmRef.current.rotation.x = -s;
        leftLegRef.current.rotation.x = s;
        rightLegRef.current.rotation.x = -s;
      } else {
        // Idle sway.
        const idle = Math.sin(t.current * 1.5) * 0.06;
        leftArmRef.current.rotation.x = idle;
        rightArmRef.current.rotation.x = idle + 0.1;
        leftLegRef.current.rotation.x = 0;
        rightLegRef.current.rotation.x = 0;
      }
    }
    // Torso bob.
    if (bodyRef.current) {
      bodyRef.current.position.y = 1.0 + Math.sin(t.current * 1.5) * 0.03;
    }
    // Weapon swing — keyed off the combat system's swingVisualSec
    // going from 0 to non-zero. One-shot 0.2s arc.
    if (lastSwingVisualSec.current <= 0 && atk.swingVisualSec > 0) {
      weaponSwing.current = 1;
    }
    lastSwingVisualSec.current = atk.swingVisualSec;
    if (weaponSwing.current > 0) {
      weaponSwing.current = Math.max(0, weaponSwing.current - delta * 5);
    }
    if (weaponRef.current) {
      const sw = weaponSwing.current;
      if (sw > 0) {
        const prog = 1 - sw;
        weaponRef.current.rotation.x = prog * Math.PI * 1.4 - Math.PI * 0.5;
        weaponRef.current.rotation.z = Math.sin(prog * Math.PI) * 0.5;
      } else {
        weaponRef.current.rotation.x = THREE.MathUtils.lerp(weaponRef.current.rotation.x, 0, 0.15);
        weaponRef.current.rotation.z = THREE.MathUtils.lerp(weaponRef.current.rotation.z, 0, 0.15);
      }
    }
    // Dash lean.
    groupRef.current.rotation.x = THREE.MathUtils.lerp(
      groupRef.current.rotation.x,
      p.isDashing ? -0.25 : 0,
      0.2,
    );
    // Cape flap.
    if (capeRef.current) {
      capeRef.current.rotation.x = Math.sin(t.current * 3) * 0.1;
    }
    // Ring pulse.
    if (ringRef.current) {
      const pulse = 1 + 0.18 * Math.sin(t.current * 3);
      ringRef.current.scale.set(pulse, 1, pulse);
    }
  });

  // Warrior palette. Brighter than the main game's steel-blue because
  // meshBasicMaterial renders flat at the literal color (no shading),
  // so values that read as "metal" under PBR look washed-out here.
  const ARMOR = "#9fb6d6";   // light steel blue
  const ARMOR_DARK = "#5a7090";
  const SKIN = "#d0a878";
  const CAPE = "#c01040";    // bright crimson
  const SWORD = "#f0f0ff";
  const SWORD_GLOW = "#88aaff";
  const BELT = "#6a4a15";
  const BOOT = "#2a1a0a";
  const HELM = "#3a5070";
  const EYE = "#ff2200";
  const SCALE = 1.6; // bigger than main-game warrior so he's easy to spot

  return (
    <group ref={groupRef} scale={SCALE}>
      {/* Pulsing ground ring — orientation indicator. */}
      <mesh ref={ringRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.04, 0]}>
        <ringGeometry args={[1.1, 1.35, 32]} />
        <meshBasicMaterial
          color="#ff80a0"
          transparent
          opacity={0.85}
          depthWrite={false}
          side={THREE.DoubleSide}
        />
      </mesh>
      {/* Legs */}
      <group ref={leftLegRef} position={[-0.2, 0.5, 0]}>
        <mesh>
          <boxGeometry args={[0.22, 0.55, 0.22]} />
          <meshBasicMaterial color={ARMOR} depthWrite={false} />
        </mesh>
        <mesh position={[0, -0.32, 0.05]}>
          <boxGeometry args={[0.25, 0.18, 0.32]} />
          <meshBasicMaterial color={BOOT} depthWrite={false} />
        </mesh>
      </group>
      <group ref={rightLegRef} position={[0.2, 0.5, 0]}>
        <mesh>
          <boxGeometry args={[0.22, 0.55, 0.22]} />
          <meshBasicMaterial color={ARMOR} depthWrite={false} />
        </mesh>
        <mesh position={[0, -0.32, 0.05]}>
          <boxGeometry args={[0.25, 0.18, 0.32]} />
          <meshBasicMaterial color={BOOT} depthWrite={false} />
        </mesh>
      </group>
      {/* Torso */}
      <mesh ref={bodyRef} position={[0, 1.0, 0]}>
        <boxGeometry args={[0.65, 0.70, 0.38]} />
        <meshBasicMaterial color={ARMOR} depthWrite={false} />
      </mesh>
      {/* Belt */}
      <mesh position={[0, 0.7, 0]}>
        <boxGeometry args={[0.68, 0.12, 0.40]} />
        <meshBasicMaterial color={BELT} depthWrite={false} />
      </mesh>
      {/* Shoulder pauldrons */}
      <mesh position={[-0.42, 1.22, 0]}>
        <boxGeometry args={[0.22, 0.18, 0.38]} />
        <meshBasicMaterial color={ARMOR_DARK} depthWrite={false} />
      </mesh>
      <mesh position={[0.42, 1.22, 0]}>
        <boxGeometry args={[0.22, 0.18, 0.38]} />
        <meshBasicMaterial color={ARMOR_DARK} depthWrite={false} />
      </mesh>
      {/* Cape */}
      <mesh ref={capeRef} position={[0, 1.0, -0.25]}>
        <boxGeometry args={[0.6, 0.8, 0.06]} />
        <meshBasicMaterial color={CAPE} depthWrite={false} />
      </mesh>
      {/* Left arm */}
      <group ref={leftArmRef} position={[-0.45, 1.15, 0]}>
        <mesh position={[0, -0.2, 0]}>
          <boxGeometry args={[0.2, 0.45, 0.2]} />
          <meshBasicMaterial color={ARMOR} depthWrite={false} />
        </mesh>
        <mesh position={[0, -0.47, 0]}>
          <boxGeometry args={[0.22, 0.18, 0.22]} />
          <meshBasicMaterial color={ARMOR_DARK} depthWrite={false} />
        </mesh>
        {/* Shield — strapped to left arm */}
        <mesh position={[-0.08, -0.3, 0.15]}>
          <boxGeometry args={[0.08, 0.4, 0.3]} />
          <meshBasicMaterial color={ARMOR_DARK} depthWrite={false} />
        </mesh>
      </group>
      {/* Right arm — holds the sword */}
      <group ref={rightArmRef} position={[0.45, 1.15, 0]}>
        <mesh position={[0, -0.2, 0]}>
          <boxGeometry args={[0.2, 0.45, 0.2]} />
          <meshBasicMaterial color={ARMOR} depthWrite={false} />
        </mesh>
        <mesh position={[0, -0.47, 0]}>
          <boxGeometry args={[0.22, 0.18, 0.22]} />
          <meshBasicMaterial color={ARMOR_DARK} depthWrite={false} />
        </mesh>
        <group ref={weaponRef} position={[0.1, -0.45, 0.18]}>
          {/* Blade */}
          <mesh position={[0, -0.5, 0]}>
            <boxGeometry args={[0.08, 1.0, 0.04]} />
            <meshBasicMaterial color={SWORD} depthWrite={false} />
          </mesh>
          {/* Sword glow halo — translucent, always-visible */}
          <mesh position={[0, -0.5, 0]}>
            <boxGeometry args={[0.18, 1.1, 0.14]} />
            <meshBasicMaterial
              color={SWORD_GLOW}
              transparent
              opacity={0.35}
              depthWrite={false}
            />
          </mesh>
          {/* Crossguard */}
          <mesh position={[0, -0.02, 0]}>
            <boxGeometry args={[0.28, 0.06, 0.08]} />
            <meshBasicMaterial color="#c0a020" depthWrite={false} />
          </mesh>
        </group>
      </group>
      {/* Head + helmet */}
      <group position={[0, 1.65, 0]}>
        <mesh>
          <boxGeometry args={[0.42, 0.42, 0.38]} />
          <meshBasicMaterial color={SKIN} depthWrite={false} />
        </mesh>
        {/* Helmet top */}
        <mesh position={[0, 0.2, 0]}>
          <boxGeometry args={[0.46, 0.28, 0.42]} />
          <meshBasicMaterial color={HELM} depthWrite={false} />
        </mesh>
        {/* Eye visor slit */}
        <mesh position={[0, 0.12, 0.21]}>
          <boxGeometry args={[0.3, 0.05, 0.02]} />
          <meshBasicMaterial color={EYE} depthWrite={false} />
        </mesh>
        {/* Helmet crest — red plume running front-to-back */}
        <mesh position={[0, 0.4, 0]}>
          <boxGeometry args={[0.1, 0.2, 0.35]} />
          <meshBasicMaterial color={CAPE} depthWrite={false} />
        </mesh>
      </group>
    </group>
  );
}

// ─── Camera follow ────────────────────────────────────────────────────────────
// Top-down isometric chase, matching the core game's camera feel.

function CameraFollow({ playerRef }: { playerRef: React.MutableRefObject<LabPlayer> }) {
  const { camera } = useThree();
  const target = useRef(new THREE.Vector3());
  // Camera zoomed in (was y=36 / back=8). Drops roughly 40% closer —
  // maze walls fill more of the screen and corridor play reads as
  // immersive rather than map-view. Tilt ratio preserved (~15° off
  // straight-down) so the zone disc still reads as a circle.
  const currentPos = useRef(new THREE.Vector3(0, 22, 6));

  useFrame((_, delta) => {
    const p = playerRef.current;
    const desired = new THREE.Vector3(p.x, 22, p.z + 6);
    currentPos.current.lerp(desired, Math.min(1, delta * 6));
    camera.position.copy(currentPos.current);
    target.current.set(p.x, 0, p.z);
    camera.lookAt(target.current);
  });

  return null;
}

// ─── Movement + collision loop ────────────────────────────────────────────────
// Reads input, moves the player, checks maze wall collisions.

function MovementLoop({
  playerRef,
  maze,
  inputRef,
  sharedRef,
  labDashRef,
  dashCooldownSec,
  gearStateRef,
  lootRoomCell,
  moveSpeedBonus,
  labStats,
  groundFxRef,
}: {
  playerRef: React.MutableRefObject<LabPlayer>;
  maze: Maze;
  inputRef: React.MutableRefObject<InputManager3D | null>;
  sharedRef: React.MutableRefObject<LabSharedState>;
  labDashRef: React.MutableRefObject<LabDashState>;
  dashCooldownSec: number;
  gearStateRef: React.MutableRefObject<LabGearState>;
  lootRoomCell: { col: number; row: number };
  moveSpeedBonus: number;
  labStats: PlayerStats;
  groundFxRef: React.MutableRefObject<LabGroundFx[]>;
}) {
  // World-space centre of the loot-room cell; used by the loot-door
  // collision check below. Recomputed only when lootRoomCell changes.
  const lootCellWorld = useMemo(
    () => cellToWorld(lootRoomCell.col, lootRoomCell.row),
    [lootRoomCell],
  );
  // Precompute wall segments for collision (same data as renderer).
  const segments = useMemo(() => extractWallSegments(maze), [maze]);

  useFrame((_, delta) => {
    const input = inputRef.current;
    if (!input) return;
    if (sharedRef.current.defeated || sharedRef.current.extracted || sharedRef.current.victory) return;
    if (useGameStore.getState().phase === "levelup" || sharedRef.current.isPaused) return;
    const s = input.state;
    const p = playerRef.current;
    const dashState = labDashRef.current;

    // Advance dash timers first so a dash that just ended releases
    // control to the joystick on the same frame (no stuck-in-dash window).
    tickLabDashState(dashState, delta);

    // Joystick / keyboard input direction (normalized, 8-way).
    let dx = 0, dz = 0;
    if (s.up)    dz -= 1;
    if (s.down)  dz += 1;
    if (s.left)  dx -= 1;
    if (s.right) dx += 1;
    const len = Math.sqrt(dx * dx + dz * dz);
    if (len > 0) { dx /= len; dz /= len; }

    // Dash input: consume the latched bit and start a dash toward either
    // the current input direction or, if none, the current facing. Dash
    // facing fallback matches the main game's behavior — you can dash
    // forward while standing still. Warrior dashCooldown = 2.2 (matches
    // GameConfig.PLAYER.DASH_COOLDOWN).
    if (s.dash) {
      input.consumeDash();
      let dirX = dx;
      let dirZ = dz;
      if (dirX === 0 && dirZ === 0) {
        // Reconstruct a unit vector from the stored facing angle. The
        // atan2 used to set p.angle was atan2(dx, -dz), so the inverse is
        // (sin, -cos).
        dirX = Math.sin(p.angle);
        dirZ = -Math.cos(p.angle);
      }
      if (tryStartLabDash(dashState, dirX, dirZ, dashCooldownSec)) {
        audioManager.play("dash");
        if (labStats.toxicDashPuddle) {
          groundFxRef.current.push({
            id: `toxic_${performance.now()}`,
            x: p.x, z: p.z,
            radius: 2.5,
            lifetime: 3.0,
            color: "#40ff80",
            appliesPoison: true,
          });
        }
      }
    }

    // Select active velocity. During a dash, the player glides at
    // LAB_DASH_SPEED in the locked dash direction (joystick is ignored
    // until the dash ends — same as the main game). Otherwise normal
    // walk speed — further reduced ~35% from the previous 7.65 value
    // (itself 15% below main-game's 9 u/s) to give corridor combat
    // a deliberate tactical-roguelite pace. Player leans on dash for
    // quick repositioning. Total 45% below the main game baseline.
    // Gear moveSpeed bonus is added on top — cap at +6 so a triple-
    // stacked moveSpeed build can't teleport across the map.
    // Labyrinth moves at a deliberately slower 5.0 baseline vs the
    // main game's ~8-13 class range — tighter pacing for corridor
    // combat. Soul Forge + race bonuses applied as a DELTA
    // (moveSpeedBonus prop) so flat speed upgrades (Phantom Step
    // +0.4/rank) carry through without overwriting the labyrinth
    // slow-down. Gear moveSpeed bonus capped at +6 on top of that.
    const BASE_WALK_SPEED = 5.0;
    const gearMoveBonus = Math.min(6, gearStateRef.current.bonuses.moveSpeed ?? 0);
    const auraSpdMult = sharedRef.current.companion.alive && isInAura(p.x, p.z, sharedRef.current.companion) ? (1 + COMPANION_AURA_MOVE_SPEED_BONUS) : 1;
    const WALK_SPEED = (BASE_WALK_SPEED + moveSpeedBonus + gearMoveBonus) * auraSpdMult;
    let moveVX: number;
    let moveVZ: number;
    if (dashState.timer > 0) {
      moveVX = dashState.vx;
      moveVZ = dashState.vz;
      p.isDashing = true;
    } else {
      moveVX = dx * WALK_SPEED;
      moveVZ = dz * WALK_SPEED;
      p.isDashing = false;
    }

    const nextX = p.x + moveVX * delta;
    const nextZ = p.z + moveVZ * delta;

    // Axis-separated collision: try X first, then Z. Allows wall-sliding
    // during both normal movement and dashes (dash still respects walls,
    // which prevents phasing but can cut a dash short when you dash into
    // a corner — acceptable matching the main game's behavior).
    const PLAYER_R = 0.7;
    if (!collidesWithAnyWall(nextX, p.z, PLAYER_R, segments)) p.x = nextX;
    if (!collidesWithAnyWall(p.x, nextZ, PLAYER_R, segments)) p.z = nextZ;

    // Loot-door gate (item 7). While the door is locked, treat the
    // loot-room cell as a solid disc of radius LOCK_R centred on the
    // cell — any frame the player ends up inside it, push them back
    // out onto the boundary. When they arrive carrying the key, we
    // flip lootRoomUnlocked / hasKey and signal CombatEnemyLoop to
    // spawn the gear payload on its next tick.
    if (!sharedRef.current.lootRoomUnlocked) {
      const LOCK_R = LABYRINTH_CONFIG.CELL_SIZE * 0.55;
      const PROMPT_R = LABYRINTH_CONFIG.CELL_SIZE * 1.0;  // show prompt further out than the block radius
      const dx = p.x - lootCellWorld.x;
      const dz = p.z - lootCellWorld.z;
      const dsq = dx * dx + dz * dz;
      // Prompt flag: true when player is near the door without a key.
      // Cleared on unlock or when the player walks away.
      sharedRef.current.nearLockedVault =
        !sharedRef.current.hasKey && dsq < PROMPT_R * PROMPT_R;
      if (dsq < LOCK_R * LOCK_R) {
        if (sharedRef.current.hasKey) {
          // Unlock — key is consumed, gear spawn pending, door visual
          // flips via the sharedRef flag polled by the HUD + 3D scene.
          sharedRef.current.lootRoomUnlocked = true;
          sharedRef.current.hasKey = false;
          sharedRef.current.pendingLootSpawn = true;
          sharedRef.current.nearLockedVault = false;
          audioManager.play("wave_clear");
        } else {
          // Blocked. Push back onto the lock boundary.
          const d = Math.sqrt(dsq);
          if (d > 0.001) {
            const nx = dx / d;
            const nz = dz / d;
            p.x = lootCellWorld.x + nx * LOCK_R;
            p.z = lootCellWorld.z + nz * LOCK_R;
          } else {
            // Edge case: somehow standing exactly at cell centre.
            // Eject along +x so the next frame is outside.
            p.x = lootCellWorld.x + LOCK_R;
          }
        }
      }
    } else {
      sharedRef.current.nearLockedVault = false;
    }

    // ── Key pickup (Task 6) ─────────────────────────────────────────
    // Rival-champion death spawns a key pickup at the death spot; the
    // player must walk onto it to claim it. Pickup radius 0.6u.
    if (sharedRef.current.keyPickups.length > 0) {
      const PICKUP_R = 0.6;
      const PICKUP_RSQ = PICKUP_R * PICKUP_R;
      for (let i = sharedRef.current.keyPickups.length - 1; i >= 0; i--) {
        const k = sharedRef.current.keyPickups[i];
        const dx = p.x - k.x;
        const dz = p.z - k.z;
        if (dx * dx + dz * dz <= PICKUP_RSQ) {
          sharedRef.current.hasKey = true;
          sharedRef.current.keyPickups.splice(i, 1);
          audioManager.play("gear_drop");
        }
      }
    }

    // Facing angle follows active movement direction (dash OR joystick).
    if (moveVX !== 0 || moveVZ !== 0) {
      p.angle = Math.atan2(moveVX, -moveVZ);
    }
  });

  return null;
}

// ─── Zone tick loop ──────────────────────────────────────────────────────────
// Advances zone state each frame, applies damage when player is outside
// the safe radius, and updates shared state for the HUD. Throttles the
// React state update for the 3D visual to ~10Hz so we don't re-render
// the Canvas tree every frame — the visual mesh scales smoothly inside
// useFrame anyway.

// ─── Combat + enemy tick loop ────────────────────────────────────────────────
// Single useFrame handles both player-attack input and enemy AI so damage
// and consumption stay in a predictable order. Order per frame:
//   1. Tick attack cooldown / swing visual timer
//   2. AUTO-ATTACK: if cooldown ready and the nearest enemy is within
//      range, swing/fire automatically; otherwise wait. Manual attack
//      input still fires even without a target (desktop keyboard feel).
//   3. Tick every live enemy (AI + movement + melee); accumulate the
//      total damage enemies dealt the player this frame
//   4. Apply accumulated enemy damage to the player (checks defeat)
//   5. Evict fully-faded dead enemies — if the array changes, push the
//      new list to React state so the renderer refreshes.

/** Mage/rogue auto-attack detection range. Slightly longer than the
 *  projectile's actual reach so the player starts firing as soon as
 *  a target comes into range. */
const RANGED_AUTO_RANGE = 12;

/** Find the nearest alive enemy to (px, pz) within maxRange; returns
 *  null if none. Used by auto-attack aim and range gating. */
function findNearestEnemyInRange(
  enemies: readonly EnemyRuntime[],
  px: number,
  pz: number,
  maxRange: number,
): EnemyRuntime | null {
  const maxSq = maxRange * maxRange;
  let best: EnemyRuntime | null = null;
  let bestSq = maxSq;
  for (const e of enemies) {
    if (e.state === "dead") continue;
    const dx = e.x - px;
    const dz = e.z - pz;
    const d = dx * dx + dz * dz;
    if (d < bestSq) {
      bestSq = d;
      best = e;
    }
  }
  return best;
}

function CombatEnemyLoop({
  maze,
  combatStats,
  playerRef,
  sharedRef,
  inputRef,
  attackStateRef,
  enemiesRef,
  deathFxRef,
  progressionRef,
  xpOrbsRef,
  warriorStateRef,
  rangedAttackStateRef,
  projectilesRef,
  trapsRef,
  chestsRef,
  labPoisonRef,
  groundFxRef,
  aimOverrideRef,
  gearStateRef,
  gearDropsRef,
  ranSalvageRef,
  lootRoomCell,
  critChance,
  charClass,
  onEnemiesChange,
  onDeathFxChange,
  onXpOrbsChange,
  onProjectilesChange,
  onChestsChange,
  onGearDropsChange,
  onLootRoomUnlocked,
  labMinionsRef,
  necroPassiveTimer,
  labStats,
}: {
  maze: Maze;
  combatStats: LabCombatStats;
  playerRef: React.MutableRefObject<LabPlayer>;
  sharedRef: React.MutableRefObject<LabSharedState>;
  inputRef: React.MutableRefObject<InputManager3D | null>;
  attackStateRef: React.MutableRefObject<PlayerAttackState>;
  enemiesRef: React.MutableRefObject<EnemyRuntime[]>;
  deathFxRef: React.MutableRefObject<LabDeathFx[]>;
  progressionRef: React.MutableRefObject<LabProgressionState>;
  xpOrbsRef: React.MutableRefObject<XPOrb[]>;
  warriorStateRef: React.MutableRefObject<LabWarriorState>;
  rangedAttackStateRef: React.MutableRefObject<RangedAttackState>;
  projectilesRef: React.MutableRefObject<LabProjectile[]>;
  trapsRef: React.MutableRefObject<LabTrap[]>;
  chestsRef: React.MutableRefObject<LabChest[]>;
  labPoisonRef: React.MutableRefObject<LabPoisonState>;
  groundFxRef: React.MutableRefObject<LabGroundFx[]>;
  aimOverrideRef: React.MutableRefObject<LabAimOverride>;
  gearStateRef: React.MutableRefObject<LabGearState>;
  gearDropsRef: React.MutableRefObject<LabGearDropRuntime[]>;
  ranSalvageRef: React.MutableRefObject<boolean>;
  lootRoomCell: { col: number; row: number };
  critChance: number;
  charClass: CharacterClass;
  onEnemiesChange: (enemies: EnemyRuntime[]) => void;
  onDeathFxChange: (fx: LabDeathFx[]) => void;
  onXpOrbsChange: (orbs: XPOrb[]) => void;
  onProjectilesChange: (projs: LabProjectile[]) => void;
  onChestsChange: (chests: LabChest[]) => void;
  onGearDropsChange: (drops: LabGearDropRuntime[]) => void;
  onLootRoomUnlocked: (unlocked: boolean) => void;
  labMinionsRef: React.MutableRefObject<MinionRuntime[]>;
  necroPassiveTimer: React.MutableRefObject<number>;
  labStats: PlayerStats;
}) {
  const segments = useMemo(() => extractWallSegments(maze), [maze]);
  const labDifficulty = useGameStore((s) => s.labyrinthDifficulty);
  // don't re-render on every frame just because the tick ran.
  const lastEmittedFxLen = useRef(0);
  // Same pattern for the XP-orb render mirror.
  const lastEmittedOrbLen = useRef(0);
  // And for projectiles.
  const lastEmittedProjLen = useRef(0);
  const stalkerSpawnTimer = useRef(LABYRINTH_CONFIG.SHADOW_STALKER_INTERVAL_SEC);
  const wasInAuraRef = useRef(false);
  // Gear drop render-sync tracking (spawns grow the list mid-frame;
  // need explicit length compare to emit correctly).
  const lastEmittedGearLen = useRef(0);

  useFrame((_, delta) => {
    const shared = sharedRef.current;
    // Run-end salvage — fires once the first frame defeated/extracted/
    // victory flips true. Deposits total Soul Forge crystals into the
    // main-game meta store via addShards(), then falls through to the
    // normal early-return. Guarded by ranSalvageRef so it never
    // double-fires across frames.
    if ((shared.defeated || shared.extracted || shared.victory) && !ranSalvageRef.current) {
      ranSalvageRef.current = true;
      const total = salvageLabGear(gearStateRef.current, gearDropsRef.current);
      const dCfg = getDifficultyConfig(labDifficulty);
      const crystalTotal = Math.round(total * shared.soulCrystalMult * (dCfg?.crystalMult ?? 1) * (labStats.shardFindMult ?? 1));
      shared.crystalsEarned = crystalTotal + (shared.layer === 3 && shared.victory ? 500 : 0);
      if (crystalTotal > 0) {
        useMetaStore.getState().addShards(crystalTotal);
      }
    }
    // Evaluate single-run achievements exactly once per run — same
    // guard pattern as ranSalvageRef above. Runs after the salvage
    // block so shard-deposit side effects settle first. Reads
    // playerRef.current directly (p isn't declared yet above the
    // early-return; this block needs to fire regardless of the
    // input-ready guard).
    if ((shared.defeated || shared.extracted || shared.victory) && !shared.achievementsEvaluated) {
      shared.achievementsEvaluated = true;
      evaluateLabRunAchievements(shared, playerRef.current, gearStateRef.current, charClass);
    }
    if (shared.defeated || shared.extracted || shared.victory) return;
    if (useGameStore.getState().phase === "levelup" || sharedRef.current.isPaused) return;
    const input = inputRef.current;
    if (!input) return;

    const p = playerRef.current;
    const atk = attackStateRef.current;
    const enemies = enemiesRef.current;

    // 1) Attack + warrior timers + ranged cooldown
    tickAttackState(atk, delta);
    const isWarrior = charClass === "warrior";
    const isMage = charClass === "mage";

    // Effective combat stats = base (from class) + gear bonuses.
    // Recomputed every tick so equip/swap effects flow in immediately
    // — no need for the combatStats useMemo to invalidate.
    const gearBonuses = gearStateRef.current.bonuses;
    const baseAtkSpeed = 1 / Math.max(0.01, combatStats.atkCooldown);
    const effectiveAtkSpeed = Math.max(0.1, (baseAtkSpeed + (gearBonuses.attackSpeed ?? 0)) * playerRef.current.actionAtkSpeedMult);
    const companionAura = shared.companion.alive && isInAura(p.x, p.z, shared.companion);
    const auraDmgMult = companionAura ? (1 + COMPANION_AURA_DAMAGE_BONUS) : 1;
    const effectiveStats: LabCombatStats = {
      damage: Math.round((combatStats.damage + (gearBonuses.damage ?? 0)) * playerRef.current.actionDmgMult * auraDmgMult),
      atkRange: combatStats.atkRange,
      atkCooldown: 1 / effectiveAtkSpeed,
    };
    const effectiveCrit = critChance + (gearBonuses.critChance ?? 0);
    const isRogue = charClass === "rogue";
    const isNecromancer = charClass === "necromancer";
    const isMelee = isWarrior || isNecromancer;
    if (isWarrior) tickLabWarrior(warriorStateRef.current, delta);
    if (!isMelee) tickRangedAttack(rangedAttackStateRef.current, delta);

    // 2) Auto-attack per class. No manual trigger — the player fires
    //    whenever their cooldown is ready AND a target is available:
    //      Warrior → swing the melee arc if the nearest alive enemy
    //                is within swing reach (+small buffer).
    //      Mage    → fire an orb if the nearest alive enemy is within
    //                RANGED_AUTO_RANGE.
    //      Rogue   → fire a dagger fan under the same conditions.
    //    Aim direction uses the optional InputManager aim override
    //    (mobile aim stick, falls back to facing-the-nearest-enemy).
    //    Manual attack input still swings/fires if the player tapped
    //    attack on desktop (spacebar / click) — that keeps keyboard
    //    play snappy even though the button is no longer required.
    const inputState = input.state;

    // ── Action ability ────────────────────────────────────────────
    if (p.actionCooldownTimer > 0) p.actionCooldownTimer = Math.max(0, p.actionCooldownTimer - delta);
    if (p.actionActiveTimer > 0) {
      p.actionActiveTimer -= delta;
      if (p.actionActiveTimer <= 0) {
        p.actionActiveTimer = 0;
        p.actionArmorBuff = 0;
        p.actionDmgMult = 1;
        p.actionAtkSpeedMult = 1;
        p.actionOrbSizeMult = 1;
      }
    }
    if (p.actionVulnerabilityTimer > 0) p.actionVulnerabilityTimer = Math.max(0, p.actionVulnerabilityTimer - delta);

    if (inputState.action && p.actionCooldownTimer <= 0) {
      input.consumeAction();
      const baseCd = (labStats.actionCooldown || 60) * (1 - (labStats.actionCdrPct || 0));
      p.actionCooldownTimer = baseCd;
      if (charClass === "warrior") {
        p.actionActiveTimer = 3.0;
        p.actionArmorBuff = 8;
        p.actionDmgMult = 1.25;
        audioManager.play("dash");
      } else if (charClass === "mage") {
        p.actionActiveTimer = 5.0;
        p.actionAtkSpeedMult = 3.0;
        p.actionOrbSizeMult = 2.0;
        audioManager.play("attack_melee");
      } else if (charClass === "rogue") {
        const FAN_COUNT = 12;
        const FAN_DMG = Math.round(effectiveStats.damage * 1.2);
        const FAN_SPEED = 18;
        const FAN_LIFETIME = 0.5;
        const FAN_RADIUS = 0.4;
        for (let i = 0; i < FAN_COUNT; i++) {
          const ang = (i / FAN_COUNT) * Math.PI * 2;
          projectilesRef.current.push({
            id: `fan_${Date.now()}_${i}`,
            owner: "player",
            x: p.x + Math.sin(ang) * 1.2, z: p.z + Math.cos(ang) * 1.2,
            vx: Math.sin(ang) * FAN_SPEED, vz: Math.cos(ang) * FAN_SPEED,
            damage: FAN_DMG, radius: FAN_RADIUS, lifetime: FAN_LIFETIME,
            piercing: false, hitIds: new Set<string>(), dead: false,
            color: "#a0ffff", glowColor: "#20c870", style: "dagger",
          });
        }
        audioManager.play("attack_melee");
      } else if (charClass === "necromancer") {
        p.actionActiveTimer = 5.0;
        p.actionDmgMult = 2.0;
        p.actionAtkSpeedMult = 1.6;
        audioManager.play("dash");
      } else if (charClass === "bard") {
        p.actionVulnerabilityTimer = 6.0;
        const DISCORD_RADIUS = 8;
        for (const e of enemies) {
          if (e.state === "dead") continue;
          const dx = e.x - p.x, dz = e.z - p.z;
          if (dx * dx + dz * dz <= DISCORD_RADIUS * DISCORD_RADIUS && hasLineOfSight(p.x, p.z, e.x, e.z, segments)) {
            e.confuseTimer = 6.0;
          }
        }
        audioManager.play("attack_melee");
      }
    }

    if (charClass === "warrior" && p.actionActiveTimer > 0) {
      for (const e of enemies) {
        if (e.state === "dead") continue;
        const sx = p.x - e.x, sz = p.z - e.z;
        const sd = Math.sqrt(sx * sx + sz * sz);
        if (sd <= 10 && sd > 0.5 && hasLineOfSight(p.x, p.z, e.x, e.z, segments)) {
          const pullStr = 8 * delta;
          e.x += (sx / sd) * pullStr;
          e.z += (sz / sd) * pullStr;
        }
      }
    }

    useGameStore.getState().setActionState(p.actionCooldownTimer, labStats.actionCooldown || 60);

    const autoAimRange = isMelee
      ? effectiveStats.atkRange * 1.15
      : RANGED_AUTO_RANGE;
    const aimTarget = findNearestEnemyInRange(enemies, p.x, p.z, autoAimRange);
    let aimAngle = p.angle;
    if (aimOverrideRef.current.active) {
      // Mobile aim stick wins over auto-aim — player is steering attacks.
      aimAngle = aimOverrideRef.current.angle;
      p.angle = aimAngle;
    } else if (aimTarget) {
      aimAngle = Math.atan2(aimTarget.x - p.x, -(aimTarget.z - p.z));
      p.angle = aimAngle;
    }
    // Fire whenever we have a target OR the player is manually aiming
    // (mobile stick active) OR they pressed the desktop attack key.
    const canAttack =
      aimTarget !== null ||
      aimOverrideRef.current.active ||
      inputState.attack;
    if (inputState.attack) input.consumeAttack();
    if (canAttack) {
      if (isMelee) {
        if (tryStartSwing(atk, aimAngle, effectiveStats)) {
          audioManager.play("attack_melee");
          for (const e of enemies) {
            if (e.state === "dead") continue;
            if (isInSwingArc(p.x, p.z, atk.swingAngle, e.x, e.z, atk.swingRange) && hasLineOfSight(p.x, p.z, e.x, e.z, segments)) {
              let dmg = modifyOutgoingDamage(warriorStateRef.current, effectiveStats.damage, effectiveCrit);
              dmg = Math.round(dmg * p.actionDmgMult);
              if (p.actionVulnerabilityTimer > 0) dmg = Math.round(dmg * 1.2);
              const isCrit = warriorStateRef.current.lastHitWasCrit;
              const killed = damageEnemy(e, dmg);
              useGameStore.getState().addDamagePopup({
                id: `dmg_${e.id}_${performance.now()}_${Math.random().toString(36).slice(2,5)}`,
                x: e.x, z: e.z, value: dmg, isCrit, isPlayer: false, spawnTime: performance.now(),
              });
              if (labStats.lifesteal > 0) {
                labHealPlayer(p, Math.round(dmg * labStats.lifesteal), labStats.healCap);
              }
              registerHit(warriorStateRef.current);
              if (killed) {
                if (labStats.onKillHeal > 0) labHealPlayer(p, labStats.onKillHeal, labStats.healCap);
                shared.killCount++;
                audioManager.play("enemy_death");
                spawnLabDeathFx(deathFxRef.current, e.x, e.z, e.kind === "warden" || e.kind === "death_knight" ? "#ff40ff" : "#ff3030");
                spawnLabXpOrb(xpOrbsRef.current, e.x, e.z);
                // Bonus loot roll — mirrors the treasure-chest payout.
                const loot = rollEnemyLoot(xpOrbsRef.current, e.kind, e.x, e.z);
                if (loot.rolled) {
                  audioManager.play("gear_drop");
                  if (loot.healOnPickup > 0) labHealPlayer(p, loot.healOnPickup, labStats.healCap);
                }
                // Gear drop roll — uses main-game tryRollGear() via the
                // labyrinth wrapper. Separate from the XP-orb loot above.
                const gearRoll = rollLabGearDrop(e.kind, getDifficultyConfig(labDifficulty)?.gearDropMult ?? 1);
                if (gearRoll) {
                  spawnLabGearDrop(gearDropsRef.current, gearRoll, e.x, e.z);
                }
                const gained = registerKill(warriorStateRef.current);
                if (gained > 0) {
                  p.maxHp += gained;
                  labHealPlayer(p, gained, labStats.healCap);
                }
                if (e.kind === "warden") {
                  clearWardenState(e.id);
                  audioManager.play("wave_clear");
                  shared.layerComplete = true;
                  shared.layerBanner = { text: "WARDEN SLAIN — PORTALS OPENED", sub: "CLAIM YOUR VICTORY", color: "#ff60ff", at: shared.zone.elapsedSec };
                }
                if (e.kind === "death_knight") {
                  shared.layerComplete = true;
                  clearDeathKnightState(e.id);
                  audioManager.play("wave_clear");
                  shared.layerBanner = { text: "DEATH KNIGHT DESTROYED", sub: "THE ABYSS IS CONQUERED", color: "#44ffaa", at: shared.zone.elapsedSec };
                }
                if (e.kind === "mini_boss") {
                  shared.miniBossAlive = false;
                  clearMiniBossState(e.id);
                  shared.layerComplete = true;
                  shared.layerBanner = { text: "PORTALS OPENED — CHOOSE YOUR PATH", sub: shared.layer < 3 ? "DESCEND DEEPER OR EXTRACT" : "THE ABYSS IS CONQUERED", color: "#44ff88", at: shared.zone.elapsedSec };
                  audioManager.play("wave_clear");
                }
                if (e.kind === "rival_warrior" || e.kind === "rival_mage" || e.kind === "rival_rogue" || e.kind === "rival_necromancer" || e.kind === "rival_bard") {
                  onRivalChampionKill(e, shared, gearDropsRef.current);
                  audioManager.play("wave_clear");
                }
              }
            }
          }
        }
      } else if (isMage) {
        if (tryFireMageOrb(rangedAttackStateRef.current, projectilesRef.current, p.x, p.z, aimAngle, labStats, p.actionAtkSpeedMult, p.actionOrbSizeMult)) {
          audioManager.play("attack_orb");
        }
      } else if (isRogue) {
        if (tryFireRogueFan(rangedAttackStateRef.current, projectilesRef.current, p.x, p.z, aimAngle, labStats, p.actionAtkSpeedMult)) {
          audioManager.play("attack_dagger");
        }
      } else if (charClass === "bard") {
        if (tryFireBardNote(rangedAttackStateRef.current, projectilesRef.current, p.x, p.z, aimAngle, labStats, p.actionAtkSpeedMult)) {
          audioManager.play("attack_dagger");
        }
      }
    }

    // 3) Enemy AI + melee; accumulate damage they deal the player.
    //    Trap Spawner turrets also spawn projectiles into the shared
    //    pool via this same dispatch (handled inside updateEnemy).
    //    The Warden uses its own dedicated tick (3-phase state machine)
    //    since it needs starburst + minion-spawn scheduling.
    const dmgAccum = { value: 0 };
    const rivalPoisonAccum = { value: 0 };
    const aliveBeforeTick = new Set(enemies.filter((e) => e.state !== "dead").map((e) => e.id));
    for (const e of enemies) {
      if (e.state === "dead") { updateEnemy(e, p.x, p.z, segments, delta, enemies, dmgAccum, projectilesRef.current, rivalPoisonAccum); continue; }
      if (e.kind === "warden") {
        updateWarden(
          e, p.x, p.z, delta,
          dmgAccum,
          projectilesRef.current,
          (mx, mz) => { const g = makeCorridorGuardianAt(mx, mz); const dc = getDifficultyConfig(labDifficulty); if (dc) applyDifficultyMode(g, dc); enemies.push(g); },
        );
      } else if (e.kind === "death_knight") {
        updateDeathKnight(
          e, p.x, p.z, delta,
          dmgAccum,
          projectilesRef.current,
          (mx, mz) => { const g = makeCorridorGuardianAt(mx, mz); const dc = getDifficultyConfig(labDifficulty); if (dc) applyDifficultyMode(g, dc); enemies.push(g); },
          enemies,
          labDifficulty === "nightmare",
        );
      } else if (e.kind === "mini_boss") {
        updateMiniBoss(e, p.x, p.z, delta, dmgAccum, projectilesRef.current);
      } else {
        updateEnemy(e, p.x, p.z, segments, delta, enemies, dmgAccum, projectilesRef.current, rivalPoisonAccum);
      }
    }
    if (rivalPoisonAccum.value > 0) {
      addLabPoisonStacks(labPoisonRef.current, rivalPoisonAccum.value, undefined);
    }

    // Poison-kill sweep: enemies killed by DoT during updateEnemy()
    // bypass the normal kill handler. Detect freshly dead enemies and
    // credit kills, death FX, XP, champion tracking, etc.
    for (const e of enemies) {
      if (e.state === "dead" && aliveBeforeTick.has(e.id) && e.hp <= 0) {
        aliveBeforeTick.delete(e.id);
        shared.killCount++;
        spawnLabDeathFx(deathFxRef.current, e.x, e.z, e.kind === "warden" || e.kind === "death_knight" ? "#ff40ff" : "#ff3030");
        spawnLabXpOrb(xpOrbsRef.current, e.x, e.z);
        const loot = rollEnemyLoot(xpOrbsRef.current, e.kind, e.x, e.z);
        if (loot.rolled) audioManager.play("gear_drop");
        const gearRoll = rollLabGearDrop(e.kind, getDifficultyConfig(labDifficulty)?.gearDropMult ?? 1);
        if (gearRoll) spawnLabGearDrop(gearDropsRef.current, gearRoll, e.x, e.z);
        if (e.kind === "warden") {
          clearWardenState(e.id);
          audioManager.play("wave_clear");
          shared.layerComplete = true;
          shared.layerBanner = { text: "WARDEN SLAIN — PORTALS OPENED", sub: "CLAIM YOUR VICTORY", color: "#ff60ff", at: shared.zone.elapsedSec };
        }
        if (e.kind === "death_knight") {
          shared.layerComplete = true;
          clearDeathKnightState(e.id);
          audioManager.play("wave_clear");
          shared.layerBanner = { text: "DEATH KNIGHT DESTROYED", sub: "THE ABYSS IS CONQUERED", color: "#44ffaa", at: shared.zone.elapsedSec };
        }
        if (e.kind === "rival_warrior" || e.kind === "rival_mage" || e.kind === "rival_rogue" || e.kind === "rival_necromancer" || e.kind === "rival_bard") {
          onRivalChampionKill(e, shared, gearDropsRef.current);
          audioManager.play("wave_clear");
        }
      }
    }

    // Sync the HUD boss-bar snapshot from the live warden each frame.
    // Also flips alive=false the frame the warden dies so the HUD
    // hides the bar automatically. Only touches shared.wardenHud if
    // a warden has been spawned — null before then.
    if (shared.wardenHud && shared.wardenHud.alive) {
      const liveWarden = enemies.find((e) => e.kind === "warden" && e.state !== "dead");
      if (liveWarden) {
        shared.wardenHud.hp = liveWarden.hp;
        shared.wardenHud.specialWarn = getWardenState(liveWarden.id).starburstWarning > 0;
      } else {
        // Warden died this frame (state flipped to "dead" in the kill
        // path). Freeze HP at 0 and hide the bar.
        shared.wardenHud.alive = false;
        shared.wardenHud.hp = 0;
        shared.wardenHud.specialWarn = false;
      }
    }

    // Sync the HUD boss-bar snapshot from the live death knight.
    if (shared.deathKnightHud && shared.deathKnightHud.alive) {
      const liveDK = enemies.find((e) => e.kind === "death_knight" && e.state !== "dead");
      if (liveDK) {
        shared.deathKnightHud.hp = liveDK.hp;
        shared.deathKnightHud.specialWarn = getDeathKnightState(liveDK.id).slamWarning > 0;
      } else {
        shared.deathKnightHud.alive = false;
        shared.deathKnightHud.hp = 0;
        shared.deathKnightHud.specialWarn = false;
      }
    }

    // 3a) Tick wall-traps (warn → fire → cooldown state machines).
    //     On the warn→fire transition a projectile is spawned into the
    //     shared pool, which is then moved/collided by the projectile
    //     tick just below.
    tickLabTraps(trapsRef.current, projectilesRef.current, delta);

    // 3b) Projectiles — move, collide against walls/enemies/player.
    //     Enemy-owned projectiles roll into dmgAccum so the player-death
    //     handling below covers both melee and ranged hits in one path.
    //     Player-owned projectiles damage enemies directly with on-kill
    //     callbacks that spawn death FX + XP orbs + warrior Bloodforge.
    tickLabProjectiles(projectilesRef.current, delta, {
      playerX: p.x,
      playerZ: p.z,
      playerRadius: 0.7,
      enemies,
      enemyRadius: 1.0,
      segments,
      wallThickness: LABYRINTH_CONFIG.WALL_THICKNESS,
      playerDamageAccum: dmgAccum,
      labStats,
      critChance: effectiveCrit,
      critDamageMultiplier: labStats.critDamageMultiplier,
      onPlayerPull: (toX, toZ, pullDist) => {
        const pdx = toX - p.x, pdz = toZ - p.z;
        const pd = Math.sqrt(pdx * pdx + pdz * pdz);
        if (pd > pullDist) {
          const move = pd - pullDist;
          p.x += (pdx / pd) * move;
          p.z += (pdz / pd) * move;
        }
      },
      onEnemyHit: (e, dmg, isCrit) => {
        useGameStore.getState().addDamagePopup({
          id: `dmg_${e.id}_${performance.now()}_${Math.random().toString(36).slice(2,5)}`,
          x: e.x, z: e.z, value: dmg, isCrit: !!isCrit, isPlayer: false, spawnTime: performance.now(),
        });
        if (labStats.lifesteal > 0) {
          labHealPlayer(p, Math.round(dmg * labStats.lifesteal), labStats.healCap);
        }
      },
      onEnemyKilled: (e) => {
        if (labStats.onKillHeal > 0) labHealPlayer(p, labStats.onKillHeal, labStats.healCap);
        shared.killCount++;
        audioManager.play("enemy_death");
        spawnLabDeathFx(deathFxRef.current, e.x, e.z, e.kind === "warden" || e.kind === "death_knight" ? "#ff40ff" : "#ff3030");
        spawnLabXpOrb(xpOrbsRef.current, e.x, e.z);
        const loot = rollEnemyLoot(xpOrbsRef.current, e.kind, e.x, e.z);
        if (loot.rolled) {
          audioManager.play("gear_drop");
          if (loot.healOnPickup > 0) labHealPlayer(p, loot.healOnPickup, labStats.healCap);
        }
        // Gear drop roll — also fires on ranged kills.
        const gearRoll = rollLabGearDrop(e.kind, getDifficultyConfig(labDifficulty)?.gearDropMult ?? 1);
        if (gearRoll) {
          spawnLabGearDrop(gearDropsRef.current, gearRoll, e.x, e.z);
        }
        if (isWarrior) {
          const gained = registerKill(warriorStateRef.current);
          if (gained > 0) {
            p.maxHp += gained;
            labHealPlayer(p, gained, labStats.healCap);
          }
        }
        if (e.kind === "warden") {
          clearWardenState(e.id);
          audioManager.play("wave_clear");
          shared.layerComplete = true;
          shared.layerBanner = { text: "WARDEN SLAIN — PORTALS OPENED", sub: "CLAIM YOUR VICTORY", color: "#ff60ff", at: shared.zone.elapsedSec };
        }
        if (e.kind === "death_knight") {
          shared.layerComplete = true;
          clearDeathKnightState(e.id);
          audioManager.play("wave_clear");
          shared.layerBanner = { text: "DEATH KNIGHT DESTROYED", sub: "THE ABYSS IS CONQUERED", color: "#44ffaa", at: shared.zone.elapsedSec };
        }
        if (e.kind === "rival_warrior" || e.kind === "rival_mage" || e.kind === "rival_rogue" || e.kind === "rival_necromancer" || e.kind === "rival_bard") {
          onRivalChampionKill(e, shared, gearDropsRef.current);
          audioManager.play("wave_clear");
        }
      },
    });

    // 4) Apply enemy damage to the player. Play player_hurt whenever
    //    a hit actually lands, and player_death on the killing blow —
    //    matches the main game's damage-feedback SFX timing. After
    //    damage, auto-pop War Cry if HP dropped into the trigger band.
    if (dmgAccum.value > 0) {
      const wasAlive = p.hp > 0;
      const incoming = Math.max(0, dmgAccum.value - p.actionArmorBuff) * (1 - (labStats.damageReductionPct ?? 0));
      useGameStore.getState().addDamagePopup({
        id: `player_hit_${performance.now()}`,
        x: p.x, z: p.z, value: Math.round(incoming), isCrit: false, isPlayer: true, spawnTime: performance.now(),
      });
      p.hp = Math.max(0, p.hp - incoming);
      if (labStats.thornsPct > 0) {
        const thornsDmg = Math.round(incoming * labStats.thornsPct);
        if (thornsDmg > 0) {
          for (const e of enemies) {
            if (e.state === "dead") continue;
            const tx = e.x - p.x, tz = e.z - p.z;
            if (tx * tx + tz * tz <= 16) {
              e.hp = Math.max(0, e.hp - thornsDmg);
              e.hitFlashTimer = 0.15;
            }
          }
        }
      }
      if (p.hp <= 0) {
        shared.defeated = true;
        if (wasAlive) audioManager.play("player_death");
      } else {
        audioManager.play("player_hurt");
        if (isWarrior && maybeTriggerWarCry(warriorStateRef.current, p.hp, p.maxHp)) {
          audioManager.play("boss_special");
        }
      }
    }

    // Snapshot warrior state for HUD consumption.
    shared.warrior = isWarrior ? snapshotLabWarrior(warriorStateRef.current) : null;

    // 5) Evict fully-faded dead enemies. Only re-emit the array when
    //    membership actually changes — avoids churn on every frame.
    const beforeLen = enemies.length;
    const filtered = enemies.filter((e) => !isEnemyEvictable(e));
    if (filtered.length !== beforeLen) {
      enemiesRef.current = filtered;
      shared.enemyCount = filtered.filter((e) => e.state !== "dead").length;
      onEnemiesChange(filtered.slice());
    } else {
      // Keep the live count accurate even without eviction.
      shared.enemyCount = enemies.filter((e) => e.state !== "dead").length;
    }

    // 6) Tick + evict death bursts. Re-emit to React state only when
    //    the array length changed (a burst was spawned this frame OR
    //    at least one expired). Mid-burst animation runs from the
    //    already-mounted DeathBurst components' useFrame reads of
    //    fx.age, so we don't need a re-render every frame.
    const fxPrevLen = lastEmittedFxLen.current;
    const tickedFx = tickLabDeathFx(deathFxRef.current, delta);
    deathFxRef.current = tickedFx;
    if (tickedFx.length !== fxPrevLen) {
      lastEmittedFxLen.current = tickedFx.length;
      onDeathFxChange(tickedFx.slice());
    }

    // 6b) Necromancer minion system — passive spawn + orbit + auto-fire
    if (isNecromancer) {
      const minions = labMinionsRef.current;
      const NECRO_CAP = labStats.necroArmyOfDarkness ? 5 : labStats.necroMinionCap;
      const ORBIT_R = 3;
      const ORBIT_SPD = 1.5;
      const BONE_SPD = 12;
      const BONE_LIFE = 2.0;
      const BONE_RAD = 0.15;

      // Passive spawn
      necroPassiveTimer.current -= delta;
      if (necroPassiveTimer.current <= 0 && minions.length < NECRO_CAP) {
        necroPassiveTimer.current = 3.0;
        const mhp = labStats.necroMinionHp + labStats.necroMinionHpBonus;
        minions.push({
          id: `lm_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
          x: p.x + (Math.random() - 0.5) * 2, z: p.z + (Math.random() - 0.5) * 2,
          angle: 0, hp: mhp, maxHp: mhp,
          orbitAngle: Math.random() * Math.PI * 2,
          fireTimer: labStats.necroMinionFireRate * 0.5,
          spawnTime: performance.now(),
        });
      }

      // Tick each minion: orbit, aim, fire, collision with enemy projectiles
      for (let mi = minions.length - 1; mi >= 0; mi--) {
        const m = minions[mi];
        m.orbitAngle += ORBIT_SPD * delta;
        m.x = p.x + Math.cos(m.orbitAngle) * ORBIT_R;
        m.z = p.z + Math.sin(m.orbitAngle) * ORBIT_R;

        // Find nearest enemy
        let nearDist = Infinity;
        let nearE: EnemyRuntime | null = null;
        for (const e of enemies) {
          if (e.state === "dead") continue;
          const dx = e.x - m.x, dz = e.z - m.z;
          const d = dx * dx + dz * dz;
          if (d < nearDist && hasLineOfSight(m.x, m.z, e.x, e.z, segments)) { nearDist = d; nearE = e; }
        }
        if (nearE) m.angle = Math.atan2(nearE.x - m.x, nearE.z - m.z);

        // Auto-fire
        m.fireTimer -= delta;
        if (m.fireTimer <= 0 && nearE) {
          m.fireTimer = labStats.necroMinionFireRate;
          const boneDmg = Math.round(effectiveStats.damage * 0.10) + labStats.necroMinionDamageBonus;
          const boneAngle = Math.atan2(nearE.x - m.x, nearE.z - m.z);
          spawnLabProjectile(projectilesRef.current, {
            owner: "player",
            x: m.x, z: m.z,
            vx: Math.sin(boneAngle) * BONE_SPD,
            vz: Math.cos(boneAngle) * BONE_SPD,
            damage: boneDmg,
            radius: BONE_RAD,
            lifetime: BONE_LIFE,
            piercing: false,
            color: "#44ff66",
            glowColor: "#22cc44",
            style: "orb",
          });
        }

        // Take damage from enemy projectiles
        for (const ep of projectilesRef.current) {
          if (ep.dead || ep.owner !== "enemy") continue;
          const dx = ep.x - m.x, dz = ep.z - m.z;
          if (Math.sqrt(dx * dx + dz * dz) <= 0.8) {
            m.hp -= ep.damage;
            ep.dead = true;
          }
        }

        if (m.hp <= 0) {
          minions.splice(mi, 1);
        }
      }
    }

    // 6c) Bard companion — follow, attack, take damage, aura
    if (shared.companion.alive) {
      tickCompanion(
        shared.companion, p.x, p.z, delta,
        enemies, projectilesRef.current, segments,
      );
      if (!shared.companion.alive) {
        shared.companionDiedDuringRun = true;
      }
    }

    // Companion aura — +10% max HP while in radius
    {
      const inAura = companionAura;
      const wasIn = wasInAuraRef.current;
      if (inAura && !wasIn) {
        const bonus = Math.round(p.maxHp * COMPANION_AURA_HP_BONUS);
        p.maxHp += bonus;
        p.hp += bonus;
      } else if (!inAura && wasIn) {
        const bonus = Math.round(p.maxHp / (1 + COMPANION_AURA_HP_BONUS) * COMPANION_AURA_HP_BONUS);
        p.maxHp = Math.max(1, p.maxHp - bonus);
        p.hp = Math.min(p.hp, p.maxHp);
      }
      wasInAuraRef.current = inAura;
    }

    // Summon sign — proximity check + activation
    if (shared.summonSign && !shared.summonSign.consumed && isNearSign(p.x, p.z, shared.summonSign)) {
      if (!shared.companion.summoned) {
        const crystals = useMetaStore.getState().shards;
        if (crystals >= COMPANION_SUMMON_COST) {
          useMetaStore.getState().spendShards(COMPANION_SUMMON_COST);
          shared.companion.summoned = true;
          shared.companion.alive = true;
          shared.companion.hp = COMPANION_BASE_HP;
          shared.companion.maxHp = COMPANION_BASE_HP;
          shared.companion.x = shared.summonSign.x;
          shared.companion.z = shared.summonSign.z;
          shared.summonSign.consumed = true;
          shared.companionEverSummoned = true;
          shared.layerBanner = { text: "WANDERING BARD SUMMONED", sub: "A COMPANION JOINS YOUR QUEST", color: "#ffc830", at: shared.zone.elapsedSec };
          audioManager.play("wave_clear");
        }
      }
    }

    // 7) XP orbs — pickup detection + collect-animation tick, then
    //    award any XP to progression. On level-up: bump maxHp by +5,
    //    heal the player to full, and play the level-up SFX.
    const orbPrevLen = xpOrbsRef.current.length;
    const orbTick = tickLabXpOrbs(xpOrbsRef.current, p.x, p.z, delta, labStats.pickupRadiusMult ?? 1);
    if (orbTick.awardedXp > 0) {
      audioManager.play("xp_pickup");
      // Per-layer XP multiplier — LAYER_CONFIG[layer].xpMultiplier
      // (L1 = 1x, L2 = 2x, L3 = 2x). Applied at award time so the
      // base orb values stay unchanged and the multiplier scales the
      // total the player banks each pickup batch.
      const layerXpMult = LAYER_CONFIG[shared.layer]?.xpMultiplier ?? 1;
      const dXp = getDifficultyConfig(labDifficulty);
      const diffXpMult = dXp
        ? (shared.layer === 1 ? dXp.xpMultLayer1 : shared.layer === 2 ? dXp.xpMultLayer2 : 1)
        : 1;
      addLabXp(progressionRef.current, orbTick.awardedXp * layerXpMult * diffXpMult);
      if (progressionRef.current.pendingLevelUps > 0) {
        progressionRef.current.pendingLevelUps -= 1;
        p.maxHp += 3;
        labHealPlayer(p, 20, labStats.healCap);
        audioManager.play("level_up");
        const prog = progressionRef.current;
        const choices = pickUpgradeChoices(prog.acquiredUpgrades, 3, prog.level, prog.charClass, LAB_EXCLUDED_UPGRADES);
        useGameStore.getState().setProgression(prog.level, prog.xp, prog.xpToNext);
        useGameStore.getState().setLevelUpChoices(choices);
      }
    }
    shared.level = progressionRef.current.level;
    shared.xp = progressionRef.current.xp;
    shared.xpToNext = progressionRef.current.xpToNext;
    shared.totalXp = progressionRef.current.totalXp;

    // Passive HP regen — labyrinth-only. Scales linearly with player
    // level: 0.1 HP/sec at L1, +0.1 per level (L2=0.2, L10=1.0, ...).
    // Small enough that combat pressure still matters, but adds up
    // during exploration lulls. Skipped when dead (p.hp <= 0) or
    // already at full HP (clamp makes it a no-op anyway, but we skip
    // the math). Does NOT touch PlayerRuntime or the main-game
    // GameScene healing pipeline.
    if (p.hp > 0 && p.hp < p.maxHp) {
      const regenPerSec = 0.1 * progressionRef.current.level;
      p.hp = Math.min(p.maxHp * (labStats.healCap ?? 1), p.hp + regenPerSec * delta);
    }
    if (labStats.hpDrainPerSec > 0 && p.hp > 0) {
      p.hp = Math.max(0, p.hp - labStats.hpDrainPerSec * delta);
      if (p.hp <= 0) shared.defeated = true;
    }

    // 7a) Shadow-stalker spawn. Every SHADOW_STALKER_INTERVAL_SEC, if no
    //     stalker is currently alive, materialise one at the farthest
    //     dead-end from the player. Only one alive at a time — keeps
    //     them scary rather than overwhelming.
    stalkerSpawnTimer.current -= delta;
    if (stalkerSpawnTimer.current <= 0) {
      const stalkerAlive = enemies.some(
        (e) => e.kind === "shadow_stalker" && e.state !== "dead",
      );
      if (!stalkerAlive) {
        const spawnPos = findStalkerSpawnCell(maze, p.x, p.z);
        if (spawnPos) {
          const stalker = makeShadowStalker(spawnPos.x, spawnPos.z);
          { const dc = getDifficultyConfig(labDifficulty); if (dc) applyDifficultyMode(stalker, dc); }
          enemies.push(stalker);
          onEnemiesChange(enemies.slice());
          shared.enemyCount = enemies.filter((e) => e.state !== "dead").length;
        }
      }
      stalkerSpawnTimer.current = LABYRINTH_CONFIG.SHADOW_STALKER_INTERVAL_SEC;
    }

    // 7a-b) Rival champion spawns. Two rivals per run — the two
    //       classes the player did NOT pick, each rendered with its
    //       player-side class mesh + a corrupted dark tint.
    //       First rival at ~2 min in the mid ring, second at ~5 min
    //       in the outer ring. First kill drops the vault key,
    //       second kill drops a guaranteed rare (see kill handler).
    // ── Descent champion spawn schedule ──────────────────────────────
    // Champions spawn on layer-specific timers (LAYER_CONFIG.championScheduleSec).
    // Each champion spawns 15-25u from player, behind them. Max 2 alive.
    {
      const lc = LAYER_CONFIG[shared.layer];
      const schedule = lc.championScheduleSec;
      if (shared.championSpawnIndex < schedule.length && shared.layerElapsedSec >= schedule[shared.championSpawnIndex]) {
        const aliveChampions = enemies.filter((e) => e.state !== "dead" && (e.kind === "rival_warrior" || e.kind === "rival_mage" || e.kind === "rival_rogue" || e.kind === "rival_necromancer" || e.kind === "rival_bard")).length;
        if (aliveChampions < 2) {
          // Pick champion kind based on index
          const [r1, r2, r3, r4] = rivalOrderForClass(charClass);
          const championKinds: Array<"rival_warrior" | "rival_mage" | "rival_rogue" | "rival_necromancer" | "rival_bard"> = shared.layer === 1
            ? [r1, r2, r3, r4]   // 4 champions: cycle all rival classes
            : [r1, r2, r3];      // 3 champions
          const kind = championKinds[shared.championSpawnIndex % championKinds.length];
          const champ = makeRivalChampion(kind, 0, 0);
          { const dc = getDifficultyConfig(labDifficulty); if (dc) applyDifficultyMode(champ, dc); }
          enemies.push(champ);
          onEnemiesChange(enemies.slice());
          shared.enemyCount = enemies.filter((e) => e.state !== "dead").length;
          shared.rivalAnnounce = { kind, announcedAt: shared.zone.elapsedSec };
          shared.championSpawnIndex += 1;
          audioManager.play("boss_spawn");
        }
      }
    }

    // 7b) Chest proximity + reveal tick. May spawn XP orbs (treasure),
    //     push to groundFxRef (trapped — poison pool), or push to
    //     enemies (mimic reveal). After the reveal animation the
    //     chest's state flips to "consumed" and the render list
    //     filters it out. Track the enemy-list length BEFORE ticking
    //     so we can detect and emit a fresh mimic spawn this frame
    //     (the main enemy-eviction path can't see spawns, only
    //     evictions).
    const enemiesBeforeChests = enemiesRef.current.length;
    const chestTick = tickLabChests(
      chestsRef.current,
      p.x,
      p.z,
      delta,
      {
        xpOrbs: xpOrbsRef.current,
        groundFx: groundFxRef.current,
        enemies: enemiesRef.current,
        playerHeal: (amount) => {
          labHealPlayer(p, amount, labStats.healCap);
        },
        playerPoison: (stacks) => {
          addLabPoisonStacks(labPoisonRef.current, stacks, undefined);
        },
        playAudio: (key) => audioManager.play(key),
      },
    );
    if (chestTick.changed) {
      onChestsChange(chestsRef.current.slice());
    }
    if (enemiesRef.current.length > enemiesBeforeChests) {
      // A mimic appeared — refresh the enemy render list.
      onEnemiesChange(enemiesRef.current.slice());
      shared.enemyCount = enemiesRef.current.filter((e) => e.state !== "dead").length;
    }

    // 7b-b) Loot-room unlock payload. MovementLoop sets pendingLootSpawn
    //       true the frame the player walks through the door with a
    //       key. We roll 3 guaranteed-epic gear pieces + drop them in
    //       a triangle around the room centre so the player can see
    //       all three at a glance. Also drops a ground-FX beacon for
    //       visual juice.
    // Drain the minor-room pending gear on the first tick. Each
    // entry spawns a permanent (infinite-lifetime) gear drop at the
    // dead-end cell centre so it waits for the player to find it.
    if (shared.pendingMinorRoomGear.length > 0) {
      for (const entry of shared.pendingMinorRoomGear) {
        spawnLabGearDrop(gearDropsRef.current, entry.gear, entry.x, entry.z, Number.POSITIVE_INFINITY);
      }
      shared.pendingMinorRoomGear.length = 0;
    }

    if (shared.pendingLootSpawn) {
      shared.pendingLootSpawn = false;
      const { x: lx, z: lz } = cellToWorld(lootRoomCell.col, lootRoomCell.row);
      const OFFSET = 1.1;
      const positions: Array<[number, number]> = [
        [lx, lz - OFFSET],
        [lx - OFFSET, lz + OFFSET * 0.6],
        [lx + OFFSET, lz + OFFSET * 0.6],
      ];
      for (const [dx, dz] of positions) {
        const epic = rollGearDrop("epic");
        spawnLabGearDrop(gearDropsRef.current, epic, dx, dz);
      }
      // Gold-purple beacon so the unlock reads even from down the hall.
      groundFxRef.current.push({
        id: `loot-unlock-${shared.zone.elapsedSec.toFixed(2)}`,
        x: lx,
        z: lz,
        radius: 4.0,
        lifetime: 2.5,
        color: "#ffc040",
      });
      // Flip the React state mirror — triggers the door's open
      // animation on the next render pass.
      onLootRoomUnlocked(true);
    }

    // 7c) Gear ground-drop tick — lifetime decay + proximity pickup.
    //     pickupLabGear() decides where the new piece goes:
    //       - empty slot  → equip
    //       - slot full + inventory has room → inventory
    //       - slot full + inventory full     → swap, drop old
    //     Bonuses + maxHp recompute immediately when an equip happens.
    const gearTick = tickLabGearDrops(gearDropsRef.current, delta, p.x, p.z);
    if (gearTick.pickedUp) {
      audioManager.play("gear_drop");
      // Iron Will tracking: every pickup counts (whether it went to
      // an equipped slot, inventory, or swap-displaced). The
      // achievement fires only if this counter is still 0 at
      // extraction AND no slot is equipped.
      shared.gearPickupsThisRun += 1;
      const result = pickupLabGear(gearStateRef.current, gearTick.pickedUp);
      if (result.maxHealthDelta !== 0) {
        p.maxHp += result.maxHealthDelta;
        p.hp = Math.min(p.maxHp, p.hp + result.maxHealthDelta);
      }
      if (result.placement === "dropped" && result.displacedGear) {
        // Only the swap path (inventory was full) evicts to ground.
        // Offset the drop so the player doesn't re-trigger it next
        // frame.
        spawnLabGearDrop(gearDropsRef.current, result.displacedGear, p.x + 1.2, p.z + 1.2);
      }
      shared.equipped = {
        weapon: gearStateRef.current.weapon,
        armor: gearStateRef.current.armor,
        trinket: gearStateRef.current.trinket,
      };
    }
    // Emit when the list length has changed from the last frame we
    // emitted — covers spawns (from kills earlier this tick), pickups,
    // and lifetime evictions.
    if (gearDropsRef.current.length !== lastEmittedGearLen.current) {
      lastEmittedGearLen.current = gearDropsRef.current.length;
      onGearDropsChange(gearDropsRef.current.slice());
    }

    // 8) Projectile render-list sync. Same pattern as death FX / XP orbs:
    //    only push to React state when the list length actually changes.
    //    Mid-flight animation runs inside each Projectile3D's useFrame.
    if (projectilesRef.current.length !== lastEmittedProjLen.current) {
      lastEmittedProjLen.current = projectilesRef.current.length;
      onProjectilesChange(projectilesRef.current.slice());
    }

    // Emit to React only when the orb list membership actually changes
    // (spawn or eviction). The XPOrb3D components animate their own
    // collection via orb.collectTimer which we mutate in place.
    if (xpOrbsRef.current.length !== orbPrevLen || orbTick.changed) {
      if (xpOrbsRef.current.length !== lastEmittedOrbLen.current) {
        lastEmittedOrbLen.current = xpOrbsRef.current.length;
        onXpOrbsChange(xpOrbsRef.current.slice());
      }
    }
  });

  return null;
}

// ─── Attack arc visual ───────────────────────────────────────────────────────
// Renders a translucent fan in front of the player when the swing visual
// timer is active. Fades linearly over SWING_VISUAL_DURATION_SEC.

function PlayerAttackArc({
  playerRef,
  attackStateRef,
}: {
  playerRef: React.MutableRefObject<LabPlayer>;
  attackStateRef: React.MutableRefObject<PlayerAttackState>;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const matRef = useRef<THREE.MeshBasicMaterial>(null);

  useFrame(() => {
    const m = meshRef.current;
    const mat = matRef.current;
    const atk = attackStateRef.current;
    const p = playerRef.current;
    if (!m || !mat) return;
    if (atk.swingVisualSec <= 0) {
      mat.opacity = 0;
      m.visible = false;
      return;
    }
    m.visible = true;
    // Place the arc above the player's feet, rotated to face the swing
    // angle. Lifted from 0.12 to 0.35 so the additive-blended wedge
    // reads cleanly above the floor shading (the previous height was
    // close enough to the floor that the wedge was nearly invisible
    // against the stone texture on certain GPU blend paths).
    m.position.set(p.x, 0.35, p.z);
    m.rotation.set(-Math.PI / 2, 0, -atk.swingAngle);
    // Scale the base unit-circle geometry up to the swing's range.
    const s = atk.swingRange;
    m.scale.set(s, s, 1);
    const t = atk.swingVisualSec / SWING_VISUAL_DURATION_SEC;
    mat.opacity = 0.55 * t;
  });

  // CircleGeometry with thetaStart/thetaLength gives us a pie wedge. We
  // offset thetaStart so the wedge is centered on +Y (the "front" after
  // the mesh's Z rotation maps it to -Z in world space).
  const thetaLength = SWING_HALF_ARC * 2;
  const thetaStart = Math.PI / 2 - SWING_HALF_ARC;
  return (
    <mesh ref={meshRef} visible={false}>
      <circleGeometry args={[1, 40, thetaStart, thetaLength]} />
      <meshBasicMaterial
        ref={matRef}
        color="#ffe0a0"
        transparent
        opacity={0}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

function ZoneTickLoop({
  maze,
  playerRef,
  sharedRef,
  labPoisonRef,
  groundFxRef,
  shroudMistRef,
  enemiesRef,
  onGroundFxChange,
  onEnemiesChange,
  runStartMs,
  onRadiusChange,
  onPortalsChange,
}: {
  maze: Maze;
  playerRef: React.MutableRefObject<LabPlayer>;
  sharedRef: React.MutableRefObject<LabSharedState>;
  labPoisonRef: React.MutableRefObject<LabPoisonState>;
  groundFxRef: React.MutableRefObject<LabGroundFx[]>;
  shroudMistRef: React.MutableRefObject<LabShroudMistEmitter>;
  enemiesRef: React.MutableRefObject<EnemyRuntime[]>;
  onGroundFxChange: (fx: LabGroundFx[]) => void;
  onEnemiesChange: (enemies: EnemyRuntime[]) => void;
  runStartMs: React.MutableRefObject<number>;
  onRadiusChange: (radius: number, paused: boolean) => void;
  onPortalsChange: (portals: ExtractionPortal[]) => void;
}) {
  const lastVisualUpdate = useRef(0);
  const lastEmittedGroundFxLen = useRef(0);

  useFrame((_, delta) => {
    const shared = sharedRef.current;
    if (shared.defeated || shared.extracted || shared.victory) return;
    if (useGameStore.getState().phase === "levelup" || sharedRef.current.isPaused) return;

    const zoneDifficulty = useGameStore.getState().labyrinthDifficulty;
    const zoneDiffCfg = getDifficultyConfig(zoneDifficulty);
    const realElapsed = (performance.now() - runStartMs.current) / 1000;
    const shrinkMult = LAYER_CONFIG[shared.layer].zoneShrinkMult || 1;
    const elapsedSec = realElapsed * shrinkMult;
    const zone = computeZoneState(elapsedSec);
    // Show real seconds remaining in HUD, not scaled
    zone.timeRemaining = shrinkMult > 0
      ? Math.max(0, (ZONE_TOTAL_DURATION_SEC - elapsedSec) / shrinkMult)
      : zone.timeRemaining;
    shared.zone = zone;
    shared.layerElapsedSec += delta;

    // Player vs safe-zone
    const p = playerRef.current;
    const inside = isInsideZone(p.x, p.z, zone.radius);
    shared.outsideZone = !inside;

    // Direction to safe zone (for screen-edge warning)
    const dist = Math.sqrt(p.x * p.x + p.z * p.z) || 1;
    shared.safeDirX = -p.x / dist;
    shared.safeDirZ = -p.z / dist;

    // ── Poison shroud ──────────────────────────────────────────────────
    // Outside zone → accrue stacks; inside zone for 3s → reset.
    // See LabyrinthPoison.ts for the full model. We intentionally pass
    // `undefined` for stats here because the Labyrinth mode doesn't yet
    // wire up player upgrades (step 5 in the build order). When that
    // happens, read venomStackDps + deepWoundsMultiplier from the
    // labyrinth-local progression and pass them in — the power-ups will
    // then scale shroud damage automatically via the same formula used
    // for enemy poison at GameScene.tsx:1026-1034.
    const hpBeforePoison = p.hp;
    tickLabPoison(labPoisonRef.current, inside, delta, undefined);
    applyLabPoisonDamage(p, labPoisonRef.current, delta);
    // Track shroud DoT taken this run for the Ghost Protocol
    // achievement (extract with == 0). The poison tick is the only
    // source of "shroud damage" per the spec, so hpBeforePoison -
    // p.hp is the exact increment.
    if (p.hp < hpBeforePoison) {
      shared.shroudDamageTaken += hpBeforePoison - p.hp;
    }
    shared.poisonStacks = labPoisonRef.current.stacks;
    shared.poisonDps = labPoisonRef.current.dps;
    if (p.hp <= 0 && hpBeforePoison > 0) {
      shared.defeated = true;
      audioManager.play("player_death");
    }

    // ── Shroud mist visual ────────────────────────────────────────────
    // While outside, drop a toxic-green pool at the player's feet every
    // 0.35s. The mist is visual-only (damage is via LabyrinthPoison).
    tickShroudMist(shroudMistRef.current, groundFxRef.current, !inside, p.x, p.z, delta);
    const prevFxLen = lastEmittedGroundFxLen.current;
    const survivors = tickGroundFx(groundFxRef.current, delta);
    for (const ge of survivors) {
      if (!ge.appliesPoison) continue;
      for (const e of enemiesRef.current) {
        if (e.state === "dead") continue;
        const gx = ge.x - e.x, gz = ge.z - e.z;
        if (gx * gx + gz * gz <= (ge.radius + 1) * (ge.radius + 1)) {
          e.poisonStacks = Math.min(5, (e.poisonStacks ?? 0) + delta);
          e.poisonDps = 4;
        }
      }
    }
    groundFxRef.current = survivors;
    if (survivors.length !== prevFxLen) {
      lastEmittedGroundFxLen.current = survivors.length;
      onGroundFxChange(survivors.slice());
    }

    // ── Warden spawn ────────────────────────────────────────────────────
    // Only layers with hasWarden=true spawn the Warden. Currently only
    // layer 3 (boss arena) uses it; layer 1+2 complete via champions.
    const lc = LAYER_CONFIG[shared.layer];
    const wardenGate = !shared.wardenSpawned && lc.hasWarden;
    if (wardenGate) {
      const warden = makeWarden(maze);
      if (zoneDiffCfg) applyDifficultyMode(warden, zoneDiffCfg);
      enemiesRef.current.push(warden);
      onEnemiesChange(enemiesRef.current.slice());
      shared.enemyCount = enemiesRef.current.filter((e) => e.state !== "dead").length;
      shared.wardenSpawned = true;
      // Seed the HUD boss-bar snapshot. CombatEnemyLoop updates hp/
      // specialWarn each frame from the enemy + warden-state table.
      shared.wardenHud = {
        alive: true,
        hp: warden.hp,
        maxHp: warden.maxHp,
        name: "THE WARDEN",
        specialWarn: false,
      };
      audioManager.play("boss_spawn");
    }

    // ── Death Knight spawn (layer 3) ────────────────────────────────────
    // Spawns immediately at center on Layer 3 as the final boss.
    if (shared.layer === 3 && !shared.deathKnightSpawned) {
      const dk = makeDeathKnight(maze);
      if (zoneDiffCfg) applyDifficultyMode(dk, zoneDiffCfg);
      enemiesRef.current.push(dk);
      onEnemiesChange(enemiesRef.current.slice());
      shared.enemyCount = enemiesRef.current.filter((e) => e.state !== "dead").length;
      shared.deathKnightSpawned = true;
      shared.deathKnightHud = {
        alive: true,
        hp: dk.hp,
        maxHp: dk.maxHp,
        name: "THE DEATH KNIGHT",
        specialWarn: false,
      };
      audioManager.play("boss_spawn");
    }

    // ── Mini-boss spawn (layer 2) ──────────────────────────────────────
    // When all champions are killed on a layer with hasMiniBoss, the
    // kill handler sets miniBossSpawned + miniBossAlive. We lazily
    // spawn the entity here on the next frame.
    if (shared.miniBossSpawned && shared.miniBossAlive) {
      const hasMiniBossEntity = enemiesRef.current.some((e) => e.kind === "mini_boss" && e.state !== "dead");
      if (!hasMiniBossEntity) {
        const mb = makeMiniBoss(p.x + 8, p.z + 8);
        if (zoneDiffCfg) applyDifficultyMode(mb, zoneDiffCfg);
        enemiesRef.current.push(mb);
        onEnemiesChange(enemiesRef.current.slice());
        shared.enemyCount = enemiesRef.current.filter((e) => e.state !== "dead").length;
        audioManager.play("boss_spawn");
      }
    }

    // ── Hard/Nightmare chaos boss (last 60s) ───────────────────────────
    if (zoneDiffCfg && !shared.hardBossSpawned && zone.timeRemaining <= 60 && zone.timeRemaining > 0) {
      const chaosKind = shared.layer === 1 ? "rival_mage" as const : shared.layer === 2 ? "rival_rogue" as const : null;
      if (chaosKind) {
        shared.hardBossSpawned = true;
        const boss = makeRivalChampion(chaosKind, p.x + 10, p.z + 10);
        applyDifficultyMode(boss, zoneDiffCfg);
        enemiesRef.current.push(boss);
        onEnemiesChange(enemiesRef.current.slice());
        shared.enemyCount = enemiesRef.current.filter((e) => e.state !== "dead").length;
        shared.layerBanner = {
          text: chaosKind === "rival_mage" ? "A TRIAL MAGE ENTERS THE FRAY" : "A TRIAL ROGUE STALKS THE DARK",
          sub: "HARD MODE — CHAOS APPROACHES",
          color: "#ff4444",
          at: shared.zone.elapsedSec,
        };
        audioManager.play("boss_spawn");
      }
    }

    // ── Last chance portals (10 seconds remaining) ─────────────────────
    let portalsChanged = false;
    if (!shared.lastChancePortalsSpawned && !shared.layerComplete && zone.timeRemaining <= 10 && zone.timeRemaining > 0) {
      shared.lastChancePortalsSpawned = true;
      const portalSec = shared.zone.elapsedSec;
      if (shared.layer < 3) {
        shared.portals.push({
          id: `descent_lc_${portalSec}`, x: p.x + 4, z: p.z, col: 0, row: 0,
          spawnedAtSec: portalSec, consumed: false, fadeElapsedSec: 0,
        });
      }
      shared.portals.push({
        id: `extract_lc_${portalSec}`, x: p.x - 4, z: p.z, col: 0, row: 0,
        spawnedAtSec: portalSec, consumed: false, fadeElapsedSec: 0,
      });
      portalsChanged = true;
      shared.layerBanner = { text: "TIME IS RUNNING OUT", sub: "PORTALS OPENED — ESCAPE NOW OR FACE THE HORDE", color: "#ff4444", at: shared.zone.elapsedSec };
      audioManager.play("boss_spawn");
    }

    // ── Timer expired swarm (0 seconds) ───────────────────────────────
    if (!shared.timerExpiredSwarmSpawned && zone.timeRemaining <= 0 && !shared.defeated && !shared.extracted && !shared.victory) {
      shared.timerExpiredSwarmSpawned = true;
      shared.layerBanner = { text: "THE HORDE DESCENDS", sub: "YOU STAYED TOO LONG", color: "#ff0000", at: shared.zone.elapsedSec };
      audioManager.play("boss_spawn");
      const SWARM_COUNT = 12;
      for (let i = 0; i < SWARM_COUNT; i++) {
        const angle = (i / SWARM_COUNT) * Math.PI * 2;
        const dist = 8 + Math.random() * 4;
        const sx = p.x + Math.cos(angle) * dist;
        const sz = p.z + Math.sin(angle) * dist;
        const enemy = i % 3 === 0
          ? makeShadowStalker(sx, sz)
          : makeCorridorGuardianAt(sx, sz);
        if (zoneDiffCfg) applyDifficultyMode(enemy, zoneDiffCfg);
        enemiesRef.current.push(enemy);
      }
      onEnemiesChange(enemiesRef.current.slice());
      shared.enemyCount = enemiesRef.current.filter((e) => e.state !== "dead").length;
    }

    // ── Portal milestones ──────────────────────────────────────────────
    for (let i = 0; i < PORTAL_MILESTONES.length; i++) {
      const m = PORTAL_MILESTONES[i];
      if (elapsedSec < m.atSec) continue;
      if (shared.spawnedMilestones.has(i)) continue;
      const newPortals = spawnPortalsForMilestone(
        maze,
        zone,
        shared.portals,
        m.count,
      );
      if (newPortals.length > 0) {
        shared.portals = shared.portals.concat(newPortals);
        shared.lastPortalPopupSec = elapsedSec;
        shared.lastPortalPopupCount = newPortals.length;
        portalsChanged = true;
        // Audio cue — one play per milestone regardless of portal
        // count. Reuses wave_clear because there's no dedicated
        // portal_spawn sound in the main-game registry and adding
        // one would require a core audio-system edit.
        audioManager.play("wave_clear");
        // Visual beacon — drop a short-lived purple ground disc at
        // each new portal's location so the spawn reads visually
        // even when the player is at the opposite end of the maze.
        // Reuses the existing LabGroundFx pipeline (renderer +
        // lifetime tick already running), so no new render state.
        for (const np of newPortals) {
          groundFxRef.current.push({
            id: `portal-beacon-${np.id}`,
            x: np.x,
            z: np.z,
            radius: 3.2,
            lifetime: 2.0,
            color: "#c080ff",
          });
        }
      }
      shared.spawnedMilestones.add(i);
    }

    // ── Portal consumption ─────────────────────────────────────────────
    // Mark portals as consumed the moment the zone overtakes them.
    // Fade-out is driven by the renderer (portal.fadeElapsedSec++).
    for (const portal of shared.portals) {
      if (portal.consumed) continue;
      if (isPortalConsumed(portal, zone.radius)) {
        portal.consumed = true;
        // eslint-disable-next-line no-console
        console.log("portal consumed", portal.id);
        portalsChanged = true;
      }
    }

    // ── Portal collision (extraction or descent) ─────────────────────
    // Instead of immediately advancing / extracting, we flag a pending
    // decision that the HUD renders as a confirmation dialog. Only one
    // pending decision at a time; re-triggering on the same portal is
    // a no-op until the player accepts or cancels.
    if (!shared.pendingPortalDecision) {
      for (const portal of shared.portals) {
        if (portalCollision(p.x, p.z, portal)) {
          if (portal.id.startsWith("descent_") && shared.layer < 3) {
            shared.pendingPortalDecision = { type: "descent", portalId: portal.id };
          } else {
            shared.pendingPortalDecision = { type: "extract", portalId: portal.id };
          }
          break;
        }
      }
    }

    // ── Spawn descent/extraction portals on layer complete ──────────
    if (shared.layerComplete && !shared.descentPortalsSpawned) {
      shared.descentPortalsSpawned = true;
      const portalSec = shared.zone.elapsedSec;
      if (shared.layer < 3) {
        shared.portals.push({
          id: `descent_${portalSec}`, x: p.x + 4, z: p.z, col: 0, row: 0,
          spawnedAtSec: portalSec, consumed: false, fadeElapsedSec: 0,
        });
        shared.portals.push({
          id: `extract_${portalSec}`, x: p.x - 4, z: p.z, col: 0, row: 0,
          spawnedAtSec: portalSec, consumed: false, fadeElapsedSec: 0,
        });
      } else {
        // Layer 3: just extraction on Warden kill
        shared.portals.push({
          id: `extract_${portalSec}`, x: p.x, z: p.z + 2, col: 0, row: 0,
          spawnedAtSec: portalSec, consumed: false, fadeElapsedSec: 0,
        });
      }
      portalsChanged = true;
      audioManager.play("wave_clear");
    }

    // Drop fully-faded portals from the render list. We keep them in
    // the shared list briefly so the fade-out plays, then evict.
    const beforeLen = shared.portals.length;
    shared.portals = shared.portals.filter((pt) => !isPortalFadeoutDone(pt));
    if (shared.portals.length !== beforeLen) portalsChanged = true;

    if (portalsChanged) {
      // Pass a shallow copy so React state compare triggers a re-render.
      onPortalsChange(shared.portals.slice());
    }

    // Throttle visual updates (mesh scale is smooth via useFrame in Zone3D
    // anyway; this state just drives the "isPaused" color tint).
    lastVisualUpdate.current += delta;
    if (lastVisualUpdate.current > 0.1) {
      lastVisualUpdate.current = 0;
      onRadiusChange(zone.radius, zone.isPaused);
    }
  });

  return null;
}

/** Check if a circle at (cx, cz) with radius r intersects any wall box. */
function collidesWithAnyWall(
  cx: number,
  cz: number,
  r: number,
  segments: ReturnType<typeof extractWallSegments>,
): boolean {
  const wallT = LABYRINTH_CONFIG.WALL_THICKNESS;
  for (const seg of segments) {
    const halfW = seg.orient === "h" ? seg.length / 2 : wallT / 2;
    const halfH = seg.orient === "v" ? seg.length / 2 : wallT / 2;
    // Closest point on the box to the circle
    const closestX = Math.max(seg.cx - halfW, Math.min(cx, seg.cx + halfW));
    const closestZ = Math.max(seg.cz - halfH, Math.min(cz, seg.cz + halfH));
    const dx = cx - closestX;
    const dz = cz - closestZ;
    if (dx * dx + dz * dz < r * r) return true;
  }
  // Outer boundary safety
  if (cx < -LABYRINTH_HALF + r) return true;
  if (cx >  LABYRINTH_HALF - r) return true;
  if (cz < -LABYRINTH_HALF + r) return true;
  if (cz >  LABYRINTH_HALF - r) return true;
  return false;
}

// ─── HUD (dev / placeholder) ──────────────────────────────────────────────────

function LabyrinthHUD({
  maze,
  charClass,
  labStats,
  playerRef,
  sharedRef,
  gearStateRef,
  progressionRef,
  onUpgradeApplied,
  enemiesRef,
  lootRoomCell,
}: {
  maze: Maze;
  charClass: CharacterClass;
  labStats: PlayerStats;
  playerRef: React.MutableRefObject<LabPlayer>;
  sharedRef: React.MutableRefObject<LabSharedState>;
  gearStateRef: React.MutableRefObject<LabGearState>;
  progressionRef: React.MutableRefObject<LabProgressionState>;
  onUpgradeApplied: () => void;
  enemiesRef: React.MutableRefObject<EnemyRuntime[]>;
  lootRoomCell: { col: number; row: number };
}) {
  const setPhase = useGameStore((s) => s.setPhase);
  const labDifficulty = useGameStore((s) => s.labyrinthDifficulty);
  const [isMob, setIsMob] = useState(() => window.innerWidth < 900);
  useEffect(() => { const fn = () => setIsMob(window.innerWidth < 900); window.addEventListener("resize", fn); return () => window.removeEventListener("resize", fn); }, []);
  const [esc, setEsc] = useState(false);
  /** Which view the pause overlay shows when open. "main" = the
   *  resume/exit buttons; "character" = the diagnostic stat sheet +
   *  equipped gear + inventory (see LabyrinthCharacterView below).
   *  Mirrors the main-game PauseMenu's "view" state pattern. */
  const [pauseView, setPauseView] = useState<"main" | "character">("main");
  // Confirmation dialog for the pause-menu exit. Matches the
  // main-game PauseMenu confirmation so the safety gate is
  // consistent across both modes.
  const [confirmingExit, setConfirmingExit] = useState(false);
  // Poll shared state at 10Hz for display only (don't re-render at 60fps).
  const [display, setDisplay] = useState({
    hp: 100, maxHp: 100,
    timeRemaining: ZONE_TOTAL_DURATION_SEC,
    elapsedSec: 0,
    isPaused: false,
    outsideZone: false,
    safeDirX: 0, safeDirZ: 0,
    defeated: false,
    extracted: false,
    victory: false,
    poisonStacks: 0,
    poisonDps: 0,
    nearestPortalDirX: 0,
    nearestPortalDirZ: 0,
    hasPortal: false,
    lastPortalPopupSec: -Infinity,
    lastPortalPopupCount: 0,
    livePortalCount: 0,
    enemyCount: 0,
    killCount: 0,
    level: 1,
    xp: 0,
    xpToNext: 1,
    totalXp: 0,
    warrior: null as LabSharedState["warrior"],
    equipped: { weapon: null, armor: null, trinket: null } as LabSharedState["equipped"],
    wardenHud: null as LabSharedState["wardenHud"],
    deathKnightHud: null as LabSharedState["deathKnightHud"],
    hasKey: false,
    nearLockedVault: false,
    rivalAnnounce: null as LabSharedState["rivalAnnounce"],
    layer: 1 as 1 | 2 | 3,
    championsKilled: 0,
    championsToKill: 4,
    layerComplete: false,
    layerBanner: null as LabSharedState["layerBanner"],
    pendingPortalDecision: null as LabSharedState["pendingPortalDecision"],
    crystalsEarned: 0,
  });

  useEffect(() => {
    const iv = setInterval(() => {
      const s = sharedRef.current;
      const p = playerRef.current;
      // Nearest live portal → direction vector for the edge arrow.
      let nearestDsq = Infinity;
      let ndx = 0, ndz = 0;
      let liveCount = 0;
      for (const portal of s.portals) {
        if (portal.consumed) continue;
        liveCount++;
        const dx = portal.x - p.x;
        const dz = portal.z - p.z;
        const dsq = dx * dx + dz * dz;
        if (dsq < nearestDsq) {
          nearestDsq = dsq;
          const d = Math.sqrt(dsq) || 1;
          ndx = dx / d;
          ndz = dz / d;
        }
      }
      setDisplay({
        hp: p.hp,
        maxHp: p.maxHp,
        timeRemaining: s.zone.timeRemaining,
        elapsedSec: s.zone.elapsedSec,
        isPaused: s.zone.isPaused,
        outsideZone: s.outsideZone,
        safeDirX: s.safeDirX,
        safeDirZ: s.safeDirZ,
        defeated: s.defeated,
        extracted: s.extracted,
        victory: s.victory,
        poisonStacks: s.poisonStacks,
        poisonDps: s.poisonDps,
        nearestPortalDirX: ndx,
        nearestPortalDirZ: ndz,
        hasPortal: liveCount > 0,
        lastPortalPopupSec: s.lastPortalPopupSec,
        lastPortalPopupCount: s.lastPortalPopupCount,
        livePortalCount: liveCount,
        enemyCount: s.enemyCount,
        killCount: s.killCount,
        level: s.level,
        xp: s.xp,
        xpToNext: s.xpToNext,
        totalXp: s.totalXp,
        warrior: s.warrior,
        equipped: s.equipped,
        wardenHud: s.wardenHud,
        deathKnightHud: s.deathKnightHud,
        hasKey: s.hasKey,
        nearLockedVault: s.nearLockedVault,
        rivalAnnounce: s.rivalAnnounce,
        layer: s.layer,
        championsKilled: s.championsKilled,
        championsToKill: s.championsToKill,
        layerComplete: s.layerComplete,
        layerBanner: s.layerBanner,
        pendingPortalDecision: s.pendingPortalDecision,
        crystalsEarned: s.crystalsEarned,
      });
    }, 100);
    return () => clearInterval(iv);
  }, [playerRef, sharedRef]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "Escape") {
        setEsc((v) => {
          if (v) {
            setPauseView("main");
            sharedRef.current.isPaused = false;
          } else {
            sharedRef.current.isPaused = true;
          }
          return !v;
        });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const exit = useCallback(() => setPhase("menu"), [setPhase]);

  // ── Portal-confirmation handlers ─────────────────────────────────
  // Accept: commit the portal outcome (extract or descent). The
  // sharedRef is the source of truth; ZoneTickLoop's layer-change
  // watcher picks up pendingLayerChange on its next interval tick.
  const handlePortalAccept = useCallback(() => {
    const s = sharedRef.current;
    const decision = s.pendingPortalDecision;
    if (!decision) return;
    const p = playerRef.current;
    if (decision.type === "extract") {
      const portal = s.portals.find((pp) => pp.id === decision.portalId);
      if (portal) {
        p.x = portal.x;
        p.z = portal.z;
      }
      if (s.layer === 3) {
        useMetaStore.getState().addShards(500);
        s.victory = true;
        if (labDifficulty === "hard" || labDifficulty === "nightmare") useAchievementStore.getState().tryUnlock("lab_hard_conqueror");
        if (labDifficulty === "nightmare") useAchievementStore.getState().tryUnlock("lab_nightmare_conqueror");
      }
      s.extracted = true;
    } else {
      s.pendingLayerChange = (s.layer + 1) as 2 | 3;
      s.portals = [];
    }
    s.pendingPortalDecision = null;
  }, [playerRef, sharedRef]);

  // Cancel: nudge the player away from the portal so they don't
  // instantly re-trigger the collision check. The escape distance
  // (portal radius ~2.5u + 2u buffer) guarantees the next MovementLoop
  // tick reads them as outside the portal ellipse on any axis.
  const handlePortalCancel = useCallback(() => {
    const s = sharedRef.current;
    const decision = s.pendingPortalDecision;
    if (!decision) return;
    const p = playerRef.current;
    const portal = s.portals.find((pp) => pp.id === decision.portalId);
    if (portal) {
      const dx = p.x - portal.x;
      const dz = p.z - portal.z;
      const d = Math.sqrt(dx * dx + dz * dz);
      const ESCAPE = 4.5;
      if (d > 0.001) {
        p.x = portal.x + (dx / d) * ESCAPE;
        p.z = portal.z + (dz / d) * ESCAPE;
      } else {
        p.x = portal.x + ESCAPE;
        p.z = portal.z;
      }
    }
    s.pendingPortalDecision = null;
  }, [playerRef, sharedRef]);

  const phase = useGameStore((s) => s.phase);
  const handleLabUpgrade = useCallback((id: string) => {
    const upgrade = UPGRADES[id as keyof typeof UPGRADES];
    if (!upgrade) return;
    upgrade.apply(labStats);
    const prog = progressionRef.current;
    prog.acquiredUpgrades.set(id as any, (prog.acquiredUpgrades.get(id as any) ?? 0) + 1);
    onUpgradeApplied();
    useGameStore.getState().setPhase("labyrinth");
  }, [labStats, progressionRef, onUpgradeApplied]);

  const hpPct = Math.max(0, (display.hp / display.maxHp) * 100);
  const hpColor = hpPct > 60 ? "#22cc55" : hpPct > 30 ? "#ff8800" : "#cc2222";

  return (
    <>
      {/* Top: mode title */}
      <div style={{ ...styles.hudBanner, display: isMob ? "none" : "block" }}>
        <div style={styles.hudTitle}>THE LABYRINTH</div>
        <div style={styles.hudStats}>
          {maze.size}×{maze.size} maze · {maze.deadEnds.length} dead ends
        </div>
      </div>

      {/* Mobile pause button — top-right corner */}
      {isMob && !display.defeated && !display.extracted && !display.victory && (
        <div
          style={{
            position: "absolute", top: 4, right: 4, width: 32, height: 32,
            borderRadius: 6, background: "rgba(10,5,20,0.85)", border: "1px solid rgba(140,100,200,0.4)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 16, color: "#c0a0e0", cursor: "pointer", pointerEvents: "auto",
            zIndex: 55, touchAction: "none",
          }}
          onTouchStart={(e) => { e.stopPropagation(); setEsc((v) => { if (v) setPauseView("main"); return !v; }); }}
        >
          ⏸
        </div>
      )}

      {/* ── Mobile: connected HUD strip ─────────────────────────────── */}
      {isMob && (
        <div style={{
          position: "absolute", top: 4, left: 4, right: 40,
          display: "flex", flexDirection: "row", pointerEvents: "none", zIndex: 20, gap: 0,
        }}>
          {/* HP + LV module */}
          <div style={{
            flex: "1 1 0", padding: "4px 6px",
            background: "rgba(0,0,0,0.75)", borderRadius: "6px 0 0 6px",
            borderTop: "1px solid #333", borderLeft: "1px solid #333", borderBottom: "1px solid #333",
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, marginBottom: 2 }}>
              <span style={{ color: "#ff6666", fontWeight: "bold" }}>HP</span>
              <span style={{ color: "#ccc", fontSize: 10 }}>{Math.ceil(display.hp)}/{display.maxHp}</span>
            </div>
            <div style={styles.hpTrack}>
              <div style={{ ...styles.hpFill, width: `${hpPct}%`, background: hpColor, boxShadow: `0 0 6px ${hpColor}` }} />
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, marginTop: 3 }}>
              <span style={{ color: "#70d0ff", fontWeight: "bold" }}>LV {display.level}</span>
              <span style={{ color: "#999", fontSize: 9 }}>{display.xp}/{display.xpToNext}</span>
            </div>
            <div style={styles.hpTrack}>
              <div style={{ ...styles.hpFill, width: `${display.xpToNext > 0 ? Math.min(100, (display.xp / display.xpToNext) * 100) : 0}%`, background: "#50a0ff" }} />
            </div>
          </div>

          {/* Timer module */}
          <div style={{
            flex: "0 0 68px", padding: "4px 4px",
            background: "rgba(10,5,25,0.8)", borderTop: "1px solid rgba(140,80,220,0.4)",
            borderBottom: "1px solid rgba(140,80,220,0.4)",
            textAlign: "center", fontFamily: "monospace",
          }}>
            <div style={{ fontSize: 7, letterSpacing: 2, color: "rgba(170,140,220,0.8)", fontWeight: 900 }}>ZONE</div>
            <div style={{ fontSize: 16, fontWeight: 900, letterSpacing: 2, color: display.timeRemaining < 120 ? "#ff4444" : "#c080ff", marginTop: 1 }}>
              {formatZoneTime(display.timeRemaining)}
            </div>
            <div style={{ fontSize: 7, letterSpacing: 1, color: "rgba(180,150,220,0.7)", marginTop: 1 }}>
              {display.isPaused ? "PAUSED" : "SHRINKING"}
            </div>
          </div>

          {/* Hunt / Threat module */}
          <div style={{
            flex: "0 0 72px", padding: "4px 4px",
            background: "rgba(40,10,60,0.75)", borderRadius: "0 6px 6px 0",
            borderTop: "1px solid rgba(180,60,255,0.4)", borderRight: "1px solid rgba(180,60,255,0.4)",
            borderBottom: "1px solid rgba(180,60,255,0.4)",
            fontFamily: "monospace",
          }}>
            {display.championsToKill > 0 ? (
              <>
                <div style={{ fontSize: 7, letterSpacing: 2, color: "#cc88ff", fontWeight: 900 }}>L{display.layer} HUNT</div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, marginTop: 2 }}>
                  <span style={{ color: "#aa88cc" }}>SLAIN</span>
                  <span style={{ color: display.championsKilled >= display.championsToKill ? "#44ff88" : "#ff8844", fontWeight: 900 }}>
                    {display.championsKilled}/{display.championsToKill}
                  </span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, marginTop: 1 }}>
                  <span style={{ color: "#aa88cc" }}>FOES</span>
                  <span style={{ color: "#ff6644", fontWeight: 900 }}>{display.enemyCount}</span>
                </div>
              </>
            ) : display.layer === 3 ? (
              <>
                <div style={{ fontSize: 7, letterSpacing: 2, color: "#ff4488", fontWeight: 900 }}>L3 ABYSS</div>
                <div style={{ fontSize: 9, color: "#ff88aa", marginTop: 2 }}>DEFEAT WARDEN</div>
              </>
            ) : (
              <>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, marginTop: 2 }}>
                  <span style={{ color: "#aa88cc" }}>THREATS</span>
                  <span style={{ color: "#ff6644", fontWeight: 900 }}>{display.enemyCount}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, marginTop: 1 }}>
                  <span style={{ color: "#aa88cc" }}>KILLS</span>
                  <span style={{ color: "#44ffaa", fontWeight: 900 }}>{display.killCount}</span>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── Mobile: gear strip under HP box ─────────────────────────── */}
      {isMob && (
        <div style={{ position: "absolute", top: 64, left: 6, display: "flex", gap: 3, padding: "3px", background: "rgba(10,5,20,0.7)", border: "1px solid rgba(140,100,200,0.35)", borderRadius: 5, pointerEvents: "none", zIndex: 20 }}>
          {([["⚔", display.equipped.weapon], ["🛡", display.equipped.armor], ["◈", display.equipped.trinket]] as [string, any][]).map(([icon, g], i) => (
            <div key={i} style={{
              width: 28, height: 28, borderRadius: 4,
              border: `1.5px solid ${g ? (g.rarity === "epic" ? "rgba(170,68,255,0.9)" : g.rarity === "rare" ? "rgba(68,136,221,0.85)" : "rgba(170,170,187,0.65)") : "rgba(60,60,80,0.5)"}`,
              background: "rgba(10,8,22,0.8)", display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 14, color: g ? "#f0e0ff" : "rgba(120,120,140,0.6)",
            }}>
              {g?.icon ?? icon}
            </div>
          ))}
        </div>
      )}

      {/* ── Desktop: original separate panels ───────────────────────── */}

      {/* Top-left: HP bar (desktop only — mobile uses connected strip) */}
      {!isMob && (
      <div style={{ ...styles.hpBox, width: 220, padding: "10px 14px", top: 20, left: 20 }}>
        <div style={styles.hpLabel}>
          <span style={{ color: "#ff6666", fontWeight: "bold" }}>HP</span>
          <span style={{ color: "#ccc", fontSize: 13 }}>
            {Math.ceil(display.hp)}/{display.maxHp}
          </span>
        </div>
        <div style={styles.hpTrack}>
          <div style={{
            ...styles.hpFill,
            width: `${hpPct}%`,
            background: hpColor,
            boxShadow: `0 0 8px ${hpColor}`,
          }} />
        </div>
        {/* XP + level — same style language as HP, one row below. */}
        <div style={{ ...styles.hpLabel, marginTop: 6 }}>
          <span style={{ color: "#70d0ff", fontWeight: "bold" }}>LV {display.level}</span>
          <span style={{ color: "#ccc", fontSize: 13 }}>
            {display.xp}/{display.xpToNext} XP
          </span>
        </div>
        <div style={styles.hpTrack}>
          <div style={{
            ...styles.hpFill,
            width: `${display.xpToNext > 0 ? Math.min(100, (display.xp / display.xpToNext) * 100) : 0}%`,
            background: "#50a0ff",
            boxShadow: "0 0 8px #50a0ff",
          }} />
        </div>
        {/* Warrior passives readout — only shown when class is warrior
            so mage/rogue don't see stale zeros. War Cry flashes red
            while active; Blood Momentum stacks shown as pips. */}
        {display.warrior && !isMob && (
          <div style={styles.warriorBox}>
            <div style={styles.warriorRow}>
              <span style={{ color: "#ff7760", fontWeight: "bold", fontSize: 11 }}>
                BLOOD MOMENTUM
              </span>
              <span style={{ color: "#ffb080", fontSize: 11 }}>
                x{display.warrior.momentumMult.toFixed(2)} · {display.warrior.momentumStacks}/20
              </span>
            </div>
            <div style={styles.pipRow}>
              {Array.from({ length: 20 }).map((_, i) => (
                <div
                  key={i}
                  style={{
                    ...styles.pip,
                    background: i < display.warrior!.momentumStacks ? "#ff6040" : "#301010",
                    boxShadow: i < display.warrior!.momentumStacks ? "0 0 4px #ff4020" : "none",
                  }}
                />
              ))}
            </div>
            <div style={styles.warriorRow}>
              <span style={{ color: "#ff4040", fontSize: 11, fontWeight: "bold" }}>
                {display.warrior.warCryActive ? `⚔ WAR CRY ${display.warrior.warCrySec.toFixed(1)}s` : "⚔ WAR CRY ready"}
              </span>
              <span style={{ color: "#aa8866", fontSize: 11 }}>
                +{display.warrior.bloodforgeGain}/{display.warrior.bloodforgeCap} HP
              </span>
            </div>
          </div>
        )}
      </div>
      )}

      {/* Difficulty badge */}
      {labDifficulty !== "normal" && (
        <div style={{
          position: "absolute", top: isMob ? 4 : 8, left: "50%", transform: "translateX(-50%)",
          padding: "3px 14px", borderRadius: 4,
          background: labDifficulty === "nightmare" ? "rgba(120,0,0,0.8)" : "rgba(180,40,10,0.7)",
          border: labDifficulty === "nightmare" ? "1px solid rgba(255,30,30,0.7)" : "1px solid rgba(255,100,40,0.6)",
          color: labDifficulty === "nightmare" ? "#ff4444" : "#ffaa44",
          fontSize: 10, fontWeight: 900, letterSpacing: 4,
          fontFamily: "monospace", zIndex: 30, pointerEvents: "none",
          textShadow: labDifficulty === "nightmare" ? "0 0 10px rgba(255,0,0,0.6)" : "0 0 8px rgba(255,80,20,0.5)",
        }}>
          {labDifficulty === "nightmare" ? "NIGHTMARE" : "HARD MODE"}
        </div>
      )}

      {/* Top-right: zone timer (desktop only — mobile uses connected strip) */}
      {!isMob && (
      <div style={{ ...styles.timerBox, minWidth: 180, padding: "10px 14px", top: 20, right: 20 }}>
        <div style={styles.timerLabel}>ZONE CLOSES IN</div>
        <div style={{
          ...styles.timerValue,
          fontSize: 26,
          letterSpacing: 4,
          color: display.timeRemaining < 120 ? "#ff4444" : "#c080ff",
        }}>
          {formatZoneTime(display.timeRemaining)}
        </div>
        <div style={styles.timerPhase}>
          {display.isPaused ? "◦ PAUSED" : "▼ SHRINKING"}
        </div>
      </div>
      )}

      {/* Below the timer: threat readout (desktop only) */}
      {!isMob && (
        <div style={{ ...styles.threatBox, minWidth: 180, top: 120, right: 20, padding: "8px 14px" }}>
          <div style={styles.threatRow}>
            <span style={styles.threatLabel}>THREATS</span>
            <span style={styles.threatValue}>{display.enemyCount}</span>
          </div>
          <div style={styles.threatRow}>
            <span style={styles.threatLabel}>KILLS</span>
            <span style={styles.threatValueAccent}>{display.killCount}</span>
          </div>
        </div>
      )}

      {/* Layer + champion hunt tracker (desktop only — mobile uses connected strip) */}
      {!isMob && display.championsToKill > 0 && (
        <div style={{ ...styles.threatBox, top: isMob ? 55 : 205, right: isMob ? 6 : 20, minWidth: isMob ? 100 : 180, padding: isMob ? "3px 6px" : "8px 14px", background: "rgba(40,10,60,0.75)", borderColor: "rgba(180,60,255,0.4)" }}>
          <div style={{ fontSize: isMob ? 7 : 9, letterSpacing: 2, color: "#cc88ff", fontWeight: 900, fontFamily: "monospace", marginBottom: 1 }}>
            L{display.layer} HUNT
          </div>
          <div style={styles.threatRow}>
            <span style={styles.threatLabel}>SLAIN</span>
            <span style={{ ...styles.threatValueAccent, color: display.championsKilled >= display.championsToKill ? "#44ff88" : "#ff8844" }}>
              {display.championsKilled}/{display.championsToKill}
            </span>
          </div>
          {isMob && (
            <div style={styles.threatRow}>
              <span style={styles.threatLabel}>FOES</span>
              <span style={styles.threatValue}>{display.enemyCount}</span>
            </div>
          )}
          {display.layerComplete && (
            <div style={{ fontSize: 10, color: "#44ff88", fontWeight: 900, letterSpacing: 2, textAlign: "center" as const, marginTop: 4 }}>
              PORTALS OPENED
            </div>
          )}
        </div>
      )}
      {!isMob && display.layer === 3 && display.championsToKill === 0 && (
        <div style={{ ...styles.threatBox, top: isMob ? 55 : 205, right: isMob ? 6 : 20, minWidth: isMob ? 100 : 180, padding: isMob ? "3px 6px" : "8px 14px", background: "rgba(40,10,60,0.75)", borderColor: "rgba(180,60,255,0.4)" }}>
          <div style={{ fontSize: isMob ? 7 : 9, letterSpacing: 2, color: "#ff4488", fontWeight: 900, fontFamily: "monospace" }}>
            L3 — THE ABYSS
          </div>
          <div style={{ fontSize: isMob ? 9 : 10, color: "#ff88aa", letterSpacing: 1, marginTop: 2, fontFamily: "monospace" }}>
            DEFEAT THE WARDEN
          </div>
        </div>
      )}

      {/* Shard count — persistent crystal balance */}
      {!isMob && (
        <div style={{
          position: "absolute", top: display.championsToKill > 0 ? 260 : 205, right: 20,
          minWidth: 180, padding: "6px 14px",
          background: "rgba(40,30,10,0.75)", border: "1px solid rgba(255,200,40,0.3)",
          borderRadius: 4, fontFamily: "monospace", zIndex: 20, pointerEvents: "none",
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 9, letterSpacing: 2, color: "#cc9944", fontWeight: 900 }}>CRYSTALS</span>
            <span style={{ fontSize: 14, fontWeight: 900, color: "#ffcc44", textShadow: "0 0 6px #cc9900" }}>
              ◈ {useMetaStore.getState().shards.toLocaleString()}
            </span>
          </div>
        </div>
      )}

      {!isMob && <GearSlotStrip equipped={display.equipped} />}

      {/* Desktop action ability indicator — bottom-right */}
      {!isMob && <ActionCooldownIndicator charClass={charClass} />}

      {/* Key icon — only visible once the champion has been slain.
          Item 7 will add the loot-room unlock that consumes this. */}
      {display.hasKey && (
        <div style={styles.keyIndicator}>
          <span style={styles.keyIcon}>🗝</span>
          <span style={styles.keyLabel}>VAULT KEY</span>
        </div>
      )}

      {/* "Requires Champion Key" prompt — appears only when the
          player stands near the locked vault WITHOUT the key. Fades
          via CSS transition when the player walks away. */}
      {display.nearLockedVault && !display.defeated && !display.extracted && (
        <div style={styles.lockedPrompt}>
          <span style={styles.lockedPromptIcon}>🗝</span>
          <span style={styles.lockedPromptText}>REQUIRES CHAMPION KEY</span>
        </div>
      )}

      {/* Champion arrival banner — fades in/out over 3.5 s from the
          spawn timestamp. Red-orange to match the champion palette. */}
      <RivalBanner
        elapsedSec={display.elapsedSec}
        announce={display.rivalAnnounce}
      />

      {/* Layer event banners — intro, one-champion-left, portals opened */}
      <LayerBanner banner={display.layerBanner} elapsedSec={display.elapsedSec} />

      {/* Poison stack pip bar (only visible when stacks > 0) */}
      {display.poisonStacks > 0 && !display.defeated && !display.extracted && (
        <PoisonPips
          stacks={display.poisonStacks}
          dps={display.poisonDps}
        />
      )}

      {/* Zone warning banner when outside safe zone */}
      {display.outsideZone && !display.defeated && !display.extracted && (
        <div style={styles.zoneWarning}>
          <div style={styles.zoneWarningText}>⚠ POISON SHROUD ⚠</div>
          <div style={styles.zoneWarningSub}>
            Return to the safe zone — stacks building
          </div>
        </div>
      )}

      {/* Screen-edge arrow pointing toward safe zone (when outside) */}
      {display.outsideZone && !display.defeated && !display.extracted && (
        <SafeZoneArrow dx={display.safeDirX} dz={display.safeDirZ} />
      )}

      {/* Fog-of-war minimap — bottom left, reveals as player explores */}
      {!display.defeated && !display.extracted && !display.victory && (
        <LabyrinthMinimap
          maze={maze}
          playerRef={playerRef}
          enemiesRef={enemiesRef}
          sharedRef={sharedRef}
          lootRoomCell={lootRoomCell}
        />
      )}

      {/* Nearest-portal edge arrow (gold/purple) — separate from the safe-zone arrow */}
      {display.hasPortal && !display.defeated && !display.extracted && (
        <PortalArrow
          dx={display.nearestPortalDirX}
          dz={display.nearestPortalDirZ}
          popupAtSec={display.lastPortalPopupSec}
          elapsedSec={display.elapsedSec}
        />
      )}

      {/* Summon sign prompt */}
      {(() => {
        const sign = sharedRef.current.summonSign;
        if (!sign || sign.consumed || display.defeated || display.extracted) return null;
        const p = playerRef.current;
        const dx = p.x - sign.x, dz = p.z - sign.z;
        if (dx * dx + dz * dz > 16) return null;
        const canAfford = useMetaStore.getState().shards >= COMPANION_SUMMON_COST;
        return (
          <div style={{ position: "absolute", bottom: 130, left: "50%", transform: "translateX(-50%)", textAlign: "center", pointerEvents: "none", zIndex: 30 }}>
            <div style={{ color: canAfford ? "#ffc830" : "#886630", fontSize: 14, fontWeight: 900, fontFamily: "monospace", textShadow: canAfford ? "0 0 10px #cc9900" : "none" }}>
              {canAfford ? "SUMMON WANDERING BARD — 200 CRYSTALS" : "REQUIRES 200 SOUL FORGE CRYSTALS"}
            </div>
            <div style={{ color: "#999", fontSize: 10, marginTop: 2 }}>WALK ONTO RUNE TO ACTIVATE</div>
          </div>
        );
      })()}

      {/* Portal-opened popup (fades in for ~3s after a milestone spawn) */}
      <PortalPopup
        elapsedSec={display.elapsedSec}
        popupAtSec={display.lastPortalPopupSec}
        count={display.lastPortalPopupCount}
      />

      {/* Boss HP bar — center-bottom, shown only while the Warden is
          alive. Styling mirrors the main game's bar at HUD.tsx:263-284
          but is entirely labyrinth-local (no store reads). */}
      {display.wardenHud && display.wardenHud.alive && display.wardenHud.maxHp > 0 && (
        <div style={styles.bossBar}>
          <div style={styles.bossBarHeader}>
            <span style={styles.bossBarName}>{display.wardenHud.name}</span>
            {display.wardenHud.specialWarn && (
              <span style={styles.bossWarn}>⚠ STARBURST INCOMING</span>
            )}
          </div>
          <div style={styles.bossBarTrack}>
            <div
              style={{
                ...styles.bossBarFill,
                width: `${Math.max(0, (display.wardenHud.hp / display.wardenHud.maxHp)) * 100}%`,
              }}
            />
          </div>
          <div style={styles.bossBarFooter}>
            <span style={{ color: "#aaa", fontSize: 11 }}>
              {Math.max(0, Math.ceil(display.wardenHud.hp)).toLocaleString()} / {display.wardenHud.maxHp.toLocaleString()}
            </span>
          </div>
        </div>
      )}

      {/* Death Knight HP bar — same pattern as the Warden bar above. */}
      {display.deathKnightHud && display.deathKnightHud.alive && display.deathKnightHud.maxHp > 0 && (
        <div style={styles.bossBar}>
          <div style={styles.bossBarHeader}>
            <span style={styles.bossBarName}>{display.deathKnightHud.name}</span>
            {display.deathKnightHud.specialWarn && (
              <span style={styles.bossWarn}>GROUND SLAM INCOMING</span>
            )}
          </div>
          <div style={styles.bossBarTrack}>
            <div
              style={{
                ...styles.bossBarFill,
                width: `${Math.max(0, (display.deathKnightHud.hp / display.deathKnightHud.maxHp)) * 100}%`,
              }}
            />
          </div>
          <div style={styles.bossBarFooter}>
            <span style={{ color: "#aaa", fontSize: 11 }}>
              {Math.max(0, Math.ceil(display.deathKnightHud.hp)).toLocaleString()} / {display.deathKnightHud.maxHp.toLocaleString()}
            </span>
          </div>
        </div>
      )}

      {/* Warden-slain victory screen — Layer 3 shows gear keep selection */}
      {display.victory && (
        <div style={styles.extractedOverlay}>
          <div style={styles.extractedPanel}>
            <div style={{ ...styles.extractedTitle, color: "#ff60ff" }}>
              ⚔ WARDEN SLAIN — LAYER {display.layer}
            </div>
            <div style={styles.extractedSub}>
              {display.layer === 3
                ? "The Abyss is conquered. You have earned 500 bonus crystals!"
                : "The vault's keeper is dead. The labyrinth is yours."}
            </div>
            <div style={{ fontSize: 20, fontWeight: 900, color: "#ffcc44", fontFamily: "monospace", letterSpacing: 2, marginTop: 8, textShadow: "0 0 12px #ffaa00" }}>
              💎 {display.crystalsEarned} CRYSTALS EARNED
            </div>
            <div style={styles.extractedStats}>
              TIME · {formatZoneTime(display.elapsedSec)} · KILLS · {display.killCount}
            </div>
            <GearKeepSelection equipped={display.equipped} onKeep={(gear) => {
              if (gear) {
                const kept = { ...gear, enhanceLevel: 0 };
                useMetaStore.getState().addGearToStash(kept as any);
              }
            }} />
            {sharedRef.current.companionEverSummoned && (
              <div style={{ fontStyle: "italic", color: "#ffc830", fontSize: 13, marginTop: 8, textShadow: "0 0 8px #cc9900" }}>
                {sharedRef.current.companionDiedDuringRun
                  ? "Their song was cut short — but not forgotten."
                  : "Let the world remember this verse."}
              </div>
            )}
            <button style={{ ...styles.escBtn, marginTop: 12 }} onClick={exit}>
              ⌂ RETURN TO MAIN MENU
            </button>
          </div>
        </div>
      )}

      {/* Extracted (portal win) screen — gear salvaged, no keep */}
      {display.extracted && !display.victory && (
        <div style={styles.extractedOverlay}>
          <div style={styles.extractedPanel}>
            <div style={styles.extractedTitle}>⬭ EXTRACTED</div>
            <div style={styles.extractedSub}>
              You escaped the labyrinth. Gear has been salvaged into crystals.
            </div>
            <div style={{ fontSize: 18, fontWeight: 900, color: "#ffcc44", fontFamily: "monospace", letterSpacing: 2, marginTop: 6, textShadow: "0 0 10px #ffaa00" }}>
              💎 {display.crystalsEarned} CRYSTALS EARNED
            </div>
            <div style={styles.extractedStats}>
              TIME SURVIVED · {formatZoneTime(display.elapsedSec)}
            </div>
            <div style={{ fontSize: 11, color: "#806090", fontFamily: "monospace", marginTop: 10, textAlign: "center" as const, lineHeight: 1.5 }}>
              Complete Layer 3 to keep gear from the labyrinth.
            </div>
            <button style={{ ...styles.escBtn, marginTop: 12 }} onClick={exit}>
              ⌂ RETURN TO MAIN MENU
            </button>
          </div>
        </div>
      )}

      {/* Defeat screen */}
      {display.defeated && !display.extracted && !display.victory && (
        <div style={styles.defeatOverlay}>
          <div style={styles.defeatPanel}>
            <div style={styles.defeatTitle}>CONSUMED BY THE DARK</div>
            <div style={styles.defeatSub}>
              The shroud has claimed you. The vault remembers.
            </div>
            <button style={styles.escBtn} onClick={exit}>
              ⌂ RETURN TO MAIN MENU
            </button>
          </div>
        </div>
      )}

      {/* Pause — two views mirror the main-game PauseMenu:
          "main" shows resume + character + exit buttons,
          "character" shows the live diagnostic stat sheet. */}
      {esc && !display.defeated && (
        <div style={styles.escOverlay}>
          {pauseView === "main" && (
            <div style={styles.escPanel}>
              <div style={styles.escTitle}>PAUSED</div>
              <button style={styles.escBtn} onClick={() => setEsc(false)}>▶ RESUME</button>
              <button style={styles.escBtn} onClick={() => setPauseView("character")}>🎒 CHARACTER</button>
              <button style={styles.escBtn} onClick={() => setConfirmingExit(true)}>⌂ EXIT TO MAIN MENU</button>
            </div>
          )}
          {pauseView === "character" && (
            <LabyrinthCharacterView
              charClass={charClass}
              labStats={labStats}
              playerRef={playerRef}
              gearStateRef={gearStateRef}
              progressionRef={progressionRef}
              sharedRef={sharedRef}
              onBack={() => setPauseView("main")}
            />
          )}
        </div>
      )}

      {/* Abandon-run confirmation. Shares the exit-gate spec with the
          main-game PauseMenu: "Stay in Run" is the dominant default,
          "Abandon Run" is visually de-emphasised, so a mistaken tap
          can't kill the run. Palette uses the labyrinth's blue
          accent to match the pause panel above. */}
      {confirmingExit && !display.defeated && (
        <div style={styles.confirmOverlay}>
          <div style={styles.confirmPanel}>
            <div style={styles.confirmTitle}>ABANDON YOUR RUN?</div>
            <div style={styles.confirmSub}>All progress will be lost.</div>
            <div style={styles.confirmBtnCol}>
              <button
                style={styles.confirmPrimary}
                onClick={() => setConfirmingExit(false)}
              >
                ◂ STAY IN RUN
              </button>
              <button
                style={styles.confirmDestructive}
                onClick={() => {
                  setConfirmingExit(false);
                  exit();
                }}
              >
                ABANDON RUN
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Portal-entry confirmation dialog. Shown on collision with an
          extract or descent portal — lets the player back out before
          committing. Two buttons: accept (commits) / cancel (nudges
          the player away from the portal). Hidden once the run is
          already resolved (extracted / defeated / victory) so it can't
          stack on top of the end-of-run overlays. */}
      {display.pendingPortalDecision
        && !display.extracted && !display.defeated && !display.victory && (
        <div style={styles.confirmOverlay}>
          <div style={styles.confirmPanel}>
            <div style={styles.confirmTitle}>
              {display.pendingPortalDecision.type === "extract"
                ? "EXTRACT FROM THE LABYRINTH?"
                : "DESCEND TO THE NEXT LAYER?"}
            </div>
            <div style={styles.confirmSub}>
              {display.pendingPortalDecision.type === "extract"
                ? "You've walked into the extraction portal."
                : "You've walked into the descent portal."}
            </div>
            <div style={styles.confirmBtnCol}>
              <button
                style={styles.confirmPrimary}
                onClick={handlePortalAccept}
              >
                {display.pendingPortalDecision.type === "extract"
                  ? "EXTRACT NOW — KEEP YOUR LOOT & XP"
                  : "GO DEEPER INTO THE LABYRINTH"}
              </button>
              <button
                style={styles.confirmDestructive}
                onClick={handlePortalCancel}
              >
                {display.pendingPortalDecision.type === "extract"
                  ? "RISK IT ALL — STAY IN THE LABYRINTH"
                  : "NOT YET"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Level-up upgrade pick screen — same component as main game */}
      {phase === "levelup" && <LevelUp onChoice={handleLabUpgrade} />}
    </>
  );
}

function LayerBanner({ banner, elapsedSec }: { banner: LabSharedState["layerBanner"]; elapsedSec: number }) {
  if (!banner) return null;
  const dt = elapsedSec - banner.at;
  if (dt < 0 || dt > 5) return null;
  let opacity = 1;
  if (dt < 0.4) opacity = dt / 0.4;
  else if (dt > 3.5) opacity = Math.max(0, 1 - (dt - 3.5) / 1.5);
  return (
    <div style={{
      position: "absolute", top: "28%", left: "50%", transform: "translateX(-50%)",
      textAlign: "center", pointerEvents: "none", zIndex: 30, opacity,
      transition: "opacity 0.3s",
    }}>
      <div style={{
        fontSize: 28, fontWeight: 900, letterSpacing: 6, color: banner.color,
        textShadow: `0 0 20px ${banner.color}80`, fontFamily: "monospace",
      }}>{banner.text}</div>
      <div style={{
        fontSize: 13, letterSpacing: 3, color: "rgba(200,180,220,0.7)",
        marginTop: 8, fontFamily: "monospace",
      }}>{banner.sub}</div>
    </div>
  );
}

function LabyrinthMinimap({ maze, playerRef, enemiesRef, sharedRef, lootRoomCell }: {
  maze: Maze;
  playerRef: React.MutableRefObject<LabPlayer>;
  enemiesRef: React.MutableRefObject<EnemyRuntime[]>;
  sharedRef: React.MutableRefObject<LabSharedState>;
  lootRoomCell: { col: number; row: number };
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const exploredRef = useRef(new Set<number>());
  const MINIMAP_SIZE = 140;
  const cellPx = MINIMAP_SIZE / maze.size;

  useEffect(() => {
    const iv = setInterval(() => {
      const cvs = canvasRef.current;
      if (!cvs) return;
      const ctx = cvs.getContext("2d");
      if (!ctx) return;
      const p = playerRef.current;
      const pc = worldToCell(p.x, p.z);

      // Reveal cells within 2-cell radius of player
      for (let dr = -2; dr <= 2; dr++) {
        for (let dc = -2; dc <= 2; dc++) {
          const c = pc.col + dc, r = pc.row + dr;
          if (c >= 0 && c < maze.size && r >= 0 && r < maze.size) {
            exploredRef.current.add(r * maze.size + c);
          }
        }
      }

      ctx.clearRect(0, 0, MINIMAP_SIZE, MINIMAP_SIZE);
      ctx.fillStyle = "rgba(0,0,0,0.85)";
      ctx.fillRect(0, 0, MINIMAP_SIZE, MINIMAP_SIZE);

      for (let r = 0; r < maze.size; r++) {
        for (let c = 0; c < maze.size; c++) {
          const i = r * maze.size + c;
          if (!exploredRef.current.has(i)) continue;
          const cell = maze.cells[i];
          const x = c * cellPx;
          const y = r * cellPx;

          // Floor
          ctx.fillStyle = "#1a1228";
          ctx.fillRect(x, y, cellPx, cellPx);

          // Walls
          ctx.strokeStyle = "#6644aa";
          ctx.lineWidth = 1;
          if (cell.walls & WALL_N) { ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + cellPx, y); ctx.stroke(); }
          if (cell.walls & WALL_S) { ctx.beginPath(); ctx.moveTo(x, y + cellPx); ctx.lineTo(x + cellPx, y + cellPx); ctx.stroke(); }
          if (cell.walls & WALL_W) { ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + cellPx); ctx.stroke(); }
          if (cell.walls & WALL_E) { ctx.beginPath(); ctx.moveTo(x + cellPx, y); ctx.lineTo(x + cellPx, y + cellPx); ctx.stroke(); }
        }
      }

      // Champion red dots (always visible, even in unexplored areas)
      for (const e of enemiesRef.current) {
        if (e.state === "dead") continue;
        const isChamp = e.kind === "rival_warrior" || e.kind === "rival_mage" || e.kind === "rival_rogue" || e.kind === "rival_necromancer" || e.kind === "rival_bard";
        if (!isChamp) continue;
        const ec = worldToCell(e.x, e.z);
        const ex = ec.col * cellPx + cellPx / 2;
        const ey = ec.row * cellPx + cellPx / 2;
        ctx.fillStyle = "#ff2244";
        ctx.beginPath();
        ctx.arc(ex, ey, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#ff6688";
        ctx.beginPath();
        ctx.arc(ex, ey, 1.5, 0, Math.PI * 2);
        ctx.fill();
      }

      // Treasure-room marker — yellow "$" with soft glow. Visible from
      // run start so the player can path toward it (no fog-of-war gate).
      // Rendered beneath the player dot so the player is always on top.
      {
        const lx = lootRoomCell.col * cellPx + cellPx / 2;
        const ly = lootRoomCell.row * cellPx + cellPx / 2;
        // Outer glow disc
        ctx.fillStyle = "rgba(255,200,64,0.25)";
        ctx.beginPath();
        ctx.arc(lx, ly, 6, 0, Math.PI * 2);
        ctx.fill();
        // Core disc
        ctx.fillStyle = "#ffcc44";
        ctx.beginPath();
        ctx.arc(lx, ly, 4, 0, Math.PI * 2);
        ctx.fill();
        // "$" glyph
        ctx.fillStyle = "#1a0f00";
        ctx.font = "bold 7px monospace";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("$", lx, ly + 0.5);
      }

      // Portal markers — pulse + icon. Extraction = blue "↑",
      // Descent = purple "▼". Pulse uses performance.now() so all
      // portals breathe in sync.
      {
        const now = performance.now() / 1000;
        const pulse = 0.5 + 0.5 * Math.sin(now * 3);
        for (const portal of sharedRef.current.portals) {
          if (portal.consumed) continue;
          const pcell = worldToCell(portal.x, portal.z);
          const px2 = pcell.col * cellPx + cellPx / 2;
          const py2 = pcell.row * cellPx + cellPx / 2;
          const isExtract = portal.id.startsWith("extract_");
          const coreColor = isExtract ? "#44b0ff" : "#c080ff";
          const glowColor = isExtract ? "rgba(68,176,255,0.5)" : "rgba(192,128,255,0.5)";
          const icon = isExtract ? "↑" : "▼";
          const r = 4 + pulse * 2;
          // Pulsing glow
          ctx.fillStyle = glowColor;
          ctx.beginPath();
          ctx.arc(px2, py2, r + 2, 0, Math.PI * 2);
          ctx.fill();
          // Core disc
          ctx.fillStyle = coreColor;
          ctx.beginPath();
          ctx.arc(px2, py2, 4, 0, Math.PI * 2);
          ctx.fill();
          // Glyph
          ctx.fillStyle = "#ffffff";
          ctx.font = "bold 7px monospace";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(icon, px2, py2 + 0.5);
        }
      }

      // Summon sign — large pulsing golden marker (always visible)
      {
        const sign = sharedRef.current.summonSign;
        if (sign && !sign.consumed) {
          const sc = worldToCell(sign.x, sign.z);
          const sx = sc.col * cellPx + cellPx / 2;
          const sy = sc.row * cellPx + cellPx / 2;
          const now = performance.now() / 1000;
          const pulse = 0.5 + 0.5 * Math.sin(now * 3);
          // Outer pulsing glow — large so it's impossible to miss
          ctx.fillStyle = `rgba(255,200,48,${0.2 + pulse * 0.2})`;
          ctx.beginPath();
          ctx.arc(sx, sy, 8 + pulse * 4, 0, Math.PI * 2);
          ctx.fill();
          // Core gold disc
          ctx.fillStyle = "#ffc830";
          ctx.beginPath();
          ctx.arc(sx, sy, 5, 0, Math.PI * 2);
          ctx.fill();
          // "B" glyph
          ctx.fillStyle = "#1a0f00";
          ctx.font = "bold 9px monospace";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText("B", sx, sy + 1);
        }
      }

      // Companion — amber dot
      {
        const comp = sharedRef.current.companion;
        if (comp.alive) {
          const cc = worldToCell(comp.x, comp.z);
          const cx = cc.col * cellPx + cellPx / 2;
          const cy = cc.row * cellPx + cellPx / 2;
          ctx.fillStyle = "#ffc830";
          ctx.beginPath();
          ctx.arc(cx, cy, 2, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // Player dot
      const px = pc.col * cellPx + cellPx / 2;
      const py = pc.row * cellPx + cellPx / 2;
      ctx.fillStyle = "#44ff88";
      ctx.beginPath();
      ctx.arc(px, py, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }, 150);
    return () => clearInterval(iv);
  }, [maze, playerRef, enemiesRef, sharedRef, lootRoomCell, cellPx]);

  return (
    <canvas
      ref={canvasRef}
      width={MINIMAP_SIZE}
      height={MINIMAP_SIZE}
      style={{
        position: "absolute",
        bottom: 28,
        left: 12,
        borderRadius: 6,
        border: "1px solid rgba(100,60,180,0.4)",
        pointerEvents: "none",
        zIndex: 20,
      }}
    />
  );
}

/** 2D billboarded gold-key pickup sprites. Task 6: rival-champion
 *  death spawns a `keyPickups` entry on sharedRef; this component
 *  pools up to 4 flat-quad key icons and positions them from the
 *  live list each frame. The quads camera-face via
 *  groupRef.quaternion.copy(camera.quaternion) (same pattern as the
 *  rival HP bar). Key shape is drawn from three rectangular planes:
 *  a gold disc (bow), a shaft, and two teeth — readable top-down.
 *
 *  No GLB fetch, no atlas, no new runtime state — purely reactive to
 *  sharedRef.current.keyPickups which MovementLoop mutates when the
 *  player walks onto the pickup. */
function LabyrinthKeyPickups3D({ sharedRef }: {
  sharedRef: React.MutableRefObject<LabSharedState>;
}) {
  const groupsRef = useRef<Array<THREE.Group | null>>([]);
  const POOL = 4;
  useFrame(({ camera, clock }) => {
    const keys = sharedRef.current.keyPickups;
    const bob = Math.sin(clock.elapsedTime * 2) * 0.12;
    for (let i = 0; i < POOL; i++) {
      const g = groupsRef.current[i];
      if (!g) continue;
      if (i < keys.length) {
        const k = keys[i];
        g.visible = true;
        // Float just above the floor; add a gentle bob so the pickup
        // reads as interactable rather than inert scenery.
        g.position.set(k.x, 0.9 + bob, k.z);
        // Camera-face the flat key so it always reads top-down.
        g.quaternion.copy(camera.quaternion);
      } else {
        g.visible = false;
      }
    }
  });
  return (
    <>
      {Array.from({ length: POOL }).map((_, i) => (
        <group
          key={i}
          ref={(el) => { groupsRef.current[i] = el; }}
          visible={false}
        >
          {/* Soft gold halo so the key glows on the stone floor. */}
          <mesh position={[0, 0, -0.01]}>
            <planeGeometry args={[1.4, 1.0]} />
            <meshBasicMaterial color="#ffd860" transparent opacity={0.22} depthWrite={false} />
          </mesh>
          {/* Key bow — the circular head. Approximated with a plane
              ring via two stacked quads: gold outer + dark centre. */}
          <mesh position={[-0.35, 0, 0]}>
            <circleGeometry args={[0.28, 24]} />
            <meshBasicMaterial color="#ffc440" transparent opacity={0.98} depthWrite={false} />
          </mesh>
          <mesh position={[-0.35, 0, 0.001]}>
            <circleGeometry args={[0.14, 24]} />
            <meshBasicMaterial color="#2a1a05" transparent opacity={0.98} depthWrite={false} />
          </mesh>
          {/* Key shaft — horizontal plank. */}
          <mesh position={[0.05, 0, 0]}>
            <planeGeometry args={[0.56, 0.14]} />
            <meshBasicMaterial color="#ffc440" transparent opacity={0.98} depthWrite={false} />
          </mesh>
          {/* Key teeth — two downward-pointing rectangles at the tip. */}
          <mesh position={[0.22, -0.15, 0]}>
            <planeGeometry args={[0.08, 0.18]} />
            <meshBasicMaterial color="#ffc440" transparent opacity={0.98} depthWrite={false} />
          </mesh>
          <mesh position={[0.33, -0.12, 0]}>
            <planeGeometry args={[0.08, 0.12]} />
            <meshBasicMaterial color="#ffc440" transparent opacity={0.98} depthWrite={false} />
          </mesh>
        </group>
      ))}
    </>
  );
}

function LabMinions3D({ minionsRef }: { minionsRef: React.MutableRefObject<MinionRuntime[]> }) {
  const groupRef = useRef<THREE.Group>(null);
  useFrame(() => {
    if (!groupRef.current) return;
    const minions = minionsRef.current;
    const children = groupRef.current.children;
    for (let i = 0; i < children.length; i++) {
      if (i < minions.length) {
        const m = minions[i];
        children[i].position.set(m.x, 0, m.z);
        children[i].rotation.y = m.angle;
        children[i].visible = true;
      } else {
        children[i].visible = false;
      }
    }
  });
  return (
    <group ref={groupRef}>
      {Array.from({ length: 5 }).map((_, i) => (
        <group key={i} scale={0.4} visible={false}>
          <mesh castShadow position={[0, 1.65, 0]}><boxGeometry args={[0.4, 0.45, 0.38]} /><meshBasicMaterial color="#d8c8a0" /></mesh>
          <mesh position={[-0.1, 1.7, 0.2]}><boxGeometry args={[0.1, 0.08, 0.02]} /><meshBasicMaterial color="#cc66ff" /></mesh>
          <mesh position={[0.1, 1.7, 0.2]}><boxGeometry args={[0.1, 0.08, 0.02]} /><meshBasicMaterial color="#cc66ff" /></mesh>
          <mesh castShadow position={[0, 1.15, 0]}><boxGeometry args={[0.38, 0.5, 0.25]} /><meshBasicMaterial color="#c8b888" /></mesh>
          <mesh castShadow position={[0, 0.75, 0]}><boxGeometry args={[0.12, 0.35, 0.12]} /><meshBasicMaterial color="#b8a878" /></mesh>
        </group>
      ))}
    </group>
  );
}

function GearKeepSelection({ equipped, onKeep }: {
  equipped: { weapon: GearDef | null; armor: GearDef | null; trinket: GearDef | null };
  onKeep: (gear: GearDef | null) => void;
}) {
  const [kept, setKept] = useState<Set<string>>(new Set());
  const slots = [
    { label: "WEAPON", gear: equipped.weapon, icon: "⚔" },
    { label: "ARMOR", gear: equipped.armor, icon: "🛡" },
    { label: "TRINKET", gear: equipped.trinket, icon: "💎" },
  ];
  const hasAny = slots.some((s) => s.gear !== null);
  return (
    <div style={{ display: "flex", flexDirection: "column" as const, gap: 10, marginTop: 16, width: "100%" }}>
      <div style={{ color: "#cc88ff", fontSize: 11, letterSpacing: 3, fontFamily: "monospace", textAlign: "center" as const, fontWeight: 900 }}>
        KEEP GEAR — TAP TO STASH
      </div>
      {slots.map((s) => s.gear ? (
        <button key={s.label} disabled={kept.has(s.label)} style={{
          display: "flex", alignItems: "center", gap: 14,
          padding: "14px 18px",
          background: kept.has(s.label) ? "rgba(20,60,20,0.7)" : "rgba(40,15,70,0.7)",
          border: kept.has(s.label) ? "1px solid rgba(80,200,80,0.5)" : "1px solid rgba(180,80,255,0.5)",
          borderRadius: 8,
          cursor: kept.has(s.label) ? "default" : "pointer",
          fontFamily: "monospace", textAlign: "left" as const,
          opacity: kept.has(s.label) ? 0.7 : 1,
        }} onClick={() => {
          if (!kept.has(s.label)) {
            onKeep(s.gear);
            setKept(new Set([...kept, s.label]));
          }
        }}>
          <span style={{ fontSize: 28 }}>{s.gear!.icon}</span>
          <div>
            <div style={{ color: kept.has(s.label) ? "#88ff88" : "#ddaaff", fontSize: 14, fontWeight: "bold", letterSpacing: 1 }}>
              {kept.has(s.label) ? `✓ ${s.gear!.name}` : s.gear!.name}
            </div>
            <div style={{ color: kept.has(s.label) ? "#66aa66" : "#aa88cc", fontSize: 10, letterSpacing: 2 }}>
              {kept.has(s.label) ? "SAVED TO STASH" : `${s.label} · ${s.gear!.rarity.toUpperCase()}`}
            </div>
          </div>
        </button>
      ) : null)}
      {!hasAny && (
        <div style={{ color: "#888", fontSize: 12, textAlign: "center" as const, padding: 20 }}>No gear equipped to keep.</div>
      )}
    </div>
  );
}

/** Decides which two rival kinds spawn (and in what order) based on
 *  the player's selected class. First rival is the more ranged /
 *  complex counter; second is the opposite style. Deterministic so
 *  runs feel consistent. */
/** Single-run labyrinth achievement evaluation. Called exactly once
 *  per run (guarded by shared.achievementsEvaluated) the frame the
 *  run ends — whether by extraction, defeat, or warden slain.
 *
 *  Each achievement's unlock rule is encoded inline; conditions read
 *  from the run-local shared/player/gear state that was accumulated
 *  during play. tryUnlock is idempotent (second call is a no-op) so
 *  re-triggering is safe.
 *
 *  Cross-run counter updates also happen here (Nemesis kills, All
 *  Roads Lead Out class-extraction record) — both written through
 *  the metaStore actions which persist across sessions. */
function evaluateLabRunAchievements(
  shared: LabSharedState,
  p: LabPlayer,
  gear: LabGearState,
  charClass: CharacterClass,
): void {
  const ach = useAchievementStore.getState();
  const meta = useMetaStore.getState();

  // ─── Cross-run counters fed from single-run data ─────────────────
  // "Nemesis" (100 labyrinth kills across runs) — feed the per-run
  // killCount into the persistent counter; metaStore fires the
  // achievement when the total crosses 100.
  if (shared.killCount > 0) {
    meta.addLabyrinthKills(shared.killCount);
  }
  // "The Long Game" — every run end (extract OR defeat OR warden
  // slain) counts. Fires at 10 total.
  meta.recordLabyrinthRunComplete();
  // "Warden's Bane" — warden defeat recorded separately so the
  // cross-run counter only bumps on victory runs. Fires at 3.
  if (shared.victory) {
    meta.recordLabyrinthWardenKill();
  }

  // ─── Extraction-gated achievements ───────────────────────────────
  if (shared.extracted) {
    // All Roads Lead Out — record this class's extraction; metaStore
    // fires the achievement when all 3 classes have been recorded.
    meta.recordLabyrinthExtraction(charClass);

    // Speed Runner — extracted in under 4 minutes.
    if (shared.zone.elapsedSec < 240) {
      ach.tryUnlock("lab_speed_runner");
    }

    // Last Train Out — extracted in the final 10 seconds of the run.
    // Interpreted as "10 seconds before total zone closure"; matches
    // the "final portal window" spirit since the last portal is the
    // only one alive that late into the run.
    if (shared.zone.elapsedSec > ZONE_TOTAL_DURATION_SEC - 10) {
      ach.tryUnlock("lab_last_train_out");
    }

    // Ghost Protocol — extracted with zero shroud DoT taken.
    // Accumulated in the poison-damage tick above.
    if (shared.shroudDamageTaken === 0) {
      ach.tryUnlock("lab_ghost_protocol");
    }

    // Iron Will — extracted without picking up OR equipping any
    // gear. Pickups counter covers both cases (an equipped piece
    // always flowed through a pickup).
    const anyEquipped = !!(gear.weapon || gear.armor || gear.trinket);
    if (shared.gearPickupsThisRun === 0 && !anyEquipped) {
      ach.tryUnlock("lab_iron_will");
    }
  }

  // ─── Victory-gated achievements (warden slain) ───────────────────
  if (shared.victory) {
    // Full Clearance — defeated the Warden AND opened the vault in
    // the same run. rivalKillCount + lootRoomUnlocked are both
    // authoritative (first rival kill drops the key, player has to
    // walk through the vault to consume it).
    if (shared.lootRoomUnlocked) {
      ach.tryUnlock("lab_full_clearance");
    }
  }

  // ─── Rival Slayer — killed BOTH rival champions this run ─────────
  // Fires on ANY run-end path (extract, defeat, or victory) because
  // the player can still die after both rivals fall but the kill
  // count remains at 2. No extraction requirement.
  if (shared.rivalKillCount >= 2) {
    ach.tryUnlock("lab_rival_slayer");
  }

  // ─── Defeat-gated achievements ───────────────────────────────────
  if (shared.defeated) {
    // Wrong Turn — died within the first 60 seconds AND player was
    // outside the safe zone (i.e., shroud killed them, not a
    // corridor guardian). Spec only requires "die in poison shroud
    // within first minute" — we gate on shroudDamageTaken > 0 so
    // random-kill wipes in the opening 60s don't trigger it.
    if (shared.zone.elapsedSec < 60 && shared.shroudDamageTaken > 0) {
      ach.tryUnlock("lab_wrong_turn");
    }

    // So Close — died within 10 world units of any LIVE (not
    // consumed) extraction portal.
    for (const portal of shared.portals) {
      if (portal.consumed) continue;
      const dx = p.x - portal.x;
      const dz = p.z - portal.z;
      if (dx * dx + dz * dz <= 100) {   // 10 * 10
        ach.tryUnlock("lab_so_close");
        break;
      }
    }
  }
}

type RivalKind = "rival_warrior" | "rival_mage" | "rival_rogue" | "rival_necromancer" | "rival_bard";
function rivalOrderForClass(cls: CharacterClass): [RivalKind, RivalKind, RivalKind, RivalKind] {
  if (cls === "warrior")     return ["rival_mage",        "rival_rogue",       "rival_necromancer", "rival_bard"];
  if (cls === "mage")        return ["rival_warrior",     "rival_rogue",       "rival_necromancer", "rival_bard"];
  if (cls === "rogue")       return ["rival_warrior",     "rival_mage",        "rival_necromancer", "rival_bard"];
  if (cls === "necromancer") return ["rival_warrior",     "rival_mage",        "rival_rogue",       "rival_bard"];
  if (cls === "bard")        return ["rival_warrior",     "rival_mage",        "rival_rogue",       "rival_necromancer"];
  return                            ["rival_warrior",     "rival_mage",        "rival_necromancer", "rival_bard"];
}

/** Rival-kill reward handler. Centralised so both kill paths (melee
 *  swing + ranged projectile) take the same branch:
 *    rivalKillCount == 0 → first kill → drop vault key
 *    rivalKillCount == 1 → second kill → guaranteed rare gear drop
 *  `shared` is mutated in place. `gearDrops` is the current ground-
 *  drop list (CombatEnemyLoop's gearDropsRef.current). */
function onRivalChampionKill(
  e: EnemyRuntime,
  shared: LabSharedState,
  gearDrops: LabGearDropRuntime[],
): void {
  if (shared.rivalKillCount === 0) {
    // Task 6: key is now a manual ground pickup. Spawn it at the
    // rival's death spot — the player must walk onto it to pick it up
    // (pickup radius ~0.6u, checked each MovementLoop tick). hasKey is
    // set at that moment, not here.
    shared.keyPickups.push({
      id: `key-${e.id}`,
      x: e.x,
      z: e.z,
    });
    useMetaStore.getState().recordLabyrinthKeyObtain();
  } else if (shared.rivalKillCount === 1) {
    const gear = rollGearDrop("rare");
    spawnLabGearDrop(gearDrops, gear, e.x, e.z);
  }
  shared.rivalKillCount += 1;
  shared.championsKilled += 1;
  const lc = LAYER_CONFIG[shared.layer];
  const remaining = lc.championCount - shared.championsKilled;
  if (remaining === 1) {
    shared.layerBanner = { text: "ONE CHAMPION REMAINS", sub: "FINISH THE HUNT", color: "#ff8844", at: shared.zone.elapsedSec };
  }
  if (shared.championsKilled >= lc.championCount) {
    if (lc.hasMiniBoss && !shared.miniBossSpawned) {
      // Spawn mini-boss at the last champion's death position
      shared.miniBossSpawned = true;
      shared.miniBossAlive = true;
      shared.layerBanner = { text: "A CHAMPION BOSS EMERGES", sub: "DEFEAT IT TO OPEN PORTALS", color: "#ff4488", at: shared.zone.elapsedSec };
    } else if (!lc.hasMiniBoss || !shared.miniBossAlive) {
      const wardenAlive = lc.hasWarden && (shared.wardenHud?.alive ?? !shared.wardenSpawned);
      if (!wardenAlive) {
        shared.layerComplete = true;
        shared.layerBanner = { text: "PORTALS OPENED — CHOOSE YOUR PATH", sub: shared.layer < 3 ? "DESCEND DEEPER OR EXTRACT" : "THE ABYSS IS CONQUERED", color: "#44ff88", at: shared.zone.elapsedSec };
      } else {
        shared.layerBanner = { text: "CHAMPIONS SLAIN — SLAY THE WARDEN", sub: "THE FINAL CHALLENGE AWAITS", color: "#ff60ff", at: shared.zone.elapsedSec };
      }
    }
  }
}

/** Per-rival banner display info. Class name + accent colour so the
 *  player sees which rival just entered and reads the threat type. */
const RIVAL_BANNER_INFO: Record<
  RivalKind,
  { label: string; color: string; glow: string }
> = {
  rival_warrior:     { label: "A RIVAL WARRIOR ENTERS THE LABYRINTH",     color: "#ff6866", glow: "rgba(255,100,80,0.6)" },
  rival_mage:        { label: "A RIVAL MAGE ENTERS THE LABYRINTH",        color: "#d080ff", glow: "rgba(200,120,255,0.6)" },
  rival_rogue:       { label: "A RIVAL ROGUE ENTERS THE LABYRINTH",       color: "#60e8a0", glow: "rgba(60,220,140,0.6)" },
  rival_necromancer: { label: "A RIVAL NECROMANCER ENTERS THE LABYRINTH", color: "#88ff44", glow: "rgba(100,220,60,0.6)" },
  rival_bard:        { label: "A RIVAL BARD ENTERS THE LABYRINTH",        color: "#ffcc44", glow: "rgba(255,200,60,0.6)" },
};

/** Rival-spawn banner. Shows for 3.5 s after each rival spawn.
 *  Class-coloured so the player reads the threat type immediately. */
function RivalBanner({ elapsedSec, announce }: {
  elapsedSec: number;
  announce: { kind: RivalKind; announcedAt: number } | null;
}) {
  if (!announce) return null;
  const dt = elapsedSec - announce.announcedAt;
  if (dt < 0 || dt > 3.5) return null;
  let opacity = 1;
  if (dt < 0.25) opacity = dt / 0.25;
  else if (dt > 2.7) opacity = Math.max(0, 1 - (dt - 2.7) / 0.8);
  const info = RIVAL_BANNER_INFO[announce.kind];
  return (
    <div style={{ ...styles.championBanner, opacity }}>
      <div style={{ ...styles.championBannerTop, color: info.color, textShadow: `0 0 12px ${info.glow}` }}>⚔ {info.label} ⚔</div>
      <div style={styles.championBannerSub}>{announce.kind === "rival_warrior" ? "SLAY FOR THE KEY" : ""}</div>
    </div>
  );
}

/** Fading "A CHAMPION HUNTS YOU" banner — kept for backward compat
 *  with any existing callers. No longer used by the rival system,
 *  which has its own RivalBanner above. */
function ChampionBanner({ elapsedSec, announcedAt }: {
  elapsedSec: number;
  announcedAt: number;
}) {
  if (!isFinite(announcedAt)) return null;
  const dt = elapsedSec - announcedAt;
  if (dt < 0 || dt > 3.5) return null;
  let opacity = 1;
  if (dt < 0.25) opacity = dt / 0.25;
  else if (dt > 2.7) opacity = Math.max(0, 1 - (dt - 2.7) / 0.8);
  return (
    <div style={{ ...styles.championBanner, opacity }}>
      <div style={styles.championBannerTop}>⚔ A CHAMPION HUNTS YOU ⚔</div>
      <div style={styles.championBannerSub}>SLAY IT FOR THE VAULT KEY</div>
    </div>
  );
}

/** Labyrinth pause-menu Character view. Shows the full diagnostic
 *  stat sheet — every value the combat loop actually reads during
 *  play, so the player can confirm gear bonuses + passives are
 *  applying correctly.
 *
 *  Reads directly from the authoritative refs (playerRef,
 *  gearStateRef, progressionRef). NO parallel stat calculation —
 *  each row surfaces the same value the tick function consumes.
 *
 *  Design intent: diagnostic > aesthetic. Two-column key/value
 *  layout, itemised gear rows, and a breakdown that sums to the
 *  final effective value so the player can verify math.
 */
function LabyrinthCharacterView({
  charClass,
  labStats,
  playerRef,
  gearStateRef,
  progressionRef,
  sharedRef,
  onBack,
}: {
  charClass: CharacterClass;
  /** Resolved starting stats (class + race + Soul Forge + Trial).
   *  The "base" values displayed in the stat sheet come from here
   *  so the diagnostic already reflects meta bonuses. */
  labStats: PlayerStats;
  playerRef: React.MutableRefObject<LabPlayer>;
  gearStateRef: React.MutableRefObject<LabGearState>;
  progressionRef: React.MutableRefObject<LabProgressionState>;
  sharedRef: React.MutableRefObject<LabSharedState>;
  onBack: () => void;
}) {
  const def = CHARACTER_DATA[charClass];
  const classRaw = def;  // raw class baseline (pre-meta) — shown as "class" line
  const p = playerRef.current;
  const gear = gearStateRef.current;
  const b = gear.bonuses;
  const level = progressionRef.current.level;

  // Render-bump counter. Equip/sell handlers mutate gearStateRef
  // directly (refs don't re-render), so we force a refresh by
  // bumping a state counter each time the player takes an action.
  const [, setTick] = useState(0);
  const bump = () => setTick((t) => t + 1);

  /** Equip the inventory[index] piece into its matching slot. Any
   *  currently-equipped piece moves INTO the vacated inventory slot
   *  (swap). Applies maxHp delta to the player + syncs the HUD's
   *  shared.equipped snapshot so the top-right gear strip updates
   *  on the next 100ms poll after unpause. */
  const handleEquip = (index: number) => {
    const res = equipFromInventory(gearStateRef.current, index);
    if (!res) return;
    if (res.maxHealthDelta !== 0) {
      playerRef.current.maxHp += res.maxHealthDelta;
      playerRef.current.hp = Math.min(
        playerRef.current.maxHp,
        playerRef.current.hp + res.maxHealthDelta,
      );
    }
    sharedRef.current.equipped = {
      weapon: gearStateRef.current.weapon,
      armor: gearStateRef.current.armor,
      trinket: gearStateRef.current.trinket,
    };
    audioManager.play("gear_drop");
    bump();
  };

  /** Sell an inventory piece — salvages at LAB_SALVAGE_VALUE[rarity]
   *  and deposits straight into the Soul Forge balance via
   *  useMetaStore.addShards(). Mirrors the main-game "sell" button
   *  behaviour in the PauseMenu character view. */
  const handleSell = (index: number) => {
    const value = sellFromInventory(gearStateRef.current, index);
    if (value > 0) {
      useMetaStore.getState().addShards(value);
      audioManager.play("xp_pickup");
    }
    bump();
  };

  // Mirror the same math the combat loop does every tick. "Base"
  // comes from labStats (which already includes Soul Forge + race
  // + Trial buffs). "Gear" comes from the cached bonus totals. The
  // effective value is base + gear (matching the per-tick formula
  // inside CombatEnemyLoop / MovementLoop).
  const baseAtkSpeed = labStats.attackSpeed;
  const effAtkSpeed = baseAtkSpeed + (b.attackSpeed ?? 0);
  const effDamage = labStats.damage + (b.damage ?? 0);
  const effCrit = labStats.critChance + (b.critChance ?? 0);
  // Move speed: labyrinth's 5.0 baseline + Soul Forge/race delta over
  // the class baseline + gear bonus (capped). Same formula as
  // MovementLoop's WALK_SPEED calc.
  const metaMoveBonus = labStats.moveSpeed - classRaw.moveSpeed;
  const effMoveSpeedRaw = 5.0 + metaMoveBonus + Math.min(6, b.moveSpeed ?? 0);
  const effArmor = labStats.armor;
  const regenPerSec = 0.1 * level;
  // Range: combatStats.atkRange = labStats.attackRange * 0.75 (same
  // labyrinth corridor-combat modifier as the combat loop).
  const effRange = labStats.attackRange * 0.75;

  // Equipped-gear rows — itemised bonus display so the player can
  // see exactly which piece contributes what (vs. just the total).
  const slots: Array<[string, GearDef | null]> = [
    ["WEAPON",  gear.weapon],
    ["ARMOR",   gear.armor],
    ["TRINKET", gear.trinket],
  ];

  return (
    <div style={styles.charPanel}>
      <div style={styles.charHeader}>
        <span style={styles.charTitle}>CHARACTER</span>
        <button style={styles.charBackBtn} onClick={onBack}>◂ BACK</button>
      </div>

      {/* ─── Class + race + level summary ─── */}
      <div style={styles.charSubHeader}>
        {def.name} · LVL {level}
      </div>

      {/* ─── Equipped gear (itemised) ─── */}
      <div style={styles.charSectionTitle}>EQUIPPED GEAR</div>
      <div style={styles.charEquippedGrid}>
        {slots.map(([label, g]) => (
          <EquippedGearRow key={label} label={label} gear={g} />
        ))}
      </div>

      {/* ─── Acquired upgrades ─── */}
      {(() => {
        const ups = Array.from(progressionRef.current.acquiredUpgrades.entries()).filter(([, v]) => v > 0);
        if (ups.length === 0) return null;
        return (
          <>
            <div style={styles.charSectionTitle}>ACQUIRED UPGRADES ({ups.length})</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 3, marginBottom: 8 }}>
              {ups.map(([id, count]) => {
                const u = UPGRADES[id as keyof typeof UPGRADES];
                const name = u?.name ?? String(id).replace(/_/g, " ");
                const icon = u?.icon ?? "";
                const col = u?.rarity === "epic" ? "#aa44ff" : u?.rarity === "rare" ? "#4488ff" : "#aaa";
                return (
                  <div key={id} style={{
                    padding: "2px 6px", borderRadius: 3,
                    background: "rgba(20,10,40,0.7)", border: `1px solid ${col}44`,
                    borderLeft: `2px solid ${col}`,
                    fontSize: 10, fontFamily: "monospace", color: "#ddd",
                  }}>
                    {icon} {name}{count > 1 ? ` ×${count}` : ""}
                  </div>
                );
              })}
            </div>
          </>
        );
      })()}

      {/* ─── Live stats block ─── */}
      <div style={styles.charSectionTitle}>LIVE STATS</div>
      <div style={styles.charStatsGrid}>
        <StatRow
          label="Health"
          value={`${Math.ceil(p.hp)} / ${p.maxHp}`}
          hint={`class ${classRaw.hp} · meta ${(labStats.maxHealth - classRaw.hp).toFixed(0)} · gear ${(b.maxHealth ?? 0).toFixed(0)}`}
        />
        <StatRow label="Regen / sec" value={regenPerSec.toFixed(2)} hint={`0.1 × LVL ${level}`} />
        <StatRow
          label="Damage"
          value={effDamage.toFixed(1)}
          hint={`class ${classRaw.damage} · meta ${(labStats.damage - classRaw.damage).toFixed(0)} · gear ${(b.damage ?? 0).toFixed(1)}`}
        />
        <StatRow
          label="Attack speed"
          value={effAtkSpeed.toFixed(2)}
          hint={`class ${classRaw.attackSpeed.toFixed(2)} · meta +${(labStats.attackSpeed - classRaw.attackSpeed).toFixed(2)} · gear +${(b.attackSpeed ?? 0).toFixed(2)}`}
        />
        <StatRow
          label="Attack range"
          value={effRange.toFixed(1)}
          hint={`${labStats.attackRange.toFixed(1)} × 0.75 labyrinth`}
        />
        <StatRow
          label="Crit chance"
          value={`${(effCrit * 100).toFixed(1)}%`}
          hint={`class ${(classRaw.critChance * 100).toFixed(1)}% · meta ${((labStats.critChance - classRaw.critChance) * 100).toFixed(1)}% · gear ${((b.critChance ?? 0) * 100).toFixed(1)}%`}
        />
        <StatRow
          label="Crit damage"
          value={`${labStats.critDamageMultiplier.toFixed(2)}×`}
          hint="base class multiplier"
        />
        <StatRow
          label="Move speed"
          value={effMoveSpeedRaw.toFixed(2)}
          hint={`5.00 lab base · meta ${metaMoveBonus.toFixed(2)} · gear ${Math.min(6, b.moveSpeed ?? 0).toFixed(2)} (cap 6)`}
        />
        <StatRow
          label="Armor"
          value={effArmor.toFixed(0)}
          hint={`class ${classRaw.armor} · meta ${(labStats.armor - classRaw.armor).toFixed(0)}`}
        />
        <StatRow
          label="Dash CD"
          value={`${labStats.dashCooldown.toFixed(2)}s`}
          hint={`class ${classRaw.dashCooldown.toFixed(2)}s · meta ${(labStats.dashCooldown - classRaw.dashCooldown).toFixed(2)}s`}
        />
        {charClass === "rogue" && (
          <StatRow label="Poison (shroud)" value="3 dps / stack · cap 5" hint="labyrinth default" />
        )}
      </div>

      {/* ─── Gear bonus totals (itemised by stat) ─── */}
      <div style={styles.charSectionTitle}>GEAR BONUS TOTALS</div>
      {Object.keys(b).length === 0 ? (
        <div style={styles.charEmpty}>No gear equipped yet.</div>
      ) : (
        <div style={styles.charStatsGrid}>
          {Object.entries(b).map(([key, val]) => (
            <StatRow key={key} label={humanizeStatKey(key)} value={formatBonusValue(key, val)} />
          ))}
        </div>
      )}

      {/* ─── Inventory (20-slot capacity) ─── */}
      <div style={styles.charSectionTitle}>
        SPARE GEAR ({gear.inventory.length}/{LAB_INVENTORY_CAPACITY})
      </div>
      {gear.inventory.length === 0 ? (
        <div style={styles.charEmpty}>
          Empty. New pickups land here when the matching slot is already full.
        </div>
      ) : (
        <div style={styles.charInventoryList}>
          {gear.inventory.map((item, idx) => (
            <InventoryRow
              key={`${item.id}-${idx}`}
              item={item}
              onEquip={() => handleEquip(idx)}
              onSell={() => handleSell(idx)}
            />
          ))}
        </div>
      )}
      <div style={styles.charInventoryHint}>
        Run-only. All gear auto-salvages into Soul Forge crystals at run end.
      </div>

      <button style={styles.charResumeBtn} onClick={onBack}>▶ RESUME</button>
    </div>
  );
}

/** Single stat row — label on the left, value on the right, optional
 *  hint line underneath in a dimmer color. */
function StatRow({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div style={styles.charStatRow}>
      <div style={styles.charStatLabelLine}>
        <span style={styles.charStatLabel}>{label}</span>
        <span style={styles.charStatValue}>{value}</span>
      </div>
      {hint && <div style={styles.charStatHint}>{hint}</div>}
    </div>
  );
}

/** Equipped gear row — icon + name + rarity + bonuses. If the slot
 *  is empty, shows a dim "EMPTY" placeholder so players can see the
 *  slot exists. */
/** Single inventory row — gear name + rarity border + bonus chips
 *  + EQUIP / SELL action buttons. Equip swaps with the currently-
 *  equipped slot (old equipped moves into this inventory slot).
 *  Sell salvages at LAB_SALVAGE_VALUE[rarity] and deposits directly
 *  into the Soul Forge crystal balance. */
function InventoryRow({
  item,
  onEquip,
  onSell,
}: {
  item: GearDef;
  onEquip: () => void;
  onSell: () => void;
}) {
  const border = item.rarity === "epic" ? "#aa44ff"
               : item.rarity === "rare" ? "#4488dd"
               : "#6a6a7a";
  const text   = item.rarity === "epic" ? "#cc88ff"
               : item.rarity === "rare" ? "#70b0ff"
               : "#aaaabb";
  const salvageValue = LAB_SALVAGE_VALUE[item.rarity] ?? 0;
  return (
    <div style={{ ...styles.charInventoryRow, borderColor: border }}>
      <div style={{ ...styles.charInventoryName, color: text }}>
        {item.icon} {item.name}
        {(item.enhanceLevel ?? 0) > 0 && ` +${item.enhanceLevel}`}
      </div>
      <div style={styles.charInventoryBonuses}>
        {Object.entries(item.bonuses).map(([k, v]) => (
          <span key={k} style={styles.charEquippedBonus}>
            {formatBonusValue(k, v ?? 0)} {humanizeStatKey(k)}
          </span>
        ))}
      </div>
      <div style={styles.charInventoryActions}>
        <button style={styles.charInvBtnEquip} onClick={onEquip}>EQUIP</button>
        <button style={styles.charInvBtnSell} onClick={onSell}>
          SELL · {salvageValue}◈
        </button>
      </div>
    </div>
  );
}

function EquippedGearRow({ label, gear }: { label: string; gear: GearDef | null }) {
  const rarity = gear?.rarity;
  const border = rarity === "epic" ? "#aa44ff" : rarity === "rare" ? "#4488dd" : rarity ? "#6a6a7a" : "#2a2030";
  const text = rarity === "epic" ? "#cc88ff" : rarity === "rare" ? "#70b0ff" : rarity ? "#aaaabb" : "#555060";
  return (
    <div style={{ ...styles.charEquippedRow, borderColor: border }}>
      <div style={styles.charEquippedLabel}>{label}</div>
      {gear ? (
        <>
          <div style={{ ...styles.charEquippedName, color: text }}>
            {gear.icon} {gear.name}
            {(gear.enhanceLevel ?? 0) > 0 && ` +${gear.enhanceLevel}`}
          </div>
          <div style={styles.charEquippedBonuses}>
            {Object.entries(gear.bonuses).map(([k, v]) => (
              <span key={k} style={styles.charEquippedBonus}>
                {formatBonusValue(k, v ?? 0)} {humanizeStatKey(k)}
              </span>
            ))}
          </div>
        </>
      ) : (
        <div style={{ ...styles.charEquippedName, color: "#4a4050", fontStyle: "italic" }}>— empty —</div>
      )}
    </div>
  );
}

/** Pretty-print a stat key for the UI (damage → DMG, maxHealth → MAX HP). */
function humanizeStatKey(key: string): string {
  switch (key) {
    case "damage":      return "DMG";
    case "attackSpeed": return "ATK SPD";
    case "maxHealth":   return "MAX HP";
    case "critChance":  return "CRIT";
    case "moveSpeed":   return "MOVE SPD";
    case "armor":       return "ARMOR";
    default:            return key.toUpperCase();
  }
}

/** Format a bonus value for the UI — crit chance shows as %, flat
 *  numbers get a + sign. */
function formatBonusValue(key: string, val: number): string {
  if (key === "critChance") return `+${(val * 100).toFixed(1)}%`;
  if (val >= 0) return `+${val.toFixed(val % 1 === 0 ? 0 : 2)}`;
  return val.toFixed(2);
}

/** Three-slot equipped gear strip shown under the threat box. Reads
 *  the sharedRef.equipped snapshot via the HUD's display poll. Empty
 *  slots render as dim placeholders so the UI stays at a fixed size. */
function GearSlotStrip({ equipped }: {
  equipped: { weapon: GearDef | null; armor: GearDef | null; trinket: GearDef | null };
}) {
  const RARITY_BORDER: Record<string, string> = {
    common: "rgba(170,170,187,0.65)",
    rare:   "rgba(68,136,221,0.85)",
    epic:   "rgba(170,68,255,0.9)",
  };
  const slotIcon = (g: GearDef | null, fallback: string) => g?.icon ?? fallback;
  const border = (g: GearDef | null) =>
    g ? RARITY_BORDER[g.rarity] ?? RARITY_BORDER.common : "rgba(60,60,80,0.5)";
  const glow = (g: GearDef | null) => {
    if (!g) return "none";
    if (g.rarity === "epic") return "0 0 14px rgba(140,40,255,0.45)";
    if (g.rarity === "rare") return "0 0 10px rgba(60,120,255,0.4)";
    return "none";
  };
  const renderSlot = (g: GearDef | null, fallback: string, key: string) => (
    <div
      key={key}
      style={{
        ...styles.gearSlotBox,
        borderColor: border(g),
        boxShadow: glow(g),
        color: g ? "#f0e0ff" : "rgba(120,120,140,0.6)",
      }}
      title={g ? `${g.name}${(g.enhanceLevel ?? 0) > 0 ? ` +${g.enhanceLevel}` : ""}` : "empty"}
    >
      {slotIcon(g, fallback)}
    </div>
  );
  return (
    <div style={styles.gearStrip}>
      {renderSlot(equipped.weapon, "⚔", "weapon")}
      {renderSlot(equipped.armor, "🛡", "armor")}
      {renderSlot(equipped.trinket, "◈", "trinket")}
    </div>
  );
}

function ActionCooldownIndicator({ charClass }: { charClass: CharacterClass }) {
  const actionReady = useGameStore((s) => s.actionReady);
  const actionCooldownTimer = useGameStore((s) => s.actionCooldownTimer);
  const name =
    charClass === "warrior" ? "WAR CRY" :
    charClass === "mage" ? "ARCANE BARRAGE" :
    charClass === "rogue" ? "FAN OF KNIVES" :
    charClass === "necromancer" ? "ARMY OF DEAD" :
    "DISCORD";
  return (
    <div style={{
      position: "absolute",
      bottom: 40,
      right: 20,
      display: "flex",
      flexDirection: "column" as const,
      alignItems: "center",
      gap: 4,
      padding: "8px 14px",
      background: actionReady ? "rgba(20,60,20,0.85)" : "rgba(20,20,40,0.75)",
      border: `1px solid ${actionReady ? "#44cc44" : "#444"}`,
      borderRadius: 10,
      transition: "all 0.3s",
      boxShadow: actionReady ? "0 0 12px rgba(60,200,60,0.4)" : "none",
      pointerEvents: "none",
    }}>
      <span style={{ fontSize: 11, fontWeight: 900, letterSpacing: 2, color: actionReady ? "#88ff88" : "#888", fontFamily: "monospace" }}>
        {name}
      </span>
      {actionReady ? (
        <span style={{ fontSize: 10, color: "#66cc66", fontFamily: "monospace" }}>READY · SPACE</span>
      ) : (
        <span style={{ fontSize: 13, fontWeight: "bold", color: "#ffaa44", fontFamily: "monospace" }}>
          {Math.ceil(actionCooldownTimer)}s
        </span>
      )}
    </div>
  );
}

function PoisonPips({ stacks, dps }: { stacks: number; dps: number }) {
  // Integer pip count (ceil so a partial stack still shows as 1 pip).
  const pipCount = Math.max(0, Math.min(LAB_POISON_MAX_STACKS, Math.ceil(stacks)));
  const pips = [];
  for (let i = 0; i < LAB_POISON_MAX_STACKS; i++) {
    const on = i < pipCount;
    pips.push(
      <div
        key={i}
        style={{
          width: 14,
          height: 14,
          borderRadius: "50%",
          background: on ? "#4ade80" : "rgba(60,40,70,0.55)",
          border: "1px solid " + (on ? "#2c8a4a" : "#2a2035"),
          boxShadow: on ? "0 0 6px #4ade80" : "none",
          transition: "background 0.15s, box-shadow 0.15s",
        }}
      />,
    );
  }
  const totalDps = stacks * dps;
  return (
    <div style={styles.poisonBox}>
      <div style={styles.poisonLabel}>
        <span style={{ color: "#4ade80", fontWeight: "bold" }}>POISON</span>
        <span style={{ color: "#a0b0a0", fontSize: 11 }}>
          {totalDps.toFixed(1)} DPS
        </span>
      </div>
      <div style={styles.poisonPipRow}>{pips}</div>
    </div>
  );
}

/** Screen-edge arrow pointing toward the nearest live extraction portal. */
function PortalArrow({ dx, dz, popupAtSec, elapsedSec }: {
  dx: number;
  dz: number;
  popupAtSec: number;
  elapsedSec: number;
}) {
  const angleDeg = Math.atan2(dx, -dz) * (180 / Math.PI);
  // Pulse harder for the first 3.5 s after a milestone spawn so
  // players notice a new portal regardless of where their eyes are.
  const spawnAge = elapsedSec - popupAtSec;
  const freshPulse = spawnAge >= 0 && spawnAge < 3.5;
  const pulse = 1 + 0.12 * Math.sin(elapsedSec * 6);
  const size = freshPulse ? 52 * pulse : 44;
  const opacity = freshPulse ? 1 : 0.85;
  const shadow = freshPulse
    ? "0 0 18px #d090ff, 0 0 36px #a040ff, 0 0 54px #6030cc"
    : "0 0 14px #a040ff, 0 0 28px #6030cc";
  return (
    <div style={{
      position: "absolute",
      top: "50%",
      left: "50%",
      transform: `translate(-50%, -50%) rotate(${angleDeg}deg) translateY(-min(22vh, 180px))`,
      pointerEvents: "none",
      fontSize: size,
      color: "#e0c0ff",
      textShadow: shadow,
      opacity,
      transition: "font-size 0.12s linear, text-shadow 0.12s linear",
    }}>
      ⬭
    </div>
  );
}

/** Popup that fades in/out for ~3 seconds after a milestone portal spawn. */
function PortalPopup({
  elapsedSec,
  popupAtSec,
  count,
}: {
  elapsedSec: number;
  popupAtSec: number;
  count: number;
}) {
  const age = elapsedSec - popupAtSec;
  if (age < 0 || age > 3.5 || count <= 0) return null;
  // Fade: in over 0.2s, hold, out over last 0.7s.
  let opacity = 1;
  if (age < 0.2) opacity = age / 0.2;
  else if (age > 2.8) opacity = Math.max(0, 1 - (age - 2.8) / 0.7);
  // Slow heartbeat pulse on the title to draw the eye — 1.0..1.06
  // scale oscillation at ~2 Hz during the hold phase.
  const pulse = 1 + 0.06 * Math.sin(age * 12);
  return (
    <div style={{ ...styles.portalPopup, opacity }}>
      <div style={{ ...styles.portalPopupTitle, transform: `scale(${pulse})` }}>
        ⬭ EXTRACTION PORTAL OPENED ⬭
      </div>
      <div style={styles.portalPopupSub}>
        {count === 1
          ? "1 NEW SITE · WALK INTO IT TO ESCAPE"
          : `${count} NEW SITES · WALK INTO ONE TO ESCAPE`}
      </div>
    </div>
  );
}

/** Arrow at the edge of the screen pointing toward the center of the safe zone.
 *  Positioned in the direction the player needs to move to get back to safety. */
function SafeZoneArrow({ dx, dz }: { dx: number; dz: number }) {
  // Convert world direction (dx, dz) into screen-space angle.
  // Screen +Y is up, world -Z is "forward" into screen, so rotate accordingly.
  // Camera is top-down; dx→screen X, dz→screen Y (positive Y downward on screen).
  const angleDeg = Math.atan2(dx, -dz) * (180 / Math.PI);
  return (
    <div style={{
      position: "absolute",
      top: "50%",
      left: "50%",
      transform: `translate(-50%, -50%) rotate(${angleDeg}deg) translateY(-min(30vh, 220px))`,
      pointerEvents: "none",
      fontSize: 48,
      color: "#c080ff",
      textShadow: "0 0 16px #9040e0, 0 0 32px #7020c0",
      opacity: 0.85,
    }}>
      ▲
    </div>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles: Record<string, React.CSSProperties> = {
  root: {
    position: "absolute",
    inset: 0,
    background: "#04000a",
  },
  hudBanner: {
    position: "absolute",
    top: 16,
    left: "50%",
    transform: "translateX(-50%)",
    padding: "10px 20px",
    background: "rgba(10,15,30,0.7)",
    border: "1px solid rgba(60,140,220,0.4)",
    borderRadius: 8,
    color: "#aadfff",
    fontFamily: "'Segoe UI', monospace",
    textAlign: "center",
    pointerEvents: "none",
  },
  hudTitle: {
    fontSize: 16, fontWeight: 900, letterSpacing: 6,
    textShadow: "0 0 10px rgba(60,140,220,0.6)",
  },
  hudSub: {
    fontSize: 11, letterSpacing: 2, color: "rgba(170,223,255,0.8)", marginTop: 4,
  },
  hudStats: {
    fontSize: 10, letterSpacing: 1, color: "rgba(170,223,255,0.5)", marginTop: 3,
    fontFamily: "monospace",
  },
  hpBox: {
    position: "absolute",
    top: 20,
    left: 20,
    width: 220,
    background: "rgba(0,0,0,0.65)",
    border: "1px solid #333",
    borderRadius: 8,
    padding: "10px 14px",
    backdropFilter: "blur(4px)",
    pointerEvents: "none",
  },
  hpLabel: {
    display: "flex",
    justifyContent: "space-between",
    marginBottom: 4,
    fontSize: 14,
    fontFamily: "monospace",
  },
  hpTrack: {
    width: "100%",
    height: 10,
    background: "#222",
    borderRadius: 5,
    overflow: "hidden",
    border: "1px solid #444",
  },
  hpFill: {
    height: "100%",
    borderRadius: 5,
    transition: "width 0.18s, background 0.2s",
  },
  warriorBox: {
    marginTop: 10,
    padding: "6px 0 0 0",
    borderTop: "1px solid rgba(180,80,40,0.25)",
  },
  warriorRow: {
    display: "flex",
    justifyContent: "space-between",
    marginBottom: 3,
  },
  pipRow: {
    display: "flex",
    gap: 2,
    marginBottom: 4,
  },
  pip: {
    flex: 1,
    height: 5,
    borderRadius: 1,
    background: "#301010",
    transition: "background 0.12s, box-shadow 0.12s",
  },
  timerBox: {
    position: "absolute",
    top: 20,
    right: 20,
    minWidth: 180,
    background: "rgba(10,5,25,0.75)",
    border: "1px solid rgba(140,80,220,0.4)",
    borderRadius: 8,
    padding: "10px 14px",
    backdropFilter: "blur(4px)",
    textAlign: "center",
    pointerEvents: "none",
  },
  timerLabel: {
    fontSize: 9, letterSpacing: 3, color: "rgba(170,140,220,0.8)",
    fontFamily: "monospace", fontWeight: 900,
  },
  timerValue: {
    fontSize: 26, fontWeight: 900, letterSpacing: 4, marginTop: 2,
    fontFamily: "monospace", textShadow: "0 0 10px currentColor",
  },
  timerPhase: {
    fontSize: 9, letterSpacing: 2, color: "rgba(180,150,220,0.7)",
    marginTop: 2, fontFamily: "monospace",
  },
  threatBox: {
    position: "absolute" as const,
    top: 108,
    right: 20,
    minWidth: 180,
    background: "rgba(20,5,10,0.7)",
    border: "1px solid rgba(220,80,80,0.35)",
    borderRadius: 8,
    padding: "8px 14px",
    backdropFilter: "blur(4px)",
    fontFamily: "monospace",
    pointerEvents: "none" as const,
  },
  // Boss HP bar — ported from src/ui/HUD.tsx:622-680. Labyrinth-local
  // (no store reads). Mirrors the main-game colour language so
  // players familiar with the main game recognise the pattern.
  bossBar: {
    position: "absolute" as const,
    bottom: 52,
    left: "50%",
    transform: "translateX(-50%)",
    width: "min(600px, 90vw)",
    background: "rgba(0,0,0,0.75)",
    border: "1px solid #660033",
    borderRadius: 8,
    padding: "10px 14px 8px",
    backdropFilter: "blur(6px)",
    pointerEvents: "none" as const,
    zIndex: 20,
  },
  bossBarHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  bossBarName: {
    color: "#ff44aa",
    fontSize: 15,
    fontWeight: "bold" as const,
    letterSpacing: 2,
    fontFamily: "monospace",
    textShadow: "0 0 6px rgba(255,80,180,0.45)",
  },
  bossWarn: {
    color: "#ff4400",
    fontSize: 13,
    fontWeight: "bold" as const,
    letterSpacing: 1,
    textShadow: "0 0 8px #ff2200",
    fontFamily: "monospace",
  },
  bossBarTrack: {
    width: "100%",
    height: 14,
    background: "#1a0010",
    borderRadius: 7,
    overflow: "hidden" as const,
    border: "1px solid #550022",
  },
  bossBarFill: {
    height: "100%",
    borderRadius: 7,
    background: "linear-gradient(90deg, #8b0050, #ff0066, #cc0044)",
    boxShadow: "0 0 10px #ff0066",
    transition: "width 0.12s ease",
  },
  bossBarFooter: {
    marginTop: 4,
    textAlign: "center" as const,
    fontFamily: "monospace",
  },
  // Key indicator — small "VAULT KEY" pill under the gear strip.
  // Visible once shared.hasKey flips true (champion killed, item 4).
  // Item 7 will hide this when the key is consumed at the loot-room
  // door.
  // Locked-vault prompt — appears centered above the player's HP bar
  // when they're near the vault without a key. Gold/amber palette
  // matches the lock visual on the door.
  lockedPrompt: {
    position: "absolute" as const,
    top: "38%",
    left: "50%",
    transform: "translateX(-50%)",
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "10px 20px",
    background: "linear-gradient(135deg, rgba(50,30,10,0.92), rgba(30,15,0,0.85))",
    border: "1px solid rgba(255,180,60,0.7)",
    borderRadius: 8,
    boxShadow: "0 0 22px rgba(255,170,60,0.45)",
    pointerEvents: "none" as const,
    fontFamily: "monospace",
    transition: "opacity 0.2s",
    zIndex: 20,
  },
  lockedPromptIcon: {
    fontSize: 22,
    textShadow: "0 0 8px rgba(255,200,80,0.8)",
  },
  lockedPromptText: {
    color: "#ffdc8a",
    fontSize: 13,
    fontWeight: 700 as const,
    letterSpacing: 3,
  },
  keyIndicator: {
    position: "absolute" as const,
    top: 248,
    right: 20,
    display: "flex",
    alignItems: "center",
    gap: 6,
    padding: "5px 10px",
    background: "linear-gradient(90deg, rgba(80,40,0,0.85), rgba(120,70,0,0.7))",
    border: "1px solid rgba(255,180,60,0.65)",
    borderRadius: 6,
    boxShadow: "0 0 14px rgba(255,170,60,0.4)",
    fontFamily: "monospace",
    pointerEvents: "none" as const,
  },
  keyIcon: {
    fontSize: 22,
    textShadow: "0 0 8px rgba(255,200,80,0.8)",
  },
  keyLabel: {
    color: "#ffdc8a",
    fontSize: 11,
    fontWeight: "bold" as const,
    letterSpacing: 2,
  },
  // Champion announcement banner — big central banner that fades on
  // spawn. Styling mirrors the main-game boss announcement but with
  // the champion's red-orange palette instead of boss-pink.
  championBanner: {
    position: "absolute" as const,
    top: "22%",
    left: "50%",
    transform: "translateX(-50%)",
    padding: "14px 28px",
    background: "radial-gradient(ellipse at center, rgba(160,40,10,0.82), rgba(60,10,0,0.55) 70%, transparent 100%)",
    borderRadius: 10,
    textAlign: "center" as const,
    pointerEvents: "none" as const,
    transition: "opacity 0.12s linear",
    fontFamily: "monospace",
    zIndex: 30,
  },
  championBannerTop: {
    color: "#ff6030",
    fontSize: 22,
    fontWeight: "bold" as const,
    letterSpacing: 3,
    textShadow: "0 0 12px rgba(255,100,40,0.7)",
  },
  championBannerSub: {
    color: "#ffcc80",
    fontSize: 13,
    letterSpacing: 2,
    marginTop: 4,
    textShadow: "0 0 6px rgba(255,170,80,0.6)",
  },
  gearStrip: {
    position: "absolute" as const,
    top: 300,
    right: 20,
    display: "flex",
    gap: 4,
    padding: "4px",
    background: "rgba(10,5,20,0.7)",
    border: "1px solid rgba(140,100,200,0.35)",
    borderRadius: 6,
    backdropFilter: "blur(4px)",
    pointerEvents: "none" as const,
  },
  gearSlotBox: {
    width: 34,
    height: 34,
    borderRadius: 5,
    border: "2px solid rgba(60,60,80,0.5)",
    background: "rgba(10,8,22,0.8)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 18,
    color: "rgba(120,120,140,0.6)",
    fontFamily: "monospace",
    transition: "border-color 0.15s, box-shadow 0.2s, color 0.15s",
  },
  threatRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "baseline",
    gap: 14,
    padding: "2px 0",
  },
  threatLabel: {
    fontSize: 10, letterSpacing: 2,
    color: "rgba(220,170,170,0.8)", fontWeight: 900,
  },
  threatValue: {
    fontSize: 18, fontWeight: 900, color: "#ff6060",
    textShadow: "0 0 6px rgba(255,80,80,0.55)",
  },
  threatValueAccent: {
    fontSize: 18, fontWeight: 900, color: "#ffcc60",
    textShadow: "0 0 6px rgba(255,200,90,0.55)",
  },
  zoneWarning: {
    position: "absolute",
    top: "28%",
    left: "50%",
    transform: "translateX(-50%)",
    textAlign: "center",
    pointerEvents: "none",
    animation: "zoneWarnPulse 1.2s ease-in-out infinite",
  },
  zoneWarningText: {
    fontSize: 22, fontWeight: 900, letterSpacing: 4, color: "#ff3355",
    textShadow: "0 0 14px #ff0044, 0 0 28px #cc0033",
    textTransform: "uppercase" as const,
  },
  zoneWarningSub: {
    fontSize: 12, letterSpacing: 2, color: "#ffaabb",
    marginTop: 6, fontFamily: "monospace",
  },
  defeatOverlay: {
    position: "absolute",
    inset: 0,
    background: "rgba(20,0,20,0.88)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    backdropFilter: "blur(10px)",
    zIndex: 100,
  },
  defeatPanel: {
    padding: "44px 56px",
    background: "rgba(10,0,18,0.96)",
    border: "1px solid rgba(180,40,80,0.6)",
    borderRadius: 16,
    boxShadow: "0 0 40px rgba(200,30,70,0.35)",
    textAlign: "center",
    minWidth: 360,
  },
  defeatTitle: {
    fontSize: 28, fontWeight: 900, letterSpacing: 6, color: "#ff6688",
    textShadow: "0 0 14px rgba(255,40,80,0.6)", marginBottom: 10,
  },
  defeatSub: {
    fontSize: 13, color: "rgba(255,180,200,0.75)", letterSpacing: 1,
    fontFamily: "monospace", marginBottom: 22, fontStyle: "italic",
  },
  escOverlay: {
    position: "absolute",
    inset: 0,
    background: "rgba(0,0,0,0.75)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    backdropFilter: "blur(6px)",
    zIndex: 100,
    pointerEvents: "auto" as const,
  },
  // Abandon-run confirmation modal. Sits above the pause panel via
  // a higher backdrop alpha + stacked overlay. Blue accent matches
  // the labyrinth pause colour language (vs. main game's purple).
  confirmOverlay: {
    position: "absolute" as const,
    inset: 0,
    background: "rgba(0,0,0,0.82)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    backdropFilter: "blur(8px)",
    zIndex: 110,
    pointerEvents: "auto" as const,
  },
  confirmPanel: {
    padding: "36px 48px",
    background: "rgba(6,10,22,0.98)",
    border: "1px solid rgba(80,160,230,0.55)",
    borderRadius: 14,
    boxShadow: "0 0 40px rgba(60,140,220,0.3), inset 0 0 30px rgba(30,80,140,0.25)",
    display: "flex",
    flexDirection: "column" as const,
    alignItems: "center",
    maxWidth: 420,
  },
  confirmTitle: {
    fontSize: 22,
    fontWeight: 900 as const,
    letterSpacing: 4,
    color: "#bee0ff",
    textShadow: "0 0 14px rgba(100,170,240,0.6)",
    marginBottom: 10,
    fontFamily: "monospace",
  },
  confirmSub: {
    fontSize: 13,
    color: "#7ea8cc",
    letterSpacing: 1.5,
    marginBottom: 22,
    fontFamily: "monospace",
  },
  confirmBtnCol: {
    display: "flex",
    flexDirection: "column" as const,
    gap: 10,
    alignItems: "center",
  },
  // Primary "Stay in Run" — dominant gradient button so the safe
  // choice is visually obvious.
  confirmPrimary: {
    width: 260,
    padding: "14px",
    fontSize: 15,
    fontWeight: "bold" as const,
    letterSpacing: 3,
    color: "#fff",
    background: "linear-gradient(135deg, #1a4480, #0c2850)",
    border: "1px solid rgba(80,160,230,0.7)",
    borderRadius: 8,
    cursor: "pointer",
    fontFamily: "inherit",
    boxShadow: "0 0 20px rgba(60,140,220,0.35)",
  },
  // Destructive "Abandon Run" — dim, smaller, clearly de-prioritised.
  confirmDestructive: {
    width: 200,
    padding: "10px",
    fontSize: 12,
    fontWeight: 600 as const,
    letterSpacing: 2,
    color: "#cc8080",
    background: "rgba(30,10,10,0.6)",
    border: "1px solid rgba(140,40,40,0.5)",
    borderRadius: 6,
    cursor: "pointer",
    fontFamily: "inherit",
  },
  escPanel: {
    padding: "40px 48px",
    background: "rgba(6,3,12,0.95)",
    border: "1px solid rgba(60,140,220,0.5)",
    borderRadius: 16,
    display: "flex",
    flexDirection: "column",
    gap: 12,
    alignItems: "center",
    minWidth: 320,
  },
  escTitle: {
    fontSize: 28, fontWeight: 900, letterSpacing: 8, color: "#aadfff",
    textShadow: "0 0 14px rgba(60,140,220,0.5)", marginBottom: 12,
  },
  escBtn: {
    width: 240, padding: "12px", fontSize: 13, fontWeight: "bold",
    letterSpacing: 2, color: "#aadfff",
    background: "rgba(10,25,50,0.8)",
    border: "1px solid rgba(60,140,220,0.5)",
    borderRadius: 8, cursor: "pointer", fontFamily: "inherit",
  },
  // ─── Character / diagnostic panel ──────────────────────────────
  // Blue-accent to match the labyrinth pause palette. Taller than
  // the default pause panel so the full stat sheet fits on screen;
  // scrollable when content overflows.
  charPanel: {
    padding: "28px 32px",
    background: "rgba(6,10,22,0.98)",
    border: "1px solid rgba(80,160,230,0.55)",
    borderRadius: 14,
    boxShadow: "0 0 40px rgba(60,140,220,0.3), inset 0 0 30px rgba(30,80,140,0.25)",
    width: "min(540px, 94vw)",
    maxHeight: "86vh",
    overflowY: "auto" as const,
    fontFamily: "monospace",
    pointerEvents: "auto" as const,
  },
  charHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  charTitle: {
    fontSize: 22,
    fontWeight: 900 as const,
    letterSpacing: 5,
    color: "#bee0ff",
    textShadow: "0 0 12px rgba(100,170,240,0.5)",
  },
  charBackBtn: {
    fontSize: 11,
    letterSpacing: 2,
    color: "#7ea8cc",
    background: "rgba(10,25,50,0.7)",
    border: "1px solid rgba(60,140,220,0.4)",
    borderRadius: 6,
    padding: "6px 12px",
    cursor: "pointer",
    fontFamily: "inherit",
  },
  charSubHeader: {
    fontSize: 12,
    color: "#7ea8cc",
    letterSpacing: 2,
    marginBottom: 14,
  },
  charSectionTitle: {
    fontSize: 11,
    fontWeight: 700 as const,
    letterSpacing: 3,
    color: "#5a90bc",
    marginTop: 14,
    marginBottom: 8,
    borderBottom: "1px solid rgba(60,140,220,0.2)",
    paddingBottom: 4,
  },
  charEquippedGrid: {
    display: "flex",
    flexDirection: "column" as const,
    gap: 6,
  },
  charEquippedRow: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "6px 10px",
    background: "rgba(10,14,28,0.7)",
    border: "1px solid #2a2030",
    borderRadius: 6,
    fontSize: 12,
  },
  charEquippedLabel: {
    width: 60,
    fontSize: 10,
    letterSpacing: 2,
    color: "#5a708c",
    fontWeight: 700 as const,
  },
  charEquippedName: {
    flex: 1,
    fontSize: 12,
  },
  charEquippedBonuses: {
    display: "flex",
    flexWrap: "wrap" as const,
    gap: 6,
    justifyContent: "flex-end",
  },
  charEquippedBonus: {
    fontSize: 10,
    color: "#90c4e8",
    background: "rgba(30,60,100,0.35)",
    border: "1px solid rgba(80,140,200,0.3)",
    borderRadius: 4,
    padding: "2px 6px",
    letterSpacing: 1,
  },
  charStatsGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "6px 14px",
  },
  charStatRow: {
    padding: "4px 0",
  },
  charStatLabelLine: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "baseline",
    gap: 8,
  },
  charStatLabel: {
    fontSize: 11,
    color: "#8fa8c0",
    letterSpacing: 1,
  },
  charStatValue: {
    fontSize: 13,
    color: "#d8e8f8",
    fontWeight: 700 as const,
  },
  charStatHint: {
    fontSize: 9,
    color: "#506a84",
    letterSpacing: 0.5,
    marginTop: 1,
  },
  charEmpty: {
    fontSize: 11,
    color: "#506a84",
    fontStyle: "italic" as const,
    padding: "8px 0",
  },
  charResumeBtn: {
    marginTop: 20,
    width: "100%",
    padding: "12px",
    fontSize: 14,
    fontWeight: 700 as const,
    letterSpacing: 3,
    color: "#fff",
    background: "linear-gradient(135deg, #1a4480, #0c2850)",
    border: "1px solid rgba(80,160,230,0.7)",
    borderRadius: 8,
    cursor: "pointer",
    fontFamily: "inherit",
    boxShadow: "0 0 16px rgba(60,140,220,0.3)",
  },
  // ─── Inventory section ────────────────────────────────────────
  charInventoryList: {
    display: "flex",
    flexDirection: "column" as const,
    gap: 5,
  },
  charInventoryRow: {
    display: "grid",
    gridTemplateColumns: "1fr auto auto",
    alignItems: "center",
    gap: 10,
    padding: "6px 10px",
    background: "rgba(10,14,28,0.7)",
    border: "1px solid #2a2030",
    borderRadius: 6,
  },
  charInventoryName: {
    fontSize: 12,
    gridColumn: "1",
  },
  charInventoryBonuses: {
    display: "flex",
    flexWrap: "wrap" as const,
    gap: 4,
    justifyContent: "flex-end",
    gridColumn: "2",
  },
  charInventoryActions: {
    display: "flex",
    gap: 4,
    gridColumn: "3",
  },
  charInvBtnEquip: {
    fontSize: 10,
    letterSpacing: 1.5,
    color: "#bee0ff",
    background: "rgba(20,50,100,0.6)",
    border: "1px solid rgba(80,160,230,0.5)",
    borderRadius: 4,
    padding: "4px 8px",
    cursor: "pointer",
    fontFamily: "inherit",
    fontWeight: 700 as const,
  },
  charInvBtnSell: {
    fontSize: 10,
    letterSpacing: 1.5,
    color: "#ffb080",
    background: "rgba(50,30,10,0.6)",
    border: "1px solid rgba(200,120,50,0.4)",
    borderRadius: 4,
    padding: "4px 8px",
    cursor: "pointer",
    fontFamily: "inherit",
    fontWeight: 700 as const,
  },
  charInventoryHint: {
    fontSize: 10,
    color: "#506a84",
    fontStyle: "italic" as const,
    marginTop: 6,
    textAlign: "center" as const,
  },
  poisonBox: {
    position: "absolute",
    top: 100,
    left: 20,
    width: 220,
    background: "rgba(0,20,10,0.65)",
    border: "1px solid rgba(74,222,128,0.35)",
    borderRadius: 8,
    padding: "8px 12px",
    backdropFilter: "blur(4px)",
    pointerEvents: "none",
  },
  poisonLabel: {
    display: "flex",
    justifyContent: "space-between",
    marginBottom: 6,
    fontSize: 12,
    fontFamily: "monospace",
    letterSpacing: 1,
  },
  poisonPipRow: {
    display: "flex",
    gap: 6,
    justifyContent: "flex-start",
  },
  // Portal spawn banner — beefed up in item 5/8. Larger title,
  // double-ring border, stronger glow, bigger footprint than the
  // original subtle popup.
  portalPopup: {
    position: "absolute" as const,
    top: "15%",
    left: "50%",
    transform: "translateX(-50%)",
    padding: "18px 42px",
    background: "radial-gradient(ellipse at center, rgba(60,20,100,0.92), rgba(20,0,40,0.82) 80%)",
    border: "2px solid rgba(200,120,255,0.8)",
    borderRadius: 12,
    boxShadow: "0 0 30px rgba(180,100,255,0.6), inset 0 0 18px rgba(120,60,200,0.45)",
    pointerEvents: "none" as const,
    textAlign: "center" as const,
    transition: "opacity 0.15s",
    zIndex: 25,
    fontFamily: "monospace",
  },
  portalPopupTitle: {
    fontSize: 26,
    fontWeight: 900 as const,
    letterSpacing: 5,
    color: "#f0d0ff",
    textShadow: "0 0 16px rgba(220,140,255,0.9), 0 0 32px rgba(160,80,240,0.7)",
  },
  portalPopupSub: {
    fontSize: 13,
    letterSpacing: 3,
    color: "#e0b8ff",
    marginTop: 8,
    fontFamily: "monospace",
    textShadow: "0 0 8px rgba(200,140,255,0.6)",
  },
  extractedOverlay: {
    position: "absolute",
    inset: 0,
    background: "rgba(8,0,20,0.88)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    backdropFilter: "blur(10px)",
    zIndex: 100,
  },
  extractedPanel: {
    padding: "44px 56px",
    background: "rgba(14,6,28,0.96)",
    border: "1px solid rgba(160,80,255,0.65)",
    borderRadius: 16,
    boxShadow: "0 0 40px rgba(160,80,255,0.4)",
    textAlign: "center" as const,
    minWidth: 400,
  },
  extractedTitle: {
    fontSize: 32,
    fontWeight: 900,
    letterSpacing: 8,
    color: "#d0a0ff",
    textShadow: "0 0 14px rgba(200,120,255,0.8), 0 0 28px rgba(120,60,200,0.6)",
    marginBottom: 12,
  },
  extractedSub: {
    fontSize: 13,
    color: "rgba(220,180,255,0.8)",
    letterSpacing: 1,
    fontFamily: "monospace",
    marginBottom: 14,
    fontStyle: "italic" as const,
  },
  extractedStats: {
    fontSize: 12,
    color: "rgba(160,200,255,0.85)",
    letterSpacing: 3,
    fontFamily: "monospace",
    marginBottom: 22,
  },
};

// Suppress unused-import lint (reserved for step 2+ collision refinement).
void worldToCell; void WALL_N; void WALL_E; void WALL_S; void WALL_W;
