/**
 * LabyrinthProjectile3D.tsx
 *
 * Renders each LabProjectile. Player projectiles forward to the main
 * game's Projectile3D. Enemy projectiles render as simple glowing
 * spheres (no pointLights) for performance. Crescents use a local
 * renderer without pointLight. Enemy daggers use a dagger shape.
 */

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { Projectile3D } from "../../entities/Projectile3D";
import type { Projectile } from "../GameScene";
import type { LabProjectile } from "./LabyrinthProjectile";

export function LabyrinthProjectiles3D({ projectiles }: { projectiles: LabProjectile[] }) {
  return (
    <>
      {projectiles.map((p) =>
        p.style === "crescent"
          ? <CrescentProjectile3D key={p.id} proj={p} />
          : p.owner === "enemy" && p.style === "dagger"
            ? <EnemyDagger3D key={p.id} proj={p} />
            : p.owner === "enemy"
              ? <EnemyBall3D key={p.id} proj={p} />
              : <Projectile3D key={p.id} proj={p as unknown as Projectile} />
      )}
    </>
  );
}

function EnemyBall3D({ proj }: { proj: LabProjectile }) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame(() => {
    if (!ref.current) return;
    ref.current.position.set(proj.x, 0.8, proj.z);
  });
  return (
    <mesh ref={ref}>
      <sphereGeometry args={[0.25, 6, 4]} />
      <meshStandardMaterial
        color={proj.color || "#ff4444"}
        emissive={proj.glowColor || "#cc2222"}
        emissiveIntensity={3}
      />
    </mesh>
  );
}

function EnemyDagger3D({ proj }: { proj: LabProjectile }) {
  const ref = useRef<THREE.Group>(null);
  const t = useRef(Math.random() * 100);
  useFrame((_, delta) => {
    t.current += delta;
    if (!ref.current) return;
    ref.current.position.set(proj.x, 0.9, proj.z);
    ref.current.rotation.y = Math.atan2(proj.vx, proj.vz) + Math.PI;
    ref.current.rotation.z = t.current * 12;
  });
  const bladeColor = proj.color || "#30cc60";
  const hiltColor = proj.glowColor || "#1a8830";
  return (
    <group ref={ref}>
      <mesh position={[0, 0, -0.18]}>
        <boxGeometry args={[0.06, 0.06, 0.4]} />
        <meshStandardMaterial
          color={bladeColor}
          emissive={hiltColor}
          emissiveIntensity={3}
          metalness={0.9}
          roughness={0.1}
        />
      </mesh>
      <mesh position={[0, 0, 0.04]}>
        <boxGeometry args={[0.16, 0.05, 0.05]} />
        <meshStandardMaterial color={hiltColor} metalness={0.7} roughness={0.2} />
      </mesh>
    </group>
  );
}

function CrescentProjectile3D({ proj }: { proj: LabProjectile }) {
  const ref = useRef<THREE.Group>(null);
  useFrame(() => {
    if (!ref.current) return;
    ref.current.position.set(proj.x, 1.4, proj.z);
    ref.current.rotation.y = Math.atan2(proj.vx, proj.vz);
    ref.current.rotation.x = -0.3;
  });
  return (
    <group ref={ref}>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[1.3, 0.18, 8, 32, Math.PI * 0.75]} />
        <meshStandardMaterial
          color="#ff4400"
          emissive="#ff2200"
          emissiveIntensity={8}
          roughness={0.05}
          metalness={0.9}
        />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[1.3, 0.35, 6, 32, Math.PI * 0.75]} />
        <meshStandardMaterial
          color="#ff6600"
          emissive="#ff4400"
          emissiveIntensity={3}
          transparent
          opacity={0.3}
          side={THREE.BackSide}
        />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[1.3, 0.06, 6, 32, Math.PI * 0.75]} />
        <meshStandardMaterial
          color="#ffaa44"
          emissive="#ffcc66"
          emissiveIntensity={12}
        />
      </mesh>
    </group>
  );
}
