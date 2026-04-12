/**
 * GameScene.tsx — Dungeon Requiem
 * Self-contained 3D hack-and-slash game engine.
 * All game logic lives here in a single useFrame loop.
 * No external manager classes — plain refs + zustand for UI.
 */

import { useRef, useEffect, useCallback } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

import { audioManager } from "../audio/AudioManager";
import { useGameStore } from "../store/gameStore";
import { useMetaStore } from "../store/metaStore";
import { GAME_CONFIG } from "../data/GameConfig";
import { ENEMY_DATA, pickEnemyType } from "../data/EnemyData";
import { CHARACTER_DATA, type CharacterClass } from "../data/CharacterData";
import { DIFFICULTY_DATA } from "../data/DifficultyData";
import { RACE_DATA, type RaceType } from "../data/RaceData";
import { ProgressionManager } from "../systems/ProgressionManager";
import { createDefaultStats, type PlayerStats } from "../data/UpgradeData";
import { buildMetaModifiers, buildTrialModifiers } from "../data/MetaUpgradeData";
import { resolveStats } from "../data/StatModifier";
import { InputManager3D } from "./InputManager3D";
import { tryRollGear, rollGearDrop, getEnhancedBonuses, GEAR_RARITY_COLOR, type GearDef } from "../data/GearData";
import { DungeonRoom } from "../world/DungeonRoom";
import { Torch3D } from "../world/Torch3D";
import { Player3D } from "../entities/Player3D";
import { Enemy3D } from "../entities/Enemy3D";
import { XPOrb3D } from "../entities/XPOrb3D";
import { AttackEffect } from "../effects/AttackEffect";
import { Projectile3D } from "../entities/Projectile3D";
import { HUD } from "../ui/HUD";
import { LevelUp } from "../ui/LevelUp";
import { PauseMenu } from "../ui/PauseMenu";
import { MobileControls } from "../ui/MobileControls";
import { DevHUD } from "../ui/DevHUD";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PlayerRuntime {
  x: number; z: number;
  angle: number;
  hp: number; maxHp: number;
  invTimer: number;
  dashTimer: number; dashCooldown: number;
  dashVX: number; dashVZ: number;
  isDashing: boolean;
  attackTimer: number; attackTrigger: number; attackAngle: number;
  dead: boolean;
  regenTimer: number;
  echoAttackCounter: number;
  // ── Class-specific runtime state ───────────────────────────────────────
  meleeHitCounter: number;       // warrior: consecutive hit count for blood momentum / earthbreaker
  momentumTimer: number;         // warrior: 2s reset timer for blood momentum
  momentumStacks: number;        // warrior: current blood momentum damage stacks
  warCryTimer: number;           // warrior: remaining war cry buff duration
  critCascadeTimer: number;      // rogue: remaining crit cascade buff duration
  invisTimer: number;            // rogue: evasion matrix invisibility
  guaranteedCrit: boolean;       // rogue: next hit auto-crits
  singularityTimer: number;      // mage: timer for next singularity
  singularityActiveTimer: number;// mage: remaining duration of active vortex
  singularityX: number;          // mage: vortex position
  singularityZ: number;
  bloodforgeKills: number;       // warrior: kills tracked for bloodforge (+1 HP each, cap 20)
}

export interface EnemyRuntime {
  id: string; type: string;
  x: number; z: number;
  hp: number; maxHp: number;
  damage: number; moveSpeed: number;
  attackRange: number; attackInterval: number; attackTimer: number;
  collisionRadius: number;
  xpReward: number; scoreValue: number;
  dead: boolean; hitFlashTimer: number;
  scale: number; color: string; emissive: string;
  vx: number; vz: number;
  phasing: boolean; phaseTimer: number;
  // Boss/elite/champion extended fields
  specialTimer: number;
  specialWarning: boolean;
  specialWarnTimer: number;
  minionTimer: number;
  radialTimer: number;
  // Champion enrage tracking
  enragePhase: number; // 0=none, 1=75%, 2=50%, 3=25%
  baseMoveSpeed: number;
  baseDamage: number;
  // ── DoT / debuff state ─────────────────────────────────────────────────
  poisonStacks: number;        // rogue venom: number of stacks
  poisonDps: number;           // damage per second per stack
  bleedDps: number;            // rogue serrated edge bleed
  bleedTimer: number;          // remaining bleed duration
  slowPct: number;             // current slow amount (0..1)
  slowTimer: number;           // remaining slow duration
  weakenPct: number;           // weakening blows: damage reduction on this enemy (0..0.30)
  // ── Elite affixes ─────────────────────────────────────────────────────
  affix: "none" | "shielded" | "vampiric" | "berserker";
  shieldHp: number;            // shielded affix: absorbs first hit
}

export type CrystalTier = "green" | "blue" | "purple" | "orange";

export interface XPOrb {
  id: string; x: number; z: number;
  value: number; collected: boolean; floatOffset: number;
  crystalTier: CrystalTier;
  collectTimer: number; // 0 = not collected yet, >0 = animating collection
}

export interface EnemyProjectile {
  id: string;
  x: number; z: number;
  vx: number; vz: number;
  damage: number;
  lifetime: number;
  dead: boolean;
  style: "default" | "orb" | "dagger" | "sword" | "crescent";
}

export interface Projectile {
  id: string;
  x: number; z: number;
  vx: number; vz: number;
  damage: number;
  radius: number;
  lifetime: number;
  piercing: boolean;
  hitIds: Set<string>;
  color: string;
  glowColor: string;
  style: "orb" | "dagger";
  dead: boolean;
  isFracture?: boolean; // prevents chain reaction from arcane fracture
  spawnX?: number;      // overcharged orbs: spawn position for distance calc
  spawnZ?: number;
  maxRange?: number;    // overcharged orbs: max travel distance
  trailTimer?: number;  // residual field: timer for next trail drop
}

/** Residual Field ground damage zone left by mage orbs. */
export interface GroundEffect {
  id: string;
  x: number; z: number;
  radius: number;
  dps: number;        // damage per second to enemies in zone
  lifetime: number;   // remaining seconds
  color: string;
}

export interface GameState {
  player: PlayerRuntime;
  enemies: EnemyRuntime[];
  xpOrbs: XPOrb[];
  projectiles: Projectile[];
  enemyProjectiles: EnemyProjectile[];
  groundEffects: GroundEffect[];
  score: number; kills: number; survivalTime: number;
  wave: number;
  spawnTimer: number; waveTimer: number;
  spawnInterval: number;
  charClass: CharacterClass;
  progression: ProgressionManager;
  input: InputManager3D;
  running: boolean;
  bossAlive: boolean;
  bossId: string | null;
  goblinWaveSpawned: number;
  nemesisSpawned: boolean;
  nemesisId: string | null;
  // Trial & Difficulty
  trialMode: boolean;
  trialChampionDefeated: boolean;
  difficultyHpMult: number;
  difficultyDmgMult: number;
  difficultySpeedMult: number;
  difficultyShardMult: number;
  difficultyGearMult: number;
  // Extraction
  highestBossWaveCleared: number;
  // Gear drops
  gearDrops: GearDropRuntime[];
  equippedGear: Record<string, GearDef | null>; // keyed by slot: weapon, armor, trinket
  /**
   * In-run spare gear. When a pickup lands on an already-occupied slot, the
   * item goes here instead of auto-replacing the equipped gear. Player can
   * equip from / sell from this list via the pause menu inventory view.
   * On run end (death or extraction) everything here is transferred to the
   * persistent meta stash.
   */
  inventory: GearDef[];
  // Game feel — surfaced on GameState so both GameLoop and CameraController can read/write
  shakeTimer: number;  // remaining shake duration (seconds)
  shakeAmp: number;    // current shake amplitude (world units, 0..~1)
  shakeDur: number;    // initial duration of the active shake (for decay envelope)
  freezeUntil: number; // performance.now() timestamp — main loop freezes updates until this time
  deathFx: DeathFx[];  // active enemy death particle bursts
}

/** A single enemy-death particle burst. Short-lived, 7 puffs + flash. */
export interface DeathFx {
  id: string;
  x: number; z: number;
  age: number;     // seconds since spawn
  duration: number; // total lifetime in seconds
  color: string;   // primary tint (enemy color)
  /** Per-puff initial velocity vectors. Length must equal PUFF_COUNT. */
  puffs: { vx: number; vy: number; vz: number }[];
}

export interface GearDropRuntime {
  id: string;
  x: number; z: number;
  gear: GearDef;
  floatOffset: number;
  lifetime: number; // despawns after N seconds
}

// ─── Torch positions ──────────────────────────────────────────────────────────

const H = GAME_CONFIG.ARENA_HALF;
const TORCH_POSITIONS: [number, number, number][] = [
  [-20, 2.8, -H + 0.2], [0, 2.8, -H + 0.2], [20, 2.8, -H + 0.2],
  [-20, 2.8,  H - 0.2], [0, 2.8,  H - 0.2], [20, 2.8,  H - 0.2],
  [-H + 0.2, 2.8, -15], [-H + 0.2, 2.8, 0], [-H + 0.2, 2.8, 15],
  [ H - 0.2, 2.8, -15], [ H - 0.2, 2.8, 0], [ H - 0.2, 2.8, 15],
];

// ─── Meta-aware progression factory ──────────────────────────────────────────
// Builds the starting PlayerStats for a class, bakes in persistent meta bonuses,
// then wraps it in a ProgressionManager. Per-run upgrades stack on top via ProgressionManager.

function makeProgWithMeta(cls: CharacterClass, race: RaceType): { progression: ProgressionManager; startHp: number } {
  const def = CHARACTER_DATA[cls];
  const raceDef = RACE_DATA[race];
  // 1. Class base stats modified by race multipliers
  const classBase: PlayerStats = {
    ...createDefaultStats(),
    maxHealth: Math.round(def.hp * raceDef.hpMult),
    currentHealth: Math.round(def.hp * raceDef.hpMult),
    damage: Math.round(def.damage * raceDef.damageMult),
    attackSpeed: parseFloat((def.attackSpeed * raceDef.attackSpeedMult).toFixed(3)),
    moveSpeed: parseFloat((def.moveSpeed * raceDef.moveSpeedMult).toFixed(3)),
    armor: Math.max(0, def.armor + raceDef.armorBonus),
    dashCooldown: def.dashCooldown,
    critChance: Math.min(0.95, def.critChance + raceDef.critBonus),
    attackRange: def.attackRange,
    // Class-specific base stats not stored in CharacterData
    critDamageMultiplier: cls === "rogue" ? 2.0 : 1.85,
    healthRegen: cls === "mage" ? 1.0 : 0.5,
  };
  // 2. Resolve meta flat bonuses + trial buffs on top (Layer 1 — flat additions only)
  const metaMods = buildMetaModifiers(useMetaStore.getState().purchased);
  const trialMods = buildTrialModifiers(useMetaStore.getState().trialWins);
  const resolved = resolveStats(classBase, [...metaMods, ...trialMods]);
  resolved.maxHealth = Math.round(resolved.maxHealth);
  resolved.currentHealth = resolved.maxHealth;
  resolved.damage = Math.round(resolved.damage);
  // 3. Hand off to ProgressionManager — per-run upgrades (additive %) stack on top
  const progression = new ProgressionManager(resolved, cls);
  return { progression, startHp: resolved.maxHealth };
}

// ─── ID generators ────────────────────────────────────────────────────────────

let _eid = 1;
let _oid = 1;
let _pid = 1;
let _epid = 1;
let _gid = 1;
function enemyId() { return `e${_eid++}`; }
function orbId()   { return `o${_oid++}`; }
function projId()  { return `p${_pid++}`; }
function eprojId() { return `ep${_epid++}`; }
function gearId()  { return `g${_gid++}`; }
let _dpid = 1;
function popupId() { return `dp${_dpid++}`; }

/**
 * Apply armor to an incoming damage value with a soft cap at 80% reduction.
 *
 * The previous formula (`max(1, raw - armor) * mult`) treated armor as flat
 * subtraction, which made the player functionally invincible past ~80 armor
 * since enemies couldn't scale up fast enough to punch through. This helper
 * caps absorption at 80% of the raw hit, so even a tank build with 300 armor
 * still eats 20% of the damage.
 *
 *   absorbed = min(armor, raw * 0.80)
 *   effective = max(minDmg, (raw - absorbed) * incomingMult)
 *
 * `minDmg` preserves the existing `Math.max(100, …)` floor on the boss slam.
 */
function applyArmor(rawDmg: number, armor: number, incomingMult: number, minDmg = 1): number {
  const absorbed = Math.min(armor, rawDmg * 0.80);
  return Math.max(minDmg, (rawDmg - absorbed) * incomingMult);
}

/** Spawn a floating damage number. */
function spawnDmgPopup(x: number, z: number, value: number, isCrit: boolean, isPlayer: boolean): void {
  useGameStore.getState().addDamagePopup({
    id: popupId(), x, z, value, isCrit, isPlayer,
    spawnTime: performance.now(),
  });
}

// ─── Game feel helpers ────────────────────────────────────────────────────────

/**
 * Trigger camera shake. Larger amplitude wins if multiple shakes fire in the
 * same frame (don't stack — that produces muddy cam noise).
 * Typical values: normal hit 0.12, crit 0.22, kill 0.18, boss slam 0.55.
 */
function triggerShake(g: GameState, amp: number, dur = 0.18): void {
  if (amp <= g.shakeAmp && g.shakeTimer > 0) return;
  g.shakeAmp = amp;
  g.shakeTimer = dur;
  g.shakeDur = dur;
}

/**
 * Hit-stop: freeze the main update loop for a short duration to sell the
 * impact of big hits. Rendering continues so the world doesn't disappear.
 * Always extends rather than truncating an existing freeze.
 */
function triggerFreeze(g: GameState, ms: number): void {
  const until = performance.now() + ms;
  if (until > g.freezeUntil) g.freezeUntil = until;
}

let _fxid = 1;
function deathFxId() { return `fx${_fxid++}`; }

/** Number of particle puffs per death burst. */
const PUFF_COUNT = 7;

/** Spawn a brief particle burst at an enemy death location. */
function spawnDeathFx(g: GameState, x: number, z: number, color: string): void {
  const puffs: { vx: number; vy: number; vz: number }[] = [];
  for (let i = 0; i < PUFF_COUNT; i++) {
    // Random direction in a hemisphere (up + horizontal)
    const angle = Math.random() * Math.PI * 2;
    const speed = 2.2 + Math.random() * 1.4;
    puffs.push({
      vx: Math.sin(angle) * speed,
      vy: 1.4 + Math.random() * 1.6,
      vz: Math.cos(angle) * speed,
    });
  }
  g.deathFx.push({
    id: deathFxId(), x, z, age: 0, duration: 0.55, color, puffs,
  });
  // Cap to avoid runaway cost if something goes wild
  if (g.deathFx.length > 40) g.deathFx.splice(0, g.deathFx.length - 40);
}

/**
 * Heal helper that respects the Vampiric Shroud overheal ceiling.
 * Heals can overflow above maxHp up to maxHp * (1 + overhealShieldPct).
 * Spawns a green floating number (offset left of the player) when the
 * heal is >= 1 HP so the player sees the feedback.
 */
function healPlayer(p: PlayerRuntime, stats: PlayerStats, amount: number): void {
  if (amount <= 0) return;
  const ceiling = p.maxHp * (1 + stats.overhealShieldPct);
  const amplified = amount * stats.healingReceivedMult;
  const before = p.hp;
  p.hp = Math.min(ceiling, p.hp + amplified);
  const healed = p.hp - before;
  if (healed >= 1) {
    useGameStore.getState().addDamagePopup({
      id: popupId(), x: p.x - 1.5, z: p.z,
      value: Math.round(healed), isCrit: false, isPlayer: false,
      spawnTime: performance.now(),
      text: `+${Math.round(healed)}`,
      color: "#44ff88",
      durationSec: 0.8,
    });
  }
}

/** Spawn a damage-taken popup offset slightly right of the player. */
function spawnPlayerDmgPopup(p: PlayerRuntime, value: number): void {
  spawnDmgPopup(p.x + 1.0, p.z, value, false, true);
}

/** Bloodforge: +1 max HP per kill, capped at +20. Called from every kill path. */
function applyBloodforge(p: PlayerRuntime, stats: PlayerStats): void {
  if (stats.bloodforgeMaxHpPerKill > 0 && p.bloodforgeKills < 20) {
    p.bloodforgeKills++;
    stats.maxHealth += 1;
    stats.currentHealth = Math.min(stats.currentHealth + 1, stats.maxHealth);
    p.maxHp = stats.maxHealth;
    p.hp = Math.min(p.hp + 1, p.maxHp);
  }
}

/**
 * Big-kill cleanup — call this from any secondary kill path (chain lightning,
 * ground effects, AoE, DoT, etc.) that can kill the boss or a trial champion.
 * The primary kill sites (melee swing, projectile hit) already inline this
 * logic. Without this, the big target gets filtered out of g.enemies but
 * g.bossAlive stays true (boss HP bar also used for champions), leaving the
 * HUD boss bar stuck on screen and the wave/trial not advancing.
 */
function handleBossKillCleanup(e: EnemyRuntime, g: GameState): void {
  const isChampion = e.type.endsWith("_champion");
  if (e.type !== "boss" && !isChampion) return;
  const store = useGameStore.getState();
  if (e.type === "boss") {
    g.bossAlive = false;
    g.bossId = null;
    g.highestBossWaveCleared = Math.max(g.highestBossWaveCleared, g.wave);
    store.setBossSpecialWarn(false);
    audioManager.play("boss_death");
    const meta = useMetaStore.getState();
    meta.unlockMilestone("boss_kill");
    meta.checkUnlocks();
    // Difficulty gating: clearing a boss on this difficulty advances the
    // unlock progress. Hard unlocks at normal >= 20, Nightmare at hard >= 20.
    meta.recordDifficultyClear(store.difficultyTier, g.wave);
  }
  // Clear the boss HP bar (used for both bosses and champions)
  store.setBossState(0, 0, "", false);
  // Trial champions must flag trialChampionDefeated so the victory check fires
  if (isChampion && g.trialMode) {
    g.trialChampionDefeated = true;
  }
}

