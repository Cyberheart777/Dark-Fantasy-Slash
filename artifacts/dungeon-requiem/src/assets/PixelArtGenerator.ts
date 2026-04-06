/**
 * PixelArtGenerator.ts  —  SNES-quality 32-bit pixel art generation
 *
 * Uses a programmatic SpriteBuilder approach instead of hand-typed string
 * arrays.  Each sprite is built from shape primitives with automatic
 * SNES-style shading (top-left lighting) and auto-outline detection.
 *
 * STEAM NOTE: Replace the canvas-generated textures with real spritesheet
 * PNGs loaded in PreloadScene.  The animation keys and frame dimensions are
 * defined at the bottom of this file and will continue to work unchanged.
 */

import Phaser from "phaser";

// ─── Colour helpers ───────────────────────────────────────────────────────────

const hex = (n: number) => `#${n.toString(16).padStart(6, "0")}`;

// ─── SpriteBuilder ────────────────────────────────────────────────────────────

type PixelGrid = (number | null)[][];

class SpriteBuilder {
  readonly w: number;
  readonly h: number;
  grid: PixelGrid;

  constructor(w: number, h: number) {
    this.w = w;
    this.h = h;
    this.grid = Array.from({ length: h }, () => new Array<number | null>(w).fill(null));
  }

  clone(): SpriteBuilder {
    const b = new SpriteBuilder(this.w, this.h);
    b.grid = this.grid.map(row => [...row]);
    return b;
  }

  px(x: number, y: number, color: number): this {
    if (x >= 0 && x < this.w && y >= 0 && y < this.h) this.grid[y][x] = color;
    return this;
  }

  rect(x: number, y: number, w: number, h: number, color: number): this {
    for (let py = y; py < y + h; py++)
      for (let px = x; px < x + w; px++)
        this.px(px, py, color);
    return this;
  }

  /**
   * Shaded ellipse.  colors[0]=darkest, colors[last]=brightest.
   * Light comes from the top-left quadrant.
   */
  ellipse(cx: number, cy: number, rx: number, ry: number, colors: number | number[]): this {
    const palette = Array.isArray(colors) ? colors : [colors];
    const n = palette.length;
    for (let py = Math.floor(cy - ry); py <= Math.ceil(cy + ry); py++) {
      for (let px = Math.floor(cx - rx); px <= Math.ceil(cx + rx); px++) {
        const dx = (px - cx) / rx;
        const dy = (py - cy) / ry;
        if (dx * dx + dy * dy > 1.0) continue;
        // light factor: 0=shadow side, 1=lit side
        const lit = Phaser.Math.Clamp((-dx * 0.45 + -dy * 0.55 + 0.5) * 1.6, 0, 1);
        const idx = Math.round(lit * (n - 1));
        this.px(px, py, palette[idx]);
      }
    }
    return this;
  }

  /** Horizontal gradient rect */
  gradientRect(x: number, y: number, w: number, h: number, left: number, right: number): this {
    for (let py = y; py < y + h; py++) {
      for (let px = x; px < x + w; px++) {
        const t = w > 1 ? (px - x) / (w - 1) : 0;
        const r = Math.round(((left >> 16) & 0xff) * (1 - t) + ((right >> 16) & 0xff) * t);
        const g = Math.round(((left >> 8) & 0xff) * (1 - t) + ((right >> 8) & 0xff) * t);
        const b = Math.round((left & 0xff) * (1 - t) + (right & 0xff) * t);
        this.px(px, py, (r << 16) | (g << 8) | b);
      }
    }
    return this;
  }

  /** Shade existing pixels lighter/darker above/below a horizontal line. */
  shadeBelow(y: number, dark: number): this {
    for (let py = y; py < this.h; py++)
      for (let px = 0; px < this.w; px++)
        if (this.grid[py][px] !== null) this.grid[py][px] = dark;
    return this;
  }

  /** Auto-outline: add dark border around all opaque pixels. */
  outline(color = 0x0A000F): this {
    const isFilled = (x: number, y: number) =>
      x >= 0 && x < this.w && y >= 0 && y < this.h && this.grid[y][x] !== null;

    const toAdd: [number, number][] = [];
    for (let py = 0; py < this.h; py++) {
      for (let px = 0; px < this.w; px++) {
        if (this.grid[py][px] !== null) continue;
        if (isFilled(px - 1, py) || isFilled(px + 1, py) ||
          isFilled(px, py - 1) || isFilled(px, py + 1)) {
          toAdd.push([px, py]);
        }
      }
    }
    for (const [px, py] of toAdd) this.px(px, py, color);
    return this;
  }

  /** Render to an HTML canvas (scale = pixels per game-pixel). */
  toCanvas(scale = 1): HTMLCanvasElement {
    const canvas = document.createElement("canvas");
    canvas.width = this.w * scale;
    canvas.height = this.h * scale;
    const ctx = canvas.getContext("2d")!;
    for (let py = 0; py < this.h; py++) {
      for (let px = 0; px < this.w; px++) {
        const c = this.grid[py][px];
        if (c === null) continue;
        ctx.fillStyle = hex(c);
        ctx.fillRect(px * scale, py * scale, scale, scale);
      }
    }
    return canvas;
  }
}

