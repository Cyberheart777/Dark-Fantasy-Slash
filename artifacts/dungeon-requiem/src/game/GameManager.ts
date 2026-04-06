/**
 * GameManager.ts
 * Orchestrates all game logic each frame.
 * Lives in a ref inside GameScene — no React state, just plain TS.
 */

import { GAME_CONFIG } from "../data/GameConfig";
import { ProgressionManager } from "../systems/ProgressionManager";
import { CombatManager3D } from "./CombatManager3D";
import { SpawnManager3D } from "./SpawnManager3D";
import { InputManager3D } from "./InputManager3D";
import type { EnemyRuntimeData } from "./CombatManager3D";
import type { UpgradeDef } from "../data/UpgradeData";
import { createDefaultStats } from "../data/UpgradeData";
import { useGameStore } from "../store/gameStore";

export interface PlayerRuntime {
  x: number;
  z: number;
  angle: number;         // Y-axis facing angle (radians)
  hp: number;
  maxHp: number;
  invincibleTimer: number;
  dashTimer: number;
  dashCooldown: number;
  dashVX: number;
  dashVZ: number;
  isDashing: boolean;
  attackTimer: number;
  isAttacking: boolean;
  attackAngle: number;
  dead: boolean;
  regenTimer: number;
}

export interface XPOrbRuntime {
  id: string;
  x: number;
  z: number;
  value: number;
  collected: boolean;
  floatOffset: number;
}

export interface DamageEvent {
  id: string;
  x: number;
  z: number;
  value: number;
  isCrit: boolean;
  isPlayer: boolean;
  time: number;
}

let _orbId = 0;
let _dmgId = 0;

export class GameManager {
  readonly input: InputManager3D;
  readonly progression: ProgressionManager;
  readonly combat: CombatManager3D;
  readonly spawn: SpawnManager3D;

  player: PlayerRuntime;
  enemies: EnemyRuntimeData[] = [];
  xpOrbs: XPOrbRuntime[] = [];
  damageEvents: DamageEvent[] = [];
  survivalTime = 0;
  score = 0;
  kills = 0;
  running = false;

  private cleaved = new Set<string>();
  private _pendingLevelUp: UpgradeDef[] | null = null;

  constructor() {
    this.input = new InputManager3D();
    this.progression = new ProgressionManager();
    this.combat = new CombatManager3D();
    this.spawn = new SpawnManager3D();
    this.player = this.createPlayer();

    this.progression.onLevelUp = (level, choices) => {
      this._pendingLevelUp = choices;
      useGameStore.getState().setLevelUpChoices(choices);
    };
  }

  start() {
    this.running = true;
  }

  stop() {
    this.running = false;
  }

  reset() {
    this.player = this.createPlayer();
    this.enemies = [];
    this.xpOrbs = [];
    this.damageEvents = [];
    this.survivalTime = 0;
    this.score = 0;
    this.kills = 0;
    this.progression.reset();
    this.spawn.reset();
    this._pendingLevelUp = null;
    _orbId = 0;
    _dmgId = 0;
  }

  applyUpgrade(id: string) {
    this.progression.applyUpgrade(id as any);
    // Sync player max HP if upgraded
    const stats = this.progression.stats;
    this.player.maxHp = stats.maxHealth;
    this.player.hp = Math.min(this.player.hp, this.player.maxHp);
    useGameStore.getState().applyUpgrade(id);
    useGameStore.getState().setPhase("playing");
    this._pendingLevelUp = null;
  }

  /** Called every frame by useFrame in GameScene */
  update(delta: number): void {
    if (!this.running) return;
    const store = useGameStore.getState();
    if (store.phase === "paused" || store.phase === "levelup") return;

    this.survivalTime += delta;

    this.updatePlayer(delta);
    this.updateEnemies(delta);
    this.updateXPOrbs();
    this.updateDamageEvents();

    // Spawn
    const newEnemy = this.spawn.update(delta);
    if (newEnemy) this.enemies.push(newEnemy);

    // Sync to store (throttled via direct zustand)
    const stats = this.progression.stats;
    store.setPlayerHP(this.player.hp, this.player.maxHp);
    store.setPlayerPos(this.player.x, this.player.z, this.player.angle);
    store.setProgression(
      this.progression.level,
      this.progression.xp,
      this.progression.xpToNextLevel
    );
    store.setWaveInfo(this.spawn.wave, this.score, this.kills, this.survivalTime);
    store.setAttackState(this.player.isAttacking, this.player.isDashing);
    store.setEnemies(
      this.enemies.map((e) => ({
        id: e.id,
        x: e.x,
        z: e.z,
        healthPct: e.health / e.maxHealth,
        type: e.type,
        dead: e.dead,
      }))
    );
    store.setXPOrbs(
      this.xpOrbs.map((o) => ({
        id: o.id,
        x: o.x,
        z: o.z,
        value: o.value,
        collected: o.collected,
      }))
    );

    // Game over
    if (this.player.dead) {
      this.running = false;
      const best = store.bestScore;
      if (this.score > best) {
        store.setBestScore(this.score, this.spawn.wave);
      }
      store.setPhase("gameover");
    }
  }

