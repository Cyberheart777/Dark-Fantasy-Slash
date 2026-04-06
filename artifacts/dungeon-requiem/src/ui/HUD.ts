/**
 * HUD.ts
 * In-game heads-up display — includes health/xp bars, stats, dash indicator,
 * and a paperdoll character portrait panel with acquired upgrade slots.
 */

import Phaser from "phaser";
import { GAME_CONFIG } from "../data/GameConfig";

export interface HUDData {
  currentHealth: number;
  maxHealth: number;
  xpPercent: number;
  level: number;
  killCount: number;
  survivalSeconds: number;
  wave: number;
  dashCooldownPercent: number;
  upgrades: string[];
}

// Upgrade category → display icon char (ASCII/unicode)
const UPGRADE_ICONS: Record<string, string> = {
  "default": "◆",
  "sword":   "⚔",
  "shield":  "🛡",
  "boot":    "☁",
  "blood":   "♥",
};

export class HUDScene extends Phaser.Scene {
  // Health bar
  private healthBg!: Phaser.GameObjects.Rectangle;
  private healthFg!: Phaser.GameObjects.Rectangle;
  private healthText!: Phaser.GameObjects.Text;

  // XP bar
  private xpBg!: Phaser.GameObjects.Rectangle;
  private xpFg!: Phaser.GameObjects.Rectangle;

  // Stats
  private levelText!: Phaser.GameObjects.Text;
  private killText!: Phaser.GameObjects.Text;
  private timerText!: Phaser.GameObjects.Text;
  private waveText!: Phaser.GameObjects.Text;
  private xpLevelText!: Phaser.GameObjects.Text;

  // Dash indicator
  private dashBg!: Phaser.GameObjects.Rectangle;
  private dashFg!: Phaser.GameObjects.Rectangle;

  // Paperdoll
  private paperdollPanel!: Phaser.GameObjects.Graphics;
  private paperdollSprite!: Phaser.GameObjects.Sprite;
  private upgradeSlots: Phaser.GameObjects.Container[] = [];
  private upgradeTexts: Phaser.GameObjects.Text[] = [];

  // Previous upgrades list (for diffing)
  private prevUpgrades: string[] = [];

  constructor() {
    super({ key: GAME_CONFIG.SCENES.UI });
  }

  create(): void {
    const W = this.scale.width;
    const H = this.scale.height;

    // ── Top bar background strip ──────────────────────────
    this.add.rectangle(W / 2, 0, W, 48, 0x000000, 0.55).setOrigin(0.5, 0).setDepth(99);

    // ── Health Bar (bottom left) ──────────────────────────
    const hbW = 240;
    const hbH = 18;
    const hbX = 14;
    const hbY = H - 52;

    this.add.rectangle(hbX, hbY - 22, 80, 1, 0x550033, 1).setOrigin(0, 0);
    this.add.text(hbX, hbY - 20, "HP", {
      fontFamily: "Georgia, serif", fontSize: "10px", color: "#dd4455",
    }).setDepth(101);

    this.healthBg = this.add.rectangle(hbX, hbY, hbW, hbH, 0x220000).setOrigin(0, 0);
    this.healthFg = this.add.rectangle(hbX, hbY, hbW, hbH, 0xdd2200).setOrigin(0, 0);
    this.add.rectangle(hbX, hbY, hbW, hbH, 0x000000, 0).setStrokeStyle(1.5, 0x660000).setOrigin(0, 0);
    this.healthText = this.add.text(hbX + hbW / 2, hbY + hbH / 2, "", {
      fontFamily: "Georgia, serif", fontSize: "11px", color: "#ffffff",
    }).setOrigin(0.5).setDepth(102);

    // ── Dash indicator (below health) ─────────────────────
    const dashY = hbY + hbH + 8;
    this.add.text(hbX, dashY - 1, "DASH", {
      fontFamily: "Georgia, serif", fontSize: "9px", color: "#4499cc",
    }).setDepth(101);
    this.dashBg = this.add.rectangle(hbX + 36, dashY + 3, 100, 7, 0x0a1a22).setOrigin(0, 0.5);
    this.dashFg = this.add.rectangle(hbX + 36, dashY + 3, 100, 7, 0x00ccff).setOrigin(0, 0.5);
    this.add.rectangle(hbX + 36, dashY + 3, 100, 7, 0, 0).setStrokeStyle(1, 0x002244).setOrigin(0, 0.5);

    // ── XP Bar (bottom center) ─────────────────────────────
    const xpW = W - 30;
    const xpH = 10;
    const xpX = 15;
    const xpY = H - 18;

    this.xpBg = this.add.rectangle(xpX, xpY, xpW, xpH, 0x080820).setOrigin(0, 0);
    this.xpFg = this.add.rectangle(xpX, xpY, 0, xpH, 0x3355ff).setOrigin(0, 0);
    this.add.rectangle(xpX, xpY, xpW, xpH, 0, 0).setStrokeStyle(1, 0x222244).setOrigin(0, 0);

    this.xpLevelText = this.add.text(xpX + xpW / 2, xpY + xpH / 2, "LV 1", {
      fontFamily: "Georgia, serif", fontSize: "9px", color: "#6688ff",
    }).setOrigin(0.5).setDepth(102);

    // ── Top bar stats ─────────────────────────────────────
    const topY = 10;

    this.levelText = this.add.text(14, topY, "LVL 1", {
      fontFamily: "Georgia, serif", fontSize: "15px", color: "#ffdd88",
      stroke: "#000", strokeThickness: 2,
    }).setDepth(101);

    this.killText = this.add.text(90, topY, "0 KILLS", {
      fontFamily: "Georgia, serif", fontSize: "13px", color: "#cccccc",
      stroke: "#000", strokeThickness: 2,
    }).setDepth(101);

    this.waveText = this.add.text(W / 2, topY, "WAVE 1", {
      fontFamily: "Georgia, serif", fontSize: "15px", color: "#ff8844",
      stroke: "#000", strokeThickness: 2,
    }).setOrigin(0.5, 0).setDepth(101);

    this.timerText = this.add.text(W - 14, topY, "0:00", {
      fontFamily: "Georgia, serif", fontSize: "15px", color: "#ffffff",
      stroke: "#000", strokeThickness: 2,
    }).setOrigin(1, 0).setDepth(101);

    // ── Paperdoll panel (right side) ──────────────────────
    this.buildPaperdoll(W, H);

    // Set depths on everything
    this.children.list.forEach(c => {
      const go = c as Phaser.GameObjects.GameObject;
      if (typeof go.setDepth === "function" && go.depth < 100) go.setDepth(100);
    });
  }