/** Spawn a floating text popup (e.g. "Item Dropped!") with a custom color + duration. */
function spawnTextPopup(x: number, z: number, text: string, color: string, durationSec = 2.5): void {
  useGameStore.getState().addDamagePopup({
    id: popupId(), x, z, value: 0, isCrit: false, isPlayer: false,
    spawnTime: performance.now(),
    text, color, durationSec,
  });
}

const CRYSTAL_TIER: Record<string, CrystalTier> = {
  scuttler:         "green",
  wraith:           "blue",
  brute:            "blue",
  elite:            "purple",
  boss:             "orange",
  xp_goblin:        "orange",
  warrior_champion: "orange",
  mage_champion:    "orange",
  rogue_champion:   "orange",
};

// ─── Factory helpers ──────────────────────────────────────────────────────────

function makePlayer(startHp: number = GAME_CONFIG.PLAYER.START_HEALTH): PlayerRuntime {
  return {
    x: 0, z: 0, angle: 0,
    hp: startHp,
    maxHp: startHp,
    invTimer: 0,
    dashTimer: 0, dashCooldown: 0,
    dashVX: 0, dashVZ: 0, isDashing: false,
    attackTimer: 0, attackTrigger: 0, attackAngle: 0,
    dead: false, regenTimer: 0, echoAttackCounter: 0,
    // Class-specific runtime
    meleeHitCounter: 0,
    momentumTimer: 0,
    momentumStacks: 0,
    warCryTimer: 0,
    critCascadeTimer: 0,
    invisTimer: 0,
    guaranteedCrit: false,
    singularityTimer: 0,
    singularityActiveTimer: 0,
    singularityX: 0, singularityZ: 0,
    bloodforgeKills: 0,
  };
}

function spawnGoblin(): EnemyRuntime {
  const def = ENEMY_DATA.xp_goblin;
  const half = GAME_CONFIG.ARENA_HALF - 4;
  const edge = Math.floor(Math.random() * 4);
  let x = 0, z = 0;
  switch (edge) {
    case 0: x = Math.random() * half * 2 - half; z = -half; break;
    case 1: x = Math.random() * half * 2 - half; z =  half; break;
    case 2: x = -half; z = Math.random() * half * 2 - half; break;
    case 3: x =  half; z = Math.random() * half * 2 - half; break;
  }
  // Spawn banner so the player notices
  spawnTextPopup(x, z, "TREASURE GOBLIN!", "#ffcc00", 3.0);
  return {
    id: enemyId(), type: "xp_goblin", x, z,
    hp: def.health, maxHp: def.health,
    damage: 0, moveSpeed: def.moveSpeed,
    attackRange: 0, attackInterval: 999, attackTimer: 999,
    collisionRadius: def.collisionRadius,
    xpReward: def.xpReward, scoreValue: def.scoreValue,
    dead: false, hitFlashTimer: 0,
    scale: def.scale, color: def.color, emissive: def.emissive,
    vx: 0, vz: 0, phasing: false, phaseTimer: 0,
    specialTimer: 25.0, // despawn countdown
    specialWarning: false, specialWarnTimer: 0,
    minionTimer: 0, radialTimer: 3.8, // taunt cycle timer
    enragePhase: 0, baseMoveSpeed: def.moveSpeed, baseDamage: 0,
    poisonStacks: 0, poisonDps: 0, bleedDps: 0, bleedTimer: 0, slowPct: 0, slowTimer: 0, weakenPct: 0,
    affix: "none" as const, shieldHp: 0,
  };
}

// ─── Centralised player death handler ─────────────────────────────────────────
// Handles Death's Bargain relic — call this wherever player hp drops to 0.

function handlePlayerFatalDmg(p: PlayerRuntime, g: GameState): boolean {
  const stats = g.progression.stats;
  if (stats.deathBargainActive === 1) {
    p.hp = 1;
    stats.deathBargainActive = 0;
    p.invTimer = 1.5; // 1.5s of post-bargain invincibility
    audioManager.play("player_hurt");
    return false; // survived
  }
  p.hp = 0; p.dead = true;
  audioManager.play("player_death");
  audioManager.stopMusic();
  const store = useGameStore.getState();
  store.setBossState(0, 0, "", false);
  store.setBossSpecialWarn(false);
  { const meta = useMetaStore.getState(); meta.addTotalKills(g.kills); meta.updateBestWave(g.wave); meta.checkUnlocks(); }
  // Run shards are forfeited on death — only extraction guarantees a payout
  return true; // died
}

// ─── Soulfire relic — explosion on kill ───────────────────────────────────────

/** Convert a GearDef to a stash-compatible object for metaStore. */
function gearToStash(gear: GearDef) {
  return {
    id: gear.id, name: gear.name, icon: gear.icon, rarity: gear.rarity,
    slot: gear.slot, enhanceLevel: gear.enhanceLevel ?? 0,
    bonuses: { ...gear.bonuses } as Record<string, number>,
  };
}

/** Try to spawn a gear drop at the given position based on enemy type. */
function trySpawnGear(enemyType: string, x: number, z: number, g: GameState): void {
  const gear = tryRollGear(enemyType, g.difficultyGearMult);
  if (!gear) return;
  const dropX = x + (Math.random() - 0.5) * 1.5;
  const dropZ = z + (Math.random() - 0.5) * 1.5;
  g.gearDrops.push({
    id: gearId(),
    x: dropX,
    z: dropZ,
    gear,
    floatOffset: Math.random() * Math.PI * 2,
    lifetime: 20,
  });
  // Drop-event feedback: chime + floating "Item Dropped!" text in rarity color
  audioManager.play("gear_drop");
  const rarityColor = GEAR_RARITY_COLOR[gear.rarity].text;
  const label = gear.rarity === "epic"
    ? `EPIC! ${gear.icon} ${gear.name}`
    : gear.rarity === "rare"
      ? `Rare! ${gear.icon} ${gear.name}`
      : `${gear.icon} ${gear.name}`;
  spawnTextPopup(dropX, dropZ, label, rarityColor, 2.5);
}

/** Equip a gear piece: apply bonuses to stats, replace any existing gear in that slot. */
function equipGear(gear: GearDef, g: GameState): void {
  const stats = g.progression.stats;
  // Remove old gear bonuses if slot was occupied
  const old = g.equippedGear[gear.slot];
  if (old) {
    const oldBonuses = getEnhancedBonuses(old);
    for (const [key, val] of Object.entries(oldBonuses)) {
      if (typeof (stats as any)[key] === "number") {
        (stats as any)[key] -= val;
      }
    }
  }
  // Apply new gear bonuses (enhanced)
  const newBonuses = getEnhancedBonuses(gear);
  for (const [key, val] of Object.entries(newBonuses)) {
    if (typeof (stats as any)[key] === "number") {
      (stats as any)[key] += val;
    }
  }
  // Update max HP if it changed
  if (newBonuses.maxHealth) {
    g.player.maxHp = stats.maxHealth;
    g.player.hp = Math.min(g.player.hp + newBonuses.maxHealth, g.player.maxHp);
  }
  g.equippedGear[gear.slot] = gear;
}

function triggerSoulfire(deadEnemy: EnemyRuntime, g: GameState): void {
  if (Math.random() > g.progression.stats.soulfireChance) return;
  const dmg = Math.round(g.progression.stats.damage * 1.0);
  for (const nearby of g.enemies) {
    if (nearby.dead || nearby.id === deadEnemy.id) continue;
    const dx = nearby.x - deadEnemy.x;
    const dz = nearby.z - deadEnemy.z;
    if (Math.sqrt(dx * dx + dz * dz) <= 4.5) {
      nearby.hp -= dmg;
      nearby.hitFlashTimer = 0.25;
    }
  }
}

const AFFIX_TYPES = ["shielded", "vampiric", "berserker"] as const;

/**
 * Apply damage to an enemy, handling the shielded affix.
 * Returns the actual damage dealt (0 if shield absorbed it).
 */
function applyEnemyDamage(e: EnemyRuntime, rawDmg: number): number {
  if (e.affix === "shielded" && e.shieldHp > 0) {
    e.shieldHp = 0;
    e.hitFlashTimer = 0.3;
    e.emissive = e.color; // clear blue tint
    return 0; // shield absorbed the hit
  }
  e.hp -= rawDmg;
  return rawDmg;
}

function spawnEnemy(wave: number, hpMult = 1, dmgMult = 1, speedMult = 1): EnemyRuntime {
  const type = pickEnemyType(wave) as keyof typeof ENEMY_DATA;
  const def = ENEMY_DATA[type];
  const half = GAME_CONFIG.ARENA_HALF - 3;
  const edge = Math.floor(Math.random() * 4);
  let x = 0, z = 0;
  switch (edge) {
    case 0: x = Math.random() * half * 2 - half; z = -half; break;
    case 1: x = Math.random() * half * 2 - half; z =  half; break;
    case 2: x = -half; z = Math.random() * half * 2 - half; break;
    case 3: x =  half; z = Math.random() * half * 2 - half; break;
  }
  const hpScale = (1 + wave * GAME_CONFIG.DIFFICULTY.HP_SCALE_PER_WAVE) * hpMult;
  const finalDmg = Math.round(def.damage * dmgMult);
  const finalSpd = def.moveSpeed * speedMult;
  const e: EnemyRuntime = {
    id: enemyId(), type, x, z,
    hp: Math.round(def.health * hpScale),
    maxHp: Math.round(def.health * hpScale),
    damage: finalDmg, moveSpeed: finalSpd,
    attackRange: def.attackRange,
    attackInterval: def.attackInterval,
    attackTimer: def.attackInterval * 0.5,
    collisionRadius: def.collisionRadius,
    xpReward: def.xpReward,
    scoreValue: def.scoreValue,
    dead: false, hitFlashTimer: 0,
    scale: def.scale, color: def.color, emissive: def.emissive,
    vx: 0, vz: 0, phasing: false, phaseTimer: 0,
    specialTimer: type === "wraith" ? 2.0 + Math.random() * 2.0
                : type === "elite"  ? 2.5 + Math.random() * 1.0
                : 0,
    specialWarning: false, specialWarnTimer: 0,
    minionTimer: 0, radialTimer: 0,
    enragePhase: 0, baseMoveSpeed: finalSpd, baseDamage: finalDmg,
    poisonStacks: 0, poisonDps: 0, bleedDps: 0, bleedTimer: 0, slowPct: 0, slowTimer: 0, weakenPct: 0,
    affix: "none" as const, shieldHp: 0,
  };
  // Roll affix: 12% chance after wave 10, non-boss enemies only
  if (wave >= 10 && type !== "boss" && Math.random() < 0.12) {
    const roll = AFFIX_TYPES[Math.floor(Math.random() * AFFIX_TYPES.length)];
    e.affix = roll;
    if (roll === "shielded") {
      e.shieldHp = 1; // absorbs one full hit
      e.emissive = "#2244cc";
    } else if (roll === "vampiric") {
      e.emissive = "#cc2020";
    } else if (roll === "berserker") {
      e.moveSpeed *= 1.5;
      e.baseMoveSpeed *= 1.5;
      e.damage = Math.round(e.damage * 1.3);
      e.baseDamage = Math.round(e.baseDamage * 1.3);
      e.hp = Math.round(e.hp * 0.7);
      e.maxHp = Math.round(e.maxHp * 0.7);
      e.emissive = "#cc6600";
    }
  }
  return e;
}

function spawnBoss(wave: number): EnemyRuntime {
  const def = ENEMY_DATA.boss;
  const half = GAME_CONFIG.ARENA_HALF - 5;
  const bossCount = Math.floor(wave / GAME_CONFIG.DIFFICULTY.BOSS_WAVE_INTERVAL);
  const hpScale = 1 + (bossCount - 1) * GAME_CONFIG.DIFFICULTY.BOSS_HP_SCALE_PER_WAVE;
  const hp = Math.round(def.health * hpScale);
  const corners: [number, number][] = [[-half, -half], [half, -half], [-half, half], [half, half]];
  const [cx, cz] = corners[Math.floor(Math.random() * corners.length)];
  return {
    id: enemyId(), type: "boss", x: cx, z: cz,
    hp, maxHp: hp,
    damage: Math.round(def.damage * (1 + (bossCount - 1) * 0.15)),
    moveSpeed: def.moveSpeed,
    attackRange: def.attackRange,
    attackInterval: def.attackInterval,
    attackTimer: def.attackInterval,
    collisionRadius: def.collisionRadius,
    xpReward: def.xpReward,
    scoreValue: def.scoreValue,
    dead: false, hitFlashTimer: 0,
    scale: def.scale, color: def.color, emissive: def.emissive,
    vx: 0, vz: 0, phasing: false, phaseTimer: 0,
    specialTimer: GAME_CONFIG.DIFFICULTY.BOSS_SPECIAL_INTERVAL,
    specialWarning: false,
    specialWarnTimer: 0,
    minionTimer: 10,
    radialTimer: 5,
    enragePhase: 0, baseMoveSpeed: def.moveSpeed, baseDamage: Math.round(def.damage * (1 + (bossCount - 1) * 0.15)),
    poisonStacks: 0, poisonDps: 0, bleedDps: 0, bleedTimer: 0, slowPct: 0, slowTimer: 0, weakenPct: 0,
    affix: "none" as const, shieldHp: 0,
  };
}

function spawnChampion(cls: CharacterClass, hpMult = 1, dmgMult = 1, speedMult = 1): EnemyRuntime {
  const type = `${cls}_champion` as "warrior_champion" | "mage_champion" | "rogue_champion";
  const def = ENEMY_DATA[type];
  const hp = Math.round(def.health * hpMult);
  const finalDmg = Math.round(def.damage * dmgMult);
  const finalSpd = def.moveSpeed * speedMult;
  return {
    id: enemyId(), type, x: 0, z: -20,
    hp, maxHp: hp,
    damage: finalDmg, moveSpeed: finalSpd,
    attackRange: def.attackRange,
    attackInterval: def.attackInterval,
    attackTimer: 2.0,
    collisionRadius: def.collisionRadius,
    xpReward: 0, scoreValue: 0,
    dead: false, hitFlashTimer: 0,
    scale: def.scale, color: def.color, emissive: def.emissive,
    vx: 0, vz: 0, phasing: false, phaseTimer: 0,
    specialTimer: cls === "warrior" ? 10.0 : 4.0,
    specialWarning: false, specialWarnTimer: 0,
    minionTimer: cls === "warrior" ? 2.0 : 3.0, // warrior fires first arc slash faster
    radialTimer: cls === "mage" ? 2.2 : cls === "rogue" ? 0.75 : 0,
    enragePhase: 0, baseMoveSpeed: finalSpd, baseDamage: finalDmg,
    poisonStacks: 0, poisonDps: 0, bleedDps: 0, bleedTimer: 0, slowPct: 0, slowTimer: 0, weakenPct: 0,
    affix: "none" as const, shieldHp: 0,
  };
}

/**
 * Spawn a nemesis — a weaker, character-sized version of the trial champion
 * matching the player's class. Spawns at a random arena edge.
 */
function spawnNemesis(cls: CharacterClass, hpMult: number, dmgMult: number, speedMult: number): EnemyRuntime {
  const nemesis = spawnChampion(cls, hpMult * 0.5, dmgMult * 0.6, speedMult);
  // Override scale to character-sized (not the giant 1.8× trial champion)
  nemesis.scale = 1.0;
  // Spawn at arena edge instead of center
  const half = GAME_CONFIG.ARENA_HALF - 4;
  const edge = Math.floor(Math.random() * 4);
  switch (edge) {
    case 0: nemesis.x = Math.random() * half * 2 - half; nemesis.z = -half; break;
    case 1: nemesis.x = Math.random() * half * 2 - half; nemesis.z =  half; break;
    case 2: nemesis.x = -half; nemesis.z = Math.random() * half * 2 - half; break;
    case 3: nemesis.x =  half; nemesis.z = Math.random() * half * 2 - half; break;
  }
  // Give it meaningful rewards (the champion defaults have 0 XP/score)
  const champDef = ENEMY_DATA[`${cls}_champion` as keyof typeof ENEMY_DATA];
  nemesis.xpReward = champDef.xpReward || Math.round(50 * hpMult);
  nemesis.scoreValue = champDef.scoreValue || 200;
  return nemesis;
}

// ─── Camera + AimResolver ─────────────────────────────────────────────────────

function CameraController({ gs }: { gs: React.RefObject<GameState | null> }) {
  const { camera } = useThree();
  const target = useRef(new THREE.Vector3());
  const lastHp = useRef(-1);

  useEffect(() => {
    camera.position.set(0, 28, 22);
    (camera as THREE.PerspectiveCamera).lookAt(0, 0, 0);
  }, [camera]);

  useFrame((_, delta) => {
    if (!gs.current) return;
    const g = gs.current;
    const p = g.player;

    // Detect HP loss → subtle shake (proportional to damage taken).
    // Shake state lives on GameState so other code paths (boss slam, crits,
    // kills) can also write to it via triggerShake().
    if (lastHp.current >= 0 && p.hp < lastHp.current) {
      const pct = (lastHp.current - p.hp) / p.maxHp;
      triggerShake(g, Math.min(0.35, pct * 2), 0.18);
    }
    lastHp.current = p.hp;

    target.current.set(p.x, 28, p.z + 22);

    // Apply shake — decays via the per-shake duration so larger triggers
    // shake longer in addition to harder. Gated on the user setting: even
    // if triggerShake() has been called, we skip the camera displacement
    // when shake is disabled, but still tick the timer down so it expires.
    if (g.shakeTimer > 0) {
      g.shakeTimer -= delta;
      if (useMetaStore.getState().settings.screenShake) {
        const decay = Math.max(0, g.shakeTimer / Math.max(0.0001, g.shakeDur));
        const a = g.shakeAmp * decay;
        target.current.x += (Math.random() - 0.5) * a;
        target.current.z += (Math.random() - 0.5) * a;
      }
      if (g.shakeTimer <= 0) g.shakeAmp = 0;
    }

    camera.position.lerp(target.current, 0.08);
    (camera as THREE.PerspectiveCamera).lookAt(p.x, 0, p.z);
  });
  return null;
}

