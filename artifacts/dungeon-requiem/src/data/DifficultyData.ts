/**
 * DifficultyData.ts
 * Difficulty tier multipliers applied to all enemy stats game-wide.
 * Applies to normal runs, Trial of Champions, and all future modes.
 */

export type DifficultyTier = "normal" | "hard" | "nightmare";

export interface DifficultyDef {
  id: DifficultyTier;
  label: string;
  description: string;
  enemyHpMult: number;
  enemyDamageMult: number;
  enemySpeedMult: number;
  shardBonusMult: number;
  gearDropMult: number;
  color: string;
  accentColor: string;
}

export const DIFFICULTY_DATA: Record<DifficultyTier, DifficultyDef> = {
  normal: {
    id: "normal",
    label: "NORMAL",
    description: "Standard dungeon experience",
    enemyHpMult: 1.0,
    enemyDamageMult: 1.0,
    enemySpeedMult: 1.0,
    shardBonusMult: 1.0,
    gearDropMult: 1.0,
    color: "#60c040",
    accentColor: "#80e060",
  },
  hard: {
    id: "hard",
    label: "HARD",
    description: "Stronger, faster enemies. +50% shard rewards.",
    enemyHpMult: 1.4,
    enemyDamageMult: 1.3,
    enemySpeedMult: 1.15,
    shardBonusMult: 1.5,
    gearDropMult: 1.15,
    color: "#e08020",
    accentColor: "#ffaa40",
  },
  nightmare: {
    id: "nightmare",
    label: "NIGHTMARE",
    description: "Only for the reckless. ×2.5 shard rewards.",
    enemyHpMult: 2.0,
    enemyDamageMult: 1.7,
    enemySpeedMult: 1.3,
    shardBonusMult: 2.5,
    gearDropMult: 1.30,
    color: "#cc2020",
    accentColor: "#ff4444",
  },
};

export const DIFFICULTIES: DifficultyTier[] = ["normal", "hard", "nightmare"];
