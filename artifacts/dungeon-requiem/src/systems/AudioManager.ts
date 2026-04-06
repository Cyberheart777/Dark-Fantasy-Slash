/**
 * AudioManager.ts
 * Centralized audio management.
 * STEAM NOTE: In a desktop build, swap the Phaser sound backend with
 * a Web Audio API wrapper or a native audio lib like Howler, keeping
 * the same play/stop/setVolume public API.
 */

import Phaser from "phaser";

export type SfxKey =
  | "player_attack"
  | "player_hit"
  | "player_death"
  | "player_dash"
  | "enemy_hit"
  | "enemy_death"
  | "xp_pickup"
  | "level_up"
  | "upgrade_select"
  | "ui_click"
  | "boss_spawn";

export type MusicKey =
  | "music_menu"
  | "music_combat"
  | "music_boss";

export interface AudioSettings {
  masterVolume: number;
  musicVolume: number;
  sfxVolume: number;
  muted: boolean;
}

export class AudioManager {
  private scene: Phaser.Scene;
  private settings: AudioSettings;
  private currentMusic: Phaser.Sound.BaseSound | null = null;
  private currentMusicKey: MusicKey | null = null;

  constructor(scene: Phaser.Scene, settings: AudioSettings) {
    this.scene = scene;
    this.settings = { ...settings };
  }

  playSfx(key: SfxKey, volumeOverride?: number): void {
    if (this.settings.muted) return;
    // STEAM NOTE: Replace this check with actual asset loading in production.
    // Placeholder: assets not yet loaded — skip gracefully.
    if (!this.scene.cache.audio.exists(key)) return;
    const vol = (volumeOverride ?? 1) * this.settings.sfxVolume * this.settings.masterVolume;
    this.scene.sound.play(key, { volume: vol });
  }

  playMusic(key: MusicKey): void {
    if (this.currentMusicKey === key) return;
    this.stopMusic();
    if (this.settings.muted) return;
    if (!this.scene.cache.audio.exists(key)) return;
    const vol = this.settings.musicVolume * this.settings.masterVolume;
    this.currentMusic = this.scene.sound.add(key, { loop: true, volume: vol });
    this.currentMusic.play();
    this.currentMusicKey = key;
  }

  stopMusic(): void {
    if (this.currentMusic) {
      this.currentMusic.stop();
      this.currentMusic.destroy();
      this.currentMusic = null;
      this.currentMusicKey = null;
    }
  }

  setMasterVolume(v: number): void {
    this.settings.masterVolume = Phaser.Math.Clamp(v, 0, 1);
    this.applyMusicVolume();
  }

  setMusicVolume(v: number): void {
    this.settings.musicVolume = Phaser.Math.Clamp(v, 0, 1);
    this.applyMusicVolume();
  }

  setSfxVolume(v: number): void {
    this.settings.sfxVolume = Phaser.Math.Clamp(v, 0, 1);
  }

  setMuted(muted: boolean): void {
    this.settings.muted = muted;
    if (muted) this.stopMusic();
    this.scene.sound.setMute(muted);
  }

  private applyMusicVolume(): void {
    if (this.currentMusic && "setVolume" in this.currentMusic) {
      (this.currentMusic as Phaser.Sound.WebAudioSound).setVolume(
        this.settings.musicVolume * this.settings.masterVolume
      );
    }
  }

  getSettings(): AudioSettings {
    return { ...this.settings };
  }
}