function AimResolver({ gs }: { gs: React.RefObject<GameState | null> }) {
  const { camera, raycaster, pointer } = useThree();
  const groundPlane = useRef(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0));
  const hit = useRef(new THREE.Vector3());

  useFrame(() => {
    if (!gs.current) return;
    // On mobile, the right joystick writes worldAimX/Z directly via
    // MobileControls. Don't clobber it with the mouse raycaster (whose
    // pointer would default to screen-center and override the stick).
    if (gs.current.input.isMobile) return;
    raycaster.setFromCamera(pointer, camera);
    if (raycaster.ray.intersectPlane(groundPlane.current, hit.current)) {
      gs.current.input.worldAimX = hit.current.x;
      gs.current.input.worldAimZ = hit.current.z;
    }
  });
  return null;
}

// ─── Main game loop ───────────────────────────────────────────────────────────

const ARENA = GAME_CONFIG.ARENA_HALF - 0.5;

function GameLoop({ gs }: { gs: React.RefObject<GameState | null> }) {
  const phase = useGameStore((s) => s.phase);
  // Intentionally NOT subscribing to s.enemies / s.xpOrbs here — no UI
  // component actually reads those store fields, so subscribing would force
  // GameLoop to re-render every frame (new array identity every frame) for
  // zero benefit. Scene-graph reads come from gs.current.enemies directly.
  const attackTrigger = useGameStore((s) => s.attackTrigger);
  const playerX = useGameStore((s) => s.playerX);
  const playerZ = useGameStore((s) => s.playerZ);
  const playerAngle = useGameStore((s) => s.playerAngle);
  const cleaved = useRef(new Set<string>());

  useFrame((_, rawDelta) => {
    if (!gs.current || !gs.current.running) return;
    if (phase === "paused" || phase === "levelup") return;
    if (phase !== "playing") return;

    // ── Hit stop ────────────────────────────────────────────────────────────
    // freezeUntil is set by triggerFreeze() on big hits. We skip the entire
    // update tick (movement, AI, physics, timers) until the freeze expires,
    // but rendering / camera shake / death FX particles continue running so
    // the world doesn't visibly disappear.
    if (performance.now() < gs.current.freezeUntil) return;

    const delta = Math.min(rawDelta, 0.05);
    const g = gs.current;
    const p = g.player;
    const input = g.input.state;
    const stats = g.progression.stats;
    const store = useGameStore.getState();

    g.survivalTime += delta;

    // ── Player movement ───────────────────────────────────────────────────
    if (!p.dead) {
      if (p.invTimer > 0) p.invTimer -= delta;
      if (p.dashCooldown > 0) p.dashCooldown -= delta;
      if (p.attackTimer > 0) p.attackTimer -= delta;

      // Aim — desktop uses mouse cursor, mobile uses right-side aim stick
      // Both write to worldAimX/Z: desktop via AimResolver raycaster,
      // mobile via MobileControls right-stick updating input.worldAimX/Z.
      const dx = input.worldAimX - p.x;
      const dz = input.worldAimZ - p.z;
      if (Math.abs(dx) > 0.1 || Math.abs(dz) > 0.1) {
        p.angle = Math.atan2(dx, dz);
      }

      // Dash
      if (p.isDashing) {
        p.dashTimer -= delta;
        p.x += p.dashVX * delta;
        p.z += p.dashVZ * delta;
        if (p.dashTimer <= 0) {
          p.isDashing = false;
          p.dashCooldown = stats.dashCooldown;
        }
      } else {
        // Normal movement
        let mx = 0, mz = 0;
        if (input.up)    mz -= 1;
        if (input.down)  mz += 1;
        if (input.left)  mx -= 1;
        if (input.right) mx += 1;
        const len = Math.sqrt(mx * mx + mz * mz);
        if (len > 0) {
          mx /= len; mz /= len;
          p.x += mx * stats.moveSpeed * delta;
          p.z += mz * stats.moveSpeed * delta;
        }

        // Dash initiation — class-specific baseline dashes
        if (input.dash && p.dashCooldown <= 0) {
          g.input.consumeDash();
          audioManager.play("dash");
          const dashDir = len > 0
            ? { x: mx, z: mz }
            : { x: Math.sin(p.angle), z: Math.cos(p.angle) };

          if (g.charClass === "mage") {
            // ── Mage: Blink — instant teleport + slow at origin ──
            const blinkDist = GAME_CONFIG.PLAYER.DASH_SPEED * GAME_CONFIG.PLAYER.DASH_DURATION;
            const originX = p.x, originZ = p.z;
            p.x = Math.max(-ARENA, Math.min(ARENA, p.x + dashDir.x * blinkDist));
            p.z = Math.max(-ARENA, Math.min(ARENA, p.z + dashDir.z * blinkDist));
            p.invTimer = GAME_CONFIG.PLAYER.DASH_DURATION + 0.15;
            // Afterimage: slow enemies at origin (baseline), damage if volatile blink upgrade
            const blinkDmg = stats.volatileBlinkEnabled ? Math.round(stats.damage * 1.0) : Math.round(stats.damage * 0.4);
            const blinkRadius = stats.volatileBlinkEnabled ? 5.0 : 3.5;
            for (const e of g.enemies) {
              if (e.dead) continue;
              const bx = e.x - originX, bz = e.z - originZ;
              if (Math.sqrt(bx * bx + bz * bz) <= blinkRadius) {
                e.hp -= blinkDmg; e.hitFlashTimer = 0.2;
                // Baseline slow at blink origin
                if (stats.mageBlinkSlowPct > 0) { e.slowPct = stats.mageBlinkSlowPct; e.slowTimer = 2.0; }
                if (e.hp <= 0 && !e.dead) { e.dead = true; g.kills++; g.score += e.scoreValue; trySpawnGear(e.type, e.x, e.z, g); applyBloodforge(p, stats); handleBossKillCleanup(e, g); }
              }
            }
            p.isDashing = false; // instant, no travel
            p.dashCooldown = stats.dashCooldown;

          } else if (g.charClass === "rogue") {
            // ── Rogue: Poison Dash — pass through enemies, apply venom ──
            p.isDashing = true;
            p.dashTimer = GAME_CONFIG.PLAYER.DASH_DURATION;
            p.dashVX = dashDir.x * GAME_CONFIG.PLAYER.DASH_SPEED;
            p.dashVZ = dashDir.z * GAME_CONFIG.PLAYER.DASH_SPEED;
            p.invTimer = GAME_CONFIG.PLAYER.DASH_DURATION + 0.05; // short i-frames
            const dashDmg = Math.round(stats.damage * 0.4);
            const poisonPerStack = stats.venomStackDps > 0 ? stats.venomStackDps : 3; // baseline 3 dps even without upgrade
            for (const e of g.enemies) {
              if (e.dead) continue;
              const ex = e.x - p.x, ez = e.z - p.z;
              if (Math.sqrt(ex * ex + ez * ez) <= stats.attackRange * 0.8) {
                e.hp -= dashDmg; e.hitFlashTimer = 0.15;
                // Apply poison stacks (baseline 1, upgradeable to 3 with Toxic Dash)
                e.poisonStacks = Math.min(e.poisonStacks + stats.toxicDashStacks, 5);
                e.poisonDps = poisonPerStack * stats.deepWoundsMultiplier;
                if (e.hp <= 0 && !e.dead) {
                  e.dead = true; g.kills++; g.score += e.scoreValue;
                  if (stats.dashResetOnKill) p.dashCooldown = 0;
                  applyBloodforge(p, stats);
                  handleBossKillCleanup(e, g);
                }
              }
            }

          } else {
            // ── Warrior: Knockback Charge — push enemies away ──
            p.isDashing = true;
            p.dashTimer = GAME_CONFIG.PLAYER.DASH_DURATION;
            p.dashVX = dashDir.x * GAME_CONFIG.PLAYER.DASH_SPEED;
            p.dashVZ = dashDir.z * GAME_CONFIG.PLAYER.DASH_SPEED;
            p.invTimer = GAME_CONFIG.PLAYER.DASH_DURATION + 0.15; // longer i-frames for melee
            p.warCryTimer = stats.warCryDmgBonus > 0 ? 4.0 : 0;
            // Knockback enemies in path
            const kbForce = stats.dashKnockbackForce;
            const kbDmg = Math.round(stats.damage * 0.3);
            for (const e of g.enemies) {
              if (e.dead) continue;
              const ex = e.x - p.x, ez = e.z - p.z;
              const eDist = Math.sqrt(ex * ex + ez * ez);
              if (eDist <= 4 && eDist > 0.1) {
                // Push enemy away from dash direction
                const nx = ex / eDist, nz = ez / eDist;
                e.x = Math.max(-ARENA, Math.min(ARENA, e.x + nx * kbForce));
                e.z = Math.max(-ARENA, Math.min(ARENA, e.z + nz * kbForce));
                e.hp -= kbDmg; e.hitFlashTimer = 0.2;
                if (e.hp <= 0 && !e.dead) { e.dead = true; g.kills++; g.score += e.scoreValue; trySpawnGear(e.type, e.x, e.z, g); applyBloodforge(p, stats); handleBossKillCleanup(e, g); }
              }
            }
          }
        }
      }

      // Arena clamp
      p.x = Math.max(-ARENA, Math.min(ARENA, p.x));
      p.z = Math.max(-ARENA, Math.min(ARENA, p.z));

      // Auto-attack — fires automatically when cooldown expires
      if (p.attackTimer <= 0) {
        const attackDuration = 1 / stats.attackSpeed;
        p.attackTrigger++;
        p.attackTimer = attackDuration;
        p.attackAngle = p.angle;
        cleaved.current.clear();

        if (g.charClass === "warrior") {
          audioManager.play("attack_melee");
          // ── Melee arc sweep ────────────────────────────────────────────
          // War Cry damage bonus
          const warCryMult = p.warCryTimer > 0 ? (1 + stats.warCryDmgBonus) : 1;
          // Blood Momentum stacking
          const momentumMult = stats.bloodMomentumPerHit > 0
            ? 1 + Math.min(p.momentumStacks * stats.bloodMomentumPerHit, 0.60)
            : 1;

          let meleeHitsThisSwing = 0;
          for (const e of g.enemies) {
            if (e.dead) continue;
            const edx = e.x - p.x;
            const edz = e.z - p.z;
            const dist = Math.sqrt(edx * edx + edz * edz);
            if (dist > stats.attackRange) continue;
            const eAngle = Math.atan2(edx, edz);
            let angleDiff = Math.abs(eAngle - p.angle);
            if (angleDiff > Math.PI) angleDiff = Math.PI * 2 - angleDiff;
            const arcHalf = (stats.attackArc / 2) * (Math.PI / 180);
            if (angleDiff > arcHalf) continue;
            if (cleaved.current.has(e.id) && Math.random() > stats.cleaveChance) continue;
            cleaved.current.add(e.id);

            let dmg = Math.round(stats.damage * warCryMult * momentumMult);
            const isCrit = Math.random() < stats.critChance;
            if (isCrit) dmg = Math.floor(dmg * stats.critDamageMultiplier);
            const dealt = applyEnemyDamage(e, dmg);
            e.hitFlashTimer = 0.15;
            spawnDmgPopup(e.x, e.z, dealt > 0 ? dmg : 0, isCrit, false);
            // Crit hit juice — small shake + brief freeze (skipped if it kills,
            // since the centralized kill-FX scan will fire bigger juice).
            if (isCrit && e.hp > 0) { triggerShake(g, 0.22, 0.16); triggerFreeze(g, 22); }
            meleeHitsThisSwing++;

            if (stats.doubleStrikeChance > 0 && Math.random() < stats.doubleStrikeChance) {
              e.hp -= dmg;
              spawnDmgPopup(e.x + 0.3, e.z, dmg, false, false);
            }
            if (stats.lifesteal > 0) {
              healPlayer(p, stats, dmg * stats.lifesteal);
            }
            // Warrior: Weakening Blows — reduce enemy damage on melee hit
            if (stats.weakeningBlowsPct > 0) {
              e.weakenPct = Math.min((e.weakenPct || 0) + stats.weakeningBlowsPct, 0.30);
            }
            if (e.hp <= 0) {
              e.dead = true;
              g.kills++;
              g.score += e.scoreValue;
              if (g.trialMode && e.type.endsWith("_champion")) g.trialChampionDefeated = true;
              useGameStore.getState().addRunShards(5);
              if (stats.onKillHeal > 0) healPlayer(p, stats, stats.onKillHeal);
              applyBloodforge(p, stats);
              if (stats.soulfireChance > 0) triggerSoulfire(e, g);
              const xpGain = Math.round(e.xpReward * stats.xpMultiplier);
              g.xpOrbs.push({ id: orbId(), x: e.x, z: e.z, value: xpGain, collected: false, floatOffset: Math.random() * Math.PI * 2, crystalTier: CRYSTAL_TIER[e.type] ?? "green", collectTimer: 0 });
              if (e.type === "boss") {
                handleBossKillCleanup(e, g);
                trySpawnGear(e.type, e.x, e.z, g);
              } else if (e.type.endsWith("_champion")) {
                handleBossKillCleanup(e, g);
                audioManager.play("enemy_death"); trySpawnGear(e.type, e.x, e.z, g);
              } else {
                audioManager.play("enemy_death"); trySpawnGear(e.type, e.x, e.z, g);
              }
            }
          }
          // ── Blood Momentum: update stacks after melee swing ──
          if (stats.bloodMomentumPerHit > 0 && meleeHitsThisSwing > 0) {
            p.momentumStacks = Math.min(p.momentumStacks + meleeHitsThisSwing, 20);
            p.momentumTimer = 2.0; // reset 2s decay
          }
          p.meleeHitCounter += meleeHitsThisSwing;

          // ── Earthbreaker: every 5th hit, AoE slam ──
          if (stats.earthbreakerEnabled && p.meleeHitCounter >= 5) {
            p.meleeHitCounter = 0;
            const slamDmg = Math.round(stats.damage * 1.2 * warCryMult);
            for (const e of g.enemies) {
              if (e.dead) continue;
              const ex = e.x - p.x, ez = e.z - p.z;
              if (Math.sqrt(ex * ex + ez * ez) <= stats.attackRange * 1.5) {
                e.hp -= slamDmg; e.hitFlashTimer = 0.25;
                if (e.hp <= 0 && !e.dead) {
                  e.dead = true; g.kills++; g.score += e.scoreValue;
                  if (stats.onKillHeal > 0) healPlayer(p, stats, stats.onKillHeal);
                  applyBloodforge(p, stats);
                  handleBossKillCleanup(e, g);
                  if (stats.soulfireChance > 0) triggerSoulfire(e, g);
                  trySpawnGear(e.type, e.x, e.z, g);
                  const xg = Math.round(e.xpReward * stats.xpMultiplier);
                  g.xpOrbs.push({ id: orbId(), x: e.x, z: e.z, value: xg, collected: false, floatOffset: Math.random() * Math.PI * 2, crystalTier: CRYSTAL_TIER[e.type] ?? "green", collectTimer: 0 });
                }
              }
            }
          }

          // Phantom Echo relic: every Nth attack, fire a free bonus sweep at 50% damage
          if (stats.phantomEchoEvery > 0) {
            p.echoAttackCounter++;
            if (p.echoAttackCounter % stats.phantomEchoEvery === 0) {
              const echoDmg = Math.round(stats.damage * 0.5);
              for (const e of g.enemies) {
                if (e.dead) continue;
                const edx = e.x - p.x; const edz = e.z - p.z;
                const dist = Math.sqrt(edx * edx + edz * edz);
                if (dist > stats.attackRange * 1.2) continue;
                const eAngle = Math.atan2(edx, edz);
                let ad = Math.abs(eAngle - p.angle);
                if (ad > Math.PI) ad = Math.PI * 2 - ad;
                if (ad > ((stats.attackArc / 2 + 20) * (Math.PI / 180))) continue;
                e.hp -= echoDmg; e.hitFlashTimer = 0.12;
                if (e.hp <= 0 && !e.dead) {
                  e.dead = true; g.kills++; g.score += e.scoreValue;
                  if (g.trialMode && e.type.endsWith("_champion")) g.trialChampionDefeated = true;
                  if (stats.onKillHeal > 0) healPlayer(p, stats, stats.onKillHeal);
                  applyBloodforge(p, stats);
                  handleBossKillCleanup(e, g);
                  if (stats.soulfireChance > 0) triggerSoulfire(e, g);
                  trySpawnGear(e.type, e.x, e.z, g);
                  const xg = Math.round(e.xpReward * stats.xpMultiplier);
                  g.xpOrbs.push({ id: orbId(), x: e.x, z: e.z, value: xg, collected: false, floatOffset: Math.random() * Math.PI * 2, crystalTier: CRYSTAL_TIER[e.type] ?? "green", collectTimer: 0 });
                }
              }
            }
          }
        } else {
          audioManager.play(g.charClass === "mage" ? "attack_orb" : "attack_dagger");
          // ── Projectile attack (Mage / Rogue) ───────────────────────────
          const def = CHARACTER_DATA[g.charClass];
          // Extra projectiles from upgrades
          const extraCount = g.charClass === "mage" ? stats.mageExtraOrbs
                           : g.charClass === "rogue" ? stats.rogueExtraDaggers : 0;
          const totalCount = def.projectileCount + extraCount;
          const projStyle = g.charClass === "mage" ? "orb" as const : "dagger" as const;
          const isPiercing = def.projectilePiercing;
          // War cry damage bonus (warrior only but just in case)
          const warCryMult = p.warCryTimer > 0 ? (1 + stats.warCryDmgBonus) : 1;
          // Split Bolt: +1 orb already counted in mageExtraOrbs, apply -25% damage
          const splitMult = stats.splitBoltActive ? 0.75 : 1;
          const projDmg = Math.round(stats.damage * warCryMult * splitMult);
          // Projectile radius with bonus
          const projRadius = def.projectileRadius + stats.projectileRadiusBonus;

          const fireVolley = (angleOffset: number) => {
            for (let i = 0; i < totalCount; i++) {
              const spread = totalCount > 1 ? (i - (totalCount - 1) / 2) * def.projectileSpread : 0;
              const angle = p.angle + spread + angleOffset;
              const proj: Projectile = {
                id: projId(),
                x: p.x, z: p.z,
                vx: Math.sin(angle) * def.projectileSpeed,
                vz: Math.cos(angle) * def.projectileSpeed,
                damage: projDmg,
                radius: projRadius,
                lifetime: def.projectileLifetime,
                piercing: isPiercing,
                hitIds: new Set(),
                color: def.accentColor,
                glowColor: def.color,
                style: projStyle,
                dead: false,
              };
              // Mage orb upgrade fields
              if (projStyle === "orb") {
                if (stats.overchargedOrbBonus > 0) { proj.spawnX = p.x; proj.spawnZ = p.z; proj.maxRange = def.projectileSpeed * def.projectileLifetime; }
                if (stats.residualFieldEnabled) { proj.trailTimer = 0; }
              }
              g.projectiles.push(proj);
              // Twin Fang proc
              if (stats.doubleStrikeChance > 0 && Math.random() < stats.doubleStrikeChance) {
                const extraAngle = angle + (Math.random() - 0.5) * 0.25;
                g.projectiles.push({
                  id: projId(),
                  x: p.x, z: p.z,
                  vx: Math.sin(extraAngle) * def.projectileSpeed,
                  vz: Math.cos(extraAngle) * def.projectileSpeed,
                  damage: projDmg,
                  radius: projRadius,
                  lifetime: def.projectileLifetime,
                  piercing: isPiercing,
                  hitIds: new Set(),
                  color: def.accentColor,
                  glowColor: def.color,
                  style: projStyle,
                  dead: false,
                });
              }
            }
          };

          // Fire main volley
          fireVolley(0);

          // Mage: Spell Echo — chance to double-cast entire volley
          if (g.charClass === "mage" && stats.spellEchoChance > 0 && Math.random() < stats.spellEchoChance) {
            fireVolley((Math.random() - 0.5) * 0.15); // slight angle jitter
          }

          // Rogue: Phantom Blades — 2 extra spectral daggers at wide angles
          if (g.charClass === "rogue" && stats.phantomBladesEnabled) {
            for (const offset of [-0.5, 0.5]) { // ~28 degrees each side
              const phantomAngle = p.angle + offset;
              g.projectiles.push({
                id: projId(),
                x: p.x, z: p.z,
                vx: Math.sin(phantomAngle) * def.projectileSpeed * 0.8,
                vz: Math.cos(phantomAngle) * def.projectileSpeed * 0.8,
                damage: Math.round(projDmg * 0.5),
                radius: def.projectileRadius * 0.7,
                lifetime: def.projectileLifetime * 0.7,
                piercing: false,
                hitIds: new Set(),
                color: "#80ffcc",
                glowColor: "#40cc88",
                style: "dagger",
                dead: false,
              });
            }
          }
        }
      }

      // Regen
      if (stats.healthRegen > 0) {
        p.regenTimer += delta;
        if (p.regenTimer >= 1) {
          p.regenTimer = 0;
          healPlayer(p, stats, stats.healthRegen);
        }
      }

      // Vampiric Shroud drain — continuous HP loss; CAN kill the player.
      // Bypasses i-frames and incomingDamageMult — it's the cost of the relic.
      if (stats.hpDrainPerSec > 0 && !p.dead) {
        p.hp -= stats.hpDrainPerSec * delta;
        if (p.hp <= 0) handlePlayerFatalDmg(p, g);
      }

      // ── Per-frame passive systems ────────────────────────────────────────

      // Warrior: Blood Momentum decay
      if (stats.bloodMomentumPerHit > 0 && p.momentumStacks > 0) {
        p.momentumTimer -= delta;
        if (p.momentumTimer <= 0) {
          p.momentumStacks = 0;
          p.momentumTimer = 0;
        }
      }

      // Warrior: War Cry timer
      if (p.warCryTimer > 0) p.warCryTimer -= delta;

      // Rogue: Crit Cascade timer
      if (p.critCascadeTimer > 0) p.critCascadeTimer -= delta;

      // Rogue: Evasion Matrix invisibility
      if (p.invisTimer > 0) {
        p.invisTimer -= delta;
        p.invTimer = Math.max(p.invTimer, p.invisTimer); // can't be hit while invisible
      }

      // Mage: Singularity — periodic vortex
      if (stats.singularityInterval > 0) {
        if (p.singularityActiveTimer > 0) {
          // Active vortex: pull enemies toward vortex center
          p.singularityActiveTimer -= delta;
          for (const e of g.enemies) {
            if (e.dead) continue;
            const sx = p.singularityX - e.x, sz = p.singularityZ - e.z;
            const sd = Math.sqrt(sx * sx + sz * sz);
            if (sd <= 8 && sd > 0.5) {
              const pullStr = 6 * delta;
              e.x += (sx / sd) * pullStr;
              e.z += (sz / sd) * pullStr;
            }
          }
        } else {
          p.singularityTimer -= delta;
          if (p.singularityTimer <= 0) {
            p.singularityTimer = stats.singularityInterval;
            p.singularityActiveTimer = 3.0;
            p.singularityX = p.x;
            p.singularityZ = p.z;
          }
        }
      }
    }

    // ── Enemies ───────────────────────────────────────────────────────────
    for (const e of g.enemies) {
      if (e.dead) continue;
      if (e.hitFlashTimer > 0) e.hitFlashTimer -= delta;

      const edx = p.x - e.x;
      const edz = p.z - e.z;
      const dist = Math.sqrt(edx * edx + edz * edz);

      // XP Goblin: flees player, despawns after 25s, taunts every ~3s
      if (e.type === "xp_goblin") {
        e.specialTimer -= delta;
        if (e.specialTimer <= 0) { e.dead = true; continue; }
        // Taunt pause: radialTimer counts down a 3s cycle, goblin freezes for 0.8s
        e.radialTimer -= delta;
        if (e.radialTimer <= 0) e.radialTimer = 3.8; // reset cycle: 3s run + 0.8s pause
        const isTaunting = e.radialTimer <= 0.8;
        if (!isTaunting && dist > 0.1) {
          const speed = e.moveSpeed;
          e.vx = THREE.MathUtils.lerp(e.vx, -(edx / dist) * speed, 0.12);
          e.vz = THREE.MathUtils.lerp(e.vz, -(edz / dist) * speed, 0.12);
          e.x += e.vx * delta;
          e.z += e.vz * delta;
        } else if (isTaunting) {
          // Freeze in place during taunt
          e.vx = 0; e.vz = 0;
        }
        e.x = Math.max(-ARENA, Math.min(ARENA, e.x));
        e.z = Math.max(-ARENA, Math.min(ARENA, e.z));
        continue; // goblins don't attack
      }

      // ── DoT/Debuff tick ────────────────────────────────────────────────
      // Poison (rogue venom)
      if (e.poisonStacks > 0 && e.poisonDps > 0) {
        e.hp -= e.poisonStacks * e.poisonDps * delta;
        // Float-precision guard: clamp tiny positive HP to 0 so kill fires
        if (e.hp > 0 && e.hp < 0.5) e.hp = 0;
        if (e.hp <= 0 && !e.dead) {
          e.dead = true; g.kills++; g.score += e.scoreValue;
          if (stats.onKillHeal > 0) healPlayer(p, stats, stats.onKillHeal);
          applyBloodforge(p, stats);
          handleBossKillCleanup(e, g);
          // Venom spread on death
          if (stats.venomStackDps > 0) {
            for (const nearby of g.enemies) {
              if (nearby.dead || nearby.id === e.id) continue;
              const nx = nearby.x - e.x, nz = nearby.z - e.z;
              if (Math.sqrt(nx * nx + nz * nz) <= 3.5) {
                nearby.poisonStacks = Math.min(nearby.poisonStacks + 1, 5);
                nearby.poisonDps = stats.venomStackDps;
              }
            }
          }
          if (stats.soulfireChance > 0) triggerSoulfire(e, g);
          trySpawnGear(e.type, e.x, e.z, g);
          const xg = Math.round(e.xpReward * stats.xpMultiplier);
          g.xpOrbs.push({ id: orbId(), x: e.x, z: e.z, value: xg, collected: false, floatOffset: Math.random() * Math.PI * 2, crystalTier: CRYSTAL_TIER[e.type] ?? "green", collectTimer: 0 });
          continue;
        }
      }
      // Bleed (rogue serrated edge)
      if (e.bleedTimer > 0 && e.bleedDps > 0) {
        e.bleedTimer -= delta;
        e.hp -= e.bleedDps * delta;
        if (e.bleedTimer <= 0) { e.bleedDps = 0; }
        // Float-precision guard: clamp tiny positive HP to 0 so kill fires
        if (e.hp > 0 && e.hp < 0.5) e.hp = 0;
        if (e.hp <= 0 && !e.dead) {
          e.dead = true; g.kills++; g.score += e.scoreValue;
          if (stats.onKillHeal > 0) healPlayer(p, stats, stats.onKillHeal);
          applyBloodforge(p, stats);
          handleBossKillCleanup(e, g);
          trySpawnGear(e.type, e.x, e.z, g);
          continue;
        }
      }
      // Slow decay
      if (e.slowTimer > 0) {
        e.slowTimer -= delta;
        if (e.slowTimer <= 0) e.slowPct = 0;
      }

      // Wraith phasing + ranged shot
      if (e.type === "wraith") {
        e.phaseTimer -= delta;
        if (e.phaseTimer <= 0) {
          e.phasing = !e.phasing;
          e.phaseTimer = e.phasing ? 1.5 : 3.5;
        }
        e.specialTimer -= delta;
        if (e.specialTimer <= 0 && dist > e.attackRange) {
          e.specialTimer = 3.0 + Math.random() * 1.5;
          const dn = dist > 0 ? dist : 1;
          g.enemyProjectiles.push({
            id: eprojId(), x: e.x, z: e.z,
            vx: (edx / dn) * 9, vz: (edz / dn) * 9,
            damage: e.damage * 0.9,
            lifetime: 4.5, dead: false, style: "default" as const,
          });
        }
      }

      // Elite AoE ground slam
      if (e.type === "elite") {
        e.specialTimer -= delta;
        if (e.specialTimer <= 0) {
          e.specialTimer = 2.5 + Math.random() * 0.5;
          if (dist <= 3.5 && !p.dead && p.invTimer <= 0 && !p.isDashing) {
            const rawDmg = e.damage * 1.4 * (1 + g.wave * GAME_CONFIG.DIFFICULTY.DAMAGE_SCALE_PER_WAVE) * (1 - (e.weakenPct || 0));
            const isDodged = stats.dodgeChance > 0 && Math.random() < stats.dodgeChance;
            if (!isDodged) {
              // Mana Shield absorption
              const shielded = stats.manaShieldPct > 0 ? rawDmg * stats.manaShieldPct : 0;
              const afterShield = rawDmg - shielded;
              const effective = applyArmor(afterShield, stats.armor, stats.incomingDamageMult);
              p.hp -= effective; spawnPlayerDmgPopup(p, effective);
              p.invTimer = GAME_CONFIG.PLAYER.INVINCIBILITY_TIME * 0.8;
              // Iron Reprisal
              if (stats.ironReprisalEnabled) {
                const repDmg = Math.round(p.maxHp * 0.15);
                for (const re of g.enemies) {
                  if (re.dead) continue;
                  const rx = re.x - p.x, rz = re.z - p.z;
                  if (Math.sqrt(rx * rx + rz * rz) <= 4) { re.hp -= repDmg; re.hitFlashTimer = 0.2; }
                }
              }
              // Frost Armor
              if (stats.frostArmorSlowPct > 0) { e.slowPct = stats.frostArmorSlowPct; e.slowTimer = 2.0; }
              if (p.hp <= 0) { handlePlayerFatalDmg(p, g); }
              else { audioManager.play("player_hurt"); }
            }
          }
        }
      }

      // Move toward player (with slow applied)
      if (dist > e.attackRange) {
        const slowMult = e.slowPct > 0 ? (1 - e.slowPct) : 1;
        const speed = (e.phasing ? e.moveSpeed * 1.6 : e.moveSpeed) * slowMult;
        e.vx = THREE.MathUtils.lerp(e.vx, (edx / dist) * speed, 0.15);
        e.vz = THREE.MathUtils.lerp(e.vz, (edz / dist) * speed, 0.15);
        e.x += e.vx * delta;
        e.z += e.vz * delta;
      }

      // Attack player (champions with custom AI handle damage themselves — skip generic melee)
      const skipGenericMelee = e.type === "mage_champion" || e.type === "rogue_champion" || e.type === "warrior_champion";
      if (!skipGenericMelee && dist <= e.attackRange) {
        e.attackTimer -= delta;
        if (e.attackTimer <= 0) {
          e.attackTimer = e.attackInterval;
          if (p.invTimer <= 0 && !p.isDashing && !p.dead) {
            const rawDmg = e.damage * (1 + g.wave * GAME_CONFIG.DIFFICULTY.DAMAGE_SCALE_PER_WAVE) * (1 - (e.weakenPct || 0));
            const isDodged = stats.dodgeChance > 0 && Math.random() < stats.dodgeChance;
            if (isDodged) {
              // ── Evasion Matrix: dodge → invis + guaranteed crit ──
              if (stats.evasionMatrixEnabled) {
                p.invisTimer = 1.0;
                p.guaranteedCrit = true;
              }
            } else {
              // Mana Shield absorption
              const shielded = stats.manaShieldPct > 0 ? rawDmg * stats.manaShieldPct : 0;
              const afterShield = rawDmg - shielded;
              const effective = applyArmor(afterShield, stats.armor, stats.incomingDamageMult);
              p.hp -= effective; spawnPlayerDmgPopup(p, effective);
              p.invTimer = GAME_CONFIG.PLAYER.INVINCIBILITY_TIME;
              // Vampiric affix: heal 20% of damage dealt
              if (e.affix === "vampiric") {
                e.hp = Math.min(e.maxHp, e.hp + effective * 0.2);
              }
              // Iron Reprisal shockwave
              if (stats.ironReprisalEnabled) {
                const repDmg = Math.round(p.maxHp * 0.15);
                for (const re of g.enemies) {
                  if (re.dead) continue;
                  const rx = re.x - p.x, rz = re.z - p.z;
                  if (Math.sqrt(rx * rx + rz * rz) <= 4) { re.hp -= repDmg; re.hitFlashTimer = 0.2; }
                }
              }
              // Frost Armor slow
              if (stats.frostArmorSlowPct > 0) { e.slowPct = stats.frostArmorSlowPct; e.slowTimer = 2.0; }
              if (p.hp <= 0) { handlePlayerFatalDmg(p, g); }
              else { audioManager.play("player_hurt"); }
            }
          }
        }
      }

      // Arena bounds
      e.x = Math.max(-ARENA - 2, Math.min(ARENA + 2, e.x));
      e.z = Math.max(-ARENA - 2, Math.min(ARENA + 2, e.z));
    }

    // ── Death FX + kill juice ───────────────────────────────────────────────
    // Centralized: any enemy that's been marked dead (by melee, projectile,
    // DoT, AoE, etc.) gets one particle burst + a small shake/freeze pulse
    // before being removed. Boss/champion kills get a much harder hit.
    // Each enemy only triggers once because it's removed in the same frame.
    for (const e of g.enemies) {
      if (!e.dead) continue;
      spawnDeathFx(g, e.x, e.z, e.color);
      const isBigKill = e.type === "boss" || e.type.endsWith("_champion");
      if (isBigKill) {
        triggerShake(g, 0.55, 0.35);
        triggerFreeze(g, 80);
      } else {
        triggerShake(g, 0.18, 0.14);
        triggerFreeze(g, 28);
      }
    }
    g.enemies = g.enemies.filter((e) => !e.dead);

    // ── Death FX update ─────────────────────────────────────────────────────
    // Advance age on each active particle burst, drop expired ones.
    if (g.deathFx.length > 0) {
      for (const fx of g.deathFx) fx.age += delta;
      g.deathFx = g.deathFx.filter((fx) => fx.age < fx.duration);
    }

    // ── Ground Effects (Residual Field) ──────────────────────────────────
    if (g.groundEffects.length > 0) {
      for (const ge of g.groundEffects) {
        ge.lifetime -= delta;
        if (ge.lifetime <= 0) continue;
        const tickDmg = ge.dps * delta;
        for (const e of g.enemies) {
          if (e.dead) continue;
          const gx = ge.x - e.x, gz = ge.z - e.z;
          if (Math.sqrt(gx * gx + gz * gz) <= ge.radius + e.collisionRadius) {
            e.hp -= tickDmg;
            if (e.hitFlashTimer <= 0) e.hitFlashTimer = 0.08;
            // Float-precision guard: clamp tiny positive HP to 0 so kill fires
            if (e.hp < 0.5) e.hp = 0;
            if (e.hp <= 0 && !e.dead) {
              e.dead = true; g.kills++; g.score += e.scoreValue;
              if (stats.onKillHeal > 0) healPlayer(p, stats, stats.onKillHeal);
              applyBloodforge(p, stats);
              handleBossKillCleanup(e, g);
              trySpawnGear(e.type, e.x, e.z, g);
              if (e.type !== "boss") audioManager.play("enemy_death");
            }
          }
        }
      }
      g.groundEffects = g.groundEffects.filter((ge) => ge.lifetime > 0);
    }

    // ── Projectiles ───────────────────────────────────────────────────────
    for (const proj of g.projectiles) {
      if (proj.dead) continue;
      proj.x += proj.vx * delta;
      proj.z += proj.vz * delta;
      proj.lifetime -= delta;

      // ── Mage: Gravity Orbs — pull nearby enemies toward orb ──
      if (proj.style === "orb" && stats.gravityOrbPull > 0) {
        for (const e of g.enemies) {
          if (e.dead) continue;
          const gx = proj.x - e.x, gz = proj.z - e.z;
          const gd = Math.sqrt(gx * gx + gz * gz);
          if (gd > 0.3 && gd <= 2.5) {
            const pull = stats.gravityOrbPull * delta / gd;
            e.x += gx * pull;
            e.z += gz * pull;
          }
        }
      }

      // ── Mage: Residual Field — drop ground trail every 0.3s ──
      if (proj.style === "orb" && proj.trailTimer !== undefined) {
        proj.trailTimer -= delta;
        if (proj.trailTimer <= 0) {
          proj.trailTimer = 0.3;
          g.groundEffects.push({
            id: `ge${_fxid++}`, x: proj.x, z: proj.z,
            radius: 1.2, dps: proj.damage * 0.3, lifetime: 2.0,
            color: "#cc66ff",
          });
          if (g.groundEffects.length > 60) g.groundEffects.splice(0, g.groundEffects.length - 60);
        }
      }

      if (proj.lifetime <= 0 || Math.abs(proj.x) > ARENA + 4 || Math.abs(proj.z) > ARENA + 4) {
        // ── Mage: Arcane Detonation — AoE on orb expiry ──
        if (proj.style === "orb" && stats.arcaneDetonationEnabled && proj.lifetime <= 0 && !proj.isFracture) {
          const aoeRadius = 3;
          const aoeDmg = Math.round(proj.damage * 0.6);
          for (const e of g.enemies) {
            if (e.dead) continue;
            const ax = proj.x - e.x, az = proj.z - e.z;
            if (Math.sqrt(ax * ax + az * az) <= aoeRadius) {
              e.hp -= aoeDmg; e.hitFlashTimer = 0.15;
              spawnDmgPopup(e.x, e.z, aoeDmg, false, false);
              if (e.hp <= 0 && !e.dead) {
                e.dead = true; g.kills++; g.score += e.scoreValue;
                if (stats.onKillHeal > 0) healPlayer(p, stats, stats.onKillHeal);
                applyBloodforge(p, stats);
                handleBossKillCleanup(e, g);
                trySpawnGear(e.type, e.x, e.z, g);
              }
            }
          }
          // Visual: spawn a death-fx–style burst at detonation point
          spawnDeathFx(g, proj.x, proj.z, "#cc66ff");
        }
        proj.dead = true;
        continue;
      }
      for (const e of g.enemies) {
        if (e.dead || proj.hitIds.has(e.id)) continue;
        const pdx = proj.x - e.x;
        const pdz = proj.z - e.z;
        if (Math.sqrt(pdx * pdx + pdz * pdz) > proj.radius + e.collisionRadius) continue;

        let dmg = proj.damage;
        // ── Mage: Overcharged Orbs — distance-based damage scaling ──
        if (proj.spawnX !== undefined && proj.maxRange && stats.overchargedOrbBonus > 0) {
          const dx = proj.x - proj.spawnX, dz = proj.z - (proj.spawnZ ?? 0);
          const traveled = Math.sqrt(dx * dx + dz * dz);
          const ratio = Math.min(traveled / proj.maxRange, 1);
          dmg = Math.round(dmg * (1 + stats.overchargedOrbBonus * ratio));
        }
        // Crit: guaranteed crit from evasion matrix, or normal roll
        const isCrit = p.guaranteedCrit || Math.random() < (stats.critChance + (p.critCascadeTimer > 0 ? 0.12 : 0));
        if (p.guaranteedCrit) p.guaranteedCrit = false;
        if (isCrit) dmg = Math.floor(dmg * stats.critDamageMultiplier);
        e.hp -= dmg;
        e.hitFlashTimer = 0.15;
        spawnDmgPopup(e.x, e.z, dmg, isCrit, false);
        // Crit hit juice — see melee swing for the same pattern
        if (isCrit && e.hp > 0) { triggerShake(g, 0.22, 0.16); triggerFreeze(g, 22); }
        if (stats.lifesteal > 0) {
          healPlayer(p, stats, dmg * stats.lifesteal);
        }

        // ── Rogue: Venom Stack — apply poison on hit ──
        if (stats.venomStackDps > 0) {
          e.poisonStacks = Math.min(e.poisonStacks + 1, 5);
          e.poisonDps = stats.venomStackDps;
        }
        // ── Rogue: Crit Cascade — crits boost crit chance ──
        if (isCrit && stats.critCascadeEnabled) {
          p.critCascadeTimer = 3.0;
        }
        // ── Mage: Chain Lightning — bounce to nearby enemies ──
        if (stats.chainLightningBounces > 0) {
          let bounceSource = e;
          const bounced = new Set<string>([e.id]);
          for (let b = 0; b < stats.chainLightningBounces; b++) {
            let closest: EnemyRuntime | null = null;
            let closestDist = 6; // max bounce range
            for (const t of g.enemies) {
              if (t.dead || bounced.has(t.id)) continue;
              const bx = t.x - bounceSource.x, bz = t.z - bounceSource.z;
              const bd = Math.sqrt(bx * bx + bz * bz);
              if (bd < closestDist) { closestDist = bd; closest = t; }
            }
            if (!closest) break;
            bounced.add(closest.id);
            const chainDmg = Math.round(dmg * 0.55);
            closest.hp -= chainDmg;
            closest.hitFlashTimer = 0.12;
            if (closest.hp <= 0 && !closest.dead) {
              closest.dead = true; g.kills++; g.score += closest.scoreValue;
              if (stats.onKillHeal > 0) healPlayer(p, stats, stats.onKillHeal);
              applyBloodforge(p, stats);
              handleBossKillCleanup(closest, g);
              trySpawnGear(closest.type, closest.x, closest.z, g);
            }
            bounceSource = closest;
          }
        }

        if (proj.piercing) {
          proj.hitIds.add(e.id);
        } else {
          proj.dead = true;
        }
        if (e.hp <= 0) {
          e.dead = true;
          g.kills++;
          g.score += e.scoreValue;
          if (g.trialMode && e.type.endsWith("_champion")) g.trialChampionDefeated = true;
          useGameStore.getState().addRunShards(5);
          if (stats.onKillHeal > 0) healPlayer(p, stats, stats.onKillHeal);
              applyBloodforge(p, stats);
          if (stats.soulfireChance > 0) triggerSoulfire(e, g);
          // ── Rogue: Shadow Step — dash reset on kill ──
          if (stats.dashResetOnKill) p.dashCooldown = 0;
          // ── Mage: Arcane Fracture — death explosion projectiles ──
          if (stats.arcaneFractureEnabled && !proj.isFracture) {
            for (let f = 0; f < 3; f++) {
              const fracAngle = Math.random() * Math.PI * 2;
              g.projectiles.push({
                id: projId(), x: e.x, z: e.z,
                vx: Math.sin(fracAngle) * 10,
                vz: Math.cos(fracAngle) * 10,
                damage: Math.round(stats.damage * 0.4),
                radius: 0.35, lifetime: 0.8,
                piercing: true, hitIds: new Set(),
                color: "#ff66ff", glowColor: "#cc33cc",
                style: "orb", dead: false,
                isFracture: true,
              });
            }
          }
          const xpGain = Math.round(e.xpReward * stats.xpMultiplier);
          g.xpOrbs.push({ id: orbId(), x: e.x, z: e.z, value: xpGain, collected: false, floatOffset: Math.random() * Math.PI * 2, crystalTier: CRYSTAL_TIER[e.type] ?? "green", collectTimer: 0 });
          if (e.type === "boss") {
            handleBossKillCleanup(e, g);
            trySpawnGear(e.type, e.x, e.z, g);
          } else if (e.type.endsWith("_champion")) {
            handleBossKillCleanup(e, g);
            audioManager.play("enemy_death"); trySpawnGear(e.type, e.x, e.z, g);
          } else {
            audioManager.play("enemy_death"); trySpawnGear(e.type, e.x, e.z, g);
          }
        }
        if (!proj.piercing) break;
      }
    }
    g.projectiles = g.projectiles.filter((pr) => !pr.dead);

    // ── Enemy projectiles (wraith shots) ──────────────────────────────────
    for (const ep of g.enemyProjectiles) {
      if (ep.dead) continue;
      ep.lifetime -= delta;
      if (ep.lifetime <= 0) { ep.dead = true; continue; }
      ep.x += ep.vx * delta;
      ep.z += ep.vz * delta;
      if (Math.abs(ep.x) > GAME_CONFIG.ARENA_HALF || Math.abs(ep.z) > GAME_CONFIG.ARENA_HALF) {
        ep.dead = true; continue;
      }
      if (!p.dead && p.invTimer <= 0 && !p.isDashing) {
        const hdx = p.x - ep.x;
        const hdz = p.z - ep.z;
        const hitRadius = ep.style === "crescent" ? 1.8 : 0.9;
        if (Math.sqrt(hdx * hdx + hdz * hdz) < hitRadius) {
          ep.dead = true;
          const rawDmg = ep.damage * (1 + g.wave * GAME_CONFIG.DIFFICULTY.DAMAGE_SCALE_PER_WAVE);
          const isDodged = stats.dodgeChance > 0 && Math.random() < stats.dodgeChance;
          if (!isDodged) {
            const effective = applyArmor(rawDmg, stats.armor, stats.incomingDamageMult);
            p.hp -= effective; spawnPlayerDmgPopup(p, effective);
            p.invTimer = GAME_CONFIG.PLAYER.INVINCIBILITY_TIME * 0.6;
            if (p.hp <= 0) { handlePlayerFatalDmg(p, g); }
            else { audioManager.play("player_hurt"); }
          }
        }
      }
    }
    g.enemyProjectiles = g.enemyProjectiles.filter((ep) => !ep.dead);

    // ── XP Orbs ───────────────────────────────────────────────────────────
    const pickupR = GAME_CONFIG.PLAYER.PICKUP_RADIUS;
    for (const orb of g.xpOrbs) {
      if (orb.collected) {
        // Animating collection — magnetize toward player
        orb.collectTimer += delta;
        const t = Math.min(orb.collectTimer / 0.2, 1); // 0.2s animation
        orb.x = THREE.MathUtils.lerp(orb.x, p.x, t * 0.4);
        orb.z = THREE.MathUtils.lerp(orb.z, p.z, t * 0.4);
        continue;
      }
      const odx = p.x - orb.x;
      const odz = p.z - orb.z;
      if (Math.sqrt(odx * odx + odz * odz) <= pickupR) {
        orb.collected = true;
        orb.collectTimer = 0;
        audioManager.play("xp_pickup");
        g.progression.addXp(orb.value);
      }
    }
    // Remove after animation completes
    g.xpOrbs = g.xpOrbs.filter((o) => !o.collected || o.collectTimer < 0.2);

    // ── Damage popup cleanup (expire based on per-popup durationSec, default 1s) ──
    const now = performance.now();
    const popups = store.damagePopups;
    if (popups.length > 0) {
      const fresh = popups.filter((pp) => (now - pp.spawnTime) / 1000 < (pp.durationSec ?? 1.0));
      if (fresh.length !== popups.length) {
        useGameStore.setState({ damagePopups: fresh });
      }
    }

    // ── Gear Drops — pickup + despawn ──────────────────────────────────────
    // Behavior:
    //   1. Empty slot   → auto-equip the new gear (bonuses applied immediately)
    //   2. Occupied slot → push to in-run inventory (view/equip/sell in pause menu)
    //   3. Inventory full (>20) → auto-sell the oldest common item for shards
    //      as an overflow safety valve so runs can't snowball into runaway
    //      inventories. Epic and rare items are preserved.
    let inventoryChanged = false;
    for (const gd of g.gearDrops) {
      gd.lifetime -= delta;
      if (gd.lifetime <= 0) continue; // will be filtered out
      const gdx = p.x - gd.x, gdz = p.z - gd.z;
      if (Math.sqrt(gdx * gdx + gdz * gdz) <= GAME_CONFIG.PLAYER.PICKUP_RADIUS) {
        gd.lifetime = -1; // mark for removal
        audioManager.play("level_up"); // satisfying pickup sound
        const slot = gd.gear.slot;
        if (!g.equippedGear[slot]) {
          // Empty slot — auto-equip
          equipGear(gd.gear, g);
          store.setGearEquipped(slot, gd.gear);
        } else {
          // Occupied — inventory
          g.inventory.push(gd.gear);
          inventoryChanged = true;
          // Overflow: if we're above 20, drop the oldest common for shards.
          // Preserves rares/epics so players don't lose meaningful loot.
          while (g.inventory.length > 20) {
            const commonIdx = g.inventory.findIndex((it) => it.rarity === "common");
            if (commonIdx < 0) break; // no commons to cull — let it ride
            const culled = g.inventory.splice(commonIdx, 1)[0];
            store.addRunShards(5);
            spawnTextPopup(p.x, p.z, `Auto-sold ${culled.icon} +5 shards`, "#aaaaaa", 2.0);
          }
        }
      }
    }
    g.gearDrops = g.gearDrops.filter((gd) => gd.lifetime > 0);
    if (inventoryChanged) store.setInventory([...g.inventory]);

    // ── Boss special attack ────────────────────────────────────────────────
    for (const e of g.enemies) {
      if (e.dead || e.type !== "boss") continue;
      if (e.specialWarning) {
        e.specialWarnTimer -= delta;
        if (e.specialWarnTimer <= 0) {
          e.specialWarning = false;
          store.setBossSpecialWarn(false);
          // Boss slam landing — biggest shake in the game, fires whether the
          // player is in range or not (it's a visible event, not a hit reaction).
          triggerShake(g, 0.65, 0.4);
          triggerFreeze(g, 60);
          // AoE damage lands
          const dist = Math.sqrt((p.x - e.x) ** 2 + (p.z - e.z) ** 2);
          if (dist <= GAME_CONFIG.DIFFICULTY.BOSS_SPECIAL_RADIUS && p.invTimer <= 0 && !p.dead) {
            const rawDmg = e.damage * 3;
            const effective = applyArmor(rawDmg, stats.armor, stats.incomingDamageMult, 100);
            p.hp -= effective; spawnPlayerDmgPopup(p, effective);
            p.invTimer = GAME_CONFIG.PLAYER.INVINCIBILITY_TIME;
            if (p.hp <= 0) { handlePlayerFatalDmg(p, g); }
            else { audioManager.play("player_hurt"); }
          }
        }
      } else {
        e.specialTimer -= delta;
        if (e.specialTimer <= 0) {
          e.specialTimer = GAME_CONFIG.DIFFICULTY.BOSS_SPECIAL_INTERVAL;
          e.specialWarning = true;
          e.specialWarnTimer = GAME_CONFIG.DIFFICULTY.BOSS_SPECIAL_WARN_TIME;
          audioManager.play("boss_special");
          store.setBossSpecialWarn(true);
        }
      }
      // Boss enrage at 75% / 50% / 25% HP — boosts speed, damage, and projectile intensity
      const bossHpPct = e.hp / e.maxHp;
      const newBossEnrage = bossHpPct <= 0.25 ? 3 : bossHpPct <= 0.50 ? 2 : bossHpPct <= 0.75 ? 1 : 0;
      if (newBossEnrage > e.enragePhase) {
        e.enragePhase = newBossEnrage;
        e.moveSpeed = e.baseMoveSpeed * (1 + newBossEnrage * 0.15);
        e.damage = Math.round(e.baseDamage * (1 + newBossEnrage * 0.20));
        e.hitFlashTimer = 0.5;
        if (newBossEnrage >= 2) { e.emissive = "#660000"; }
        if (newBossEnrage >= 3) { e.emissive = "#aa0000"; }
        audioManager.play("boss_special");
      }
      // Boss radial projectile burst — scales with enrage phase
      e.radialTimer -= delta;
      const burstInterval = e.enragePhase >= 3 ? 3.5 : e.enragePhase >= 2 ? 4.0 : 5.0;
      if (e.radialTimer <= 0) {
        e.radialTimer = burstInterval;
        const BURST_COUNT = e.enragePhase >= 3 ? 16 : e.enragePhase >= 2 ? 12 : 10;
        const projSpeed = e.enragePhase >= 3 ? 11 : e.enragePhase >= 2 ? 10 : 9;
        for (let i = 0; i < BURST_COUNT; i++) {
          const angle = (i / BURST_COUNT) * Math.PI * 2;
          g.enemyProjectiles.push({
            id: eprojId(), x: e.x, z: e.z,
            vx: Math.sin(angle) * projSpeed,
            vz: Math.cos(angle) * projSpeed,
            damage: e.damage * 0.5,
            lifetime: 4.5, dead: false, style: "default" as const,
          });
        }
        audioManager.play("boss_special");
      }

      // Boss minion spawn every 10s
      e.minionTimer -= delta;
      if (e.minionTimer <= 0) {
        e.minionTimer = 10.0;
        const count = 1 + Math.floor(Math.random() * 2);
        for (let i = 0; i < count; i++) {
          g.enemies.push(spawnEnemy(g.wave, g.difficultyHpMult, g.difficultyDmgMult, g.difficultySpeedMult));
        }
      }

      // Sync boss HP to HUD each frame
      store.setBossState(e.hp, e.maxHp, ENEMY_DATA.boss.displayName, true);
    }

    // ── Champion AI (Trial of Champions) ──────────────────────────────────
    for (const e of g.enemies) {
      if (e.dead) continue;
      const isChamp = e.type === "warrior_champion" || e.type === "mage_champion" || e.type === "rogue_champion";
      if (!isChamp) continue;

      // ── Enrage phases at 75/50/25% HP ─────────────────────────────────
      const hpPct = e.hp / e.maxHp;
      const newEnrage = hpPct <= 0.25 ? 3 : hpPct <= 0.50 ? 2 : hpPct <= 0.75 ? 1 : 0;
      if (newEnrage > e.enragePhase) {
        const gain = newEnrage - e.enragePhase;
        e.enragePhase = newEnrage;
        e.moveSpeed = e.baseMoveSpeed * (1 + newEnrage * 0.20);
        e.damage = Math.round(e.baseDamage * (1 + newEnrage * 0.15));
        e.hitFlashTimer = 0.6 * gain;
        // Color shift toward red as enrage deepens
        if (newEnrage === 1) { e.emissive = "#330000"; }
        if (newEnrage === 2) { e.emissive = "#660000"; }
        if (newEnrage === 3) { e.emissive = "#aa0000"; store.setBossSpecialWarn(true); setTimeout(() => store.setBossSpecialWarn(false), 1000); }
        audioManager.play("boss_special");
      }

      // Sync champion to boss HP bar (show canonical name + class champion suffix)
      const champCls = e.type.replace("_champion", "");
      const champLabel = `${ENEMY_DATA[e.type as keyof typeof ENEMY_DATA].displayName} — ${champCls.charAt(0).toUpperCase() + champCls.slice(1)} Champion`;
      store.setBossState(e.hp, e.maxHp, champLabel, true);

      const cdx = p.x - e.x;
      const cdz = p.z - e.z;
      const cDist = Math.sqrt(cdx * cdx + cdz * cdz);

      if (e.type === "warrior_champion") {
        // ── Warrior Champion: stalks player, charged arc slash ────────────
        // Pursues the player, then STOPS and charges up a semi-circle
        // projectile burst (arc slash). Player must strafe to dodge.
        // minionTimer = arc slash cooldown (reused, unused otherwise)
        // specialTimer = ground slam cooldown (kept separate)
        const cx = p.x - e.x, cz = p.z - e.z;
        const clen = Math.sqrt(cx * cx + cz * cz) || 1;

        // Arc slash charge-up state: radialTimer > 0 means currently charging
        if (e.radialTimer > 0) {
          // ── Charging — STAND STILL, face the player ──
          e.radialTimer -= delta;
          e.vx = 0; e.vz = 0;
          if (e.radialTimer <= 0) {
            // Fire arc slash: crescent energy blade(s) toward player
            store.setBossSpecialWarn(false);
            const baseAngle = Math.atan2(cx, cz);
            const crescentCount = e.enragePhase >= 2 ? 3 : e.enragePhase >= 1 ? 2 : 1;
            const projSpeed = 8 + e.enragePhase * 1.5;
            const projDmg = e.damage * 1.2;
            for (let k = 0; k < crescentCount; k++) {
              const spread = crescentCount > 1 ? (k - (crescentCount - 1) / 2) * 0.4 : 0;
              const shotAngle = baseAngle + spread;
              g.enemyProjectiles.push({
                id: eprojId(), x: e.x, z: e.z,
                vx: Math.sin(shotAngle) * projSpeed,
                vz: Math.cos(shotAngle) * projSpeed,
                damage: projDmg,
                lifetime: 2.5, dead: false, style: "crescent" as const,
              });
            }
            audioManager.play("boss_special");
            triggerShake(g, 0.35, 0.25);
          }
        } else {
          // ── Pursuit phase — walk toward player ──
          const pursuitSpeed = e.moveSpeed * 0.65;
          e.x += (cx / clen) * pursuitSpeed * delta;
          e.z += (cz / clen) * pursuitSpeed * delta;
          e.x = Math.max(-ARENA, Math.min(ARENA, e.x));
          e.z = Math.max(-ARENA, Math.min(ARENA, e.z));

          // Start arc slash charge-up when in range
          e.minionTimer -= delta;
          if (e.minionTimer <= 0 && cDist <= 12) {
            e.minionTimer = 2.8 - e.enragePhase * 0.5; // much faster at higher enrage (2.8 / 2.3 / 1.8 / 1.3)
            e.radialTimer = 1.2; // 1.2s charge-up
            store.setBossSpecialWarn(true);
            audioManager.play("boss_special");
          }
        }

        // ── Ground slam special every 10s — secondary threat, arc slash is primary
        // Only triggers when NOT already charging an arc slash
        if (e.radialTimer <= 0) {
          e.specialTimer -= delta;
          if (e.specialTimer <= 0) {
            e.specialTimer = 10.0;
            // Reuse the existing boss slam mechanic: warn → AoE damage
            e.specialWarning = true;
            e.specialWarnTimer = 1.5;
            store.setBossSpecialWarn(true);
          }
        }
        // Ground slam landing (from specialWarning)
        if (e.specialWarning) {
          e.specialWarnTimer -= delta;
          e.vx = 0; e.vz = 0; // stand still during slam too
          if (e.specialWarnTimer <= 0) {
            e.specialWarning = false;
            store.setBossSpecialWarn(false);
            triggerShake(g, 0.55, 0.35);
            triggerFreeze(g, 45);
            if (cDist <= GAME_CONFIG.DIFFICULTY.BOSS_SPECIAL_RADIUS && p.invTimer <= 0 && !p.dead) {
              const rawDmg = e.damage * 1.5;
              const effective = applyArmor(rawDmg, stats.armor, stats.incomingDamageMult);
              p.hp -= effective; spawnPlayerDmgPopup(p, effective);
              p.invTimer = GAME_CONFIG.PLAYER.INVINCIBILITY_TIME;
              if (p.hp <= 0) { handlePlayerFatalDmg(p, g); } else { audioManager.play("player_hurt"); }
            }
            audioManager.play("boss_special");
          }
        }

      } else if (e.type === "mage_champion") {
        // ── Mage Champion: blinks around the arena, fires piercing orbs ────
        const keepDist = 14;
        const cx = p.x - e.x, cz = p.z - e.z;
        const clen = Math.sqrt(cx * cx + cz * cz) || 1;
        if (cDist < keepDist) {
          // Retreat
          e.x -= (cx / clen) * e.moveSpeed * delta;
          e.z -= (cz / clen) * e.moveSpeed * delta;
        } else if (cDist > keepDist + 4) {
          // Advance to preferred range
          e.x += (cx / clen) * e.moveSpeed * 0.6 * delta;
          e.z += (cz / clen) * e.moveSpeed * 0.6 * delta;
        }
        e.x = Math.max(-ARENA, Math.min(ARENA, e.x));
        e.z = Math.max(-ARENA, Math.min(ARENA, e.z));

        // Orb burst (reuse radialTimer)
        const burstCount = e.enragePhase >= 2 ? 5 : 3;
        e.radialTimer -= delta;
        if (e.radialTimer <= 0) {
          e.radialTimer = e.attackInterval;
          for (let k = 0; k < burstCount; k++) {
            const baseAngle = Math.atan2(p.x - e.x, p.z - e.z);
            const shotAngle = baseAngle + (k - (burstCount - 1) / 2) * 0.22;
            const speed = 11;
            g.enemyProjectiles.push({
              id: eprojId(), x: e.x, z: e.z,
              vx: Math.sin(shotAngle) * speed,
              vz: Math.cos(shotAngle) * speed,
              damage: e.damage, lifetime: 3.5, dead: false, style: "orb" as const,
            });
          }
          audioManager.play("boss_special");
        }

        // Blink teleport — repositions around the player on a timer so the
        // fight doesn't settle into a static kite. Ranges 10-16 units from
        // the player (just inside the orb burst's preferred distance). Also
        // fires a retaliation orb burst from the arrival point.
        e.minionTimer -= delta;
        if (e.minionTimer <= 0) {
          e.minionTimer = 4.5 - e.enragePhase * 0.8; // 4.5s → 2.9s in late phase
          const blinkAngle = Math.random() * Math.PI * 2;
          const blinkDist = 10 + Math.random() * 6;
          e.x = Math.max(-ARENA, Math.min(ARENA, p.x + Math.sin(blinkAngle) * blinkDist));
          e.z = Math.max(-ARENA, Math.min(ARENA, p.z + Math.cos(blinkAngle) * blinkDist));
          e.hitFlashTimer = 0.25;
          // Quick retaliation burst at the new position
          const postBurst = e.enragePhase >= 2 ? 4 : 3;
          for (let k = 0; k < postBurst; k++) {
            const baseAngle = Math.atan2(p.x - e.x, p.z - e.z);
            const shotAngle = baseAngle + (k - (postBurst - 1) / 2) * 0.28;
            g.enemyProjectiles.push({
              id: eprojId(), x: e.x, z: e.z,
              vx: Math.sin(shotAngle) * 11,
              vz: Math.cos(shotAngle) * 11,
              damage: e.damage, lifetime: 3.5, dead: false, style: "orb" as const,
            });
          }
          // Reset orb burst cooldown so the forced volley feels deliberate
          e.radialTimer = e.attackInterval * 0.8;
          audioManager.play("dash");
        }

      } else if (e.type === "rogue_champion") {
        // ── Rogue Champion: fast, rapid twin shots, periodic dash ─────
        // Circle-strafe around player at ~8 units distance
        const strafeAngle = Math.atan2(p.x - e.x, p.z - e.z) + 0.015 * e.moveSpeed;
        const targetX = p.x - Math.sin(strafeAngle) * 8;
        const targetZ = p.z - Math.cos(strafeAngle) * 8;
        const toX = targetX - e.x, toZ = targetZ - e.z;
        const toLen = Math.sqrt(toX * toX + toZ * toZ) || 1;
        e.x += (toX / toLen) * e.moveSpeed * delta;
        e.z += (toZ / toLen) * e.moveSpeed * delta;
        e.x = Math.max(-ARENA, Math.min(ARENA, e.x));
        e.z = Math.max(-ARENA, Math.min(ARENA, e.z));

        // Twin rapid shots
        e.radialTimer -= delta;
        if (e.radialTimer <= 0) {
          e.radialTimer = e.attackInterval;
          const baseAngle = Math.atan2(p.x - e.x, p.z - e.z);
          const spreadAmt = 0.18;
          for (let k = -1; k <= 1; k += 2) {
            const shotAngle = baseAngle + k * spreadAmt;
            const speed = 20;
            g.enemyProjectiles.push({
              id: eprojId(), x: e.x, z: e.z,
              vx: Math.sin(shotAngle) * speed,
              vz: Math.cos(shotAngle) * speed,
              damage: e.damage, lifetime: 1.5, dead: false, style: "dagger" as const,
            });
          }
        }

        // Teleport dash every 3s (minionTimer)
        e.minionTimer -= delta;
        if (e.minionTimer <= 0) {
          e.minionTimer = 3.0 - e.enragePhase * 0.5;
          const dashAngle = Math.random() * Math.PI * 2;
          const dashDist = 6 + Math.random() * 6;
          e.x = Math.max(-ARENA, Math.min(ARENA, p.x + Math.sin(dashAngle) * dashDist));
          e.z = Math.max(-ARENA, Math.min(ARENA, p.z + Math.cos(dashAngle) * dashDist));
          e.hitFlashTimer = 0.2;
          audioManager.play("dash");
        }

      }
    }

    // ── Stale boss HP bar safeguard ───────────────────────────────────────
    // If the HUD thinks a boss/champion is alive but there's no matching enemy
    // in g.enemies, clear the bar. Also auto-trigger trial victory if a trial
    // champion vanished without the flag being set (catches any missed kill
    // paths that marked it dead but didn't set trialChampionDefeated).
    if (useGameStore.getState().bossAlive) {
      const hasBossLike = g.enemies.some((e) => !e.dead && (e.type === "boss" || e.type.endsWith("_champion")));
      if (!hasBossLike) {
        store.setBossState(0, 0, "", false);
        store.setBossSpecialWarn(false);
        g.bossAlive = false;
        g.bossId = null;
        if (g.trialMode && !g.trialChampionDefeated) {
          g.trialChampionDefeated = true;
        }
      }
    }

    // ── Trial victory check ───────────────────────────────────────────────
    if (g.trialMode && g.trialChampionDefeated) {
      g.trialChampionDefeated = false;
      const meta = useMetaStore.getState();
      meta.completeTrial(g.charClass, useGameStore.getState().difficultyTier);
      const shardReward = Math.round(500 * g.difficultyShardMult);
      meta.addShards(shardReward);
      store.addRunShards(shardReward);
      // Transfer gear to stash
      for (const slot of ["weapon", "armor", "trinket"] as const) {
        const gear = g.equippedGear[slot];
        if (gear) meta.addGearToStash(gearToStash(gear));
      }
      store.setBossState(0, 0, "", false);
      audioManager.stopMusic();
      g.running = false;
      store.setPhase("trialvictory");
    }

    // ── Nemesis kill detection ────────────────────────────────────────────
    if (g.nemesisId) {
      const nem = g.enemies.find(e => e.id === g.nemesisId);
      if (nem && nem.dead) {
        g.nemesisId = null;
        store.setNemesisState(false, "NEMESIS DEFEATED!");
        setTimeout(() => { store.setNemesisState(false, ""); }, 3500);
        // Bonus rewards: 25 shards + 3 purple XP crystals
        useGameStore.getState().addRunShards(25);
        const purpleXp = Math.round(50 * stats.xpMultiplier);
        for (let i = 0; i < 3; i++) {
          g.xpOrbs.push({
            id: orbId(), x: nem.x + (Math.random() - 0.5) * 2, z: nem.z + (Math.random() - 0.5) * 2,
            value: purpleXp, collected: false, floatOffset: Math.random() * Math.PI * 2,
            crystalTier: "purple", collectTimer: 0,
          });
        }
        // Guaranteed common gear + low odds rare (8%) / epic (1.5%)
        const nemRoll = Math.random();
        const nemRarity = nemRoll < 0.015 ? "epic" as const : nemRoll < 0.095 ? "rare" as const : "common" as const;
        const nemGear = rollGearDrop(nemRarity);
        const dropX = nem.x + (Math.random() - 0.5) * 1.5;
        const dropZ = nem.z + (Math.random() - 0.5) * 1.5;
        g.gearDrops.push({
          id: gearId(), x: dropX, z: dropZ, gear: nemGear, floatOffset: Math.random() * Math.PI * 2, lifetime: 30,
        });
        const rarityColor = GEAR_RARITY_COLOR[nemRarity].text;
        spawnTextPopup(dropX, dropZ, `${nemGear.icon} ${nemGear.name}`, rarityColor, 2.5);
        audioManager.play("gear_drop");
      }
    }

    // ── Spawning (normal mode only) ───────────────────────────────────────
    if (!g.trialMode) {
      // Pause wave progression while a boss is alive. Without this, the wave
      // clock keeps ticking during boss fights, which:
      //   1. inflates g.wave past the next boss milestone (so the wave-10 boss
      //      is skipped entirely if the wave-5 fight lasted >30s),
      //   2. multiply-reduces g.spawnInterval (faster spawns forever after),
      //   3. breaks difficulty scaling across the rest of the run.
      // Regular enemy spawns are already gated on !g.bossAlive below, so
      // pausing the wave timer gives boss waves the correct "boss fight, then
      // full 30s of normal wave" structure.
      if (!g.bossAlive) g.waveTimer += delta;
      if (g.waveTimer >= GAME_CONFIG.DIFFICULTY.WAVE_DURATION) {
        g.waveTimer = 0;
        g.wave += 1;
        { const meta = useMetaStore.getState(); meta.updateBestWave(g.wave); meta.checkUnlocks(); }
        useGameStore.getState().addGuaranteedShards(25); // 25 soul shards per wave completed — persists on death
        g.spawnInterval = Math.max(
          GAME_CONFIG.DIFFICULTY.MIN_SPAWN_INTERVAL,
          g.spawnInterval - GAME_CONFIG.DIFFICULTY.SPAWN_REDUCTION
        );
        // Guaranteed goblin every 7 waves
        if (g.wave % 7 === 0 && g.goblinWaveSpawned !== g.wave) {
          g.goblinWaveSpawned = g.wave;
          g.enemies.push(spawnGoblin());
        }
        // Nemesis: 15% chance per wave after wave 10, max 1 per run
        if (g.wave >= 10 && !g.nemesisSpawned && Math.random() < 0.15) {
          g.nemesisSpawned = true;
          const nemesis = spawnNemesis(g.charClass, g.difficultyHpMult, g.difficultyDmgMult, g.difficultySpeedMult);
          g.nemesisId = nemesis.id;
          g.enemies.push(nemesis);
          store.setNemesisState(true, "YOUR NEMESIS APPROACHES!");
          audioManager.play("boss_spawn");
          setTimeout(() => { store.setNemesisState(useGameStore.getState().nemesisAlive, ""); }, 3500);
        }
        // Boss wave trigger
        const isBossWave = g.wave % GAME_CONFIG.DIFFICULTY.BOSS_WAVE_INTERVAL === 0 && !g.bossAlive;
        if (isBossWave) {
          const boss = spawnBoss(g.wave);
          g.enemies.push(boss);
          g.bossAlive = true;
          g.bossId = boss.id;
          store.setBossState(boss.maxHp, boss.maxHp, ENEMY_DATA.boss.displayName, true);
          audioManager.play("boss_spawn");
        } else {
          // Regular wave advance — short chime for feedback
          audioManager.play("wave_clear");
        }
      }
      // During boss wave, pause regular spawning while boss is alive
      if (!g.bossAlive) {
        g.spawnTimer += delta;
        if (g.spawnTimer >= g.spawnInterval) {
          g.spawnTimer = 0;
          g.enemies.push(spawnEnemy(g.wave, g.difficultyHpMult, g.difficultyDmgMult, g.difficultySpeedMult));
          // 8% random chance to also spawn a goblin (max 1 goblin at a time)
          if (Math.random() < 0.08 && !g.enemies.some((e) => e.type === "xp_goblin" && !e.dead)) {
            g.enemies.push(spawnGoblin());
          }
        }
      }
    }

    // ── Sync to UI store ──────────────────────────────────────────────────
    store.setPlayerHP(p.hp, p.maxHp);
    store.setPlayerPos(p.x, p.z, p.angle);
    store.setAttackState(p.attackTrigger, p.isDashing);
    store.setProgression(
      g.progression.level,
      g.progression.xp,
      g.progression.xpToNextLevel
    );
    // NOTE: store.setEnemies() and store.setXPOrbs() used to run here every
    // frame, projecting g.enemies / g.xpOrbs into EnemyUIState[] / XPOrbState[]
    // shapes. No UI component actually reads those store fields — the scene
    // graph renders directly from gs.current.enemies / gs.current.xpOrbs — so
    // those writes were pure allocation waste (~30+ objects/frame at wave 20).
    // The setters still exist on the store for future use; they just aren't
    // called on the hot path.
    store.setWaveInfo(g.wave, g.score, g.kills, g.survivalTime);
    store.setHighestBossWaveCleared(g.highestBossWaveCleared);

    // ── Sync active buffs/debuffs to UI store ────────────────────────────
    {
      const buffs: import("../store/gameStore").ActiveBuff[] = [];
      if (p.warCryTimer > 0)
        buffs.push({ id: "warcry", icon: "📯", label: "WAR CRY", value: p.warCryTimer, max: 4, isStacks: false, color: "#ff8844" });
      if (stats.bloodMomentumPerHit > 0 && p.momentumStacks > 0)
        buffs.push({ id: "momentum", icon: "🔴", label: "MOMENTUM", value: p.momentumStacks, max: 20, isStacks: true, color: "#ff4444" });
      if (p.critCascadeTimer > 0)
        buffs.push({ id: "critcascade", icon: "💫", label: "CRIT CASCADE", value: p.critCascadeTimer, max: 3, isStacks: false, color: "#ffcc00" });
      if (p.invisTimer > 0)
        buffs.push({ id: "invis", icon: "🌫️", label: "INVISIBLE", value: p.invisTimer, max: 1, isStacks: false, color: "#88ddff" });
      if (p.guaranteedCrit)
        buffs.push({ id: "guarcrit", icon: "🎯", label: "NEXT CRIT", value: 1, max: 1, isStacks: true, color: "#ffaa00" });
      if (p.singularityActiveTimer > 0)
        buffs.push({ id: "singularity", icon: "🌀", label: "SINGULARITY", value: p.singularityActiveTimer, max: 3, isStacks: false, color: "#aa44ff" });
      if (stats.overhealShieldPct > 0 && p.hp > p.maxHp)
        buffs.push({ id: "overheal", icon: "🧛", label: "OVERHEAL", value: Math.round(p.hp - p.maxHp), max: Math.round(p.maxHp * stats.overhealShieldPct), isStacks: true, color: "#ffcc44" });
      if (stats.hpDrainPerSec > 0)
        buffs.push({ id: "drain", icon: "💉", label: "DRAIN", value: stats.hpDrainPerSec, max: stats.hpDrainPerSec, isStacks: true, color: "#cc2222", isDebuff: true });
      store.setActiveBuffs(buffs);
    }

    // ── Game over ─────────────────────────────────────────────────────────
    if (p.dead) {
      g.running = false;
      if (g.score > store.bestScore) store.setBestScore(g.score, g.wave);
      // Transfer all gear to persistent stash — equipped + spare inventory
      const meta = useMetaStore.getState();
      for (const slot of ["weapon", "armor", "trinket"] as const) {
        const gear = g.equippedGear[slot];
        if (gear) {
          meta.addGearToStash(gearToStash(gear));
        }
      }
      for (const gear of g.inventory) {
        meta.addGearToStash(gearToStash(gear));
      }
      g.inventory = [];
      store.setInventory([]);
      // Wave-completion shards persist on death (25/wave guaranteed reward)
      const guaranteed = store.guaranteedShards;
      if (guaranteed > 0) {
        meta.addShards(guaranteed);
      }
      store.setPhase("gameover");
    }
  });

  return (
    <>
      <CameraController gs={gs} />
      <AimResolver gs={gs} />
      <Player3D gs={gs} />
      <AttackEffect x={playerX} z={playerZ} angle={playerAngle} triggerKey={attackTrigger} />
      <BossAoeRing gs={gs} />
      {gs.current?.enemies.filter((e) => !e.dead).map((e) => (
        <Enemy3D key={e.id} enemy={e} />
      ))}
      {gs.current?.xpOrbs.map((o) => (
        <XPOrb3D key={o.id} orb={o} />
      ))}
      {gs.current?.projectiles.filter((pr) => !pr.dead).map((pr) => (
        <Projectile3D key={pr.id} proj={pr} />
      ))}
      {gs.current?.enemyProjectiles.map((ep) => (
        <EnemyProjectile3D key={ep.id} ep={ep} />
      ))}
      {gs.current?.gearDrops.map((gd) => (
        <GearDrop3D key={gd.id} drop={gd} />
      ))}
      {gs.current?.deathFx.map((fx) => (
        <DeathFx3D key={fx.id} fx={fx} />
      ))}
      {gs.current?.groundEffects.map((ge) => (
        <GroundEffect3D key={ge.id} ge={ge} />
      ))}
      {/* Ability visual effects */}
      <AbilityEffects gs={gs} />
    </>
  );
}

