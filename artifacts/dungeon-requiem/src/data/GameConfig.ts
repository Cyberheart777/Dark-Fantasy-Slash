/**
 * GameConfig.ts
 * Central game constants — 3D units (1 unit ≈ 1 metre).
 * Arena is 60×60 units, player is ~2 units tall.
 */

export const GAME_CONFIG = {
  ARENA_HALF: 30,          // half-width/depth of the dungeon floor
  WALL_THICKNESS: 2,
  WALL_HEIGHT: 6,

  PLAYER: {
    START_HEALTH: 120,
    START_DAMAGE: 18,
    START_ATTACK_SPEED: 1.0,    // attacks per second
    START_MOVE_SPEED: 8,        // units/second
    START_CRIT_CHANCE: 0.05,
    START_ARMOR: 5,
    START_LIFESTEAL: 0,
    START_CLEAVE_CHANCE: 0,
    START_DODGE_CHANCE: 0,
    ATTACK_RANGE: 5,            // units
    ATTACK_ARC: 120,            // degrees
    INVINCIBILITY_TIME: 0.6,    // seconds after being hit
    DASH_SPEED: 22,             // units/second during dash
    DASH_DURATION: 0.18,        // seconds
    DASH_COOLDOWN: 2.2,         // seconds
    HEALTH_REGEN_RATE: 0,       // HP per second (upgradeable)
    PICKUP_RADIUS: 3,           // XP orb auto-collect range
  },

  XP: {
    // Tuned for a ~wave 40 max-level target at +50% XP multiplier gear.
    // Earlier numbers (BASE 60, EXPONENT 1.4, MAX 50) produced level 50 by
    // wave ~12 with stacked XP boosts. See ProgressionManager.calcXpThreshold
    // for the per-10-level 1.15x slowdown multiplier applied on top.
    BASE: 70,
    EXPONENT: 1.45,
    MAX_LEVEL: 60,
  },

  DIFFICULTY: {
    WAVE_DURATION: 30,          // seconds between intensity bumps
    BASE_SPAWN_INTERVAL: 0.85,  // seconds between spawns at start
    MIN_SPAWN_INTERVAL: 0.10,
    SPAWN_REDUCTION: 0.09,      // seconds removed per wave
    ELITE_SPAWN_START_WAVE: 4,
    BOSS_WAVE_INTERVAL: 5,      // boss spawns every N waves (wave 5, 10, 15…)
    BOSS_HP_SCALE_PER_WAVE: 0.2,// boss HP multiplier per appearance
    BOSS_SPECIAL_INTERVAL: 5.0, // seconds between boss AoE attacks
    BOSS_SPECIAL_WARN_TIME: 1.4,// warning duration before AoE damage lands
    BOSS_SPECIAL_RADIUS: 9,     // AoE radius in world units
    HP_SCALE_PER_WAVE: 0.15,
    DAMAGE_SCALE_PER_WAVE: 0.11,
  },

  AUDIO: {
    MASTER_VOLUME: 0.6,
    MUSIC_VOLUME: 0.3,
    SFX_VOLUME: 0.7,
    MUTED: false,
  },
} as const;

export type GameConfigType = typeof GAME_CONFIG;
