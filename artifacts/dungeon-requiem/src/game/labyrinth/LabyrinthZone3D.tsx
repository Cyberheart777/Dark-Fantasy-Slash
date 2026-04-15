/**
 * LabyrinthZone3D.tsx
 * Visual for the closing zone:
 *   - A tall venom-green cylinder shell at the zone boundary
 *   - An OPAQUE venom-green ground overlay filling the "dead" exterior
 *     so the safe area reads as a clear bright hole in a sickly fog
 *   - A bright neon-green ring pulse AT the boundary as the
 *     crossing-line indicator
 *
 * Previously the outside was a 85%-opaque dark-purple disc, which
 * blended into the dark maze floor on the bottom half of the screen
 * and made the danger zone hard to read. Now it's unambiguously
 * toxic green.
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
/** Venom green — unmistakable against the dark maze floor. */
const VENOM_GREEN = "#3dff8a";
const VENOM_DARK = "#0d3a1c";

export function LabyrinthZone3D({ radius, isPaused }: Props) {
  const wallRef = useRef<THREE.Mesh>(null);
  const ringRef = useRef<THREE.Mesh>(null);
  const floorRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    // Cylinder wall at the boundary
    if (wallRef.current) {
      wallRef.current.scale.set(radius, 1, radius);
    }
    // Ground pulse ring at the boundary — pulses slightly for visibility
    if (ringRef.current) {
      const pulseSpeed = isPaused ? 1.2 : 2.6;
      const pulse = 1 + 0.04 * Math.sin(state.clock.elapsedTime * pulseSpeed);
      ringRef.current.scale.set(radius * pulse, 1, radius * pulse);
    }
    // Inverse "mask" disc that covers the safe interior so the venom
    // exterior plane only shows OUTSIDE the safe zone.
    if (floorRef.current) {
      floorRef.current.scale.set(radius, 1, radius);
    }
  });

  return (
    <group>
      {/* Opaque venom-green exterior overlay — covers entire maze from
          under the floor, then the inner mask disc cuts a hole at
          the current safe radius so only the danger ring shows. */}
      <ExteriorGroundPlane />

      {/* Inner mask — scales with radius; rendered on top of the venom
          exterior plane and matches the floor colour so the safe
          zone looks like the normal maze floor. Effectively "cuts
          a hole" in the venom overlay. depthWrite=false so it
          doesn't occlude walls standing on the floor. */}
      <mesh ref={floorRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.011, 0]}>
        <circleGeometry args={[1, 96]} />
        <meshBasicMaterial color="#1a1230" depthWrite={false} />
      </mesh>

      {/* Boundary cylinder — the venom fog rising up at the edge. */}
      <mesh ref={wallRef} position={[0, WALL_HEIGHT / 2, 0]}>
        <cylinderGeometry args={[1, 1, WALL_HEIGHT, 96, 1, true]} />
        <meshBasicMaterial
          color={VENOM_DARK}
          side={THREE.BackSide}
          transparent
          opacity={0.82}
          depthWrite={false}
        />
      </mesh>

      {/* Bright neon-green boundary ring — the "this is the line" cue.
          Thick and fully opaque so it reads from any angle. */}
      <mesh ref={ringRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.06, 0]}>
        <ringGeometry args={[0.975, 1.02, 96]} />
        <meshBasicMaterial
          color={VENOM_GREEN}
          side={THREE.DoubleSide}
        />
      </mesh>
    </group>
  );
}

/** Large opaque venom-green disc that sits beneath the mask,
 *  colouring everything outside the current safe radius. */
function ExteriorGroundPlane() {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.008, 0]}>
      <circleGeometry args={[OUTER_BOUND, 64]} />
      <meshBasicMaterial color={VENOM_GREEN} />
    </mesh>
  );
}