  private buildPaperdoll(W: number, H: number): void {
    const panelW = 160;
    const panelH = 300;
    const panelX = W - panelW - 10;
    const panelY = 60;

    // Panel background
    const panel = this.add.graphics().setDepth(100);
    panel.fillStyle(0x0a0014, 0.85);
    panel.fillRoundedRect(panelX, panelY, panelW, panelH, 6);
    panel.lineStyle(1.5, 0x440066, 0.9);
    panel.strokeRoundedRect(panelX, panelY, panelW, panelH, 6);
    this.paperdollPanel = panel;

    // Panel title
    this.add.text(panelX + panelW / 2, panelY + 10, "CHARACTER", {
      fontFamily: "Georgia, serif", fontSize: "9px", color: "#774488",
      letterSpacing: 2,
    }).setOrigin(0.5, 0).setDepth(102);

    // Separator
    this.add.rectangle(panelX + 10, panelY + 26, panelW - 20, 1, 0x330044).setOrigin(0, 0).setDepth(102);

    // Character sprite (paperdoll) — use player_sheet frame 0
    this.paperdollSprite = this.add.sprite(panelX + panelW / 2, panelY + 65, "player_sheet")
      .setOrigin(0.5)
      .setFrame(0)
      .setScale(3.2)
      .setDepth(103);

    // Play gentle idle bob on the paperdoll
    this.tweens.add({
      targets: this.paperdollSprite,
      y: panelY + 65 - 4,
      duration: 900,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });

    // Slow idle animation
    this.paperdollSprite.play("player_idle");

    // Equipment slot rings (visual only)
    const slotDefs = [
      { label: "HEAD",  x: panelX + panelW / 2,       y: panelY + 34,  color: 0x553300 },
      { label: "BODY",  x: panelX + panelW / 2,       y: panelY + 100, color: 0x003355 },
      { label: "BOOTS", x: panelX + panelW / 2,       y: panelY + 115, color: 0x220044 },
      { label: "WPNL",  x: panelX + 20,               y: panelY + 70,  color: 0x333300 },
      { label: "WPNR",  x: panelX + panelW - 20,      y: panelY + 70,  color: 0x333300 },
    ];

    // Draw decorative slot circles
    const slotGfx = this.add.graphics().setDepth(101);
    for (const s of slotDefs) {
      slotGfx.lineStyle(1, s.color, 0.6);
      slotGfx.strokeCircle(s.x, s.y, 12);
    }

    // Separator below portrait
    this.add.rectangle(panelX + 10, panelY + 130, panelW - 20, 1, 0x330044).setOrigin(0, 0).setDepth(102);

    // Upgrade list title
    this.add.text(panelX + panelW / 2, panelY + 136, "UPGRADES", {
      fontFamily: "Georgia, serif", fontSize: "9px", color: "#774488",
      letterSpacing: 2,
    }).setOrigin(0.5, 0).setDepth(102);

    // Pre-create upgrade text slots
    const maxSlots = 10;
    for (let i = 0; i < maxSlots; i++) {
      const container = this.add.container(panelX + 10, panelY + 150 + i * 15).setDepth(103);
      const dot = this.add.text(0, 0, "◆", { fontFamily: "Georgia, serif", fontSize: "7px", color: "#553366" });
      const label = this.add.text(12, 0, "", { fontFamily: "Georgia, serif", fontSize: "9px", color: "#ccbbdd" });
      container.add([dot, label]);
      container.setVisible(false);
      this.upgradeSlots.push(container);
      this.upgradeTexts.push(label);
    }
  }

