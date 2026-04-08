/**
 * Projectile3D.tsx
 * Renders mage orbs and rogue daggers with improved animations:
 *   - Daggers: spin along travel axis + shimmer trail
 *   - Orbs: inner glow flicker + ring rotation on two axes + hover bob
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
  const innerRef = useRef<THREE.Mesh>(null);
  const ringRef = useRef<THREE.Mesh>(null);
  const trailRef = useRef<THREE.Mesh>(null);
  const t = useRef(Math.random() * Math.PI * 2);

  useFrame((_, delta) => {
    if (!groupRef.current) return;
    t.current += delta;

    groupRef.current.position.set(proj.x, 0.8, proj.z);

    if (proj.style === "orb") {
      // Orb: multi-axis rotation
      groupRef.current.rotation.y = t.current * 2;
      groupRef.current.rotation.x = Math.sin(t.current * 1.5) * 0.3;
      groupRef.current.position.y = 0.8 + Math.sin(t.current * 4) * 0.08;
      // Inner core flicker
      if (innerRef.current) {
        const mat = innerRef.current.material as THREE.MeshStandardMaterial;
        mat.emissiveIntensity = 2.5 + Math.sin(t.current * 12) * 1.0;
      }
      // Ring tilt animation
      if (ringRef.current) {
        ringRef.current.rotation.x = Math.PI / 2 + Math.sin(t.current * 1.8) * 0.4;
        ringRef.current.rotation.z = t.current * 1.5;
      }
    } else {
      // Dagger: align to travel direction + spin along travel axis
      const angle = Math.atan2(proj.vx, proj.vz);
      groupRef.current.rotation.y = angle;
      groupRef.current.position.y = 0.7;
      // Spin along the forward axis (barrel roll)
      if (groupRef.current.children[0]) {
        (groupRef.current.children[0] as THREE.Object3D).rotation.z = t.current * 14;
      }
      // Trail stretch based on speed
      if (trailRef.current) {
        const speed = Math.sqrt(proj.vx * proj.vx + proj.vz * proj.vz);
        trailRef.current.scale.z = 0.8 + speed * 0.03;
        const mat = trailRef.current.material as THREE.MeshStandardMaterial;
        mat.opacity = 0.4 + Math.sin(t.current * 10) * 0.2;
      }
    }

    // Glow pulse
    if (lightRef.current) {
      lightRef.current.position.set(proj.x, 0.9, proj.z);
      lightRef.current.intensity = proj.style === "orb"
        ? 2.5 + Math.sin(t.current * 5) * 0.5
        : 1.5 + Math.sin(t.current * 8) * 0.3;
    }
  });

  if (proj.style === "orb") {
    return (
      <>
        <group ref={groupRef}>
          {/* Core orb */}
          <mesh ref={innerRef} castShadow>
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
          <mesh ref={ringRef} rotation={[Math.PI / 2, 0, 0]}>
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

  // Dagger — with spin and trail
  return (
    <>
      <group ref={groupRef}>
        {/* Spinning inner group */}
        <group>
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
          {/* Tip — bright leading edge */}
          <mesh position={[0, 0, -0.52]}>
            <coneGeometry args={[0.04, 0.15, 4]} rotation={[Math.PI / 2, 0, 0]} />
            <meshStandardMaterial
              color={proj.glowColor}
              emissive={proj.glowColor}
              emissiveIntensity={4}
              transparent
              opacity={0.9}
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
        {/* Motion trail */}
        <mesh ref={trailRef} position={[0, 0, 0.35]}>
          <boxGeometry args={[0.03, 0.03, 0.5]} />
          <meshStandardMaterial
            color={proj.glowColor}
            emissive={proj.glowColor}
            emissiveIntensity={2}
            transparent
            opacity={0.5}
            depthWrite={false}
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