// ─── Palette constants ────────────────────────────────────────────────────────

// Player warrior
const PL = {
  outline:   0x080010,
  goldBrt:   0xFFEE88,
  goldMid:   0xDDAA00,
  goldDrk:   0x997700,
  goldDep:   0x664400,
  armBrt:    0xDDE8F5,
  armMid:    0x9AAABB,
  armDrk:    0x5577AA,
  armDep:    0x2A4466,
  lthBrt:    0xDDAA77,
  lthMid:    0xAA7744,
  lthDrk:    0x6A4422,
  boot:      0x3A2010,
  swordBrt:  0xF8FCFF,
  swordMid:  0xB8C0D0,
  swordDrk:  0x7888A0,
  beltDrk:   0x1A1030,
  eyeRed:    0xFF2800,
  specular:  0xFFFFFF,
  capeDrk:   0x7722AA,
  capeMid:   0xAA44CC,
};

// Scuttler (bone spider)
const SC = {
  outline:  0x050308,
  boneBrt:  0xF0EAD0,
  boneMid:  0xCCBB90,
  boneDrk:  0x9A8860,
  boneDep:  0x5A4830,
  eyeOr:    0xFF6600,
  clawBrt:  0xC8A870,
  clawDrk:  0x7A5830,
};

// Brute
const BR = {
  outline:  0x06000A,
  ironBrt:  0xC8D4D8,
  ironMid:  0x8898A8,
  ironDrk:  0x506070,
  ironDep:  0x243040,
  eyeOr:    0xFF8800,
  rusty:    0xAA4422,
  dkMetal:  0x1A2030,
  boot:     0x2A1A08,
};

// Wraith
const WR = {
  outline:  0x04000A,
  purpBrt:  0xCC88FF,
  purpMid:  0x8844CC,
  purpDrk:  0x4A1888,
  purpDep:  0x1E0044,
  eyeBrt:   0x44CCFF,
  eyeMid:   0x0088CC,
  wisps:    0xDDBBFF,
};

// Elite champion
const EL = {
  outline:  0x06000A,
  crimBrt:  0xFF4444,
  crimMid:  0xCC1111,
  crimDrk:  0x881111,
  crimDep:  0x440808,
  goldBrt:  0xFFEE66,
  goldMid:  0xDDAA00,
  goldDrk:  0x997700,
  silvBrt:  0xF0F4FF,
  silvMid:  0xAABBCC,
  eyeYel:   0xFFFF44,
  beltDrk:  0x1A0020,
};

// Boss — The Warden Reborn
const BO = {
  outline:  0x03000A,
  void:     0x0A000F,
  darkPurp: 0x220033,
  midPurp:  0x4C00AA,
  litPurp:  0xAA44FF,
  magenta:  0xFF00FF,
  eyeCore:  0xFF88FF,
  scythBrt: 0xCC88FF,
  scythMid: 0x8844AA,
  scythDrk: 0x440066,
  glowEdge: 0x7700CC,
};

// XP orb
const OR = {
  outline:  0x000088,
  coreBrt:  0xCCDDFF,
  coreMid:  0x7799FF,
  coreDrk:  0x3355EE,
  glow:     0x99AAFF,
};

// Floor / environment
const FL = {
  stoneDrk: 0x0E0A18,
  stoneMid: 0x181228,
  stoneLt:  0x241A38,
  grout:    0x080610,
  crackDrk: 0x060412,
  crakMid:  0x1A1230,
  wallDrk:  0x0C081A,
  wallMid:  0x201830,
  wallLt:   0x302848,
  wallEdge: 0x442255,
  flameHi:  0xFFEE44,
  flameMd:  0xFF8800,
  flameLo:  0xCC3300,
  torch:    0x8B4513,
};

// ─── Sprite builders ──────────────────────────────────────────────────────────

/** Build the reusable upper-body of the player warrior. Returns a cloneable base. */
function playerUpperBody(): SpriteBuilder {
  const b = new SpriteBuilder(32, 32);

  // Helmet — shaded gold dome
  b.ellipse(15, 8, 6.5, 5.5, [PL.goldDep, PL.goldDrk, PL.goldMid, PL.goldBrt, PL.specular]);
  // Specular dot
  b.px(12, 5, PL.specular);
  // Visor band
  b.rect(10, 10, 12, 3, PL.goldDrk);
  b.rect(11, 11, 10, 1, PL.goldDep);
  // Eyes in the visor
  b.px(12, 11, PL.eyeRed); b.px(13, 11, PL.eyeRed);
  b.px(17, 11, PL.eyeRed); b.px(18, 11, PL.eyeRed);
  // Chin guard
  b.ellipse(15, 14, 5, 2.5, [PL.goldDep, PL.goldDrk, PL.goldMid]);

  // Left pauldron
  b.ellipse(8, 17, 5, 3.5, [PL.armDep, PL.armDrk, PL.armMid, PL.armBrt]);
  // Right pauldron
  b.ellipse(23, 17, 5, 3.5, [PL.armDep, PL.armDrk, PL.armMid, PL.armBrt]);

  // Chest plate — main body
  b.ellipse(15, 20, 9, 6, [PL.armDep, PL.armDrk, PL.armMid, PL.armBrt, PL.specular]);
  // Chest centre line
  b.rect(14, 16, 3, 8, PL.armDrk);
  b.rect(15, 16, 1, 8, PL.armDep);

  // Belt
  b.rect(8, 26, 16, 3, PL.beltDrk);
  b.rect(9, 27, 14, 1, 0x2E1A44);
  // Belt buckle
  b.rect(13, 26, 6, 3, 0x2A1840);
  b.rect(14, 27, 4, 1, PL.goldDrk);

  return b;
}