// ─── Death FX renderer ───────────────────────────────────────────────────────

/**
 * Per-burst component: 7 puffs travelling along their assigned vectors plus a
 * brief expanding white flash plane. All animation is derived from `fx.age`,
 * which is advanced by the GameLoop (so it pauses naturally during hit-stop).
 */
function DeathFx3D({ fx }: { fx: DeathFx }) {
  const groupRef = useRef<THREE.Group>(null);
  const flashRef = useRef<THREE.Mesh>(null);
  const puffRefs = useRef<THREE.Mesh[]>([]);

  useFrame(() => {
    if (!groupRef.current) return;
    const t = fx.age;
    const u = Math.min(1, t / fx.duration); // normalized 0..1
    // ── Puffs: travel outward, gravity pulls down, fade out ──
    puffRefs.current.forEach((mesh, i) => {
      if (!mesh) return;
      const p = fx.puffs[i];
      if (!p) return;
      const gravity = -3.5;
      mesh.position.set(
        p.vx * t,
        Math.max(0.1, p.vy * t + 0.5 * gravity * t * t),
        p.vz * t,
      );
      const s = (1 - u) * 0.32 + 0.04;
      mesh.scale.setScalar(s);
      const mat = mesh.material as THREE.MeshStandardMaterial;
      mat.opacity = Math.max(0, 1 - u);
      mat.emissiveIntensity = 2 + (1 - u) * 3;
    });
    // ── White flash plane: expand quickly then fade ──
    if (flashRef.current) {
      const fu = Math.min(1, t / 0.2); // 0.2s flash
      const flashScale = 0.4 + fu * 2.4;
      flashRef.current.scale.set(flashScale, flashScale, flashScale);
      const fmat = flashRef.current.material as THREE.MeshStandardMaterial;
      fmat.opacity = Math.max(0, 1 - fu);
    }
  });

  return (
    <group ref={groupRef} position={[fx.x, 0, fx.z]}>
      {/* White expanding flash disk on the ground */}
      <mesh ref={flashRef} position={[0, 0.1, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.7, 16]} />
        <meshStandardMaterial
          color="#ffffff"
          emissive="#ffffff"
          emissiveIntensity={5}
          transparent
          opacity={1}
          depthWrite={false}
          side={THREE.DoubleSide}
        />
      </mesh>
      {/* Puff cloud */}
      {fx.puffs.map((_p, i) => (
        <mesh
          key={i}
          ref={(el) => { if (el) puffRefs.current[i] = el; }}
          position={[0, 0.5, 0]}
        >
          <sphereGeometry args={[1, 6, 6]} />
          <meshStandardMaterial
            color={fx.color}
            emissive={fx.color}
            emissiveIntensity={3}
            transparent
            opacity={1}
            depthWrite={false}
          />
        </mesh>
      ))}
    </group>
  );
}

