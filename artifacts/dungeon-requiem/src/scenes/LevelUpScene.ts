/**
 * LevelUpScene.ts
 * Level-up upgrade selection overlay.
 * Pauses the game scene while running.
 */

import Phaser from "phaser";
import { GAME_CONFIG } from "../data/GameConfig";
import type { UpgradeDef, UpgradeId } from "../data/UpgradeData";

export class LevelUpScene extends Phaser.Scene {
  private onPick?: (upgradeId: UpgradeId) => void;

  constructor() {
    super({ key: GAME_CONFIG.SCENES.LEVEL_UP });
  }

  init(data: { level: number; choices: UpgradeDef[]; onPick: (id: UpgradeId) => void }): void {
    this.onPick = data.onPick;
    this.createUI(data.level, data.choices);
  }

  create(): void {
    // UI is created in init to have access to data
  }

  private createUI(level: number, choices: UpgradeDef[]): void {
    const W = this.scale.width;
    const H = this.scale.height;

    // Dim overlay
    this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.70);

    // Title
    this.add.text(W / 2, H / 2 - 180, `LEVEL ${level}!`, {
      fontFamily: "Georgia, serif",
      fontSize: "42px",
      color: "#ffdd44",
      stroke: "#000",
      strokeThickness: 4,
    }).setOrigin(0.5).setDepth(200);

    this.add.text(W / 2, H / 2 - 130, "Choose an upgrade", {
      fontFamily: "Georgia, serif",
      fontSize: "18px",
      color: "#aaaaaa",
    }).setOrigin(0.5).setDepth(200);

    // Upgrade cards
    const cardW = 220;
    const cardH = 200;
    const spacing = 260;
    const startX = W / 2 - spacing * (choices.length - 1) / 2;

    choices.forEach((upgrade, i) => {
      const cardX = startX + i * spacing;
      const cardY = H / 2 + 30;
      this.createUpgradeCard(cardX, cardY, cardW, cardH, upgrade);
    });
  }

  private createUpgradeCard(x: number, y: number, w: number, h: number, upgrade: UpgradeDef): void {
    const container = this.add.container(x, y).setDepth(200);

    const bg = this.add.rectangle(0, 0, w, h, 0x100808, 0.97)
      .setStrokeStyle(2, 0x664422);

    const iconText = this.add.text(0, -70, upgrade.icon, {
      fontSize: "40px",
    }).setOrigin(0.5);

    const nameText = this.add.text(0, -24, upgrade.name.toUpperCase(), {
      fontFamily: "Georgia, serif",
      fontSize: "15px",
      color: "#ffdd88",
      stroke: "#000",
      strokeThickness: 2,
      wordWrap: { width: w - 20 },
      align: "center",
    }).setOrigin(0.5);

    const descText = this.add.text(0, 20, upgrade.description, {
      fontFamily: "Georgia, serif",
      fontSize: "13px",
      color: "#cccccc",
      wordWrap: { width: w - 24 },
      align: "center",
    }).setOrigin(0.5);

    const selectBtn = this.add.rectangle(0, 78, w - 30, 32, 0x442200)
      .setStrokeStyle(1, 0x996633);
    const selectText = this.add.text(0, 78, "SELECT", {
      fontFamily: "Georgia, serif",
      fontSize: "14px",
      color: "#cc8844",
    }).setOrigin(0.5);

    container.add([bg, iconText, nameText, descText, selectBtn, selectText]);
    container.setSize(w, h);
    container.setInteractive({ cursor: "pointer" });

    container.on("pointerover", () => {
      bg.setStrokeStyle(2, 0xffaa44);
      bg.fillColor = 0x1c0c08;
      selectBtn.fillColor = 0x663300;
    });

    container.on("pointerout", () => {
      bg.setStrokeStyle(2, 0x664422);
      bg.fillColor = 0x100808;
      selectBtn.fillColor = 0x442200;
    });

    container.on("pointerdown", () => {
      this.tweens.add({
        targets: container,
        scaleX: 1.05,
        scaleY: 1.05,
        duration: 80,
        yoyo: true,
        onComplete: () => {
          this.pickUpgrade(upgrade.id);
        },
      });
    });
  }

  private pickUpgrade(id: UpgradeId): void {
    const callback = this.onPick;
    this.onPick = undefined;
    this.scene.stop();
    this.scene.resume(GAME_CONFIG.SCENES.GAME);
    callback?.(id);
  }
}