  private updatePlayer(delta: number): void {
    const input = this.input.state;
    const stats = this.progression.stats;
    const p = this.player;

    // Invincibility timer
    if (p.invincibleTimer > 0) p.invincibleTimer -= delta;

    // Dash cooldown
    if (p.dashCooldown > 0) p.dashCooldown -= delta;

    // Attack timer
    if (p.attackTimer > 0) {
      p.attackTimer -= delta;
      if (p.attackTimer <= 0) {
        p.isAttacking = false;
      }
    }

    // Aim angle: follow mouse/world aim
    const dx = input.worldAimX - p.x;
    const dz = input.worldAimZ - p.z;
    if (Math.abs(dx) > 0.1 || Math.abs(dz) > 0.1) {
      p.angle = Math.atan2(dx, dz);
    }

    // Dash
    if (p.isDashing) {
      p.dashTimer -= delta;
      if (p.dashTimer <= 0) {
        p.isDashing = false;
      } else {
        const newX = p.x + p.dashVX * delta;
        const newZ = p.z + p.dashVZ * delta;
        p.x = Math.max(-GAME_CONFIG.ARENA_HALF + 1, Math.min(GAME_CONFIG.ARENA_HALF - 1, newX));
        p.z = Math.max(-GAME_CONFIG.ARENA_HALF + 1, Math.min(GAME_CONFIG.ARENA_HALF - 1, newZ));
        return; // no normal movement during dash
      }
    }

    // Start dash
    if (input.dash && p.dashCooldown <= 0) {
      this.input.consumeDash();
      const moveX = (input.right ? 1 : 0) - (input.left ? 1 : 0);
      const moveZ = (input.down ? 1 : 0) - (input.up ? 1 : 0);
      const len = Math.sqrt(moveX * moveX + moveZ * moveZ);
      const nx = len > 0 ? moveX / len : Math.sin(p.angle);
      const nz = len > 0 ? moveZ / len : Math.cos(p.angle);
      p.dashVX = nx * stats.moveSpeed * 3;
      p.dashVZ = nz * stats.moveSpeed * 3;
      p.isDashing = true;
      p.dashTimer = GAME_CONFIG.PLAYER.DASH_DURATION;
      p.dashCooldown = stats.dashCooldown;
      p.invincibleTimer = GAME_CONFIG.PLAYER.DASH_DURATION + 0.1;
    }

    // Normal movement
    let moveX = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    let moveZ = (input.down ? 1 : 0) - (input.up ? 1 : 0);
    const len = Math.sqrt(moveX * moveX + moveZ * moveZ);
    if (len > 0) {
      moveX /= len;
      moveZ /= len;
      const spd = stats.moveSpeed;
      p.x = Math.max(-GAME_CONFIG.ARENA_HALF + 1, Math.min(GAME_CONFIG.ARENA_HALF - 1, p.x + moveX * spd * delta));
      p.z = Math.max(-GAME_CONFIG.ARENA_HALF + 1, Math.min(GAME_CONFIG.ARENA_HALF - 1, p.z + moveZ * spd * delta));
    }

    // Health regen
    if (stats.healthRegen > 0) {
      p.regenTimer += delta;
      if (p.regenTimer >= 1) {
        p.regenTimer -= 1;
        p.hp = Math.min(p.maxHp, p.hp + stats.healthRegen);
      }
    }

    // Attack
    if (input.attack && p.attackTimer <= 0) {
      this.input.consumeAttack();
      const attackDuration = 0.35 / stats.attackSpeed;
      p.attackTimer = 1 / stats.attackSpeed;
      p.isAttacking = true;
      p.attackAngle = p.angle;

      this.cleaved.clear();
      const { hits, playerHeal } = this.combat.resolvePlayerAttack(
        p.x, p.z, p.angle, stats, this.enemies, this.cleaved,
        stats.doubleStrikeChance > 0
      );

      if (playerHeal > 0) {
        p.hp = Math.min(p.maxHp, p.hp + playerHeal);
      }

      for (const { enemy, result } of hits) {
        this.pushDamageEvent(enemy.x, enemy.z, result.damage, result.isCrit, false);
        if (enemy.dead) {
          this.kills++;
          this.score += enemy.scoreValue;
          this.progression.addXp(enemy.xpReward);
          // Spawn XP orb
          this.xpOrbs.push({
            id: `orb_${_orbId++}`,
            x: enemy.x + (Math.random() - 0.5),
            z: enemy.z + (Math.random() - 0.5),
            value: enemy.xpReward,
            collected: false,
            floatOffset: Math.random() * Math.PI * 2,
          });
        }
      }
      // Clean dead
      this.enemies = this.enemies.filter((e) => !e.dead);
    }

    // Pause
    if (input.pause) {
      this.input.consumePause();
      const currentPhase = useGameStore.getState().phase;
      if (currentPhase === "playing") {
        useGameStore.getState().setPhase("paused");
      }
    }
  }