// ─── Ground Effect (Residual Field trail) ────────────────────────────────────

function GroundEffect3D({ ge }: { ge: GroundEffect }) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame(() => {
    if (!ref.current) return;
    const opacity = Math.min(1, ge.lifetime * 0.8);
    const mat = ref.current.material as THREE.MeshStandardMaterial;
    mat.opacity = opacity;
    mat.emissiveIntensity = 1 + opacity * 2;
    ref.current.scale.setScalar(ge.radius * (0.7 + opacity * 0.3));
  });
  return (
    <mesh ref={ref} position={[ge.x, 0.05, ge.z]} rotation={[-Math.PI / 2, 0, 0]}>
      <circleGeometry args={[1, 12]} />
      <meshStandardMaterial
        color={ge.color}
        emissive={ge.color}
        emissiveIntensity={2}
        transparent
        opacity={0.6}
        depthWrite={false}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

// ─── Ability Visual Effects (all in one component for perf) ──────────────────

function AbilityEffects({ gs }: { gs: React.RefObject<GameState | null> }) {
  // Singularity vortex
  const vortexRef = useRef<THREE.Group>(null);
  const vortexRingRef = useRef<THREE.Mesh>(null);
  // Earthbreaker slam ring
  const slamRef = useRef<THREE.Mesh>(null);
  const slamTimer = useRef(0);
  const lastMeleeHitCount = useRef(0);
  // Blink flash
  const blinkRef = useRef<THREE.Mesh>(null);
  const blinkTimer = useRef(0);
  const blinkX = useRef(0);
  const blinkZ = useRef(0);
  // Knockback wave
  const kbRef = useRef<THREE.Mesh>(null);
  const kbTimer = useRef(0);
  // Poison trail
  const poisonRef = useRef<THREE.Mesh>(null);
  const poisonTimer = useRef(0);

  useFrame((_, delta) => {
    if (!gs.current) return;
    const g = gs.current;
    const p = g.player;
    const stats = g.progression.stats;

    // ── Singularity vortex ──
    if (vortexRef.current) {
      if (p.singularityActiveTimer > 0) {
        vortexRef.current.visible = true;
        vortexRef.current.position.set(p.singularityX, 0.15, p.singularityZ);
        vortexRef.current.rotation.y += delta * 3;
        const pulse = 1 + Math.sin(p.singularityActiveTimer * 5) * 0.15;
        vortexRef.current.scale.setScalar(pulse);
      } else {
        vortexRef.current.visible = false;
      }
    }
    if (vortexRingRef.current) {
      if (p.singularityActiveTimer > 0) {
        vortexRingRef.current.visible = true;
        vortexRingRef.current.position.set(p.singularityX, 0.2, p.singularityZ);
        vortexRingRef.current.rotation.z += delta * 5;
      } else {
        vortexRingRef.current.visible = false;
      }
    }

    // ── Earthbreaker slam ──
    if (slamRef.current) {
      // Detect earthbreaker trigger via meleeHitCounter reset
      if (stats.earthbreakerEnabled && p.meleeHitCounter === 0 && lastMeleeHitCount.current >= 5) {
        slamTimer.current = 0.4;
        slamRef.current.position.set(p.x, 0.12, p.z);
      }
      lastMeleeHitCount.current = p.meleeHitCounter;
      if (slamTimer.current > 0) {
        slamTimer.current -= delta;
        slamRef.current.visible = true;
        const t = 1 - slamTimer.current / 0.4;
        slamRef.current.scale.setScalar(t * stats.attackRange * 1.5);
        (slamRef.current.material as THREE.MeshBasicMaterial).opacity = (1 - t) * 0.7;
      } else {
        slamRef.current.visible = false;
      }
    }

    // ── Mage blink flash ──
    if (blinkRef.current) {
      if (g.charClass === "mage" && p.invTimer > 0 && !p.isDashing) {
        // Blink just happened if invTimer is fresh and player isn't dashing (blink is instant)
        if (blinkTimer.current <= 0) {
          blinkTimer.current = 0.3;
          blinkX.current = p.x;
          blinkZ.current = p.z;
        }
      }
      if (blinkTimer.current > 0) {
        blinkTimer.current -= delta;
        blinkRef.current.visible = true;
        blinkRef.current.position.set(blinkX.current, 0.5, blinkZ.current);
        const t = 1 - blinkTimer.current / 0.3;
        blinkRef.current.scale.setScalar(1 + t * 3);
        (blinkRef.current.material as THREE.MeshBasicMaterial).opacity = (1 - t) * 0.6;
      } else {
        blinkRef.current.visible = false;
      }
    }

    // ── Warrior knockback wave ──
    if (kbRef.current) {
      if (g.charClass === "warrior" && p.isDashing && kbTimer.current <= 0) {
        kbTimer.current = 0.25;
      }
      if (kbTimer.current > 0) {
        kbTimer.current -= delta;
        kbRef.current.visible = true;
        kbRef.current.position.set(p.x, 0.15, p.z);
        const t = 1 - kbTimer.current / 0.25;
        kbRef.current.scale.setScalar(1 + t * 4);
        (kbRef.current.material as THREE.MeshBasicMaterial).opacity = (1 - t * t) * 0.5;
      } else {
        kbRef.current.visible = false;
      }
    }

    // ── Rogue poison trail ──
    if (poisonRef.current) {
      if (g.charClass === "rogue" && p.isDashing) {
        poisonTimer.current = 0.4;
        poisonRef.current.position.set(p.x, 0.1, p.z);
      }
      if (poisonTimer.current > 0) {
        poisonTimer.current -= delta;
        poisonRef.current.visible = true;
        const t = 1 - poisonTimer.current / 0.4;
        poisonRef.current.scale.setScalar(1 + t * 2);
        (poisonRef.current.material as THREE.MeshBasicMaterial).opacity = (1 - t) * 0.45;
      } else {
        poisonRef.current.visible = false;
      }
    }
  });

  return (
    <>
      {/* Singularity vortex — dark swirling disc */}
      <group ref={vortexRef} visible={false}>
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.5, 8, 32]} />
          <meshBasicMaterial color="#6600cc" transparent opacity={0.35} side={THREE.DoubleSide} />
        </mesh>
        <pointLight color="#9900ff" intensity={4} distance={10} decay={2} />
      </group>
      <mesh ref={vortexRingRef} rotation={[-Math.PI / 2, 0, 0]} visible={false}>
        <torusGeometry args={[6, 0.12, 8, 32]} />
        <meshStandardMaterial color="#aa44ff" emissive="#8800dd" emissiveIntensity={3} transparent opacity={0.5} />
      </mesh>

      {/* Earthbreaker slam — expanding orange ring */}
      <mesh ref={slamRef} rotation={[-Math.PI / 2, 0, 0]} visible={false}>
        <ringGeometry args={[0.8, 1.0, 24]} />
        <meshBasicMaterial color="#ff8800" transparent opacity={0.7} side={THREE.DoubleSide} />
      </mesh>

      {/* Mage blink flash — expanding purple burst at arrival point */}
      <mesh ref={blinkRef} rotation={[-Math.PI / 2, 0, 0]} visible={false}>
        <circleGeometry args={[1, 16]} />
        <meshBasicMaterial color="#cc66ff" transparent opacity={0.6} side={THREE.DoubleSide} />
      </mesh>

      {/* Warrior knockback wave — expanding blue ring */}
      <mesh ref={kbRef} rotation={[-Math.PI / 2, 0, 0]} visible={false}>
        <ringGeometry args={[1.5, 2.0, 20]} />
        <meshBasicMaterial color="#4488ff" transparent opacity={0.5} side={THREE.DoubleSide} />
      </mesh>

      {/* Rogue poison trail — green ground cloud */}
      <mesh ref={poisonRef} rotation={[-Math.PI / 2, 0, 0]} visible={false}>
        <circleGeometry args={[1.5, 12]} />
        <meshBasicMaterial color="#30cc50" transparent opacity={0.4} side={THREE.DoubleSide} />
      </mesh>
    </>
  );
}

