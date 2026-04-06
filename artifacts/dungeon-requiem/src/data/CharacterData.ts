/**
 * CharacterData.ts
 * Defines the three playable classes: Warrior, Mage, Rogue.
 */

export type CharacterClass = "warrior" | "mage" | "rogue";

export interface CharacterDef {
  id: CharacterClass;
  name: string;
  title: string;
  description: string;
  lore: string;
  // Base stats
  hp: number;
  damage: number;
  attackSpeed: number;
  moveSpeed: number;
  armor: number;
  dashCooldown: number;
  critChance: number;
  // Attack behaviour
  attackType: "melee" | "projectile";
  attackRange: number;
  // Projectile-only
  projectileSpeed: number;
  projectilePiercing: boolean;
  projectileCount: number;     // knives / orbs fired per attack
  projectileSpread: number;    // radians between multi-projectiles
  projectileRadius: number;    // collision radius
  projectileLifetime: number;  // seconds before despawn
  // Visuals
  color: string;
  accentColor: string;
  auraColor: string;
}

export const CHARACTER_DATA: Record<CharacterClass, CharacterDef> = {
  warrior: {
    id: "warrior",
    name: "WARRIOR",
    title: "Iron Vanguard",
    description: "Heavy armour. Wide sword sweeps. Built to endure the undying tide.",
    lore: "Last guardian of a shattered kingdom. Death has no meaning left to him.",
    hp: 120,
    damage: 18,
    attackSpeed: 1.0,
    moveSpeed: 8,
    armor: 5,
    dashCooldown: 2.2,
    critChance: 0.05,
    attackType: "melee",
    attackRange: 5,
    projectileSpeed: 0,
    projectilePiercing: false,
    projectileCount: 0,
    projectileSpread: 0,
    projectileRadius: 0,
    projectileLifetime: 0,
    color: "#4a80c0",
    accentColor: "#8090d0",
    auraColor: "#5070ff",
  },

  mage: {
    id: "mage",
    name: "MAGE",
    title: "Void Arcanist",
    description: "Fires piercing arcane orbs that pass through all enemies in their path.",
    lore: "She traded half her soul for knowledge of the void. A fair price.",
    hp: 80,
    damage: 30,
    attackSpeed: 0.85,
    moveSpeed: 7,
    armor: 2,
    dashCooldown: 2.0,
    critChance: 0.08,
    attackType: "projectile",
    attackRange: 40,
    projectileSpeed: 15,
    projectilePiercing: true,
    projectileCount: 1,
    projectileSpread: 0,
    projectileRadius: 0.55,
    projectileLifetime: 2.8,
    color: "#9030d0",
    accentColor: "#cc66ff",
    auraColor: "#a040e0",
  },

  rogue: {
    id: "rogue",
    name: "ROGUE",
    title: "Shadow Blade",
    description: "Hurls twin daggers at blinding speed. Fragile but relentless.",
    lore: "Every dungeon has a fee. She collects it.",
    hp: 90,
    damage: 13,
    attackSpeed: 2.2,
    moveSpeed: 10.5,
    armor: 3,
    dashCooldown: 1.5,
    critChance: 0.12,
    attackType: "projectile",
    attackRange: 30,
    projectileSpeed: 24,
    projectilePiercing: false,
    projectileCount: 2,
    projectileSpread: 0.18,  // ~10 degrees between daggers
    projectileRadius: 0.3,
    projectileLifetime: 1.3,
    color: "#18b870",
    accentColor: "#40e8a0",
    auraColor: "#20c070",
  },
};
