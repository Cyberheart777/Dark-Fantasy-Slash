/**
 * RaceData.ts
 * Playable races. Three races: Human (baseline), Elf (tall + narrow),
 * Dwarf (short + wide). Races are selected BEFORE class on the
 * character select screen.
 *
 * ─────────────────────────────────────────────────────────────────────
 * ALPHA-PASS STATE: VISUAL DIFFERENCES ONLY
 * ─────────────────────────────────────────────────────────────────────
 * Race currently affects ONLY the character's 3D mesh scale. Stat
 * multipliers (hpMult, damageMult, moveSpeedMult, attackSpeedMult,
 * armorBonus, critBonus) are all at IDENTITY values (1.0 / 0) so race
 * choice has zero gameplay implications this pass. The mult fields
 * are left on RaceDef so the stat-application sites in GameScene
 * (`def.hp * raceDef.hpMult`, etc.) stay live — flipping race stats
 * back on is a data-only edit here, no downstream refactor required.
 *
 * FUTURE: wire racial stat bonuses here post-Alpha
 * ─────────────────────────────────────────────────────────────────────
 */

// ─── Visual scale constants ──────────────────────────────────────────────────
// Tunable per-race mesh multipliers. Non-uniform: HEIGHT scales the
// Y-axis of the character group; WIDTH scales X + Z. Consumed by
// Player3D.tsx (scaleForRace) — both main game + labyrinth share
// that renderer, so one source of truth for visuals.
//
// Human is baseline (no constants, implicit 1.0 × 1.0).
export const RACE_ELF_HEIGHT_MULT = 1.15;   // 15% taller
export const RACE_ELF_WIDTH_MULT  = 0.85;   // 15% narrower
export const RACE_DWARF_HEIGHT_MULT = 0.75; // 25% shorter
export const RACE_DWARF_WIDTH_MULT  = 1.25; // 25% wider

export type RaceType = "human" | "elf" | "dwarf";

export interface RaceDef {
  id: RaceType;
  name: string;
  title: string;
  lore: string;
  icon: string;
  image: string;           // portrait filename in public/images/
  description: string;
  unlockCondition?: string;
  // Visual mesh scale. Applied per-frame in Player3D to the outer
  // group of each class mesh. Non-uniform so e.g. Dwarf reads as
  // stocky rather than uniformly smaller.
  heightMult: number;
  widthMult: number;
  // Stat multipliers — currently neutralised to IDENTITY values
  // per the Alpha-pass visual-only spec. Kept on the interface so
  // post-Alpha stat tuning is a data-only edit. See the module
  // docstring above.
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
    image: "human.png",
    description: "Baseline proportions. A clean slate for any build.",
    heightMult: 1.0,
    widthMult: 1.0,
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
    image: "elf.png",
    description: "Tall and narrow. Agile, elegant silhouette.",
    unlockCondition: "Reach Wave 10",
    heightMult: RACE_ELF_HEIGHT_MULT,
    widthMult: RACE_ELF_WIDTH_MULT,
    // FUTURE: wire racial stat bonuses here post-Alpha
    hpMult: 1,
    damageMult: 1,
    moveSpeedMult: 1,
    attackSpeedMult: 1,
    armorBonus: 0,
    critBonus: 0,
  },
  dwarf: {
    id: "dwarf",
    name: "DWARF",
    title: "Ironborn",
    lore: "Carved from stone. They do not fall easily.",
    icon: "⬡",
    image: "dwarf.png",
    description: "Short and wide. Stocky, powerful build.",
    unlockCondition: "Defeat The Warden (Boss)",
    heightMult: RACE_DWARF_HEIGHT_MULT,
    widthMult: RACE_DWARF_WIDTH_MULT,
    // FUTURE: wire racial stat bonuses here post-Alpha
    hpMult: 1,
    damageMult: 1,
    moveSpeedMult: 1,
    attackSpeedMult: 1,
    armorBonus: 0,
    critBonus: 0,
  },
};

export const RACES: RaceType[] = ["human", "elf", "dwarf"];

/** Visual scale tuple consumed by Player3D.
 *  Returns [widthScale, heightScale, widthScale] so non-uniform
 *  scaling reads correctly on X/Y/Z of a character group. */
export function meshScaleForRace(race: RaceType): [number, number, number] {
  const def = RACE_DATA[race];
  return [def.widthMult, def.heightMult, def.widthMult];
}
