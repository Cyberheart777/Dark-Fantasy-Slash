/**
 * DungeonRoom.tsx
 * The dungeon environment: floor, walls, pillars, ceiling details.
 * All procedural geometry — no external assets.
 */

import { useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { GAME_CONFIG } from "../data/GameConfig";

const H = GAME_CONFIG.ARENA_HALF;
const W = GAME_CONFIG.WALL_THICKNESS;
const WH = GAME_CONFIG.WALL_HEIGHT;
const FULL = H * 2;

// Stone colors — bright enough to catch the dungeon lighting
const FLOOR_COLOR = "#4a3860";
const WALL_COLOR = "#3a2c50";
const PILLAR_COLOR = "#42305a";
const ACCENT_COLOR = "#6a4888";

function FloorTile() {
  // Procedural stone texture via canvas
  const texture = useMemo(() => {
    const size = 512;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d")!;

    // Base stone color
    ctx.fillStyle = "#5a4470";
    ctx.fillRect(0, 0, size, size);

    // Draw tile grid
    const tileW = 64, tileH = 64;
    for (let row = 0; row < size / tileH; row++) {
      for (let col = 0; col < size / tileW; col++) {
        const offset = row % 2 === 0 ? 0 : tileW / 2;
        const x = col * tileW + offset;
        const y = row * tileH;
        // Slight random variation
        const brightness = 0.85 + Math.random() * 0.15;
        const r = Math.floor(80 * brightness);
        const g = Math.floor(62 * brightness);
        const b = Math.floor(100 * brightness);
        ctx.fillStyle = `rgb(${r},${g},${b})`;
        ctx.fillRect(x + 2, y + 2, tileW - 4, tileH - 4);
        // Grout lines
        ctx.fillStyle = "#150f1a";
        ctx.fillRect(x, y, tileW, 2);
        ctx.fillRect(x, y, 2, tileH);
      }
    }
    // Add noise
    for (let i = 0; i < 3000; i++) {
      const px = Math.random() * size;
      const py = Math.random() * size;
      const alpha = Math.random() * 0.15;
      ctx.fillStyle = `rgba(0,0,0,${alpha})`;
      ctx.fillRect(px, py, 2, 2);
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(8, 8);
    return tex;
  }, []);

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
      <planeGeometry args={[FULL, FULL, 1, 1]} />
      <meshStandardMaterial
        map={texture}
        color={FLOOR_COLOR}
        roughness={0.9}
        metalness={0.0}
      />
    </mesh>
  );
}

function Walls() {
  return (
    <group>
      {/* North wall */}
      <mesh position={[0, WH / 2, -H - W / 2]} receiveShadow castShadow>
        <boxGeometry args={[FULL + W * 2, WH, W]} />
        <meshStandardMaterial color={WALL_COLOR} roughness={0.95} />
      </mesh>
      {/* South wall */}
      <mesh position={[0, WH / 2, H + W / 2]} receiveShadow castShadow>
        <boxGeometry args={[FULL + W * 2, WH, W]} />
        <meshStandardMaterial color={WALL_COLOR} roughness={0.95} />
      </mesh>
      {/* West wall */}
      <mesh position={[-H - W / 2, WH / 2, 0]} receiveShadow castShadow>
        <boxGeometry args={[W, WH, FULL]} />
        <meshStandardMaterial color={WALL_COLOR} roughness={0.95} />
      </mesh>
      {/* East wall */}
      <mesh position={[H + W / 2, WH / 2, 0]} receiveShadow castShadow>
        <boxGeometry args={[W, WH, FULL]} />
        <meshStandardMaterial color={WALL_COLOR} roughness={0.95} />
      </mesh>

      {/* Wall top trim */}
      {[
        [0, WH, -H - W / 2, FULL + W * 2, 0.4, W * 1.2] as const,
        [0, WH, H + W / 2, FULL + W * 2, 0.4, W * 1.2] as const,
        [-H - W / 2, WH, 0, W * 1.2, 0.4, FULL] as const,
        [H + W / 2, WH, 0, W * 1.2, 0.4, FULL] as const,
      ].map(([x, y, z, w, h, d], i) => (
        <mesh key={i} position={[x, y, z]} castShadow>
          <boxGeometry args={[w, h, d]} />
          <meshStandardMaterial color={ACCENT_COLOR} roughness={0.8} metalness={0.1} />
        </mesh>
      ))}
    </group>
  );
}

function Pillar({ x, z }: { x: number; z: number }) {
  return (
    <group position={[x, 0, z]}>
      {/* Base */}
      <mesh position={[0, 0.3, 0]} castShadow receiveShadow>
        <boxGeometry args={[1.2, 0.6, 1.2]} />
        <meshStandardMaterial color={PILLAR_COLOR} roughness={0.9} />
      </mesh>
      {/* Column */}
      <mesh position={[0, WH / 2, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.4, 0.45, WH - 0.8, 8]} />
        <meshStandardMaterial color={PILLAR_COLOR} roughness={0.9} />
      </mesh>
      {/* Capital */}
      <mesh position={[0, WH - 0.2, 0]} castShadow>
        <boxGeometry args={[1.0, 0.4, 1.0]} />
        <meshStandardMaterial color={ACCENT_COLOR} roughness={0.8} metalness={0.1} />
      </mesh>
    </group>
  );
}

function Pillars() {
  // Place pillars ONLY near the corners and mid-walls — never in center combat zone
  const positions: [number, number][] = [
    // Four corners
    [-(H - 5), -(H - 5)],
    [-(H - 5),  (H - 5)],
    [ (H - 5), -(H - 5)],
    [ (H - 5),  (H - 5)],
    // Mid-wall pairs (east/west)
    [-(H - 5), -12], [-(H - 5), 12],
    [ (H - 5), -12], [ (H - 5), 12],
    // Mid-wall pairs (north/south)
    [-12, -(H - 5)], [12, -(H - 5)],
    [-12,  (H - 5)], [12,  (H - 5)],
  ];

  return (
    <group>
      {positions.map(([x, z], i) => (
        <Pillar key={i} x={x} z={z} />
      ))}
    </group>
  );
}

function ArenaBorderGlow() {
  // Subtle glowing trim at base of walls
  return (
    <>
      {[
        [0, 0.05, -H, FULL, 0.1, 0.1] as const,
        [0, 0.05, H, FULL, 0.1, 0.1] as const,
        [-H, 0.05, 0, 0.1, 0.1, FULL] as const,
        [H, 0.05, 0, 0.1, 0.1, FULL] as const,
      ].map(([x, y, z, w, h, d], i) => (
        <mesh key={i} position={[x, y, z]}>
          <boxGeometry args={[w, h, d]} />
          <meshStandardMaterial
            color="#6a00aa"
            emissive="#4a0080"
            emissiveIntensity={0.6}
            roughness={0.5}
          />
        </mesh>
      ))}
    </>
  );
}

export function DungeonRoom() {
  return (
    <group>
      <FloorTile />
      <Walls />
      <Pillars />
      <ArenaBorderGlow />
    </group>
  );
}
