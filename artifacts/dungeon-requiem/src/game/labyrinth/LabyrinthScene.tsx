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
import * as THREE from "three";
import { useGameStore } from "../../store/gameStore";
import { InputManager3D } from "../InputManager3D";
import {
  LABYRINTH_CONFIG,
  LABYRINTH_HALF,
} from "./LabyrinthConfig";
import {
  generateMaze,
  cellToWorld,
  worldToCell,
  extractWallSegments,
  type Maze,
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
  updateEnemy,
  damageEnemy,
  isEnemyEvictable,
  makeShadowStalker,
  findStalkerSpawnCell,
  makeCorridorGuardianAt,
  makeChampion,
  findChampionSpawnCell,
  type EnemyRuntime,
} from "./LabyrinthEnemy";
import {
  makeWarden,
  updateWarden,
  shouldSpawnWarden,
  clearWardenState,
  getWardenState,
} from "./LabyrinthWarden";
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
  type LabProgressionState,
} from "./LabyrinthProgression";
import { XPOrb3D } from "../../entities/XPOrb3D";
import type { XPOrb } from "../GameScene";
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
  type LabProjectile,
} from "./LabyrinthProjectile";
import { LabyrinthProjectiles3D } from "./LabyrinthProjectile3D";
import {
  makeRangedAttackState,
  tickRangedAttack,
  tryFireMageOrb,
  tryFireRogueFan,
  type RangedAttackState,
} from "./LabyrinthRangedAttack";
import {
  makeLabGearState,
  rollLabGearDrop,
  spawnLabGearDrop,
  tickLabGearDrops,
  equipLabGear,
  salvageLabGear,
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
}

/** Shared state read by HUD (polling) and mutated by Canvas useFrame. */
interface LabSharedState {
  zone: ZoneState;
  /** true once HP <= 0 or zone has fully closed on player. */
  defeated: boolean;
  /** true once the player has used an extraction portal (win condition). */
  extracted: boolean;
  /** true once the Warden has been slain (alternate win condition). */
  victory: boolean;
  /** true once a warden has been spawned this run (prevents re-spawn). */
  wardenSpawned: boolean;
  /** true once the champion (Nemesis-style mini-boss) has spawned.
   *  Only one per run. See item 4. */
  championSpawned: boolean;
  /** true once the champion has been killed AND dropped the key.
   *  Flipped false when the key is consumed at the loot-door (item 7). */
  hasKey: boolean;
  /** true once the player has opened the loot-room door by walking
   *  into it with hasKey=true. Consumes the key (sets hasKey=false)
   *  and signals CombatEnemyLoop to spawn the guaranteed epic gear
   *  payload inside the room. Persistent for the rest of the run so
   *  the door stays open. */
  lootRoomUnlocked: boolean;
  /** One-shot trigger from MovementLoop → CombatEnemyLoop to spawn
   *  the loot-room's gear payload. Set true the frame the door
   *  unlocks; the combat loop consumes it by rolling 3 epic gear
   *  drops inside the room and setting it back to false. */
  pendingLootSpawn: boolean;
  /** Elapsed-seconds timestamp of the most recent champion spawn.
   *  Drives the "A CHAMPION HUNTS YOU" HUD banner (fades over 3.5s). */
  championAnnouncedAt: number;
  /** HUD boss-bar snapshot. null while no warden exists; populated
   *  on spawn and mutated each frame by CombatEnemyLoop. alive flips
   *  false on warden kill — the HUD reads this to hide the bar. */
  wardenHud: {
    alive: boolean;
    hp: number;
    maxHp: number;
    name: string;
    specialWarn: boolean;
  } | null;
  /** true if the player is currently outside the safe zone. */
  outsideZone: boolean;
  /** World direction TO the safe-zone center from the player, normalized. */
  safeDirX: number;
  safeDirZ: number;
  /** Shroud poison-stack count (0..LAB_POISON_MAX_STACKS), for HUD display. */
  poisonStacks: number;
  /** Per-stack DPS — so the HUD can show an indicator of upgrade scaling. */
  poisonDps: number;
  /** Live portal list (mirrored for HUD — direction arrow + popups). */
  portals: ExtractionPortal[];
  /** Milestone indices that have already spawned their portals. */
  spawnedMilestones: Set<number>;
  /** Timestamp (sec elapsed) of the most recent portal spawn burst —
   *  drives the HUD "EXTRACTION PORTAL OPENED" popup. */
  lastPortalPopupSec: number;
  /** Count of portals spawned in the most recent burst (for the popup). */
  lastPortalPopupCount: number;
  /** Live enemy count (alive + fading). Mirrored for HUD. */
  enemyCount: number;
  /** Total enemies killed this run — shown on HUD / victory screens. */
  killCount: number;
  /** Current player level (mirrored from LabProgressionState for HUD). */
  level: number;
  /** XP progress toward the next level. */
  xp: number;
  xpToNext: number;
  /** Cumulative XP earned this run. */
  totalXp: number;
  /** Warrior-only passives snapshot — null for non-warrior classes. */
  warrior: {
    momentumStacks: number;
    momentumMult: number;
    warCryActive: boolean;
    warCrySec: number;
    bloodforgeGain: number;
    bloodforgeCap: number;
  } | null;
  /** Currently-equipped gear by slot. Mirrored here so the HUD polling
   *  loop can render equipped-slot icons without piercing the canvas
   *  boundary. */
  equipped: {
    weapon: GearDef | null;
    armor: GearDef | null;
    trinket: GearDef | null;
  };
}

