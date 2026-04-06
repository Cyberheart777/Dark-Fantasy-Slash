/**
 * metaStore.ts
 * Persistent Zustand store for cross-run (meta) progression.
 * Data survives page refreshes via localStorage.
 *
 * Kept completely separate from gameStore so it is never reset
 * between runs — only explicit player actions change it.
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";

// ─── Milestone definitions ────────────────────────────────────────────────────

export interface MilestoneDef {
  id: string;
  label: string;
  description: string;
  icon: string;
  // What it unlocks (display only — actual unlock derived in checkUnlocks)
  unlocks: string;
}

export const MILESTONE_DEFS: MilestoneDef[] = [
  {
    id: "wave5",
    label: "Into the Dark",
    description: "Survive to Wave 5",
    icon: "🌊",
    unlocks: "Unlocks: Mage class",
  },
  {
    id: "kills100",
    label: "Blood Rite",
    description: "Slay 100 enemies across all runs",
    icon: "💀",
    unlocks: "Unlocks: Rogue class",
  },
  {
    id: "boss_kill",
    label: "Warden's Fall",
    description: "Defeat The Warden Reborn",
    icon: "👑",
    unlocks: "Unlocks: Dwarf race",
  },
  {
    id: "wave10",
    label: "Undying Descent",
    description: "Survive to Wave 10",
    icon: "🔥",
    unlocks: "Unlocks: Elf race",
  },
  {
    id: "kills500",
    label: "Reaper",
    description: "Slay 500 enemies across all runs",
    icon: "⚰️",
    unlocks: "Bonus Soul Forge slot",
  },
];

// ─── Store ────────────────────────────────────────────────────────────────────

export interface MetaState {
  shards: number;
  totalShardsEarned: number;
  purchased: Record<string, number>;

  // Milestone & unlock tracking
  milestones: Record<string, boolean>;
  totalKills: number;
  bestWaveEver: number;
  unlockedClasses: string[];
  unlockedRaces: string[];

  // Actions
  addShards: (amount: number) => void;
  spendShards: (amount: number) => boolean;
  setUpgradeRank: (id: string, rank: number) => void;
  purchaseRank: (id: string, cost: number, maxRanks: number) => boolean;
  hardReset: () => void;

  // Milestone actions
  unlockMilestone: (id: string) => void;
  addTotalKills: (n: number) => void;
  updateBestWave: (wave: number) => void;
  checkUnlocks: () => void;
}

const DEFAULT_STATE = {
  shards: 0,
  totalShardsEarned: 0,
  purchased: {} as Record<string, number>,
  milestones: {} as Record<string, boolean>,
  totalKills: 0,
  bestWaveEver: 0,
  unlockedClasses: ["warrior"] as string[],
  unlockedRaces: ["human"] as string[],
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

      // ─── Milestone actions ───────────────────────────────────────────────

      unlockMilestone: (id) =>
        set((s) => ({
          milestones: { ...s.milestones, [id]: true },
        })),

      addTotalKills: (n) => {
        const s = get();
        const newTotal = s.totalKills + n;
        // Derive wave milestones from kills while we're here
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
    }),
    {
      name: "dungeon-requiem-meta",
      version: 2,
    },
  ),
);
