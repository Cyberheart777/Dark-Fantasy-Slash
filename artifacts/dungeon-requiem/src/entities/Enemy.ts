/**
 * Enemy.ts
 * Base enemy entity. Data-driven via EnemyDef.
 * STEAM NOTE: Add animation frames via spritesheet when art is ready.
 */

import Phaser from "phaser";
import { type EnemyDef } from "../data/EnemyData";
import { GAME_CONFIG } from "../data/GameConfig";

export class Enemy extends Phaser.GameObjects.Container {
  def: EnemyDef;
  currentHealth: number;
  maxHealth: number;
  private _isDead = false;
  private attackTimer = 0;
  private wave: number;

  private bodyCircle!: Phaser.GameObjects.Arc;
  private healthBarBg!: Phaser.GameObjects.Rectangle;
  private healthBarFg!: Phaser.GameObjects.Rectangle;
  private eyeLeft!: Phaser.GameObjects.Arc;
  private eyeRight!: Phaser.GameObjects.Arc;

  xpReward: number;
  scoreValue: number;

  onDeath?: (enemy: Enemy) => void;
  onAttackPlayer?: (damage: number, x: number, y: number) => void;

  constructor(scene: Phaser.Scene, x: number, y: number, def: EnemyDef, wave: number) {
    super(scene, x, y);
    this.def = def;
    this.wave = wave;

    // Scale stats per wave
    const hpScale = 1 + GAME_CONFIG.DIFFICULTY.HP_SCALE_PER_WAVE * wave;
    const dmgScale = 1 + GAME_CONFIG.DIFFICULTY.DAMAGE_SCALE_PER_WAVE * wave;
    this.maxHealth = Math.round(def.health * hpScale);
    this.currentHealth = this.maxHealth;
    this.xpReward = def.xpReward;
    this.scoreValue = def.scoreValue;

    // Stored for use in combat
    this._scaledDamage = Math.round(def.damage * dmgScale);

    this.buildGraphics();
    scene.add.existing(this);
    this.setDepth(3);
  }

  private _scaledDamage: number;
  getScaledDamage(): number { return this._scaledDamage; }
  getArmor(): number { return 0; } // Stub — enemies could have armor later

  private buildGraphics(): void {
    const r = this.def.bodyRadius;

    // Shadow
    const shadow = this.scene.add.ellipse(0, r * 0.6, r * 2.2, r * 0.8, 0x000000, 0.3);
    this.add(shadow);

    // Body
    this.bodyCircle = this.scene.add.arc(0, 0, r, 0, 360, false, this.def.bodyColor);
    this.bodyCircle.setStrokeStyle(2, 0x000000, 0.8);
    this.add(this.bodyCircle);

    // Eyes
    const eyeOff = r * 0.3;
    this.eyeLeft = this.scene.add.arc(-eyeOff, -r * 0.2, r * 0.2, 0, 360, false, this.def.eyeColor);
    this.eyeRight = this.scene.add.arc(eyeOff, -r * 0.2, r * 0.2, 0, 360, false, this.def.eyeColor);
    this.add(this.eyeLeft);
    this.add(this.eyeRight);

    // Boss crown
    if (this.def.type === "boss") {
      const crown = this.scene.add.rectangle(0, -r - 10, r * 1.6, 8, 0xffdd00);
      this.add(crown);
    }

    // Health bar (shown on elites and bosses always, others only when damaged)
    this.healthBarBg = this.scene.add.rectangle(0, r + 10, r * 2.4, 5, 0x330000);
    this.healthBarFg = this.scene.add.rectangle(
      -(r * 1.2) + (r * 1.2), r + 10, r * 2.4, 5, 0x00dd44
    );
    this.add(this.healthBarBg);
    this.add(this.healthBarFg);

    if (this.def.type !== "elite" && this.def.type !== "boss") {
      this.healthBarBg.setVisible(false);
      this.healthBarFg.setVisible(false);
    }
  }

  get isDead(): boolean { return this._isDead; }

  update(playerX: number, playerY: number, delta: number): void {
    if (this._isDead) return;

    // Move toward player
    const dx = playerX - this.x;
    const dy = playerY - this.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist > 1) {
      const speed = this.def.moveSpeed;
      this.x += (dx / dist) * speed * (delta / 1000);
      this.y += (dy / dist) * speed * (delta / 1000);

      // Rotate eyes toward player
      this.setRotation(Math.atan2(dy, dx));
    }

    // Attack
    this.attackTimer += delta;
    if (dist <= this.def.attackRange && this.attackTimer >= this.def.attackInterval) {
      this.attackTimer = 0;
      this.onAttackPlayer?.(this._scaledDamage, this.x, this.y);
    }
  }

  takeDamage(amount: number): void {
    if (this._isDead) return;
    this.currentHealth -= amount;
    this.updateHealthBar();

    // Show health bar on damage
    this.healthBarBg.setVisible(true);
    this.healthBarFg.setVisible(true);

    // Hit flash
    this.scene.tweens.add({
      targets: this.bodyCircle,
      fillColor: 0xffffff,
      duration: GAME_CONFIG.FEEDBACK.HIT_FLASH_DURATION,
      yoyo: true,
      onComplete: () => {
        if (this.bodyCircle && this.bodyCircle.active) {
          this.bodyCircle.fillColor = this.def.bodyColor;
        }
      },
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

    if (pct > 0.5) this.healthBarFg.fillColor = 0x00dd44;
    else if (pct > 0.25) this.healthBarFg.fillColor = 0xffaa00;
    else this.healthBarFg.fillColor = 0xff2200;
  }

  private deathEffect(): void {
    this.scene.tweens.add({
      targets: this,
      alpha: 0,
      scaleX: 1.6,
      scaleY: 1.6,
      duration: GAME_CONFIG.FEEDBACK.DEATH_EFFECT_DURATION,
      ease: "Power2",
      onComplete: () => {
        this.onDeath?.(this);
        this.destroy();
      },
    });
  }
}