  updateHUD(data: HUDData): void {
    if (!this.scene.isActive()) return;

    const W = this.scale.width;

    // ── Health bar ───────────────────────────────────────
    const hbW = 240;
    const pct = data.maxHealth > 0 ? data.currentHealth / data.maxHealth : 0;
    this.healthFg.setSize(hbW * pct, 18);
    this.healthFg.fillColor = pct > 0.5 ? 0x00bb44 : pct > 0.25 ? 0xffaa00 : 0xdd2200;
    this.healthText.setText(`${Math.ceil(data.currentHealth)} / ${data.maxHealth}`);

    // ── XP bar ───────────────────────────────────────────
    const xpW = W - 30;
    this.xpFg.setSize(xpW * data.xpPercent, 10);
    this.xpLevelText.setText(`LV ${data.level}`);

    // ── Top stats ────────────────────────────────────────
    this.levelText.setText(`LVL ${data.level}`);
    this.killText.setText(`${data.killCount} KILLS`);
    this.waveText.setText(`WAVE ${data.wave + 1}`);

    const mins = Math.floor(data.survivalSeconds / 60);
    const secs = Math.floor(data.survivalSeconds % 60);
    this.timerText.setText(`${mins}:${secs.toString().padStart(2, "0")}`);

    // ── Dash cooldown ────────────────────────────────────
    this.dashFg.setSize(100 * data.dashCooldownPercent, 7);
    this.dashFg.fillColor = data.dashCooldownPercent >= 1 ? 0x00ccff : 0x004466;

    // ── Paperdoll upgrades ────────────────────────────────
    const upgrades = data.upgrades.slice(-10);
    if (upgrades.join(",") !== this.prevUpgrades.join(",")) {
      this.prevUpgrades = [...upgrades];
      upgrades.forEach((name, i) => {
        if (i < this.upgradeSlots.length) {
          this.upgradeSlots[i].setVisible(true);
          this.upgradeTexts[i].setText(name.length > 14 ? name.slice(0, 13) + "…" : name);

          // Flash new entry
          if (i === upgrades.length - 1) {
            this.upgradeTexts[i].setColor("#ffffcc");
            this.time.delayedCall(800, () => {
              if (this.upgradeTexts[i]?.active) this.upgradeTexts[i].setColor("#ccbbdd");
            });
          }
        }
      });
      // Hide unused slots
      for (let i = upgrades.length; i < this.upgradeSlots.length; i++) {
        this.upgradeSlots[i].setVisible(false);
      }
    }
  }

  showWaveBanner(wave: number): void {
    const W = this.scale.width;
    const H = this.scale.height;

    const bg = this.add.rectangle(W / 2, H / 2 - 60, 340, 56, 0x000000, 0.65)
      .setOrigin(0.5).setDepth(115).setAlpha(0);

    const banner = this.add.text(W / 2, H / 2 - 60, `⚔  WAVE ${wave + 1}  ⚔`, {
      fontFamily: "Georgia, serif",
      fontSize: "38px",
      color: "#ff8844",
      stroke: "#000",
      strokeThickness: 5,
    }).setOrigin(0.5).setDepth(116).setAlpha(0);

    this.tweens.add({
      targets: [bg, banner],
      alpha: { from: 0, to: 1 },
      y: { value: H / 2 - 78 },
      duration: 280,
      ease: "Power2",
      yoyo: true,
      hold: 900,
      onComplete: () => { banner.destroy(); bg.destroy(); },
    });
  }

  showBossBanner(): void {
    const W = this.scale.width;
    const H = this.scale.height;

    const bg = this.add.rectangle(W / 2, H / 2 - 40, 400, 52, 0x220000, 0.8)
      .setOrigin(0.5).setDepth(115).setAlpha(0);

    const banner = this.add.text(W / 2, H / 2 - 40, "☠  BOSS APPROACHING  ☠", {
      fontFamily: "Georgia, serif",
      fontSize: "28px",
      color: "#ff2200",
      stroke: "#000",
      strokeThickness: 4,
    }).setOrigin(0.5).setDepth(116).setAlpha(0);

    this.tweens.add({
      targets: [bg, banner],
      alpha: { from: 0, to: 1 },
      duration: 350,
      ease: "Power2",
      yoyo: true,
      hold: 1400,
      onComplete: () => { banner.destroy(); bg.destroy(); },
    });
  }
}
