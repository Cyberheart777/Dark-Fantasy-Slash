/**
 * SaveData.ts
 * Save/load abstraction layer.
 * Currently uses localStorage for browser.
 * STEAM NOTE: Swap `StorageBackend` implementation for Node.js fs-based save
 * when wrapping with Electron/Tauri. The rest of the save system is unchanged.
 */

export interface RunRecord {
  score: number;
  killCount: number;
  level: number;
  survivalTime: number; // seconds
  wave: number;
  date: string;
}

export interface GameSaveData {
  bestScore: number;
  bestSurvivalTime: number;
  totalRuns: number;
  totalKills: number;
  recentRuns: RunRecord[];   // last 10 runs
  settings: GameSettings;
}

export interface GameSettings {
  masterVolume: number;  // 0-1
  musicVolume: number;   // 0-1
  sfxVolume: number;     // 0-1
  muted: boolean;
  screenShake: boolean;
  showDamageNumbers: boolean;
  fullscreen: boolean;
  // Keybindings stored as action->key map — future-extensible
  keybindings: Record<string, string>;
}

const DEFAULT_SETTINGS: GameSettings = {
  masterVolume: 0.8,
  musicVolume: 0.4,
  sfxVolume: 0.7,
  muted: false,
  screenShake: true,
  showDamageNumbers: true,
  fullscreen: false,
  keybindings: {
    moveUp: "W",
    moveDown: "S",
    moveLeft: "A",
    moveRight: "D",
    attack: "SPACE",
    dash: "SHIFT",
    pause: "ESCAPE",
  },
};

const SAVE_KEY = "dungeon_requiem_save";

/**
 * StorageBackend — interface to swap out for desktop builds.
 * STEAM NOTE: Replace with Electron's `fs` calls or Tauri's `tauri-plugin-store`.
 */
interface StorageBackend {
  load(): GameSaveData | null;
  save(data: GameSaveData): void;
  clear(): void;
}

const localStorageBackend: StorageBackend = {
  load(): GameSaveData | null {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return null;
      return JSON.parse(raw) as GameSaveData;
    } catch {
      return null;
    }
  },
  save(data: GameSaveData): void {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    } catch {
      // Storage full or denied — silently fail in browser
    }
  },
  clear(): void {
    localStorage.removeItem(SAVE_KEY);
  },
};

// Active backend — swap this export to change storage target
let activeBackend: StorageBackend = localStorageBackend;

// Inject a different backend (e.g., in Electron main process bridge)
export function setStorageBackend(backend: StorageBackend): void {
  activeBackend = backend;
}

function getDefaultSave(): GameSaveData {
  return {
    bestScore: 0,
    bestSurvivalTime: 0,
    totalRuns: 0,
    totalKills: 0,
    recentRuns: [],
    settings: { ...DEFAULT_SETTINGS },
  };
}

export const SaveManager = {
  load(): GameSaveData {
    return activeBackend.load() ?? getDefaultSave();
  },

  save(data: GameSaveData): void {
    activeBackend.save(data);
  },

  getSettings(): GameSettings {
    return SaveManager.load().settings;
  },

  saveSettings(settings: Partial<GameSettings>): void {
    const existing = SaveManager.load();
    existing.settings = { ...existing.settings, ...settings };
    SaveManager.save(existing);
  },

  recordRun(run: RunRecord): void {
    const data = SaveManager.load();
    if (run.score > data.bestScore) data.bestScore = run.score;
    if (run.survivalTime > data.bestSurvivalTime) data.bestSurvivalTime = run.survivalTime;
    data.totalRuns += 1;
    data.totalKills += run.killCount;
    data.recentRuns = [run, ...data.recentRuns].slice(0, 10);
    SaveManager.save(data);
  },

  clear(): void {
    activeBackend.clear();
  },
};
