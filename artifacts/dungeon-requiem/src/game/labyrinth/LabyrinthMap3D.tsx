/**
 * LabyrinthMap3D.tsx
 * 3D rendering of the generated maze — floor + walls.
 *
 * Walls are rendered as instanced meshes for performance. Floor is a
 * single large plane. Palette shifts per layer to feel progressively
 * more menacing as the player descends deeper.
 */

import { useMemo, useRef, useEffect } from "react";
import * as THREE from "three";
import {
  LABYRINTH_CONFIG,
  LABYRINTH_WORLD_EXTENT,
} from "./LabyrinthConfig";
import { extractWallSegments, type Maze } from "./LabyrinthMaze";

const LAYER_PALETTE: Record<number, {
  floor: string; floorEmissive: string; floorEmissiveIntensity: number;
  wall: string; wallEmissive: string; wallEmissiveIntensity: number;
}> = {
  1: {
    floor: "#1a1230", floorEmissive: "#2a1a48", floorEmissiveIntensity: 0.5,
    wall: "#8a7ab0", wallEmissive: "#6a5a94", wallEmissiveIntensity: 0.8,
  },
  2: {
    floor: "#120a1e", floorEmissive: "#1a0c2e", floorEmissiveIntensity: 0.3,
    wall: "#5a4a6e", wallEmissive: "#3a2a50", wallEmissiveIntensity: 0.6,
  },
  3: {
    floor: "#0a0610", floorEmissive: "#100818", floorEmissiveIntensity: 0.2,
    wall: "#3a2a44", wallEmissive: "#200c30", wallEmissiveIntensity: 0.4,
  },
};

interface LabyrinthMap3DProps {
  maze: Maze;
  layer?: 1 | 2 | 3;
}

export function LabyrinthMap3D({ maze, layer = 1 }: LabyrinthMap3DProps) {
  const segments = useMemo(() => extractWallSegments(maze), [maze]);
  const palette = LAYER_PALETTE[layer] ?? LAYER_PALETTE[1];

  return (
    <group>
      <Floor palette={palette} />
      <Ceiling />
      <Walls segments={segments} palette={palette} />
    </group>
  );
}

function Floor({ palette }: { palette: typeof LAYER_PALETTE[1] }) {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
      <planeGeometry args={[LABYRINTH_WORLD_EXTENT, LABYRINTH_WORLD_EXTENT]} />
      <meshStandardMaterial
        color={palette.floor}
        emissive={palette.floorEmissive}
        emissiveIntensity={palette.floorEmissiveIntensity}
        roughness={0.88}
        metalness={0.06}
      />
    </mesh>
  );
}

function Ceiling() {
  return (
    <mesh
      rotation={[Math.PI / 2, 0, 0]}
      position={[0, LABYRINTH_CONFIG.WALL_HEIGHT, 0]}
    >
      <planeGeometry args={[LABYRINTH_WORLD_EXTENT, LABYRINTH_WORLD_EXTENT]} />
      <meshStandardMaterial
        color="#0a0610"
        roughness={1.0}
        metalness={0}
      />
    </mesh>
  );
}

function Walls({ segments, palette }: {
  segments: ReturnType<typeof extractWallSegments>;
  palette: typeof LAYER_PALETTE[1];
}) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const wallH = LABYRINTH_CONFIG.WALL_HEIGHT;
  const wallT = LABYRINTH_CONFIG.WALL_THICKNESS;
  const WALL_LIFT = 0.05;

  useEffect(() => {
    if (!meshRef.current) return;
    const mesh = meshRef.current;
    const dummy = new THREE.Object3D();

    for (let i = 0; i < segments.length; i++) {
      const s = segments[i];
      dummy.position.set(s.cx, wallH / 2 + WALL_LIFT, s.cz);
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
      frustumCulled={false}
    >
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial
        color={palette.wall}
        emissive={palette.wallEmissive}
        emissiveIntensity={palette.wallEmissiveIntensity}
        roughness={0.92}
        metalness={0}
      />
    </instancedMesh>
  );
}
