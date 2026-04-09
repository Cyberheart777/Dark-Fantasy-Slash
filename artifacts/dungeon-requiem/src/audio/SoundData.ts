/**
 * SoundData.ts — Sound registry for Dungeon Requiem.
 *
 * HOW TO SWAP IN YOUR OWN AUDIO
 * ─────────────────────────────
 * 1. Drop your .mp3/.ogg/.wav file into the /public/audio/ folder.
 * 2. Set the `src` field for the matching key to "/audio/your-file.mp3".
 * 3. That's it — the AudioManager will load the file and use it instead of
 *    the procedural synth fallback.
 *
 * CATEGORIES
 *   sfx   — one-shot effects, respects sfxVolume
 *   music — looping background, respects musicVolume
 *
 * If `src` is empty string or undefined, procedural synthesis is used as fallback.
 */

export type SoundKey =
  | "attack_melee"
  | "attack_orb"
  | "attack_dagger"
  | "enemy_death"
  | "player_hurt"
  | "player_death"
  | "level_up"
  | "xp_pickup"
  | "dash"
  | "gear_drop"
  | "boss_spawn"
  | "boss_special"
  | "boss_death"
  | "menu_click"
  | "music_dungeon";

export type SoundCategory = "sfx" | "music";

export interface SoundDef {
  src?: string;            // URL to audio file — leave empty to use synth
  category: SoundCategory;
  volume?: number;         // per-sound volume multiplier (0–1), default 1.0
  loop?: boolean;          // only relevant for music
}

export const SOUND_REGISTRY: Record<SoundKey, SoundDef> = {
  attack_melee:   { category: "sfx",   src: "", volume: 0.7 },
  attack_orb:     { category: "sfx",   src: "", volume: 0.5 },
  attack_dagger:  { category: "sfx",   src: "", volume: 0.55 },
  enemy_death:    { category: "sfx",   src: "", volume: 0.6 },
  player_hurt:    { category: "sfx",   src: "", volume: 0.8 },
  player_death:   { category: "sfx",   src: "", volume: 1.0 },
  level_up:       { category: "sfx",   src: "", volume: 0.9 },
  xp_pickup:      { category: "sfx",   src: "", volume: 0.3 },
  dash:           { category: "sfx",   src: "", volume: 0.5 },
  gear_drop:      { category: "sfx",   src: "", volume: 0.85 },
  boss_spawn:     { category: "sfx",   src: "", volume: 1.0 },
  boss_special:   { category: "sfx",   src: "", volume: 0.9 },
  boss_death:     { category: "sfx",   src: "", volume: 1.0 },
  menu_click:     { category: "sfx",   src: "", volume: 0.4 },
  music_dungeon:  { category: "music", src: "", volume: 1.0, loop: true },
};
