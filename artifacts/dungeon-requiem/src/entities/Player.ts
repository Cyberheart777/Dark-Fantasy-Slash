/**
 * Player.ts
 * Player entity — handles movement, attack, dash, and health.
 */

import Phaser from "phaser";
import { GAME_CONFIG } from "../data/GameConfig";
import type { PlayerStats } from "../data/UpgradeData";
import type { InputManager } from "../systems/InputManager";

export class Player extends Phaser.GameObjects.Container {
  // Stats reference (owned by ProgressionManager)
  stats: PlayerStats;

  private body_circle!: Phaser.GameObjects.Arc;
  private weapon_sprite!: Phaser.GameObjects.Rectangle;
  private glow!: Phaser.GameObjects.Arc;

  // Combat state
  private attackCooldown = 0;
  private dashCooldownLeft = 0;
  private isDashing = false;
  private dashTimer = 0;
  private dashVX = 0;
  private dashVY = 0;
  private invincibilityTimer = 0;
  private _isDead = false;

  // Health
  currentHealth: number;

  // Attack indicator arc (used for visual feedback)
  attackArcGraphics!: Phaser.GameObjects.Graphics;

  // Events
  onDeath?: () => void;
  onAttack?: (x: number, y: number, angle: number) => void;

  constructor(scene: Phaser.Scene, x: number, y: number, stats: PlayerStats) {
    super(scene, x, y);
    this.stats = stats;
    this.currentHealth = stats.maxHealth;
    this.buildGraphics();
    scene.add.existing(this);

    this.attackArcGraphics = scene.add.graphics();
    this.attackArcGraphics.setDepth(5);
  }

  private buildGraphics(): void {
    // Glow ring
    this.glow = this.scene.add.arc(0, 0, 22, 0, 360, false, 0x4488ff, 0.18);
    this.add(this.glow);

    // Body
    this.body_circle = this.scene.add.arc(0, 0, 18, 0, 360, false, 0xc8a460);
    this.body_circle.setStrokeStyle(2, 0xffd700);
    this.add(this.body_circle);

    // Helmet visor
    const visor = this.scene.add.arc(0, -6, 8, 0, 360, false, 0x4a6e8a);
    this.add(visor);

    // Weapon
    this.weapon_sprite = this.scene.add.rectangle(14, 0, 22, 5, 0xe0e0e0);
    this.weapon_sprite.setStrokeStyle(1, 0xaaaaaa);
    this.add(this.weapon_sprite);
  }

  get isDead(): boolean { return this._isDead; }

  update(input: InputManager, delta: number): void {
    if (this._isDead) return;

    input.setPlayerPosition(this.x, this.y);
    const state = input.state;

    // Cooldown timers
    if (this.attackCooldown > 0)    this.attackCooldown -= delta;
    if (this.dashCooldownLeft > 0)  this.dashCooldownLeft -= delta;
    if (this.invincibilityTimer > 0) this.invincibilityTimer -= delta;

    // Health regen
    if (this.stats.healthRegen > 0) {
      this.currentHealth = Math.min(
        this.stats.maxHealth,
        this.currentHealth + this.stats.healthRegen * (delta / 1000)
      );
    }

    // Dash
    if (this.isDashing) {
      this.dashTimer -= delta;
      this.x += this.dashVX * delta;
      this.y += this.dashVY * delta;
      if (this.dashTimer <= 0) {
        this.isDashing = false;
      }
    } else {
      // Normal movement
      if (state.moveX !== 0 || state.moveY !== 0) {
        this.x += state.moveX * this.stats.moveSpeed * (delta / 1000);
        this.y += state.moveY * this.stats.moveSpeed * (delta / 1000);
      }

      // Dash initiation
      if (state.dashJustPressed && this.dashCooldownLeft <= 0) {
        const dx = state.moveX || Math.cos(state.aimAngle);
        const dy = state.moveY || Math.sin(state.aimAngle);
        const mag = Math.sqrt(dx * dx + dy * dy) || 1;
        this.dashVX = (dx / mag) * GAME_CONFIG.PLAYER.DASH_SPEED / 1000;
        this.dashVY = (dy / mag) * GAME_CONFIG.PLAYER.DASH_SPEED / 1000;
        this.isDashing = true;
        this.dashTimer = GAME_CONFIG.PLAYER.DASH_DURATION;
        this.dashCooldownLeft = this.stats.dashCooldown;
        this.invincibilityTimer = Math.max(this.invincibilityTimer, GAME_CONFIG.PLAYER.DASH_DURATION + 100);
      }
    }

    // World boundary clamp (arena size 3000x3000)
    const HALF = 1500;
    this.x = Phaser.Math.Clamp(this.x, -HALF + 24, HALF - 24);
    this.y = Phaser.Math.Clamp(this.y, -HALF + 24, HALF - 24);

    // Rotate weapon toward aim
    const aimAngle = Math.atan2(
      state.aimY - this.y,
      state.aimX - this.x
    );
    this.setRotation(aimAngle);

    // Attack
    if (this.attackCooldown <= 0) {
      const attackInterval = 1000 / this.stats.attackSpeed;
      if (state.attack) {
        this.attackCooldown = attackInterval;
        this.onAttack?.(this.x, this.y, aimAngle);
        this.flashWeapon();
      }
    }

    // Invincibility blink
    this.setAlpha(this.invincibilityTimer > 0 ? (Math.sin(Date.now() * 0.03) > 0 ? 0.5 : 1) : 1);
  }

  private flashWeapon(): void {
    this.scene.tweens.add({
      targets: this.weapon_sprite,
      fillColor: 0xffffff,
      duration: 60,
      yoyo: true,
      onComplete: () => {
        if (this.weapon_sprite && this.weapon_sprite.active) {
          this.weapon_sprite.fillColor = 0xe0e0e0;
        }
      },
    });
  }

  takeDamage(amount: number): void {
    if (this._isDead || this.invincibilityTimer > 0 || this.isDashing) return;
    this.currentHealth -= amount;
    this.invincibilityTimer = GAME_CONFIG.PLAYER.INVINCIBILITY_FRAMES;

    // Hit flash
    this.scene.tweens.add({
      targets: this.body_circle,
      fillColor: 0xff2222,
      duration: GAME_CONFIG.FEEDBACK.HIT_FLASH_DURATION,
      yoyo: true,
      onComplete: () => {
        if (this.body_circle && this.body_circle.active) {
          this.body_circle.fillColor = 0xc8a460;
        }
      },
    });

    if (this.currentHealth <= 0) {
      this.currentHealth = 0;
      this._isDead = true;
      this.onDeath?.();
      this.deathEffect();
    }
  }

  heal(amount: number): void {
    this.currentHealth = Math.min(this.stats.maxHealth, this.currentHealth + amount);
  }

  isInvincible(): boolean {
    return this.invincibilityTimer > 0 || this.isDashing;
  }

  getDashCooldownPercent(): number {
    return Math.max(0, 1 - this.dashCooldownLeft / this.stats.dashCooldown);
  }

  private deathEffect(): void {
    this.scene.tweens.add({
      targets: this,
      alpha: 0,
      scaleX: 2,
      scaleY: 2,
      duration: GAME_CONFIG.FEEDBACK.DEATH_EFFECT_DURATION,
      ease: "Power2",
    });
    this.attackArcGraphics?.destroy();
  }

  destroy(fromScene?: boolean): void {
    this.attackArcGraphics?.destroy();
    super.destroy(fromScene);
  }
}
