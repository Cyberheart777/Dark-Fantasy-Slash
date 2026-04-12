/**
 * DungeonRoom.tsx
 * The dungeon environment: floor, walls, pillars, ceiling details.
 *
 * PBR TEXTURE SUPPORT:
 * Drop texture files into public/textures/ and they'll be used automatically:
 *   Floor: floor_albedo.png, floor_normal.png, floor_roughness.png
 *   Wall:  wall_albedo.png,  wall_normal.png,  wall_roughness.png
 *
 * If any texture is missing, the procedural canvas fallback is used instead.
 * Textures should be seamless/tileable, ideally 1024x1024 or 2048x2048.
 */

import { useMemo, useState, useEffect } from "react";
import * as THREE from "three";
import { GAME_CONFIG } from "../data/GameConfig";

const H = GAME_CONFIG.ARENA_HALF;
const W = GAME_CONFIG.WALL_THICKNESS;
const WH = GAME_CONFIG.WALL_HEIGHT;
const FULL = H * 2;

// Stone colors — used as tint on procedural textures
const FLOOR_COLOR = "#4a3860";
const WALL_COLOR = "#3a2c50";
const PILLAR_COLOR = "#42305a";
const ACCENT_COLOR = "#6a4888";

// ─── Texture loading helper ──────────────────────────────────────────────────

/** Try to load a texture from public/textures/. Returns null if not found. */
function tryLoadTexture(
  filename: string,
  repeatX: number,
  repeatY: number,
): THREE.Texture | null {
  const loader = new THREE.TextureLoader();
  try {
    const tex = loader.load(
      `/textures/${filename}`,
      (t) => {
        t.wrapS = t.wrapT = THREE.RepeatWrapping;
        t.repeat.set(repeatX, repeatY);
        t.needsUpdate = true;
      },
      undefined,
      () => { /* silently fail — fallback will be used */ },
    );
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(repeatX, repeatY);
    return tex;
  } catch {
    return null;
  }
}

/**
 * Hook: attempt to load a PBR texture set (albedo + normal + roughness).
 * Falls back to procedural textures if external files aren't found.
 * Uses an image probe to check existence before loading.
 */
function usePBRTextures(
  prefix: string,
  repeatX: number,
  repeatY: number,
  proceduralAlbedo: THREE.Texture,
  proceduralNormal: THREE.Texture,
) {
  const [textures, setTextures] = useState<{
    albedo: THREE.Texture;
    normal: THREE.Texture;
    roughness: THREE.Texture | null;
    isExternal: boolean;
  }>({
    albedo: proceduralAlbedo,
    normal: proceduralNormal,
    roughness: null,
    isExternal: false,
  });

  useEffect(() => {
    // Probe if the albedo file exists by trying to load it as an image
    const img = new Image();
    img.onload = () => {
      // Albedo exists — load full PBR set
      const loader = new THREE.TextureLoader();
      const configure = (t: THREE.Texture) => {
        t.wrapS = t.wrapT = THREE.RepeatWrapping;
        t.repeat.set(repeatX, repeatY);
        t.colorSpace = THREE.SRGBColorSpace;
      };
      const configureLinear = (t: THREE.Texture) => {
        t.wrapS = t.wrapT = THREE.RepeatWrapping;
        t.repeat.set(repeatX, repeatY);
        t.colorSpace = THREE.LinearSRGBColorSpace;
      };

      const albedo = loader.load(`/textures/${prefix}_albedo.png`, configure);
      configure(albedo);
      const normal = loader.load(`/textures/${prefix}_normal.png`, configureLinear);
      configureLinear(normal);
      const roughness = loader.load(
        `/textures/${prefix}_roughness.png`,
        configureLinear,
        undefined,
        () => { /* roughness is optional */ },
      );
      configureLinear(roughness);

      setTextures({ albedo, normal, roughness, isExternal: true });
    };
    img.onerror = () => {
      // No external textures — keep procedural fallbacks (already set)
    };
    img.src = `/textures/${prefix}_albedo.png`;
  }, [prefix, repeatX, repeatY, proceduralAlbedo, proceduralNormal]);

  return textures;
}

// ─── Procedural texture generators (fallbacks) ──────────────────────────────

