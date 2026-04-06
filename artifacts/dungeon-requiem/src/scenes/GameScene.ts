/**
 * GameScene.ts
 * Core gameplay scene. Orchestrates all systems.
 * STEAM NOTE: This scene's structure supports both survival and future
 * stage-based modes. Mode can be passed via scene init data.
 */

import Phaser from "phaser";
import { GAME_CONFIG } from "../data/GameConfig";
import { ENEMY_DATA } from "../data/EnemyData";
import { UPGRADES, type UpgradeId } from "../data/UpgradeData";

import { Player } from "../entities/Player";
import { Enemy } from "../entities/Enemy";
import { DamagePopup } from "../ui/DamagePopup";
import type { HUDScene } from "../ui/HUD";

import { InputManager } from "../systems/InputManager";
import { CombatManager } from "../systems/CombatManager";
import { ProgressionManager } from "../systems/ProgressionManager";
import { SpawnManager } from "../systems/SpawnManager";
import type { GameOverData } from "./GameOverScene";
import { SaveManager } from "../data/SaveData";

const ARENA_HALF = 1500;

export class GameScene extends Phaser.Scene {
  private player!: Player;
  private enemies: Enemy[] = [];

  private inputMgr!: InputManager;
  private combatMgr!: CombatManager;
  private progressMgr!: ProgressionManager;
  private spawnMgr!: SpawnManager;

  private survivalMs = 0;
  private score = 0;
  private killCount = 0;
  private isLevelUpPending = false;
  private isPaused = false;
  private isGameOver = false;

  private floorGraphics!: Phaser.GameObjects.Graphics;
  private attackGraphics!: Phaser.GameObjects.Graphics;

  private hudScene!: HUDScene;

  // Track acquired upgrade display names for summary
  private acquiredUpgradeNames: string[] = [];

  constructor() {
    super({ key: GAME_CONFIG.SCENES.GAME });
  }

  create(): void {
    // Reset state
    this.enemies = [];
    this.survivalMs = 0;
    this.score = 0;
    this.killCount = 0;
    this.isLevelUpPending = false;
    this.isPaused = false;
    this.isGameOver = false;
    this.acquiredUpgradeNames = [];

    // Sync settings into registry
    const settings = SaveManager.getSettings();
    this.registry.set("settings", settings);

    // ── World ────────────────────────────────────────────
    this.buildArena();

    // ── Systems ──────────────────────────────────────────
    this.inputMgr  = new InputManager(this, settings.keybindings);
    this.combatMgr = new CombatManager(this);
    this.progressMgr = new ProgressionManager();
    this.spawnMgr  = new SpawnManager(this, this.spawnEnemy.bind(this));

    // ── Player ───────────────────────────────────────────
    this.player = new Player(this, 0, 0, this.progressMgr.stats);
    this.player.setDepth(5);
    this.player.onAttack = this.handlePlayerAttack.bind(this);
    this.player.onDeath  = this.handlePlayerDeath.bind(this);

    // ── Camera ───────────────────────────────────────────
    this.cameras.main.setBounds(-ARENA_HALF, -ARENA_HALF, ARENA_HALF * 2, ARENA_HALF * 2);
    this.cameras.main.startFollow(this.player, true, 0.08, 0.08);
    this.cameras.main.setZoom(1.0);

    // ── Attack graphics layer ────────────────────────────
    this.attackGraphics = this.add.graphics().setDepth(6);

    // ── HUD ──────────────────────────────────────────────
    this.scene.launch(GAME_CONFIG.SCENES.UI);
    this.hudScene = this.scene.get(GAME_CONFIG.SCENES.UI) as HUDScene;

    // ── Progression callbacks ─────────────────────────────
    this.progressMgr.onLevelUp = (level, choices) => {
      if (this.isGameOver) return;
      this.isLevelUpPending = true;
      this.scene.pause();
      this.scene.launch(GAME_CONFIG.SCENES.LEVEL_UP, {
        level,
        choices,
        onPick: (upgradeId: UpgradeId) => {
          this.isLevelUpPending = false;
          this.progressMgr.applyUpgrade(upgradeId);
          const name = UPGRADES[upgradeId]?.name ?? upgradeId;
          if (!this.acquiredUpgradeNames.includes(name)) {
            this.acquiredUpgradeNames.push(name);
          }
          // Sync player HP after upgrade
          this.player.currentHealth = this.progressMgr.stats.currentHealth;
        },
      });
    };

    // ── Spawn wave callbacks ──────────────────────────────
    this.spawnMgr.onWaveChange = (wave) => {
      this.hudScene?.showWaveBanner(wave);
      if (wave >= GAME_CONFIG.DIFFICULTY.BOSS_SPAWN_START_WAVE && wave % 4 === 0) {
        this.hudScene?.showBossBanner();
      }
    };

    // ── Pause key ────────────────────────────────────────
    this.input.keyboard?.addKey("ESC").on("down", () => {
      if (this.isGameOver || this.isLevelUpPending) return;
      if (!this.isPaused) {
        this.isPaused = true;
        this.scene.pause();
        this.scene.launch(GAME_CONFIG.SCENES.PAUSE);
        this.scene.bringToTop(GAME_CONFIG.SCENES.PAUSE);
      }
    });

    // Resume callback
    this.events.on("resume", () => { this.isPaused = false; });

    // Fade in
    this.cameras.main.fadeIn(500, 0, 0, 0);
  }

