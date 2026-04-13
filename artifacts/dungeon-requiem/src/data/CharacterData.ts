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
  story: string;
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
  image: string;          // portrait filename in public/images/
}

export const CHARACTER_DATA: Record<CharacterClass, CharacterDef> = {
  warrior: {
    id: "warrior",
    name: "WARRIOR",
    title: "Iron Vanguard",
    description: "Heavy armour. Wide sword sweeps. Built to endure the undying tide.",
    lore: "You refused to fall. Your blade is not for glory — it is a promise.",
    story: "When the Vault opened, your order was sent to seal it. None returned — only their armor, bent inward from the inside. You are the last, and you stayed not out of courage, but out of refusal.",
    hp: 120,
    damage: 50,
    attackSpeed: 1.0,
    moveSpeed: 8,
    armor: 5,
    dashCooldown: 2.2,
    critChance: 0.05,
    attackType: "melee",
    attackRange: 6.5,
    projectileSpeed: 0,
    projectilePiercing: false,
    projectileCount: 0,
    projectileSpread: 0,
    projectileRadius: 0,
    projectileLifetime: 0,
    color: "#4a80c0",
    accentColor: "#8090d0",
    auraColor: "#5070ff",
    image: "Warrior.png",
  },

  mage: {
    id: "mage",
    name: "MAGE",
    title: "Void Arcanist",
    description: "Fires piercing arcane orbs that pass through all enemies in their path.",
    lore: "Magic is dying everywhere. Except down here.",
    story: "Every spell you cast in this place feels wrong — stronger than it should be, alive in ways it was never meant to be. The Vault is not consuming your power. It is feeding it.",
    hp: 80,
    damage: 30,
    attackSpeed: 0.85,
    moveSpeed: 7,
    armor: 2,
    dashCooldown: 2.4,
    critChance: 0.08,
    attackType: "projectile",
    attackRange: 22,
    projectileSpeed: 15,
    projectilePiercing: true,
    projectileCount: 1,
    projectileSpread: 0.18,
    projectileRadius: 0.55,
    projectileLifetime: 1.5,
    color: "#9030d0",
    accentColor: "#cc66ff",
    auraColor: "#a040e0",
    image: "Mage.png",
  },

  rogue: {
    id: "rogue",
    name: "ROGUE",
    title: "Shadow Blade",
    description: "Hurls twin daggers at blinding speed. Fragile but relentless.",
    lore: "You escaped once. Now something is coming to collect.",
    story: "You crawled out of the Vault once with pockets full of Soul Shards — and something else you can't quite name. A debt you don't remember signing. The whispers have returned to collect.",
    hp: 90,
    damage: 13,
    attackSpeed: 2.2,
    moveSpeed: 10.5,
    armor: 3,
    dashCooldown: 1.2,
    critChance: 0.12,
    attackType: "projectile",
    attackRange: 20,
    projectileSpeed: 24,
    projectilePiercing: false,
    projectileCount: 2,
    projectileSpread: 0.18,
    projectileRadius: 0.3,
    projectileLifetime: 1.0,
    color: "#18b870",
    accentColor: "#40e8a0",
    auraColor: "#20c070",
    image: "Rogue.png",
  },
};