/** Generate a canvas-based normal map matching a tile grid pattern. */
function generateNormalMap(size: number, tileW: number, tileH: number, groutWidth: number, herringbone: boolean): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;

  // Neutral normal (pointing straight up in tangent space = #8080ff)
  ctx.fillStyle = "#8080ff";
  ctx.fillRect(0, 0, size, size);

  // Grout crevices: slightly tilted normals to create depth
  for (let row = 0; row < size / tileH; row++) {
    for (let col = 0; col < size / tileW; col++) {
      const offset = herringbone && row % 2 === 0 ? 0 : tileW / 2;
      const x = col * tileW + offset;
      const y = row * tileH;
      ctx.fillStyle = "#8060e0";
      ctx.fillRect(x, y, tileW, groutWidth);
      ctx.fillStyle = "#6080e0";
      ctx.fillRect(x, y, groutWidth, tileH);
    }
  }

  // Random surface bumps
  for (let i = 0; i < 1500; i++) {
    const px = Math.random() * size;
    const py = Math.random() * size;
    const r = 1 + Math.random() * 2;
    const nr = Math.floor(118 + Math.random() * 20);
    const ng = Math.floor(118 + Math.random() * 20);
    ctx.fillStyle = `rgb(${nr},${ng},255)`;
    ctx.beginPath();
    ctx.arc(px, py, r, 0, Math.PI * 2);
    ctx.fill();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

function generateFloorTexture(): THREE.CanvasTexture {
  const size = 512;
  const tileW = 64, tileH = 64;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;

  ctx.fillStyle = "#5a4470";
  ctx.fillRect(0, 0, size, size);

  for (let row = 0; row < size / tileH; row++) {
    for (let col = 0; col < size / tileW; col++) {
      const offset = row % 2 === 0 ? 0 : tileW / 2;
      const x = col * tileW + offset;
      const y = row * tileH;
      const brightness = 0.85 + Math.random() * 0.15;
      const r = Math.floor(80 * brightness);
      const g = Math.floor(62 * brightness);
      const b = Math.floor(100 * brightness);
      ctx.fillStyle = `rgb(${r},${g},${b})`;
      ctx.fillRect(x + 2, y + 2, tileW - 4, tileH - 4);
      ctx.fillStyle = "#150f1a";
      ctx.fillRect(x, y, tileW, 2);
      ctx.fillRect(x, y, 2, tileH);
    }
  }
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
}

// ─── Floor ──────────────────────────────────────────────────────────────────

function FloorTile() {
  const { proceduralAlbedo, proceduralNormal } = useMemo(() => {
    const albedo = generateFloorTexture();
    const normal = generateNormalMap(512, 64, 64, 2, true);
    normal.repeat.set(8, 8);
    return { proceduralAlbedo: albedo, proceduralNormal: normal };
  }, []);

  const pbr = usePBRTextures("floor", 8, 8, proceduralAlbedo, proceduralNormal);

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
      <planeGeometry args={[FULL, FULL, 1, 1]} />
      <meshStandardMaterial
        map={pbr.albedo}
        normalMap={pbr.normal}
        normalScale={new THREE.Vector2(0.6, 0.6)}
        roughnessMap={pbr.roughness ?? undefined}
        color={pbr.isExternal ? "#ffffff" : FLOOR_COLOR}
        roughness={pbr.roughness ? 1.0 : 0.9}
        metalness={0.0}
      />
    </mesh>
  );
}

// ─── Walls ──────────────────────────────────────────────────────────────────

