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
import type { LabyrinthDifficulty } from "../game/labyrinth/LabyrinthConfig";

import type { GearDef } from "../data/GearData";

/** Active buff/debuff shown on the HUD. */
export interface ActiveBuff {
  id: string;
  icon: string;
  label: string;
  /** Timer remaining (seconds) or stack count. */
  value: number;
  /** Maximum duration or max stacks — used for the fill bar. */
  max: number;
  /** True = show value as integer stacks; false = show as countdown timer. */
  isStacks: boolean;
  /** Tint color for the buff chip background / bar. */
  color: string;
  /** True = harmful effect (shown in red-ish style). */
  isDebuff?: boolean;
}

export type GamePhase =
  | "menu"
  | "charselect"
  | "soulforge"
  | "playing"
  | "paused"
  | "levelup"
  | "gameover"
  | "trialvictory"
  | "labyrinth_charselect"
  | "labyrinth";

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
  actionCooldownTimer: number;
  actionCooldownMax: number;
  actionReady: boolean;

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
  labyrinthDifficulty: LabyrinthDifficulty;
  trialDeathKnight: boolean;

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

  // Active buffs/debuffs (synced each frame from the game loop)
  activeBuffs: ActiveBuff[];

  /** Currently-inspected affixed enemy. Set by Enemy3D.onClick when
   *  the player taps an affixed enemy; cleared when the player taps
   *  outside the tooltip OR when the inspected enemy dies. Drives
   *  the AffixTooltip overlay (HUD-level DOM popup). */
  inspectedAffix: { enemyType: string; affixes: string[] } | null;

  /** Set of affix ids encountered in the CURRENT SESSION (resets on
   *  reload). Used to gate the first-encounter banner — each affix
   *  shows the banner once per session, never repeats. */
  encounteredAffixesSession: Set<string>;
  /** Affix to show in the first-encounter banner overlay. Set by
   *  markAffixEncountered() the moment a new-this-session affix is
   *  spotted; AffixBanner clears it after the 3.5s fade. */
  pendingAffixBanner: string | null;

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
  setInspectedAffix: (info: { enemyType: string; affixes: string[] } | null) => void;
  /** Records an affix encounter for the session. If this is the
   *  FIRST sighting of this affix this session, also sets
   *  pendingAffixBanner so the AffixBanner overlay shows. Returns
   *  true on first sight (banner triggered), false on repeat. */
  markAffixEncountered: (affix: string) => boolean;
  /** Clears the pending banner — called by AffixBanner after its
   *  3.5s fade-out completes. */
  clearAffixBanner: () => void;
  setSelectedClass: (cls: CharacterClass) => void;
  setSelectedRace: (race: RaceType) => void;
  setDifficultyTier: (tier: DifficultyTier) => void;
  setTrialMode: (trial: boolean) => void;
  setLabyrinthDifficulty: (d: LabyrinthDifficulty) => void;
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
  setActionState: (cooldownTimer: number, cooldownMax: number) => void;
  setVolume: (master: number, sfx: number, music: number, muted: boolean) => void;
  setBestScore: (score: number, wave: number) => void;
  setNemesisState: (alive: boolean, announce: string) => void;
  setHighestBossWaveCleared: (wave: number) => void;
  setRunExtracted: (extracted: boolean) => void;
  setExtractedBonusShards: (n: number) => void;
  setGearEquipped: (slot: string, gear: GearDef | null) => void;
  setInventory: (items: GearDef[]) => void;
  setActiveBuffs: (buffs: ActiveBuff[]) => void;
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
  actionCooldownTimer: 0,
  actionCooldownMax: 60,
  actionReady: true,
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
  labyrinthDifficulty: "normal" as LabyrinthDifficulty,
  trialDeathKnight: false,
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
  activeBuffs: [] as ActiveBuff[],
  inspectedAffix: null as { enemyType: string; affixes: string[] } | null,
  encounteredAffixesSession: new Set<string>(),
  pendingAffixBanner: null as string | null,
  equippedWeapon: null as GearDef | null,
  equippedArmor: null as GearDef | null,
  equippedTrinket: null as GearDef | null,
  inventory: [] as GearDef[],
};

export const useGameStore = create<GameUIState>((set, get) => ({
  ...initialState,

  setPhase: (phase) => set({ phase }),
  setSelectedClass: (selectedClass) => set({ selectedClass }),
  setSelectedRace: (selectedRace) => set({ selectedRace }),
  setDifficultyTier: (difficultyTier) => set({ difficultyTier }),
  setTrialMode: (trialMode) => set({ trialMode }),
  setLabyrinthDifficulty: (labyrinthDifficulty: LabyrinthDifficulty) => set({ labyrinthDifficulty }),
  addRunShards: (n) => set((s) => ({ shardsThisRun: s.shardsThisRun + n })),
  addGuaranteedShards: (n) => set((s) => ({
    shardsThisRun: s.shardsThisRun + n,
    guaranteedShards: s.guaranteedShards + n,
  })),
  setBossState: (hp, maxHp, name, alive) => set({ bossHP: hp, bossMaxHP: maxHp, bossName: name, bossAlive: alive }),
  setBossSpecialWarn: (active) => set({ bossSpecialWarn: active }),
  setInspectedAffix: (info) => set({ inspectedAffix: info }),
  markAffixEncountered: (affix) => {
    const seen = get().encounteredAffixesSession;
    if (seen.has(affix)) return false;
    // Mutate the same Set instance + bump via a fresh wrapper so
    // selectors that compare reference identity see the change.
    const next = new Set(seen);
    next.add(affix);
    set({ encounteredAffixesSession: next, pendingAffixBanner: affix });
    return true;
  },
  clearAffixBanner: () => set({ pendingAffixBanner: null }),
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

  setActionState: (cooldownTimer, cooldownMax) =>
    set({ actionCooldownTimer: cooldownTimer, actionCooldownMax: cooldownMax, actionReady: cooldownTimer <= 0 }),

  setVolume: (masterVolume, sfxVolume, musicVolume, muted) =>
    set({ masterVolume, sfxVolume, musicVolume, muted }),

  setBestScore: (bestScore, bestWave) => set({ bestScore, bestWave }),

  setGearEquipped: (slot, gear) => set(
    slot === "weapon" ? { equippedWeapon: gear } :
    slot === "armor"  ? { equippedArmor: gear } :
                        { equippedTrinket: gear }
  ),

  setInventory: (inventory) => set({ inventory }),

  setActiveBuffs: (activeBuffs) => set({ activeBuffs }),

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
