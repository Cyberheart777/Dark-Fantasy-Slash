/**
 * RaceData.ts
 * Playable races — each applies multiplicative modifiers to the class base stats.
 * Races are selected BEFORE class on the character select screen.
 * Human is always available. Dwarf and Elf unlock via milestones.
 */

export type RaceType = "human" | "elf" | "dwarf";

export interface RaceDef {
  id: RaceType;
  name: string;
  title: string;
  lore: string;
  icon: string;
  description: string;
  unlockCondition?: string;
  // Multipliers applied to class base stats
  hpMult: number;
  damageMult: number;
  moveSpeedMult: number;
  attackSpeedMult: number;
  armorBonus: number;
  critBonus: number;
}

export const RACE_DATA: Record<RaceType, RaceDef> = {
  human: {
    id: "human",
    name: "HUMAN",
    title: "Stalwart",
    lore: "Adaptable and unyielding. No weakness, no ceiling.",
    icon: "⚔",
    description: "Balanced stats. A clean slate for any build.",
    hpMult: 1,
    damageMult: 1,
    moveSpeedMult: 1,
    attackSpeedMult: 1,
    armorBonus: 0,
    critBonus: 0,
  },
  elf: {
    id: "elf",
    name: "ELF",
    title: "Shadowborn",
    lore: "Born of twilight and speed. They strike before you see them.",
    icon: "✦",
    description: "+20% move speed · +18% atk speed · −18% HP · −8% damage",
    unlockCondition: "Reach Wave 10",
    hpMult: 0.82,
    damageMult: 0.92,
    moveSpeedMult: 1.20,
    attackSpeedMult: 1.18,
    armorBonus: -2,
    critBonus: 0.04,
  },
  dwarf: {
    id: "dwarf",
    name: "DWARF",
    title: "Ironborn",
    lore: "Carved from stone. They do not fall easily.",
    icon: "⬡",
    description: "+22% HP · +8 armor · +12% damage · −15% speed",
    unlockCondition: "Defeat The Warden (Boss)",
    hpMult: 1.22,
    damageMult: 1.12,
    moveSpeedMult: 0.85,
    attackSpeedMult: 0.90,
    armorBonus: 8,
    critBonus: 0,
  },
};

export const RACES: RaceType[] = ["human", "elf", "dwarf"];
