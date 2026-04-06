/**
 * SettingsScene.ts
 * Settings overlay — can be opened from main menu or pause menu.
 * STEAM NOTE: Add controller navigation for Steam Deck.
 * This scene is designed to extend to audio sliders, keybinding remapper, etc.
 */

import Phaser from "phaser";
import { GAME_CONFIG } from "../data/GameConfig";
import { SaveManager } from "../data/SaveData";

export class SettingsScene extends Phaser.Scene {
  private callerScene = "";

  constructor() {
    super({ key: GAME_CONFIG.SCENES.SETTINGS });
  }

  init(data: { caller?: string }): void {
    this.callerScene = data?.caller ?? GAME_CONFIG.SCENES.MAIN_MENU;
  }

  create(): void {
    const W = this.scale.width;
    const H = this.scale.height;

    // Dim backdrop
    this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.75);

    // Panel
    this.add.rectangle(W / 2, H / 2, 480, 440, 0x0d0008, 0.97)
      .setStrokeStyle(2, 0x664422);

    this.add.text(W / 2, H / 2 - 190, "SETTINGS", {
      fontFamily: "Georgia, serif", fontSize: "26px", color: "#cc8844",
    }).setOrigin(0.5);

    this.add.rectangle(W / 2, H / 2 - 162, 440, 1, 0x664422, 0.5);

    const settings = SaveManager.getSettings();

    // ── Audio Section ─────────────────────────────────────
    let rowY = H / 2 - 138;

    this.add.text(W / 2 - 200, rowY, "AUDIO", {
      fontFamily: "Georgia, serif", fontSize: "13px", color: "#888888",
    });
    rowY += 28;

    this.createToggle(W / 2, rowY, "Mute All", settings.muted, (val) => {
      SaveManager.saveSettings({ muted: val });
    });
    rowY += 42;

    // Master volume slider stub
    this.createSliderRow(W / 2, rowY, "Master Volume", settings.masterVolume, (val) => {
      SaveManager.saveSettings({ masterVolume: val });
    });
    rowY += 42;

    this.createSliderRow(W / 2, rowY, "Music Volume", settings.musicVolume, (val) => {
      SaveManager.saveSettings({ musicVolume: val });
    });
    rowY += 42;

    this.createSliderRow(W / 2, rowY, "SFX Volume", settings.sfxVolume, (val) => {
      SaveManager.saveSettings({ sfxVolume: val });
    });
    rowY += 52;

    // ── Gameplay Section ──────────────────────────────────
    this.add.text(W / 2 - 200, rowY, "GAMEPLAY", {
      fontFamily: "Georgia, serif", fontSize: "13px", color: "#888888",
    });
    rowY += 28;

    this.createToggle(W / 2, rowY, "Screen Shake", settings.screenShake, (val) => {
      SaveManager.saveSettings({ screenShake: val });
      this.registry.set("settings", SaveManager.getSettings());
    });
    rowY += 42;

    this.createToggle(W / 2, rowY, "Damage Numbers", settings.showDamageNumbers, (val) => {
      SaveManager.saveSettings({ showDamageNumbers: val });
      this.registry.set("settings", SaveManager.getSettings());
    });
    rowY += 52;

    // Close
    const closeBtn = this.createButton(W / 2, rowY, "CLOSE SETTINGS", () => {
      this.scene.stop();
      this.scene.resume(this.callerScene);
    });
    void closeBtn;
  }

  private createToggle(x: number, y: number, label: string, initial: boolean, onChange: (val: boolean) => void): void {
    let value = initial;

    this.add.text(x - 180, y, label, {
      fontFamily: "Georgia, serif", fontSize: "14px", color: "#cccccc",
    }).setOrigin(0, 0.5);

    const toggleBg = this.add.rectangle(x + 130, y, 50, 22, value ? 0x226622 : 0x442222)
      .setStrokeStyle(1, 0x888888);
    const toggleKnob = this.add.circle(value ? x + 148 : x + 112, y, 9, 0xffffff);

    const hit = this.add.rectangle(x + 130, y, 50, 22, 0x000000, 0).setInteractive({ cursor: "pointer" });
    hit.on("pointerdown", () => {
      value = !value;
      toggleBg.fillColor = value ? 0x226622 : 0x442222;
      toggleKnob.setX(value ? x + 148 : x + 112);
      onChange(value);
    });
  }

  private createSliderRow(x: number, y: number, label: string, initial: number, onChange: (val: number) => void): void {
    this.add.text(x - 180, y, label, {
      fontFamily: "Georgia, serif", fontSize: "14px", color: "#cccccc",
    }).setOrigin(0, 0.5);

    const sliderW = 140;
    const sliderX = x + 60;
    const value = initial;

    const track = this.add.rectangle(sliderX, y, sliderW, 6, 0x333333).setStrokeStyle(1, 0x555555);
    void track;
    const fill = this.add.rectangle(sliderX - sliderW / 2, y, sliderW * value, 6, 0x4444cc).setOrigin(0, 0.5);
    const knob = this.add.circle(sliderX - sliderW / 2 + sliderW * value, y, 9, 0x8888ff)
      .setInteractive({ cursor: "ew-resize" });

    const valText = this.add.text(sliderX + sliderW / 2 + 14, y, `${Math.round(value * 100)}%`, {
      fontFamily: "Georgia, serif", fontSize: "12px", color: "#888888",
    }).setOrigin(0, 0.5);

    this.input.setDraggable(knob);
    this.input.on("drag", (_: unknown, gameObject: Phaser.GameObjects.Arc, dragX: number) => {
      if (gameObject !== knob) return;
      const minX = sliderX - sliderW / 2;
      const maxX = sliderX + sliderW / 2;
      const clampedX = Phaser.Math.Clamp(dragX, minX, maxX);
      const newVal = (clampedX - minX) / sliderW;
      gameObject.setX(clampedX);
      fill.setSize(clampedX - minX, 6);
      valText.setText(`${Math.round(newVal * 100)}%`);
      onChange(newVal);
    });
  }

  private createButton(x: number, y: number, label: string, onClick: () => void): Phaser.GameObjects.Container {
    const container = this.add.container(x, y);
    const bg = this.add.rectangle(0, 0, 220, 38, 0x1a0a06).setStrokeStyle(1, 0x664422);
    const text = this.add.text(0, 0, label, {
      fontFamily: "Georgia, serif", fontSize: "14px", color: "#cc8844",
    }).setOrigin(0.5);
    container.add([bg, text]);
    container.setSize(220, 38);
    container.setInteractive({ cursor: "pointer" });
    container.on("pointerover", () => { bg.fillColor = 0x2a1a0e; });
    container.on("pointerout", () => { bg.fillColor = 0x1a0a06; });
    container.on("pointerdown", onClick);
    return container;
  }
}
