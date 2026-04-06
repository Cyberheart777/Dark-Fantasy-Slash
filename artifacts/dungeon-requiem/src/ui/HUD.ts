/**
 * HUD.ts
 * In-game heads-up display overlay scene.
 * Runs as a separate scene layered on top of the game scene.
 */

import Phaser from "phaser";
import { GAME_CONFIG } from "../data/GameConfig";

export interface HUDData {
  currentHealth: number;
  maxHealth: number;
  xpPercent: number;    // 0-1
  level: number;
  killCount: number;
  survivalSeconds: number;
  wave: number;
  dashCooldownPercent: number;  // 0-1 ready
  upgrades: string[];  // display names
}

export class HUDScene extends Phaser.Scene {
  // Health bar
  private healthBg!: Phaser.GameObjects.Rectangle;
  private healthFg!: Phaser.GameObjects.Rectangle;
  private healthText!: Phaser.GameObjects.Text;

  // XP bar
  private xpBg!: Phaser.GameObjects.Rectangle;
  private xpFg!: Phaser.GameObjects.Rectangle;
  private xpText!: Phaser.GameObjects.Text;

  // Stats
  private levelText!: Phaser.GameObjects.Text;
  private killText!: Phaser.GameObjects.Text;
  private timerText!: Phaser.GameObjects.Text;
  private waveText!: Phaser.GameObjects.Text;

  // Dash indicator
  private dashBg!: Phaser.GameObjects.Rectangle;
  private dashFg!: Phaser.GameObjects.Rectangle;
  private dashLabel!: Phaser.GameObjects.Text;

  // Acquired upgrades list
  private upgradeList!: Phaser.GameObjects.Text;

  constructor() {
    super({ key: GAME_CONFIG.SCENES.UI });
  }

  create(): void {
    const W = this.scale.width;
    const H = this.scale.height;

    // ── Health Bar (bottom left) ──────────────────────────
    const hbW = 260;
    const hbH = 18;
    const hbX = 20;
    const hbY = H - 60;

    this.add.text(hbX, hbY - 20, "HEALTH", {
      fontFamily: "Georgia, serif", fontSize: "11px", color: "#aaaaaa",
    });

    this.healthBg = this.add.rectangle(hbX, hbY, hbW, hbH, 0x330000).setOrigin(0, 0);
    this.healthFg = this.add.rectangle(hbX, hbY, hbW, hbH, 0xdd2200).setOrigin(0, 0);
    this.add.rectangle(hbX, hbY, hbW, hbH, 0x000000, 0).setStrokeStyle(1, 0x880000).setOrigin(0, 0);
    this.healthText = this.add.text(hbX + hbW / 2, hbY + hbH / 2, "", {
      fontFamily: "Georgia, serif", fontSize: "11px", color: "#ffffff",
    }).setOrigin(0.5);

    // ── XP Bar (bottom center) ─────────────────────────────
    const xpW = 340;
    const xpH = 12;
    const xpX = (W - xpW) / 2;
    const xpY = H - 28;

    this.add.text(xpX, xpY - 16, "EXPERIENCE", {
      fontFamily: "Georgia, serif", fontSize: "11px", color: "#8888ff",
    });

    this.xpBg = this.add.rectangle(xpX, xpY, xpW, xpH, 0x111133).setOrigin(0, 0);
    this.xpFg = this.add.rectangle(xpX, xpY, 0, xpH, 0x4444ff).setOrigin(0, 0);
    this.add.rectangle(xpX, xpY, xpW, xpH, 0x000000, 0).setStrokeStyle(1, 0x333366).setOrigin(0, 0);
    this.xpText = this.add.text(xpX + xpW + 8, xpY + xpH / 2, "", {
      fontFamily: "Georgia, serif", fontSize: "11px", color: "#8888ff",
    }).setOrigin(0, 0.5);

    // ── Level / Wave / Kills / Timer (top bar) ─────────────
    const topY = 14;

    this.levelText = this.add.text(20, topY, "LVL 1", {
      fontFamily: "Georgia, serif", fontSize: "16px", color: "#ffdd88",
      stroke: "#000", strokeThickness: 2,
    });

    this.killText = this.add.text(100, topY, "0 KILLS", {
      fontFamily: "Georgia, serif", fontSize: "14px", color: "#cccccc",
      stroke: "#000", strokeThickness: 2,
    });

    this.waveText = this.add.text(W / 2, topY, "WAVE 1", {
      fontFamily: "Georgia, serif", fontSize: "16px", color: "#ff8844",
      stroke: "#000", strokeThickness: 2,
    }).setOrigin(0.5, 0);

    this.timerText = this.add.text(W - 20, topY, "0:00", {
      fontFamily: "Georgia, serif", fontSize: "16px", color: "#ffffff",
      stroke: "#000", strokeThickness: 2,
    }).setOrigin(1, 0);

    // ── Dash Cooldown indicator ────────────────────────────
    this.dashBg = this.add.rectangle(hbX, hbY - 36, 80, 8, 0x111111).setOrigin(0, 0);
    this.dashFg = this.add.rectangle(hbX, hbY - 36, 80, 8, 0x00ddff).setOrigin(0, 0);
    this.add.rectangle(hbX, hbY - 36, 80, 8, 0x000000, 0).setStrokeStyle(1, 0x004466).setOrigin(0, 0);
    this.dashLabel = this.add.text(hbX + 84, hbY - 32, "DASH", {
      fontFamily: "Georgia, serif", fontSize: "10px", color: "#00ddff",
    }).setOrigin(0, 0.5);

    // ── Acquired upgrades list (right side) ───────────────
    this.upgradeList = this.add.text(W - 20, 50, "", {
      fontFamily: "Georgia, serif", fontSize: "11px", color: "#cccccc",
      align: "right",
    }).setOrigin(1, 0);

    // ── Depth / layer ──────────────────────────────────────
    this.children.list.forEach(c => (c as Phaser.GameObjects.GameObject).setDepth?.(100));
  }

