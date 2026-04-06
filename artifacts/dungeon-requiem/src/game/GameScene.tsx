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
  attackTimer: number; isAttacking: boolean; attackAngle: number;
  dead: boolean;
  regenTimer: number;
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
  // Boss-only fields (present but unused on regular enemies)
  specialTimer: number;
  specialWarning: boolean;
  specialWarnTimer: number;
}

export interface XPOrb {
  id: string; x: number; z: number;
  value: number; collected: boolean; floatOffset: number;
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

function makeProgWithMeta(cls: CharacterClass): { progression: ProgressionManager; startHp: number } {
  const def = CHARACTER_DATA[cls];
  // 1. Class base stats (flat, predictable starting point)
  const classBase: PlayerStats = {
    ...createDefaultStats(),
    maxHealth: def.hp, currentHealth: def.hp,
    damage: def.damage, attackSpeed: def.attackSpeed,
    moveSpeed: def.moveSpeed, armor: def.armor,
    dashCooldown: def.dashCooldown, critChance: def.critChance,
    attackRange: def.attackRange,
  };
  // 2. Resolve meta flat bonuses on top (Layer 1 — flat additions only)
  const metaMods = buildMetaModifiers(useMetaStore.getState().purchased);
  const resolved = resolveStats(classBase, metaMods);
  // Round integer stats after resolution to avoid floating-point HP
  resolved.maxHealth = Math.round(resolved.maxHealth);
  resolved.currentHealth = resolved.maxHealth;
  resolved.damage = Math.round(resolved.damage);
  // 3. Hand off to ProgressionManager — per-run upgrades (additive %) stack on top
  const progression = new ProgressionManager(resolved);
  return { progression, startHp: resolved.maxHealth };
}

// ─── ID generators ────────────────────────────────────────────────────────────

let _eid = 1;
let _oid = 1;
let _pid = 1;
function enemyId() { return `e${_eid++}`; }
function orbId()   { return `o${_oid++}`; }
function projId()  { return `p${_pid++}`; }

// ─── Factory helpers ──────────────────────────────────────────────────────────

function makePlayer(startHp: number = GAME_CONFIG.PLAYER.START_HEALTH): PlayerRuntime {
  return {
    x: 0, z: 0, angle: 0,
    hp: startHp,
    maxHp: startHp,
    invTimer: 0,
    dashTimer: 0, dashCooldown: 0,
    dashVX: 0, dashVZ: 0, isDashing: false,
    attackTimer: 0, isAttacking: false, attackAngle: 0,
    dead: false, regenTimer: 0,
  };
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
    specialTimer: 0, specialWarning: false, specialWarnTimer: 0,
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

const ATTACK_ARC_HALF = (GAME_CONFIG.PLAYER.ATTACK_ARC / 2) * (Math.PI / 180);
const ARENA = GAME_CONFIG.ARENA_HALF - 0.5;

function GameLoop({ gs }: { gs: React.RefObject<GameState | null> }) {
  const phase = useGameStore((s) => s.phase);
  const enemies = useGameStore((s) => s.enemies);
  const xpOrbs = useGameStore((s) => s.xpOrbs);
  const isAttacking = useGameStore((s) => s.isAttacking);
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
      if (p.attackTimer > 0) {
        p.attackTimer -= delta;
        if (p.attackTimer <= 0) p.isAttacking = false;
      }

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

      // Attack
      if (input.attack && p.attackTimer <= 0) {
        g.input.consumeAttack();
        const attackDuration = 1 / stats.attackSpeed;
        p.isAttacking = true;
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
            if (angleDiff > ATTACK_ARC_HALF) continue;
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
              const xpGain = Math.round(e.xpReward * stats.xpMultiplier);
              g.xpOrbs.push({ id: orbId(), x: e.x, z: e.z, value: xpGain, collected: false, floatOffset: Math.random() * Math.PI * 2 });
              if (e.type === "boss") {
                g.bossAlive = false; g.bossId = null;
                store.setBossState(0, 0, "", false);
                store.setBossSpecialWarn(false);
                audioManager.play("boss_death");
              } else {
                audioManager.play("enemy_death");
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
              style: g.charClass === "mage" ? "orb" : "dagger",
              dead: false,
            });
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

      // Wraith phasing
      if (e.type === "wraith") {
        e.phaseTimer -= delta;
        if (e.phaseTimer <= 0) {
          e.phasing = !e.phasing;
          e.phaseTimer = e.phasing ? 1.5 : 3.5;
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
            const effective = Math.max(1, rawDmg - stats.armor);
            const isDodged = stats.dodgeChance > 0 && Math.random() < stats.dodgeChance;
            if (!isDodged) {
              p.hp -= effective;
              p.invTimer = GAME_CONFIG.PLAYER.INVINCIBILITY_TIME;
              if (p.hp <= 0) {
                p.hp = 0;
                p.dead = true;
                audioManager.play("player_death");
                audioManager.stopMusic();
                store.setBossState(0, 0, "", false);
                store.setBossSpecialWarn(false);
                // Bonus shards for how far they got: waves survived + kills
                const bonusShards = Math.round(
                  g.wave * 15 + g.kills,
                );
                if (bonusShards > 0) {
                  useMetaStore.getState().addShards(bonusShards);
                  useGameStore.getState().addRunShards(bonusShards);
                }
              } else {
                audioManager.play("player_hurt");
              }
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
          const xpGain = Math.round(e.xpReward * stats.xpMultiplier);
          g.xpOrbs.push({ id: orbId(), x: e.x, z: e.z, value: xpGain, collected: false, floatOffset: Math.random() * Math.PI * 2 });
          if (e.type === "boss") {
            g.bossAlive = false; g.bossId = null;
            store.setBossState(0, 0, "", false);
            store.setBossSpecialWarn(false);
            audioManager.play("boss_death");
          } else {
            audioManager.play("enemy_death");
          }
        }
        if (!proj.piercing) break;
      }
    }
    g.projectiles = g.projectiles.filter((pr) => !pr.dead);

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
            const rawDmg = e.damage * 1.8;
            const effective = Math.max(1, rawDmg - stats.armor);
            p.hp -= effective;
            p.invTimer = GAME_CONFIG.PLAYER.INVINCIBILITY_TIME;
            if (p.hp <= 0) {
              p.hp = 0;
              p.dead = true;
              audioManager.play("player_death");
              audioManager.stopMusic();
              store.setBossState(0, 0, "", false);
              const bonusShards = Math.round(g.wave * 15 + g.kills);
              if (bonusShards > 0) {
                useMetaStore.getState().addShards(bonusShards);
                store.addRunShards(bonusShards);
              }
            } else {
              audioManager.play("player_hurt");
            }
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
      // Sync boss HP to HUD each frame
      store.setBossState(e.hp, e.maxHp, ENEMY_DATA.boss.displayName, true);
    }

    // ── Spawning ──────────────────────────────────────────────────────────
    g.waveTimer += delta;
    if (g.waveTimer >= GAME_CONFIG.DIFFICULTY.WAVE_DURATION) {
      g.waveTimer = 0;
      g.wave += 1;
      g.spawnInterval = Math.max(
        GAME_CONFIG.DIFFICULTY.MIN_SPAWN_INTERVAL,
        g.spawnInterval - GAME_CONFIG.DIFFICULTY.SPAWN_REDUCTION
      );
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
      }
    }

    // ── Sync to UI store ──────────────────────────────────────────────────
    store.setPlayerHP(p.hp, p.maxHp);
    store.setPlayerPos(p.x, p.z, p.angle);
    store.setAttackState(p.isAttacking, p.isDashing);
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
      <AttackEffect x={playerX} z={playerZ} angle={playerAngle} active={isAttacking} />
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
    </>
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
    const { progression, startHp } = makeProgWithMeta(cls);
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
        useGameStore.getState().setBossState(0, 0, "", false);
        useGameStore.getState().setBossSpecialWarn(false);
        const { progression: prog, startHp } = makeProgWithMeta(cls);
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
        };
        _eid = 1; _oid = 1; _pid = 1;
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
