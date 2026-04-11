/**
 * gameStore.ts
 * Zustand store for game state that drives React UI.
 * Per-frame values (positions, velocities) live in refs inside GameManager.
 */

import { create } from "zustand";
import type { UpgradeDef } from "../data/UpgradeData";
import type { CharacterClass } from "../data/CharacterData";
import type { RaceType } from "../data/RaceData";
import type { DifficultyTier } from "../data/DifficultyData";

import type { GearDef } from "../data/GearData";

export type GamePhase =
  | "menu"
  | "charselect"
  | "soulforge"
  | "playing"
  | "paused"
  | "levelup"
  | "gameover"
  | "trialvictory";

export interface EnemyUIState {
  id: string;
  x: number;
  z: number;
  healthPct: number;
  type: string;
  dead: boolean;
}

export interface XPOrbState {
  id: string;
  x: number;
  z: number;
  value: number;
  collected: boolean;
}

export interface DamagePopup {
  id: string;
  x: number;
  z: number;
  value: number;
  isCrit: boolean;
  isPlayer: boolean;
  spawnTime: number;
  /** If set, render this text instead of the numeric value (e.g. "Item Dropped!"). */
  text?: string;
  /** If set, overrides the default color (hex or CSS color). */
  color?: string;
  /** Lifetime in seconds. Defaults to 0.8s for damage numbers. */
  durationSec?: number;
}

export interface GameUIState {
  phase: GamePhase;

  // Player
  playerHP: number;
  playerMaxHP: number;
  playerX: number;
  playerZ: number;
  playerAngle: number;

  // Progression
  level: number;
  xp: number;
  xpToNext: number;
  wave: number;
  score: number;
  kills: number;
  survivalTime: number;

  // Level-up
  levelUpChoices: UpgradeDef[];
  acquiredUpgrades: Record<string, number>;

  // Enemies
  enemies: EnemyUIState[];
  xpOrbs: XPOrbState[];
  damagePopups: DamagePopup[];

  // Combat feedback
  attackFlash: boolean;
  attackTrigger: number;
  isDashing: boolean;

  // Settings
  masterVolume: number;
  sfxVolume: number;
  musicVolume: number;
  muted: boolean;

  // Best score
  bestScore: number;
  bestWave: number;

  // Character class & race
  selectedClass: CharacterClass;
  selectedRace: RaceType;

  // Difficulty & mode
  difficultyTier: DifficultyTier;
  trialMode: boolean;

  // Soul shards (per-run counter — persistent total lives in metaStore)
  shardsThisRun: number;
  /**
   * Guaranteed shards earned per wave completion. These always persist on
   * death (unlike shardsThisRun which is forfeit). Tracked separately so the
   * death handler can transfer them to meta while leaving the rest forfeit.
   */
  guaranteedShards: number;

  // Boss state
  bossHP: number;
  bossMaxHP: number;
  bossName: string;
  bossAlive: boolean;
  bossSpecialWarn: boolean;

  // Nemesis state
  nemesisAlive: boolean;
  nemesisAnnounce: string; // "" = no announcement, non-empty = show banner text

  // Extraction system
  highestBossWaveCleared: number;
  runExtracted: boolean;
  extractedBonusShards: number;

  // Gear
  equippedWeapon: GearDef | null;
  equippedArmor: GearDef | null;
  equippedTrinket: GearDef | null;
  /** In-run spare gear — duplicates that didn't auto-equip. UI mirror of
   *  GameState.inventory maintained by GameScene on pickup / equip / sell. */
  inventory: GearDef[];

  // Actions
  setPhase: (phase: GamePhase) => void;
  addRunShards: (n: number) => void;
  addGuaranteedShards: (n: number) => void;
  setBossState: (hp: number, maxHp: number, name: string, alive: boolean) => void;
  setBossSpecialWarn: (active: boolean) => void;
  setSelectedClass: (cls: CharacterClass) => void;
  setSelectedRace: (race: RaceType) => void;
  setDifficultyTier: (tier: DifficultyTier) => void;
  setTrialMode: (trial: boolean) => void;
  setPlayerHP: (hp: number, maxHp: number) => void;
  setPlayerPos: (x: number, z: number, angle: number) => void;
  setProgression: (level: number, xp: number, xpToNext: number) => void;
  setWaveInfo: (wave: number, score: number, kills: number, time: number) => void;
  setLevelUpChoices: (choices: UpgradeDef[]) => void;
  applyUpgrade: (id: string) => void;
  setEnemies: (enemies: EnemyUIState[]) => void;
  setXPOrbs: (orbs: XPOrbState[]) => void;
  addDamagePopup: (popup: DamagePopup) => void;
  removeDamagePopup: (id: string) => void;
  setAttackState: (attackTrigger: number, isDashing: boolean) => void;
  setVolume: (master: number, sfx: number, music: number, muted: boolean) => void;
  setBestScore: (score: number, wave: number) => void;
  setNemesisState: (alive: boolean, announce: string) => void;
  setHighestBossWaveCleared: (wave: number) => void;
  setRunExtracted: (extracted: boolean) => void;
  setExtractedBonusShards: (n: number) => void;
  setGearEquipped: (slot: string, gear: GearDef | null) => void;
  setInventory: (items: GearDef[]) => void;
  resetGame: () => void;
}

