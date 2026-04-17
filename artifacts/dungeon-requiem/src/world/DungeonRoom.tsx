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
import { DungeonFloor } from "./DungeonFloor";

const H = GAME_CONFIG.ARENA_HALF;
const W = GAME_CONFIG.WALL_THICKNESS;
const WH = GAME_CONFIG.WALL_HEIGHT;
const FULL = H * 2;

// Stone colors — used as tint on procedural textures
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

// Floor rendering moved to DungeonFloor.tsx — see <DungeonFloor /> below. The
// floor is now procedural geometry (instanced stone tiles + merged rune
// line-segments) instead of a single MeshStandardMaterial plane with a
// canvas-based PBR texture. Kept the wall-side PBR helpers (generateNormalMap
// + usePBRTextures) since Walls still uses them.


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

      {/* Base trim — dark stone baseboard at floor level */}
      {[
        [0, 0.25, -H - W / 2 + 0.1, FULL + W * 2, 0.5, 0.3, false] as const,
        [0, 0.25, H + W / 2 - 0.1, FULL + W * 2, 0.5, 0.3, true] as const,
        [-H - W / 2 + 0.1, 0.25, 0, 0.3, 0.5, FULL, false] as const,
        [H + W / 2 - 0.1, 0.25, 0, 0.3, 0.5, FULL, false] as const,
      ].map(([x, y, z, w, h, d, isSouth], i) => (
        <mesh key={`base_${i}`} position={[x, y, z]}>
          <boxGeometry args={[w, h, d]} />
          <meshStandardMaterial
            color="#1e1430"
            roughness={0.95}
            transparent={isSouth || undefined}
            opacity={isSouth ? 0.3 : 1}
          />
        </mesh>
      ))}

      {/* Mid-height stone band — horizontal molding */}
      {[
        [0, WH * 0.5, -H - W / 2 + 0.15, FULL + W * 2, 0.25, 0.35, false] as const,
        [0, WH * 0.5, H + W / 2 - 0.15, FULL + W * 2, 0.25, 0.35, true] as const,
        [-H - W / 2 + 0.15, WH * 0.5, 0, 0.35, 0.25, FULL, false] as const,
        [H + W / 2 - 0.15, WH * 0.5, 0, 0.35, 0.25, FULL, false] as const,
      ].map(([x, y, z, w, h, d, isSouth], i) => (
        <mesh key={`mid_${i}`} position={[x, y, z]}>
          <boxGeometry args={[w, h, d]} />
          <meshStandardMaterial
            color="#4a3868"
            roughness={0.85}
            metalness={0.08}
            transparent={isSouth || undefined}
            opacity={isSouth ? 0.3 : 1}
          />
        </mesh>
      ))}

      <WallButtresses />
    </group>
  );
}

// ─── Wall Buttresses — vertical pilasters + decorative details ──────────────

function WallButtress({ x, y, z, along }: { x: number; y: number; z: number; along: "x" | "z" }) {
  const depth = along === "x" ? 0.5 : 0.35;
  const width = along === "x" ? 0.35 : 0.5;
  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, WH / 2, 0]}>
        <boxGeometry args={[width, WH, depth]} />
        <meshStandardMaterial color="#3e3058" roughness={0.9} metalness={0.05} />
      </mesh>
      <mesh position={[0, WH * 0.55, along === "z" ? (z > 0 ? -depth / 2 - 0.02 : depth / 2 + 0.02) : 0]}>
        <boxGeometry args={[width * 0.4, 0.5, 0.02]} />
        <meshStandardMaterial color="#5a30a0" emissive="#4a2080" emissiveIntensity={0.8} roughness={0.3} />
      </mesh>
    </group>
  );
}

function WallButtresses() {
  const buttresses: { x: number; z: number; along: "x" | "z" }[] = [];
  const spacing = 10;

  // North + south walls — buttresses along X axis
  for (let bx = -H + spacing; bx < H; bx += spacing) {
    buttresses.push({ x: bx, z: -H - W / 2 + 0.3, along: "z" });
    buttresses.push({ x: bx, z: H + W / 2 - 0.3, along: "z" });
  }
  // West + east walls — buttresses along Z axis
  for (let bz = -H + spacing; bz < H; bz += spacing) {
    buttresses.push({ x: -H - W / 2 + 0.3, z: bz, along: "x" });
    buttresses.push({ x: H + W / 2 - 0.3, z: bz, along: "x" });
  }

  return (
    <group>
      {buttresses.map((b, i) => (
        <WallButtress key={i} x={b.x} y={0} z={b.z} along={b.along} />
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
      <DungeonFloor />
      <Walls />
      <Pillars />
      <ArenaBorderGlow />
    </group>
  );
}
