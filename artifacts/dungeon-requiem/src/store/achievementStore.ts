/**
 * achievementStore.ts
 * Zustand store for achievement unlock tracking.
 * tryUnlock() is the single hook point for future Steam SDK integration.
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { ACHIEVEMENT_MAP } from "../data/AchievementData";

export interface AchievementState {
  /** Map of achievement id → unlock timestamp (ms). */
  unlocked: Record<string, number>;

  /** Queue of achievement ids to show as toasts (FIFO). */
  toastQueue: string[];

  /** Try to unlock an achievement. Returns true if newly unlocked. */
  tryUnlock: (id: string) => boolean;

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
      toastQueue: [],

      tryUnlock: (id: string) => {
        const s = get();
        if (s.unlocked[id]) return false;
        const def = ACHIEVEMENT_MAP[id];
        if (!def) return false;

        set({
          unlocked: { ...s.unlocked, [id]: Date.now() },
          toastQueue: [...s.toastQueue, id],
        });

        if (def.shardReward && def.shardReward > 0) {
          import("./metaStore").then(({ useMetaStore }) => {
            useMetaStore.getState().addShards(def.shardReward!);
          });
        }

        return true;
      },

      isUnlocked: (id: string) => !!get().unlocked[id],

      popToast: () => {
        const s = get();
        if (s.toastQueue.length === 0) return null;
        const [next, ...rest] = s.toastQueue;
        set({ toastQueue: rest });
        return next;
      },

      resetAchievements: () => set({ unlocked: {}, toastQueue: [] }),
    }),
    {
      name: "dungeon-requiem-achievements",
      version: 1,
      partialize: (state) => ({ unlocked: state.unlocked }),
    },
  ),
);