  private updateEnemies(delta: number): void {
    const p = this.player;
    const stats = this.progression.stats;

    for (const enemy of this.enemies) {
      if (enemy.dead) continue;

      // Hit flash
      if (enemy.hitFlashTimer > 0) enemy.hitFlashTimer -= delta;

      // Move toward player (simple seek)
      const dx = p.x - enemy.x;
      const dz = p.z - enemy.z;
      const dist = Math.sqrt(dx * dx + dz * dz);

      if (dist > enemy.attackRange) {
        // Separation from other enemies
        let sepX = 0, sepZ = 0;
        for (const other of this.enemies) {
          if (other === enemy || other.dead) continue;
          const ox = enemy.x - other.x;
          const oz = enemy.z - other.z;
          const od = Math.sqrt(ox * ox + oz * oz);
          if (od < 1.5 && od > 0.01) {
            sepX += ox / od;
            sepZ += oz / od;
          }
        }
        const sepLen = Math.sqrt(sepX * sepX + sepZ * sepZ);
        if (sepLen > 0) { sepX /= sepLen; sepZ /= sepLen; }

        const nx = dx / dist * 0.8 + sepX * 0.2;
        const nz = dz / dist * 0.8 + sepZ * 0.2;
        const speed = enemy.moveSpeed;
        enemy.vx = nx * speed;
        enemy.vz = nz * speed;

        const newX = enemy.x + enemy.vx * delta;
        const newZ = enemy.z + enemy.vz * delta;
        enemy.x = Math.max(-GAME_CONFIG.ARENA_HALF + 0.5, Math.min(GAME_CONFIG.ARENA_HALF - 0.5, newX));
        enemy.z = Math.max(-GAME_CONFIG.ARENA_HALF + 0.5, Math.min(GAME_CONFIG.ARENA_HALF - 0.5, newZ));
      }

      // Attack player
      enemy.attackTimer -= delta;
      if (dist <= enemy.attackRange + 0.5 && enemy.attackTimer <= 0) {
        enemy.attackTimer = enemy.attackInterval;
        if (p.invincibleTimer <= 0 && !p.dead) {
          const dmg = this.combat.resolveEnemyAttack(enemy.damage, this.spawn.wave, stats);
          if (dmg > 0) {
            p.hp -= dmg;
            p.invincibleTimer = GAME_CONFIG.PLAYER.INVINCIBILITY_TIME;
            this.pushDamageEvent(p.x, p.z, dmg, false, true);
            if (p.hp <= 0) {
              p.hp = 0;
              p.dead = true;
            }
          }
        }
      }
    }
  }

  private updateXPOrbs(): void {
    const p = this.player;
    const pickupR = GAME_CONFIG.PLAYER.PICKUP_RADIUS;
    for (const orb of this.xpOrbs) {
      if (orb.collected) continue;
      const dx = p.x - orb.x;
      const dz = p.z - orb.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      if (dist < pickupR) {
        orb.collected = true;
        // XP is already granted when enemy dies
      }
    }
    // Remove old collected orbs after 1 second (handled by component)
    this.xpOrbs = this.xpOrbs.filter((o) => !o.collected);
  }

  private updateDamageEvents(): void {
    const now = performance.now() / 1000;
    this.damageEvents = this.damageEvents.filter((e) => now - e.time < 0.8);
  }

  private pushDamageEvent(x: number, z: number, value: number, isCrit: boolean, isPlayer: boolean): void {
    const id = `dmg_${_dmgId++}`;
    const ev: DamageEvent = { id, x, z: z + (Math.random() - 0.5), value, isCrit, isPlayer, time: performance.now() / 1000 };
    this.damageEvents.push(ev);
    useGameStore.getState().addDamagePopup({ id, x, z, value, isCrit, isPlayer, spawnTime: performance.now() });
  }

  private createPlayer(): PlayerRuntime {
    const stats = createDefaultStats();
    return {
      x: 0,
      z: 0,
      angle: 0,
      hp: stats.maxHealth,
      maxHp: stats.maxHealth,
      invincibleTimer: 0,
      dashTimer: 0,
      dashCooldown: 0,
      dashVX: 0,
      dashVZ: 0,
      isDashing: false,
      attackTimer: 0,
      isAttacking: false,
      attackAngle: 0,
      dead: false,
      regenTimer: 0,
    };
  }
}
