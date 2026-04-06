/**
 * XPOrb3D.tsx
 * Floating XP crystal collectible — 4 tiers by enemy strength.
 *
 * green  = scuttler  (1× base)
 * blue   = wraith/brute (10× base)
 * purple = elite     (30× base)
 * orange = boss      (50× base)
 */

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { XPOrb } from "../game/GameScene";

interface XPOrbProps {
  orb: XPOrb;
}

const TIER_STYLES = {
  green:  { color: "#60ff30", emissive: "#30cc10", light: "#40ff20", size: 0.13, lightIntensity: 0.5 },
  blue:   { color: "#40aaff", emissive: "#1060dd", light: "#2080ff", size: 0.18, lightIntensity: 0.9 },
  purple: { color: "#cc60ff", emissive: "#7010cc", light: "#aa30ff", size: 0.24, lightIntensity: 1.4 },
  orange: { color: "#ffcc20", emissive: "#ff7700", light: "#ffaa00", size: 0.30, lightIntensity: 2.0 },
} as const;

export function XPOrb3D({ orb }: XPOrbProps) {
  const ref = useRef<THREE.Group>(null);
  const t = useRef(orb.floatOffset);

  useFrame((_, delta) => {
    t.current += delta;
    if (ref.current) {
      ref.current.position.set(orb.x, 0.4 + Math.sin(t.current * 3) * 0.18, orb.z);
      ref.current.rotation.y = t.current * 2.2;
    }
  });

  const style = TIER_STYLES[orb.crystalTier ?? "green"];

  return (
    <group ref={ref}>
      <mesh castShadow>
        <octahedronGeometry args={[style.size, 0]} />
        <meshStandardMaterial
          color={style.color}
          emissive={style.emissive}
          emissiveIntensity={2.8}
          roughness={0.15}
          metalness={0.4}
        />
      </mesh>
      {/* Inner shard for higher tiers */}
      {orb.crystalTier !== "green" && (
        <mesh castShadow rotation={[0.5, 0.5, 0]} scale={0.55}>
          <octahedronGeometry args={[style.size, 0]} />
          <meshStandardMaterial
            color={style.color}
            emissive={style.emissive}
            emissiveIntensity={5}
            roughness={0.05}
            metalness={0.6}
            transparent
            opacity={0.7}
          />
        </mesh>
      )}
      <pointLight color={style.light} intensity={style.lightIntensity} distance={3.5} decay={2} />
    </group>
  );
}
