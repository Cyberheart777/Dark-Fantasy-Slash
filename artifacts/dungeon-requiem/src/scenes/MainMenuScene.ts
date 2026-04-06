/**
 * MainMenuScene.ts
 * Main menu with start, settings, and high scores.
 * STEAM NOTE: Add controller navigation for Steam Deck compatibility.
 */

import Phaser from "phaser";
import { GAME_CONFIG } from "../data/GameConfig";
import { SaveManager } from "../data/SaveData";

export class MainMenuScene extends Phaser.Scene {
  private particles: Array<{ x: number; y: number; vy: number; alpha: number; size: number }> = [];
  private particleGraphics!: Phaser.GameObjects.Graphics;
  private bgGraphics!: Phaser.GameObjects.Graphics;

  constructor() {
    super({ key: GAME_CONFIG.SCENES.MAIN_MENU });
  }

  create(): void {
    const W = this.scale.width;
    const H = this.scale.height;

    // Dark gradient background
    this.bgGraphics = this.add.graphics();
    this.drawBackground();

    // Particles
    this.particleGraphics = this.add.graphics();
    for (let i = 0; i < 40; i++) {
      this.particles.push({
        x: Math.random() * W,
        y: Math.random() * H,
        vy: -0.2 - Math.random() * 0.6,
        alpha: 0.1 + Math.random() * 0.4,
        size: 1 + Math.random() * 2,
      });
    }

    // Title
    const title = this.add.text(W / 2, 160, "DUNGEON REQUIEM", {
      fontFamily: "Georgia, serif",
      fontSize: "64px",
      color: "#cc8844",
      stroke: "#000000",
      strokeThickness: 6,
    }).setOrigin(0.5).setAlpha(0);

    const subtitle = this.add.text(W / 2, 230, "A Dark Fantasy Survival", {
      fontFamily: "Georgia, serif",
      fontSize: "20px",
      color: "#888888",
      fontStyle: "italic",
    }).setOrigin(0.5).setAlpha(0);

    this.tweens.add({ targets: [title, subtitle], alpha: 1, duration: 1200, ease: "Power2" });

    // Decorative separator
    this.add.rectangle(W / 2, 270, 500, 1, 0x664422, 0.6);

    // Menu buttons
    const buttons = [
      { label: "ENTER THE DUNGEON", action: () => this.startGame(), color: "#ff8844" },
      { label: "SETTINGS",          action: () => this.openSettings(), color: "#aaaaaa" },
      { label: "BEST RUNS",         action: () => this.showBestRuns(), color: "#aaaaaa" },
    ];

    buttons.forEach((btn, i) => {
      this.createMenuButton(W / 2, 330 + i * 68, btn.label, btn.color, btn.action);
    });

    // Best score display
    const save = SaveManager.load();
    if (save.bestScore > 0) {
      this.add.text(W / 2, H - 90, `BEST SCORE: ${save.bestScore.toLocaleString()}`, {
        fontFamily: "Georgia, serif",
        fontSize: "14px",
        color: "#ffdd88",
      }).setOrigin(0.5);

      const bestTime = save.bestSurvivalTime;
      const mins = Math.floor(bestTime / 60);
      const secs = Math.floor(bestTime % 60);
      this.add.text(W / 2, H - 68, `BEST RUN: ${mins}:${secs.toString().padStart(2, "0")} | ${save.totalRuns} RUNS`, {
        fontFamily: "Georgia, serif",
        fontSize: "12px",
        color: "#888888",
      }).setOrigin(0.5);
    }

    // Controls hint
    this.add.text(W / 2, H - 30, "WASD to move  •  Mouse aim  •  SPACE to attack  •  SHIFT to dash", {
      fontFamily: "Georgia, serif",
      fontSize: "12px",
      color: "#555555",
    }).setOrigin(0.5);

    // Version
    this.add.text(W - 10, H - 10, "v0.1.0-prototype", {
      fontFamily: "monospace",
      fontSize: "10px",
      color: "#333333",
    }).setOrigin(1, 1);
  }