/** Add a sword to the left side of a builder. */
function addSword(b: SpriteBuilder, swingOffset = 0): void {
  // Guard (crossguard)
  b.rect(3, 19 + swingOffset, 2, 5, PL.goldMid);
  // Blade — bright to dim
  for (let i = 0; i < 8; i++) {
    const bright = i < 2;
    b.px(4 + i, 21 + swingOffset, bright ? PL.swordBrt : PL.swordMid);
    b.px(4 + i, 22 + swingOffset, PL.swordDrk);
  }
  b.px(10, 21 + swingOffset, PL.swordBrt);
  b.px(11, 21 + swingOffset, PL.swordMid);
  b.px(12, 21 + swingOffset, PL.swordDrk);
  // Handle
  b.rect(1, 20 + swingOffset, 3, 4, PL.lthMid);
  b.rect(2, 20 + swingOffset, 1, 4, PL.lthBrt);
}

/** Add legs in walk position. rightFwd=true → right leg forward */
function addLegs(b: SpriteBuilder, rightFwd: boolean, bob = 0): void {
  // Thighs
  const lOffset = rightFwd ? -1 : 1;  // left leg offset
  const rOffset = rightFwd ? 1 : -1;

  // Left leg
  b.rect(9, 29 + lOffset + bob, 6, 3, PL.lthMid);
  b.rect(10, 30 + lOffset + bob, 4, 2, PL.lthBrt);
  // Left boot
  b.rect(8, 31 + lOffset + bob, 7, 2, PL.boot);
  b.rect(9, 32 + lOffset + bob, 5, 1, PL.lthDrk);

  // Right leg
  b.rect(17, 29 + rOffset + bob, 6, 3, PL.lthMid);
  b.rect(18, 30 + rOffset + bob, 4, 2, PL.lthBrt);
  // Right boot
  b.rect(16, 31 + rOffset + bob, 7, 2, PL.boot);
  b.rect(17, 32 + rOffset + bob, 5, 1, PL.lthDrk);
}

/** Full player walk frames */
function buildPlayerFrames(): HTMLCanvasElement[] {
  const results: HTMLCanvasElement[] = [];

  // Walk cycle (4 frames)
  const walkConfigs = [
    { rightFwd: true, bob: 0 },
    { rightFwd: true, bob: 1 },
    { rightFwd: false, bob: 0 },
    { rightFwd: false, bob: 1 },
  ];

  for (const cfg of walkConfigs) {
    const b = playerUpperBody();
    addSword(b);
    addLegs(b, cfg.rightFwd, cfg.bob);
    b.outline();
    results.push(b.toCanvas(1));
  }

  // Attack frames (3): windup → strike → follow-through
  const swings = [2, -2, -5];
  for (const sw of swings) {
    const b = playerUpperBody();
    addSword(b, sw);
    addLegs(b, true, 0);
    b.outline();
    results.push(b.toCanvas(1));
  }

  // Dash frame
  {
    const b = playerUpperBody();
    addSword(b, -3);
    addLegs(b, false, -1);
    // Cape effect — blur of trail
    b.rect(1, 17, 5, 10, PL.capeMid);
    b.rect(0, 18, 4, 8, PL.capeDrk);
    b.outline();
    results.push(b.toCanvas(1));
  }

  // Hit flash frame
  {
    const b = playerUpperBody();
    addSword(b);
    addLegs(b, true, 0);
    // Tint everything red
    for (let py = 0; py < b.h; py++)
      for (let px = 0; px < b.w; px++)
        if (b.grid[py][px] !== null) b.grid[py][px] = 0xFF4444;
    b.outline();
    results.push(b.toCanvas(1));
  }

  return results;
}

// ── Scuttler ─────────────────────────────────────────────────────────────────

