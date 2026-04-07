/**
 * InputManager3D.ts
 * Pure TypeScript keyboard + mouse input — no Phaser dependency.
 * Designed to be polled each frame by GameManager.
 * Mobile overrides are written by MobileControls.tsx via setMobile* methods.
 */

export interface InputState {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
  attack: boolean;
  dash: boolean;
  pause: boolean;
  mouseX: number;   // canvas coords (–1 to +1 NDC if needed)
  mouseY: number;
  worldAimX: number; // set externally by raycasting ground plane
  worldAimZ: number;
}

export class InputManager3D {
  private keys: Set<string> = new Set();
  private _attack = false;
  private _dash = false;
  private _pause = false;
  private _mouseX = 0;
  private _mouseY = 0;
  public worldAimX = 0;
  public worldAimZ = 0;

  private _attackConsumed = false;
  private _dashConsumed = false;
  private _pauseConsumed = false;

  // ── Mobile overrides ────────────────────────────────────────────────────
  private _mUp = false;
  private _mDown = false;
  private _mLeft = false;
  private _mRight = false;
  private _mAttack = false;

  constructor() {
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
    window.addEventListener("mousemove", this.onMouseMove);
    window.addEventListener("mousedown", this.onMouseDown);
    window.addEventListener("mouseup", this.onMouseUp);
  }

  private onKeyDown = (e: KeyboardEvent) => {
    this.keys.add(e.code);
    if (e.code === "Space") { this._attack = true; }
    if (e.code === "ShiftLeft" || e.code === "ShiftRight") { this._dash = true; }
    if (e.code === "Escape") { this._pause = true; }
  };

  private onKeyUp = (e: KeyboardEvent) => {
    this.keys.delete(e.code);
    if (e.code === "Space") { this._attackConsumed = false; }
    if (e.code === "ShiftLeft" || e.code === "ShiftRight") { this._dashConsumed = false; }
    if (e.code === "Escape") { this._pauseConsumed = false; }
  };

  private onMouseMove = (e: MouseEvent) => {
    this._mouseX = (e.clientX / window.innerWidth) * 2 - 1;
    this._mouseY = -(e.clientY / window.innerHeight) * 2 + 1;
  };

  private onMouseDown = (e: MouseEvent) => {
    if (e.button === 0) this._attack = true;
  };

  private onMouseUp = (e: MouseEvent) => {
    if (e.button === 0) this._attackConsumed = false;
  };

  // ── Mobile setters ──────────────────────────────────────────────────────

  setMobileMovement(up: boolean, down: boolean, left: boolean, right: boolean) {
    this._mUp = up; this._mDown = down;
    this._mLeft = left; this._mRight = right;
  }

  setMobileAim(mx: number, my: number) {
    this._mouseX = mx;
    this._mouseY = my;
  }

  setMobileAttack(on: boolean) {
    if (on) {
      this._mAttack = true;
      this._attackConsumed = false;
    } else {
      this._mAttack = false;
    }
  }

  triggerMobileDash() {
    this._dash = true;
    this._dashConsumed = false;
  }

  // ── State getter ────────────────────────────────────────────────────────

  get state(): InputState {
    const attack = (this._attack && !this._attackConsumed) || (this._mAttack && !this._attackConsumed);
    return {
      up:     this.keys.has("KeyW") || this.keys.has("ArrowUp")    || this._mUp,
      down:   this.keys.has("KeyS") || this.keys.has("ArrowDown")  || this._mDown,
      left:   this.keys.has("KeyA") || this.keys.has("ArrowLeft")  || this._mLeft,
      right:  this.keys.has("KeyD") || this.keys.has("ArrowRight") || this._mRight,
      attack,
      dash:   this._dash && !this._dashConsumed,
      pause:  this._pause && !this._pauseConsumed,
      mouseX: this._mouseX,
      mouseY: this._mouseY,
      worldAimX: this.worldAimX,
      worldAimZ: this.worldAimZ,
    };
  }

  consumeAttack() {
    this._attackConsumed = true;
    this._attack = false;
    this._mAttack = false;
  }
  consumeDash()   { this._dashConsumed = true;   this._dash = false; }
  consumePause()  { this._pauseConsumed = true;  this._pause = false; }

  destroy() {
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
    window.removeEventListener("mousemove", this.onMouseMove);
    window.removeEventListener("mousedown", this.onMouseDown);
    window.removeEventListener("mouseup", this.onMouseUp);
  }
}