// ─── Gear Drop 3D — floating rarity-colored gem ──────────────────────────────

const GEAR_RARITY_3D: Record<string, { color: string; emissive: string; intensity: number; lightColor: string }> = {
  common: { color: "#a0a0b0", emissive: "#606070", intensity: 2, lightColor: "#8888aa" },
  rare:   { color: "#4488ff", emissive: "#2244cc", intensity: 4, lightColor: "#4488ff" },
  epic:   { color: "#bb66ff", emissive: "#8822dd", intensity: 5, lightColor: "#aa44ff" },
};

function GearDrop3D({ drop }: { drop: GearDropRuntime }) {
  const ref = useRef<THREE.Group>(null);
  const t = useRef(drop.floatOffset);

  useFrame((_, delta) => {
    t.current += delta;
    if (!ref.current) return;
    ref.current.position.set(drop.x, 0.6 + Math.sin(t.current * 2.5) * 0.2, drop.z);
    ref.current.rotation.y = t.current * 1.8;
    // Pulse scale slightly
    const pulse = 1 + Math.sin(t.current * 4) * 0.08;
    ref.current.scale.setScalar(pulse);
  });

  const style = GEAR_RARITY_3D[drop.gear.rarity] ?? GEAR_RARITY_3D.common;

  return (
    <group ref={ref}>
      {/* Base gem shape */}
      <mesh castShadow>
        <octahedronGeometry args={[0.28, 0]} />
        <meshStandardMaterial color={style.color} emissive={style.emissive} emissiveIntensity={style.intensity} roughness={0.1} metalness={0.5} />
      </mesh>
      {/* Outer glow shell */}
      <mesh>
        <octahedronGeometry args={[0.4, 0]} />
        <meshStandardMaterial color={style.emissive} emissive={style.emissive} emissiveIntensity={style.intensity * 0.4} transparent opacity={0.2} side={THREE.BackSide} />
      </mesh>
      {/* Inner diamond for epic rarity */}
      {drop.gear.rarity === "epic" && (
        <mesh rotation={[0.5, 0.5, 0]} scale={0.5}>
          <octahedronGeometry args={[0.28, 0]} />
          <meshStandardMaterial color="#ffffff" emissive="#cc88ff" emissiveIntensity={6} transparent opacity={0.6} />
        </mesh>
      )}
      <pointLight color={style.lightColor} intensity={style.intensity * 0.6} distance={5} decay={2} />
    </group>
  );
}

