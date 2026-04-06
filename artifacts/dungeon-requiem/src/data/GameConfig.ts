/**
 * GameConfig.ts
 * Central game constants and configuration.
 * STEAM NOTE: These values drive balance tuning and can be replaced by
 * an external JSON config loaded from disk when running as a desktop build.
 */

export const GAME_CONFIG = {
  // Canvas / resolution
  WIDTH: 1280,
  HEIGHT: 720,
  // Target FPS (physics and game loop target)
  TARGET_FPS: 60,

  // Player defaults
  PLAYER: {
    START_HEALTH: 120,
    START_DAMAGE: 18,
    START_ATTACK_SPEED: 1.0,   // attacks per second
    START_MOVE_SPEED: 220,
    START_CRIT_CHANCE: 0.05,   // 5%
    START_ARMOR: 5,
    START_LIFESTEAL: 0,
    START_CLEAVE_CHANCE: 0,
    START_DODGE_CHANCE: 0,
    ATTACK_RANGE: 100,
    ATTACK_ARC: 120,           // degrees
    INVINCIBILITY_FRAMES: 800, // ms after being hit
    DASH_SPEED: 600,
    DASH_DURATION: 180,        // ms
    DASH_COOLDOWN: 2200,       // ms
    HEALTH_REGEN_RATE: 0,      // HP per second (upgradeable)
  },

  // XP curve: XP needed = BASE * level^EXPONENT
  XP: {
    BASE: 60,
    EXPONENT: 1.4,
    MAX_LEVEL: 40,
  },

  // Spawn / difficulty
  DIFFICULTY: {
    WAVE_DURATION: 20000,      // ms between intensity bumps
    BASE_SPAWN_INTERVAL: 2200, // ms between spawns at start
    MIN_SPAWN_INTERVAL: 280,   // floor
    SPAWN_REDUCTION: 120,      // ms removed per wave
    ELITE_SPAWN_START_WAVE: 4,
    BOSS_SPAWN_START_WAVE: 8,
    HP_SCALE_PER_WAVE: 0.12,   // 12% per wave
    DAMAGE_SCALE_PER_WAVE: 0.08,
  },

  // Combat feedback
  FEEDBACK: {
    SCREEN_SHAKE_DURATION: 80,
    SCREEN_SHAKE_INTENSITY: 5,
    HIT_FLASH_DURATION: 80,
    DAMAGE_POPUP_DURATION: 800,
    XP_POPUP_DURATION: 600,
    DEATH_EFFECT_DURATION: 400,
  },

  // Audio volumes (0-1). Architecture supports full audio manager.
  AUDIO: {
    MASTER_VOLUME: 0.8,
    MUSIC_VOLUME: 0.4,
    SFX_VOLUME: 0.7,
    MUTED: false,
  },

  // Scene keys
  SCENES: {
    BOOT: "BootScene",
    PRELOAD: "PreloadScene",
    MAIN_MENU: "MainMenuScene",
    GAME: "GameScene",
    UI: "UIScene",
    GAME_OVER: "GameOverScene",
    PAUSE: "PauseScene",
    SETTINGS: "SettingsScene",
    LEVEL_UP: "LevelUpScene",
  },
} as const;

export type GameConfigType = typeof GAME_CONFIG;
