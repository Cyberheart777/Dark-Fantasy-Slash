/**
 * DustParticles.tsx
 * Floating dust motes + wall-hugging mist wisps.
 * Uses instanced points for performance.
 */

import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { GAME_CONFIG } from "../data/GameConfig";

const ARENA = GAME_CONFIG.ARENA_HALF;
const DUST_COUNT = 200;
const WISP_COUNT = 60;
const TOTAL = DUST_COUNT + WISP_COUNT;

/** Initialize particle positions and velocities. */
function initParticles() {
  const positions = new Float32Array(TOTAL * 3);
  const velocities = new Float32Array(TOTAL * 3);
  const sizes = new Float32Array(TOTAL);

  // Dust motes — spread across arena volume
  for (let i = 0; i < DUST_COUNT; i++) {
    const i3 = i * 3;
    positions[i3]     = (Math.random() - 0.5) * ARENA * 1.6;  // x
    positions[i3 + 1] = 0.5 + Math.random() * 4.5;             // y (0.5 to 5.0)
    positions[i3 + 2] = (Math.random() - 0.5) * ARENA * 1.6;  // z
    velocities[i3]     = (Math.random() - 0.5) * 0.3;
    velocities[i3 + 1] = (Math.random() - 0.5) * 0.05;
    velocities[i3 + 2] = (Math.random() - 0.5) * 0.3;
    sizes[i] = 0.04 + Math.random() * 0.04;
  }

  // Wall wisps — near walls, on floor
  for (let i = DUST_COUNT; i < TOTAL; i++) {
    const i3 = i * 3;
    const wall = Math.floor(Math.random() * 4);
    const along = (Math.random() - 0.5) * ARENA * 1.6;
    const offset = ARENA - 1 - Math.random() * 3;
    switch (wall) {
      case 0: positions[i3] = along; positions[i3 + 2] = -offset; break; // north
      case 1: positions[i3] = along; positions[i3 + 2] =  offset; break; // south
      case 2: positions[i3] = -offset; positions[i3 + 2] = along; break; // west
      case 3: positions[i3] =  offset; positions[i3 + 2] = along; break; // east
    }
    positions[i3 + 1] = 0.1 + Math.random() * 0.5; // near floor
    // Drift along wall slowly
    const driftSpeed = 0.1 + Math.random() * 0.15;
    if (wall < 2) {
      velocities[i3]     = (Math.random() - 0.5) * driftSpeed;
      velocities[i3 + 2] = 0;
    } else {
      velocities[i3]     = 0;
      velocities[i3 + 2] = (Math.random() - 0.5) * driftSpeed;
    }
    velocities[i3 + 1] = (Math.random() - 0.5) * 0.02;
    sizes[i] = 0.1 + Math.random() * 0.1;
  }

  return { positions, velocities, sizes };
}

export function DustParticles() {
  const pointsRef = useRef<THREE.Points>(null);

  const { positions, velocities } = useMemo(() => initParticles(), []);

  useFrame((_, delta) => {
    if (!pointsRef.current) return;
    const geom = pointsRef.current.geometry;
    const posAttr = geom.getAttribute("position") as THREE.BufferAttribute;
    if (!posAttr) return;
    const pos = posAttr.array as Float32Array;
    const bound = ARENA + 2;

    for (let i = 0; i < TOTAL; i++) {
      const i3 = i * 3;
      pos[i3]     += velocities[i3]     * delta;
      pos[i3 + 1] += velocities[i3 + 1] * delta;
      pos[i3 + 2] += velocities[i3 + 2] * delta;

      // Wrap around when leaving bounds
      if (pos[i3]     >  bound) pos[i3]     = -bound;
      if (pos[i3]     < -bound) pos[i3]     =  bound;
      if (pos[i3 + 2] >  bound) pos[i3 + 2] = -bound;
      if (pos[i3 + 2] < -bound) pos[i3 + 2] =  bound;
      // Vertical wrap for dust motes
      if (i < DUST_COUNT) {
        if (pos[i3 + 1] > 5.5) pos[i3 + 1] = 0.5;
        if (pos[i3 + 1] < 0.3) pos[i3 + 1] = 5.0;
      }
    }

    posAttr.needsUpdate = true;
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        color="#ffddaa"
        size={0.06}
        sizeAttenuation
        transparent
        opacity={0.35}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}
