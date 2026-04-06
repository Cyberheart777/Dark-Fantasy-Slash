/**
 * PreloadScene.ts
 * Asset loading + pixel art texture generation.
 * STEAM NOTE: Replace generateAllTextures() calls with real asset loads:
 *   this.load.spritesheet("player_sheet", "assets/textures/player.png", { frameWidth: 48, frameHeight: 48 });
 */

import Phaser from "phaser";
import { GAME_CONFIG } from "../data/GameConfig";
import { generateAllTextures, registerAnimations } from "../assets/PixelArtGenerator";

export class PreloadScene extends Phaser.Scene {
  constructor() {
    super({ key: GAME_CONFIG.SCENES.PRELOAD });
  }

  preload(): void {
    const W = this.scale.width;
    const H = this.scale.height;

    // Loading bar
    const barBg = this.add.rectangle(W / 2, H / 2, 400, 24, 0x1a0025);
    barBg.setStrokeStyle(2, 0x440066);
    const bar = this.add.rectangle(W / 2 - 198, H / 2, 0, 20, 0x7700cc);
    bar.setOrigin(0, 0.5);

    this.add.text(W / 2, H / 2 - 50, "DUNGEON REQUIEM", {
      fontFamily: "Georgia, serif",
      fontSize: "30px",
      color: "#cc8844",
      stroke: "#000",
      strokeThickness: 3,
    }).setOrigin(0.5);

    this.add.text(W / 2, H / 2 + 34, "Generating dungeon...", {
      fontFamily: "Georgia, serif",
      fontSize: "12px",
      color: "#664477",
    }).setOrigin(0.5);

    this.load.on("progress", (value: number) => {
      bar.setSize(396 * value, 20);
    });

    // ── Audio placeholders ───────────────────────────────────────────────
    // STEAM NOTE: Add real audio files here:
    // this.load.audio("player_attack", "assets/audio/sfx/sword_slash.ogg");
  }

  create(): void {
    // Generate all pixel art textures programmatically
    generateAllTextures(this);
    registerAnimations(this);

    this.time.delayedCall(120, () => {
      this.scene.start(GAME_CONFIG.SCENES.MAIN_MENU);
    });
  }
}
