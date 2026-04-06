/**
 * CombatManager3D.ts
 * Handles attack resolution, damage, crits, lifesteal — 3D units.
 */

import { GAME_CONFIG } from "../data/GameConfig";
import type { PlayerStats } from "../data/UpgradeData";

export interface CombatResult {
  damage: number;
  isCrit: boolean;
  isLifesteal: boolean;
  healAmount: number;
}

export interface EnemyRuntimeData {
  id: string;
  type: string;
  x: number;
  z: number;
  health: number;
  maxHealth: number;
  damage: number;
  moveSpeed: number;
  attackRange: number;
  attackInterval: number;
  attackTimer: number;
  collisionRadius: number;
  xpReward: number;
  scoreValue: number;
  dead: boolean;
  hitFlashTimer: number;
  scale: number;
  color: string;
  emissive: string;
  // AI state
  vx: number;
  vz: number;
  // Wraith: phasing
  phasing: boolean;
  phaseTimer: number;
}

export class CombatManager3D {
  /**
   * Player attacks all enemies in arc in front of aim direction.
   */
  resolvePlayerAttack(
    playerX: number,
    playerZ: number,
    aimAngle: number,         // radians, 0 = +Z
    stats: PlayerStats,
    enemies: EnemyRuntimeData[],
    cleaved: Set<string>,
    doubleStrike: boolean
  ): { hits: Array<{ enemy: EnemyRuntimeData; result: CombatResult }>; playerHeal: number } {
    const hits: Array<{ enemy: EnemyRuntimeData; result: CombatResult }> = [];
    let totalHeal = 0;
    const range = stats.attackRange;
    const arcHalf = (GAME_CONFIG.PLAYER.ATTACK_ARC / 2) * (Math.PI / 180);

    for (const enemy of enemies) {
      if (enemy.dead) continue;

      const dx = enemy.x - playerX;
      const dz = enemy.z - playerZ;
      const dist = Math.sqrt(dx * dx + dz * dz);
      if (dist > range + enemy.collisionRadius) continue;

      const angleToEnemy = Math.atan2(dx, dz);
      let angleDiff = Math.abs(angleToEnemy - aimAngle);
      if (angleDiff > Math.PI) angleDiff = Math.PI * 2 - angleDiff;

      // Cleave: hit all in range, not just arc
      const inArc = angleDiff <= arcHalf;
      const inCleave = stats.cleaveChance > 0 && !cleaved.has(enemy.id) && dist < range * 1.5;

      if (!inArc && !inCleave) continue;

      const result = this.calcDamage(stats, doubleStrike);

      // Apply damage
      enemy.health -= result.damage;
      enemy.hitFlashTimer = 0.12;
      if (enemy.health <= 0) enemy.dead = true;

      // Lifesteal
      const heal = result.damage * stats.lifesteal;
      totalHeal += heal;
      result.healAmount = heal;

      hits.push({ enemy, result });
      cleaved.add(enemy.id);
    }

    return { hits, playerHeal: totalHeal };
  }

  /**
   * Enemy attacks player — returns damage dealt (after armor/dodge).
   */
  resolveEnemyAttack(
    rawDamage: number,
    wave: number,
    stats: PlayerStats
  ): number {
    // Dodge chance
    if (Math.random() < stats.dodgeChance) return 0;

    const scaled = rawDamage * (1 + wave * GAME_CONFIG.DIFFICULTY.DAMAGE_SCALE_PER_WAVE);
    const mitigated = Math.max(1, scaled - stats.armor);
    return Math.round(mitigated);
  }

  private calcDamage(stats: PlayerStats, doubleStrike: boolean): CombatResult {
    const isCrit = Math.random() < stats.critChance;
    let dmg = stats.damage;
    if (isCrit) dmg *= 2;
    if (doubleStrike && Math.random() < stats.doubleStrikeChance) dmg *= 2;
    dmg = Math.round(dmg);
    return { damage: dmg, isCrit, isLifesteal: stats.lifesteal > 0, healAmount: 0 };
  }
}
