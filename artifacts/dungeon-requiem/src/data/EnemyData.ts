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

export type EnemyType = "scuttler" | "brute" | "wraith" | "elite" | "boss" | "xp_goblin" | "warrior_champion" | "mage_champion" | "rogue_champion" | "necromancer_champion" | "bard_champion";
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
    health: 38,
    damage: 10,
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
    health: 175,
    damage: 28,
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
    health: 69,
    damage: 18,
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
    health: 525,
    damage: 45,
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
    health: 2250,
    damage: 35,
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
  xp_goblin: {
    type: "xp_goblin",
    displayName: "Gold Hoarder",
    health: 22,
    damage: 0,
    moveSpeed: 9.5,
    xpReward: GREEN_XP * 40,     // 400 — massive XP jackpot
    crystalTier: "orange",
    attackRange: 0,
    attackInterval: 999,
    collisionRadius: 0.55,
    scoreValue: 250,
    color: "#ffcc00",
    emissive: "#aa6600",
    scale: 0.65,
  },

  // ── Trial of Champions: mirror-class champions ────────────────────────────
  warrior_champion: {
    type: "warrior_champion",
    displayName: "The Iron Vanguard",
    health: 2200,
    damage: 48,
    moveSpeed: 4.5,
    xpReward: 0,
    crystalTier: "orange",
    attackRange: 5.0,
    attackInterval: 1.4,
    collisionRadius: 1.8,
    scoreValue: 0,
    color: "#4a80c0",
    emissive: "#1a3060",
    scale: 1.8,
  },

  mage_champion: {
    type: "mage_champion",
    displayName: "The Void Arcanist",
    health: 1600,
    damage: 32,
    moveSpeed: 3.5,
    xpReward: 0,
    crystalTier: "orange",
    attackRange: 25.0,
    attackInterval: 2.2,
    collisionRadius: 1.6,
    scoreValue: 0,
    color: "#9030d0",
    emissive: "#3a0060",
    scale: 1.8,
  },

  rogue_champion: {
    type: "rogue_champion",
    displayName: "The Shadow Blade",
    health: 1800,
    damage: 22,
    moveSpeed: 6.75,
    xpReward: 0,
    crystalTier: "orange",
    attackRange: 18.0,
    attackInterval: 0.75,
    collisionRadius: 1.5,
    scoreValue: 0,
    color: "#18b870",
    emissive: "#0a4020",
    scale: 1.8,
  },

  necromancer_champion: {
    type: "necromancer_champion",
    displayName: "The Dread Shepherd",
    health: 2000,
    damage: 28,
    moveSpeed: 4.0,
    xpReward: 0,
    crystalTier: "orange",
    attackRange: 6.0,
    attackInterval: 1.6,
    collisionRadius: 1.7,
    scoreValue: 0,
    color: "#6a1e8a",
    emissive: "#2a0840",
    scale: 1.8,
  },

  bard_champion: {
    type: "bard_champion",
    displayName: "The Discordant Minstrel",
    health: 1700,
    damage: 30,
    moveSpeed: 5.0,
    xpReward: 0,
    crystalTier: "orange",
    attackRange: 40.0,
    attackInterval: 0.5,
    collisionRadius: 1.5,
    scoreValue: 0,
    color: "#c8a020",
    emissive: "#4a3008",
    scale: 1.8,
  },
  // FUTURE: enemy Bard variant ready for main dungeon enemy pool inclusion
};

export const SPAWN_TABLE: Array<[EnemyType, number][]> = [
  // Wave 1-2: scuttlers only
  [["scuttler", 10]],
  // Wave 3-4: wraiths appear
  [["scuttler", 7], ["wraith", 3]],
  // Wave 5-6: brutes join
  [["scuttler", 5], ["wraith", 4], ["brute", 1]],
  // Wave 7-8: more brutes, fewer scuttlers
  [["scuttler", 4], ["wraith", 4], ["brute", 2]],
  // Wave 9-10: elites appear
  [["scuttler", 3], ["wraith", 3], ["brute", 2], ["elite", 1]],
  // Wave 11-12: elite frequency up, wraith swarms
  [["scuttler", 3], ["wraith", 4], ["brute", 2], ["elite", 2]],
  // Wave 13-14: brute-heavy, elites common
  [["scuttler", 2], ["wraith", 3], ["brute", 3], ["elite", 2]],
  // Wave 15-16: wraith-dominant with elite muscle
  [["scuttler", 2], ["wraith", 5], ["brute", 2], ["elite", 3]],
  // Wave 17-18: heavy composition
  [["scuttler", 1], ["wraith", 4], ["brute", 3], ["elite", 3]],
  // Wave 19-20: elite swarm
  [["scuttler", 1], ["wraith", 3], ["brute", 3], ["elite", 4]],
  // Wave 21-24: endgame — elites everywhere
  [["scuttler", 1], ["wraith", 3], ["brute", 4], ["elite", 5]],
  // Wave 25-28: nightmare tier
  [["wraith", 3], ["brute", 4], ["elite", 6]],
  // Wave 29-32: pure brutality
  [["wraith", 2], ["brute", 5], ["elite", 6]],
  // Wave 33+: hell
  [["wraith", 2], ["brute", 4], ["elite", 8]],
];

export function pickEnemyType(wave: number): EnemyType {
  // Map waves to table tiers: wave 1-2→0, 3-4→1, ..., every 2 waves advances a tier
  const tableIdx = Math.min(Math.floor((wave - 1) / 2), SPAWN_TABLE.length - 1);
  const table = SPAWN_TABLE[tableIdx];
  const totalWeight = table.reduce((sum, [, w]) => sum + w, 0);
  let rand = Math.random() * totalWeight;
  for (const [type, weight] of table) {
    rand -= weight;
    if (rand <= 0) return type;
  }
  return "scuttler";
}
