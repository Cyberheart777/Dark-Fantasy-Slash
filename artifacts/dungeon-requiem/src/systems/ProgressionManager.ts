/**
 * ProgressionManager.ts
 * XP, leveling, upgrade tracking, and per-level class stat growth.
 */

import { GAME_CONFIG } from "../data/GameConfig";
import { type UpgradeId, type UpgradeDef, UPGRADES, pickUpgradeChoices, createDefaultStats, type PlayerStats } from "../data/UpgradeData";
import type { CharacterClass } from "../data/CharacterData";

/** Flat stat bonuses granted per level-up, keyed by class. */
const CLASS_GROWTH: Record<CharacterClass, (s: PlayerStats) => void> = {
  warrior: (s) => {
    s.damage     += 1;
    s.maxHealth  += 3;
    s.currentHealth = Math.min(s.currentHealth + 1, s.maxHealth);
    s.armor      += 0.4;
  },
  mage: (s) => {
    s.damage     += 2;
    s.maxHealth  += 1;
    s.critChance  = parseFloat((s.critChance + 0.002).toFixed(4));
    s.attackSpeed = parseFloat((s.attackSpeed + 0.012).toFixed(3));
  },
  rogue: (s) => {
    s.damage     += 1;
    s.maxHealth  += 1;
    s.moveSpeed   = parseFloat((s.moveSpeed + 0.15).toFixed(3));
    s.attackSpeed = parseFloat((s.attackSpeed + 0.018).toFixed(3));
  },
};

export class ProgressionManager {
  private _xp = 0;
  private _level = 1;
  private _xpToNextLevel: number;
  private _stats: PlayerStats;
  private _acquiredUpgrades: Map<UpgradeId, number> = new Map();
  private _charClass: CharacterClass;

  onLevelUp?: (level: number, choices: UpgradeDef[]) => void;

  constructor(baseStats?: Partial<PlayerStats>, charClass: CharacterClass = "warrior") {
    this._stats = baseStats ? { ...createDefaultStats(), ...baseStats } : createDefaultStats();
    this._xpToNextLevel = this.calcXpThreshold(1);
    this._charClass = charClass;
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
      // Apply small passive growth every level
      CLASS_GROWTH[this._charClass](this._stats);
      const choices = pickUpgradeChoices(this._acquiredUpgrades, 3, this._level, this._charClass);
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
