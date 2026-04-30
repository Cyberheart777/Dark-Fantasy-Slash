/**
 * Projectile3D.tsx
 * Renders mage orbs and rogue daggers with improved animations:
 *   - Daggers: spin along travel axis + shimmer trail
 *   - Orbs: inner glow flicker + ring rotation on two axes + hover bob
 *
 * Performance: no pointLights, no castShadow, no outer-shell halo.
 * Each on-screen point light multiplies fragment-shader cost across
 * the whole scene; with mage orbs + boss radial bursts + champion
 * projectiles, the per-projectile lights were the dominant FPS hit.
 * The labyrinth projectile renderer learned this earlier (see its
 * header comment); classic mode now matches.
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
    } else if (proj.style === "note") {
      // Note: billboard facing camera, gentle bob
      groupRef.current.position.y = 0.8 + Math.sin(t.current * 3 + (proj.x * 0.5)) * 0.1;
      groupRef.current.rotation.y = t.current * 1.5;
    } else {
      // Dagger: align to travel direction + spin along travel axis
      const angle = Math.atan2(proj.vx, proj.vz);
      groupRef.current.rotation.y = angle + Math.PI;
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
  });

  if (proj.style === "note") {
    return (
      <group ref={groupRef}>
        {/* Note head — filled circle */}
        <mesh rotation={[-Math.PI / 4, 0, 0]}>
          <circleGeometry args={[0.18, 8]} />
          <meshBasicMaterial color="#ffd040" side={THREE.DoubleSide} />
        </mesh>
        {/* Note stem — thin vertical line */}
        <mesh position={[0.16, 0.22, 0]} rotation={[-Math.PI / 4, 0, 0]}>
          <boxGeometry args={[0.03, 0.4, 0.01]} />
          <meshBasicMaterial color="#ffaa22" />
        </mesh>
        {/* Flag at top of stem */}
        <mesh position={[0.2, 0.38, 0]} rotation={[-Math.PI / 4, 0, 0.3]}>
          <boxGeometry args={[0.12, 0.03, 0.01]} />
          <meshBasicMaterial color="#ffaa22" />
        </mesh>
      </group>
    );
  }

  if (proj.style === "orb") {
    return (
      <group ref={groupRef}>
        {/* Core orb — bright emissive sphere, no shadow */}
        <mesh ref={innerRef}>
          <sphereGeometry args={[0.21, 10, 8]} />
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
        {/* Orbiting ring */}
        <mesh ref={ringRef} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.3, 0.03, 6, 16]} />
          <meshStandardMaterial
            color={proj.glowColor}
            emissive={proj.glowColor}
            emissiveIntensity={3}
          />
        </mesh>
      </group>
    );
  }

  // Dagger — with spin and trail, no point light or shadow
  return (
    <group ref={groupRef}>
      {/* Spinning inner group */}
      <group>
        {/* Blade */}
        <mesh position={[0, 0, -0.22]}>
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
        <mesh position={[0, 0, -0.52]} rotation={[Math.PI / 2, 0, 0]}>
          <coneGeometry args={[0.04, 0.15, 4]} />
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
      {/* Motion trail — skip for fan-of-knives burst */}
      {!proj.fanOfKnives && (
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
      )}
    </group>
  );
}
