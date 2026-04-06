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
import { RACE_DATA, type RaceType } from "../data/RaceData";
import { ProgressionManager } from "../systems/ProgressionManager";
import { createDefaultStats, type PlayerStats } from "../data/UpgradeData";
import { buildMetaModifiers } from "../data/MetaUpgradeData";
import { resolveStats } from "../data/StatModifier";
import { InputManager3D } from "./InputManager3D";
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
  // Boss/elite extended fields
  specialTimer: number;
  specialWarning: boolean;
  specialWarnTimer: number;
  minionTimer: number;
  radialTimer: number;
}

export type CrystalTier = "green" | "blue" | "purple" | "orange";

export interface XPOrb {
  id: string; x: number; z: number;
  value: number; collected: boolean; floatOffset: number;
  crystalTier: CrystalTier;
}

export interface EnemyProjectile {
  id: string;
  x: number; z: number;
  vx: number; vz: number;
  damage: number;
  lifetime: number;
  dead: boolean;
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
}

interface GameState {
  player: PlayerRuntime;
  enemies: EnemyRuntime[];
  xpOrbs: XPOrb[];
  projectiles: Projectile[];
  enemyProjectiles: EnemyProjectile[];
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
  stormCallTimer: number;
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
  };
  // 2. Resolve meta flat bonuses on top (Layer 1 — flat additions only)
  const metaMods = buildMetaModifiers(useMetaStore.getState().purchased);
  const resolved = resolveStats(classBase, metaMods);
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
function enemyId() { return `e${_eid++}`; }
function orbId()   { return `o${_oid++}`; }
function projId()  { return `p${_pid++}`; }
function eprojId() { return `ep${_epid++}`; }

const CRYSTAL_TIER: Record<string, CrystalTier> = {
  scuttler:  "green",
  wraith:    "blue",
  brute:     "blue",
  elite:     "purple",
  boss:      "orange",
  xp_goblin: "orange",
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
    specialTimer: 15.0, // despawn countdown
    specialWarning: false, specialWarnTimer: 0,
    minionTimer: 0, radialTimer: 0,
  };
}

// ─── Centralised player death handler ─────────────────────────────────────────
// Handles Death's Bargain relic — call this wherever player hp drops to 0.

