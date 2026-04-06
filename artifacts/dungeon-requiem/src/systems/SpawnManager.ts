/**
 * SpawnManager.ts
 * Controls enemy spawn rate, wave escalation, and enemy selection.
 * STEAM NOTE: Wave data can be loaded from external JSON for campaign-style runs.
 */

import Phaser from "phaser";
import { GAME_CONFIG } from "../data/GameConfig";
import { pickEnemyType, type EnemyType } from "../data/EnemyData";
import type { Enemy } from "../entities/Enemy";

export type SpawnCallback = (type: EnemyType, x: number, y: number) => Enemy;

export class SpawnManager {
  private scene: Phaser.Scene;
  private spawnCallback: SpawnCallback;
  private spawnTimer = 0;
  private waveTimer = 0;
  private _wave = 0;
  private _spawnInterval: number;
  private elapsedMs = 0;
  private bossSpawnedAtWave: Set<number> = new Set();

  onWaveChange?: (wave: number) => void;

  constructor(scene: Phaser.Scene, spawnCallback: SpawnCallback) {
    this.scene = scene;
    this.spawnCallback = spawnCallback;
    this._spawnInterval = GAME_CONFIG.DIFFICULTY.BASE_SPAWN_INTERVAL;
  }

  get wave(): number { return this._wave; }
  get spawnInterval(): number { return this._spawnInterval; }

  update(deltaMs: number): void {
    this.elapsedMs += deltaMs;
    this.spawnTimer += deltaMs;
    this.waveTimer += deltaMs;

    // Advance wave
    if (this.waveTimer >= GAME_CONFIG.DIFFICULTY.WAVE_DURATION) {
      this.waveTimer = 0;
      this._wave += 1;
      this._spawnInterval = Math.max(
        GAME_CONFIG.DIFFICULTY.MIN_SPAWN_INTERVAL,
        this._spawnInterval - GAME_CONFIG.DIFFICULTY.SPAWN_REDUCTION
      );
      this.onWaveChange?.(this._wave);
    }

    // Regular spawns
    if (this.spawnTimer >= this._spawnInterval) {
      this.spawnTimer = 0;
      this.spawnEnemy();
    }

    // Elite spawns every few waves starting at ELITE_SPAWN_START_WAVE
    if (this._wave >= GAME_CONFIG.DIFFICULTY.ELITE_SPAWN_START_WAVE) {
      const eliteInterval = Math.max(8000, 18000 - this._wave * 800);
      if (this.spawnTimer % eliteInterval < deltaMs * 2) {
        this.forceSpawn("elite");
      }
    }

    // Boss spawn at designated waves
    if (
      this._wave >= GAME_CONFIG.DIFFICULTY.BOSS_SPAWN_START_WAVE &&
      !this.bossSpawnedAtWave.has(this._wave) &&
      this._wave % 4 === 0
    ) {
      this.bossSpawnedAtWave.add(this._wave);
      this.forceSpawn("boss");
    }
  }

  private spawnEnemy(): void {
    const type = pickEnemyType(this._wave);
    const pos = this.getSpawnPosition();
    this.spawnCallback(type, pos.x, pos.y);
  }

  private forceSpawn(type: EnemyType): void {
    const pos = this.getSpawnPosition();
    this.spawnCallback(type, pos.x, pos.y);
  }

  /** Spawn enemies off-screen around the edges */
  private getSpawnPosition(): { x: number; y: number } {
    const cam = this.scene.cameras.main;
    const margin = 80;
    const cx = cam.scrollX + cam.width / 2;
    const cy = cam.scrollY + cam.height / 2;
    const hw = cam.width / 2 + margin;
    const hh = cam.height / 2 + margin;

    const side = Math.floor(Math.random() * 4);
    switch (side) {
      case 0: return { x: cx + Phaser.Math.Between(-hw, hw), y: cy - hh };
      case 1: return { x: cx + Phaser.Math.Between(-hw, hw), y: cy + hh };
      case 2: return { x: cx - hw, y: cy + Phaser.Math.Between(-hh, hh) };
      default: return { x: cx + hw, y: cy + Phaser.Math.Between(-hh, hh) };
    }
  }

  reset(): void {
    this._wave = 0;
    this._spawnInterval = GAME_CONFIG.DIFFICULTY.BASE_SPAWN_INTERVAL;
    this.spawnTimer = 0;
    this.waveTimer = 0;
    this.elapsedMs = 0;
    this.bossSpawnedAtWave.clear();
  }
}