  updateHUD(data: HUDData): void {
    if (!this.scene.isActive()) return;

    const hbW = 260;
    // Health bar
    const healthPct = data.maxHealth > 0 ? data.currentHealth / data.maxHealth : 0;
    this.healthFg.setSize(hbW * healthPct, 18);
    if (healthPct > 0.5) this.healthFg.fillColor = 0x00bb44;
    else if (healthPct > 0.25) this.healthFg.fillColor = 0xffaa00;
    else this.healthFg.fillColor = 0xdd2200;
    this.healthText.setText(`${Math.ceil(data.currentHealth)} / ${data.maxHealth}`);

    // XP bar
    const xpW = 340;
    this.xpFg.setSize(xpW * data.xpPercent, 12);
    this.xpText.setText(`LV${data.level}`);

    // Stats
    this.levelText.setText(`LVL ${data.level}`);
    this.killText.setText(`${data.killCount} KILLS`);
    this.waveText.setText(`WAVE ${data.wave + 1}`);

    const mins = Math.floor(data.survivalSeconds / 60);
    const secs = Math.floor(data.survivalSeconds % 60);
    this.timerText.setText(`${mins}:${secs.toString().padStart(2, "0")}`);

    // Dash cooldown
    this.dashFg.setSize(80 * data.dashCooldownPercent, 8);

    // Upgrades
    this.upgradeList.setText(
      data.upgrades.length > 0
        ? "UPGRADES:\n" + data.upgrades.slice(-8).join("\n")
        : ""
    );
  }

  showWaveBanner(wave: number): void {
    const W = this.scale.width;
    const H = this.scale.height;
    const banner = this.add.text(W / 2, H / 2 - 60, `WAVE ${wave + 1}`, {
      fontFamily: "Georgia, serif",
      fontSize: "44px",
      color: "#ff8844",
      stroke: "#000",
      strokeThickness: 5,
    }).setOrigin(0.5).setDepth(110).setAlpha(0);

    this.tweens.add({
      targets: banner,
      alpha: { from: 0, to: 1 },
      y: H / 2 - 80,
      duration: 300,
      ease: "Power2",
      yoyo: true,
      hold: 1000,
      onComplete: () => banner.destroy(),
    });
  }

  showBossBanner(): void {
    const W = this.scale.width;
    const H = this.scale.height;
    const banner = this.add.text(W / 2, H / 2 - 40, "⚠ BOSS APPROACHING ⚠", {
      fontFamily: "Georgia, serif",
      fontSize: "32px",
      color: "#ff2200",
      stroke: "#000",
      strokeThickness: 4,
    }).setOrigin(0.5).setDepth(110).setAlpha(0);

    this.tweens.add({
      targets: banner,
      alpha: { from: 0, to: 1 },
      y: H / 2 - 60,
      duration: 400,
      ease: "Power2",
      yoyo: true,
      hold: 1400,
      onComplete: () => banner.destroy(),
    });
  }
}
