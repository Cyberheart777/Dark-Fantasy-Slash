/**
 * Enemy.ts
 * Enemy entity using 16-bit pixel art sprites with walk/idle animations.
 * Data-driven via EnemyDef — add new enemy types in EnemyData.ts.
 */

import Phaser from "phaser";
import { type EnemyDef } from "../data/EnemyData";
import { GAME_CONFIG } from "../data/GameConfig";
import { ENEMY_SPRITE_INFO } from "../assets/PixelArtGenerator";

export class Enemy extends Phaser.GameObjects.Container {
  def: EnemyDef;
  currentHealth: number;
  maxHealth: number;
  private _isDead = false;
  private attackTimer = 0;
  private wave: number;

  private sprite!: Phaser.GameObjects.Sprite;
  private shadowEllipse!: Phaser.GameObjects.Ellipse;
  private healthBarBg!: Phaser.GameObjects.Rectangle;
  private healthBarFg!: Phaser.GameObjects.Rectangle;
  private glowRing?: Phaser.GameObjects.Arc;

  xpReward: number;
  scoreValue: number;
  private _scaledDamage: number;

  onDeath?: (enemy: Enemy) => void;
  onAttackPlayer?: (damage: number, x: number, y: number) => void;

  constructor(scene: Phaser.Scene, x: number, y: number, def: EnemyDef, wave: number) {
    super(scene, x, y);
    this.def = def;
    this.wave = wave;

    const hpScale  = 1 + GAME_CONFIG.DIFFICULTY.HP_SCALE_PER_WAVE * wave;
    const dmgScale = 1 + GAME_CONFIG.DIFFICULTY.DAMAGE_SCALE_PER_WAVE * wave;
    this.maxHealth = Math.round(def.health * hpScale);
    this.currentHealth = this.maxHealth;
    this.xpReward = def.xpReward;
    this.scoreValue = def.scoreValue;
    this._scaledDamage = Math.round(def.damage * dmgScale);

    this.buildSprite();
    scene.add.existing(this);
    this.setDepth(3);
  }

  getScaledDamage(): number { return this._scaledDamage; }
  getArmor(): number { return 0; }

  private buildSprite(): void {
    const info = ENEMY_SPRITE_INFO[this.def.type];
    const r = this.def.bodyRadius;

    // Shadow
    this.shadowEllipse = this.scene.add.ellipse(0, r * 0.7, r * 2.4, r * 0.7, 0x000000, 0.3);
    this.add(this.shadowEllipse);

    // Boss / elite glow ring
    if (this.def.type === "boss" || this.def.type === "elite") {
      const glowColor = this.def.type === "boss" ? 0xAA00CC : 0xAA0000;
      this.glowRing = this.scene.add.arc(0, 0, r * 1.5, 0, 360, false, glowColor, 0.18);
      this.add(this.glowRing);
    }

    // Pixel art sprite
    this.sprite = this.scene.add.sprite(0, 0, info.sheet);
    this.sprite.setOrigin(0.5, 0.5);
    this.sprite.setScale(info.scale);
    this.add(this.sprite);
    this.sprite.play(info.anim);

    // Health bar
    const barW = r * 2.4;
    this.healthBarBg = this.scene.add.rectangle(0, r + 10, barW, 5, 0x330000);
    this.healthBarFg = this.scene.add.rectangle(0, r + 10, barW, 5, 0x00dd44);
    this.add(this.healthBarBg);
    this.add(this.healthBarFg);

    const showAlways = this.def.type === "elite" || this.def.type === "boss";
    this.healthBarBg.setVisible(showAlways);
    this.healthBarFg.setVisible(showAlways);

    // Boss name label
    if (this.def.type === "boss") {
      const label = this.scene.add.text(0, r + 22, this.def.displayName.toUpperCase(), {
        fontFamily: "Georgia, serif",
        fontSize: "10px",
        color: "#ff88ff",
        stroke: "#000",
        strokeThickness: 2,
      }).setOrigin(0.5, 0);
      this.add(label);
    }
  }

  get isDead(): boolean { return this._isDead; }

  update(playerX: number, playerY: number, delta: number): void {
    if (this._isDead) return;

    const dx = playerX - this.x;
    const dy = playerY - this.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist > 2) {
      this.x += (dx / dist) * this.def.moveSpeed * (delta / 1000);
      this.y += (dy / dist) * this.def.moveSpeed * (delta / 1000);

      // Flip sprite based on movement direction
      this.sprite.setFlipX(dx < 0);
    }

    // Pulse glow for boss/elite
    if (this.glowRing) {
      this.glowRing.setAlpha(0.12 + Math.sin(Date.now() * 0.003) * 0.08);
    }

    // Attack
    this.attackTimer += delta;
    if (dist <= this.def.attackRange && this.attackTimer >= this.def.attackInterval) {
      this.attackTimer = 0;
      this.onAttackPlayer?.(this._scaledDamage, this.x, this.y);
      // Flash tint on attack
      this.sprite.setTint(0xffaa44);
      this.scene.time.delayedCall(80, () => {
        if (this.sprite?.active) this.sprite.clearTint();
      });
    }
  }

  takeDamage(amount: number): void {
    if (this._isDead) return;
    this.currentHealth -= amount;
    this.updateHealthBar();

    // Show health bar
    this.healthBarBg.setVisible(true);
    this.healthBarFg.setVisible(true);

    // Hit flash
    this.sprite.setTint(0xffffff);
    this.scene.time.delayedCall(GAME_CONFIG.FEEDBACK.HIT_FLASH_DURATION, () => {
      if (this.sprite?.active) this.sprite.clearTint();
    });

    if (this.currentHealth <= 0) {
      this.currentHealth = 0;
      this._isDead = true;
      this.deathEffect();
    }
  }

  private updateHealthBar(): void {
    const pct = this.currentHealth / this.maxHealth;
    const r = this.def.bodyRadius;
    const totalWidth = r * 2.4;
    const newWidth = totalWidth * pct;
    this.healthBarFg.setSize(newWidth, 5);
    this.healthBarFg.setX(-(totalWidth / 2) + newWidth / 2);
    this.healthBarFg.fillColor = pct > 0.5 ? 0x00dd44 : pct > 0.25 ? 0xffaa00 : 0xff2200;
  }

  private deathEffect(): void {
    // Death burst
    this.sprite.setTint(0xff4400);
    this.scene.tweens.add({
      targets: this,
      alpha: 0,
      scaleX: 1.8,
      scaleY: 1.8,
      duration: GAME_CONFIG.FEEDBACK.DEATH_EFFECT_DURATION,
      ease: "Power2",
      onComplete: () => {
        this.onDeath?.(this);
        this.destroy();
      },
    });
  }
}
