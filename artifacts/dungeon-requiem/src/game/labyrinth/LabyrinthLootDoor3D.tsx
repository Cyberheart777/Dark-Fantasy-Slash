/**
 * LabyrinthLootDoor3D.tsx
 *
 * Loot-room door embedded in the maze wall architecture. Placed ON
 * the dead-end's single open-wall edge (not floating at cell centre)
 * so it reads as part of the corridor geometry — stone pillars hug
 * the walls on either side, the door panel spans the gap.
 *
 * Two visual states driven by the `unlocked` prop:
 *   unlocked=false → pillars + inset door + glowing gold lock +
 *                    pulsing lock icon. Locked door fills the gap.
 *   unlocked=true  → door panel slides down into the floor + fades;
 *                    lock icon hides; green point-light glows
 *                    inside the frame signalling "open vault".
 *
 * Movement collision + key-consume trigger live in MovementLoop
 * (circle-vs-disc at the loot cell centre). This component is
 * visual-only and reads `unlocked` each frame to animate.
 *
 * Unlit meshBasicMaterial throughout — iOS-safe.
 */

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { WallDir } from "./LabyrinthMaze";
import { LABYRINTH_CONFIG } from "./LabyrinthConfig";

interface Props {
  /** World position of the loot-room cell centre. */
  x: number;
  z: number;
  /** Which cardinal wall is the open side (the door fills this gap). */
  openDir: WallDir;
  /** True after the player walks through with the champion key. */
  unlocked: boolean;
}

export function LabyrinthLootDoor3D({ x, z, openDir, unlocked }: Props) {
  const lockRef = useRef<THREE.Mesh>(null);
  const doorRef = useRef<THREE.Mesh>(null);
  const openProgress = useRef(0);

  // Position offset toward the open wall + rotation so the door
  // spans the corridor. When the cell's North wall is open, the
  // door sits at (cellX, cellZ - CELL_SIZE/2) rotated 0°; for East
  // it's at (cellX + CELL_SIZE/2, cellZ) rotated 90°; etc.
  const { offsetX, offsetZ, yaw } = useMemo(() => {
    const half = LABYRINTH_CONFIG.CELL_SIZE / 2;
    switch (openDir) {
      case "N": return { offsetX: 0,     offsetZ: -half, yaw: 0 };
      case "S": return { offsetX: 0,     offsetZ:  half, yaw: 0 };
      case "E": return { offsetX:  half, offsetZ: 0,     yaw: Math.PI / 2 };
      case "W": return { offsetX: -half, offsetZ: 0,     yaw: Math.PI / 2 };
    }
  }, [openDir]);

  useFrame((state, delta) => {
    if (unlocked && openProgress.current < 1) {
      openProgress.current = Math.min(1, openProgress.current + delta * 0.9);
    } else if (!unlocked && openProgress.current > 0) {
      openProgress.current = 0;
    }
    if (lockRef.current) {
      const mat = lockRef.current.material as THREE.MeshBasicMaterial;
      if (unlocked) {
        mat.opacity = Math.max(0, 0.8 - openProgress.current * 2);
      } else {
        mat.opacity = 0.6 + 0.4 * (0.5 + 0.5 * Math.sin(state.clock.elapsedTime * 2.2));
      }
    }
    if (doorRef.current) {
      const mat = doorRef.current.material as THREE.MeshBasicMaterial;
      const yOffset = -openProgress.current * 2.6;
      doorRef.current.position.y = 1.3 + yOffset;
      mat.opacity = 1 - openProgress.current;
    }
  });

  // Door spans wall-to-wall in the corridor. Task 6: doubled from 1.3
  // so the door panel reaches the full corridor opening. With
  // CELL_SIZE 8 and WALL_THICKNESS 1.5, the open corridor span is
  // ≈ 6.5u — PILLAR_HALF_SPAN 2.6 gives 5.2u of door + pillars tucked
  // into the walls on each side so the door spans the gap visually.
  // Collision (MovementLoop LOCK_R) is untouched.
  const PILLAR_HALF_SPAN = 2.6;

  return (
    <group position={[x + offsetX, 0, z + offsetZ]} rotation={[0, yaw, 0]}>
      {/* Stone pillars — tucked into each wall at ±PILLAR_HALF_SPAN
          so the arch reads as load-bearing stone embedded in the
          corridor rather than a decoration placed in open space. */}
      <mesh position={[-PILLAR_HALF_SPAN, 1.4, 0]}>
        <boxGeometry args={[0.7, 2.8, LABYRINTH_CONFIG.WALL_THICKNESS + 0.3]} />
        <meshBasicMaterial color="#5a4f68" depthWrite={true} />
      </mesh>
      <mesh position={[PILLAR_HALF_SPAN, 1.4, 0]}>
        <boxGeometry args={[0.7, 2.8, LABYRINTH_CONFIG.WALL_THICKNESS + 0.3]} />
        <meshBasicMaterial color="#5a4f68" depthWrite={true} />
      </mesh>
      {/* Lintel — stone beam spanning the two pillars. */}
      <mesh position={[0, 2.9, 0]}>
        <boxGeometry args={[PILLAR_HALF_SPAN * 2 + 0.7, 0.5, LABYRINTH_CONFIG.WALL_THICKNESS + 0.3]} />
        <meshBasicMaterial color="#5a4f68" depthWrite={true} />
      </mesh>
      {/* Door panel — spans the gap between the two pillars. Slides
          down + fades when unlocked. */}
      <mesh ref={doorRef} position={[0, 1.3, 0]}>
        <boxGeometry args={[PILLAR_HALF_SPAN * 2 - 0.2, 2.4, 0.25]} />
        <meshBasicMaterial
          color="#1e1530"
          transparent
          opacity={1}
          depthWrite={true}
        />
      </mesh>
      {/* Iron bands — hidden when open. */}
      {!unlocked && (
        <>
          <mesh position={[0, 2.0, 0.16]}>
            <boxGeometry args={[PILLAR_HALF_SPAN * 2 - 0.1, 0.18, 0.05]} />
            <meshBasicMaterial color="#3a2a4a" depthWrite={false} />
          </mesh>
          <mesh position={[0, 0.6, 0.16]}>
            <boxGeometry args={[PILLAR_HALF_SPAN * 2 - 0.1, 0.18, 0.05]} />
            <meshBasicMaterial color="#3a2a4a" depthWrite={false} />
          </mesh>
        </>
      )}
      {/* Pulsing gold lock plate with keyhole — fades out on unlock. */}
      <mesh ref={lockRef} position={[0, 1.3, 0.2]}>
        <boxGeometry args={[0.35, 0.4, 0.08]} />
        <meshBasicMaterial
          color="#ffb040"
          transparent
          opacity={0.8}
          depthWrite={false}
        />
      </mesh>
      {!unlocked && (
        <mesh position={[0, 1.25, 0.26]}>
          <boxGeometry args={[0.09, 0.16, 0.02]} />
          <meshBasicMaterial color="#100818" depthWrite={false} />
        </mesh>
      )}
      {/* Open-state green glow to signal vault cleared. */}
      {unlocked && (
        <pointLight
          color="#60ff80"
          intensity={3.5}
          distance={6}
          decay={2}
          position={[0, 1.2, 0]}
        />
      )}
    </group>
  );
}