// ─── Root React component ─────────────────────────────────────────────────────

export function LabyrinthScene() {
  // Generate maze once per scene mount — each run gets a fresh maze.
  const maze = useMemo(() => generateMaze(), []);

  // Class picked in the character-select step before landing here. The
  // store defaults to "warrior" so direct-to-labyrinth (eg. deep link,
  // old flow) still works. Labyrinth-specific locks are handled in
  // LabyrinthCharSelect — this component just reads whatever was set.
  const selectedClass = useGameStore((s) => s.selectedClass) as CharacterClass;
  const classDef = CHARACTER_DATA[selectedClass];

  // Combat stats derived from the class definition. Labyrinth mode
  // reduces weapon range by 25% vs the main game — tighter melee
  // arcs and shorter projectile ranges tune the tight corridor
  // combat where the main-game's wide-open-arena ranges feel too
  // generous. Same shape as combatStats so the combat system code
  // is unchanged.
  const LABYRINTH_RANGE_MULT = 0.75;
  const combatStats: LabCombatStats = useMemo(() => ({
    damage: classDef.damage,
    atkRange: classDef.attackRange * LABYRINTH_RANGE_MULT,
    // attackSpeed is in swings-per-second in CharacterData; convert
    // to seconds-per-swing for atkCooldown.
    atkCooldown: 1 / Math.max(0.01, classDef.attackSpeed),
  }), [classDef]);

  // InputManager lives at the scene level so both the R3F Canvas and the
  // mobile-touch overlay (which is outside Canvas) can share it.
  const inputRef = useRef<InputManager3D | null>(null);
  if (!inputRef.current) inputRef.current = new InputManager3D();

  // Shared player + zone state. The Canvas useFrame loop writes to this;
  // the HUD polls it on an interval so we don't re-render React at 60fps.
  const playerRef = useRef<LabPlayer>({
    x: 0, z: 0, angle: 0, vx: 0, vz: 0,
    hp: classDef.hp, maxHp: classDef.hp,
    isDashing: false,
  });
  const labDashRef = useRef<LabDashState>(makeLabDashState());
  const sharedRef = useRef<LabSharedState>({
    zone: computeZoneState(0),
    defeated: false,
    extracted: false,
    victory: false,
    wardenSpawned: false,
    wardenHud: null,
    championSpawned: false,
    hasKey: false,
    lootRoomUnlocked: false,
    pendingLootSpawn: false,
    championAnnouncedAt: -Infinity,
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
  });
  const labPoisonRef = useRef<LabPoisonState>(makeLabPoisonState());
  const attackStateRef = useRef<PlayerAttackState>(makePlayerAttackState());
  const deathFxRef = useRef<LabDeathFx[]>([]);
  const groundFxRef = useRef<LabGroundFx[]>([]);
  const shroudMistRef = useRef<LabShroudMistEmitter>(makeShroudMistEmitter());
  const progressionRef = useRef<LabProgressionState>(makeLabProgression());
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
  const lootRoomCell = useMemo(() => {
    const center = maze.center;
    const outerDeadEnds = maze.deadEnds.filter((c) => {
      const dc = Math.abs(c.col - center.col);
      const dr = Math.abs(c.row - center.row);
      return Math.max(dc, dr) >= LABYRINTH_CONFIG.OUTER_RING_MIN;
    });
    // Degenerate fallback: any dead-end, then any cell. A 21x21 maze
    // with LOOP_FACTOR=0.15 will always have plenty of outer dead-ends
    // but this is free insurance.
    const pool = outerDeadEnds.length > 0 ? outerDeadEnds : maze.deadEnds;
    if (pool.length === 0) return maze.spawn;
    return pool[Math.floor(Math.random() * pool.length)];
  }, [maze]);
  // Wall-to-wall traps. Spawned once per run at scene mount (same as
  // enemies), kept in a ref (stationary state machines — no React
  // re-render needed for their phase changes; their emitter visuals
  // poll phase directly each frame via useFrame).
  const trapsRef = useRef<LabTrap[]>([]);
  if (trapsRef.current.length === 0) {
    trapsRef.current = spawnLabTraps(maze, LABYRINTH_CONFIG.WALL_TRAP_COUNT);
  }
  // Loot chests — treasure (60%), trapped (25%), mimic (15%). Each
  // consumed chest is marked state="consumed" and evicted lazily.
  const chestsRef = useRef<LabChest[]>([]);
  if (chestsRef.current.length === 0) {
    chestsRef.current = spawnLabChests(maze, LABYRINTH_CONFIG.LOOT_CHEST_COUNT);
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
    enemiesRef.current = [...guardians, ...turrets];
    sharedRef.current.enemyCount = enemiesRef.current.length;
  }
  const runStartMs = useRef(performance.now());

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
          combatStats={combatStats}
          inputRef={inputRef}
          playerRef={playerRef}
          sharedRef={sharedRef}
          labPoisonRef={labPoisonRef}
          attackStateRef={attackStateRef}
          labDashRef={labDashRef}
          dashCooldownSec={classDef.dashCooldown}
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
          lootRoomCell={lootRoomCell}
          critChance={classDef.critChance}
          runStartMs={runStartMs}
        />
      </Canvas>
      <LabyrinthHUD
        maze={maze}
        playerRef={playerRef}
        sharedRef={sharedRef}
      />
      <LabyrinthMobileControls inputRef={inputRef} aimOverrideRef={aimOverrideRef} />
      <LabyrinthDebug
        playerRef={playerRef}
        sharedRef={sharedRef}
        attackStateRef={attackStateRef}
        labDashRef={labDashRef}
      />
    </div>
  );
}

