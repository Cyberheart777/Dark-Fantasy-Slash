/**
 * GameOverScene.ts
 * End-of-run summary screen.
 * STEAM NOTE: Add Steam achievements trigger hooks here.
 */

import Phaser from "phaser";
import { GAME_CONFIG } from "../data/GameConfig";
import { SaveManager, type RunRecord } from "../data/SaveData";

export interface GameOverData {
  score: number;
  killCount: number;
  level: number;
  survivalTime: number;
  wave: number;
  acquiredUpgrades: string[];
  isNewBestScore: boolean;
}

export class GameOverScene extends Phaser.Scene {
  constructor() {
    super({ key: GAME_CONFIG.SCENES.GAME_OVER });
  }

  init(data: GameOverData): void {
    // Record run to save data
    const record: RunRecord = {
      score: data.score,
      killCount: data.killCount,
      level: data.level,
      survivalTime: data.survivalTime,
      wave: data.wave,
      date: new Date().toLocaleDateString(),
    };
    SaveManager.recordRun(record);

    this.createUI(data);
  }

  create(): void {}

  private createUI(data: GameOverData): void {
    const W = this.scale.width;
    const H = this.scale.height;

    // Dark background
    const bg = this.add.rectangle(W / 2, H / 2, W, H, 0x04000a);
    void bg;

    // Dungeon floor overlay
    const grid = this.add.graphics();
    grid.lineStyle(1, 0x220011, 0.2);
    for (let x = 0; x < W; x += 80) grid.lineBetween(x, 0, x, H);
    for (let y = 0; y < H; y += 80) grid.lineBetween(0, y, W, y);

    // Title
    const titleText = data.isNewBestScore ? "NEW BEST RUN!" : "RUN ENDED";
    const titleColor = data.isNewBestScore ? "#ffdd44" : "#cc4422";

    this.add.text(W / 2, 100, titleText, {
      fontFamily: "Georgia, serif",
      fontSize: "54px",
      color: titleColor,
      stroke: "#000000",
      strokeThickness: 5,
    }).setOrigin(0.5).setAlpha(0);

    this.tweens.add({
      targets: this.children.list[this.children.list.length - 1],
      alpha: 1, y: 110, duration: 800, ease: "Power2",
    });

    // Divider
    this.add.rectangle(W / 2, 168, 600, 2, 0x664422, 0.6);

    // Score (big)
    this.add.text(W / 2, 220, data.score.toLocaleString(), {
      fontFamily: "Georgia, serif",
      fontSize: "64px",
      color: "#ffdd88",
      stroke: "#000",
      strokeThickness: 4,
    }).setOrigin(0.5);

    this.add.text(W / 2, 278, "FINAL SCORE", {
      fontFamily: "Georgia, serif",
      fontSize: "14px",
      color: "#666666",
    }).setOrigin(0.5);

    // Stats grid
    const statsY = 330;
    const stats: Array<[string, string]> = [
      ["SURVIVAL TIME", this.formatTime(data.survivalTime)],
      ["KILLS", data.killCount.toLocaleString()],
      ["LEVEL REACHED", `${data.level}`],
      ["WAVE REACHED", `${data.wave + 1}`],
    ];

    stats.forEach(([label, value], i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const sx = W / 2 + (col === 0 ? -170 : 170);
      const sy = statsY + row * 70;

      this.add.text(sx, sy, value, {
        fontFamily: "Georgia, serif",
        fontSize: "28px",
        color: "#ffffff",
        stroke: "#000",
        strokeThickness: 2,
      }).setOrigin(0.5);
      this.add.text(sx, sy + 30, label, {
        fontFamily: "Georgia, serif",
        fontSize: "11px",
        color: "#666666",
      }).setOrigin(0.5);
    });

    // Divider
    this.add.rectangle(W / 2, 480, 600, 1, 0x442211, 0.4);

    // Upgrades acquired
    if (data.acquiredUpgrades.length > 0) {
      this.add.text(W / 2, 504, "UPGRADES TAKEN", {
        fontFamily: "Georgia, serif",
        fontSize: "12px",
        color: "#666666",
      }).setOrigin(0.5);
      this.add.text(W / 2, 530, data.acquiredUpgrades.join("  •  "), {
        fontFamily: "Georgia, serif",
        fontSize: "12px",
        color: "#aa8844",
        wordWrap: { width: W - 100 },
        align: "center",
      }).setOrigin(0.5);
    }

    // Buttons
    this.createButton(W / 2 - 130, H - 80, "PLAY AGAIN", 0xcc4422, 0x441100, () => {
      this.cameras.main.fade(300, 0, 0, 0, false, (_: unknown, p: number) => {
        if (p === 1) this.scene.start(GAME_CONFIG.SCENES.GAME);
      });
    });

    this.createButton(W / 2 + 130, H - 80, "MAIN MENU", 0x444444, 0x111111, () => {
      this.cameras.main.fade(300, 0, 0, 0, false, (_: unknown, p: number) => {
        if (p === 1) this.scene.start(GAME_CONFIG.SCENES.MAIN_MENU);
      });
    });

    // Fade in
    this.cameras.main.fadeIn(600, 0, 0, 0);
  }

  private createButton(x: number, y: number, label: string, strokeColor: number, fillColor: number, onClick: () => void): void {
    const container = this.add.container(x, y);
    const bg = this.add.rectangle(0, 0, 200, 46, fillColor).setStrokeStyle(2, strokeColor);
    const text = this.add.text(0, 0, label, {
      fontFamily: "Georgia, serif", fontSize: "16px", color: "#ffffff",
    }).setOrigin(0.5);
    container.add([bg, text]);
    container.setSize(200, 46);
    container.setInteractive({ cursor: "pointer" });
    container.on("pointerover", () => { bg.fillColor = Math.min(fillColor + 0x111111, 0xffffff); });
    container.on("pointerout", () => { bg.fillColor = fillColor; });
    container.on("pointerdown", () => {
      this.tweens.add({ targets: container, scaleX: 0.95, scaleY: 0.95, duration: 60, yoyo: true, onComplete: onClick });
    });
  }

  private formatTime(seconds: number): string {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
  }
}