function Walls() {
  const { proceduralNormal } = useMemo(() => {
    const normal = generateNormalMap(512, 128, 64, 3, false);
    normal.repeat.set(4, 2);
    return { proceduralNormal: normal };
  }, []);

  // Create a simple dark procedural wall albedo
  const proceduralAlbedo = useMemo(() => {
    const size = 512;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#3a2c50";
    ctx.fillRect(0, 0, size, size);
    // Stone block variation
    for (let row = 0; row < size / 64; row++) {
      for (let col = 0; col < size / 128; col++) {
        const brightness = 0.88 + Math.random() * 0.12;
        const r = Math.floor(58 * brightness);
        const g = Math.floor(44 * brightness);
        const b = Math.floor(80 * brightness);
        ctx.fillStyle = `rgb(${r},${g},${b})`;
        ctx.fillRect(col * 128 + 2, row * 64 + 2, 124, 60);
      }
    }
    // Grout
    for (let row = 0; row <= size / 64; row++) {
      ctx.fillStyle = "#1a1020";
      ctx.fillRect(0, row * 64, size, 3);
    }
    for (let col = 0; col <= size / 128; col++) {
      ctx.fillStyle = "#1a1020";
      ctx.fillRect(col * 128, 0, 3, size);
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(4, 2);
    return tex;
  }, []);

  const pbr = usePBRTextures("wall", 4, 2, proceduralAlbedo, proceduralNormal);
  const wallColor = pbr.isExternal ? "#ffffff" : WALL_COLOR;
  const wallRoughness = pbr.roughness ? 1.0 : 0.95;
  const ns = new THREE.Vector2(0.8, 0.8);

  return (
    <group>
      {/* North wall */}
      <mesh position={[0, WH / 2, -H - W / 2]} receiveShadow castShadow>
        <boxGeometry args={[FULL + W * 2, WH, W]} />
        <meshStandardMaterial map={pbr.albedo} color={wallColor} roughness={wallRoughness} roughnessMap={pbr.roughness ?? undefined} normalMap={pbr.normal} normalScale={ns} />
      </mesh>
      {/* South wall — semi-transparent */}
      <mesh position={[0, WH / 2, H + W / 2]} receiveShadow>
        <boxGeometry args={[FULL + W * 2, WH, W]} />
        <meshStandardMaterial
          map={pbr.albedo}
          color={wallColor}
          roughness={wallRoughness}
          roughnessMap={pbr.roughness ?? undefined}
          transparent
          opacity={0.35}
          side={THREE.DoubleSide}
          normalMap={pbr.normal}
          normalScale={ns}
        />
      </mesh>
      {/* West wall */}
      <mesh position={[-H - W / 2, WH / 2, 0]} receiveShadow castShadow>
        <boxGeometry args={[W, WH, FULL]} />
        <meshStandardMaterial map={pbr.albedo} color={wallColor} roughness={wallRoughness} roughnessMap={pbr.roughness ?? undefined} normalMap={pbr.normal} normalScale={ns} />
      </mesh>
      {/* East wall */}
      <mesh position={[H + W / 2, WH / 2, 0]} receiveShadow castShadow>
        <boxGeometry args={[W, WH, FULL]} />
        <meshStandardMaterial map={pbr.albedo} color={wallColor} roughness={wallRoughness} roughnessMap={pbr.roughness ?? undefined} normalMap={pbr.normal} normalScale={ns} />
      </mesh>

      {/* Wall top trim */}
      {[
        [0, WH, -H - W / 2, FULL + W * 2, 0.4, W * 1.2, false] as const,
        [0, WH, H + W / 2, FULL + W * 2, 0.4, W * 1.2, true] as const,
        [-H - W / 2, WH, 0, W * 1.2, 0.4, FULL, false] as const,
        [H + W / 2, WH, 0, W * 1.2, 0.4, FULL, false] as const,
      ].map(([x, y, z, w, h, d, isSouth], i) => (
        <mesh key={i} position={[x, y, z]} castShadow={!isSouth}>
          <boxGeometry args={[w, h, d]} />
          <meshStandardMaterial
            color={ACCENT_COLOR}
            roughness={0.8}
            metalness={0.1}
            transparent={isSouth || undefined}
            opacity={isSouth ? 0.35 : 1}
            side={isSouth ? THREE.DoubleSide : THREE.FrontSide}
          />
        </mesh>
      ))}
    </group>
  );
}

// ─── Pillars ────────────────────────────────────────────────────────────────

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
  const positions: [number, number][] = [
    [-(H - 5), -(H - 5)],
    [-(H - 5),  (H - 5)],
    [ (H - 5), -(H - 5)],
    [ (H - 5),  (H - 5)],
    [-(H - 5), -12], [-(H - 5), 12],
    [ (H - 5), -12], [ (H - 5), 12],
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

// ─── Arena border glow ──────────────────────────────────────────────────────

function ArenaBorderGlow() {
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

// ─── Export ──────────────────────────────────────────────────────────────────

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
