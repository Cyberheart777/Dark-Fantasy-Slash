/**
 * CombatManager.ts
 * Handles hit detection, damage calculation, and combat feedback.
 * Keeps combat logic separate from entity classes.
 */

import Phaser from "phaser";
import type { PlayerStats } from "../data/UpgradeData";
import type { Enemy } from "../entities/Enemy";
import { GAME_CONFIG } from "../data/GameConfig";

export interface DamageResult {
  finalDamage: number;
  isCrit: boolean;
  isKill: boolean;
  lifestealHeal: number;
}

export class CombatManager {
  private scene: Phaser.Scene;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  /**
   * Resolve a player attack against a set of enemies in the arc.
   * Returns list of damage results for each enemy hit.
   */
  resolvePlayerAttack(
    playerX: number,
    playerY: number,
    aimAngle: number,
    stats: PlayerStats,
    enemies: Enemy[],
    doubleStrike = false
  ): Map<Enemy, DamageResult> {
    const results = new Map<Enemy, DamageResult>();
    const halfArc = Phaser.Math.DegToRad(stats.attackArc / 2);

    for (const enemy of enemies) {
      if (!enemy.active || enemy.isDead) continue;

      const dx = enemy.x - playerX;
      const dy = enemy.y - playerY;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist > stats.attackRange) continue;

      const angleToEnemy = Math.atan2(dy, dx);
      const angleDiff = Phaser.Math.Angle.Wrap(angleToEnemy - aimAngle);

      if (Math.abs(angleDiff) > halfArc) continue;

      const result = this.calcDamage(stats, enemy, doubleStrike);
      results.set(enemy, result);
    }

    return results;
  }

  /**
   * Apply calculated damage to an enemy.
   */
  applyDamage(enemy: Enemy, result: DamageResult): void {
    enemy.takeDamage(result.finalDamage);
  }

  /**
   * Calculate damage with crits and armor mitigation.
   */
  calcDamage(stats: PlayerStats, enemy: Enemy, doubleStrike: boolean): DamageResult {
    const isCrit = Math.random() < stats.critChance;
    let dmg = stats.damage;
    if (isCrit) dmg = Math.round(dmg * 1.8);

    // Armor mitigation: flat reduction (clamped to 1 min)
    const armorReduction = enemy.getArmor?.() ?? 0;
    dmg = Math.max(1, dmg - armorReduction);

    if (doubleStrike && Math.random() < stats.doubleStrikeChance) {
      dmg = Math.round(dmg * 1.6);
    }

    const isKill = enemy.currentHealth - dmg <= 0;
    const lifestealHeal = Math.round(dmg * stats.lifesteal);

    return { finalDamage: dmg, isCrit, isKill, lifestealHeal };
  }

  /**
   * Resolve enemy attack on player.
   * Returns final damage after player armor + dodge.
   */
  resolveEnemyAttack(
    rawDamage: number,
    playerStats: PlayerStats
  ): { damage: number; dodged: boolean } {
    const dodged = Math.random() < playerStats.dodgeChance;
    if (dodged) return { damage: 0, dodged: true };

    const reduced = Math.max(1, rawDamage - Math.floor(playerStats.armor / 2));
    return { damage: reduced, dodged: false };
  }

  /**
   * Trigger screen shake if enabled.
   */
  screenShake(duration = GAME_CONFIG.FEEDBACK.SCREEN_SHAKE_DURATION, intensity = GAME_CONFIG.FEEDBACK.SCREEN_SHAKE_INTENSITY): void {
    const settings = this.scene.registry.get("settings") as { screenShake?: boolean } | undefined;
    if (settings?.screenShake === false) return;
    this.scene.cameras.main.shake(duration, intensity / 1000);
  }
}
