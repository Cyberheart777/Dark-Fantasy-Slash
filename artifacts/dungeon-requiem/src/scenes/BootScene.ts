/**
 * BootScene.ts
 * Initial scene — sets up scale manager and transitions to Preload.
 * STEAM NOTE: Handle fullscreen preference here on desktop builds.
 */

import Phaser from "phaser";
import { GAME_CONFIG } from "../data/GameConfig";
import { SaveManager } from "../data/SaveData";

export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: GAME_CONFIG.SCENES.BOOT });
  }

  preload(): void {
    // Load the minimal assets needed for the preload screen
    // In production, load a small loading bar spritesheet here
  }

  create(): void {
    // Store settings in registry so all scenes can access them
    const settings = SaveManager.getSettings();
    this.registry.set("settings", settings);

    // STEAM NOTE: Check for desktop fullscreen preference here
    // if (settings.fullscreen && typeof require !== 'undefined') {
    //   require('electron').remote.getCurrentWindow().setFullScreen(true);
    // }

    this.scene.start(GAME_CONFIG.SCENES.PRELOAD);
  }
}
