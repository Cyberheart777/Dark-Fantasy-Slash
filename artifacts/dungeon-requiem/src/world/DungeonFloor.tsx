/**
 * DungeonFloor.tsx
 *
 * Procedural ancient-dungeon stone floor for the MAIN game (not Labyrinth).
 * Replaces the old black-void/star-particle floor.
 *
 * Design:
 *   - A dark "grout" plane sits below everything as the visible gap color
 *     between tiles.
 *   - ~900 stone tiles (30x30 grid over a 60-unit arena) rendered with a
 *     single InstancedMesh. Each instance is slightly smaller than its grid
 *     cell so the grout shows through as a thin line. Per-instance color
 *     jitter gives the tiles the uneven stone look.
 *   - Rune etchings sit on top of ~1 in 8 tiles as a single LineSegments
 *     draw call — the whole runic pattern is one BufferGeometry so it's
 *     cheap on mobile. Positions and glyph choices are seeded, so they
 *     don't shimmer/change between frames or reloads.
 *
 * iOS-safe constraints:
 *   - MeshBasicMaterial for tiles + grout (no lighting dependency).
 *   - LineBasicMaterial for runes (no lighting dependency).
 *   - No external textures or image assets — tiles are flat-colored, runes
 *     are line geometry.
 *   - Two draw calls for the whole floor (tiles instanced, runes merged)
 *     plus one for the grout backdrop.
 */

import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { GAME_CONFIG } from "../data/GameConfig";

const H = GAME_CONFIG.ARENA_HALF;
const FULL = H * 2;

// Grid geometry
const TILE_PITCH = 2.0;                        // grid cell size in world units
const GROUT_GAP  = 0.09;                       // visible gap between tiles
const TILE_SIZE  = TILE_PITCH - GROUT_GAP;     // actual stone tile size

// Colors — picked to read as "deep charcoal dungeon" without competing with
// characters or enemies. Grout is slightly darker + slightly blue-shifted so
// the line between tiles reads as recessed shadow, not a lighter seam.
const GROUT_COLOR    = "#09070d";              // almost black, cold tint
const TILE_BASE_HEX  = "#1e1722";              // deep charcoal with faint violet
const RUNE_COLOR     = "#7a5ce0";              // dim arcane purple
const RUNE_OPACITY   = 0.38;                   // faint / worn
const COLOR_JITTER   = 0.10;                   // lightness variation per tile

// Rune density — ~1/8 tiles carry an etching.
const RUNE_FRAC      = 0.125;

// Default seed. The floor regenerates when this changes, and stays identical
// across frames for a given seed (no flickering).
const DEFAULT_SEED   = 0xD157DCB; // arbitrary

// Small pool of glyph templates. Each entry is a list of 2D line segments in
// normalized tile-local space (x/y in [-0.5, 0.5]). They're intentionally
// chunky and asymmetric so they feel "worn" rather than geometric.
type Seg = [number, number, number, number]; // x1, y1, x2, y2
const RUNE_GLYPHS: Seg[][] = [
  // Double pillar + bands
  [
    [-0.28, -0.40, -0.28,  0.40],
    [ 0.28, -0.40,  0.28,  0.40],
    [-0.28, -0.10,  0.28, -0.10],
    [-0.28,  0.18,  0.28,  0.18],
  ],
  // Angular slash
  [
    [-0.35, -0.35,  0.35,  0.35],
    [-0.15,  0.05,  0.15,  0.05],
    [-0.30,  0.30, -0.05,  0.30],
  ],
  // Hollow diamond
  [
    [ 0.00, -0.40,  0.40,  0.00],
    [ 0.40,  0.00,  0.00,  0.40],
    [ 0.00,  0.40, -0.40,  0.00],
    [-0.40,  0.00,  0.00, -0.40],
    [-0.18, -0.02,  0.18, -0.02],
  ],
  // Fork
  [
    [ 0.00, -0.40,  0.00,  0.40],
    [ 0.00, -0.05, -0.28, -0.25],
    [ 0.00, -0.05,  0.28, -0.25],
  ],
  // Arrow + bar
  [
    [-0.36,  0.00,  0.36,  0.00],
    [ 0.36,  0.00,  0.16,  0.18],
    [ 0.36,  0.00,  0.16, -0.18],
    [-0.08,  0.25,  0.08,  0.25],
  ],
];