  private buildArena(): void {
    this.floorGraphics = this.add.graphics().setDepth(0);
    const g = this.floorGraphics;

    // Background fill
    g.fillStyle(0x090010);
    g.fillRect(-ARENA_HALF, -ARENA_HALF, ARENA_HALF * 2, ARENA_HALF * 2);

    // Stone tiles
    const TILE = 120;
    for (let tx = -ARENA_HALF; tx < ARENA_HALF; tx += TILE) {
      for (let ty = -ARENA_HALF; ty < ARENA_HALF; ty += TILE) {
        const shade = 0x0e0018 + Math.floor(Math.random() * 3) * 0x010000;
        g.fillStyle(shade);
        g.fillRect(tx + 1, ty + 1, TILE - 2, TILE - 2);
        g.lineStyle(1, 0x1a0025, 0.6);
        g.strokeRect(tx, ty, TILE, TILE);
      }
    }

    // Scattered dungeon details
    g.fillStyle(0x1a0025, 0.4);
    for (let i = 0; i < 180; i++) {
      const rx = (Math.random() - 0.5) * ARENA_HALF * 1.9;
      const ry = (Math.random() - 0.5) * ARENA_HALF * 1.9;
      g.fillRect(rx, ry, 6, 2);
    }

    // Border walls
    g.lineStyle(8, 0x330044);
    g.strokeRect(-ARENA_HALF, -ARENA_HALF, ARENA_HALF * 2, ARENA_HALF * 2);

    // Torches at corners
    const torchPositions = [
      [-ARENA_HALF + 60, -ARENA_HALF + 60],
      [ARENA_HALF - 60, -ARENA_HALF + 60],
      [-ARENA_HALF + 60, ARENA_HALF - 60],
      [ARENA_HALF - 60, ARENA_HALF - 60],
    ];
    for (const [tx, ty] of torchPositions) {
      g.fillStyle(0xff8800, 0.8);
      g.fillCircle(tx, ty, 10);
      g.fillStyle(0xff4400, 0.5);
      g.fillCircle(tx, ty, 18);
    }
  }

  private spawnEnemy(type: string, x: number, y: number): Enemy {
    const def = ENEMY_DATA[type as keyof typeof ENEMY_DATA];
    if (!def) return this.spawnEnemy("scuttler", x, y);

    const enemy = new Enemy(this, x, y, def, this.spawnMgr.wave);
    enemy.setDepth(3);

    enemy.onDeath = (e) => {
      this.killCount++;
      this.score += e.scoreValue * (1 + this.spawnMgr.wave * 0.1);
      this.score = Math.round(this.score);

      // XP
      this.progressMgr.addXp(e.xpReward);
      const settings = this.registry.get("settings") as { showDamageNumbers?: boolean } | undefined;
      if (settings?.showDamageNumbers !== false) {
        new DamagePopup(this, e.x, e.y, e.xpReward, false, true);
      }

      this.enemies = this.enemies.filter(en => en !== e);
    };

    enemy.onAttackPlayer = (damage, ex, ey) => {
      if (this.isGameOver) return;
      const { damage: finalDmg, dodged } = this.combatMgr.resolveEnemyAttack(damage, this.progressMgr.stats);
      if (dodged) {
        new DamagePopup(this, ex, ey - 20, 0, false, false);
        return;
      }
      this.player.takeDamage(finalDmg);
      const settings = this.registry.get("settings") as { showDamageNumbers?: boolean } | undefined;
      if (settings?.showDamageNumbers !== false) {
        new DamagePopup(this, this.player.x + Phaser.Math.Between(-20, 20), this.player.y - 20, finalDmg, false, false);
      }
      this.combatMgr.screenShake();
    };

    this.enemies.push(enemy);
    return enemy;
  }

