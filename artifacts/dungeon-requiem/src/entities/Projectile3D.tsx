/**
 * Projectile3D.tsx
 * Renders mage orbs and rogue daggers.
 * Position is read directly from the Projectile runtime each frame.
 */

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { Projectile } from "../game/GameScene";

interface ProjectileProps {
  proj: Projectile;
}

export function Projectile3D({ proj }: ProjectileProps) {
  const groupRef = useRef<THREE.Group>(null);
  const lightRef = useRef<THREE.PointLight>(null);
  const t = useRef(Math.random() * Math.PI * 2);

  useFrame((_, delta) => {
    if (!groupRef.current) return;
    t.current += delta;

    groupRef.current.position.set(proj.x, 0.8, proj.z);

    if (proj.style === "orb") {
      // Pulsing orbit rotation
      groupRef.current.rotation.y = t.current * 2;
      groupRef.current.rotation.x = Math.sin(t.current * 1.5) * 0.3;
      // Hover float
      groupRef.current.position.y = 0.8 + Math.sin(t.current * 4) * 0.08;
    } else {
      // Dagger: align to travel direction
      const angle = Math.atan2(proj.vx, proj.vz);
      groupRef.current.rotation.y = angle;
      groupRef.current.position.y = 0.7;
    }

    // Glow pulse
    if (lightRef.current) {
      lightRef.current.position.set(proj.x, 0.9, proj.z);
      lightRef.current.intensity = proj.style === "orb"
        ? 2.5 + Math.sin(t.current * 5) * 0.5
        : 1.5;
    }
  });

  if (proj.style === "orb") {
    return (
      <>
        <group ref={groupRef}>
          {/* Core orb */}
          <mesh castShadow>
            <sphereGeometry args={[0.42, 10, 8]} />
            <meshStandardMaterial
              color={proj.color}
              emissive={proj.glowColor}
              emissiveIntensity={2.5}
              roughness={0.1}
              metalness={0.3}
              transparent
              opacity={0.9}
            />
          </mesh>
          {/* Outer shell */}
          <mesh>
            <sphereGeometry args={[0.56, 8, 6]} />
            <meshStandardMaterial
              color={proj.glowColor}
              emissive={proj.glowColor}
              emissiveIntensity={1.2}
              transparent
              opacity={0.25}
              side={THREE.BackSide}
            />
          </mesh>
          {/* Orbiting ring */}
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.6, 0.05, 6, 16]} />
            <meshStandardMaterial
              color={proj.glowColor}
              emissive={proj.glowColor}
              emissiveIntensity={3}
            />
          </mesh>
        </group>
        <pointLight
          ref={lightRef}
          color={proj.glowColor}
          intensity={2.5}
          distance={7}
          decay={2}
        />
      </>
    );
  }

  // Dagger
  return (
    <>
      <group ref={groupRef}>
        {/* Blade */}
        <mesh position={[0, 0, -0.22]} castShadow>
          <boxGeometry args={[0.07, 0.07, 0.55]} />
          <meshStandardMaterial
            color={proj.color}
            emissive={proj.glowColor}
            emissiveIntensity={1.8}
            metalness={0.9}
            roughness={0.1}
          />
        </mesh>
        {/* Tip trail — elongated bright shard */}
        <mesh position={[0, 0, -0.52]}>
          <boxGeometry args={[0.05, 0.05, 0.22]} />
          <meshStandardMaterial
            color={proj.glowColor}
            emissive={proj.glowColor}
            emissiveIntensity={3}
            transparent
            opacity={0.8}
          />
        </mesh>
        {/* Guard */}
        <mesh position={[0, 0, 0.05]}>
          <boxGeometry args={[0.22, 0.06, 0.06]} />
          <meshStandardMaterial
            color={proj.color}
            metalness={0.8}
            roughness={0.2}
          />
        </mesh>
      </group>
      <pointLight
        ref={lightRef}
        color={proj.glowColor}
        intensity={1.5}
        distance={4}
        decay={2}
      />
    </>
  );
}
