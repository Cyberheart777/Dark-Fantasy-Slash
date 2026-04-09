/**
 * metaStore.ts
 * Persistent Zustand store for cross-run (meta) progression.
 *
 * CHANGES:
 *  - trialWins now tracks highest difficulty cleared per class (was just boolean)
 *  - New: trialBuffs() computed getter returns StatModifiers from trial clears
 *  - completeTrial() now takes difficulty tier
 *  - Backward compatible: old boolean trialWins migrate to "normal"
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { DifficultyTier } from "../data/DifficultyData";

// ─── Trial buff definitions ──────────────────────────────────────────────────
// Each class × difficulty gives a permanent stat bonus.
// These stack: clearing normal+hard+nightmare gives all three.

export interface TrialBuff {
  class: string;
  difficulty: DifficultyTier;
  label: string;
  description: string;
  stat: string;    // key in PlayerStats
  value: number;
}

export const TRIAL_BUFFS: TrialBuff[] = [
  // ── Warrior champion rewards ──
  { class: "warrior", difficulty: "normal",    label: "Vanguard's Resolve",   description: "+5 Armor permanently",           stat: "armor",       value: 5 },
  { class: "warrior", difficulty: "hard",      label: "Vanguard's Fury",      description: "+3 Damage permanently",          stat: "damage",      value: 3 },
  { class: "warrior", difficulty: "nightmare", label: "Vanguard's Immortality", description: "+20 Max HP permanently",       stat: "maxHealth",   value: 20 },
  // ── Mage champion rewards ──
  { class: "mage",    difficulty: "normal",    label: "Arcanist's Focus",     description: "+3% Crit Chance permanently",    stat: "critChance",  value: 0.03 },
  { class: "mage",    difficulty: "hard",      label: "Arcanist's Surge",     description: "+4 Damage permanently",          stat: "damage",      value: 4 },
  { class: "mage",    difficulty: "nightmare", label: "Arcanist's Ascension", description: "+0.08 Attack Speed permanently", stat: "attackSpeed",  value: 0.08 },
  // ── Rogue champion rewards ──
  { class: "rogue",   difficulty: "normal",    label: "Shadow's Swiftness",   description: "+0.5 Move Speed permanently",    stat: "moveSpeed",   value: 0.5 },
  { class: "rogue",   difficulty: "hard",      label: "Shadow's Edge",        description: "+3% Dodge Chance permanently",   stat: "dodgeChance", value: 0.03 },
  { class: "rogue",   difficulty: "nightmare", label: "Shadow's Embrace",     description: "+3% Lifesteal permanently",      stat: "lifesteal",   value: 0.03 },
];

/** Difficulty ranking for comparison. */
const DIFF_RANK: Record<string, number> = { normal: 1, hard: 2, nightmare: 3 };

/** Get all earned trial buffs based on current trialWins state. */
export function getEarnedTrialBuffs(trialWins: Record<string, string>): TrialBuff[] {
  const earned: TrialBuff[] = [];
  for (const buff of TRIAL_BUFFS) {
    const cleared = trialWins[buff.class];
    if (!cleared) continue;
    const clearedRank = DIFF_RANK[cleared] ?? 0;
    const buffRank = DIFF_RANK[buff.difficulty] ?? 0;
    // You earn all buffs at or below your highest clear
    if (clearedRank >= buffRank) earned.push(buff);
  }
  return earned;
}

// ─── Milestone definitions ────────────────────────────────────────────────────

export interface MilestoneDef {
  id: string;
  label: string;
  description: string;
  icon: string;
  unlocks: string;
}