  private handlePlayerAttack(px: number, py: number, aimAngle: number): void {
    const results = this.combatMgr.resolvePlayerAttack(
      px, py, aimAngle, this.progressMgr.stats, this.enemies
    );

    this.showAttackArc(px, py, aimAngle);

    let totalHeal = 0;
    const settings = this.registry.get("settings") as { showDamageNumbers?: boolean } | undefined;
    const showNums = settings?.showDamageNumbers !== false;

    results.forEach((result, enemy) => {
      this.combatMgr.applyDamage(enemy, result);
      totalHeal += result.lifestealHeal;

      if (showNums) {
        const offsetX = Phaser.Math.Between(-12, 12);
        new DamagePopup(this, enemy.x + offsetX, enemy.y - enemy.def.bodyRadius - 10, result.finalDamage, result.isCrit, false);
      }

      // Double strike
      if (this.progressMgr.stats.doubleStrikeChance > 0 && Math.random() < this.progressMgr.stats.doubleStrikeChance) {
        const r2 = this.combatMgr.calcDamage(this.progressMgr.stats, enemy, false);
        this.combatMgr.applyDamage(enemy, r2);
        if (showNums) {
          new DamagePopup(this, enemy.x, enemy.y - enemy.def.bodyRadius - 28, r2.finalDamage, r2.isCrit, false);
        }
      }
    });

    if (totalHeal > 0) {
      this.player.heal(totalHeal);
    }
  }

  private showAttackArc(px: number, py: number, aimAngle: number): void {
    const g = this.attackGraphics;
    g.clear();
    const stats = this.progressMgr.stats;
    const halfArc = Phaser.Math.DegToRad(stats.attackArc / 2);
    const startAngle = aimAngle - halfArc;
    const endAngle = aimAngle + halfArc;

    g.lineStyle(2, 0xffffff, 0.6);
    g.fillStyle(0xffffff, 0.08);
    g.beginPath();
    g.moveTo(px, py);
    g.arc(px, py, stats.attackRange, startAngle, endAngle, false);
    g.closePath();
    g.fillPath();
    g.strokePath();

    this.tweens.add({
      targets: g,
      alpha: 0,
      duration: 120,
      onComplete: () => { g.clear(); g.setAlpha(1); },
    });
  }

  private handlePlayerDeath(): void {
    this.isGameOver = true;
    this.combatMgr.screenShake(300, 12);

    this.time.delayedCall(1200, () => {
      const save = SaveManager.load();
      const isNewBest = this.score > save.bestScore;

      const data: GameOverData = {
        score: this.score,
        killCount: this.killCount,
        level: this.progressMgr.level,
        survivalTime: this.survivalMs / 1000,
        wave: this.spawnMgr.wave,
        acquiredUpgrades: this.acquiredUpgradeNames,
        isNewBestScore: isNewBest,
      };

      this.scene.stop(GAME_CONFIG.SCENES.UI);
      this.scene.start(GAME_CONFIG.SCENES.GAME_OVER, data);
    });
  }

  update(_time: number, delta: number): void {
    if (this.isPaused || this.isLevelUpPending || this.isGameOver) return;

    this.survivalMs += delta;

    // Player update
    this.inputMgr.update();
    this.player.update(this.inputMgr, delta);

    // Sync player HP changes back to stats (for HUD accuracy)
    this.progressMgr.stats.currentHealth = this.player.currentHealth;

    // Enemy updates
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      if (e.isDead || !e.active) continue;
      e.update(this.player.x, this.player.y, delta);
    }

    // Spawn system
    this.spawnMgr.update(delta);

    // HUD update
    const hudData = {
      currentHealth: this.player.currentHealth,
      maxHealth: this.progressMgr.stats.maxHealth,
      xpPercent: this.progressMgr.getXpPercent(),
      level: this.progressMgr.level,
      killCount: this.killCount,
      survivalSeconds: this.survivalMs / 1000,
      wave: this.spawnMgr.wave,
      dashCooldownPercent: this.player.getDashCooldownPercent(),
      upgrades: this.acquiredUpgradeNames,
    };
    this.hudScene?.updateHUD(hudData);
  }

  shutdown(): void {
    this.inputMgr?.destroy();
    this.enemies = [];
  }
}
