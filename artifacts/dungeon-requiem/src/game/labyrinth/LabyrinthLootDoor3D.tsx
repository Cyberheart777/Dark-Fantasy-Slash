/**
 * LabyrinthLootDoor3D.tsx
 *
 * Visual placeholder for the locked loot-room door. Picked at scene
 * mount from an outer-ring dead-end (Chebyshev distance ≥ 7 from
 * maze center) and rendered as a distinct arch + inset door + glowing
 * lock icon. Purely decorative this commit:
 *
 *   - No collision (player walks right through)
 *   - No interaction / pickup prompt
 *   - No opening logic
 *
 * The key drop + unlock mechanic lands with item #4 (champion) + #7
 * (loot room logic). This placeholder just marks the intended
 * location so we can see it in playtest.
 *
 * Unlit meshBasicMaterial throughout — iOS-safe.
 */

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

interface Props {
  /** World position of the loot-room cell, or null if no cell was
   *  picked (e.g., maze had no outer-ring dead-ends — degenerate case). */
  x: number;
  z: number;
}

export function LabyrinthLootDoor3D({ x, z }: Props) {
  const lockRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    // Pulsing lock icon so the door reads as "locked, waiting".
    if (!lockRef.current) return;
    const mat = lockRef.current.material as THREE.MeshBasicMaterial;
    const p = 0.6 + 0.4 * (0.5 + 0.5 * Math.sin(state.clock.elapsedTime * 2.2));
    mat.opacity = p;
  });

  return (
    <group position={[x, 0, z]}>
      {/* Stone arch — two pillars + lintel. */}
      <mesh position={[-1.1, 1.4, 0]}>
        <boxGeometry args={[0.55, 2.8, 0.55]} />
        <meshBasicMaterial color="#6a6078" depthWrite={true} />
      </mesh>
      <mesh position={[1.1, 1.4, 0]}>
        <boxGeometry args={[0.55, 2.8, 0.55]} />
        <meshBasicMaterial color="#6a6078" depthWrite={true} />
      </mesh>
      <mesh position={[0, 3.0, 0]}>
        <boxGeometry args={[2.6, 0.5, 0.55]} />
        <meshBasicMaterial color="#6a6078" depthWrite={true} />
      </mesh>
      {/* Inset door panel — darker, slightly behind the arch plane. */}
      <mesh position={[0, 1.3, -0.1]}>
        <boxGeometry args={[1.8, 2.4, 0.18]} />
        <meshBasicMaterial color="#2a1e38" depthWrite={true} />
      </mesh>
      {/* Iron bands across the door. */}
      <mesh position={[0, 2.15, 0.02]}>
        <boxGeometry args={[1.9, 0.18, 0.08]} />
        <meshBasicMaterial color="#3a2a4a" depthWrite={false} />
      </mesh>
      <mesh position={[0, 0.55, 0.02]}>
        <boxGeometry args={[1.9, 0.18, 0.08]} />
        <meshBasicMaterial color="#3a2a4a" depthWrite={false} />
      </mesh>
      {/* Glowing lock icon — pulses via useFrame. Orange-gold so it
          reads as "still locked, find the key" against the purple
          door. */}
      <mesh ref={lockRef} position={[0, 1.3, 0.12]}>
        <boxGeometry args={[0.3, 0.35, 0.08]} />
        <meshBasicMaterial
          color="#ffb040"
          transparent
          opacity={0.8}
          depthWrite={false}
        />
      </mesh>
      {/* Keyhole — small dark rect centered on the lock plate. */}
      <mesh position={[0, 1.25, 0.17]}>
        <boxGeometry args={[0.08, 0.14, 0.02]} />
        <meshBasicMaterial color="#100818" depthWrite={false} />
      </mesh>
    </group>
  );
}
