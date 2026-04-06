/**
 * GameInstance.ts
 * Phaser game bootstrap.
 * STEAM NOTE: When wrapping with Electron/Tauri, change:
 *   - type: Phaser.AUTO → Phaser.WEBGL for better desktop performance
 *   - parent: "game-container" → a native window element ID
 *   - backgroundColor can be overridden by a real scene background
 */

import Phaser from "phaser";
import { GAME_CONFIG } from "../data/GameConfig";

import { BootScene }     from "../scenes/BootScene";
import { PreloadScene }  from "../scenes/PreloadScene";
import { MainMenuScene } from "../scenes/MainMenuScene";
import { GameScene }     from "../scenes/GameScene";
import { HUDScene }      from "../ui/HUD";
import { GameOverScene } from "../scenes/GameOverScene";
import { PauseScene }    from "../scenes/PauseScene";
import { SettingsScene } from "../scenes/SettingsScene";
import { LevelUpScene }  from "../scenes/LevelUpScene";

let gameInstance: Phaser.Game | null = null;

export function createGame(containerId: string): Phaser.Game {
  if (gameInstance) {
    gameInstance.destroy(true);
  }

  const config: Phaser.Types.Core.GameConfig = {
    type: Phaser.AUTO,
    width: GAME_CONFIG.WIDTH,
    height: GAME_CONFIG.HEIGHT,
    parent: containerId,
    backgroundColor: "#04000a",
    antialias: true,
    pixelArt: false,
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
      // STEAM NOTE: For desktop full-screen builds, change to:
      //   mode: Phaser.Scale.RESIZE
      //   width: window.innerWidth
      //   height: window.innerHeight
    },
    scene: [
      BootScene,
      PreloadScene,
      MainMenuScene,
      GameScene,
      HUDScene,
      GameOverScene,
      PauseScene,
      SettingsScene,
      LevelUpScene,
    ],
    // STEAM NOTE: Input can be extended here with:
    //   input: { gamepad: true } — for controller support on Steam Deck
    input: {
      keyboard: true,
      mouse: true,
      touch: false,
      gamepad: false, // Set to true when adding controller support
    },
    physics: {
      // Physics not used (manual movement) but hooks are here
      // STEAM NOTE: Switch to arcade or matter if physics-based movement is needed
    },
    fps: {
      target: GAME_CONFIG.TARGET_FPS,
      forceSetTimeOut: false,
    },
    audio: {
      disableWebAudio: false,
      // STEAM NOTE: On desktop, consider using a native audio lib
    },
    banner: false,
  };

  gameInstance = new Phaser.Game(config);
  return gameInstance;
}

export function destroyGame(): void {
  if (gameInstance) {
    gameInstance.destroy(true);
    gameInstance = null;
  }
}

export function getGame(): Phaser.Game | null {
  return gameInstance;
}
