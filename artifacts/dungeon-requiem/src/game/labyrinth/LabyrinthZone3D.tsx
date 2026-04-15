/**
 * LabyrinthZone3D.tsx
 * Visual for the closing zone:
 *   - Venom-green overlay over the floor ONLY outside the current
 *     safe radius (battle-royale blue-zone style: danger colored,
 *     safe area untouched).
 *   - A fog cylinder at the boundary so the danger reads as a wall
 *     of toxic mist rising, not just a floor tint.
 *   - A bright neon-green boundary ring for the precise crossing line.
 *
 * How the "hole" works:
 *   1. A DEPTH-MASK disc is drawn first (colorWrite=false, renderOrder=0).
 *      It writes to the depth buffer but not the colour buffer — it's
 *      invisible but it reserves the safe-radius region's depth.
 *   2. The green exterior plane is drawn second (renderOrder=1,
 *      depthTest=true). Where the depth mask already wrote a
 *      closer-to-camera depth, the green plane's fragments fail
 *      the depth test and the REAL maze floor beneath shows
 *      through unchanged.
 *   3. The boundary ring + fog cylinder render normally.
 *
 * This approach needs zero shader code and is bulletproof: as the
 * safe radius shrinks, the mask shrinks with it, and more of the
 * green plane becomes visible — exactly the battle-royale feel.
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
const VENOM_GREEN = "#3dff8a";
const VENOM_DARK = "#0d3a1c";

export function LabyrinthZone3D({ radius, isPaused }: Props) {
  const wallRef = useRef<THREE.Mesh>(null);
  const ringRef = useRef<THREE.Mesh>(null);
  const maskRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    // Cylinder wall at the boundary — cylinderGeometry's radius is in
    // the X-Z plane, so scale.set(R, 1, R) is correct here.
    if (wallRef.current) {
      wallRef.current.scale.set(radius, 1, radius);
    }
    // Ring + mask are circleGeometry rotated [-π/2, 0, 0] to lie
    // horizontal. CircleGeometry's radius is in LOCAL X-Y. After the
    // rotation, local X maps to world X and local Y maps to world -Z.
    // So to scale the circle's WORLD radius we set scale.set(R, R, 1)
    // — NOT (R, 1, R), which would only scale local X (world X) and
    // leave local Y (world Z) at unit radius → a 1-unit-wide ellipse
    // that's almost invisible. This was the long-standing bug behind
    // "the green is everywhere" — the mask disc was never actually
    // covering the safe zone.
    if (ringRef.current) {
      const pulseSpeed = isPaused ? 1.2 : 2.6;
      const pulse = 1 + 0.04 * Math.sin(state.clock.elapsedTime * pulseSpeed);
      ringRef.current.scale.set(radius * pulse, radius * pulse, 1);
    }
    if (maskRef.current) {
      maskRef.current.scale.set(radius, radius, 1);
    }
  });

  return (
    <group>
      {/* 1. Depth mask — invisible disc at safe-zone radius. Writes
             depth but not colour. Drawn first (renderOrder=0) so the
             green plane can depth-test against it. */}
      <mesh
        ref={maskRef}
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0.02, 0]}
        renderOrder={0}
      >
        <circleGeometry args={[1, 96]} />
        <meshBasicMaterial colorWrite={false} />
      </mesh>

      {/* 2. Green venom exterior — drawn second. Depth-tests against
             the mask above, so fragments inside the safe radius are
             culled and the real maze floor shows through unchanged.
             Outside the mask, the green renders over the floor. */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0.015, 0]}
        renderOrder={1}
      >
        <circleGeometry args={[OUTER_BOUND, 64]} />
        <meshBasicMaterial color={VENOM_GREEN} />
      </mesh>

      {/* 3. Boundary fog cylinder — rises from the safe-zone edge. */}
      <mesh ref={wallRef} position={[0, WALL_HEIGHT / 2, 0]} renderOrder={2}>
        <cylinderGeometry args={[1, 1, WALL_HEIGHT, 96, 1, true]} />
        <meshBasicMaterial
          color={VENOM_DARK}
          side={THREE.BackSide}
          transparent
          opacity={0.82}
          depthWrite={false}
        />
      </mesh>

      {/* 4. Neon-green boundary ring — the crisp "this is the line" cue. */}
      <mesh
        ref={ringRef}
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0.06, 0]}
        renderOrder={3}
      >
        <ringGeometry args={[0.975, 1.02, 96]} />
        <meshBasicMaterial color={VENOM_GREEN} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}