function EnemyProjectile3D({ ep }: { ep: EnemyProjectile }) {
  const ref = useRef<THREE.Group>(null);
  const t   = useRef(Math.random() * 100);
  useFrame((_, delta) => {
    t.current += delta;
    if (!ref.current) return;
    const yOff = ep.style === "crescent" ? 1.4 : 0.9 + Math.sin(t.current * 8) * 0.08;
    ref.current.position.set(ep.x, yOff, ep.z);
    if (ep.style === "dagger") {
      const angle = Math.atan2(ep.vx, ep.vz);
      ref.current.rotation.y = angle;
      ref.current.rotation.z = t.current * 12;
    } else if (ep.style === "crescent") {
      // Face travel direction, tilt forward slightly
      ref.current.rotation.y = Math.atan2(ep.vx, ep.vz);
      ref.current.rotation.x = -0.3;
    } else {
      ref.current.rotation.y = t.current * 6;
    }
  });

  // ── Mage champion orb ──
  if (ep.style === "orb") {
    return (
      <group ref={ref}>
        <mesh>
          <sphereGeometry args={[0.28, 8, 6]} />
          <meshStandardMaterial color="#9030d0" emissive="#cc00ff" emissiveIntensity={4} roughness={0.1} transparent opacity={0.9} />
        </mesh>
        <mesh>
          <sphereGeometry args={[0.38, 6, 4]} />
          <meshStandardMaterial color="#6010a0" emissive="#aa00ff" emissiveIntensity={1.5} transparent opacity={0.3} side={THREE.BackSide} />
        </mesh>
      </group>
    );
  }

  // ── Warrior champion crescent arc slash ──
  if (ep.style === "crescent") {
    return (
      <group ref={ref}>
        {/* Core crescent — partial torus (bright inner edge) */}
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[1.3, 0.18, 8, 32, Math.PI * 0.75]} />
          <meshStandardMaterial color="#ff4400" emissive="#ff2200" emissiveIntensity={8} roughness={0.05} metalness={0.9} />
        </mesh>
        {/* Outer glow shell — larger, softer */}
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[1.3, 0.35, 6, 32, Math.PI * 0.75]} />
          <meshStandardMaterial color="#ff6600" emissive="#ff4400" emissiveIntensity={3} transparent opacity={0.3} side={THREE.DoubleSide} />
        </mesh>
        {/* Inner bright edge — thinner, hotter core */}
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[1.3, 0.06, 6, 32, Math.PI * 0.75]} />
          <meshStandardMaterial color="#ffaa44" emissive="#ffcc66" emissiveIntensity={12} />
        </mesh>
        <pointLight color="#ff4400" intensity={6} distance={10} decay={2} />
      </group>
    );
  }

  // ── Legacy sword style (boss radial burst) ──
  if (ep.style === "sword") {
    return (
      <group ref={ref}>
        <mesh position={[0, 0, -0.3]}>
          <boxGeometry args={[0.08, 0.14, 0.6]} />
          <meshStandardMaterial color="#ff4400" emissive="#ff2200" emissiveIntensity={4} metalness={0.8} roughness={0.1} />
        </mesh>
        <pointLight color="#ff4400" intensity={2} distance={4} decay={2} />
      </group>
    );
  }

  // ── Rogue champion dagger ──
  if (ep.style === "dagger") {
    return (
      <group ref={ref}>
        <mesh position={[0, 0, -0.18]}>
          <boxGeometry args={[0.06, 0.06, 0.4]} />
          <meshStandardMaterial color="#40e8a0" emissive="#00dd66" emissiveIntensity={2.5} metalness={0.9} roughness={0.1} />
        </mesh>
        <mesh position={[0, 0, 0.04]}>
          <boxGeometry args={[0.16, 0.05, 0.05]} />
          <meshStandardMaterial color="#18b870" metalness={0.7} roughness={0.2} />
        </mesh>
      </group>
    );
  }

  // ── Default (wraith, boss) — purple diamond ──
  return (
    <group ref={ref}>
      <mesh>
        <octahedronGeometry args={[0.22, 0]} />
        <meshStandardMaterial color="#1a0030" emissive="#8800ff" emissiveIntensity={5} roughness={0.1} metalness={0.2} />
      </mesh>
    </group>
  );
}

