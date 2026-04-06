/**
 * ProgressionManager.ts
 * XP, leveling, and upgrade tracking.
 */

import { GAME_CONFIG } from "../data/GameConfig";
import { type UpgradeId, type UpgradeDef, UPGRADES, pickUpgradeChoices, createDefaultStats, type PlayerStats } from "../data/UpgradeData";

export class ProgressionManager {
  private _xp = 0;
  private _level = 1;
  private _xpToNextLevel: number;
  private _stats: PlayerStats;
  private _acquiredUpgrades: Map<UpgradeId, number> = new Map();

  onLevelUp?: (level: number, choices: UpgradeDef[]) => void;

  constructor(baseStats?: Partial<PlayerStats>) {
    this._stats = baseStats ? { ...createDefaultStats(), ...baseStats } : createDefaultStats();
    this._xpToNextLevel = this.calcXpThreshold(1);
  }

  get xp(): number { return this._xp; }
  get level(): number { return this._level; }
  get xpToNextLevel(): number { return this._xpToNextLevel; }
  get stats(): PlayerStats { return this._stats; }
  get acquiredUpgrades(): Map<UpgradeId, number> { return this._acquiredUpgrades; }

  addXp(amount: number): void {
    const gained = Math.round(amount * this._stats.xpMultiplier);
    this._xp += gained;
    while (this._xp >= this._xpToNextLevel && this._level < GAME_CONFIG.XP.MAX_LEVEL) {
      this._xp -= this._xpToNextLevel;
      this._level += 1;
      this._xpToNextLevel = this.calcXpThreshold(this._level);
      const choices = pickUpgradeChoices(this._acquiredUpgrades);
      this.onLevelUp?.(this._level, choices);
    }
  }

  applyUpgrade(upgradeId: UpgradeId): void {
    const upgrade = UPGRADES[upgradeId];
    if (!upgrade) return;
    upgrade.apply(this._stats);
    const current = this._acquiredUpgrades.get(upgradeId) ?? 0;
    this._acquiredUpgrades.set(upgradeId, current + 1);
  }

  getXpPercent(): number {
    return this._xp / this._xpToNextLevel;
  }

  /** Formula: BASE * level ^ EXPONENT */
  private calcXpThreshold(level: number): number {
    return Math.round(GAME_CONFIG.XP.BASE * Math.pow(level, GAME_CONFIG.XP.EXPONENT));
  }

  reset(): void {
    this._xp = 0;
    this._level = 1;
    this._stats = createDefaultStats();
    this._acquiredUpgrades = new Map();
    this._xpToNextLevel = this.calcXpThreshold(1);
  }
}
