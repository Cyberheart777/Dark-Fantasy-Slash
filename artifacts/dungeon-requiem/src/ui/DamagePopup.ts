/**
 * DamagePopup.ts
 * Floating damage/XP number feedback.
 */

import Phaser from "phaser";
import { GAME_CONFIG } from "../data/GameConfig";

export class DamagePopup extends Phaser.GameObjects.Text {
  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    value: number,
    isCrit: boolean,
    isXp = false
  ) {
    const label = isXp ? `+${value} XP` : isCrit ? `${value}!` : `${value}`;
    super(scene, x, y, label, {
      fontFamily: "Georgia, serif",
      fontSize: isXp ? "13px" : isCrit ? "20px" : "15px",
      color: isXp ? "#88ff44" : isCrit ? "#ffdd00" : "#ff8844",
      stroke: "#000000",
      strokeThickness: isCrit ? 3 : 2,
    });

    this.setOrigin(0.5, 1);
    this.setDepth(20);
    scene.add.existing(this);

    const duration = isXp ? GAME_CONFIG.FEEDBACK.XP_POPUP_DURATION : GAME_CONFIG.FEEDBACK.DAMAGE_POPUP_DURATION;

    scene.tweens.add({
      targets: this,
      y: y - (isCrit ? 55 : 38),
      alpha: 0,
      scaleX: isCrit ? 1.4 : 1.0,
      scaleY: isCrit ? 1.4 : 1.0,
      duration,
      ease: "Power1",
      onComplete: () => { this.destroy(); },
    });
  }
}