function buildScuttlerFrame(phase: number): SpriteBuilder {
  const b = new SpriteBuilder(24, 20);

  // Body carapace
  b.ellipse(12, 9, 7, 5, [SC.boneDep, SC.boneDrk, SC.boneMid, SC.boneBrt]);
  // Head
  b.ellipse(12, 5, 4, 3.5, [SC.boneDrk, SC.boneMid, SC.boneBrt]);
  // Eyes
  b.px(10, 4, SC.eyeOr); b.px(11, 4, SC.eyeOr);
  b.px(13, 4, SC.eyeOr); b.px(14, 4, SC.eyeOr);

  // Mandibles
  b.px(9, 6, SC.clawDrk); b.px(8, 7, SC.clawDrk);
  b.px(15, 6, SC.clawDrk); b.px(16, 7, SC.clawDrk);

  // 6 legs, alternating with phase
  const legPhase = phase % 2;
  const legYBase = [6, 8, 10, 12];
  for (let i = 0; i < 4; i++) {
    const offset = (i + legPhase) % 2 === 0 ? 0 : 1;
    // Left legs
    b.px(12 - 6 - i, legYBase[i] + offset, SC.clawMid);
    b.px(12 - 7 - i, legYBase[i] + offset + 1, SC.clawDrk);
    // Right legs
    b.px(12 + 6 + i, legYBase[i] + offset, SC.clawMid);
    b.px(12 + 7 + i, legYBase[i] + offset + 1, SC.clawDrk);
  }

  // Tail/stinger
  b.px(12, 15, SC.boneMid);
  b.px(12, 16, SC.boneDrk);
  b.px(11, 17, SC.clawDrk);
  b.px(13, 17, SC.clawDrk);

  b.outline(SC.outline);
  return b;
}

// ── Brute ────────────────────────────────────────────────────────────────────

function buildBruteFrame(leftFwd: boolean): SpriteBuilder {
  const b = new SpriteBuilder(32, 36);

  // Helmet — big, rounded iron
  b.ellipse(16, 7, 9, 7, [BR.ironDep, BR.ironDrk, BR.ironMid, BR.ironBrt]);
  // Faceplate
  b.rect(10, 9, 12, 5, BR.dkMetal);
  b.rect(11, 10, 10, 1, 0x1E2830);
  // Eye slit
  b.rect(12, 10, 8, 1, BR.eyeOr);

  // Massive shoulders (pauldrons)
  b.ellipse(7, 16, 7, 5, [BR.ironDep, BR.ironDrk, BR.ironMid, BR.ironBrt]);
  b.ellipse(25, 16, 7, 5, [BR.ironDep, BR.ironDrk, BR.ironMid, BR.ironBrt]);

  // Chest
  b.ellipse(16, 21, 10, 8, [BR.ironDep, BR.ironDrk, BR.ironMid, BR.ironBrt]);
  b.rect(14, 15, 4, 10, BR.ironDrk);
  // Rusty damage marks
  b.px(18, 20, BR.rusty); b.px(19, 22, BR.rusty); b.px(14, 24, BR.rusty);

  // Gauntlets
  b.ellipse(6, 22, 5, 4, [BR.ironDep, BR.ironDrk, BR.ironMid]);
  b.ellipse(26, 22, 5, 4, [BR.ironDep, BR.ironDrk, BR.ironMid]);
  // Weapon (mace on right)
  b.rect(28, 24, 4, 8, BR.ironDrk);
  b.ellipse(30, 32, 4, 3, [BR.ironDep, BR.ironDrk, BR.ironMid]);

  // Belt
  b.rect(10, 29, 12, 3, BR.dkMetal);

  // Legs — thick and stumpy
  const lOff = leftFwd ? -1 : 1;
  const rOff = leftFwd ? 1 : -1;
  b.rect(10, 32 + lOff, 5, 4, BR.ironMid);
  b.rect(11, 35 + lOff, 4, 2, BR.boot);
  b.rect(17, 32 + rOff, 5, 4, BR.ironMid);
  b.rect(18, 35 + rOff, 4, 2, BR.boot);

  b.outline(BR.outline);
  return b;
}

// ── Wraith ───────────────────────────────────────────────────────────────────

function buildWraithFrame(phase: number): SpriteBuilder {
  const b = new SpriteBuilder(28, 36);

  // Floating offset based on phase (sinusoidal bob)
  const bob = [0, -1, -2, -1][phase];

  // Main body — wispy egg shape
  b.ellipse(14, 14 + bob, 9, 11, [WR.purpDep, WR.purpDrk, WR.purpMid, WR.purpBrt, WR.wisps]);

  // Hood/head
  b.ellipse(14, 8 + bob, 7, 6, [WR.purpDrk, WR.purpMid, WR.purpBrt, WR.wisps]);
  // Hollow eye sockets — deep dark
  b.ellipse(11, 8 + bob, 2.5, 2, [WR.purpDep]);
  b.ellipse(17, 8 + bob, 2.5, 2, [WR.purpDep]);
  // Glowing pupils
  b.px(11, 8 + bob, WR.eyeBrt);
  b.px(17, 8 + bob, WR.eyeBrt);
  b.px(11, 9 + bob, WR.eyeMid);
  b.px(17, 9 + bob, WR.eyeMid);

  // Wispy tendrils at the bottom (different per frame)
  const tendrilOffsets = [
    [[10, 25], [14, 27], [18, 26]],
    [[9, 26], [14, 28], [19, 25]],
    [[11, 24], [14, 27], [17, 26]],
    [[10, 26], [13, 28], [18, 25]],
  ];
  for (const [tx, ty] of tendrilOffsets[phase]) {
    for (let i = 0; i < 4; i++) {
      b.px(tx + Math.round(Math.sin(i * 0.8) * 1), ty + i + bob, i < 2 ? WR.purpMid : WR.purpDrk);
    }
  }

  // Arms — wispy strands
  b.px(5, 15 + bob, WR.purpMid);  b.px(4, 16 + bob, WR.purpDrk);
  b.px(23, 15 + bob, WR.purpMid); b.px(24, 16 + bob, WR.purpDrk);

  b.outline(WR.outline);
  return b;
}

