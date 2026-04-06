/**
 * XPOrb3D.tsx
 * Floating XP orb collectible.
 */

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { XPOrb } from "../game/GameScene";

interface XPOrbProps {
  orb: XPOrb;
}

export function XPOrb3D({ orb }: XPOrbProps) {
  const ref = useRef<THREE.Group>(null);
  const t = useRef(orb.floatOffset);

  useFrame((_, delta) => {
    t.current += delta;
    if (ref.current) {
      ref.current.position.set(orb.x, 0.4 + Math.sin(t.current * 3) * 0.15, orb.z);
      ref.current.rotation.y = t.current * 2;
    }
  });

  const isLargeOrb = orb.value >= 100;
  const color = isLargeOrb ? "#ffaa00" : "#a0ff60";
  const emissive = isLargeOrb ? "#ff8800" : "#60ff20";
  const size = isLargeOrb ? 0.22 : 0.14;

  return (
    <group ref={ref}>
      <mesh castShadow>
        <octahedronGeometry args={[size, 0]} />
        <meshStandardMaterial
          color={color}
          emissive={emissive}
          emissiveIntensity={2.5}
          roughness={0.2}
          metalness={0.3}
        />
      </mesh>
      <pointLight color={emissive} intensity={0.5} distance={2} decay={2} />
    </group>
  );
}
