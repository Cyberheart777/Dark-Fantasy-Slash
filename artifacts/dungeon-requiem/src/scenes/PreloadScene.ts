/**
 * PreloadScene.ts
 * Asset loading with a progress bar.
 * STEAM NOTE: Replace placeholder graphics with real asset files.
 * Organized by: textures/, audio/, fonts/ subdirectories.
 */

import Phaser from "phaser";
import { GAME_CONFIG } from "../data/GameConfig";

export class PreloadScene extends Phaser.Scene {
  constructor() {
    super({ key: GAME_CONFIG.SCENES.PRELOAD });
  }

  preload(): void {
    const W = this.scale.width;
    const H = this.scale.height;

    // Loading bar UI
    const barBg = this.add.rectangle(W / 2, H / 2, 400, 24, 0x222222);
    barBg.setStrokeStyle(2, 0x444444);
    const bar = this.add.rectangle(W / 2 - 198, H / 2, 0, 20, 0x4444cc);
    bar.setOrigin(0, 0.5);

    this.add.text(W / 2, H / 2 - 40, "DUNGEON REQUIEM", {
      fontFamily: "Georgia, serif",
      fontSize: "28px",
      color: "#cc8844",
      stroke: "#000",
      strokeThickness: 3,
    }).setOrigin(0.5);

    this.add.text(W / 2, H / 2 + 30, "Loading...", {
      fontFamily: "Georgia, serif",
      fontSize: "13px",
      color: "#888888",
    }).setOrigin(0.5);

    this.load.on("progress", (value: number) => {
      bar.setSize(396 * value, 20);
    });

    // ── AUDIO STUBS ─────────────────────────────────────────
    // STEAM NOTE: Replace these with actual audio files.
    // Example: this.load.audio("player_attack", "assets/audio/sfx/sword_slash.ogg");
    // All SFX keys listed in AudioManager.ts should have corresponding loads here.

    // ── TEXTURE STUBS ────────────────────────────────────────
    // STEAM NOTE: Replace procedural graphics with real spritesheets.
    // Example:
    //   this.load.spritesheet("player", "assets/textures/player_sheet.png", { frameWidth: 48, frameHeight: 48 });
    //   this.load.image("dungeon_floor", "assets/textures/dungeon_tileset.png");
  }

  create(): void {
    this.time.delayedCall(100, () => {
      this.scene.start(GAME_CONFIG.SCENES.MAIN_MENU);
    });
  }
}
