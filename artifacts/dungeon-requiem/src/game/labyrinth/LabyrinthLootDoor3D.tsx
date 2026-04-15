/**
 * LabyrinthLootDoor3D.tsx
 *
 * Loot-room door renderer. Two visual states driven by the `unlocked`
 * prop (item 7):
 *
 *   unlocked=false → stone arch + inset door + glowing gold lock,
 *                    lock pulses to signal "waiting for key".
 *   unlocked=true  → arch remains; door panel slides down + fades
 *                    out; lock icon hides; green indicator light
 *                    glows inside the frame.
 *
 * Movement gating lives in MovementLoop (circle-vs-cell collision
 * against the loot-room cell centre). This component is visual-only.
 *
 * Unlit meshBasicMaterial throughout — iOS-safe.
 */

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

interface Props {
  x: number;
  z: number;
  /** Flipped true the frame the player consumes the key. Door slides
   *  + fades out, lock icon disappears, arch stays. */
  unlocked: boolean;
}

export function LabyrinthLootDoor3D({ x, z, unlocked }: Props) {
  const lockRef = useRef<THREE.Mesh>(null);
  const doorRef = useRef<THREE.Mesh>(null);
  const openProgress = useRef(0); // 0..1 animation progress after unlock

  useFrame((state, delta) => {
    // Advance the open animation whenever unlocked.
    if (unlocked && openProgress.current < 1) {
      openProgress.current = Math.min(1, openProgress.current + delta * 0.9);
    } else if (!unlocked && openProgress.current > 0) {
      // In case unlocked flips back (shouldn't happen in a run), snap
      // closed. Kept for robustness.
      openProgress.current = 0;
    }
    // Pulsing lock icon while LOCKED; hidden while unlocked.
    if (lockRef.current) {
      const mat = lockRef.current.material as THREE.MeshBasicMaterial;
      if (unlocked) {
        mat.opacity = Math.max(0, 0.8 - openProgress.current * 2);
      } else {
        mat.opacity = 0.6 + 0.4 * (0.5 + 0.5 * Math.sin(state.clock.elapsedTime * 2.2));
      }
    }
    // Door slides down + fades as it opens.
    if (doorRef.current) {
      const mat = doorRef.current.material as THREE.MeshBasicMaterial;
      const yOffset = -openProgress.current * 2.6;
      doorRef.current.position.y = 1.3 + yOffset;
      mat.opacity = 1 - openProgress.current;
    }
  });

  return (
    <group position={[x, 0, z]}>
      {/* Stone arch — two pillars + lintel. Always visible. */}
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
      {/* Inset door panel — slides down + fades when unlocked. */}
      <mesh ref={doorRef} position={[0, 1.3, -0.1]}>
        <boxGeometry args={[1.8, 2.4, 0.18]} />
        <meshBasicMaterial
          color="#2a1e38"
          transparent
          opacity={1}
          depthWrite={true}
        />
      </mesh>
      {/* Iron bands — hidden when unlocked by reusing unlocked prop */}
      {!unlocked && (
        <>
          <mesh position={[0, 2.15, 0.02]}>
            <boxGeometry args={[1.9, 0.18, 0.08]} />
            <meshBasicMaterial color="#3a2a4a" depthWrite={false} />
          </mesh>
          <mesh position={[0, 0.55, 0.02]}>
            <boxGeometry args={[1.9, 0.18, 0.08]} />
            <meshBasicMaterial color="#3a2a4a" depthWrite={false} />
          </mesh>
        </>
      )}
      {/* Glowing lock icon — fades out as open animation progresses. */}
      <mesh ref={lockRef} position={[0, 1.3, 0.12]}>
        <boxGeometry args={[0.3, 0.35, 0.08]} />
        <meshBasicMaterial
          color="#ffb040"
          transparent
          opacity={0.8}
          depthWrite={false}
        />
      </mesh>
      {/* Keyhole — hidden when unlocked. */}
      {!unlocked && (
        <mesh position={[0, 1.25, 0.17]}>
          <boxGeometry args={[0.08, 0.14, 0.02]} />
          <meshBasicMaterial color="#100818" depthWrite={false} />
        </mesh>
      )}
      {/* Success glow — a green point light that fades in once the
          door is open, so the vault reads as "clear to enter". */}
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
