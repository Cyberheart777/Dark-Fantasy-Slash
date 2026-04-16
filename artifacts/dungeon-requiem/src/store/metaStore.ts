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
import { useAchievementStore } from "./achievementStore";

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

export interface StashItem {
  id: string;
  name: string;
  icon: string;
  rarity: string;
  slot: string;
  enhanceLevel?: number;
  /** Stored bonuses from the original GearDef. Needed for stat display in UI. */
  bonuses?: Record<string, number>;
}

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

  // Difficulty gating: highest wave with a boss cleared per difficulty tier.
  // Hard unlocks when normal >= 20. Nightmare unlocks when hard >= 20.
  difficultyClears: Record<DifficultyTier, number>;

  // Gear stash — gear carried out of runs, sellable/equippable at forge
  gearStash: StashItem[];

  // Pre-run loadout — gear equipped before starting a run
  equippedLoadout: Record<string, StashItem | null>;

  // First-run onboarding flag — set once the player has seen the HUD tutorial
  hasSeenTutorial: boolean;

  /** Bestiary unlock tracking. Once an affix has been encountered
   *  in ANY run (across reloads), its bestiary entry unlocks. The
   *  Bestiary screen reads this map to gate locked entries.
   *  Map key = AffixData EnemyAffix id. */
  discoveredAffixes: Record<string, boolean>;

  // ─── Labyrinth cross-run counters ─────────────────────────────────
  // Persisted across sessions. Labyrinth achievements use these for
  // "X across all runs" goals. Incremented by actions below; read
  // by achievement-unlock checks inside LabyrinthScene run-end.
  /** Total enemies killed across all labyrinth runs (Nemesis). */
  labyrinthKillCount: number;
  /** Which classes have extracted at least once (All Roads Lead Out).
   *  Map keyed by CharacterClass id → true when that class has
   *  extracted. Boolean-true entries are never removed; the "All
   *  Roads" achievement fires when all three classes are present. */
  labyrinthExtractedClasses: Record<string, boolean>;
  /** Total champion keys obtained across all runs (Skeleton Key). */
  labyrinthChampionKeyCount: number;
  /** Total labyrinth runs completed — extract OR defeat both count
   *  (The Long Game). Incremented once per run on the run-end
   *  salvage fire. */
  labyrinthRunCount: number;
  /** Total successful extractions across all runs (Extractor). */
  labyrinthExtractionCount: number;
  /** Total Warden defeats across all runs (Warden's Bane). */
  labyrinthWardenKills: number;

  // User settings — persisted across runs
  settings: {
    screenShake: boolean;   // camera shake on hits / kills / boss slams
    damageNumbers: boolean; // floating numeric popups (text popups always show)
  };

  // Actions
  addShards: (amount: number) => void;
  spendShards: (amount: number) => boolean;
  setUpgradeRank: (id: string, rank: number) => void;
  /** Persistently mark an affix as discovered (unlocks bestiary entry). */
  discoverAffix: (affix: string) => void;

  // ─── Labyrinth cross-run actions ──────────────────────────────────
  /** Increment the labyrinth kill counter by `n`. Fires the Nemesis
   *  achievement when it crosses 100. */
  addLabyrinthKills: (n: number) => void;
  /** Mark `cls` as having extracted at least once. Fires the All
   *  Roads Lead Out achievement when all 3 classes are present.
   *  Also increments labyrinthExtractionCount (cross-run counter
   *  for the Extractor achievement). */
  recordLabyrinthExtraction: (cls: string) => void;
  /** Increment the champion-key counter. Fires Skeleton Key at 7. */
  recordLabyrinthKeyObtain: () => void;
  /** Increment the run counter on run end (extract or defeat).
   *  Fires The Long Game at 10. */
  recordLabyrinthRunComplete: () => void;
  /** Increment the Warden-kill counter. Fires Warden's Bane at 3. */
  recordLabyrinthWardenKill: () => void;
  purchaseRank: (id: string, cost: number, maxRanks: number) => boolean;
  hardReset: () => void;

  unlockMilestone: (id: string) => void;
  addTotalKills: (n: number) => void;
  updateBestWave: (wave: number) => void;
  checkUnlocks: () => void;
  completeTrial: (cls: string, difficulty?: string) => void;
  recordDifficultyClear: (tier: DifficultyTier, wave: number) => void;
  addGearToStash: (gear: StashItem) => void;
  sellGear: (index: number) => void;
  equipToLoadout: (stashIndex: number) => void;
  unequipFromLoadout: (slot: string) => void;
  enhanceGear: (stashIndex: number) => boolean;
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
  difficultyClears: { normal: 0, hard: 0, nightmare: 0 } as Record<DifficultyTier, number>,
  gearStash: [] as StashItem[],
  equippedLoadout: { weapon: null, armor: null, trinket: null } as Record<string, StashItem | null>,
  hasSeenTutorial: false,
  discoveredAffixes: {} as Record<string, boolean>,
  labyrinthKillCount: 0,
  labyrinthExtractedClasses: {} as Record<string, boolean>,
  labyrinthChampionKeyCount: 0,
  labyrinthRunCount: 0,
  labyrinthExtractionCount: 0,
  labyrinthWardenKills: 0,
  settings: {
    screenShake: true,
    damageNumbers: true,
  },
};

