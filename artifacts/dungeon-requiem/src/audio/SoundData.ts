/**
 * SoundData.ts — Sound registry for Dungeon Requiem.
 *
 * HOW TO SWAP IN YOUR OWN AUDIO
 * ─────────────────────────────
 * 1. Drop your .mp3/.ogg/.wav file into /public/audio/sfx/ or /public/audio/music/.
 * 2. Set the `src` field for the matching key below to "/audio/sfx/yourfile.mp3"
 *    (or /audio/music/yourfile.mp3 for music loops).
 * 3. Add an attribution entry to /public/audio/CREDITS.md if the license
 *    requires it (CC-BY, etc.).
 * 4. That's it — AudioManager.preload() fetches + decodes all file-backed
 *    sounds at app boot and swaps them in automatically. Any key with an
 *    empty `src` uses the procedural synth fallback so the game is always
 *    playable, even with no audio assets shipped.
 *
 * CATEGORIES
 *   sfx   — one-shot effects, respects sfxVolume
 *   music — looping background, respects musicVolume
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
  | "wave_clear"
  | "boss_spawn"
  | "boss_special"
  | "boss_death"
  | "menu_click"
  | "music_menu"
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
  wave_clear:     { category: "sfx",   src: "", volume: 0.6 },
  boss_spawn:     { category: "sfx",   src: "", volume: 1.0 },
  boss_special:   { category: "sfx",   src: "", volume: 0.9 },
  boss_death:     { category: "sfx",   src: "", volume: 1.0 },
  menu_click:     { category: "sfx",   src: "", volume: 0.4 },
  music_menu:     { category: "music", src: "", volume: 1.0, loop: true },
  music_dungeon:  { category: "music", src: "", volume: 1.0, loop: true },
};