function handlePlayerFatalDmg(p: PlayerRuntime, g: GameState): boolean {
  const stats = g.progression.stats;
  if (stats.deathBargainActive === 1) {
    p.hp = 1;
    stats.deathBargainActive = 0;
    p.invTimer = 2.0; // 2s of post-bargain invincibility
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
  const bonusShards = Math.round(g.wave * 15 + g.kills);
  if (bonusShards > 0) {
    useMetaStore.getState().addShards(bonusShards);
    store.addRunShards(bonusShards);
  }
  return true; // died
}

// ─── Soulfire relic — explosion on kill ───────────────────────────────────────

function triggerSoulfire(deadEnemy: EnemyRuntime, g: GameState): void {
  if (Math.random() > g.progression.stats.soulfireChance) return;
  const dmg = Math.round(g.progression.stats.damage * 2.0);
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

function spawnEnemy(wave: number): EnemyRuntime {
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
  const hpScale = 1 + wave * GAME_CONFIG.DIFFICULTY.HP_SCALE_PER_WAVE;
  return {
    id: enemyId(), type, x, z,
    hp: Math.round(def.health * hpScale),
    maxHp: Math.round(def.health * hpScale),
    damage: def.damage,
    moveSpeed: def.moveSpeed,
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
  };
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
  };
}

// ─── Camera + AimResolver ─────────────────────────────────────────────────────

function CameraController({ gs }: { gs: React.RefObject<GameState | null> }) {
  const { camera } = useThree();
  const target = useRef(new THREE.Vector3());

  useEffect(() => {
    camera.position.set(0, 28, 22);
    (camera as THREE.PerspectiveCamera).lookAt(0, 0, 0);
  }, [camera]);

  useFrame(() => {
    if (!gs.current) return;
    const p = gs.current.player;
    target.current.set(p.x, 28, p.z + 22);
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
  const enemies = useGameStore((s) => s.enemies);
  const xpOrbs = useGameStore((s) => s.xpOrbs);
  const attackTrigger = useGameStore((s) => s.attackTrigger);
  const playerX = useGameStore((s) => s.playerX);
  const playerZ = useGameStore((s) => s.playerZ);
  const playerAngle = useGameStore((s) => s.playerAngle);
  const cleaved = useRef(new Set<string>());

  useFrame((_, rawDelta) => {
    if (!gs.current || !gs.current.running) return;
    if (phase === "paused" || phase === "levelup") return;
    if (phase !== "playing") return;

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

      // Aim
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

        // Dash initiation
        if (input.dash && p.dashCooldown <= 0) {
          g.input.consumeDash();
          p.isDashing = true;
          audioManager.play("dash");
          p.dashTimer = GAME_CONFIG.PLAYER.DASH_DURATION;
          const dashDir = len > 0
            ? { x: mx, z: mz }
            : { x: Math.sin(p.angle), z: Math.cos(p.angle) };
          p.dashVX = dashDir.x * GAME_CONFIG.PLAYER.DASH_SPEED;
          p.dashVZ = dashDir.z * GAME_CONFIG.PLAYER.DASH_SPEED;
          p.invTimer = GAME_CONFIG.PLAYER.DASH_DURATION + 0.1;
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

            let dmg = stats.damage;
            const isCrit = Math.random() < stats.critChance;
            if (isCrit) dmg = Math.floor(dmg * 1.85);
            e.hp -= dmg;
            e.hitFlashTimer = 0.15;

            if (stats.doubleStrikeChance > 0 && Math.random() < stats.doubleStrikeChance) {
              e.hp -= dmg;
            }
            if (stats.lifesteal > 0) {
              p.hp = Math.min(p.maxHp, p.hp + dmg * stats.lifesteal);
            }
            if (e.hp <= 0) {
              e.dead = true;
              g.kills++;
              g.score += e.scoreValue;
              useMetaStore.getState().addShards(5);
              useGameStore.getState().addRunShards(5);
              if (stats.onKillHeal > 0) p.hp = Math.min(p.maxHp, p.hp + stats.onKillHeal);
              if (stats.soulfireChance > 0) triggerSoulfire(e, g);
              const xpGain = Math.round(e.xpReward * stats.xpMultiplier);
              g.xpOrbs.push({ id: orbId(), x: e.x, z: e.z, value: xpGain, collected: false, floatOffset: Math.random() * Math.PI * 2, crystalTier: CRYSTAL_TIER[e.type] ?? "green" });
              if (e.type === "boss") {
                g.bossAlive = false; g.bossId = null;
                store.setBossState(0, 0, "", false);
                store.setBossSpecialWarn(false);
                audioManager.play("boss_death");
                useMetaStore.getState().unlockMilestone("boss_kill");
                useMetaStore.getState().checkUnlocks();
              } else {
                audioManager.play("enemy_death");
              }
            }
          }
          // Phantom Echo relic: every Nth attack, fire a free bonus sweep at 70% damage
          if (stats.phantomEchoEvery > 0) {
            p.echoAttackCounter++;
            if (p.echoAttackCounter % stats.phantomEchoEvery === 0) {
              const echoDmg = Math.round(stats.damage * 0.7);
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
                  if (stats.onKillHeal > 0) p.hp = Math.min(p.maxHp, p.hp + stats.onKillHeal);
                  if (stats.soulfireChance > 0) triggerSoulfire(e, g);
                  const xg = Math.round(e.xpReward * stats.xpMultiplier);
                  g.xpOrbs.push({ id: orbId(), x: e.x, z: e.z, value: xg, collected: false, floatOffset: Math.random() * Math.PI * 2, crystalTier: CRYSTAL_TIER[e.type] ?? "green" });
                }
              }
            }
          }
        } else {
          audioManager.play(g.charClass === "mage" ? "attack_orb" : "attack_dagger");
          // ── Projectile attack (Mage / Rogue) ───────────────────────────
          const def = CHARACTER_DATA[g.charClass];
          const count = def.projectileCount;
          for (let i = 0; i < count; i++) {
            const spread = count > 1 ? (i - (count - 1) / 2) * def.projectileSpread : 0;
            const angle = p.angle + spread;
            const projStyle = g.charClass === "mage" ? "orb" : "dagger";
            g.projectiles.push({
              id: projId(),
              x: p.x, z: p.z,
              vx: Math.sin(angle) * def.projectileSpeed,
              vz: Math.cos(angle) * def.projectileSpeed,
              damage: stats.damage,
              radius: def.projectileRadius,
              lifetime: def.projectileLifetime,
              piercing: def.projectilePiercing,
              hitIds: new Set(),
              color: def.accentColor,
              glowColor: def.color,
              style: projStyle,
              dead: false,
            });
            // Twin Fang proc — fire a second projectile with slight offset
            if (stats.doubleStrikeChance > 0 && Math.random() < stats.doubleStrikeChance) {
              const extraAngle = angle + (Math.random() - 0.5) * 0.25;
              g.projectiles.push({
                id: projId(),
                x: p.x, z: p.z,
                vx: Math.sin(extraAngle) * def.projectileSpeed,
                vz: Math.cos(extraAngle) * def.projectileSpeed,
                damage: stats.damage,
                radius: def.projectileRadius,
                lifetime: def.projectileLifetime,
                piercing: def.projectilePiercing,
                hitIds: new Set(),
                color: def.accentColor,
                glowColor: def.color,
                style: projStyle,
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
          p.hp = Math.min(p.maxHp, p.hp + stats.healthRegen);
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

      // XP Goblin: flees player, despawns after 15s without dropping XP
      if (e.type === "xp_goblin") {
        e.specialTimer -= delta;
        if (e.specialTimer <= 0) { e.dead = true; continue; }
        if (dist > 0.1) {
          const speed = e.moveSpeed;
          e.vx = THREE.MathUtils.lerp(e.vx, -(edx / dist) * speed, 0.12);
          e.vz = THREE.MathUtils.lerp(e.vz, -(edz / dist) * speed, 0.12);
          e.x += e.vx * delta;
          e.z += e.vz * delta;
        }
        e.x = Math.max(-ARENA, Math.min(ARENA, e.x));
        e.z = Math.max(-ARENA, Math.min(ARENA, e.z));
        continue; // goblins don't attack
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
            lifetime: 4.5, dead: false,
          });
        }
      }

      // Elite AoE ground slam
      if (e.type === "elite") {
        e.specialTimer -= delta;
        if (e.specialTimer <= 0) {
          e.specialTimer = 2.5 + Math.random() * 0.5;
          if (dist <= 3.5 && !p.dead && p.invTimer <= 0 && !p.isDashing) {
            const rawDmg = e.damage * 1.4 * (1 + g.wave * GAME_CONFIG.DIFFICULTY.DAMAGE_SCALE_PER_WAVE);
            const isDodged = stats.dodgeChance > 0 && Math.random() < stats.dodgeChance;
            if (!isDodged) {
              const effective = Math.max(1, (rawDmg - stats.armor) * stats.incomingDamageMult);
              p.hp -= effective;
              p.invTimer = GAME_CONFIG.PLAYER.INVINCIBILITY_TIME * 0.8;
              if (p.hp <= 0) { handlePlayerFatalDmg(p, g); }
              else { audioManager.play("player_hurt"); }
            }
          }
        }
      }

      // Move toward player
      if (dist > e.attackRange) {
        const speed = e.phasing ? e.moveSpeed * 1.6 : e.moveSpeed;
        e.vx = THREE.MathUtils.lerp(e.vx, (edx / dist) * speed, 0.15);
        e.vz = THREE.MathUtils.lerp(e.vz, (edz / dist) * speed, 0.15);
        e.x += e.vx * delta;
        e.z += e.vz * delta;
      }

      // Attack player
      if (dist <= e.attackRange) {
        e.attackTimer -= delta;
        if (e.attackTimer <= 0) {
          e.attackTimer = e.attackInterval;
          if (p.invTimer <= 0 && !p.isDashing && !p.dead) {
            const rawDmg = e.damage * (1 + g.wave * GAME_CONFIG.DIFFICULTY.DAMAGE_SCALE_PER_WAVE);
            const effective = Math.max(1, (rawDmg - stats.armor) * stats.incomingDamageMult);
            const isDodged = stats.dodgeChance > 0 && Math.random() < stats.dodgeChance;
            if (!isDodged) {
              p.hp -= effective;
              p.invTimer = GAME_CONFIG.PLAYER.INVINCIBILITY_TIME;
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

    // Remove dead enemies after a moment
    g.enemies = g.enemies.filter((e) => !e.dead);

    // ── Projectiles ───────────────────────────────────────────────────────
    for (const proj of g.projectiles) {
      if (proj.dead) continue;
      proj.x += proj.vx * delta;
      proj.z += proj.vz * delta;
      proj.lifetime -= delta;
      if (proj.lifetime <= 0 || Math.abs(proj.x) > ARENA + 4 || Math.abs(proj.z) > ARENA + 4) {
        proj.dead = true;
        continue;
      }
      for (const e of g.enemies) {
        if (e.dead || proj.hitIds.has(e.id)) continue;
        const pdx = proj.x - e.x;
        const pdz = proj.z - e.z;
        if (Math.sqrt(pdx * pdx + pdz * pdz) > proj.radius + e.collisionRadius) continue;

        let dmg = proj.damage;
        const isCrit = Math.random() < stats.critChance;
        if (isCrit) dmg = Math.floor(dmg * 1.85);
        e.hp -= dmg;
        e.hitFlashTimer = 0.15;
        if (stats.lifesteal > 0) {
          p.hp = Math.min(p.maxHp, p.hp + dmg * stats.lifesteal);
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
          useMetaStore.getState().addShards(5);
          useGameStore.getState().addRunShards(5);
          if (stats.onKillHeal > 0) p.hp = Math.min(p.maxHp, p.hp + stats.onKillHeal);
          if (stats.soulfireChance > 0) triggerSoulfire(e, g);
          const xpGain = Math.round(e.xpReward * stats.xpMultiplier);
          g.xpOrbs.push({ id: orbId(), x: e.x, z: e.z, value: xpGain, collected: false, floatOffset: Math.random() * Math.PI * 2, crystalTier: CRYSTAL_TIER[e.type] ?? "green" });
          if (e.type === "boss") {
            g.bossAlive = false; g.bossId = null;
            store.setBossState(0, 0, "", false);
            store.setBossSpecialWarn(false);
            audioManager.play("boss_death");
            useMetaStore.getState().unlockMilestone("boss_kill");
            useMetaStore.getState().checkUnlocks();
          } else {
            audioManager.play("enemy_death");
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
        if (Math.sqrt(hdx * hdx + hdz * hdz) < 0.9) {
          ep.dead = true;
          const rawDmg = ep.damage * (1 + g.wave * GAME_CONFIG.DIFFICULTY.DAMAGE_SCALE_PER_WAVE);
          const isDodged = stats.dodgeChance > 0 && Math.random() < stats.dodgeChance;
          if (!isDodged) {
            const effective = Math.max(1, (rawDmg - stats.armor) * stats.incomingDamageMult);
            p.hp -= effective;
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
      if (orb.collected) continue;
      const odx = p.x - orb.x;
      const odz = p.z - orb.z;
      if (Math.sqrt(odx * odx + odz * odz) <= pickupR) {
        orb.collected = true;
        audioManager.play("xp_pickup");
        g.progression.addXp(orb.value); // onLevelUp callback handles phase change
      }
    }
    g.xpOrbs = g.xpOrbs.filter((o) => !o.collected);

    // ── Boss special attack ────────────────────────────────────────────────
    for (const e of g.enemies) {
      if (e.dead || e.type !== "boss") continue;
      if (e.specialWarning) {
        e.specialWarnTimer -= delta;
        if (e.specialWarnTimer <= 0) {
          e.specialWarning = false;
          store.setBossSpecialWarn(false);
          // AoE damage lands
          const dist = Math.sqrt((p.x - e.x) ** 2 + (p.z - e.z) ** 2);
          if (dist <= GAME_CONFIG.DIFFICULTY.BOSS_SPECIAL_RADIUS && p.invTimer <= 0 && !p.dead) {
            const rawDmg = e.damage * 3;
            const effective = Math.max(100, (rawDmg - stats.armor) * stats.incomingDamageMult);
            p.hp -= effective;
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
      // Boss radial projectile burst every 5s
      e.radialTimer -= delta;
      if (e.radialTimer <= 0) {
        e.radialTimer = 5.0;
        const BURST_COUNT = 10;
        for (let i = 0; i < BURST_COUNT; i++) {
          const angle = (i / BURST_COUNT) * Math.PI * 2;
          g.enemyProjectiles.push({
            id: eprojId(), x: e.x, z: e.z,
            vx: Math.sin(angle) * 9,
            vz: Math.cos(angle) * 9,
            damage: e.damage * 0.75,
            lifetime: 4.5, dead: false,
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
          g.enemies.push(spawnEnemy(g.wave));
        }
      }

      // Sync boss HP to HUD each frame
      store.setBossState(e.hp, e.maxHp, ENEMY_DATA.boss.displayName, true);
    }

    // ── Storm Heart relic: auto-lightning every N seconds ────────────────
    if (stats.stormCallInterval > 0) {
      g.stormCallTimer -= delta;
      if (g.stormCallTimer <= 0) {
        g.stormCallTimer = stats.stormCallInterval;
        const targets = g.enemies.filter((e) => !e.dead).slice(0, 10);
        for (const t of targets) {
          const stormDmg = Math.round(stats.damage * 3.0);
          t.hp -= stormDmg; t.hitFlashTimer = 0.3;
          if (t.hp <= 0 && !t.dead) {
            t.dead = true; g.kills++; g.score += t.scoreValue;
            if (stats.onKillHeal > 0) p.hp = Math.min(p.maxHp, p.hp + stats.onKillHeal);
            if (stats.soulfireChance > 0) triggerSoulfire(t, g);
            const xg = Math.round(t.xpReward * stats.xpMultiplier);
            g.xpOrbs.push({ id: orbId(), x: t.x, z: t.z, value: xg, collected: false, floatOffset: Math.random() * Math.PI * 2, crystalTier: CRYSTAL_TIER[t.type] ?? "green" });
            if (t.type === "boss") { g.bossAlive = false; g.bossId = null; store.setBossState(0, 0, "", false); }
          }
        }
      }
    }

    // ── Spawning ──────────────────────────────────────────────────────────
    g.waveTimer += delta;
    if (g.waveTimer >= GAME_CONFIG.DIFFICULTY.WAVE_DURATION) {
      g.waveTimer = 0;
      g.wave += 1;
      { const meta = useMetaStore.getState(); meta.updateBestWave(g.wave); meta.checkUnlocks(); }
      g.spawnInterval = Math.max(
        GAME_CONFIG.DIFFICULTY.MIN_SPAWN_INTERVAL,
        g.spawnInterval - GAME_CONFIG.DIFFICULTY.SPAWN_REDUCTION
      );
      // Guaranteed goblin every 7 waves
      if (g.wave % 7 === 0 && g.goblinWaveSpawned !== g.wave) {
        g.goblinWaveSpawned = g.wave;
        g.enemies.push(spawnGoblin());
      }
      // Boss wave trigger
      if (g.wave % GAME_CONFIG.DIFFICULTY.BOSS_WAVE_INTERVAL === 0 && !g.bossAlive) {
        const boss = spawnBoss(g.wave);
        g.enemies.push(boss);
        g.bossAlive = true;
        g.bossId = boss.id;
        store.setBossState(boss.maxHp, boss.maxHp, ENEMY_DATA.boss.displayName, true);
        audioManager.play("boss_spawn");
      }
    }
    // During boss wave, pause regular spawning while boss is alive
    if (!g.bossAlive) {
      g.spawnTimer += delta;
      if (g.spawnTimer >= g.spawnInterval) {
        g.spawnTimer = 0;
        g.enemies.push(spawnEnemy(g.wave));
        // 8% random chance to also spawn a goblin (max 1 goblin at a time)
        if (Math.random() < 0.08 && !g.enemies.some((e) => e.type === "xp_goblin" && !e.dead)) {
          g.enemies.push(spawnGoblin());
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
    store.setEnemies(
      g.enemies.map((e) => ({
        id: e.id, x: e.x, z: e.z,
        healthPct: e.hp / e.maxHp,
        type: e.type, dead: e.dead,
      }))
    );
    store.setXPOrbs(
      g.xpOrbs.map((o) => ({
        id: o.id, x: o.x, z: o.z,
        value: o.value, collected: o.collected,
      }))
    );
    store.setWaveInfo(g.wave, g.score, g.kills, g.survivalTime);

    // ── Game over ─────────────────────────────────────────────────────────
    if (p.dead) {
      g.running = false;
      if (g.score > store.bestScore) store.setBestScore(g.score, g.wave);
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
    </>
  );
}

function EnemyProjectile3D({ ep }: { ep: EnemyProjectile }) {
  const ref = useRef<THREE.Group>(null);
  const t   = useRef(Math.random() * 100);
  useFrame((_, delta) => {
    t.current += delta;
    if (ref.current) {
      ref.current.position.set(ep.x, 0.9 + Math.sin(t.current * 8) * 0.08, ep.z);
      ref.current.rotation.y = t.current * 6;
    }
  });
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
      <fog attach="fog" color="#050008" near={55} far={95} />
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
    const gs0: GameState = {
      player: makePlayer(startHp),
      enemies: [],
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
      stormCallTimer: 0,
    };
    progression.onLevelUp = (_lvl, choices) => {
      audioManager.play("level_up");
      useGameStore.getState().setLevelUpChoices(choices);
      useGameStore.getState().setPhase("levelup");
    };
    gsRef.current = gs0;
  }

  // Start/stop/reset based on phase
  useEffect(() => {
    const g = gsRef.current!;
    if (phase === "playing") {
      audioManager.playMusic();
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
        gsRef.current = {
          player: makePlayer(startHp),
          enemies: [],
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
          stormCallTimer: 0,
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

      {(phase === "playing" || phase === "paused" || phase === "levelup") && <HUD />}
      {phase === "paused" && <PauseMenu />}
      {phase === "levelup" && <LevelUp onChoice={handleUpgrade} />}
    </div>
  );
}