// ── Elite Champion ────────────────────────────────────────────────────────────

function buildEliteFrame(rightFwd: boolean): SpriteBuilder {
  const b = new SpriteBuilder(32, 36);

  // Crimson helm with gold crest
  b.ellipse(16, 7, 7, 6, [EL.crimDep, EL.crimDrk, EL.crimMid, EL.crimBrt]);
  b.rect(10, 10, 12, 2, EL.goldDrk);
  b.rect(11, 10, 10, 1, EL.goldBrt);
  b.rect(12, 9, 8, 3, 0x660000);
  b.px(14, 10, EL.eyeYel); b.px(15, 10, EL.eyeYel);
  b.px(17, 10, EL.eyeYel); b.px(18, 10, EL.eyeYel);
  // Gold crest on top
  b.rect(14, 3, 4, 4, EL.goldMid);
  b.rect(15, 2, 2, 2, EL.goldBrt);

  // Pauldrons
  b.ellipse(8, 16, 6, 4, [EL.crimDep, EL.crimDrk, EL.crimMid]);
  b.ellipse(24, 16, 6, 4, [EL.crimDep, EL.crimDrk, EL.crimMid]);
  // Gold trim on pauldrons
  b.rect(4, 17, 8, 1, EL.goldDrk);
  b.rect(20, 17, 8, 1, EL.goldDrk);

  // Chest
  b.ellipse(16, 22, 9, 7, [EL.crimDep, EL.crimDrk, EL.crimMid, EL.crimBrt]);
  // Silver chest detail
  b.rect(12, 18, 8, 8, EL.silvMid);
  b.ellipse(16, 22, 5, 4, [EL.crimDep, EL.crimDrk, EL.crimMid]);
  // Gold chest trim
  b.rect(10, 22, 12, 1, EL.goldDrk);

  // Large sword — right side
  b.rect(22, 14, 3, 16, EL.silvMid);
  b.rect(23, 14, 1, 16, EL.silvBrt);
  b.rect(22, 30, 3, 2, EL.goldMid);
  b.ellipse(23, 32, 3, 2, [EL.silvMid, EL.silvBrt]);
  // Guard
  b.rect(19, 22, 9, 2, EL.goldMid);

  // Belt
  b.rect(10, 29, 12, 2, EL.beltDrk);

  // Legs
  const lOff = rightFwd ? 1 : -1;
  const rOff = rightFwd ? -1 : 1;
  b.rect(10, 31 + lOff, 5, 4, EL.crimDrk);
  b.rect(11, 34 + lOff, 4, 2, 0x1A0808);
  b.rect(17, 31 + rOff, 5, 4, EL.crimDrk);
  b.rect(18, 34 + rOff, 4, 2, 0x1A0808);

  b.outline(EL.outline);
  return b;
}

// ── Boss — The Warden Reborn ──────────────────────────────────────────────────

function buildBossFrame(phase: number): SpriteBuilder {
  const b = new SpriteBuilder(48, 52);

  const bob = [0, -1, -1, 0][phase];

  // Massive hooded body
  b.ellipse(24, 24 + bob, 16, 20, [BO.void, BO.darkPurp, BO.midPurp]);
  // Head/hood
  b.ellipse(24, 12 + bob, 13, 12, [BO.darkPurp, BO.midPurp, BO.litPurp]);
  // Crown of void spikes
  for (let i = -2; i <= 2; i++) {
    b.rect(24 + i * 4, 2 + bob, 2, 5 + Math.abs(i), BO.midPurp);
    b.px(24 + i * 4, 1 + bob, BO.litPurp);
  }

  // Hollow eye sockets
  b.ellipse(18, 12 + bob, 4, 3.5, [BO.void, BO.darkPurp]);
  b.ellipse(30, 12 + bob, 4, 3.5, [BO.void, BO.darkPurp]);
  // Blazing eyes
  b.px(17, 12 + bob, BO.magenta); b.px(18, 12 + bob, BO.magenta); b.px(19, 12 + bob, BO.magenta);
  b.px(17, 11 + bob, BO.eyeCore); b.px(18, 11 + bob, BO.eyeCore);
  b.px(29, 12 + bob, BO.magenta); b.px(30, 12 + bob, BO.magenta); b.px(31, 12 + bob, BO.magenta);
  b.px(30, 11 + bob, BO.eyeCore); b.px(31, 11 + bob, BO.eyeCore);

  // Scythe — left side
  // Handle
  b.rect(4, 18 + bob, 3, 24, BO.scythMid);
  b.rect(5, 18 + bob, 1, 24, BO.scythBrt);
  // Blade curve (approximate with rects)
  b.rect(2, 14 + bob, 6, 6, BO.scythDrk);
  b.rect(1, 16 + bob, 8, 4, BO.scythMid);
  b.px(1, 14 + bob, BO.scythBrt); b.px(2, 13 + bob, BO.scythBrt); b.px(3, 12 + bob, BO.scythBrt);
  // Phase-based scythe shimmer
  if (phase % 2 === 0) {
    b.px(2, 15 + bob, BO.eyeCore);
    b.px(3, 14 + bob, BO.eyeCore);
  }

  // Arms — sweeping out
  b.ellipse(10, 28 + bob, 6, 5, [BO.darkPurp, BO.midPurp]);
  b.ellipse(38, 28 + bob, 6, 5, [BO.darkPurp, BO.midPurp]);

  // Ghostly lower body
  for (let i = 0; i < 3; i++) {
    const tx = 16 + i * 6;
    const h = 6 + (i % 2) * 3;
    b.ellipse(tx, 44 + bob + (phase % 2) * i, 3, h * 0.7, [BO.void, BO.darkPurp, BO.midPurp]);
  }

  // Rune circle on chest
  b.px(24, 24 + bob, BO.magenta);
  for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 4) {
    b.px(
      Math.round(24 + Math.cos(angle) * 6),
      Math.round(24 + Math.sin(angle) * 4 + bob),
      BO.glowEdge
    );
  }

  b.outline(BO.outline);
  return b;
}

