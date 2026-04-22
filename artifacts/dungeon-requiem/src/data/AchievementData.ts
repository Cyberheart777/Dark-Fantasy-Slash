/**
 * AchievementData.ts
 * Registry of all achievements with metadata.
 * ~45 achievements across 5 categories.
 */

export type AchievementCategory = "progression" | "combat" | "mastery" | "gear" | "secret" | "labyrinth";

export interface AchievementDef {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: AchievementCategory;
  hidden?: boolean;
  shardReward?: number;
}

export const ACHIEVEMENTS: AchievementDef[] = [
  // ── Progression ──────────────────────────────────────────────────────────────
  { id: "wave_5",              name: "First Steps",           description: "Survive to Wave 5",                          icon: "🌊", category: "progression", shardReward: 25 },
  { id: "wave_10",             name: "Deep Descent",          description: "Survive to Wave 10",                         icon: "🔥", category: "progression", shardReward: 25 },
  { id: "wave_15",             name: "Abyssal Reach",         description: "Survive to Wave 15",                         icon: "🌑", category: "progression", shardReward: 25 },
  { id: "wave_20",             name: "Into the Void",         description: "Survive to Wave 20",                         icon: "🕳️", category: "progression", shardReward: 25 },
  { id: "wave_25",             name: "Deathless March",       description: "Survive to Wave 25",                         icon: "💀", category: "progression", shardReward: 25 },
  { id: "wave_30",             name: "Eternal Descent",       description: "Survive to Wave 30",                         icon: "♾️", category: "progression", shardReward: 25 },
  { id: "arcane_awakening",    name: "Arcane Awakening",      description: "Unlock the Mage class",                      icon: "✦",  category: "progression", shardReward: 25 },
  { id: "blade_in_dark",       name: "Blade in the Dark",     description: "Unlock the Rogue class",                     icon: "◆",  category: "progression", shardReward: 25 },
  { id: "stout_heart",         name: "Stout Heart",           description: "Unlock the Dwarf race",                      icon: "⛏️", category: "progression", shardReward: 25 },
  { id: "elven_grace",         name: "Elven Grace",           description: "Unlock the Elf race",                        icon: "🏹", category: "progression", shardReward: 25 },
  { id: "normal_clear",        name: "Dungeon Conquered",     description: "Clear Wave 20 on Normal difficulty",         icon: "🏰", category: "progression", shardReward: 25 },
  { id: "hard_clear",          name: "Hardened Veteran",      description: "Clear Wave 20 on Hard difficulty",           icon: "⚔️", category: "progression", shardReward: 25 },
  { id: "nightmare_clear",     name: "Nightmare's End",       description: "Clear Wave 20 on Nightmare difficulty",      icon: "👹", category: "progression", shardReward: 25 },

  // ── Combat ───────────────────────────────────────────────────────────────────
  { id: "kills_1000",          name: "Hundredfold Slaughter", description: "Slay 1,000 enemies across all runs",         icon: "💀", category: "combat", shardReward: 25 },
  { id: "kills_5000",          name: "Butcher of the Deep",   description: "Slay 5,000 enemies across all runs",         icon: "☠️", category: "combat", shardReward: 25 },
  { id: "kills_10000",         name: "Reaper Eternal",        description: "Slay 10,000 enemies across all runs",        icon: "⚰️", category: "combat", shardReward: 25 },
  { id: "kills_200_run",       name: "Killing Spree",         description: "Slay 200 enemies in a single run",          icon: "🗡️", category: "combat", shardReward: 25 },
  { id: "kills_500_run",       name: "Massacre",              description: "Slay 500 enemies in a single run",          icon: "🩸", category: "combat", shardReward: 25 },
  { id: "boss_slayer",         name: "Warden's Fall",         description: "Defeat The Warden Reborn",                   icon: "👑", category: "combat", shardReward: 25 },
  { id: "nightmare_boss",      name: "Nightmare Slayer",      description: "Defeat a boss on Nightmare difficulty",      icon: "😈", category: "combat", shardReward: 25 },
  { id: "goblin_slayer",       name: "Goblin Hunter",         description: "Slay an XP Goblin",                          icon: "🟡", category: "combat", shardReward: 25 },
  { id: "nemesis_vanquished",  name: "Nemesis Vanquished",    description: "Defeat your Nemesis",                        icon: "⚔️", category: "combat", shardReward: 25 },

  // ── Mastery ──────────────────────────────────────────────────────────────────
  { id: "trial_warrior_normal",    name: "Iron Vanguard",         description: "Complete the Warrior trial on Normal",        icon: "🛡️", category: "mastery", shardReward: 25 },
  { id: "trial_warrior_hard",      name: "Steel Vanguard",        description: "Complete the Warrior trial on Hard",          icon: "🛡️", category: "mastery", shardReward: 25 },
  { id: "trial_warrior_nightmare", name: "Adamant Vanguard",      description: "Complete the Warrior trial on Nightmare",     icon: "🛡️", category: "mastery", shardReward: 25 },
  { id: "trial_mage_normal",      name: "Void Initiate",         description: "Complete the Mage trial on Normal",           icon: "🔮", category: "mastery", shardReward: 25 },
  { id: "trial_mage_hard",        name: "Void Adept",            description: "Complete the Mage trial on Hard",             icon: "🔮", category: "mastery", shardReward: 25 },
  { id: "trial_mage_nightmare",   name: "Void Archon",           description: "Complete the Mage trial on Nightmare",        icon: "🔮", category: "mastery", shardReward: 25 },
  { id: "trial_rogue_normal",     name: "Shadow Apprentice",     description: "Complete the Rogue trial on Normal",          icon: "🗡️", category: "mastery", shardReward: 25 },
  { id: "trial_rogue_hard",       name: "Shadow Master",         description: "Complete the Rogue trial on Hard",            icon: "🗡️", category: "mastery", shardReward: 25 },
  { id: "trial_rogue_nightmare",  name: "Shadow Sovereign",      description: "Complete the Rogue trial on Nightmare",       icon: "🗡️", category: "mastery", shardReward: 25 },
  { id: "champion_of_all",        name: "Champion of All",       description: "Complete all 9 trial challenges",             icon: "🏆", category: "mastery", shardReward: 25 },

  // ── Gear ─────────────────────────────────────────────────────────────────────
  { id: "first_equip",        name: "Armed and Ready",       description: "Equip your first piece of gear",             icon: "⚔️", category: "gear", shardReward: 25 },
  { id: "legendary_discovery", name: "Legendary Discovery",  description: "Find an Epic-rarity item",                   icon: "💎", category: "gear", shardReward: 25 },
  { id: "perfection",          name: "Perfection",            description: "Enhance a piece of gear to its maximum",     icon: "✨", category: "gear", shardReward: 25 },
  { id: "golden_arsenal",      name: "Golden Arsenal",        description: "Enhance an Epic item to +7",                 icon: "🌟", category: "gear", shardReward: 25 },
  { id: "first_upgrade",       name: "Soul Infusion",         description: "Purchase your first Soul Forge upgrade",     icon: "◈",  category: "gear", shardReward: 25 },
  { id: "master_smith",        name: "Master Smith",          description: "Purchase 10 total Soul Forge upgrades",      icon: "🔨", category: "gear", shardReward: 25 },

  // ── Secret ───────────────────────────────────────────────────────────────────
  { id: "another_bites_dust",  name: "Another Bites the Dust", description: "Die from Vampiric Shroud's HP drain",      icon: "💉", category: "secret", hidden: true, shardReward: 25 },
  { id: "deaths_bargain_save", name: "Death's Bargain",       description: "Survive a fatal hit with Death's Bargain",   icon: "💀", category: "secret", hidden: true, shardReward: 25 },
  { id: "extraction_artist",   name: "Extraction Artist",     description: "Successfully extract from a run",            icon: "↑",  category: "secret", hidden: true, shardReward: 25 },
  { id: "soul_hoarder",        name: "Soul Hoarder",          description: "Accumulate 5,000 total soul shards earned",  icon: "💰", category: "secret", hidden: true, shardReward: 25 },
  { id: "level_20_run",        name: "Overleveled",           description: "Reach Level 20 in a single run",             icon: "📈", category: "secret", hidden: true, shardReward: 25 },
  { id: "full_loadout",        name: "Fully Loaded",          description: "Start a run with gear in all 3 loadout slots", icon: "🎽", category: "secret", hidden: true, shardReward: 25 },

  // ── The Labyrinth ────────────────────────────────────────────────────────────
  { id: "lab_ghost_protocol",  name: "Ghost Protocol",        description: "Extract from the labyrinth without taking any shroud damage",   icon: "👻", category: "labyrinth", shardReward: 25 },
  { id: "lab_last_train_out",  name: "Last Train Out",        description: "Extract within the final 10 seconds of the run",                icon: "🚂", category: "labyrinth", shardReward: 25 },
  { id: "lab_speed_runner",    name: "Speed Runner",          description: "Extract from the labyrinth in under 4 minutes",                 icon: "⚡", category: "labyrinth", shardReward: 25 },
  { id: "lab_all_roads",       name: "All Roads Lead Out",    description: "Extract from the labyrinth with all three classes",             icon: "🗺️", category: "labyrinth", shardReward: 25 },
  { id: "lab_rival_slayer",    name: "Rival Slayer",          description: "Kill 5 rival champions in a single labyrinth run",              icon: "⚔️", category: "labyrinth", shardReward: 25 },
  { id: "lab_full_clearance",  name: "Full Clearance",        description: "Open the vault room AND defeat the Warden in a single run",     icon: "🗝️", category: "labyrinth", shardReward: 25 },
  { id: "lab_nemesis",         name: "Nemesis",               description: "Kill 100 enemies across all Labyrinth runs",                    icon: "🎯", category: "labyrinth", shardReward: 25 },
  { id: "lab_iron_will",       name: "Iron Will",             description: "Extract from the labyrinth without picking up any gear",        icon: "💪", category: "labyrinth", shardReward: 25 },
  { id: "lab_wrong_turn",      name: "Wrong Turn",            description: "Die in the poison shroud within the first minute of a run",     icon: "☠️", category: "labyrinth", shardReward: 25 },
  { id: "lab_so_close",        name: "So Close",              description: "Die within 10 units of an extraction portal",                   icon: "😩", category: "labyrinth", shardReward: 25 },
  // Cross-run
  { id: "lab_skeleton_key",    name: "Skeleton Key",          description: "Obtain the champion key 7 times across all runs",              icon: "🗝️", category: "labyrinth", shardReward: 25 },
  { id: "lab_long_game",       name: "The Long Game",         description: "Complete 10 Labyrinth runs (extract or die — both count)",     icon: "⏳", category: "labyrinth", shardReward: 25 },
  { id: "lab_extractor",       name: "Extractor",             description: "Extract successfully 5 times across all runs",                  icon: "↑",  category: "labyrinth", shardReward: 25 },
  { id: "lab_wardens_bane",    name: "Warden's Bane",         description: "Defeat the Warden 3 times across all runs",                    icon: "⚰️", category: "labyrinth", shardReward: 25 },
  { id: "lab_hard_conqueror",  name: "Abyss Conqueror",       description: "Complete all 3 layers of the Labyrinth on Hard Mode",           icon: "🔥", category: "labyrinth", shardReward: 25 },
  { id: "lab_nightmare_conqueror", name: "Abyssal Nightmare", description: "Complete all 3 layers of the Labyrinth on Nightmare",           icon: "💀", category: "labyrinth", shardReward: 25 },
];

/** Lookup map for O(1) access by id. */
export const ACHIEVEMENT_MAP: Record<string, AchievementDef> = Object.fromEntries(
  ACHIEVEMENTS.map((a) => [a.id, a]),
);

export const ACHIEVEMENT_CATEGORIES: AchievementCategory[] = [
  "progression", "combat", "mastery", "gear", "labyrinth", "secret",
];

export const CATEGORY_LABELS: Record<AchievementCategory, string> = {
  progression: "Progression",
  combat: "Combat",
  mastery: "Mastery",
  gear: "Gear",
  labyrinth: "The Labyrinth",
  secret: "Secrets",
};
