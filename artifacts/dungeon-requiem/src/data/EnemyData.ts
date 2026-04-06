/**
 * EnemyData.ts
 * Data-driven enemy definitions — 3D units.
 *
 * XP crystal tiers (multipliers of the base green crystal value):
 *   green = 1×  (scuttler)
 *   blue  = 10× (wraith, brute)
 *   purple= 30× (elite)
 *   orange= 50× (boss)
 */

export type EnemyType = "scuttler" | "brute" | "wraith" | "elite" | "boss";
export type CrystalTier = "green" | "blue" | "purple" | "orange";

export interface EnemyDef {
  type: EnemyType;
  displayName: string;
  health: number;
  damage: number;
  moveSpeed: number;       // units/second
  xpReward: number;
  crystalTier: CrystalTier;
  attackRange: number;     // units
  attackInterval: number;  // seconds
  collisionRadius: number; // units
  scoreValue: number;
  color: string;           // hex CSS color for mesh material
  emissive: string;        // glow color
  scale: number;           // mesh scale factor
}

const GREEN_XP = 10;

export const ENEMY_DATA: Record<EnemyType, EnemyDef> = {
  scuttler: {
    type: "scuttler",
    displayName: "Bone Scuttler",
    health: 30,
    damage: 8,
    moveSpeed: 6.0,
    xpReward: GREEN_XP,          // 1× — green crystal
    crystalTier: "green",
    attackRange: 1.8,
    attackInterval: 1.2,
    collisionRadius: 0.7,
    scoreValue: 10,
    color: "#b5a05a",
    emissive: "#331100",
    scale: 0.8,
  },
  brute: {
    type: "brute",
    displayName: "Iron Brute",
    health: 140,
    damage: 22,
    moveSpeed: 2.5,
    xpReward: GREEN_XP * 10,     // 10× — blue crystal
    crystalTier: "blue",
    attackRange: 2.4,
    attackInterval: 2.0,
    collisionRadius: 1.2,
    scoreValue: 40,
    color: "#5a6e7a",
    emissive: "#0a1418",
    scale: 1.5,
  },
  wraith: {
    type: "wraith",
    displayName: "Shadow Wraith",
    health: 55,
    damage: 14,
    moveSpeed: 4.5,
    xpReward: GREEN_XP * 10,     // 10× — blue crystal
    crystalTier: "blue",
    attackRange: 2.0,
    attackInterval: 0.9,
    collisionRadius: 0.8,
    scoreValue: 25,
    color: "#4a2a7a",
    emissive: "#1a0040",
    scale: 1.0,
  },
  elite: {
    type: "elite",
    displayName: "Voidclaw Champion",
    health: 420,
    damage: 36,
    moveSpeed: 3.5,
    xpReward: GREEN_XP * 30,     // 30× — purple crystal
    crystalTier: "purple",
    attackRange: 2.6,
    attackInterval: 1.6,
    collisionRadius: 1.3,
    scoreValue: 150,
    color: "#8b0000",
    emissive: "#300000",
    scale: 1.6,
  },
  boss: {
    type: "boss",
    displayName: "The Warden Reborn",
    health: 1800,
    damage: 55,
    moveSpeed: 3.0,
    xpReward: GREEN_XP * 50,     // 50× — orange crystal
    crystalTier: "orange",
    attackRange: 3.5,
    attackInterval: 1.4,
    collisionRadius: 2.0,
    scoreValue: 500,
    color: "#1a001a",
    emissive: "#3d003d",
    scale: 2.2,
  },
};

export const SPAWN_TABLE: Array<[EnemyType, number][]> = [
  [["scuttler", 10]],
  [["scuttler", 7], ["wraith", 3]],
  [["scuttler", 5], ["wraith", 4], ["brute", 1]],
  [["scuttler", 4], ["wraith", 4], ["brute", 2]],
  [["scuttler", 3], ["wraith", 3], ["brute", 2], ["elite", 1]],
];

export function pickEnemyType(wave: number): EnemyType {
  const tableIdx = Math.min(Math.floor(wave / 2), SPAWN_TABLE.length - 1);
  const table = SPAWN_TABLE[tableIdx];
  const totalWeight = table.reduce((sum, [, w]) => sum + w, 0);
  let rand = Math.random() * totalWeight;
  for (const [type, weight] of table) {
    rand -= weight;
    if (rand <= 0) return type;
  }
  return "scuttler";
}