// ── XP Orb ───────────────────────────────────────────────────────────────────

function buildOrbFrame(phase: number): SpriteBuilder {
  const b = new SpriteBuilder(14, 14);
  // Glow ring
  b.ellipse(7, 7, 6.5, 6.5, [OR.coreDrk, OR.coreMid, OR.glow]);
  // Core
  b.ellipse(7, 7, 4, 4, [OR.coreMid, OR.coreBrt, OR.coreBrt]);
  // Rotating highlight
  const hx = Math.round(7 + Math.cos(phase * Math.PI / 2) * 2);
  const hy = Math.round(7 + Math.sin(phase * Math.PI / 2) * 2);
  b.px(hx, hy, 0xFFFFFF);
  b.outline(OR.outline);
  return b;
}

// ── Floor tiles ───────────────────────────────────────────────────────────────

function buildFloorTile(variant: number): HTMLCanvasElement {
  const b = new SpriteBuilder(32, 32);
  const base = variant === 1 ? FL.stoneLt : variant === 2 ? FL.stoneMid : FL.stoneDrk;

  // Stone fill
  b.rect(0, 0, 32, 32, base);

  // Grout lines
  b.rect(0, 0, 32, 1, FL.grout);  // top
  b.rect(0, 0, 1, 32, FL.grout);  // left
  b.rect(31, 0, 1, 32, FL.grout); // right
  b.rect(0, 31, 32, 1, FL.grout); // bottom

  // Inner bevels
  b.rect(1, 1, 30, 1, variant === 0 ? 0x181020 : 0x221830);
  b.rect(1, 1, 1, 30, variant === 0 ? 0x181020 : 0x221830);

  // Noise/texture details
  const noiseSeeds: [number, number, number][] = [
    [4, 4, 0], [8, 12, 1], [14, 7, 0], [20, 16, 1],
    [26, 5, 0], [6, 22, 1], [16, 26, 0], [28, 20, 1],
    [10, 18, 0], [22, 10, 1],
  ];
  for (const [nx, ny, type] of noiseSeeds) {
    const c = type === 0 ? FL.stoneDrk : FL.stoneLt;
    b.rect(nx, ny, 2, 1, c);
    b.rect(nx + 1, ny + 1, 1, 1, c);
  }

  if (variant === 2) {
    // Cracked tile — add crack lines
    for (let i = 0; i < 8; i++) {
      b.px(8 + i, 8 + Math.round(Math.sin(i * 0.8) * 2), FL.crackDrk);
    }
    for (let i = 0; i < 6; i++) {
      b.px(18 + i, 18 - i, FL.crackDrk);
      b.px(18 + i + 1, 18 - i, FL.crakMid);
    }
    // Blood stain
    b.ellipse(22, 22, 3, 2, [0x220000, 0x440000, 0x330000]);
  }

  return b.toCanvas(1);
}

// ── Wall tile ─────────────────────────────────────────────────────────────────

function buildWallTile(): HTMLCanvasElement {
  const b = new SpriteBuilder(32, 32);
  // Stone block pattern — two course rows
  b.rect(0, 0, 32, 32, FL.wallMid);
  // Mortar joints
  b.rect(0, 15, 32, 2, FL.wallDrk);
  b.rect(0, 0, 1, 15, FL.wallDrk);
  b.rect(15, 0, 2, 15, FL.wallDrk);
  b.rect(31, 0, 1, 15, FL.wallDrk);
  b.rect(8, 17, 1, 15, FL.wallDrk);
  b.rect(23, 17, 1, 15, FL.wallDrk);
  // Highlights (top-left of each stone)
  b.rect(2, 1, 12, 1, FL.wallLt);
  b.rect(17, 1, 13, 1, FL.wallLt);
  b.rect(1, 1, 1, 13, FL.wallLt);
  b.rect(9, 17, 13, 1, FL.wallLt);
  // Edge glow (magical dungeon feel)
  b.rect(0, 0, 32, 1, FL.wallEdge);
  b.rect(0, 31, 32, 1, FL.wallEdge);
  return b.toCanvas(1);
}