export const MILESTONE_DEFS: MilestoneDef[] = [
  { id: "wave5",    label: "Into the Dark",        description: "Survive to Wave 5",                           icon: "🌊", unlocks: "Unlocks: Mage class" },
  { id: "kills100", label: "Blood Rite",           description: "Slay 100 enemies across all runs",            icon: "💀", unlocks: "Unlocks: Rogue class" },
  { id: "boss_kill",label: "Warden's Fall",        description: "Defeat The Warden Reborn",                    icon: "👑", unlocks: "Unlocks: Dwarf race & Trial of Champions" },
  { id: "wave10",   label: "Undying Descent",      description: "Survive to Wave 10",                          icon: "🔥", unlocks: "Unlocks: Elf race" },
  { id: "kills500", label: "Reaper",               description: "Slay 500 enemies across all runs",            icon: "⚰️", unlocks: "Bonus Soul Forge slot" },
  { id: "trial_warrior", label: "Iron Vanguard Slain", description: "Defeat the Warrior Champion",             icon: "⚔️", unlocks: "Permanent stat buff" },
  { id: "trial_mage",   label: "Void Arcanist Slain", description: "Defeat the Mage Champion",                icon: "✦",  unlocks: "Permanent stat buff" },
  { id: "trial_rogue",  label: "Shadow Blade Slain",  description: "Defeat the Rogue Champion",               icon: "◆",  unlocks: "Permanent stat buff" },
];

// ─── Store ────────────────────────────────────────────────────────────────────

export interface MetaState {
  shards: number;
  totalShardsEarned: number;
  purchased: Record<string, number>;

  milestones: Record<string, boolean>;
  totalKills: number;
  bestWaveEver: number;
  unlockedClasses: string[];
  unlockedRaces: string[];

  // Trial of Champions: highest difficulty cleared per class
  // e.g. { warrior: "hard", mage: "normal" }
  trialWins: Record<string, string>;

  // Gear stash — gear carried out of runs, sellable at forge
  gearStash: Array<{ id: string; name: string; icon: string; rarity: string; slot: string }>;

  // First-run onboarding flag — set once the player has seen the HUD tutorial
  hasSeenTutorial: boolean;

  // User settings — persisted across runs
  settings: {
    screenShake: boolean;   // camera shake on hits / kills / boss slams
    damageNumbers: boolean; // floating numeric popups (text popups always show)
  };

  // Actions
  addShards: (amount: number) => void;
  spendShards: (amount: number) => boolean;
  setUpgradeRank: (id: string, rank: number) => void;
  purchaseRank: (id: string, cost: number, maxRanks: number) => boolean;
  hardReset: () => void;

  unlockMilestone: (id: string) => void;
  addTotalKills: (n: number) => void;
  updateBestWave: (wave: number) => void;
  checkUnlocks: () => void;
  completeTrial: (cls: string, difficulty?: string) => void;
  addGearToStash: (gear: { id: string; name: string; icon: string; rarity: string; slot: string }) => void;
  sellGear: (index: number) => void;
  markTutorialSeen: () => void;
  setSettings: (patch: Partial<MetaState["settings"]>) => void;
}

/** Shard value when selling gear at the forge. Intentionally low. */
const GEAR_SELL_VALUE: Record<string, number> = {
  common: 5,
  rare: 15,
  epic: 35,
};

const DEFAULT_STATE = {
  shards: 0,
  totalShardsEarned: 0,
  purchased: {} as Record<string, number>,
  milestones: {} as Record<string, boolean>,
  totalKills: 0,
  bestWaveEver: 0,
  unlockedClasses: ["warrior"] as string[],
  unlockedRaces: ["human"] as string[],
  trialWins: {} as Record<string, string>,
  gearStash: [] as Array<{ id: string; name: string; icon: string; rarity: string; slot: string }>,
  hasSeenTutorial: false,
  settings: {
    screenShake: true,
    damageNumbers: true,
  },
};

