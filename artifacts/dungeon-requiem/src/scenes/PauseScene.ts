/**
 * PauseScene.ts
 * Pause overlay launched on top of GameScene + UIScene.
 */

import Phaser from "phaser";
import { GAME_CONFIG } from "../data/GameConfig";

export class PauseScene extends Phaser.Scene {
  constructor() {
    super({ key: GAME_CONFIG.SCENES.PAUSE });
  }

  create(): void {
    const W = this.scale.width;
    const H = this.scale.height;

    // Backdrop
    this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.65);

    // Panel
    this.add.rectangle(W / 2, H / 2, 380, 360, 0x0d0008, 0.97)
      .setStrokeStyle(2, 0x664422);

    this.add.text(W / 2, H / 2 - 140, "PAUSED", {
      fontFamily: "Georgia, serif",
      fontSize: "36px",
      color: "#cc8844",
      stroke: "#000",
      strokeThickness: 4,
    }).setOrigin(0.5);

    this.add.rectangle(W / 2, H / 2 - 110, 320, 1, 0x664422, 0.5);

    const buttons = [
      { label: "RESUME", action: () => this.resume() },
      { label: "SETTINGS", action: () => this.openSettings() },
      { label: "MAIN MENU", action: () => this.returnToMenu() },
    ];

    buttons.forEach((btn, i) => {
      this.createButton(W / 2, H / 2 - 50 + i * 72, btn.label, btn.action);
    });

    // ESC to resume hint
    this.add.text(W / 2, H / 2 + 150, "ESC — Resume", {
      fontFamily: "Georgia, serif",
      fontSize: "12px",
      color: "#444444",
    }).setOrigin(0.5);

    // ESC key to resume
    this.input.keyboard?.addKey("ESC").on("down", () => this.resume());
  }

  private createButton(x: number, y: number, label: string, onClick: () => void): void {
    const container = this.add.container(x, y);
    const bg = this.add.rectangle(0, 0, 240, 44, 0x1a0a06).setStrokeStyle(1, 0x664422);
    const text = this.add.text(0, 0, label, {
      fontFamily: "Georgia, serif", fontSize: "16px", color: "#cc8844",
    }).setOrigin(0.5);
    container.add([bg, text]);
    container.setSize(240, 44);
    container.setInteractive({ cursor: "pointer" });
    container.on("pointerover", () => { bg.fillColor = 0x2a1a0e; bg.setStrokeStyle(1, 0xcc6622); });
    container.on("pointerout", () => { bg.fillColor = 0x1a0a06; bg.setStrokeStyle(1, 0x664422); });
    container.on("pointerdown", onClick);
  }

  private resume(): void {
    this.scene.stop();
    this.scene.resume(GAME_CONFIG.SCENES.GAME);
  }

  private openSettings(): void {
    this.scene.launch(GAME_CONFIG.SCENES.SETTINGS, { caller: GAME_CONFIG.SCENES.PAUSE });
    this.scene.pause();
  }

  private returnToMenu(): void {
    this.scene.stop(GAME_CONFIG.SCENES.GAME);
    this.scene.stop(GAME_CONFIG.SCENES.UI);
    this.scene.stop();
    this.scene.start(GAME_CONFIG.SCENES.MAIN_MENU);
  }
}
