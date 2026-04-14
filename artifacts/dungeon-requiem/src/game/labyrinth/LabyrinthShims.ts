/**
 * LabyrinthShims.ts
 *
 * Adapters that let the Labyrinth reuse the main game's visual components
 * (`Player3D`, `Enemy3D`) without editing any main-game source. Each
 * labyrinth-local runtime (LabPlayer, LabEnemy) is paired with a shim
 * object whose shape matches the core game's PlayerRuntime / EnemyRuntime
 * / GameState. Per frame, the scene's CombatEnemyLoop copies the live
 * labyrinth state into the shim; the main renderers read the shim and
 * draw the scene.
 *
 * Why shims instead of refactoring Player3D/Enemy3D to accept a neutral
 * interface?
 *   - Player3D + Enemy3D are tightly coupled to the full PlayerRuntime
 *     (invTimer, dash state, berserker timers, etc.). Refactoring them
 *     to a neutral interface would touch the whole combat runtime.
 *   - Shims keep the labyrinth folder self-contained per the invariant
 *     at REPLIT_CONTEXT.md.
 *   - When progression (Step 5) wires up a richer LabPlayer with more
 *     state (DoT timers, dash, class-specific counters), we just fill
 *     more shim fields without touching renderers.
 *
 * This keeps all three classes (Warrior / Mage / Rogue) renderable in
 * the labyrinth today — the shim always sets `charClass`, and Player3D
 * dispatches on that. Swapping classes is a one-line call-site change.
 */

import type { CharacterClass } from "../../data/CharacterData";
import type {
  GameState,
  PlayerRuntime,
  EnemyRuntime,
} from "../GameScene";
import type { PlayerAttackState } from "./LabyrinthCombat";
import type { EnemyRuntime as LabEnemy } from "./LabyrinthEnemy";

// ─── Player shim ─────────────────────────────────────────────────────────────

export interface LabPlayerVisualSource {
  x: number;
  z: number;
  angle: number;
  hp: number;
  maxHp: number;
}

/** Returns a ref-able GameState populated with defaults. Call once per
 *  scene mount; update with `updatePlayerShim` each frame. */
export function createPlayerShim(charClass: CharacterClass): GameState {
  const player: PlayerRuntime = {
    x: 0, z: 0,
    angle: 0,
    hp: 100, maxHp: 100,
    invTimer: 0,
    dashTimer: 0, dashCooldown: 0,
    dashVX: 0, dashVZ: 0,
    isDashing: false,
    attackTimer: 0, attackTrigger: 0, attackAngle: 0,
    dead: false,
    regenTimer: 0,
    echoAttackCounter: 0,
    meleeHitCounter: 0,
    momentumTimer: 0,
    momentumStacks: 0,
    warCryTimer: 0,
    critCascadeTimer: 0,
    momentumShiftTimer: 0,
    momentumShiftStacks: 0,
    invisTimer: 0,
    guaranteedCrit: false,
    singularityTimer: 0,
    singularityActiveTimer: 0,
    singularityX: 0,
    singularityZ: 0,
    bloodforgeKills: 0,
    berserkersMarkTimer: 0,
    berserkersMarkCooldown: 0,
    unstableCoreTimer: 0,
    leylineStillTimer: 0,
    leylineZoneTimer: 0,
    leylineZoneX: 0,
    leylineZoneZ: 0,
    deathsMomentumStacks: 0,
    deathsMomentumTimer: 0,
    cloakAndDaggerTimer: 0,
    cloakAndDaggerCooldown: 0,
    cloakAndDaggerReady: false,
    lastAttackTime: 0,
    lastX: 0, lastZ: 0,
  };
  // Fully-populated GameState-shaped shim. Player3D today only reads
  // `gs.current.charClass` and `gs.current.player`, but populating every
  // primitive/array field eliminates any "undefined property access"
  // failure mode — if a future Player3D update starts reading any of
  // these fields, it'll see a safe default instead of throwing. Only
  // `progression` and `input` are left null (those are non-trivial
  // object instances we'd have to construct); if Player3D ever reads
  // them, add minimal stubs here. Cast stays because of those two nulls.
  return {
    player,
    enemies: [],
    xpOrbs: [],
    projectiles: [],
    enemyProjectiles: [],
    groundEffects: [],
    score: 0,
    kills: 0,
    survivalTime: 0,
    wave: 0,
    spawnTimer: 0,
    waveTimer: 0,
    spawnInterval: 0,
    charClass,
    progression: null,
    input: null,
    running: true,
    bossAlive: false,
    bossId: null,
    goblinWaveSpawned: 0,
    nemesisSpawned: false,
    nemesisId: null,
    trialMode: false,
    trialChampionDefeated: false,
    difficultyHpMult: 1,
    difficultyDmgMult: 1,
    difficultySpeedMult: 1,
    difficultyShardMult: 1,
    difficultyGearMult: 1,
    highestBossWaveCleared: 0,
    gearDrops: [],
    equippedGear: { weapon: null, armor: null, trinket: null },
    inventory: [],
    shakeTimer: 0,
    shakeAmp: 0,
    shakeDur: 0,
    freezeUntil: 0,
    deathFx: [],
  } as unknown as GameState;
}