// ── Torch ─────────────────────────────────────────────────────────────────────

function buildTorchFrame(phase: number): SpriteBuilder {
  const b = new SpriteBuilder(12, 20);

  // Wall bracket
  b.rect(4, 12, 4, 8, FL.torch);
  b.rect(5, 11, 2, 2, 0x6B3410);
  // Flame — varies by phase
  const flameShapes = [
    [[3, 5, 6, 5], [4, 3, 4, 3], [5, 1, 2, 2]],
    [[2, 5, 8, 5], [3, 3, 6, 3], [4, 1, 4, 2], [5, 0, 2, 1]],
    [[3, 5, 6, 5], [4, 2, 4, 4], [5, 0, 2, 3]],
    [[2, 6, 8, 4], [3, 4, 6, 3], [4, 2, 4, 2], [5, 0, 2, 2]],
  ];
  for (const [fx, fy, fw, fh] of flameShapes[phase]) {
    const mid = fy < 3;
    b.rect(fx, fy, fw, fh, mid ? FL.flameHi : FL.flameMd);
  }
  // Tip is always white-yellow
  b.px(5, 0, 0xFFFFFF); b.px(6, 1, FL.flameHi);
  // Base of flame is red-orange
  b.rect(3, 8, 6, 3, FL.flameLo);

  b.outline(0x1A0000);
  return b;
}

// ─── Spritesheet assembly ─────────────────────────────────────────────────────

/** Assemble multiple sprite frames into a single horizontal spritesheet canvas. */
function assembleSheet(frames: Array<SpriteBuilder | HTMLCanvasElement>, frameW: number, frameH: number, scale = 1): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = frames.length * frameW * scale;
  canvas.height = frameH * scale;
  const ctx = canvas.getContext("2d")!;

  frames.forEach((frame, fi) => {
    let src: HTMLCanvasElement;
    if (frame instanceof SpriteBuilder) {
      src = frame.toCanvas(scale);
    } else {
      src = frame;
    }
    ctx.drawImage(src, fi * frameW * scale, 0);
  });

  return canvas;
}

