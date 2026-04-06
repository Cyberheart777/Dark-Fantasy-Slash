/**
 * EnemyData.ts
 * Data-driven enemy definitions.
 * Add new enemy archetypes here without touching entity logic.
 * STEAM NOTE: Can be loaded from an external JSON file for modding support.
 */

export type EnemyType = "scuttler" | "brute" | "wraith" | "elite" | "boss";

export interface EnemyDef {
  type: EnemyType;
  displayName: string;
  health: number;
  damage: number;
  moveSpeed: number;
  xpReward: number;
  attackRange: number;
  attackInterval: number;  // ms
  bodyColor: number;
  eyeColor: number;
  bodyRadius: number;
  scoreValue: number;
}

export const ENEMY_DATA: Record<EnemyType, EnemyDef> = {
  scuttler: {
    type: "scuttler",
    displayName: "Bone Scuttler",
    health: 30,
    damage: 8,
    moveSpeed: 160,
    xpReward: 12,
    attackRange: 42,
    attackInterval: 1200,
    bodyColor: 0xb5a05a,
    eyeColor: 0xff4400,
    bodyRadius: 14,
    scoreValue: 10,
  },
  brute: {
    type: "brute",
    displayName: "Iron Brute",
    health: 140,
    damage: 22,
    moveSpeed: 70,
    xpReward: 35,
    attackRange: 56,
    attackInterval: 2000,
    bodyColor: 0x5a6e7a,
    eyeColor: 0xff6600,
    bodyRadius: 26,
    scoreValue: 40,
  },
  wraith: {
    type: "wraith",
    displayName: "Shadow Wraith",
    health: 55,
    damage: 14,
    moveSpeed: 130,
    xpReward: 22,
    attackRange: 46,
    attackInterval: 900,
    bodyColor: 0x4a2a7a,
    eyeColor: 0x00ccff,
    bodyRadius: 16,
    scoreValue: 25,
  },
  elite: {
    type: "elite",
    displayName: "Voidclaw Champion",
    health: 420,
    damage: 36,
    moveSpeed: 95,
    xpReward: 120,
    attackRange: 60,
    attackInterval: 1600,
    bodyColor: 0x8b0000,
    eyeColor: 0xffff00,
    bodyRadius: 28,
    scoreValue: 150,
  },
  boss: {
    type: "boss",
    displayName: "The Warden Reborn",
    health: 1800,
    damage: 55,
    moveSpeed: 80,
    xpReward: 600,
    attackRange: 80,
    attackInterval: 1400,
    bodyColor: 0x1a001a,
    eyeColor: 0xff00ff,
    bodyRadius: 44,
    scoreValue: 500,
  },
};

/**
 * Spawn table per wave tier — controls which enemy types appear.
 * Add new tiers here. Each entry is [EnemyType, weight].
 */
export const SPAWN_TABLE: Array<[EnemyType, number][]> = [
  // Wave 0-1
  [["scuttler", 10]],
  // Wave 2-3
  [["scuttler", 7], ["wraith", 3]],
  // Wave 4-5
  [["scuttler", 5], ["wraith", 4], ["brute", 1]],
  // Wave 6-7
  [["scuttler", 4], ["wraith", 4], ["brute", 2]],
  // Wave 8+
  [["scuttler", 3], ["wraith", 3], ["brute", 2], ["elite", 1]],
];

export function pickEnemyType(wave: number): EnemyType {
  const tableIdx = Math.min(wave, SPAWN_TABLE.length - 1);
  const table = SPAWN_TABLE[tableIdx];
  const totalWeight = table.reduce((sum, [, w]) => sum + w, 0);
  let rand = Math.random() * totalWeight;
  for (const [type, weight] of table) {
    rand -= weight;
    if (rand <= 0) return type;
  }
  return "scuttler";
}