// ─── 3D world contents ────────────────────────────────────────────────────────

function LabyrinthWorld({
  maze,
  charClass,
  combatStats,
  inputRef,
  playerRef,
  sharedRef,
  labPoisonRef,
  attackStateRef,
  labDashRef,
  dashCooldownSec,
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
  lootRoomCell,
  critChance,
  runStartMs,
}: {
  maze: Maze;
  charClass: CharacterClass;
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
  lootRoomCell: { col: number; row: number };
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
      <ambientLight intensity={1.4} color="#a090c8" />
      <hemisphereLight args={["#b0a0e0", "#20103a", 0.7]} />
      <directionalLight
        position={[30, 50, 20]}
        intensity={1.8}
        color="#d0b0e8"
      />
      <PlayerTorch playerRef={playerRef} />
      <fog attach="fog" args={["#100820", 50, 140]} />

      {/* Each visual subsystem is wrapped in an error boundary so a
          silent throw in one (e.g. a shader, material, or geometry
          failing to init on iOS) doesn't blank out the whole Canvas.
          The boundaries log to the browser console AND leave the rest
          of the scene visible, so a partial scene is visible instead
          of a fully black canvas. */}
      <LabyrinthCanvasErrorBoundary label="Map3D" fallback={null}>
        <LabyrinthMap3D maze={maze} />
      </LabyrinthCanvasErrorBoundary>
      <LabyrinthCanvasErrorBoundary label="Zone3D" fallback={null}>
        <LabyrinthZone3D radius={currentRadius} isPaused={paused} />
      </LabyrinthCanvasErrorBoundary>
      <LabyrinthCanvasErrorBoundary label="Portals3D" fallback={null}>
        <LabyrinthPortals3D portals={portalList} />
      </LabyrinthCanvasErrorBoundary>
      {/* Enemy renderer is wrapped in an error boundary so a shim-side
          crash can't cascade and blank out the rest of the Canvas. If
          it fails, enemies are invisible (a known degradation) but
          walls, player, and HUD still render. */}
      <LabyrinthCanvasErrorBoundary label="Enemies3D" fallback={null}>
        <LabyrinthEnemies3D enemies={enemyList} playerRef={playerRef} />
      </LabyrinthCanvasErrorBoundary>
      {/* Death-burst renderer — independent of Enemies3D so even if the
          enemy visuals error out, the kill-feedback particles still play
          (they read only from deathFxList, not from GameState). */}
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
        unlocked={lootRoomUnlockedFlag}
      />
      {/* Active projectiles — wall-trap beams, enemy turret shots,
          warden starburst, mage orbs, rogue daggers. Uses the main
          game's Projectile3D via a shim-cast in LabyrinthProjectiles3D. */}
      <LabyrinthProjectiles3D projectiles={projectileList} />
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

// Bright point light that follows the player — so you can always see
// yourself clearly against the dark floor.
function PlayerTorch({ playerRef }: { playerRef: React.MutableRefObject<LabPlayer> }) {
  const lightRef = useRef<THREE.PointLight>(null);
  useFrame(() => {
    if (!lightRef.current) return;
    const p = playerRef.current;
    lightRef.current.position.set(p.x, 8, p.z);
  });
  return (
    <pointLight
      ref={lightRef}
      intensity={5.5}
      color="#ffe0ff"
      distance={28}
      decay={1.4}
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
        <group ref={weaponRef} position={[0.1, -0.45, 0]}>
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
}: {
  playerRef: React.MutableRefObject<LabPlayer>;
  maze: Maze;
  inputRef: React.MutableRefObject<InputManager3D | null>;
  sharedRef: React.MutableRefObject<LabSharedState>;
  labDashRef: React.MutableRefObject<LabDashState>;
  dashCooldownSec: number;
  gearStateRef: React.MutableRefObject<LabGearState>;
  lootRoomCell: { col: number; row: number };
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
    const BASE_WALK_SPEED = 5.0;
    const moveBonus = Math.min(6, gearStateRef.current.bonuses.moveSpeed ?? 0);
    const WALK_SPEED = BASE_WALK_SPEED + moveBonus;
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
      const dx = p.x - lootCellWorld.x;
      const dz = p.z - lootCellWorld.z;
      const dsq = dx * dx + dz * dz;
      if (dsq < LOCK_R * LOCK_R) {
        if (sharedRef.current.hasKey) {
          // Unlock — key is consumed, gear spawn pending, door visual
          // flips via the sharedRef flag polled by the HUD + 3D scene.
          sharedRef.current.lootRoomUnlocked = true;
          sharedRef.current.hasKey = false;
          sharedRef.current.pendingLootSpawn = true;
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
}) {
  const segments = useMemo(() => extractWallSegments(maze), [maze]);
  // Tracks the last death-fx list length we pushed to React state so we
  // don't re-render on every frame just because the tick ran.
  const lastEmittedFxLen = useRef(0);
  // Same pattern for the XP-orb render mirror.
  const lastEmittedOrbLen = useRef(0);
  // And for projectiles.
  const lastEmittedProjLen = useRef(0);
  // Shadow-stalker spawn countdown. Starts at the interval so the first
  // stalker appears after the first interval rather than at spawn.
  const stalkerSpawnTimer = useRef(LABYRINTH_CONFIG.SHADOW_STALKER_INTERVAL_SEC);
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
      if (total > 0) {
        useMetaStore.getState().addShards(total);
      }
    }
    if (shared.defeated || shared.extracted || shared.victory) return;
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
    const effectiveAtkSpeed = Math.max(0.1, baseAtkSpeed + (gearBonuses.attackSpeed ?? 0));
    const effectiveStats: LabCombatStats = {
      damage: combatStats.damage + (gearBonuses.damage ?? 0),
      atkRange: combatStats.atkRange,
      atkCooldown: 1 / effectiveAtkSpeed,
    };
    const effectiveCrit = critChance + (gearBonuses.critChance ?? 0);
    const isRogue = charClass === "rogue";
    if (isWarrior) tickLabWarrior(warriorStateRef.current, delta);
    if (!isWarrior) tickRangedAttack(rangedAttackStateRef.current, delta);

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
    const autoAimRange = isWarrior
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
      if (isWarrior) {
        if (tryStartSwing(atk, aimAngle, effectiveStats)) {
          audioManager.play("attack_melee");
          for (const e of enemies) {
            if (e.state === "dead") continue;
            if (isInSwingArc(p.x, p.z, atk.swingAngle, e.x, e.z, atk.swingRange)) {
              const dmg = modifyOutgoingDamage(warriorStateRef.current, effectiveStats.damage, effectiveCrit);
              const killed = damageEnemy(e, dmg);
              registerHit(warriorStateRef.current);
              if (killed) {
                shared.killCount++;
                audioManager.play("enemy_death");
                spawnLabDeathFx(deathFxRef.current, e.x, e.z, e.kind === "warden" ? "#ff40ff" : "#ff3030");
                spawnLabXpOrb(xpOrbsRef.current, e.x, e.z);
                // Bonus loot roll — mirrors the treasure-chest payout.
                const loot = rollEnemyLoot(xpOrbsRef.current, e.kind, e.x, e.z);
                if (loot.rolled) {
                  audioManager.play("gear_drop");
                  if (loot.healOnPickup > 0) {
                    p.hp = Math.min(p.maxHp, p.hp + loot.healOnPickup);
                  }
                }
                // Gear drop roll — uses main-game tryRollGear() via the
                // labyrinth wrapper. Separate from the XP-orb loot above.
                const gearRoll = rollLabGearDrop(e.kind);
                if (gearRoll) {
                  spawnLabGearDrop(gearDropsRef.current, gearRoll, e.x, e.z);
                }
                const gained = registerKill(warriorStateRef.current);
                if (gained > 0) {
                  p.maxHp += gained;
                  p.hp = Math.min(p.maxHp, p.hp + gained);
                }
                if (e.kind === "warden") {
                  shared.victory = true;
                  clearWardenState(e.id);
                  audioManager.play("wave_clear");
                }
                if (e.kind === "champion") {
                  // Drop the loot-room key. Item 7 will add a visible
                  // key pickup + unlock interaction; for now we flag
                  // the shared state directly so the HUD can show
                  // "KEY" and the upcoming loot-room logic can read
                  // it off sharedRef.
                  shared.hasKey = true;
                  audioManager.play("wave_clear");
                }
              }
            }
          }
        }
      } else if (isMage) {
        if (tryFireMageOrb(rangedAttackStateRef.current, projectilesRef.current, p.x, p.z, aimAngle)) {
          audioManager.play("attack_orb");
        }
      } else if (isRogue) {
        if (tryFireRogueFan(rangedAttackStateRef.current, projectilesRef.current, p.x, p.z, aimAngle)) {
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
    for (const e of enemies) {
      if (e.state === "dead") { updateEnemy(e, p.x, p.z, segments, delta, enemies, dmgAccum, projectilesRef.current); continue; }
      if (e.kind === "warden") {
        updateWarden(
          e, p.x, p.z, delta,
          dmgAccum,
          projectilesRef.current,
          (mx, mz) => enemies.push(makeCorridorGuardianAt(mx, mz)),
        );
      } else {
        updateEnemy(e, p.x, p.z, segments, delta, enemies, dmgAccum, projectilesRef.current);
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
      onEnemyKilled: (e) => {
        shared.killCount++;
        audioManager.play("enemy_death");
        spawnLabDeathFx(deathFxRef.current, e.x, e.z, e.kind === "warden" ? "#ff40ff" : "#ff3030");
        spawnLabXpOrb(xpOrbsRef.current, e.x, e.z);
        const loot = rollEnemyLoot(xpOrbsRef.current, e.kind, e.x, e.z);
        if (loot.rolled) {
          audioManager.play("gear_drop");
          if (loot.healOnPickup > 0) {
            p.hp = Math.min(p.maxHp, p.hp + loot.healOnPickup);
          }
        }
        // Gear drop roll — also fires on ranged kills.
        const gearRoll = rollLabGearDrop(e.kind);
        if (gearRoll) {
          spawnLabGearDrop(gearDropsRef.current, gearRoll, e.x, e.z);
        }
        if (isWarrior) {
          const gained = registerKill(warriorStateRef.current);
          if (gained > 0) {
            p.maxHp += gained;
            p.hp = Math.min(p.maxHp, p.hp + gained);
          }
        }
        if (e.kind === "warden") {
          shared.victory = true;
          clearWardenState(e.id);
          audioManager.play("wave_clear");
        }
        if (e.kind === "champion") {
          shared.hasKey = true;
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
      p.hp = Math.max(0, p.hp - dmgAccum.value);
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

    // 7) XP orbs — pickup detection + collect-animation tick, then
    //    award any XP to progression. On level-up: bump maxHp by +5,
    //    heal the player to full, and play the level-up SFX.
    const orbPrevLen = xpOrbsRef.current.length;
    const orbTick = tickLabXpOrbs(xpOrbsRef.current, p.x, p.z, delta);
    if (orbTick.awardedXp > 0) {
      audioManager.play("xp_pickup");
      addLabXp(progressionRef.current, orbTick.awardedXp);
      while (progressionRef.current.pendingLevelUps > 0) {
        progressionRef.current.pendingLevelUps -= 1;
        // Flat per-level growth — matches the warrior's CLASS_GROWTH
        // (ProgressionManager.ts:54-66 → +3 HP per level). Heal to
        // full on level-up, same as the main game.
        p.maxHp += 3;
        p.hp = p.maxHp;
        audioManager.play("level_up");
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
      p.hp = Math.min(p.maxHp, p.hp + regenPerSec * delta);
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
          enemies.push(makeShadowStalker(spawnPos.x, spawnPos.z));
          onEnemiesChange(enemies.slice());
          shared.enemyCount = enemies.filter((e) => e.state !== "dead").length;
        }
      }
      stalkerSpawnTimer.current = LABYRINTH_CONFIG.SHADOW_STALKER_INTERVAL_SEC;
    }

    // 7a-b) Champion (Nemesis) spawn. Exactly one per run, triggered
    //       at elapsed >= 60 s so the player has time to explore and
    //       equip some gear first. Spawns at a far-from-player outer-
    //       ring dead-end. On spawn: set championSpawned flag + seed
    //       the announcement timestamp + play boss_spawn SFX.
    if (!shared.championSpawned && shared.zone.elapsedSec >= 60) {
      const spawnPos = findChampionSpawnCell(maze, p.x, p.z);
      if (spawnPos) {
        enemies.push(makeChampion(spawnPos.x, spawnPos.z));
        onEnemiesChange(enemies.slice());
        shared.enemyCount = enemies.filter((e) => e.state !== "dead").length;
        shared.championSpawned = true;
        shared.championAnnouncedAt = shared.zone.elapsedSec;
        audioManager.play("boss_spawn");
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
          p.hp = Math.min(p.maxHp, p.hp + amount);
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
    //     On pickup: auto-equip (or swap, dropping the old piece back
    //     to the ground for another 12 s lifetime). equipLabGear()
    //     recomputes bonuses IMMEDIATELY so the next frame's combat
    //     tick reads the fresh values.
    const gearTick = tickLabGearDrops(gearDropsRef.current, delta, p.x, p.z);
    if (gearTick.pickedUp) {
      audioManager.play("gear_drop");
      const { oldGear, maxHealthDelta } = equipLabGear(gearStateRef.current, gearTick.pickedUp);
      if (maxHealthDelta !== 0) {
        p.maxHp += maxHealthDelta;
        p.hp = Math.min(p.maxHp, p.hp + maxHealthDelta);
      }
      if (oldGear) {
        // Drop the old piece slightly offset so its ground drop doesn't
        // clip on top of the player and immediately re-pick up.
        spawnLabGearDrop(gearDropsRef.current, oldGear, p.x + 1.2, p.z + 1.2);
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

    const elapsedSec = (performance.now() - runStartMs.current) / 1000;
    const zone = computeZoneState(elapsedSec);
    shared.zone = zone;

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
    groundFxRef.current = survivors;
    if (survivors.length !== prevFxLen) {
      lastEmittedGroundFxLen.current = survivors.length;
      onGroundFxChange(survivors.slice());
    }

    // ── Warden spawn ────────────────────────────────────────────────────
    // Gated by BOTH elapsed time (>= 5min) AND zone radius (< 50% of
    // initial). Spawns once at the centre chamber; shared.wardenSpawned
    // prevents re-spawn after he's killed.
    if (shouldSpawnWarden(elapsedSec, zone.radius, ZONE_INITIAL_RADIUS, shared.wardenSpawned)) {
      const warden = makeWarden(maze);
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

    // ── Portal milestones ──────────────────────────────────────────────
    // Spawn a burst when elapsedSec crosses each milestone threshold.
    let portalsChanged = false;
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

    // ── Portal collision (extraction) ──────────────────────────────────
    for (const portal of shared.portals) {
      if (portalCollision(p.x, p.z, portal)) {
        shared.extracted = true;
        // Freeze the player in place at the portal center for visual
        // consistency with the victory screen.
        p.x = portal.x;
        p.z = portal.z;
        break;
      }
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
  playerRef,
  sharedRef,
}: {
  maze: Maze;
  playerRef: React.MutableRefObject<LabPlayer>;
  sharedRef: React.MutableRefObject<LabSharedState>;
}) {
  const setPhase = useGameStore((s) => s.setPhase);
  const [esc, setEsc] = useState(false);
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
    hasKey: false,
    championAnnouncedAt: -Infinity,
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
        hasKey: s.hasKey,
        championAnnouncedAt: s.championAnnouncedAt,
      });
    }, 100);
    return () => clearInterval(iv);
  }, [playerRef, sharedRef]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "Escape") setEsc((v) => !v);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const exit = useCallback(() => setPhase("menu"), [setPhase]);

  const hpPct = Math.max(0, (display.hp / display.maxHp) * 100);
  const hpColor = hpPct > 60 ? "#22cc55" : hpPct > 30 ? "#ff8800" : "#cc2222";

  return (
    <>
      {/* Top: mode title */}
      <div style={styles.hudBanner}>
        <div style={styles.hudTitle}>THE LABYRINTH</div>
        <div style={styles.hudStats}>
          {maze.size}×{maze.size} maze · {maze.deadEnds.length} dead ends
        </div>
      </div>

      {/* Top-left: HP bar */}
      <div style={styles.hpBox}>
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
        {display.warrior && (
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

      {/* Top-right: zone timer */}
      <div style={styles.timerBox}>
        <div style={styles.timerLabel}>ZONE CLOSES IN</div>
        <div style={{
          ...styles.timerValue,
          color: display.timeRemaining < 120 ? "#ff4444" : "#c080ff",
        }}>
          {formatZoneTime(display.timeRemaining)}
        </div>
        <div style={styles.timerPhase}>
          {display.isPaused ? "◦ PAUSED" : "▼ SHRINKING"}
        </div>
      </div>

      {/* Below the timer: threat readout (live enemies + kills) */}
      <div style={styles.threatBox}>
        <div style={styles.threatRow}>
          <span style={styles.threatLabel}>THREATS</span>
          <span style={styles.threatValue}>{display.enemyCount}</span>
        </div>
        <div style={styles.threatRow}>
          <span style={styles.threatLabel}>KILLS</span>
          <span style={styles.threatValueAccent}>{display.killCount}</span>
        </div>
      </div>

      {/* Equipped-gear slots — three icons (weapon / armor / trinket)
          with rarity-color borders. Rendered under the threat box. */}
      <GearSlotStrip equipped={display.equipped} />

      {/* Key icon — only visible once the champion has been slain.
          Item 7 will add the loot-room unlock that consumes this. */}
      {display.hasKey && (
        <div style={styles.keyIndicator}>
          <span style={styles.keyIcon}>🗝</span>
          <span style={styles.keyLabel}>VAULT KEY</span>
        </div>
      )}

      {/* Champion arrival banner — fades in/out over 3.5 s from the
          spawn timestamp. Red-orange to match the champion palette. */}
      <ChampionBanner
        elapsedSec={display.elapsedSec}
        announcedAt={display.championAnnouncedAt}
      />

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

      {/* Nearest-portal edge arrow (gold/purple) — separate from the safe-zone arrow */}
      {display.hasPortal && !display.defeated && !display.extracted && (
        <PortalArrow
          dx={display.nearestPortalDirX}
          dz={display.nearestPortalDirZ}
          popupAtSec={display.lastPortalPopupSec}
          elapsedSec={display.elapsedSec}
        />
      )}

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

      {/* Warden-slain victory screen — takes precedence over everything */}
      {display.victory && (
        <div style={styles.extractedOverlay}>
          <div style={styles.extractedPanel}>
            <div style={{ ...styles.extractedTitle, color: "#ff60ff" }}>
              ⚔ WARDEN SLAIN
            </div>
            <div style={styles.extractedSub}>
              The vault's keeper is dead. The labyrinth is yours.
            </div>
            <div style={styles.extractedStats}>
              TIME · {formatZoneTime(display.elapsedSec)} · KILLS · {display.killCount}
            </div>
            <button style={styles.escBtn} onClick={exit}>
              ⌂ RETURN TO MAIN MENU
            </button>
          </div>
        </div>
      )}

      {/* Extracted (portal win) screen */}
      {display.extracted && !display.victory && (
        <div style={styles.extractedOverlay}>
          <div style={styles.extractedPanel}>
            <div style={styles.extractedTitle}>⬭ EXTRACTED</div>
            <div style={styles.extractedSub}>
              You escaped the labyrinth. The vault lets you pass.
            </div>
            <div style={styles.extractedStats}>
              TIME SURVIVED · {formatZoneTime(display.elapsedSec)}
            </div>
            <button style={styles.escBtn} onClick={exit}>
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

      {/* Pause */}
      {esc && !display.defeated && (
        <div style={styles.escOverlay}>
          <div style={styles.escPanel}>
            <div style={styles.escTitle}>PAUSED</div>
            <button style={styles.escBtn} onClick={() => setEsc(false)}>▶ RESUME</button>
            <button style={styles.escBtn} onClick={exit}>⌂ EXIT TO MAIN MENU</button>
          </div>
        </div>
      )}
    </>
  );
}

/** Poison-stack pip bar shown under the HP bar while the shroud is active. */
/** Fading "A CHAMPION HUNTS YOU" banner that appears on champion
 *  spawn and fades out over 3.5 s. Stateless — the HUD polls
 *  championAnnouncedAt from sharedRef and this component computes
 *  opacity from (elapsed - announcedAt). Hidden before the first
 *  announcement and after 3.5 s. */
function ChampionBanner({ elapsedSec, announcedAt }: {
  elapsedSec: number;
  announcedAt: number;
}) {
  if (!isFinite(announcedAt)) return null;
  const dt = elapsedSec - announcedAt;
  if (dt < 0 || dt > 3.5) return null;
  // Fade in over first 0.25s, hold, fade out over last 0.8s.
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
    top: 195,
    right: 20,
    display: "flex",
    gap: 6,
    padding: "6px",
    background: "rgba(10,5,20,0.7)",
    border: "1px solid rgba(140,100,200,0.35)",
    borderRadius: 8,
    backdropFilter: "blur(4px)",
    pointerEvents: "none" as const,
  },
  gearSlotBox: {
    width: 40,
    height: 40,
    borderRadius: 6,
    border: "2px solid rgba(60,60,80,0.5)",
    background: "rgba(10,8,22,0.8)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 22,
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