export const useMetaStore = create<MetaState>()(
  persist(
    (set, get) => ({
      ...DEFAULT_STATE,

      addShards: (amount) =>
        set((s) => ({
          shards: s.shards + amount,
          totalShardsEarned: s.totalShardsEarned + amount,
        })),

      spendShards: (amount) => {
        const s = get();
        if (s.shards < amount) return false;
        set({ shards: s.shards - amount });
        return true;
      },

      setUpgradeRank: (id, rank) =>
        set((s) => ({ purchased: { ...s.purchased, [id]: rank } })),

      purchaseRank: (id, cost, maxRanks) => {
        const s = get();
        const current = s.purchased[id] ?? 0;
        if (current >= maxRanks) return false;
        if (s.shards < cost) return false;
        set({
          shards: s.shards - cost,
          purchased: { ...s.purchased, [id]: current + 1 },
        });
        return true;
      },

      hardReset: () => set({ ...DEFAULT_STATE }),

      unlockMilestone: (id) =>
        set((s) => ({
          milestones: { ...s.milestones, [id]: true },
        })),

      addTotalKills: (n) => {
        const s = get();
        const newTotal = s.totalKills + n;
        const newMilestones = { ...s.milestones };
        if (newTotal >= 100) newMilestones["kills100"] = true;
        if (newTotal >= 500) newMilestones["kills500"] = true;
        set({ totalKills: newTotal, milestones: newMilestones });
      },

      updateBestWave: (wave) => {
        const s = get();
        if (wave <= s.bestWaveEver) return;
        const newMilestones = { ...s.milestones };
        if (wave >= 5) newMilestones["wave5"] = true;
        if (wave >= 10) newMilestones["wave10"] = true;
        set({ bestWaveEver: wave, milestones: newMilestones });
      },

      checkUnlocks: () => {
        const s = get();
        const classes: string[] = ["warrior"];
        if (s.milestones["wave5"]) classes.push("mage");
        if (s.milestones["kills100"]) classes.push("rogue");
        const races: string[] = ["human"];
        if (s.milestones["boss_kill"]) races.push("dwarf");
        if (s.milestones["wave10"]) races.push("elf");
        set({ unlockedClasses: classes, unlockedRaces: races });
      },

      completeTrial: (cls: string, difficulty: string = "normal") => {
        const s = get();
        const current = s.trialWins[cls];
        const currentRank = current ? (DIFF_RANK[current] ?? 0) : 0;
        const newRank = DIFF_RANK[difficulty] ?? 0;
        if (newRank <= currentRank) {
          set((s2) => ({
            milestones: { ...s2.milestones, [`trial_${cls}`]: true },
          }));
          return;
        }
        set((s2) => ({
          trialWins: { ...s2.trialWins, [cls]: difficulty },
          milestones: { ...s2.milestones, [`trial_${cls}`]: true },
        }));
      },

      addGearToStash: (gear) =>
        set((s) => ({ gearStash: [...s.gearStash, gear] })),

      sellGear: (index) => {
        const s = get();
        const item = s.gearStash[index];
        if (!item) return;
        const value = GEAR_SELL_VALUE[item.rarity] ?? 5;
        const newStash = [...s.gearStash];
        newStash.splice(index, 1);
        set({
          gearStash: newStash,
          shards: s.shards + value,
          totalShardsEarned: s.totalShardsEarned + value,
        });
      },

      markTutorialSeen: () => set({ hasSeenTutorial: true }),

      setSettings: (patch) =>
        set((s) => ({ settings: { ...s.settings, ...patch } })),
    }),
    {
      name: "dungeon-requiem-meta",
      version: 5, // bumped from 4 — triggers migration
      migrate: (persisted: any, version: number) => {
        let state = persisted ?? {};
        if (version < 3) {
          // Migrate old boolean trialWins to difficulty strings
          const oldWins = state?.trialWins ?? {};
          const newWins: Record<string, string> = {};
          for (const [cls, val] of Object.entries(oldWins)) {
            if (val === true) newWins[cls] = "normal";
            else if (typeof val === "string") newWins[cls] = val;
          }
          state = { ...state, trialWins: newWins };
        }
        if (version < 4) {
          // Returning players have already learned the controls — skip the
          // tutorial overlay for them. Only fresh installs see it.
          state = { ...state, hasSeenTutorial: true };
        }
        if (version < 5) {
          // New user settings default to on for returning players.
          state = {
            ...state,
            settings: { screenShake: true, damageNumbers: true },
          };
        }
        return state as MetaState;
      },
    },
  ),
);