/** Add a spritesheet canvas to Phaser with numbered animation frames. */
function addSheet(
  scene: Phaser.Scene, key: string,
  canvas: HTMLCanvasElement,
  frameCount: number, frameW: number, frameH: number,
): void {
  if (scene.textures.exists(key)) return;
  const tex = scene.textures.addCanvas(key, canvas)!;
  for (let i = 0; i < frameCount; i++) {
    tex.add(i, 0, i * frameW, 0, frameW, frameH);
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/** Generate all textures and register with Phaser. Call from PreloadScene. */
export function generateAllTextures(scene: Phaser.Scene): void {
  // ── Player ───────────────────────────────────────────────
  {
    const frames = buildPlayerFrames();
    const W = 32, H = 32, SCALE = 2;
    const sheet = assembleSheet(frames, W, H, SCALE);
    addSheet(scene, "player_sheet", sheet, frames.length, W * SCALE, H * SCALE);
  }

  // ── Scuttler (4 walk frames) ─────────────────────────────
  {
    const W = 24, H = 20, SCALE = 2;
    const frames = [0, 1, 2, 3].map(p => buildScuttlerFrame(p));
    const sheet = assembleSheet(frames, W, H, SCALE);
    addSheet(scene, "scuttler_sheet", sheet, 4, W * SCALE, H * SCALE);
  }

  // ── Brute (2 walk frames) ────────────────────────────────
  {
    const W = 32, H = 36, SCALE = 2;
    const frames = [false, true].map(v => buildBruteFrame(v));
    const sheet = assembleSheet(frames, W, H, SCALE);
    addSheet(scene, "brute_sheet", sheet, 2, W * SCALE, H * SCALE);
  }

  // ── Wraith (4 float frames) ──────────────────────────────
  {
    const W = 28, H = 36, SCALE = 2;
    const frames = [0, 1, 2, 3].map(p => buildWraithFrame(p));
    const sheet = assembleSheet(frames, W, H, SCALE);
    addSheet(scene, "wraith_sheet", sheet, 4, W * SCALE, H * SCALE);
  }

  // ── Elite (2 walk frames) ────────────────────────────────
  {
    const W = 32, H = 36, SCALE = 2;
    const frames = [false, true].map(v => buildEliteFrame(v));
    const sheet = assembleSheet(frames, W, H, SCALE);
    addSheet(scene, "elite_sheet", sheet, 2, W * SCALE, H * SCALE);
  }

  // ── Boss (4 idle/float frames) ───────────────────────────
  {
    const W = 48, H = 52, SCALE = 2;
    const frames = [0, 1, 2, 3].map(p => buildBossFrame(p));
    const sheet = assembleSheet(frames, W, H, SCALE);
    addSheet(scene, "boss_sheet", sheet, 4, W * SCALE, H * SCALE);
  }

  // ── XP Orb (4 spin frames) ──────────────────────────────
  {
    const W = 14, H = 14, SCALE = 2;
    const frames = [0, 1, 2, 3].map(p => buildOrbFrame(p));
    const sheet = assembleSheet(frames, W, H, SCALE);
    addSheet(scene, "orb_sheet", sheet, 4, W * SCALE, H * SCALE);
  }

  // ── Torch (4 flicker frames) ─────────────────────────────
  {
    const W = 12, H = 20, SCALE = 2;
    const frames = [0, 1, 2, 3].map(p => buildTorchFrame(p));
    const sheet = assembleSheet(frames, W, H, SCALE);
    addSheet(scene, "torch_sheet", sheet, 4, W * SCALE, H * SCALE);
  }

  // ── Floor tiles (3 variants, static) ────────────────────
  for (let i = 0; i < 3; i++) {
    if (!scene.textures.exists(`floor_tile_${i}`)) {
      scene.textures.addCanvas(`floor_tile_${i}`, buildFloorTile(i));
    }
  }

  // ── Wall tile (static) ───────────────────────────────────
  if (!scene.textures.exists("wall_tile")) {
    scene.textures.addCanvas("wall_tile", buildWallTile());
  }
}

/** Register all Phaser animation configs. Call after generateAllTextures. */
export function registerAnimations(scene: Phaser.Scene): void {
  const anims = scene.anims;

  if (!anims.exists("player_walk")) {
    anims.create({ key: "player_walk",   frames: anims.generateFrameNumbers("player_sheet", { start: 0, end: 3 }), frameRate: 8, repeat: -1 });
    anims.create({ key: "player_attack", frames: anims.generateFrameNumbers("player_sheet", { start: 4, end: 6 }), frameRate: 14, repeat: 0 });
    anims.create({ key: "player_dash",   frames: anims.generateFrameNumbers("player_sheet", { start: 7, end: 7 }), frameRate: 1, repeat: 0 });
    anims.create({ key: "player_hit",    frames: anims.generateFrameNumbers("player_sheet", { start: 8, end: 8 }), frameRate: 1, repeat: 0 });
    anims.create({ key: "player_idle",   frames: anims.generateFrameNumbers("player_sheet", { start: 0, end: 1 }), frameRate: 2, repeat: -1 });
  }

  if (!anims.exists("scuttler_walk")) {
    anims.create({ key: "scuttler_walk", frames: anims.generateFrameNumbers("scuttler_sheet", { start: 0, end: 3 }), frameRate: 10, repeat: -1 });
  }
  if (!anims.exists("brute_walk")) {
    anims.create({ key: "brute_walk", frames: anims.generateFrameNumbers("brute_sheet", { start: 0, end: 1 }), frameRate: 3, repeat: -1 });
  }
  if (!anims.exists("wraith_walk")) {
    anims.create({ key: "wraith_walk", frames: anims.generateFrameNumbers("wraith_sheet", { start: 0, end: 3 }), frameRate: 5, repeat: -1 });
  }
  if (!anims.exists("elite_walk")) {
    anims.create({ key: "elite_walk", frames: anims.generateFrameNumbers("elite_sheet", { start: 0, end: 1 }), frameRate: 4, repeat: -1 });
  }
  if (!anims.exists("boss_idle")) {
    anims.create({ key: "boss_idle", frames: anims.generateFrameNumbers("boss_sheet", { start: 0, end: 3 }), frameRate: 4, repeat: -1 });
  }
  if (!anims.exists("orb_spin")) {
    anims.create({ key: "orb_spin", frames: anims.generateFrameNumbers("orb_sheet", { start: 0, end: 3 }), frameRate: 8, repeat: -1 });
  }
  if (!anims.exists("torch_flicker")) {
    anims.create({ key: "torch_flicker", frames: anims.generateFrameNumbers("torch_sheet", { start: 0, end: 3 }), frameRate: 8, repeat: -1 });
  }
}

/** Sprite display info per enemy type */
export const ENEMY_SPRITE_INFO: Record<string, {
  sheet: string;
  frameW: number;
  frameH: number;
  anim: string;
  scale: number;
}> = {
  scuttler: { sheet: "scuttler_sheet", frameW: 48,  frameH: 40,  anim: "scuttler_walk", scale: 1.0 },
  brute:    { sheet: "brute_sheet",    frameW: 64,  frameH: 72,  anim: "brute_walk",    scale: 1.0 },
  wraith:   { sheet: "wraith_sheet",   frameW: 56,  frameH: 72,  anim: "wraith_walk",   scale: 1.0 },
  elite:    { sheet: "elite_sheet",    frameW: 64,  frameH: 72,  anim: "elite_walk",    scale: 1.0 },
  boss:     { sheet: "boss_sheet",     frameW: 96,  frameH: 104, anim: "boss_idle",     scale: 1.2 },
};