const initialState = {
  phase: "menu" as GamePhase,
  playerHP: 120,
  playerMaxHP: 120,
  playerX: 0,
  playerZ: 0,
  playerAngle: 0,
  level: 1,
  xp: 0,
  xpToNext: 60,
  wave: 0,
  score: 0,
  kills: 0,
  survivalTime: 0,
  levelUpChoices: [] as UpgradeDef[],
  acquiredUpgrades: {} as Record<string, number>,
  enemies: [] as EnemyUIState[],
  xpOrbs: [] as XPOrbState[],
  damagePopups: [] as DamagePopup[],
  attackFlash: false,
  attackTrigger: 0,
  isDashing: false,
  masterVolume: 0.6,
  sfxVolume: 0.7,
  musicVolume: 0.3,
  muted: false,
  bestScore: 0,
  bestWave: 0,
  selectedClass: "warrior" as CharacterClass,
  selectedRace: "human" as RaceType,
  difficultyTier: "normal" as DifficultyTier,
  trialMode: false,
  shardsThisRun: 0,
  guaranteedShards: 0,
  bossHP: 0,
  bossMaxHP: 0,
  bossName: "",
  bossAlive: false,
  bossSpecialWarn: false,
  nemesisAlive: false,
  nemesisAnnounce: "",
  highestBossWaveCleared: 0,
  runExtracted: false,
  extractedBonusShards: 0,
  equippedWeapon: null as GearDef | null,
  equippedArmor: null as GearDef | null,
  equippedTrinket: null as GearDef | null,
  inventory: [] as GearDef[],
};

export const useGameStore = create<GameUIState>((set) => ({
  ...initialState,

  setPhase: (phase) => set({ phase }),
  setSelectedClass: (selectedClass) => set({ selectedClass }),
  setSelectedRace: (selectedRace) => set({ selectedRace }),
  setDifficultyTier: (difficultyTier) => set({ difficultyTier }),
  setTrialMode: (trialMode) => set({ trialMode }),
  addRunShards: (n) => set((s) => ({ shardsThisRun: s.shardsThisRun + n })),
  addGuaranteedShards: (n) => set((s) => ({
    shardsThisRun: s.shardsThisRun + n,
    guaranteedShards: s.guaranteedShards + n,
  })),
  setBossState: (hp, maxHp, name, alive) => set({ bossHP: hp, bossMaxHP: maxHp, bossName: name, bossAlive: alive }),
  setBossSpecialWarn: (active) => set({ bossSpecialWarn: active }),
  setNemesisState: (alive, announce) => set({ nemesisAlive: alive, nemesisAnnounce: announce }),
  setHighestBossWaveCleared: (wave) => set({ highestBossWaveCleared: wave }),
  setRunExtracted: (extracted) => set({ runExtracted: extracted }),
  setExtractedBonusShards: (n) => set({ extractedBonusShards: n }),

  setPlayerHP: (playerHP, playerMaxHP) => set({ playerHP, playerMaxHP }),

  setPlayerPos: (playerX, playerZ, playerAngle) =>
    set({ playerX, playerZ, playerAngle }),

  setProgression: (level, xp, xpToNext) => set({ level, xp, xpToNext }),

  setWaveInfo: (wave, score, kills, survivalTime) =>
    set({ wave, score, kills, survivalTime }),

  setLevelUpChoices: (levelUpChoices) => set({ phase: "levelup", levelUpChoices }),

  applyUpgrade: (id) =>
    set((s) => ({
      acquiredUpgrades: {
        ...s.acquiredUpgrades,
        [id]: (s.acquiredUpgrades[id] ?? 0) + 1,
      },
    })),

  setEnemies: (enemies) => set({ enemies }),

  setXPOrbs: (xpOrbs) => set({ xpOrbs }),

  addDamagePopup: (popup) =>
    set((s) => ({ damagePopups: [...s.damagePopups.slice(-30), popup] })),

  removeDamagePopup: (id) =>
    set((s) => ({ damagePopups: s.damagePopups.filter((p) => p.id !== id) })),

  setAttackState: (attackTrigger, isDashing) =>
    set({ attackTrigger, isDashing }),

  setVolume: (masterVolume, sfxVolume, musicVolume, muted) =>
    set({ masterVolume, sfxVolume, musicVolume, muted }),

  setBestScore: (bestScore, bestWave) => set({ bestScore, bestWave }),

  setGearEquipped: (slot, gear) => set(
    slot === "weapon" ? { equippedWeapon: gear } :
    slot === "armor"  ? { equippedArmor: gear } :
                        { equippedTrinket: gear }
  ),

  setInventory: (inventory) => set({ inventory }),

  resetGame: () =>
    set((s) => ({
      ...initialState,
      phase: "playing",
      bestScore: 0,
      bestWave: 0,
      selectedClass: s.selectedClass,
      selectedRace: s.selectedRace,
    })),
}));