// ─── Boss AoE warning ring ─────────────────────────────────────────────────────

function BossAoeRing({ gs }: { gs: React.RefObject<GameState | null> }) {
  const bossSpecialWarn = useGameStore((s) => s.bossSpecialWarn);
  const meshRef = useRef<THREE.Mesh>(null);
  const t = useRef(0);

  useFrame((_, delta) => {
    if (!meshRef.current) return;
    if (!bossSpecialWarn || !gs.current) {
      meshRef.current.visible = false;
      return;
    }
    const boss = gs.current.enemies.find((e) => e.type === "boss" && !e.dead);
    if (!boss) { meshRef.current.visible = false; return; }

    t.current += delta;
    meshRef.current.visible = true;
    meshRef.current.position.set(boss.x, 0.12, boss.z);
    const pulse = 0.85 + Math.sin(t.current * 10) * 0.15;
    meshRef.current.scale.setScalar(pulse);
  });

  const r = GAME_CONFIG.DIFFICULTY.BOSS_SPECIAL_RADIUS;
  return (
    <mesh ref={meshRef} rotation={[-Math.PI / 2, 0, 0]} visible={false}>
      <ringGeometry args={[r - 0.5, r, 48]} />
      <meshBasicMaterial color="#ff3300" transparent opacity={0.75} side={THREE.DoubleSide} />
    </mesh>
  );
}

// ─── Lighting ─────────────────────────────────────────────────────────────────

function Lighting() {
  return (
    <>
      <ambientLight color="#8070c0" intensity={1.4} />
      <directionalLight color="#c0b0ff" intensity={2.0} position={[5, 30, 15]} castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-camera-near={0.5} shadow-camera-far={120}
        shadow-camera-left={-40} shadow-camera-right={40}
        shadow-camera-top={40} shadow-camera-bottom={-40}
      />
      <directionalLight color="#806040" intensity={0.7} position={[-10, 15, -10]} />
      {/* Center arena overhead — guarantees player is lit */}
      <pointLight color="#a080e0" intensity={4} distance={45} decay={1.2} position={[0, 14, 0]} />
      {/* Interior warm accents */}
      <pointLight color="#ff8800" intensity={2} distance={28} decay={2} position={[-15, 4, -15]} />
      <pointLight color="#ff8800" intensity={2} distance={28} decay={2} position={[ 15, 4, -15]} />
      <pointLight color="#ff8800" intensity={2} distance={28} decay={2} position={[-15, 4,  15]} />
      <pointLight color="#ff8800" intensity={2} distance={28} decay={2} position={[ 15, 4,  15]} />
    </>
  );
}

// ─── Scene content (inside Canvas) ───────────────────────────────────────────

function SceneContent({ gs }: { gs: React.RefObject<GameState | null> }) {
  return (
    <>
      <Lighting />
      <fog attach="fog" args={["#050008", 55, 95]} />
      <DungeonRoom />
      {TORCH_POSITIONS.map((pos, i) => (
        <Torch3D key={i} position={pos} />
      ))}
      <GameLoop gs={gs} />
    </>
  );
}

// ─── GameScene (exported) ─────────────────────────────────────────────────────

interface GameSceneProps {
  onRestart: () => void;
}

export function GameScene({ onRestart }: GameSceneProps) {
  const phase = useGameStore((s) => s.phase);

  const gsRef = useRef<GameState | null>(null);

  // Initialize game state once
  if (!gsRef.current) {
    const cls = useGameStore.getState().selectedClass;
    const race = useGameStore.getState().selectedRace;
    const { progression, startHp } = makeProgWithMeta(cls, race);
    const input = new InputManager3D();
    const trialMode = useGameStore.getState().trialMode;
    const diffTier = useGameStore.getState().difficultyTier;
    const diff = DIFFICULTY_DATA[diffTier];
    const initEnemies: EnemyRuntime[] = trialMode
      ? [spawnChampion(cls, diff.enemyHpMult, diff.enemyDamageMult, diff.enemySpeedMult)]
      : [];
    const gs0: GameState = {
      player: makePlayer(startHp),
      enemies: initEnemies,
      xpOrbs: [],
      projectiles: [],
      score: 0, kills: 0, survivalTime: 0, wave: 1,
      spawnTimer: 0, waveTimer: 0,
      spawnInterval: GAME_CONFIG.DIFFICULTY.BASE_SPAWN_INTERVAL,
      charClass: cls,
      progression,
      input,
      running: false,
      bossAlive: false,
      bossId: null,
      enemyProjectiles: [],
      goblinWaveSpawned: 0,
      nemesisSpawned: false,
      nemesisId: null,
      trialMode,
      trialChampionDefeated: false,
      difficultyHpMult: diff.enemyHpMult,
      difficultyDmgMult: diff.enemyDamageMult,
      difficultySpeedMult: diff.enemySpeedMult,
      difficultyShardMult: diff.shardBonusMult,
      difficultyGearMult: diff.gearDropMult,
      highestBossWaveCleared: 0, gearDrops: [], equippedGear: { weapon: null, armor: null, trinket: null },
      inventory: [],
      shakeTimer: 0, shakeAmp: 0, shakeDur: 0.18, freezeUntil: 0, deathFx: [], groundEffects: [],
    };
    progression.onLevelUp = (_lvl, choices) => {
      audioManager.play("level_up");
      useGameStore.getState().setLevelUpChoices(choices);
      useGameStore.getState().setPhase("levelup");
    };
    gsRef.current = gs0;

    // Apply pre-run loadout from Soul Forge Armory
    const loadout = useMetaStore.getState().equippedLoadout;
    for (const slot of ["weapon", "armor", "trinket"] as const) {
      const stashItem = loadout[slot];
      if (!stashItem) continue;
      // Look up full GearDef from the pool to get the canonical bonuses
      const fullGear: GearDef = {
        id: stashItem.id, name: stashItem.name, slot: stashItem.slot as any,
        rarity: stashItem.rarity as any, icon: stashItem.icon,
        description: "", // not needed at runtime
        bonuses: stashItem.bonuses ?? {},
        enhanceLevel: stashItem.enhanceLevel ?? 0,
      };
      equipGear(fullGear, gs0);
      useGameStore.getState().setGearEquipped(slot, fullGear);
    }
    // Clear the loadout (gear is now consumed into the run)
    useMetaStore.getState().equippedLoadout = { weapon: null, armor: null, trinket: null };
  }

  // Start/stop/reset based on phase
  useEffect(() => {
    const g = gsRef.current!;
    if (phase === "playing") {
      // Music is centrally managed in App.tsx — no playMusic() here.
      // If the player is dead (e.g. restart after game-over), do a full reset
      if (g.player.dead) {
        const cls = useGameStore.getState().selectedClass;
        const race = useGameStore.getState().selectedRace;
        useGameStore.getState().setBossState(0, 0, "", false);
        useGameStore.getState().setBossSpecialWarn(false);
        const { progression: prog, startHp } = makeProgWithMeta(cls, race);
        prog.onLevelUp = (_lvl, choices) => {
          audioManager.play("level_up");
          useGameStore.getState().setLevelUpChoices(choices);
          useGameStore.getState().setPhase("levelup");
        };
        const resetTrialMode = useGameStore.getState().trialMode;
        const resetDiffTier = useGameStore.getState().difficultyTier;
        const resetDiff = DIFFICULTY_DATA[resetDiffTier];
        const resetInitEnemies: EnemyRuntime[] = resetTrialMode
          ? [spawnChampion(cls, resetDiff.enemyHpMult, resetDiff.enemyDamageMult, resetDiff.enemySpeedMult)]
          : [];
        gsRef.current = {
          player: makePlayer(startHp),
          enemies: resetInitEnemies,
          xpOrbs: [],
          projectiles: [],
          score: 0, kills: 0, survivalTime: 0, wave: 1,
          spawnTimer: 0, waveTimer: 0,
          spawnInterval: GAME_CONFIG.DIFFICULTY.BASE_SPAWN_INTERVAL,
          charClass: cls,
          progression: prog,
          input: g.input,
          running: true,
          bossAlive: false,
          bossId: null,
          enemyProjectiles: [],
          goblinWaveSpawned: 0,
          nemesisSpawned: false,
          nemesisId: null,
              trialMode: resetTrialMode,
          trialChampionDefeated: false,
          difficultyHpMult: resetDiff.enemyHpMult,
          difficultyDmgMult: resetDiff.enemyDamageMult,
          difficultySpeedMult: resetDiff.enemySpeedMult,
          difficultyShardMult: resetDiff.shardBonusMult,
          difficultyGearMult: resetDiff.gearDropMult,
          highestBossWaveCleared: 0, gearDrops: [], equippedGear: { weapon: null, armor: null, trinket: null },
          inventory: [],
          shakeTimer: 0, shakeAmp: 0, shakeDur: 0.18, freezeUntil: 0, deathFx: [], groundEffects: [],
        };
        _eid = 1; _oid = 1; _pid = 1; _epid = 1;
      } else {
        g.running = true;
      }
    } else if (phase === "gameover") {
      g.running = false;
      audioManager.stopMusic();
    }
  }, [phase]);

  // Extract run — awards a milestone-based shard bonus and ends the run voluntarily
  const handleExtract = useCallback(() => {
    const g = gsRef.current!;
    if (!g || g.player.dead) return;
    const cleared = g.highestBossWaveCleared;
    if (cleared <= 0) return;
    const fraction =
      cleared >= 20 ? 1.0 :
      cleared >= 15 ? 0.75 :
      cleared >= 10 ? 0.50 :
      0.25;
    const runShards = useGameStore.getState().shardsThisRun;
    const bonus = Math.round(fraction * runShards);
    useGameStore.getState().setExtractedBonusShards(bonus);
    if (bonus > 0) {
      useMetaStore.getState().addShards(bonus);
    }
    useGameStore.getState().setRunExtracted(true);
    // Transfer gear to stash on extraction — both equipped and spare inventory
    for (const slot of ["weapon", "armor", "trinket"] as const) {
      const gear = g.equippedGear[slot];
      if (gear) useMetaStore.getState().addGearToStash(gearToStash(gear));
    }
    for (const gear of g.inventory) {
      useMetaStore.getState().addGearToStash(gearToStash(gear));
    }
    g.inventory = [];
    useGameStore.getState().setInventory([]);
    // Mark player as dead so the restart useEffect triggers a full reset
    g.player.dead = true;
    g.running = false;
    audioManager.stopMusic();
    if (g.score > useGameStore.getState().bestScore) {
      useGameStore.getState().setBestScore(g.score, g.wave);
    }
    useGameStore.getState().setPhase("gameover");
  }, []);

  // Apply upgrade from level-up screen
  const handleUpgrade = useCallback((id: string) => {
    const g = gsRef.current!;
    g.progression.applyUpgrade(id as any);
    const stats = g.progression.stats;
    g.player.maxHp = stats.maxHealth;
    g.player.hp = Math.min(g.player.hp, g.player.maxHp);
    useGameStore.getState().applyUpgrade(id);
    useGameStore.getState().setPhase("playing");
  }, []);

  // Equip an item from the in-run inventory. If the target slot is already
  // occupied, the currently-equipped item goes back to the inventory (swap).
  // Safe to call while paused — pause menu is the only trigger path.
  const handleEquipFromInventory = useCallback((index: number) => {
    const g = gsRef.current;
    if (!g) return;
    const item = g.inventory[index];
    if (!item) return;
    const slot = item.slot;
    const previouslyEquipped = g.equippedGear[slot];
    // Remove the item from inventory first so equipGear doesn't see two refs
    const newInventory = [...g.inventory];
    newInventory.splice(index, 1);
    g.inventory = newInventory;
    // equipGear handles stat bonus math: subtracts old, applies new
    equipGear(item, g);
    // Put the previously-equipped item back into inventory if there was one
    if (previouslyEquipped) {
      g.inventory.push(previouslyEquipped);
    }
    const store = useGameStore.getState();
    store.setGearEquipped(slot, item);
    store.setInventory([...g.inventory]);
  }, []);

  // Sell a spare inventory item for shards (common 5 / rare 15 / epic 35).
  // Uses the same shard values as the Soul Forge gear stash so in-run and
  // extracted sells have consistent economy.
  const handleSellFromInventory = useCallback((index: number) => {
    const g = gsRef.current;
    if (!g) return;
    const item = g.inventory[index];
    if (!item) return;
    const value = item.rarity === "epic" ? 35 : item.rarity === "rare" ? 15 : 5;
    const newInventory = [...g.inventory];
    newInventory.splice(index, 1);
    g.inventory = newInventory;
    const store = useGameStore.getState();
    store.addRunShards(value);
    store.setInventory([...g.inventory]);
  }, []);

  // ESC → pause
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "Escape") {
        const cur = useGameStore.getState().phase;
        if (cur === "playing") useGameStore.getState().setPhase("paused");
        else if (cur === "paused") useGameStore.getState().setPhase("playing");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div style={{ width: "100%", height: "100%", position: "relative" }}>
      <Canvas
        shadows
        camera={{ fov: 50, near: 0.5, far: 200, position: [0, 28, 22] }}
        gl={{
          antialias: true,
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.1,
        }}
        style={{ background: "#050008", display: "block", width: "100%", height: "100%" }}
        onContextMenu={(e) => e.preventDefault()}
      >
        <SceneContent gs={gsRef} />
      </Canvas>

      {(phase === "playing" || phase === "paused" || phase === "levelup") && <HUD onExtract={handleExtract} />}
      {(phase === "playing" || phase === "paused" || phase === "levelup") && <DevHUD gsRef={gsRef} />}
      {phase === "playing" && <MobileControls gsRef={gsRef} />}
      {phase === "paused" && (
        <PauseMenu
          onExtract={handleExtract}
          onEquipFromInventory={handleEquipFromInventory}
          onSellFromInventory={handleSellFromInventory}
          gsRef={gsRef}
        />
      )}
      {phase === "levelup" && <LevelUp onChoice={handleUpgrade} />}
    </div>
  );
}
