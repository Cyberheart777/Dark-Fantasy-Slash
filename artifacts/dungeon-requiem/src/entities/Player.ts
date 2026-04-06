/**
 * Player.ts
 * Player entity using 16-bit pixel art sprite with walk/attack/dash animations.
 */

import Phaser from "phaser";
import { GAME_CONFIG } from "../data/GameConfig";
import type { PlayerStats } from "../data/UpgradeData";
import type { InputManager } from "../systems/InputManager";

export class Player extends Phaser.GameObjects.Container {
  stats: PlayerStats;

  private sprite!: Phaser.GameObjects.Sprite;
  private shadowEllipse!: Phaser.GameObjects.Ellipse;
  private glowCircle!: Phaser.GameObjects.Arc;

  // Combat state
  private attackCooldown = 0;
  private dashCooldownLeft = 0;
  private isDashing = false;
  private dashTimer = 0;
  private dashVX = 0;
  private dashVY = 0;
  private invincibilityTimer = 0;
  private _isDead = false;
  private isAttacking = false;

  currentHealth: number;

  attackArcGraphics!: Phaser.GameObjects.Graphics;

  onDeath?: () => void;
  onAttack?: (x: number, y: number, angle: number) => void;

  constructor(scene: Phaser.Scene, x: number, y: number, stats: PlayerStats) {
    super(scene, x, y);
    this.stats = stats;
    this.currentHealth = stats.maxHealth;
    this.buildSprite();
    scene.add.existing(this);

    this.attackArcGraphics = scene.add.graphics();
    this.attackArcGraphics.setDepth(5);
  }

  private buildSprite(): void {
    // Drop shadow
    this.shadowEllipse = this.scene.add.ellipse(0, 20, 38, 12, 0x000000, 0.35);
    this.add(this.shadowEllipse);

    // Glow ring (behind sprite)
    this.glowCircle = this.scene.add.arc(0, 0, 26, 0, 360, false, 0x4466ff, 0.12);
    this.add(this.glowCircle);

    // Pixel art sprite — 16x16 frames @ 3x = 48x48 display
    this.sprite = this.scene.add.sprite(0, 0, "player_sheet");
    this.sprite.setOrigin(0.5, 0.5);
    this.add(this.sprite);

    // Start idle animation
    this.sprite.play("player_idle");
  }

  get isDead(): boolean { return this._isDead; }

  update(input: InputManager, delta: number): void {
    if (this._isDead) return;

    input.setPlayerPosition(this.x, this.y);
    const state = input.state;

    // Timers
    if (this.attackCooldown > 0)     this.attackCooldown -= delta;
    if (this.dashCooldownLeft > 0)   this.dashCooldownLeft -= delta;
    if (this.invincibilityTimer > 0) this.invincibilityTimer -= delta;

    // Health regen
    if (this.stats.healthRegen > 0) {
      this.currentHealth = Math.min(
        this.stats.maxHealth,
        this.currentHealth + this.stats.healthRegen * (delta / 1000)
      );
    }

    const isMoving = state.moveX !== 0 || state.moveY !== 0;

    // Dash
    if (this.isDashing) {
      this.dashTimer -= delta;
      this.x += this.dashVX * delta;
      this.y += this.dashVY * delta;
      if (this.dashTimer <= 0) {
        this.isDashing = false;
        this.sprite.play("player_idle");
      }
    } else {
      // Movement
      if (isMoving) {
        this.x += state.moveX * this.stats.moveSpeed * (delta / 1000);
        this.y += state.moveY * this.stats.moveSpeed * (delta / 1000);
        if (!this.isAttacking && this.sprite.anims.currentAnim?.key !== "player_walk") {
          this.sprite.play("player_walk");
        }
      } else {
        if (!this.isAttacking && this.sprite.anims.currentAnim?.key !== "player_idle") {
          this.sprite.play("player_idle");
        }
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
        this.sprite.play("player_dash");
      }
    }

    // World bounds
    const HALF = 1500;
    this.x = Phaser.Math.Clamp(this.x, -HALF + 28, HALF - 28);
    this.y = Phaser.Math.Clamp(this.y, -HALF + 28, HALF - 28);

    // Rotate container toward aim direction
    const aimAngle = Math.atan2(
      state.aimY - this.y,
      state.aimX - this.x
    );
    this.setRotation(aimAngle);

    // Mirror sprite so it faces the right direction
    // When aiming left (angle > 90° or < -90°), flip sprite vertically on rotated axis
    const facingLeft = Math.abs(Phaser.Math.RadToDeg(aimAngle)) > 90;
    this.sprite.setFlipY(facingLeft);

    // Attack
    if (this.attackCooldown <= 0 && state.attack) {
      const attackInterval = 1000 / this.stats.attackSpeed;
      this.attackCooldown = attackInterval;
      this.onAttack?.(this.x, this.y, aimAngle);
      this.playAttackAnimation();
    }

    // Invincibility blink
    if (this.invincibilityTimer > 0) {
      this.sprite.setAlpha(Math.sin(Date.now() * 0.025) > 0 ? 0.5 : 1.0);
    } else {
      this.sprite.setAlpha(1);
    }
  }

  private playAttackAnimation(): void {
    this.isAttacking = true;
    this.sprite.play("player_attack");
    this.sprite.once("animationcomplete", () => {
      this.isAttacking = false;
      this.sprite.play("player_walk");
    });
  }

  takeDamage(amount: number): void {
    if (this._isDead || this.invincibilityTimer > 0 || this.isDashing) return;
    this.currentHealth -= amount;
    this.invincibilityTimer = GAME_CONFIG.PLAYER.INVINCIBILITY_FRAMES;

    // Hit flash (tint the sprite)
    this.sprite.setTint(0xff2222);
    this.sprite.play("player_hit");
    this.scene.time.delayedCall(GAME_CONFIG.FEEDBACK.HIT_FLASH_DURATION * 2, () => {
      if (this.sprite?.active) {
        this.sprite.clearTint();
        this.sprite.play("player_idle");
        this.isAttacking = false;
      }
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
    this.sprite.clearTint();
    this.scene.tweens.add({
      targets: this,
      alpha: 0,
      scaleX: 2.2,
      scaleY: 2.2,
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