  private createMenuButton(x: number, y: number, label: string, color: string, onClick: () => void): void {
    const container = this.add.container(x, y);

    const bg = this.add.rectangle(0, 0, 280, 46, 0x1a1008, 0.8);
    bg.setStrokeStyle(1, 0x664422, 0.6);

    const text = this.add.text(0, 0, label, {
      fontFamily: "Georgia, serif",
      fontSize: "17px",
      color,
    }).setOrigin(0.5);

    container.add([bg, text]);
    container.setSize(280, 46);
    container.setInteractive({ cursor: "pointer" });

    container.on("pointerover", () => {
      bg.fillColor = 0x2a1a0e;
      bg.setStrokeStyle(1, 0xcc6622);
      text.setScale(1.04);
    });

    container.on("pointerout", () => {
      bg.fillColor = 0x1a1008;
      bg.setStrokeStyle(1, 0x664422, 0.6);
      text.setScale(1);
    });

    container.on("pointerdown", () => {
      this.tweens.add({
        targets: container,
        scaleX: 0.96,
        scaleY: 0.96,
        duration: 60,
        yoyo: true,
        onComplete: onClick,
      });
    });
  }

  private drawBackground(): void {
    const W = this.scale.width;
    const H = this.scale.height;

    // Dark vignette
    const grad = this.bgGraphics.fillGradientStyle(0x0a0005, 0x0a0005, 0x12000a, 0x12000a, 1);
    void grad;
    this.bgGraphics.fillRect(0, 0, W, H);

    // Subtle dungeon floor pattern
    this.bgGraphics.lineStyle(1, 0x220011, 0.3);
    const tileSize = 80;
    for (let x = 0; x < W; x += tileSize) {
      this.bgGraphics.lineBetween(x, 0, x, H);
    }
    for (let y = 0; y < H; y += tileSize) {
      this.bgGraphics.lineBetween(0, y, W, y);
    }
  }

  private startGame(): void {
    this.cameras.main.fade(400, 0, 0, 0, false, (_: unknown, progress: number) => {
      if (progress === 1) {
        this.scene.stop();
        this.scene.start(GAME_CONFIG.SCENES.GAME);
      }
    });
  }

  private openSettings(): void {
    this.scene.launch(GAME_CONFIG.SCENES.SETTINGS);
    this.scene.pause();
  }

  private showBestRuns(): void {
    const save = SaveManager.load();
    const W = this.scale.width;
    const H = this.scale.height;

    const overlay = this.add.rectangle(W / 2, H / 2, 500, 420, 0x08000a, 0.95)
      .setStrokeStyle(2, 0x664422).setDepth(50);

    const title = this.add.text(W / 2, H / 2 - 180, "BEST RUNS", {
      fontFamily: "Georgia, serif", fontSize: "22px", color: "#cc8844",
    }).setOrigin(0.5).setDepth(51);

    const runs = save.recentRuns.slice(0, 6);
    const runTexts: Phaser.GameObjects.Text[] = [];

    if (runs.length === 0) {
      runTexts.push(this.add.text(W / 2, H / 2, "No runs yet. Enter the dungeon!", {
        fontFamily: "Georgia, serif", fontSize: "14px", color: "#666666",
      }).setOrigin(0.5).setDepth(51));
    } else {
      runs.forEach((run, i) => {
        const mins = Math.floor(run.survivalTime / 60);
        const secs = Math.floor(run.survivalTime % 60);
        const line = `${i + 1}. Score: ${run.score.toLocaleString()}  Kills: ${run.killCount}  Time: ${mins}:${secs.toString().padStart(2, "0")}  Lv${run.level}`;
        runTexts.push(this.add.text(W / 2, H / 2 - 130 + i * 34, line, {
          fontFamily: "Georgia, serif", fontSize: "13px", color: "#cccccc",
        }).setOrigin(0.5).setDepth(51));
      });
    }

    const closeBtn = this.add.text(W / 2, H / 2 + 175, "[ CLOSE ]", {
      fontFamily: "Georgia, serif", fontSize: "15px", color: "#888888",
    }).setOrigin(0.5).setDepth(51).setInteractive({ cursor: "pointer" });

    closeBtn.on("pointerover", () => closeBtn.setColor("#ffffff"));
    closeBtn.on("pointerout", () => closeBtn.setColor("#888888"));
    closeBtn.on("pointerdown", () => {
      [overlay, title, ...runTexts, closeBtn].forEach(o => o.destroy());
    });
  }

  update(): void {
    const W = this.scale.width;
    const H = this.scale.height;

    this.particleGraphics.clear();
    for (const p of this.particles) {
      p.y += p.vy;
      if (p.y < 0) { p.y = H; p.x = Math.random() * W; }
      this.particleGraphics.fillStyle(0xffaa44, p.alpha);
      this.particleGraphics.fillCircle(p.x, p.y, p.size);
    }
  }
}