export function updatePlayerShim(
  shim: GameState,
  source: LabPlayerVisualSource,
  attack: PlayerAttackState,
  prevSwingVisualSec: { value: number },
  isDashing: boolean = false,
): void {
  const p = shim.player;
  p.x = source.x;
  p.z = source.z;
  p.angle = source.angle;
  p.hp = source.hp;
  p.maxHp = source.maxHp;
  // Bump attackTrigger exactly once per swing (on the leading edge of
  // swingVisualSec going from 0 to non-zero). Player3D uses this counter
  // to trigger a one-shot weapon-swing animation.
  if (prevSwingVisualSec.value <= 0 && attack.swingVisualSec > 0) {
    p.attackTrigger += 1;
    p.attackAngle = attack.swingAngle;
  }
  prevSwingVisualSec.value = attack.swingVisualSec;
  // Dash-active flag drives the warrior "lean forward" animation in
  // WarriorMeshAnimated (Player3D.tsx:201). Invulnerability isn't wired
  // yet — leave as default.
  p.isDashing = isDashing;
}

// ─── Enemy shim ──────────────────────────────────────────────────────────────

/** Mapping from Labyrinth enemy kind → main-game Enemy3D type key. */
export function enemyTypeForKind(kind: LabEnemy["kind"]): string {
  switch (kind) {
    case "corridor_guardian": return "elite";
    case "trap_spawner": return "wraith";
    case "mimic": return "scuttler";
    case "shadow_stalker": return "wraith";
    // Future mappings:
    //   warden → "boss"
  }
}

/** Per-kind palette + scale. Elite's native visual scale is 1.6 — too
 *  large for corridor width. Use 1.0 for guardians so they read as
 *  "champions shrunk to fit the tight halls" rather than squeezing
 *  through gaps. Trap spawners are slightly smaller (0.85) so they
 *  feel like a stationary turret rather than a regular mob. */
function visualsForKind(kind: LabEnemy["kind"]): {
  scale: number; color: string; emissive: string;
} {
  switch (kind) {
    case "corridor_guardian":
      return { scale: 1.0, color: "#8b0000", emissive: "#300000" };
    case "trap_spawner":
      return { scale: 0.85, color: "#6020a0", emissive: "#40108c" };
    case "mimic":
      return { scale: 1.05, color: "#b07040", emissive: "#703018" };
    case "shadow_stalker":
      return { scale: 0.9, color: "#101018", emissive: "#3a2a5a" };
  }
}

export function createEnemyShim(labEnemy: LabEnemy): EnemyRuntime {
  const visuals = visualsForKind(labEnemy.kind);
  return {
    id: labEnemy.id,
    type: enemyTypeForKind(labEnemy.kind),
    x: labEnemy.x,
    z: labEnemy.z,
    hp: labEnemy.hp,
    maxHp: labEnemy.maxHp,
    damage: 0,
    moveSpeed: 0,
    attackRange: 0,
    attackInterval: 1.6,
    attackTimer: 1.6,
    collisionRadius: 1.0,
    xpReward: 0,
    scoreValue: 0,
    dead: false,
    hitFlashTimer: 0,
    scale: visuals.scale,
    color: visuals.color,
    emissive: visuals.emissive,
    vx: 0,
    vz: 0,
    phasing: false,
    phaseTimer: 0,
    specialTimer: 0,
    specialWarning: false,
    specialWarnTimer: 0,
    minionTimer: 0,
    radialTimer: 0,
    enragePhase: 0,
    baseMoveSpeed: 0,
    baseDamage: 0,
    poisonStacks: 0,
    poisonDps: 0,
    bleedDps: 0,
    bleedTimer: 0,
    slowPct: 0,
    slowTimer: 0,
    weakenPct: 0,
    markTimer: 0,
    convergenceHits: 0,
    convergenceTimer: 0,
    affix: "none",
    shieldHp: 0,
  };
}

/** Per-frame sync. Also decays the shim's attack timer so Enemy3D can
 *  animate windup/strike — mapped from LabEnemy's attackCooldown which
 *  counts DOWN in the same direction the main game uses.
 *
 *  playerX/Z are used only by shadow stalkers, which phase out at range
 *  and reveal when close. Other kinds ignore them. */
export function updateEnemyShim(
  shim: EnemyRuntime,
  labEnemy: LabEnemy,
  playerX: number,
  playerZ: number,
  stalkerRevealDist: number,
): void {
  shim.x = labEnemy.x;
  shim.z = labEnemy.z;
  // Derive velocity from the last movement direction at a reasonable
  // speed so walk animations play — Enemy3D reads |v| to pick a stride.
  const moving = labEnemy.state === "chase" || labEnemy.state === "patrol";
  const speed = moving ? 3.5 : 0;
  shim.vx = labEnemy.lastMoveX * speed;
  shim.vz = labEnemy.lastMoveZ * speed;
  shim.hp = labEnemy.hp;
  shim.dead = labEnemy.state === "dead";
  shim.hitFlashTimer = labEnemy.hitFlashTimer;
  // attackTimer / attackInterval: Enemy3D uses the ratio to animate
  // wind-up. When the guardian is in `attack` state and close to
  // swinging, attackCooldown is near 0 → attackTimer low → "striking".
  shim.attackInterval = 1.2;
  shim.attackTimer = labEnemy.attackCooldown;
  // Shadow stalker: render semi-transparent until within reveal range.
  // Enemy3D reads .phasing / .phaseTimer for its wraith shimmer path.
  if (labEnemy.kind === "shadow_stalker") {
    const dx = playerX - labEnemy.x;
    const dz = playerZ - labEnemy.z;
    const far = dx * dx + dz * dz > stalkerRevealDist * stalkerRevealDist;
    shim.phasing = far;
    shim.phaseTimer = far ? 1 : 0;
  } else {
    shim.phasing = false;
    shim.phaseTimer = 0;
  }
}
