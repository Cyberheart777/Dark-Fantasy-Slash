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

export interface MetaState {
  /** Current unspent soul shards. */
  shards: number;
  /** Total shards ever collected (for display). */
  totalShardsEarned: number;
  /** Purchased rank per upgrade id. 0 = not purchased. */
  purchased: Record<string, number>;

  // Actions
  addShards: (amount: number) => void;
  spendShards: (amount: number) => boolean;
  setUpgradeRank: (id: string, rank: number) => void;
  /** Purchase the next rank of an upgrade. Returns true on success. */
  purchaseRank: (id: string, cost: number, maxRanks: number) => boolean;
  /** Dev/debug reset — wipes all meta progress. */
  hardReset: () => void;
}

const DEFAULT_STATE = {
  shards: 0,
  totalShardsEarned: 0,
  purchased: {} as Record<string, number>,
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
    }),
    {
      name: "dungeon-requiem-meta",
      version: 1,
    },
  ),
);
