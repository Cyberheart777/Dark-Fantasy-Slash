/**
 * InputManager.ts
 * Input abstraction layer.
 * STEAM NOTE: This is the single place to add controller/Steam Deck input.
 * Add a `gamepadDriver` that reads from `navigator.getGamepads()` and maps
 * axes/buttons to the same ActionState interface. The rest of the game
 * reads only ActionState and never touches raw input devices.
 */

import Phaser from "phaser";

export interface ActionState {
  // Movement
  moveX: number;   // -1 to 1
  moveY: number;   // -1 to 1
  // Actions
  attack: boolean;
  attackJustPressed: boolean;
  dash: boolean;
  dashJustPressed: boolean;
  pause: boolean;
  pauseJustPressed: boolean;
  // Mouse / aim
  aimX: number;    // world-space aim position
  aimY: number;
  aimAngle: number; // radians
}

export type KeybindingMap = Record<string, string>;

const DEFAULT_BINDINGS: KeybindingMap = {
  moveUp: "W",
  moveDown: "S",
  moveLeft: "A",
  moveRight: "D",
  attack: "SPACE",
  dash: "SHIFT",
  pause: "ESCAPE",
};

export class InputManager {
  private scene: Phaser.Scene;
  private keys: Map<string, Phaser.Input.Keyboard.Key> = new Map();
  private bindings: KeybindingMap;
  private _state: ActionState;
  private prevAttack = false;
  private prevDash = false;
  private prevPause = false;

  constructor(scene: Phaser.Scene, bindings?: Partial<KeybindingMap>) {
    this.scene = scene;
    this.bindings = { ...DEFAULT_BINDINGS, ...bindings };
    this._state = this.emptyState();
    this.registerKeys();
  }

  private registerKeys(): void {
    if (!this.scene.input.keyboard) return;
    for (const [, keyName] of Object.entries(this.bindings)) {
      const key = keyName as keyof typeof Phaser.Input.Keyboard.KeyCodes;
      const keyCode = Phaser.Input.Keyboard.KeyCodes[key];
      if (keyCode !== undefined) {
        this.keys.set(keyName, this.scene.input.keyboard.addKey(keyCode));
      }
    }
  }

  update(): void {
    const kb = this.bindings;

    // Movement from WASD
    let mx = 0;
    let my = 0;
    if (this.isDown(kb.moveLeft))  mx -= 1;
    if (this.isDown(kb.moveRight)) mx += 1;
    if (this.isDown(kb.moveUp))    my -= 1;
    if (this.isDown(kb.moveDown))  my += 1;

    // Normalize diagonal
    if (mx !== 0 && my !== 0) {
      const mag = Math.sqrt(2) / 2;
      mx *= mag;
      my *= mag;
    }

    const attackDown = this.isDown(kb.attack);
    const dashDown   = this.isDown(kb.dash);
    const pauseDown  = this.isDown(kb.pause);

    // Mouse aim
    const cam = this.scene.cameras.main;
    const pointer = this.scene.input.activePointer;
    const wx = pointer.x + cam.scrollX;
    const wy = pointer.y + cam.scrollY;

    const px = this._state.aimX;
    const py = this._state.aimY;
    const aimAngle = Math.atan2(wy - py, wx - px);

    this._state = {
      moveX: mx,
      moveY: my,
      attack: attackDown,
      attackJustPressed: attackDown && !this.prevAttack,
      dash: dashDown,
      dashJustPressed: dashDown && !this.prevDash,
      pause: pauseDown,
      pauseJustPressed: pauseDown && !this.prevPause,
      aimX: wx,
      aimY: wy,
      aimAngle,
    };

    this.prevAttack = attackDown;
    this.prevDash   = dashDown;
    this.prevPause  = pauseDown;
  }

  /** Call after creating so the player position is known for angle calculation */
  setPlayerPosition(x: number, y: number): void {
    this._state.aimX = x;
    this._state.aimY = y;
  }

  get state(): ActionState {
    return this._state;
  }

  private isDown(keyName: string): boolean {
    const key = this.keys.get(keyName);
    return key ? key.isDown : false;
  }

  private emptyState(): ActionState {
    return {
      moveX: 0, moveY: 0,
      attack: false, attackJustPressed: false,
      dash: false, dashJustPressed: false,
      pause: false, pauseJustPressed: false,
      aimX: 640, aimY: 360, aimAngle: 0,
    };
  }

  /**
   * STEAM NOTE: Gamepad input integration point.
   * Implement this method to read from navigator.getGamepads() and
   * merge axis/button values into ActionState. The rest of the game
   * is already reading `state` which includes this merged output.
   */
  // updateGamepad(): void { ... }

  destroy(): void {
    if (this.scene.input.keyboard) {
      for (const key of this.keys.values()) {
        this.scene.input.keyboard.removeKey(key);
      }
    }
    this.keys.clear();
  }
}
