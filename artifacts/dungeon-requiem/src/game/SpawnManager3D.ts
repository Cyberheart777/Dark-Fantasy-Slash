/**
 * SpawnManager3D.ts
 * Manages enemy spawning timing and position selection.
 */

import { GAME_CONFIG } from "../data/GameConfig";
import { ENEMY_DATA, pickEnemyType } from "../data/EnemyData";
import type { EnemyRuntimeData } from "./CombatManager3D";

let _nextId = 1;
function genId(): string { return `enemy_${_nextId++}`; }

export class SpawnManager3D {
  private timer = 0;
  private waveTimer = 0;
  private _wave = 0;
  private _interval: number;

  get wave(): number { return this._wave; }
  get interval(): number { return this._interval; }

  constructor() {
    this._interval = GAME_CONFIG.DIFFICULTY.BASE_SPAWN_INTERVAL;
  }

  update(delta: number): EnemyRuntimeData | null {
    this.timer += delta;
    this.waveTimer += delta;

    // Advance wave
    if (this.waveTimer >= GAME_CONFIG.DIFFICULTY.WAVE_DURATION) {
      this.waveTimer = 0;
      this._wave++;
      this._interval = Math.max(
        GAME_CONFIG.DIFFICULTY.MIN_SPAWN_INTERVAL,
        this._interval - GAME_CONFIG.DIFFICULTY.SPAWN_REDUCTION
      );
    }

    if (this.timer >= this._interval) {
      this.timer = 0;
      return this.spawnEnemy();
    }

    // Boss spawn every 8 waves
    return null;
  }

  spawnBoss(): EnemyRuntimeData {
    return this.createEnemy("boss");
  }

  private spawnEnemy(): EnemyRuntimeData {
    let type = pickEnemyType(this._wave);

    // Force elite/boss at thresholds
    if (
      this._wave >= GAME_CONFIG.DIFFICULTY.BOSS_SPAWN_START_WAVE &&
      Math.random() < 0.04
    ) {
      type = "boss";
    } else if (
      this._wave >= GAME_CONFIG.DIFFICULTY.ELITE_SPAWN_START_WAVE &&
      Math.random() < 0.08
    ) {
      type = "elite";
    }

    return this.createEnemy(type as any);
  }

  private createEnemy(type: keyof typeof ENEMY_DATA): EnemyRuntimeData {
    const def = ENEMY_DATA[type];
    const half = GAME_CONFIG.ARENA_HALF - 3;

    // Spawn on one of the four edges
    let x = 0, z = 0;
    const edge = Math.floor(Math.random() * 4);
    switch (edge) {
      case 0: x = Math.random() * half * 2 - half; z = -half; break;
      case 1: x = Math.random() * half * 2 - half; z = half; break;
      case 2: x = -half; z = Math.random() * half * 2 - half; break;
      case 3: x = half; z = Math.random() * half * 2 - half; break;
    }

    // Scale health with wave
    const hpScale = 1 + this._wave * GAME_CONFIG.DIFFICULTY.HP_SCALE_PER_WAVE;

    return {
      id: genId(),
      type,
      x,
      z,
      health: Math.round(def.health * hpScale),
      maxHealth: Math.round(def.health * hpScale),
      damage: def.damage,
      moveSpeed: def.moveSpeed,
      attackRange: def.attackRange,
      attackInterval: def.attackInterval,
      attackTimer: def.attackInterval * 0.5, // stagger first attack
      collisionRadius: def.collisionRadius,
      xpReward: def.xpReward,
      scoreValue: def.scoreValue,
      dead: false,
      hitFlashTimer: 0,
      scale: def.scale,
      color: def.color,
      emissive: def.emissive,
      vx: 0,
      vz: 0,
      phasing: false,
      phaseTimer: 0,
    };
  }

  reset(): void {
    this.timer = 0;
    this.waveTimer = 0;
    this._wave = 0;
    this._interval = GAME_CONFIG.DIFFICULTY.BASE_SPAWN_INTERVAL;
    _nextId = 1;
  }
}
