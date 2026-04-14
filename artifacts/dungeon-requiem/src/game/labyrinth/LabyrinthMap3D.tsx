/**
 * LabyrinthMap3D.tsx
 * 3D rendering of the generated maze — floor + walls.
 *
 * Walls are rendered as instanced meshes for performance (even a
 * 21×21 maze has ~440 wall segments). Floor is a single large plane.
 *
 * Visual style matches the core dungeon (dark stone, purple tint) but
 * does NOT import DungeonRoom.tsx — that's the single-room asset for
 * the normal mode. The labyrinth owns its own environment.
 */

import { useMemo, useRef, useEffect } from "react";
import * as THREE from "three";
import {
  LABYRINTH_CONFIG,
  LABYRINTH_WORLD_EXTENT,
} from "./LabyrinthConfig";
import { extractWallSegments, type Maze } from "./LabyrinthMaze";

const FLOOR_COLOR = "#3a2c50";
const WALL_COLOR = "#2a2038";
const WALL_ACCENT = "#5a4078";

interface LabyrinthMap3DProps {
  maze: Maze;
}

export function LabyrinthMap3D({ maze }: LabyrinthMap3DProps) {
  const segments = useMemo(() => extractWallSegments(maze), [maze]);

  return (
    <group>
      <Floor />
      <Ceiling />
      <Walls segments={segments} />
    </group>
  );
}

// ─── Floor ───────────────────────────────────────────────────────────────────

function Floor() {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
      <planeGeometry args={[LABYRINTH_WORLD_EXTENT, LABYRINTH_WORLD_EXTENT]} />
      <meshStandardMaterial
        color={FLOOR_COLOR}
        roughness={0.88}
        metalness={0.06}
      />
    </mesh>
  );
}

// ─── Ceiling ─────────────────────────────────────────────────────────────────
// A dark ceiling plane above the walls to give the maze an enclosed feeling.
// Low-intensity emissive glow so the corridor tops aren't pitch black.

function Ceiling() {
  return (
    <mesh
      rotation={[Math.PI / 2, 0, 0]}
      position={[0, LABYRINTH_CONFIG.WALL_HEIGHT, 0]}
    >
      <planeGeometry args={[LABYRINTH_WORLD_EXTENT, LABYRINTH_WORLD_EXTENT]} />
      <meshStandardMaterial
        color="#0a0610"
        side={THREE.DoubleSide}
        roughness={1.0}
        metalness={0}
      />
    </mesh>
  );
}

// ─── Walls ───────────────────────────────────────────────────────────────────
// Instanced rendering: one InstancedMesh holds all wall segments, each
// positioned via its own transformation matrix. Vastly cheaper than
// rendering ~440 separate Box meshes.

function Walls({ segments }: { segments: ReturnType<typeof extractWallSegments> }) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const wallH = LABYRINTH_CONFIG.WALL_HEIGHT;
  const wallT = LABYRINTH_CONFIG.WALL_THICKNESS;

  // Update instance transforms whenever segments change
  useEffect(() => {
    if (!meshRef.current) return;
    const mesh = meshRef.current;
    const dummy = new THREE.Object3D();

    for (let i = 0; i < segments.length; i++) {
      const s = segments[i];
      dummy.position.set(s.cx, wallH / 2, s.cz);
      dummy.rotation.set(0, 0, 0);
      if (s.orient === "h") {
        dummy.scale.set(s.length, wallH, wallT);
      } else {
        dummy.scale.set(wallT, wallH, s.length);
      }
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
    mesh.count = segments.length;
  }, [segments, wallH, wallT]);

  return (
    <instancedMesh
      ref={meshRef}
      args={[undefined, undefined, segments.length]}
      castShadow
      receiveShadow
    >
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial
        color={WALL_COLOR}
        roughness={0.85}
        metalness={0.08}
        emissive={WALL_ACCENT}
        emissiveIntensity={0.05}
      />
    </instancedMesh>
  );
}
