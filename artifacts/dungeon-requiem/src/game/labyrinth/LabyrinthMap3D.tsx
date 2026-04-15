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
// Walls were "#2a2038" with a "#5a4078" emissive accent — too dark to
// read against the floor under fog, and the instanced-mesh combination
// of castShadow + receiveShadow + emissive caused visible edge flicker
// at the corners where wall segments met. Lifted to a brighter
// dusk-purple stone, matte material, no shadow casting (see Walls()).
const WALL_COLOR = "#7a6a96";

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
  // Strongly self-emissive so the floor is visible without depending
  // on direct lighting. Now that scene lights have been dialled back
  // to keep characters from washing out walls, the floor needs to
  // carry its own brightness baseline. Same trick for walls below.
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
      <planeGeometry args={[LABYRINTH_WORLD_EXTENT, LABYRINTH_WORLD_EXTENT]} />
      <meshStandardMaterial
        color={FLOOR_COLOR}
        emissive="#5a3870"
        emissiveIntensity={1.4}
        roughness={0.88}
        metalness={0.06}
      />
    </mesh>
  );
}

// ─── Ceiling ─────────────────────────────────────────────────────────────────
// A dark ceiling plane above the walls to give the maze an enclosed feeling
// from inside. The plane's normal faces DOWN (after the X-rotation), so with
// single-side rendering the top-down camera (which sits ABOVE y=6 looking
// through) sees its back face and back-face culling makes it invisible —
// which is what we want. DoubleSide was previously enabled, which made the
// ceiling render as a near-black overlay obscuring the entire maze when
// viewed from above. If we ever add a first-person view, the ceiling
// remains correctly visible from below.

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

// ─── Walls ───────────────────────────────────────────────────────────────────
// Instanced rendering: one InstancedMesh holds all wall segments, each
// positioned via its own transformation matrix. Vastly cheaper than
// rendering ~440 separate Box meshes.

function Walls({ segments }: { segments: ReturnType<typeof extractWallSegments> }) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const wallH = LABYRINTH_CONFIG.WALL_HEIGHT;
  const wallT = LABYRINTH_CONFIG.WALL_THICKNESS;
  // Wall bottoms sit just above the floor (y=0) and the zone overlay
  // planes (y=0.008, y=0.011 in LabyrinthZone3D). With the tilted
  // camera, coplanar geometry caused visible flicker along the wall
  // bases — lifting the walls 0.05 units kills the z-fight without
  // being noticeable on screen.
  const WALL_LIFT = 0.05;

  // Update instance transforms whenever segments change
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

  // No shadow casting (Canvas-level shadows are disabled for iOS
  // readability). Walls carry strong self-emissive so they're
  // distinct from the floor regardless of how aggressive the scene
  // lighting is. Without this they'd blend into the floor's purple
  // tone whenever ambient gets cranked up to make characters visible.
  return (
    <instancedMesh
      ref={meshRef}
      args={[undefined, undefined, segments.length]}
    >
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial
        color={WALL_COLOR}
        emissive="#7050a0"
        emissiveIntensity={1.2}
        roughness={0.92}
        metalness={0}
      />
    </instancedMesh>
  );
}