/** mulberry32 — tiny deterministic PRNG. Same seed = same sequence. */
function mulberry32(seed: number): () => number {
  let s = seed >>> 0;
  return function () {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface PlanData {
  tileCount: number;
  tilePositions: Float32Array;  // [x, z, x, z, ...]
  tileColors: Float32Array;     // [r, g, b, r, g, b, ...]
  runeSegments: Float32Array;   // flat pairs of XYZ endpoints in world space
}

/** Build a deterministic floor plan from a seed. */
function buildPlan(seed: number): PlanData {
  const rng = mulberry32(seed);
  const nx = Math.ceil(FULL / TILE_PITCH);
  const nz = nx;
  const tileCount = nx * nz;
  const tilePositions = new Float32Array(tileCount * 2);
  const tileColors    = new Float32Array(tileCount * 3);
  const baseCol = new THREE.Color(TILE_BASE_HEX);
  const baseHSL = { h: 0, s: 0, l: 0 };
  baseCol.getHSL(baseHSL);

  // Collect rune line segments in a temp list; flatten once at the end.
  const segs: number[] = [];

  let i = 0;
  for (let ix = 0; ix < nx; ix++) {
    for (let iz = 0; iz < nz; iz++) {
      const x = -H + TILE_PITCH * (ix + 0.5);
      const z = -H + TILE_PITCH * (iz + 0.5);
      tilePositions[i * 2 + 0] = x;
      tilePositions[i * 2 + 1] = z;

      // Per-tile lightness jitter for uneven stone look.
      const jitter = (rng() - 0.5) * COLOR_JITTER;
      const l = Math.max(0.02, Math.min(0.25, baseHSL.l + jitter));
      const c = new THREE.Color().setHSL(baseHSL.h, baseHSL.s, l);
      tileColors[i * 3 + 0] = c.r;
      tileColors[i * 3 + 1] = c.g;
      tileColors[i * 3 + 2] = c.b;

      // Rune? Deterministic — same seed + grid position always decides the
      // same way. Skip border tiles so runes don't clip under walls.
      const isBorder = ix === 0 || iz === 0 || ix === nx - 1 || iz === nz - 1;
      if (!isBorder && rng() < RUNE_FRAC) {
        const glyph = RUNE_GLYPHS[Math.floor(rng() * RUNE_GLYPHS.length)];
        const rot = Math.floor(rng() * 4) * (Math.PI / 2);
        const cosR = Math.cos(rot);
        const sinR = Math.sin(rot);
        const scale = TILE_SIZE * 0.9;
        for (const [x1, y1, x2, y2] of glyph) {
          const lx1 = x1 * cosR - y1 * sinR;
          const ly1 = x1 * sinR + y1 * cosR;
          const lx2 = x2 * cosR - y2 * sinR;
          const ly2 = x2 * sinR + y2 * cosR;
          // Rune plane lives at Y = 0.022 (above tiles + grout)
          segs.push(x + lx1 * scale, 0.022, z + ly1 * scale);
          segs.push(x + lx2 * scale, 0.022, z + ly2 * scale);
        }
      }

      i++;
    }
  }

  return {
    tileCount,
    tilePositions,
    tileColors,
    runeSegments: new Float32Array(segs),
  };
}

export function DungeonFloor({ seed = DEFAULT_SEED }: { seed?: number }) {
  const plan = useMemo(() => buildPlan(seed), [seed]);

  const tileMeshRef = useRef<THREE.InstancedMesh>(null);

  // Populate instance matrices + colors once per plan.
  useEffect(() => {
    const mesh = tileMeshRef.current;
    if (!mesh) return;
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0));
    const s = new THREE.Vector3(TILE_SIZE, TILE_SIZE, 1);
    const p = new THREE.Vector3();
    const c = new THREE.Color();
    for (let i = 0; i < plan.tileCount; i++) {
      p.set(plan.tilePositions[i * 2 + 0], 0.012, plan.tilePositions[i * 2 + 1]);
      m.compose(p, q, s);
      mesh.setMatrixAt(i, m);
      c.setRGB(plan.tileColors[i * 3], plan.tileColors[i * 3 + 1], plan.tileColors[i * 3 + 2]);
      mesh.setColorAt(i, c);
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [plan]);

  // Runes: one merged LineSegments BufferGeometry for all glyphs on the floor.
  const runeGeom = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(plan.runeSegments, 3));
    return g;
  }, [plan]);

  return (
    <group>
      {/* Grout backdrop — slightly below tiles so the gap reads as recessed. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
        <planeGeometry args={[FULL + 1, FULL + 1, 1, 1]} />
        <meshBasicMaterial color={GROUT_COLOR} />
      </mesh>

      {/* Stone tiles — one draw call for ~900 instances. */}
      <instancedMesh
        ref={tileMeshRef}
        args={[undefined, undefined, plan.tileCount]}
      >
        <planeGeometry args={[1, 1, 1, 1]} />
        <meshBasicMaterial toneMapped={false} />
      </instancedMesh>

      {/* Rune etchings — one draw call as merged line segments. */}
      {plan.runeSegments.length > 0 && (
        <lineSegments geometry={runeGeom}>
          <lineBasicMaterial
            color={RUNE_COLOR}
            transparent
            opacity={RUNE_OPACITY}
            depthWrite={false}
            toneMapped={false}
          />
        </lineSegments>
      )}
    </group>
  );
}