export const useMetaStore = create<MetaState>()(
  persist(
    (set, get) => ({
      ...DEFAULT_STATE,

      addShards: (amount) => {
        set((s) => ({
          shards: s.shards + amount,
          totalShardsEarned: s.totalShardsEarned + amount,
        }));
        const total = get().totalShardsEarned;
        if (total >= 5000) useAchievementStore.getState().tryUnlock("soul_hoarder");
      },

      spendShards: (amount) => {
        const s = get();
        if (s.shards < amount) return false;
        set({ shards: s.shards - amount });
        return true;
      },

      setUpgradeRank: (id, rank) =>
        set((s) => ({ purchased: { ...s.purchased, [id]: rank } })),

      discoverAffix: (affix) =>
        set((s) =>
          s.discoveredAffixes[affix]
            ? s   // already discovered — no-op (no fresh state, no rerender)
            : { discoveredAffixes: { ...s.discoveredAffixes, [affix]: true } },
        ),

      // ─── Labyrinth cross-run counters ─────────────────────────────
      // Each mutator writes through to the persistence layer AND
      // fires the matching achievement the moment its threshold is
      // crossed. Same pattern as addTotalKills (see below) so Steam
      // SDK integration later can hook at the tryUnlock site only.
      addLabyrinthKills: (n) => {
        const s = get();
        const newTotal = s.labyrinthKillCount + n;
        set({ labyrinthKillCount: newTotal });
        if (newTotal >= 100) useAchievementStore.getState().tryUnlock("lab_nemesis");
      },
      recordLabyrinthExtraction: (cls) => {
        const s = get();
        // Always bump the extraction counter — Extractor fires on
        // total count (5+) regardless of class. Per-class map is
        // the separate All Roads Lead Out tracker.
        const newCount = s.labyrinthExtractionCount + 1;
        const ach = useAchievementStore.getState();
        if (s.labyrinthExtractedClasses[cls]) {
          set({ labyrinthExtractionCount: newCount });
        } else {
          const nextClasses = { ...s.labyrinthExtractedClasses, [cls]: true };
          set({ labyrinthExtractedClasses: nextClasses, labyrinthExtractionCount: newCount });
          // All three classes extracted → All Roads Lead Out.
          if (nextClasses["warrior"] && nextClasses["mage"] && nextClasses["rogue"]) {
            ach.tryUnlock("lab_all_roads");
          }
        }
        if (newCount >= 5) ach.tryUnlock("lab_extractor");
      },
      recordLabyrinthKeyObtain: () => {
        const s = get();
        const newTotal = s.labyrinthChampionKeyCount + 1;
        set({ labyrinthChampionKeyCount: newTotal });
        if (newTotal >= 7) useAchievementStore.getState().tryUnlock("lab_skeleton_key");
      },
      recordLabyrinthRunComplete: () => {
        const s = get();
        const newTotal = s.labyrinthRunCount + 1;
        set({ labyrinthRunCount: newTotal });
        if (newTotal >= 10) useAchievementStore.getState().tryUnlock("lab_long_game");
      },
      recordLabyrinthWardenKill: () => {
        const s = get();
        const newTotal = s.labyrinthWardenKills + 1;
        set({ labyrinthWardenKills: newTotal });
        if (newTotal >= 3) useAchievementStore.getState().tryUnlock("lab_wardens_bane");
      },

      purchaseRank: (id, cost, maxRanks) => {
        const s = get();
        const current = s.purchased[id] ?? 0;
        if (current >= maxRanks) return false;
        if (s.shards < cost) return false;
        set({
          shards: s.shards - cost,
          purchased: { ...s.purchased, [id]: current + 1 },
        });
        // Achievement: forge upgrades
        const ach = useAchievementStore.getState();
        ach.tryUnlock("first_upgrade");
        const totalRanks = Object.values(get().purchased).reduce((sum, r) => sum + r, 0);
        if (totalRanks >= 10) ach.tryUnlock("master_smith");
        return true;
      },

      hardReset: () => {
        set({ ...DEFAULT_STATE });
        useAchievementStore.getState().resetAchievements();
      },

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
        // Achievement: all-time kill milestones
        const ach = useAchievementStore.getState();
        if (newTotal >= 1000)  ach.tryUnlock("kills_1000");
        if (newTotal >= 5000)  ach.tryUnlock("kills_5000");
        if (newTotal >= 10000) ach.tryUnlock("kills_10000");
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
        // Achievement: class/race unlocks
        const ach = useAchievementStore.getState();
        if (classes.includes("mage"))  ach.tryUnlock("arcane_awakening");
        if (classes.includes("rogue")) ach.tryUnlock("blade_in_dark");
        if (races.includes("dwarf"))   ach.tryUnlock("stout_heart");
        if (races.includes("elf"))     ach.tryUnlock("elven_grace");
      },

      recordDifficultyClear: (tier: DifficultyTier, wave: number) => {
        const s = get();
        const current = s.difficultyClears?.[tier] ?? 0;
        if (wave <= current) return;
        set({
          difficultyClears: { ...s.difficultyClears, [tier]: wave },
        });
        // Achievement: difficulty clears (wave 20 = final boss)
        if (wave >= 20) {
          const ach = useAchievementStore.getState();
          if (tier === "normal")    ach.tryUnlock("normal_clear");
          if (tier === "hard")      ach.tryUnlock("hard_clear");
          if (tier === "nightmare") ach.tryUnlock("nightmare_clear");
        }
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
          // Still unlock the achievement for this specific combination
          useAchievementStore.getState().tryUnlock(`trial_${cls}_${difficulty}`);
          return;
        }
        set((s2) => ({
          trialWins: { ...s2.trialWins, [cls]: difficulty },
          milestones: { ...s2.milestones, [`trial_${cls}`]: true },
        }));
        // Achievement: trial completions
        const ach = useAchievementStore.getState();
        ach.tryUnlock(`trial_${cls}_${difficulty}`);
        // Champion of All: check if all 9 trials are done
        const wins = get().trialWins;
        const allClasses = ["warrior", "mage", "rogue"];
        const allDiffs = ["normal", "hard", "nightmare"];
        const allDone = allClasses.every((c) => {
          const cleared = wins[c];
          if (!cleared) return false;
          return (DIFF_RANK[cleared] ?? 0) >= (DIFF_RANK["nightmare"] ?? 0);
        });
        if (allDone) ach.tryUnlock("champion_of_all");
      },

      addGearToStash: (gear) => {
        set((s) => ({ gearStash: [...s.gearStash, gear] }));
        if (gear.rarity === "epic") useAchievementStore.getState().tryUnlock("legendary_discovery");
      },

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

      equipToLoadout: (stashIndex: number) => {
        const s = get();
        const item = s.gearStash[stashIndex];
        if (!item) return;
        const slot = item.slot;
        const currentlyEquipped = s.equippedLoadout[slot];
        const newStash = [...s.gearStash];
        newStash.splice(stashIndex, 1);
        // If slot was occupied, return old item to stash
        if (currentlyEquipped) newStash.push(currentlyEquipped);
        set({
          gearStash: newStash,
          equippedLoadout: { ...s.equippedLoadout, [slot]: item },
        });
      },

      unequipFromLoadout: (slot: string) => {
        const s = get();
        const item = s.equippedLoadout[slot];
        if (!item) return;
        set({
          gearStash: [...s.gearStash, item],
          equippedLoadout: { ...s.equippedLoadout, [slot]: null },
        });
      },

      enhanceGear: (stashIndex: number) => {
        const s = get();
        const item = s.gearStash[stashIndex];
        if (!item) return false;
        const currentLevel = item.enhanceLevel ?? 0;
        // Max enhancement by rarity: common +3, rare +5, epic +7
        const maxLevel = item.rarity === "epic" ? 7 : item.rarity === "rare" ? 5 : 3;
        if (currentLevel >= maxLevel) return false;
        const costs = [0, 30, 60, 100, 150, 220, 300, 400];
        const cost = costs[currentLevel + 1] ?? 400;
        if (s.shards < cost) return false;
        const newStash = [...s.gearStash];
        const newLevel = currentLevel + 1;
        newStash[stashIndex] = { ...item, enhanceLevel: newLevel };
        set({ gearStash: newStash, shards: s.shards - cost });
        // Achievement: max enhancement + golden arsenal
        if (newLevel >= maxLevel) {
          const ach = useAchievementStore.getState();
          ach.tryUnlock("perfection");
          if (item.rarity === "epic" && newLevel >= 7) ach.tryUnlock("golden_arsenal");
        }
        return true;
      },

      markTutorialSeen: () => set({ hasSeenTutorial: true }),

      setSettings: (patch) =>
        set((s) => ({ settings: { ...s.settings, ...patch } })),
    }),
    {
      name: "dungeon-requiem-meta",
      version: 7, // bumped: added difficultyClears for difficulty gating
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
        if (version < 6) {
          // Add equippedLoadout and ensure stash items have enhanceLevel
          state = {
            ...state,
            equippedLoadout: { weapon: null, armor: null, trinket: null },
          };
        }
        if (version < 7) {
          // Add difficultyClears for difficulty gating. Existing players who
          // have already cleared waves on Normal get the unlock seeded from
          // bestWaveEver so they aren't forced to re-prove themselves.
          const bestWave = state?.bestWaveEver ?? 0;
          state = {
            ...state,
            difficultyClears: { normal: bestWave, hard: 0, nightmare: 0 },
          };
        }
        return state as MetaState;
      },
    },
  ),
);
