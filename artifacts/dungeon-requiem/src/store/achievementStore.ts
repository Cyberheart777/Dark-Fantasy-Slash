/**
 * achievementStore.ts
 * Zustand store for achievement unlock tracking.
 * tryUnlock() is the single hook point for future Steam SDK integration.
 * Shard rewards are claimed manually via the Achievements panel.
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { ACHIEVEMENT_MAP } from "../data/AchievementData";

export interface AchievementState {
  /** Map of achievement id → unlock timestamp (ms). */
  unlocked: Record<string, number>;

  /** Map of achievement id → true if shard reward has been claimed. */
  claimed: Record<string, boolean>;

  /** Queue of achievement ids to show as toasts (FIFO). */
  toastQueue: string[];

  /** Try to unlock an achievement. Returns true if newly unlocked. */
  tryUnlock: (id: string) => boolean;

  /** Claim the shard reward for an unlocked achievement. Returns shards awarded (0 if already claimed). */
  claimReward: (id: string) => number;

  /** Check if an achievement is already unlocked. */
  isUnlocked: (id: string) => boolean;

  /** Pop the next toast from the queue. Returns the id or null. */
  popToast: () => string | null;

  /** Reset all achievements (for hard reset). */
  resetAchievements: () => void;
}

export const useAchievementStore = create<AchievementState>()(
  persist(
    (set, get) => ({
      unlocked: {},
      claimed: {},
      toastQueue: [],

      tryUnlock: (id: string) => {
        const s = get();
        if (s.unlocked[id]) return false;
        if (!ACHIEVEMENT_MAP[id]) return false;

        set({
          unlocked: { ...s.unlocked, [id]: Date.now() },
          toastQueue: [...s.toastQueue, id],
        });

        return true;
      },

      claimReward: (id: string) => {
        const s = get();
        if (!s.unlocked[id]) return 0;
        if (s.claimed[id]) return 0;
        const def = ACHIEVEMENT_MAP[id];
        if (!def || !def.shardReward || def.shardReward <= 0) return 0;
        set({ claimed: { ...s.claimed, [id]: true } });
        return def.shardReward;
      },

      isUnlocked: (id: string) => !!get().unlocked[id],

      popToast: () => {
        const s = get();
        if (s.toastQueue.length === 0) return null;
        const [next, ...rest] = s.toastQueue;
        set({ toastQueue: rest });
        return next;
      },

      resetAchievements: () => set({ unlocked: {}, claimed: {}, toastQueue: [] }),
    }),
    {
      name: "dungeon-requiem-achievements",
      version: 2,
      partialize: (state) => ({ unlocked: state.unlocked, claimed: state.claimed }),
    },
  ),
);
