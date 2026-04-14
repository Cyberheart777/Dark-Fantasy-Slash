/**
 * LabyrinthZone3D.tsx
 * Visual for the closing zone:
 *   - A tall dark cylinder shell at the zone boundary (the "wall of
 *     corruption" approaching the player)
 *   - A semi-transparent ground disc filling the consumed exterior
 *     so the player can see from far away which areas are dead
 *   - A glowing ring pulse at the boundary for visibility
 *
 * The geometry animates via useFrame, reading the radius prop.
 * All material is unlit / emissive so lighting doesn't wash it out.
 */

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { LABYRINTH_CONFIG, LABYRINTH_HALF } from "./LabyrinthConfig";

interface Props {
  /** Current safe-zone radius in world units. */
  radius: number;
  /** Whether the zone is currently in its pause phase (changes pulse speed). */
  isPaused: boolean;
}

const WALL_HEIGHT = LABYRINTH_CONFIG.WALL_HEIGHT * 1.15;
const OUTER_BOUND = LABYRINTH_HALF * 2.2;

export function LabyrinthZone3D({ radius, isPaused }: Props) {
  const wallRef = useRef<THREE.Mesh>(null);
  const ringRef = useRef<THREE.Mesh>(null);
  const floorRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    // Cylinder wall at the boundary
    if (wallRef.current) {
      wallRef.current.scale.set(radius, 1, radius);
    }
    // Ground pulse ring at the boundary
    if (ringRef.current) {
      const pulseSpeed = isPaused ? 1.2 : 2.6;
      const pulse = 1 + 0.06 * Math.sin(state.clock.elapsedTime * pulseSpeed);
      ringRef.current.scale.set(radius * pulse, 1, radius * pulse);
    }
    // Ground overlay — dark disc with a hole in the middle at current radius
    // We achieve the hole by scaling the inner ring geometry. Since
    // RingGeometry is fixed at creation, we use a separate mesh pair.
    if (floorRef.current) {
      floorRef.current.scale.set(radius, 1, radius);
    }
  });

  return (
    <group>
      {/* Outer ground: huge dark disc covering the entire maze exterior */}
      <ExteriorGroundPlane />

      {/* Inverse scaler — a mesh that scales WITH radius to "cover" the safe
          portion of the ground disc. The layer order is: exterior plane
          (dark) below, then this floor ref (matching floor color) above,
          which "cuts a hole" in the dark overlay as it scales with radius. */}
      <mesh ref={floorRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.011, 0]}>
        <circleGeometry args={[1, 96]} />
        <meshBasicMaterial color="#3a2c50" transparent opacity={1.0} />
      </mesh>

      {/* Tall cylinder shell at the boundary — the "wall of corruption" */}
      <mesh ref={wallRef} position={[0, WALL_HEIGHT / 2, 0]}>
        <cylinderGeometry args={[1, 1, WALL_HEIGHT, 96, 1, true]} />
        <meshBasicMaterial
          color="#20002a"
          side={THREE.BackSide}
          transparent
          opacity={0.92}
          depthWrite={false}
        />
      </mesh>

      {/* Inner glow wisps on the boundary cylinder — purple aurora feel */}
      <mesh ref={ringRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.05, 0]}>
        <ringGeometry args={[0.985, 1.015, 96]} />
        <meshBasicMaterial
          color="#c040ff"
          side={THREE.DoubleSide}
          transparent
          opacity={0.85}
        />
      </mesh>
    </group>
  );
}

/** Large dark disc that sits under the shrinking floor-circle, showing
 *  the exterior of the current safe zone. Stationary and full-size. */
function ExteriorGroundPlane() {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.008, 0]}>
      <circleGeometry args={[OUTER_BOUND, 64]} />
      <meshBasicMaterial
        color="#0a0014"
        transparent
        opacity={0.85}
      />
    </mesh>
  );
}
